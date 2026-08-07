create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_name_length check (char_length(player_name) between 1 and 16),
  constraint leaderboard_name_trimmed check (
    char_length(
      btrim(
        player_name,
        chr(9) || chr(10) || chr(11) || chr(12) || chr(13)
          || ' ' || chr(160) || chr(5760)
          || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
          || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201)
          || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287)
          || chr(12288) || chr(65279)
      )
    ) between 1 and 16
  ),
  constraint leaderboard_name_no_control check (player_name !~ '[[:cntrl:]]'),
  constraint leaderboard_score_plausible check (score between 0 and 2000000000)
);

alter table public.leaderboard_entries enable row level security;
grant usage on schema public to anon;
grant select, insert on table public.leaderboard_entries to anon;

create policy "public can read leaderboard"
  on public.leaderboard_entries for select to anon using (true);

create policy "public can submit bounded scores"
  on public.leaderboard_entries for insert to anon
  with check (
    char_length(player_name) between 1 and 16
    and char_length(
      btrim(
        player_name,
        chr(9) || chr(10) || chr(11) || chr(12) || chr(13)
          || ' ' || chr(160) || chr(5760)
          || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
          || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201)
          || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287)
          || chr(12288) || chr(65279)
      )
    ) between 1 and 16
    and player_name !~ '[[:cntrl:]]'
    and score between 0 and 2000000000
  );
