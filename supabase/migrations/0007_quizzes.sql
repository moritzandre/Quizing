-- ============================================================================
-- Quiz Night — 0007: quiz backup (admin-authored quizzes mirrored to the DB)
-- ----------------------------------------------------------------------------
-- Fully idempotent — safe to run on a project that already has 0002–0006.
--
-- Goal: quizzes live in the browser (localStorage). This adds a best-effort
-- server-side BACKUP: whenever an admin creates or edits a quiz, the app upserts
-- the full quiz JSON here so it can be pulled back if a browser is lost. It is a
-- backup only — the app never reads quizzes from here (you fetch them from the
-- Supabase dashboard / SQL and re-import the JSON). Writes are admin-only.
-- ============================================================================

-- ---- the backup table -------------------------------------------------------
create table if not exists public.quizzes (
  id         text primary key,              -- the quiz's own app id (stable across edits)
  title      text,
  data       jsonb not null,                -- the full quiz JSON (as exported)
  owner      uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quizzes_updated_at_idx on public.quizzes (updated_at desc);

-- Clients never touch this table directly; only the SECURITY DEFINER upsert
-- below (running as owner) writes it. RLS-on + no policies + revoke = closed.
-- (The project owner still reads it freely via the dashboard / service role.)
alter table public.quizzes enable row level security;
revoke all on public.quizzes from anon, authenticated;

-- ---- admin-only upsert ------------------------------------------------------
-- Insert or update a quiz backup, keyed by its app id. Admin-gated exactly like
-- the other write RPCs (0004). Anonymous player sessions have the `authenticated`
-- role but are not admins, so the is_admin() check rejects them.
create or replace function public.upsert_quiz(p_id text, p_title text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_id is null or length(trim(p_id)) = 0 or p_data is null then return false; end if;
  insert into public.quizzes (id, title, data, owner, updated_at)
  values (trim(p_id), p_title, p_data, auth.uid(), now())
  on conflict (id) do update
    set title = excluded.title,
        data = excluded.data,
        updated_at = now();
  return true;
end $$;

-- ---- grants -----------------------------------------------------------------
grant execute on function public.upsert_quiz(text, text, jsonb) to authenticated;
