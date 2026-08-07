-- Read-only catalog verification for the Neon Barrage leaderboard migration.
-- Run this against the target database after applying the migration:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify.sql

\set ON_ERROR_STOP on

DO $verify$
DECLARE
  rls_enabled boolean;
  policy_count integer;
BEGIN
  IF to_regclass('public.leaderboard') IS NULL THEN
    RAISE EXCEPTION 'public.leaderboard is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'leaderboard'
       AND column_name = 'id'
       AND data_type = 'uuid'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'leaderboard.id is not a required UUID column';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
       AND kcu.table_name = tc.table_name
     WHERE tc.constraint_schema = 'public'
       AND tc.table_name = 'leaderboard'
       AND tc.constraint_type = 'PRIMARY KEY'
       AND kcu.column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'leaderboard.id is not the primary key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'leaderboard'
       AND column_name = 'player_name'
       AND data_type = 'text'
       AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'leaderboard'
       AND column_name = 'score'
       AND data_type = 'integer'
       AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'leaderboard'
       AND column_name = 'created_at'
       AND data_type = 'timestamp with time zone'
       AND is_nullable = 'NO'
       AND column_default IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'leaderboard column types or defaults are incorrect';
  END IF;

  SELECT c.relrowsecurity
    INTO rls_enabled
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'leaderboard';

  IF NOT COALESCE(rls_enabled, false) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.leaderboard';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE EXCEPTION 'Supabase anon role is missing';
  END IF;

  IF NOT has_table_privilege('anon', 'public.leaderboard', 'SELECT') THEN
    RAISE EXCEPTION 'anon is missing SELECT on public.leaderboard';
  END IF;

  IF NOT has_column_privilege('anon', 'public.leaderboard', 'player_name', 'INSERT')
     OR NOT has_column_privilege('anon', 'public.leaderboard', 'score', 'INSERT') THEN
    RAISE EXCEPTION 'anon is missing column-level INSERT on player_name and score';
  END IF;

  IF has_column_privilege('anon', 'public.leaderboard', 'id', 'INSERT')
     OR has_column_privilege('anon', 'public.leaderboard', 'created_at', 'INSERT') THEN
    RAISE EXCEPTION 'anon can supply a server-generated leaderboard column';
  END IF;

  IF has_table_privilege('anon', 'public.leaderboard', 'UPDATE')
     OR has_table_privilege('anon', 'public.leaderboard', 'DELETE') THEN
    RAISE EXCEPTION 'anon has an unexpected UPDATE or DELETE privilege';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND (
       has_table_privilege('authenticated', 'public.leaderboard', 'SELECT')
       OR has_column_privilege('authenticated', 'public.leaderboard', 'player_name', 'INSERT')
       OR has_column_privilege('authenticated', 'public.leaderboard', 'score', 'INSERT')
       OR has_table_privilege('authenticated', 'public.leaderboard', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.leaderboard', 'DELETE')
     ) THEN
    RAISE EXCEPTION 'authenticated has an unexpected leaderboard privilege';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM aclexplode(
        COALESCE(
          (SELECT relacl FROM pg_class WHERE oid = 'public.leaderboard'::regclass),
          acldefault('r', (SELECT relowner FROM pg_class WHERE oid = 'public.leaderboard'::regclass))
        )
      ) AS privilege
     WHERE privilege.grantee = 0
       AND privilege.privilege_type IN (
         'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
       )
  ) THEN
    RAISE EXCEPTION 'PUBLIC has an unexpected direct leaderboard table privilege';
  END IF;

  SELECT count(*)
    INTO policy_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'leaderboard';

  IF policy_count <> 2 THEN
    RAISE EXCEPTION 'expected exactly two leaderboard policies, found %', policy_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'leaderboard'
       AND policyname = 'leaderboard_anon_select'
       AND cmd = 'SELECT'
       AND roles = ARRAY['anon']::name[]
  ) THEN
    RAISE EXCEPTION 'anonymous SELECT policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'leaderboard'
       AND policyname = 'leaderboard_anon_insert'
       AND cmd = 'INSERT'
       AND roles = ARRAY['anon']::name[]
  ) THEN
    RAISE EXCEPTION 'anonymous INSERT policy is missing';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'leaderboard'
       AND cmd IN ('UPDATE', 'DELETE', 'ALL')
  ) THEN
    RAISE EXCEPTION 'an UPDATE or DELETE policy is present';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint AS con
      JOIN pg_class AS rel ON rel.oid = con.conrelid
      JOIN pg_namespace AS n ON n.oid = rel.relnamespace
     WHERE n.nspname = 'public'
       AND rel.relname = 'leaderboard'
       AND con.conname = 'leaderboard_player_name_trimmed'
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_constraint AS con
      JOIN pg_class AS rel ON rel.oid = con.conrelid
      JOIN pg_namespace AS n ON n.oid = rel.relnamespace
     WHERE n.nspname = 'public'
       AND rel.relname = 'leaderboard'
       AND con.conname = 'leaderboard_player_name_length'
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_constraint AS con
      JOIN pg_class AS rel ON rel.oid = con.conrelid
      JOIN pg_namespace AS n ON n.oid = rel.relnamespace
     WHERE n.nspname = 'public'
       AND rel.relname = 'leaderboard'
       AND con.conname = 'leaderboard_player_name_safe_chars'
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_constraint AS con
      JOIN pg_class AS rel ON rel.oid = con.conrelid
      JOIN pg_namespace AS n ON n.oid = rel.relnamespace
     WHERE n.nspname = 'public'
       AND rel.relname = 'leaderboard'
       AND con.conname = 'leaderboard_score_range'
  ) THEN
    RAISE EXCEPTION 'one or more leaderboard CHECK constraints are missing';
  END IF;

  IF to_regclass('public.leaderboard_top10_score_idx') IS NULL THEN
    RAISE EXCEPTION 'top-10 ordering index is missing';
  END IF;
END
$verify$;

SELECT 'leaderboard migration verification passed' AS verification;

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'leaderboard'
 ORDER BY ordinal_position;

SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename = 'leaderboard'
 ORDER BY policyname;
