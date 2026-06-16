-- ============================================================================
-- Quiz Night — 0004: "ultimate admin" allow-list + admin-gated player creation
-- ----------------------------------------------------------------------------
-- Fully idempotent — safe to run on a project that already has 0002/0003.
--
-- Goal: lock the ability to CREATE players to admins only, so a stranger who
-- opens the public site can't pollute the shared playerbase. An admin is a real
-- Supabase email/password auth user listed in `public.admins`. This is the only
-- server-enforced boundary; the host UI is gated client-side off the same
-- identity. Joining / picking / unlocking / editing / recording stay open.
--
-- Setup the project owner does ONCE:
--   1. Dashboard → Authentication → Providers → enable "Email" (you may turn
--      off "Confirm email" for convenience, or confirm via the emailed link).
--   2. Run this migration.
--   3. Sign in once via the app's Host sign-in (creates your auth user), then
--      click "Claim admin" (calls claim_first_admin) — or seed via SQL:
--        insert into public.admins (user_id, email, protected)
--        select id, email, true from auth.users where lower(email) = lower('you@example.com');
--   Anyone can still sign UP for an auth account, but it grants nothing unless
--   they're in `public.admins` (the allow-list is the gate).
-- ============================================================================

-- ---- the allow-list ---------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  protected  boolean not null default false, -- the "ultimate" admin: can't be revoked by others
  created_at timestamptz not null default now()
);
-- Clients never touch this table directly; only the SECURITY DEFINER functions
-- below (running as owner) read/write it. RLS-on + no policies + revoke = closed.
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- ============================================================================
-- SECURITY DEFINER RPCs (owner = postgres; each pins search_path)
-- ============================================================================

-- True iff the current auth session belongs to an admin. Used both inside the
-- gated RPCs below AND by clients (rpc('is_admin')) to gate the host UI.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Bootstrap: the first EMAIL user claims the (protected) ultimate-admin slot,
-- but ONLY while the table is empty. Claim it before sharing the URL.
-- CRITICAL: this MUST reject anonymous sessions. Every player phone silently
-- gets an anonymous Supabase session (signInAnonymously), which has a real,
-- non-null auth.uid() and the `authenticated` role — so a uid-not-null check
-- alone would let any visitor seize the (irrevocable) protected admin slot from
-- the browser console with the publishable key. Anonymous users have no email,
-- so requiring a non-empty email is the gate. For the strongest guarantee, seed
-- public.admins via SQL (see the header) so the table is never empty publicly.
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid; v_email text;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;            -- must be signed in
  if exists (select 1 from public.admins) then return false; end if; -- already claimed
  select email into v_email from auth.users where id = v_uid;
  if v_email is null or length(trim(v_email)) = 0 then return false; end if; -- reject anonymous sessions
  insert into public.admins (user_id, email, protected)
  values (v_uid, v_email, true)
  on conflict (user_id) do nothing;
  return true;
end $$;

-- Let an existing admin add another by email (the target must have signed up
-- once so their auth user exists). This is "let specific people I trust in".
create or replace function public.grant_admin(p_email text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid; v_email text;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_email is null or length(trim(p_email)) = 0 then return false; end if;
  select id, email into v_uid, v_email from auth.users
   where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then return false; end if;            -- no such signed-up user
  insert into public.admins (user_id, email, protected)
  values (v_uid, v_email, false)
  on conflict (user_id) do nothing;
  return true;
end $$;

-- Remove an admin. Refuses to remove a protected admin (the ultimate admin
-- can't be locked out) or to empty the table.
create or replace function public.revoke_admin(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_protected boolean;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select protected into v_protected from public.admins where user_id = p_user_id;
  if not found then return false; end if;
  if v_protected then raise exception 'cannot revoke the protected admin'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'cannot remove the last admin'; end if;
  delete from public.admins where user_id = p_user_id;
  return true;
end $$;

-- ---- gate create_player on admin (otherwise identical to 0002/0003) ---------
-- Non-admin sessions (anonymous players, strangers) can no longer create
-- profiles. Players still self-create at join time, but that request is RELAYED
-- through the admin-authed host (see useRoom.js), so creation only ever happens
-- inside a game an admin is hosting.
create or replace function public.create_player(p_name text, p_emoji text, p_color text, p_photo text, p_pin text)
returns public.profiles_public language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare new_id uuid; out public.profiles_public;
begin
  if not public.is_admin() then raise exception 'admin required to create players'; end if;
  insert into public.profiles (name, emoji, color, photo, pin_hash)
  values (
    coalesce(nullif(p_name, ''), 'Player'), p_emoji, p_color, p_photo,
    case
      when p_pin is null or length(p_pin) = 0 then null
      when p_pin ~ '^[0-9]{6,8}$' then crypt(p_pin, gen_salt('bf', 10))
      else null
    end
  )
  returning id into new_id;
  select * into out from public.profiles_public where id = new_id;
  return out;
end $$;

-- ---- grants -----------------------------------------------------------------
grant execute on function
  public.is_admin(),
  public.claim_first_admin(),
  public.grant_admin(text),
  public.revoke_admin(uuid),
  public.create_player(text, text, text, text, text)
  to anon, authenticated;
