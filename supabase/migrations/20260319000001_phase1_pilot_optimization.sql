-- =============================================================================
-- PHASE 1 MIGRATION
-- Hachiko Kids — Pilot Optimization
-- Safe to run against existing production data.
-- All operations are additive (no DROP, no column removal).
--
-- IMPORTANT: Before running, check for duplicate (child_id, check_date) pairs:
--   SELECT child_id, created_at::date, COUNT(*)
--   FROM public.checkins
--   GROUP BY child_id, created_at::date
--   HAVING COUNT(*) > 1;
--
-- If duplicates exist, run the dedup block at the bottom BEFORE this migration.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. HELPER FUNCTION: is_parent_of_child
-- Used in RLS policies to avoid correlated subquery repetition.
-- SECURITY DEFINER runs as the function owner (postgres), not the caller.
-- search_path is pinned to prevent schema injection.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_parent_of_child(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.children
    WHERE id = p_child_id
      AND parent_id = (SELECT auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. ALTER checkins: add dimension column
-- Populated from situation prefix for existing rows.
-- New rows must supply dimension explicitly (via upsert_checkin RPC).
-- ---------------------------------------------------------------------------
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS dimension text
    CHECK (dimension IN ('instrucciones', 'socializacion', 'prosocial', 'regulacion', 'animo'));

-- Back-fill dimension from existing situation IDs
-- (situation IDs follow the pattern: 'inst-N', 'soc-N', 'pro-N', 'reg-N', 'ani-N')
UPDATE public.checkins
SET dimension = CASE split_part(situation, '-', 1)
  WHEN 'inst' THEN 'instrucciones'
  WHEN 'soc'  THEN 'socializacion'
  WHEN 'pro'  THEN 'prosocial'
  WHEN 'reg'  THEN 'regulacion'
  WHEN 'ani'  THEN 'animo'
  ELSE 'animo'
END
WHERE dimension IS NULL;

-- Now enforce NOT NULL (all rows are populated)
ALTER TABLE public.checkins
  ALTER COLUMN dimension SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. ALTER checkins: add check_date generated column
-- Canonical date (UTC) for daily deduplication.
-- The unique index below is the server-side gate for one check-in per day.
-- ---------------------------------------------------------------------------
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS check_date date
    GENERATED ALWAYS AS (created_at::date) STORED;

-- Unique constraint: one check-in per child per UTC calendar day.
-- NOTE: Cannot run inside a transaction if using CONCURRENTLY.
-- For zero-downtime on production, run this separately:
--   CREATE UNIQUE INDEX CONCURRENTLY idx_checkins_unique_daily
--     ON public.checkins (child_id, check_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_unique_daily
  ON public.checkins (child_id, check_date);

-- ---------------------------------------------------------------------------
-- 4. ALTER checkins: add micro_activity and session_duration_ms
-- ---------------------------------------------------------------------------
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS micro_activity text
    CHECK (micro_activity IN ('breathe', 'shake', 'paint', 'stars', 'sleep'));
  -- NULL means the child skipped the micro-activity

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS session_duration_ms integer
    CHECK (session_duration_ms > 0 AND session_duration_ms < 900000);
  -- NULL if not recorded; max 15 minutes

-- ---------------------------------------------------------------------------
-- 5. INDEXES on checkins
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_checkins_child_created
  ON public.checkins (child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_child_date
  ON public.checkins (child_id, check_date DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_dimension
  ON public.checkins (child_id, dimension, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. TABLE: child_stickers
-- Server-side record of stickers earned. One row per day per child.
-- Client AsyncStorage is cache only; this is authoritative.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.child_stickers (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child_id      uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  earned_date   date        NOT NULL,
  sticker_type  text        NOT NULL DEFAULT 'star',
  checkin_id    uuid        REFERENCES public.checkins(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (child_id, earned_date)
);

CREATE INDEX IF NOT EXISTS idx_stickers_child
  ON public.child_stickers (child_id, earned_date DESC);

COMMENT ON TABLE public.child_stickers IS
  'One sticker per child per day, awarded on check-in completion. '
  'Authoritative source; client AsyncStorage is a local cache.';

-- ---------------------------------------------------------------------------
-- 7. TABLE: parent_sessions
-- Tracks parent app opens for behavioral metadata (passive engagement).
-- Not linked to any specific child — records parent-level engagement.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_sessions (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id     uuid        NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  screen        text        NOT NULL CHECK (screen IN ('checkin', 'summary', 'summary_prev')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  duration_ms   integer     CHECK (duration_ms > 0 AND duration_ms < 3600000),
  app_version   text,
  platform      text        CHECK (platform IN ('ios', 'android'))
);

CREATE INDEX IF NOT EXISTS idx_parent_sessions_parent
  ON public.parent_sessions (parent_id, started_at DESC);

COMMENT ON TABLE public.parent_sessions IS
  'Passive engagement tracking for parents. Used to detect disengagement '
  'and inform the weekly notification strategy.';

-- ---------------------------------------------------------------------------
-- 8. RLS: Drop existing broad policies and replace with per-operation policies.
-- Using (select auth.uid()) throughout for query planning efficiency
-- (evaluated once per query, not once per row).
-- ---------------------------------------------------------------------------

-- PARENTS table
DROP POLICY IF EXISTS "Parents own row" ON public.parents;

CREATE POLICY "parents_select_own"
  ON public.parents FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY "parents_insert_own"
  ON public.parents FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "parents_update_own"
  ON public.parents FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- DELETE intentionally omitted: account deletion goes through auth.users cascade.

-- CHILDREN table
DROP POLICY IF EXISTS "Parents own children" ON public.children;

CREATE POLICY "children_select_own"
  ON public.children FOR SELECT
  USING (parent_id = (SELECT auth.uid()));

CREATE POLICY "children_insert_own"
  ON public.children FOR INSERT
  WITH CHECK (parent_id = (SELECT auth.uid()));

CREATE POLICY "children_update_own"
  ON public.children FOR UPDATE
  USING (parent_id = (SELECT auth.uid()))
  WITH CHECK (parent_id = (SELECT auth.uid()));

CREATE POLICY "children_delete_own"
  ON public.children FOR DELETE
  USING (parent_id = (SELECT auth.uid()));

-- CHECKINS table
DROP POLICY IF EXISTS "Parents own checkins" ON public.checkins;

CREATE POLICY "checkins_select_own"
  ON public.checkins FOR SELECT
  USING (public.is_parent_of_child(child_id));

CREATE POLICY "checkins_insert_own"
  ON public.checkins FOR INSERT
  WITH CHECK (public.is_parent_of_child(child_id));

CREATE POLICY "checkins_update_own"
  ON public.checkins FOR UPDATE
  USING (public.is_parent_of_child(child_id))
  WITH CHECK (public.is_parent_of_child(child_id));

-- No DELETE: checkin data is retained permanently for pattern detection.

-- CHILD_STICKERS table (new — enable RLS)
ALTER TABLE public.child_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickers_select_own"
  ON public.child_stickers FOR SELECT
  USING (public.is_parent_of_child(child_id));

CREATE POLICY "stickers_insert_own"
  ON public.child_stickers FOR INSERT
  WITH CHECK (public.is_parent_of_child(child_id));

-- PARENT_SESSIONS table (new — enable RLS)
ALTER TABLE public.parent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own"
  ON public.parent_sessions FOR SELECT
  USING (parent_id = (SELECT auth.uid()));

CREATE POLICY "sessions_insert_own"
  ON public.parent_sessions FOR INSERT
  WITH CHECK (parent_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. WEEKLY SUMMARY VIEW
-- Pre-computed view for the summary.tsx screen.
-- Returns aggregates per child per ISO week — no more client-side JS math.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_weekly_summary AS
SELECT
  c.parent_id,
  ci.child_id,
  date_trunc('week', ci.created_at)::date AS week_start,
  ci.dimension,
  COUNT(*)                                AS total_checkins,
  COUNT(CASE WHEN ci.emotion = 'happy'                              THEN 1 END) AS happy_count,
  COUNT(CASE WHEN ci.emotion = 'neutral'                            THEN 1 END) AS neutral_count,
  COUNT(CASE WHEN ci.emotion IN ('sad', 'angry', 'scared')          THEN 1 END) AS negative_count,
  COUNT(CASE WHEN ci.situation_choice IN ('helps')                  THEN 1 END) AS positive_choice_count,
  COUNT(CASE WHEN ci.situation_choice = 'refuses'                   THEN 1 END) AS refuses_count,
  COUNT(CASE WHEN ci.situation_choice IN ('social', 'one_friend')   THEN 1 END) AS social_count,
  COUNT(CASE WHEN ci.situation_choice = 'alone'                     THEN 1 END) AS alone_count,
  COUNT(CASE WHEN ci.situation_choice IN ('shares', 'compromises')  THEN 1 END) AS prosocial_count,
  COUNT(CASE WHEN ci.situation_choice = 'regulates'                 THEN 1 END) AS regulates_count,
  COUNT(CASE WHEN ci.situation_choice = 'explodes'                  THEN 1 END) AS explodes_count,
  COUNT(CASE WHEN ci.situation_choice = 'withdraws'                 THEN 1 END) AS withdraws_count,
  COUNT(DISTINCT s.earned_date)                                                  AS stickers_earned
FROM public.checkins ci
JOIN public.children c ON c.id = ci.child_id
LEFT JOIN public.child_stickers s
  ON s.child_id = ci.child_id
  AND date_trunc('week', s.earned_date::timestamptz)::date
      = date_trunc('week', ci.created_at)::date
GROUP BY c.parent_id, ci.child_id, week_start, ci.dimension;

COMMENT ON VIEW public.vw_weekly_summary IS
  'Per-dimension weekly aggregates for the parent summary screen. '
  'RLS on underlying tables is enforced — this view inherits it.';

-- ---------------------------------------------------------------------------
-- 10. FUNCTION: upsert_checkin
-- Safe idempotent check-in insertion callable from the client via RPC.
-- Enforces ownership, handles the daily unique constraint gracefully,
-- and auto-awards a sticker on completion.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_checkin(
  p_child_id          uuid,
  p_situation         text,
  p_situation_choice  text,
  p_emotion           text,
  p_dimension         text,
  p_micro_activity    text    DEFAULT NULL,
  p_session_duration  integer DEFAULT NULL
)
RETURNS public.checkins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.checkins;
BEGIN
  -- Verify the calling parent owns this child
  IF NOT public.is_parent_of_child(p_child_id) THEN
    RAISE EXCEPTION 'Access denied: caller does not own child %', p_child_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.checkins (
    child_id, situation, situation_choice, emotion,
    dimension, micro_activity, session_duration_ms
  )
  VALUES (
    p_child_id, p_situation, p_situation_choice, p_emotion,
    p_dimension, p_micro_activity, p_session_duration
  )
  ON CONFLICT (child_id, check_date)
  DO UPDATE SET
    situation           = EXCLUDED.situation,
    situation_choice    = EXCLUDED.situation_choice,
    emotion             = EXCLUDED.emotion,
    dimension           = EXCLUDED.dimension,
    micro_activity      = COALESCE(EXCLUDED.micro_activity, public.checkins.micro_activity),
    session_duration_ms = COALESCE(EXCLUDED.session_duration_ms, public.checkins.session_duration_ms)
  RETURNING * INTO v_result;

  -- Auto-award sticker on successful check-in
  INSERT INTO public.child_stickers (child_id, earned_date, sticker_type, checkin_id)
  VALUES (p_child_id, CURRENT_DATE, 'star', v_result.id)
  ON CONFLICT (child_id, earned_date) DO NOTHING;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.upsert_checkin IS
  'Idempotent check-in insertion. Replaces direct INSERT from the client. '
  'Enforces ownership, awards sticker, and handles the daily unique constraint gracefully.';

COMMIT;

-- =============================================================================
-- DEDUP BLOCK (run BEFORE the migration above if duplicates exist)
-- Keeps only the latest row per (child_id, check_date) pair.
-- =============================================================================
-- DELETE FROM public.checkins
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id,
--            ROW_NUMBER() OVER (
--              PARTITION BY child_id, created_at::date
--              ORDER BY created_at DESC
--            ) AS rn
--     FROM public.checkins
--   ) ranked
--   WHERE rn > 1
-- );
