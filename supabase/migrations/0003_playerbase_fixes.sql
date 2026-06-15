-- ============================================================================
-- Quiz Night — 0003: fixes for two bugs in 0002 (run this if you applied 0002)
-- ----------------------------------------------------------------------------
-- Fully idempotent — safe to run on a project that already has 0002.
--
-- Bug 1: the PIN functions couldn't find pgcrypto (crypt/gen_salt). Supabase
--        installs pgcrypto in the `extensions` schema, but 0002 pinned the
--        functions' search_path to (public, pg_temp) — so create_player /
--        set_pin / verify_pin / update_player all errored
--        ("function gen_salt(unknown, integer) does not exist"), which is why
--        the "create player" button did nothing. Fix: add `extensions` to the
--        search_path.
-- Bug 2: pin_hash was client-readable. A column-level `revoke select (pin_hash)`
--        is overridden by the table-level SELECT grant Supabase gives anon/
--        authenticated, so clients could still read the hash. Fix: revoke ALL
--        table privileges on `profiles` — clients only ever use the
--        profiles_public view + the SECURITY DEFINER functions below.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---- Bug 2: lock the base table; reads go through the view, writes through RPCs
revoke all on public.profiles from anon, authenticated;

-- ---- Bug 1: recreate the crypto functions with `extensions` on the search_path
create or replace function public.verify_pin(p_id uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text;
begin
  select pin_hash into h from public.profiles where id = p_id;
  if not found then return false; end if;
  if h is null then return true; end if;
  return crypt(coalesce(p_pin, ''), h) = h;
end $$;

create or replace function public.set_pin(p_id uuid, p_current_pin text, p_new_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text;
begin
  select pin_hash into h from public.profiles where id = p_id;
  if not found then return false; end if;
  if h is not null and crypt(coalesce(p_current_pin, ''), h) <> h then return false; end if;
  if p_new_pin is null or length(p_new_pin) = 0 then
    update public.profiles set pin_hash = null where id = p_id;
  elsif p_new_pin ~ '^[0-9]{6,8}$' then
    update public.profiles set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)) where id = p_id;
  else
    return false;
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

-- create-or-replace preserves grants, but re-assert to be safe
grant execute on function
  public.verify_pin(uuid, text),
  public.set_pin(uuid, text, text),
  public.create_player(text, text, text, text, text),
  public.update_player(uuid, text, text, text, text, text)
  to anon, authenticated;
