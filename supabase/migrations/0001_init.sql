-- ============================================================================
-- Quiz Night — persistent-player layer (anonymous-first)
-- ----------------------------------------------------------------------------
-- Apply in your Supabase project (SQL editor, or `supabase db push`).
-- The frontend uses anonymous auth: each device signs in anonymously and its
-- auth uid IS its profile id. Phones write their OWN result rows at game end,
-- so RLS only ever needs `auth.uid()` checks (no server/service role).
-- The publishable anon key ships in the static bundle; RLS is the boundary.
-- ============================================================================

-- ---- profiles: one row per (anonymous) player, owned by their auth uid ------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  emoji      text,
  color      text,
  photo      text,                                   -- small data-URL avatar (app caps ~120 KB)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- results: one immutable row per player per finished game -----------------
create table if not exists public.results (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  game_id     text not null,                         -- the host's game.id
  quiz_title  text not null default '',
  score       integer not null default 0,
  won         boolean not null default false,
  team_name   text,                                  -- null in solo mode
  room_code   text,
  played_at   timestamptz not null default now(),
  unique (profile_id, game_id)                        -- one row per player per game (anti double-write)
);

create index if not exists results_profile_played_idx
  on public.results (profile_id, played_at desc);

-- ---- Row Level Security ------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.results  enable row level security;

-- profiles: a user may only see/create/update THEIR OWN profile.
-- (Peer avatars/names already travel over MQTT, so no cross-user read is needed.)
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- results: a user may only insert/read rows for their own profile.
-- No update/delete policy => those are denied by default (rows are immutable).
create policy "results_insert_own" on public.results
  for insert with check (profile_id = auth.uid());
create policy "results_select_own" on public.results
  for select using (profile_id = auth.uid());

-- ---- keep profiles.updated_at fresh -----------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
