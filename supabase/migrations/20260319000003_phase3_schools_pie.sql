-- =============================================================================
-- PHASE 3 MIGRATION
-- Hachiko Kids — B2B Schools + PIE Programs + Cohort Benchmarks
-- Depends on Phase 1 (20260319000001) and Phase 2 (20260319000002).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. TABLE: school_groups
-- Grade/class groupings within a school organization.
-- PIE programs use program_type = 'pie*'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_groups (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  grade_level     text,
  program_type    text        NOT NULL DEFAULT 'general'
                              CHECK (program_type IN ('general', 'pie', 'pie_tea', 'pie_dif')),
  academic_year   smallint    NOT NULL DEFAULT EXTRACT(YEAR FROM now())::smallint,
  coordinator_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, name, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_school_groups_org
  ON public.school_groups (org_id)
  WHERE is_active = true;

COMMENT ON TABLE public.school_groups IS
  'Grade/class groupings within a school. PIE programs use program_type = ''pie*''. '
  'Academic year allows historical group tracking without deleting rows.';

-- ---------------------------------------------------------------------------
-- 2. TABLE: group_children
-- Maps consented children to a school group.
-- A child can belong to multiple groups (e.g. regular class + PIE).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_children (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id    bigint      NOT NULL REFERENCES public.school_groups(id) ON DELETE CASCADE,
  child_id    uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  org_id      bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  left_at     timestamptz,

  UNIQUE (group_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_group_children_group
  ON public.group_children (group_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_group_children_child
  ON public.group_children (child_id);

-- ---------------------------------------------------------------------------
-- 3. TABLE: cohort_benchmarks
-- Anonymized weekly aggregates per school group per dimension.
-- k-anonymity: suppressed=true when n_children < 5; stats are NULL.
-- Percentages rounded to nearest 5% to prevent re-identification.
-- Individual child data is NEVER stored here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cohort_benchmarks (
  id                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id          bigint      NOT NULL REFERENCES public.school_groups(id) ON DELETE CASCADE,
  org_id            bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  week_start        date        NOT NULL,
  dimension         text        NOT NULL
                                CHECK (dimension IN ('instrucciones','socializacion','prosocial','regulacion','animo')),
  n_children        smallint    NOT NULL,
  pct_positive      numeric(5,2),
  pct_negative      numeric(5,2),
  pct_active        numeric(5,2),
  avg_emotion_score numeric(4,2),
  suppressed        boolean     NOT NULL DEFAULT false,
  computed_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (group_id, week_start, dimension)
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_group_week
  ON public.cohort_benchmarks (group_id, week_start DESC);

COMMENT ON TABLE public.cohort_benchmarks IS
  'Anonymized group-level weekly statistics. k-anonymity enforced: '
  'suppressed=true when n_children<5. Percentages rounded to nearest 5%. '
  'This table NEVER contains individual child identifiers.';

-- ---------------------------------------------------------------------------
-- 4. TABLE: mineduc_reports
-- Generated Mineduc-format report snapshots.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mineduc_reports (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id      bigint      REFERENCES public.school_groups(id) ON DELETE SET NULL,
  report_type   text        NOT NULL DEFAULT 'pie_monthly'
                            CHECK (report_type IN ('pie_monthly', 'pie_annual', 'general_monthly')),
  period_start  date        NOT NULL,
  period_end    date        NOT NULL,
  academic_year smallint    NOT NULL,
  report_data   jsonb       NOT NULL DEFAULT '{}',
  generated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  storage_path  text
);

CREATE INDEX IF NOT EXISTS idx_mineduc_reports_org
  ON public.mineduc_reports (org_id, generated_at DESC);

COMMENT ON TABLE public.mineduc_reports IS
  'Snapshot of generated Mineduc-format reports. Uses aggregated behavioral language. '
  'storage_path points to the PDF in Supabase Storage if generated.';

-- ---------------------------------------------------------------------------
-- 5. TABLE: clinical_assessments
-- Structured SDQ-correlated assessments. INTERNAL ONLY — never shown to parents.
-- One assessment per clinician per child per calendar month.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_assessments (
  id                    bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id                bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  child_id              uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  clinician_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assessment_date       date        NOT NULL DEFAULT CURRENT_DATE,
  score_instrucciones   smallint    CHECK (score_instrucciones BETWEEN 1 AND 5),
  score_socializacion   smallint    CHECK (score_socializacion BETWEEN 1 AND 5),
  score_prosocial       smallint    CHECK (score_prosocial BETWEEN 1 AND 5),
  score_regulacion      smallint    CHECK (score_regulacion BETWEEN 1 AND 5),
  score_animo           smallint    CHECK (score_animo BETWEEN 1 AND 5),
  risk_level            text        CHECK (risk_level IN ('low', 'moderate', 'high', 'crisis')),
  internal_notes        text,
  referral_recommended  boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- One structured assessment per clinician per child per month
  UNIQUE (org_id, child_id, clinician_id, date_trunc('month', assessment_date::timestamptz)::date)
);

CREATE INDEX IF NOT EXISTS idx_assessments_child
  ON public.clinical_assessments (child_id, assessment_date DESC);

CREATE TRIGGER assessments_updated_at
  BEFORE UPDATE ON public.clinical_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.clinical_assessments IS
  'Structured clinician assessments using SDQ-correlated scoring. '
  'INTERNAL ONLY — never shown to parents. '
  'Behavioral language is used in all parent-facing content derived from this data.';

-- ---------------------------------------------------------------------------
-- 6. HELPER FUNCTIONS for Phase 3
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_school_group_access(p_group_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_groups sg
    JOIN public.org_members om ON om.org_id = sg.org_id
    WHERE sg.id = p_group_id
      AND om.user_id = (SELECT auth.uid())
      AND om.is_active = true
  );
$$;

-- Computes cohort benchmark for a group + week + dimension.
-- Enforces k-anonymity: suppresses if n < 5.
-- Rounds percentages to nearest 5 for additional k-anonymity.
CREATE OR REPLACE FUNCTION public.compute_cohort_benchmark(
  p_group_id   bigint,
  p_week_start date,
  p_dimension  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     bigint;
  v_n          integer;
  v_pct_pos    numeric;
  v_pct_neg    numeric;
  v_pct_act    numeric;
  v_avg_emo    numeric;
  v_suppressed boolean;
BEGIN
  SELECT org_id INTO v_org_id FROM public.school_groups WHERE id = p_group_id;

  WITH group_kids AS (
    SELECT gc.child_id
    FROM public.group_children gc
    JOIN public.org_child_consents occ
      ON occ.child_id = gc.child_id
      AND occ.org_id = gc.org_id
      AND occ.consent_granted = true
      AND occ.revoked_at IS NULL
    WHERE gc.group_id = p_group_id
      AND gc.left_at IS NULL
  ),
  week_checkins AS (
    SELECT ci.*
    FROM public.checkins ci
    JOIN group_kids gk ON gk.child_id = ci.child_id
    WHERE ci.dimension = p_dimension
      AND ci.check_date >= p_week_start
      AND ci.check_date < p_week_start + 7
  ),
  active_kids AS (
    SELECT DISTINCT child_id FROM week_checkins
  )
  SELECT
    (SELECT COUNT(*) FROM group_kids)::integer,
    ROUND(100.0 * COUNT(CASE WHEN wc.situation_choice IN ('helps','social','one_friend','shares','compromises','regulates','great') THEN 1 END) / NULLIF(COUNT(*),0), 0),
    ROUND(100.0 * COUNT(CASE WHEN wc.situation_choice IN ('refuses','alone','keeps','explodes','low') THEN 1 END) / NULLIF(COUNT(*),0), 0),
    ROUND(100.0 * (SELECT COUNT(*) FROM active_kids) / NULLIF((SELECT COUNT(*) FROM group_kids),0), 0),
    ROUND(AVG(CASE wc.emotion WHEN 'happy' THEN 2 WHEN 'neutral' THEN 1 ELSE 0 END)::numeric, 2)
  INTO v_n, v_pct_pos, v_pct_neg, v_pct_act, v_avg_emo
  FROM week_checkins wc;

  v_suppressed := COALESCE(v_n, 0) < 5;

  -- Round to nearest 5 for k-anonymity
  IF NOT v_suppressed THEN
    v_pct_pos := ROUND(COALESCE(v_pct_pos, 0) / 5) * 5;
    v_pct_neg := ROUND(COALESCE(v_pct_neg, 0) / 5) * 5;
    v_pct_act := ROUND(COALESCE(v_pct_act, 0) / 5) * 5;
  END IF;

  INSERT INTO public.cohort_benchmarks (
    group_id, org_id, week_start, dimension,
    n_children, pct_positive, pct_negative, pct_active, avg_emotion_score, suppressed
  )
  VALUES (
    p_group_id, v_org_id, p_week_start, p_dimension,
    COALESCE(v_n, 0),
    CASE WHEN v_suppressed THEN NULL ELSE v_pct_pos END,
    CASE WHEN v_suppressed THEN NULL ELSE v_pct_neg END,
    CASE WHEN v_suppressed THEN NULL ELSE v_pct_act END,
    CASE WHEN v_suppressed THEN NULL ELSE v_avg_emo END,
    v_suppressed
  )
  ON CONFLICT (group_id, week_start, dimension)
  DO UPDATE SET
    n_children        = EXCLUDED.n_children,
    pct_positive      = EXCLUDED.pct_positive,
    pct_negative      = EXCLUDED.pct_negative,
    pct_active        = EXCLUDED.pct_active,
    avg_emotion_score = EXCLUDED.avg_emotion_score,
    suppressed        = EXCLUDED.suppressed,
    computed_at       = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS POLICIES — Phase 3 tables
-- ---------------------------------------------------------------------------

-- SCHOOL_GROUPS
ALTER TABLE public.school_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_groups_select_member"
  ON public.school_groups FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "school_groups_insert_admin"
  ON public.school_groups FOR INSERT
  WITH CHECK (
    public.is_org_member(org_id)
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = school_groups.org_id
        AND user_id = (SELECT auth.uid())
        AND role = 'admin'
        AND is_active = true
    )
  );

-- GROUP_CHILDREN
ALTER TABLE public.group_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_children_select_member"
  ON public.group_children FOR SELECT
  USING (
    public.is_org_member(org_id)
    AND public.has_consented_child_access(child_id)
  );

CREATE POLICY "group_children_insert_admin"
  ON public.group_children FOR INSERT
  WITH CHECK (
    public.is_org_member(org_id)
    AND public.has_consented_child_access(child_id)
  );

-- COHORT_BENCHMARKS (no individual data — all org members can see)
ALTER TABLE public.cohort_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "benchmarks_select_member"
  ON public.cohort_benchmarks FOR SELECT
  USING (public.is_org_member(org_id));

-- MINEDUC_REPORTS
ALTER TABLE public.mineduc_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mineduc_reports_select_member"
  ON public.mineduc_reports FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "mineduc_reports_insert_admin"
  ON public.mineduc_reports FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

-- CLINICAL_ASSESSMENTS
ALTER TABLE public.clinical_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessments_select_clinician"
  ON public.clinical_assessments FOR SELECT
  USING (
    public.is_org_member(org_id)
    AND public.has_consented_child_access(child_id)
  );

CREATE POLICY "assessments_insert_clinician"
  ON public.clinical_assessments FOR INSERT
  WITH CHECK (
    clinician_id = (SELECT auth.uid())
    AND public.is_org_member(org_id)
    AND public.has_consented_child_access(child_id)
  );

CREATE POLICY "assessments_update_own"
  ON public.clinical_assessments FOR UPDATE
  USING (clinician_id = (SELECT auth.uid()))
  WITH CHECK (clinician_id = (SELECT auth.uid()));

COMMIT;
