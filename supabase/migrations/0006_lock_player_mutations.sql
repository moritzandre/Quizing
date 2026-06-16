-- ============================================================================
-- Quiz Night — 0006: close the anon set_pin / update_player hole left by 0004
-- ----------------------------------------------------------------------------
-- Fully idempotent — safe to run on a project that already has 0002–0005.
--
-- 0004 admin-gated create_player so a stranger can't pollute the shared
-- playerbase with FAKE profiles. But set_pin and update_player stayed anon-open
-- and only check a PIN when the row is ALREADY locked — so a stranger with the
-- publishable key could still grief EXISTING players:
--   * set_pin on an unlocked player → LOCK (seize) a player they don't own.
--   * update_player on an unlocked player → rename / re-avatar anyone.
-- This migration closes both while preserving the two legitimate flows:
--   * the relay create flow, where a phone locks the player it JUST created
--     (set_pin within minutes of creation — allowed by a short grace window);
--   * a player who knows their PIN changing it (the existing crypt check).
--
-- Model: locking an ESTABLISHED unlocked player, or editing any player, now
-- requires either an admin session or (for set_pin) the brief post-creation
-- grace window. Admin edits go through the separate admin_* RPCs (0005).
-- PINs remain a documented SOFT lock (no recovery) — this just stops drive-by
-- seizure/vandalism of the shared directory, matching 0004's intent.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---- set_pin: restrict LOCKING an unlocked player ---------------------------
-- Unchanged for: clearing a PIN, or changing an existing PIN (still requires the
-- current PIN via the crypt check). NEW: locking a currently-unlocked player is
-- allowed only for an admin, or within 15 minutes of the player's creation (the
-- relay create flow), so a stranger can't seize a long-standing unlocked player.
create or replace function public.set_pin(p_id uuid, p_current_pin text, p_new_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text; v_created timestamptz;
begin
  select pin_hash, created_at into h, v_created from public.profiles where id = p_id;
  if not found then return false; end if;
  if h is not null and crypt(coalesce(p_current_pin, ''), h) <> h then return false; end if;
  -- locking a currently-unlocked player: gate it (admins, or fresh-creation grace)
  if h is null and p_new_pin is not null and length(p_new_pin) > 0
     and not public.is_admin()
     and (v_created is null or now() - v_created > interval '15 minutes') then
    return false;
  end if;
  if p_new_pin is null or length(p_new_pin) = 0 then
    update public.profiles set pin_hash = null where id = p_id;
  elsif p_new_pin ~ '^[0-9]{6,8}$' then
    update public.profiles set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)) where id = p_id;
  else
    return false;
  end if;
  return true;
end $$;

-- ---- update_player: admin-only ----------------------------------------------
-- Renaming / re-avatar of an arbitrary player is pure griefing of the shared
-- directory and no non-admin client flow uses this RPC (the relay create sets
-- name/avatar at creation; the admin console uses admin_update_player from 0005).
-- So require an admin session. Keeps the PIN check for defence in depth.
create or replace function public.update_player(
  p_id uuid, p_pin text, p_name text, p_emoji text, p_color text, p_photo text)
returns public.profiles_public language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text; out public.profiles_public;
begin
  if not public.is_admin() then raise exception 'admin required to edit players'; end if;
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
  public.set_pin(uuid, text, text),
  public.update_player(uuid, text, text, text, text, text)
  to anon, authenticated;
