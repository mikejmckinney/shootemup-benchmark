-- Neon Barrage leaderboard schema
-- Public schema is exposed via PostgREST; RLS is enabled on every table here.

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_name_len check (char_length(btrim(name)) between 1 and 16),
  constraint leaderboard_name_charset check (btrim(name) ~ '^[A-Za-z0-9 _\-\.]{1,16}$'),
  constraint leaderboard_score_range check (score >= 0 and score <= 10000000)
);

create index if not exists leaderboard_score_desc_idx
  on public.leaderboard (score desc, created_at asc);

-- Normalise the name and force server-side defaults for id/created_at.
create or replace function public.leaderboard_normalise()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(new.name);
  new.id := gen_random_uuid();
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists leaderboard_normalise_trg on public.leaderboard;
create trigger leaderboard_normalise_trg
  before insert on public.leaderboard
  for each row execute function public.leaderboard_normalise();

alter table public.leaderboard enable row level security;
alter table public.leaderboard force row level security;

-- Minimum public surface: anonymous clients may read the board and append a row.
drop policy if exists "public read leaderboard" on public.leaderboard;
create policy "public read leaderboard"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public insert leaderboard" on public.leaderboard;
create policy "public insert leaderboard"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(name)) between 1 and 16
    and btrim(name) ~ '^[A-Za-z0-9 _\-\.]{1,16}$'
    and score >= 0
    and score <= 10000000
  );

-- No update/delete policies exist, so those operations are denied for anon.
revoke update, delete, truncate on public.leaderboard from anon, authenticated;
grant select, insert on public.leaderboard to anon, authenticated;
