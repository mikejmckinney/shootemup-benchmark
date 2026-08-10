-- Neon Barrage leaderboard schema
-- Public (anon) clients may only INSERT a validated row and SELECT the ranked list.
-- No UPDATE/DELETE policies exist, so those operations are denied by RLS.

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint scores_name_len check (char_length(btrim(name)) between 1 and 16),
  constraint scores_name_chars check (name ~ '^[A-Za-z0-9 _.\-]{1,16}$'),
  constraint scores_score_range check (score >= 0 and score <= 10000000)
);

create index if not exists scores_score_desc_idx
  on public.scores (score desc, created_at asc);

alter table public.scores enable row level security;
alter table public.scores force row level security;

drop policy if exists "public read scores" on public.scores;
create policy "public read scores"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "public insert scores" on public.scores;
create policy "public insert scores"
  on public.scores for insert
  to anon, authenticated
  with check (
    char_length(btrim(name)) between 1 and 16
    and name ~ '^[A-Za-z0-9 _.\-]{1,16}$'
    and score >= 0
    and score <= 10000000
    and created_at is not null
  );

revoke all on public.scores from anon, authenticated;
grant select, insert on public.scores to anon, authenticated;
