-- ============================================================================
-- Quiz Night — 0005: admin player management (for the admin console)
-- ----------------------------------------------------------------------------
-- Fully idempotent — safe to run on a project with 0002/0003/0004 applied.
-- Requires 0004 (the admins allow-list + is_admin()).
--
-- These let a signed-in ADMIN (a row in public.admins) manage any player from
-- the in-app admin console: rename / change avatar, clear or set a PIN, or
-- delete a player. They bypass the per-player PIN (unlike update_player/set_pin)
-- but are gated on is_admin(), so only admins can call them. Reads (the player
-- directory, results history, leaderboard) already work via the existing
-- world-readable views — no new read RPC is needed.
-- ============================================================================

-- Edit any player's name + avatar (emoji = pixel-sprite key, color = hex). No PIN.
create or replace function public.admin_update_player(p_id uuid, p_name text, p_emoji text, p_color text)
returns public.profiles_public language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare out public.profiles_public;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  update public.profiles
     set name = coalesce(nullif(p_name, ''), name),
         emoji = p_emoji,
         color = p_color,
         updated_at = now()
   where id = p_id;
  if not found then raise exception 'no such player'; end if;
  select * into out from public.profiles_public where id = p_id;
  return out;
end $$;

-- Set / change / clear any player's PIN (empty = unlock). No current-PIN needed.
create or replace function public.admin_set_pin(p_id uuid, p_new_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then return false; end if;
  if p_new_pin is null or length(p_new_pin) = 0 then
    update public.profiles set pin_hash = null, updated_at = now() where id = p_id; -- unlock
  elsif p_new_pin ~ '^[0-9]{6,8}$' then
    update public.profiles set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)), updated_at = now() where id = p_id;
  else
    return false;
  end if;
  return true;
end $$;

-- Delete a player. Their `results` rows cascade (0001 FK on delete cascade).
create or replace function public.admin_delete_player(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  delete from public.profiles where id = p_id;
  return found;
end $$;

grant execute on function
  public.admin_update_player(uuid, text, text, text),
  public.admin_set_pin(uuid, text),
  public.admin_delete_player(uuid)
  to anon, authenticated;
