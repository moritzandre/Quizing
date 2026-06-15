-- ============================================================================
-- Quiz Night — 0002: shared, login-free "playerbase" + PIN locks + global stats
-- ----------------------------------------------------------------------------
-- ALTERs the already-applied 0001 on the LIVE project. Safe to run with the
-- existing rows (the 0001 "Setup Check" profile survives as an unlocked player).
--
-- Model shift: a profile is no longer owned by an auth user (self-only RLS).
-- It's a SHARED directory row anyone can pick. Identity is decoupled from the
-- anonymous auth session. Writes that must be gated (PINs, results) go through
-- SECURITY DEFINER functions; the pin hash is never readable by clients.
-- ============================================================================

create extension if not exists pgcrypto; -- crypt() / gen_salt('bf')

-- ---- profiles: decouple id from auth.users, add the optional PIN lock --------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists pin_hash text; -- null = unlocked (free to claim)

-- ---- RLS: shared directory (replace 0001's self-only policies) ---------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_any" on public.profiles for insert with check (true);
-- direct UPDATE only on UNLOCKED rows; locked rows are edited via update_player()
create policy "profiles_update_unlocked" on public.profiles for update using (pin_hash is null) with check (true);
-- no delete policy => denied by default

-- ---- keep pin_hash secret: lock the base table entirely -------------------
-- A column-level `revoke select (pin_hash)` is OVERRIDDEN by the table-level
-- SELECT grant Supabase gives anon/authenticated, so it leaks. Instead revoke
-- ALL table privileges — clients only ever touch the profiles_public view (for
-- reads) and the SECURITY DEFINER functions below (for writes/PIN checks), so
-- the hash never reaches a client and the direct policies above can't be abused.
revoke all on public.profiles from anon, authenticated;

-- the pin-free view clients read the directory from (exposes a `locked` boolean)
create or replace view public.profiles_public as
  select id, name, emoji, color, photo, (pin_hash is not null) as locked, created_at, updated_at
  from public.profiles;
grant select on public.profiles_public to anon, authenticated;

-- ---- results: shared, read-all board; writes only via record_result() --------
drop policy if exists "results_insert_own" on public.results;
drop policy if exists "results_select_own" on public.results;
create policy "results_select_all" on public.results for select using (true);
-- intentionally NO insert/update/delete policy => the table is write-locked to
-- clients; record_result() (SECURITY DEFINER) is the only write path. Immutable.

-- ============================================================================
-- SECURITY DEFINER RPCs (owner = postgres; each pins search_path)
-- ============================================================================
create or replace function public.verify_pin(p_id uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text;
begin
  select pin_hash into h from public.profiles where id = p_id;
  if not found then return false; end if;
  if h is null then return true; end if; -- unlocked
  return crypt(coalesce(p_pin, ''), h) = h;
end $$;

create or replace function public.set_pin(p_id uuid, p_current_pin text, p_new_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text;
begin
  select pin_hash into h from public.profiles where id = p_id;
  if not found then return false; end if;
  if h is not null and crypt(coalesce(p_current_pin, ''), h) <> h then return false; end if; -- wrong current PIN
  if p_new_pin is null or length(p_new_pin) = 0 then
    update public.profiles set pin_hash = null where id = p_id; -- unlock
  elsif p_new_pin ~ '^[0-9]{6,8}$' then
    update public.profiles set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)) where id = p_id;
  else
    return false; -- enforce 6-8 digit PINs
  end if;
  return true;
end $$;

create or replace function public.create_player(p_name text, p_emoji text, p_color text, p_photo text, p_pin text)
returns public.profiles_public language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare new_id uuid; out public.profiles_public;
begin
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

create or replace function public.update_player(
  p_id uuid, p_pin text, p_name text, p_emoji text, p_color text, p_photo text)
returns public.profiles_public language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text; out public.profiles_public;
begin
  select pin_hash into h from public.profiles where id = p_id;
  if not found then raise exception 'no such player'; end if;
  if h is not null and crypt(coalesce(p_pin, ''), h) <> h then raise exception 'pin mismatch'; end if;
  update public.profiles
     set name = coalesce(nullif(p_name, ''), name), emoji = p_emoji, color = p_color, photo = p_photo
   where id = p_id;
  select * into out from public.profiles_public where id = p_id;
  return out;
end $$;

create or replace function public.record_result(
  p_profile_id uuid, p_game_id text, p_quiz_title text, p_score int,
  p_won boolean, p_team_name text, p_room_code text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_profile_id is null or p_game_id is null or length(p_game_id) = 0 then return false; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then return false; end if;
  insert into public.results (profile_id, game_id, quiz_title, score, won, team_name, room_code)
  values (
    p_profile_id, p_game_id, coalesce(p_quiz_title, ''),
    greatest(-1000000, least(1000000, coalesce(p_score, 0))),
    coalesce(p_won, false), p_team_name, p_room_code
  )
  on conflict (profile_id, game_id) do nothing; -- idempotent (0001 unique constraint)
  return true;
end $$;

-- ---- global all-time leaderboard view ---------------------------------------
create or replace view public.player_leaderboard as
  select
    p.id, p.name, p.emoji, p.color, p.photo,
    count(r.id) as games,
    coalesce(sum((r.won)::int), 0) as wins,
    coalesce(sum(r.score), 0) as total_score,
    coalesce(max(r.score), 0) as best_score,
    max(r.played_at) as last_played
  from public.profiles p
  join public.results r on r.profile_id = p.id
  group by p.id, p.name, p.emoji, p.color, p.photo;
grant select on public.player_leaderboard to anon, authenticated;

grant execute on function
  public.verify_pin(uuid, text),
  public.set_pin(uuid, text, text),
  public.create_player(text, text, text, text, text),
  public.update_player(uuid, text, text, text, text, text),
  public.record_result(uuid, text, text, int, boolean, text, text)
  to anon, authenticated;
