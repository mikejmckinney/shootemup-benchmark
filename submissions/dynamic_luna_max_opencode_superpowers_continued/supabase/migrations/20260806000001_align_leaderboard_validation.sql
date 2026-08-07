alter table public.leaderboard_entries
  drop constraint if exists leaderboard_name_trimmed,
  drop constraint if exists leaderboard_name_no_control;

alter table public.leaderboard_entries
  add constraint leaderboard_name_trimmed check (
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
  ) not valid,
  add constraint leaderboard_name_no_control
    check (player_name !~ '[[:cntrl:]]') not valid;

alter table public.leaderboard_entries enable row level security;
grant select, insert on table public.leaderboard_entries to anon;

drop policy if exists "public can submit bounded scores"
  on public.leaderboard_entries;

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
