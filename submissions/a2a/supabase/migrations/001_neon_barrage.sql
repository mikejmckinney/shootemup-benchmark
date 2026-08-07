CREATE TABLE public.leaderboard (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_player_name_trimmed
    CHECK (player_name = btrim(player_name)),
  CONSTRAINT leaderboard_player_name_length
    CHECK (char_length(btrim(player_name)) BETWEEN 1 AND 16),
  CONSTRAINT leaderboard_player_name_safe_chars
    CHECK (player_name ~ $$^[A-Za-z0-9]([A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$$),
  CONSTRAINT leaderboard_score_range
    CHECK (score BETWEEN 0 AND 2147483647)
);

CREATE INDEX leaderboard_top10_score_idx
  ON public.leaderboard (score DESC, created_at ASC, id ASC);

REVOKE ALL PRIVILEGES ON TABLE public.leaderboard FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.leaderboard FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.leaderboard TO anon;
GRANT INSERT (player_name, score) ON TABLE public.leaderboard TO anon;

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY leaderboard_anon_select
  ON public.leaderboard
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY leaderboard_anon_insert
  ON public.leaderboard
  FOR INSERT
  TO anon
  WITH CHECK (
    player_name = btrim(player_name)
    AND char_length(btrim(player_name)) BETWEEN 1 AND 16
    AND player_name ~ $$^[A-Za-z0-9]([A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$$
    AND score BETWEEN 0 AND 2147483647
  );
