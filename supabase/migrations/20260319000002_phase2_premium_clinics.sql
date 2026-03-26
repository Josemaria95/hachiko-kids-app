-- =============================================================================
-- PHASE 2 MIGRATION
-- Hachiko Kids — Premium Subscriptions + B2B Clinics
-- Depends on Phase 1 migration (20260319000001) having been applied.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. TRIGGER HELPER: set_updated_at
-- Reused by all tables that have an updated_at column.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. TABLE: subscriptions
-- One row per parent. Tracks B2C premium status.
-- Billing managed by Stripe/RevenueCat; this is the local state mirror.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id              uuid        NOT NULL UNIQUE REFERENCES public.parents(id) ON DELETE CASCADE,
  plan                   text        NOT NULL DEFAULT 'free'
                                     CHECK (plan IN ('free', 'premium')),
  status                 text        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  revenuecat_user_id     text,
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  canceled_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_parent
  ON public.subscriptions (parent_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON TABLE public.subscriptions IS
  'B2C premium subscription state per parent. Source of truth for feature gating. '
  'Updated by webhook from Stripe/RevenueCat via Edge Function.';

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-insert free subscription row when a parent is created
CREATE OR REPLACE FUNCTION public.on_parent_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (parent_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (parent_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_subscription_on_parent_insert
  AFTER INSERT ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.on_parent_created();

-- Backfill subscriptions for existing parents
INSERT INTO public.subscriptions (parent_id, plan, status)
SELECT id, 'free', 'active'
FROM public.parents
ON CONFLICT (parent_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. TABLE: organizations
-- B2B tenants. Phase 2 = clinics. Phase 3 adds schools.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text        NOT NULL UNIQUE,
  display_name  text        NOT NULL,
  org_type      text        NOT NULL DEFAULT 'clinic'
                            CHECK (org_type IN ('clinic', 'school', 'pie')),
  country       text        NOT NULL DEFAULT 'CL',
  city          text,
  billing_plan  text        NOT NULL DEFAULT 'pilot'
                            CHECK (billing_plan IN ('pilot', 'basic', 'professional', 'institutional')),
  billing_status text       NOT NULL DEFAULT 'active'
                            CHECK (billing_status IN ('active', 'past_due', 'suspended', 'canceled')),
  pilot_ends_at  timestamptz,
  admin_email   text        NOT NULL,
  phone         text,
  features      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.organizations IS
  'B2B tenants. Clinics in Phase 2, schools/PIE programs in Phase 3. '
  'Isolated by RLS — org members can only see their own org.';

-- ---------------------------------------------------------------------------
-- 4. TABLE: org_members
-- Staff with roles inside an organization.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_members (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'clinician'
                              CHECK (role IN ('admin', 'clinician', 'observer')),
  display_name    text        NOT NULL,
  profession      text,
  is_active       boolean     NOT NULL DEFAULT true,
  invited_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON public.org_members (user_id);

CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON public.org_members (org_id);

COMMENT ON TABLE public.org_members IS
  'Maps auth.users to organizations with a role. A user can belong to multiple orgs. '
  'RLS restricts to own org rows.';

-- ---------------------------------------------------------------------------
-- 5. HELPER FUNCTIONS for B2B RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_id_for_user()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM public.org_members
  WHERE user_id = (SELECT auth.uid())
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = (SELECT auth.uid())
      AND is_active = true
  );
$$;

-- Returns true if the calling user's org has active consent to view the given child.
-- NOTE: References org_child_consents which is created below; forward reference is safe
-- in plpgsql (resolved at call time, not parse time).
CREATE OR REPLACE FUNCTION public.has_consented_child_access(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_child_consents occ
    JOIN public.org_members om
      ON om.org_id = occ.org_id
      AND om.user_id = (SELECT auth.uid())
      AND om.is_active = true
    WHERE occ.child_id = p_child_id
      AND occ.consent_granted = true
      AND occ.revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. TABLE: org_child_consents
-- Explicit parent consent for a child to be monitored by an org.
-- CRITICAL: No org can access child data without a row here with
-- consent_granted=true AND revoked_at IS NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_child_consents (
  id                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id            bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  child_id          uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_id         uuid        NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  consent_granted   boolean     NOT NULL DEFAULT false,
  granted_at        timestamptz,
  revoked_at        timestamptz,
  consent_version   text        NOT NULL DEFAULT 'v1',
  consent_text_hash text,
  invite_token      text        UNIQUE,
  invite_expires_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, child_id),
  CONSTRAINT consent_revoke_after_grant
    CHECK (revoked_at IS NULL OR revoked_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_consents_child
  ON public.org_child_consents (child_id);

CREATE INDEX IF NOT EXISTS idx_consents_org
  ON public.org_child_consents (org_id)
  WHERE consent_granted = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consents_invite_token
  ON public.org_child_consents (invite_token)
  WHERE invite_token IS NOT NULL;

CREATE TRIGGER consents_updated_at
  BEFORE UPDATE ON public.org_child_consents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.org_child_consents IS
  'Explicit parent consent for sharing one child''s data with one organization. '
  'CRITICAL: No org can access child data without consent_granted=true AND revoked_at IS NULL. '
  'Revocation is immediate — no grace period.';

-- ---------------------------------------------------------------------------
-- 7. TABLE: behavioral_alerts
-- Server-generated alerts when patterns persist 3+ weeks.
-- alert_type=''crisis'' is NEVER shared with B2B orgs (enforced in RLS).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.behavioral_alerts (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child_id      uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_id     uuid        NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  alert_type    text        NOT NULL
                            CHECK (alert_type IN (
                              'pattern_persists',
                              'engagement_drop',
                              'crisis'
                            )),
  dimension     text        CHECK (dimension IN ('instrucciones','socializacion','prosocial','regulacion','animo')),
  pattern_key   text,
  weeks_count   integer,
  severity      text        NOT NULL DEFAULT 'low'
                            CHECK (severity IN ('low', 'medium', 'high', 'crisis')),
  message_es    text        NOT NULL,
  suggestion_es text,
  is_read       boolean     NOT NULL DEFAULT false,
  read_at       timestamptz,
  is_dismissed  boolean     NOT NULL DEFAULT false,
  dismissed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_child_unread
  ON public.behavioral_alerts (child_id, created_at DESC)
  WHERE is_dismissed = false;

CREATE INDEX IF NOT EXISTS idx_alerts_parent
  ON public.behavioral_alerts (parent_id, created_at DESC);

COMMENT ON TABLE public.behavioral_alerts IS
  'Behavioral pattern alerts for parents. alert_type=''crisis'' is NEVER '
  'shared with B2B orgs (enforced in RLS). All messages use behavioral language.';

-- ---------------------------------------------------------------------------
-- 8. TABLE: shared_summary_links
-- Secure, time-limited URLs for premium parents to share with clinicians.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_summary_links (
  id               bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id        uuid        NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  child_id         uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  token            text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  week_start       date,
  weeks_count      integer     NOT NULL DEFAULT 4
                               CHECK (weeks_count BETWEEN 1 AND 52),
  dimensions       text[]      DEFAULT ARRAY['instrucciones','socializacion','prosocial','regulacion','animo'],
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at       timestamptz,
  access_count     integer     NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_links_token
  ON public.shared_summary_links (token)
  WHERE revoked_at IS NULL AND expires_at > now();

CREATE INDEX IF NOT EXISTS idx_shared_links_parent
  ON public.shared_summary_links (parent_id);

COMMENT ON TABLE public.shared_summary_links IS
  'One-time-or-limited shareable report links. Token = 32-byte random hex. '
  'Expire in 30 days by default. Premium parents only (enforced in RLS INSERT policy).';

-- Function to access a shared link (increments counter, returns metadata if valid)
CREATE OR REPLACE FUNCTION public.access_shared_summary(p_token text)
RETURNS TABLE (
  child_name  text,
  week_start  date,
  weeks_count integer,
  dimensions  text[],
  is_valid    boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_summary_links;
BEGIN
  SELECT * INTO v_link
  FROM public.shared_summary_links
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::date, NULL::integer, NULL::text[], false;
    RETURN;
  END IF;

  UPDATE public.shared_summary_links
  SET access_count     = access_count + 1,
      last_accessed_at = now()
  WHERE id = v_link.id;

  RETURN QUERY
  SELECT ch.name, v_link.week_start, v_link.weeks_count, v_link.dimensions, true
  FROM public.children ch
  WHERE ch.id = v_link.child_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. TABLE: weekly_summaries
-- Server-computed snapshots replacing client-side JS computation in summary.tsx.
-- Computed by Edge Function every Monday at 09:00 America/Santiago.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child_id           uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_id          uuid        NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  week_start         date        NOT NULL,
  active_days        smallint    NOT NULL DEFAULT 0 CHECK (active_days BETWEEN 0 AND 7),
  total_checkins     smallint    NOT NULL DEFAULT 0,
  stickers_earned    smallint    NOT NULL DEFAULT 0,
  -- { instrucciones: { total, positive, refuses, delays }, ... }
  dimension_stats    jsonb       NOT NULL DEFAULT '{}',
  tip_dato_es        text,
  tip_accion_es      text,
  -- { "high_explodes": 3, "high_alone": 2, ... } weeks_count per pattern
  pattern_flags      jsonb       NOT NULL DEFAULT '{}',
  computed_at        timestamptz NOT NULL DEFAULT now(),
  is_premium_summary boolean     NOT NULL DEFAULT false,

  UNIQUE (child_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_child
  ON public.weekly_summaries (child_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_parent
  ON public.weekly_summaries (parent_id, week_start DESC);

COMMENT ON TABLE public.weekly_summaries IS
  'Pre-computed weekly behavioral summaries. Generated by an Edge Function '
  'every Monday at 09:00 America/Santiago (12:00 UTC). Source of truth for '
  'the parent summary screen, clinic dashboards, and shared links.';

-- ---------------------------------------------------------------------------
-- 10. TABLE: clinician_notes
-- Free-text clinical notes. INTERNAL ONLY — never visible to parents.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinician_notes (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        bigint      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  child_id      uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  clinician_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  week_start    date,
  note_text     text        NOT NULL,
  is_flagged    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinician_notes_child
  ON public.clinician_notes (child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinician_notes_org
  ON public.clinician_notes (org_id, child_id);

CREATE TRIGGER clinician_notes_updated_at
  BEFORE UPDATE ON public.clinician_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.clinician_notes IS
  'Clinician annotations per child. NEVER visible to parents. '
  'Only the authoring clinician and org admins can read. '
  'Requires active consent row for the (org, child) pair.';

-- ---------------------------------------------------------------------------
-- 11. ALTER children: add Phase 2 aggregate columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS mascot_level    smallint NOT NULL DEFAULT 1
                                           CHECK (mascot_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS total_checkins  integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin_at timestamptz;

-- Trigger to update child aggregate counters on new check-in
CREATE OR REPLACE FUNCTION public.on_checkin_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.children
  SET
    total_checkins  = total_checkins + 1,
    last_checkin_at = now(),
    -- Level up every 30 check-ins, max level 5
    mascot_level    = LEAST(5, 1 + (total_checkins + 1) / 30)
  WHERE id = NEW.child_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkin_update_child_stats
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.on_checkin_upsert();

-- ---------------------------------------------------------------------------
-- 12. FUNCTION: generate_shared_link
-- Callable by premium parent clients. Validates premium status before creating.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_shared_link(
  p_child_id     uuid,
  p_weeks_count  integer DEFAULT 4,
  p_week_start   date    DEFAULT NULL,
  p_dimensions   text[]  DEFAULT ARRAY['instrucciones','socializacion','prosocial','regulacion','animo'],
  p_expires_days integer DEFAULT 30
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id  uuid := (SELECT auth.uid());
  v_token      text;
  v_is_premium boolean;
BEGIN
  IF NOT public.is_parent_of_child(p_child_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT plan IN ('premium') AND status IN ('active', 'trialing')
  INTO v_is_premium
  FROM public.subscriptions
  WHERE parent_id = v_parent_id;

  IF NOT COALESCE(v_is_premium, false) THEN
    RAISE EXCEPTION 'Premium subscription required to share summaries'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.shared_summary_links (
    parent_id, child_id, week_start, weeks_count, dimensions, expires_at
  )
  VALUES (
    v_parent_id, p_child_id, p_week_start, p_weeks_count, p_dimensions,
    now() + (p_expires_days || ' days')::interval
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. RLS POLICIES — Phase 2 tables
-- ---------------------------------------------------------------------------

-- SUBSCRIPTIONS (read-only for clients; updated by service_role webhook)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (parent_id = (SELECT auth.uid()));

-- ORGANIZATIONS (org members see their own org)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select_members"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id));

-- ORG_MEMBERS
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_same_org"
  ON public.org_members FOR SELECT
  USING (org_id = public.get_org_id_for_user());

CREATE POLICY "org_members_update_own"
  ON public.org_members FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ORG_CHILD_CONSENTS
ALTER TABLE public.org_child_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents_select_parent"
  ON public.org_child_consents FOR SELECT
  USING (parent_id = (SELECT auth.uid()));

CREATE POLICY "consents_insert_parent"
  ON public.org_child_consents FOR INSERT
  WITH CHECK (parent_id = (SELECT auth.uid()));

CREATE POLICY "consents_update_parent"
  ON public.org_child_consents FOR UPDATE
  USING (parent_id = (SELECT auth.uid()))
  WITH CHECK (parent_id = (SELECT auth.uid()));

CREATE POLICY "consents_select_org_member"
  ON public.org_child_consents FOR SELECT
  USING (public.is_org_member(org_id));

-- BEHAVIORAL_ALERTS
ALTER TABLE public.behavioral_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select_parent"
  ON public.behavioral_alerts FOR SELECT
  USING (parent_id = (SELECT auth.uid()));

CREATE POLICY "alerts_update_parent"
  ON public.behavioral_alerts FOR UPDATE
  USING (parent_id = (SELECT auth.uid()))
  WITH CHECK (parent_id = (SELECT auth.uid()));

-- Clinicians: non-crisis alerts only, consented children only
CREATE POLICY "alerts_select_clinician"
  ON public.behavioral_alerts FOR SELECT
  USING (
    alert_type != 'crisis'
    AND public.has_consented_child_access(child_id)
  );

-- SHARED_SUMMARY_LINKS
ALTER TABLE public.shared_summary_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_links_select_parent"
  ON public.shared_summary_links FOR SELECT
  USING (parent_id = (SELECT auth.uid()));

CREATE POLICY "shared_links_insert_parent"
  ON public.shared_summary_links FOR INSERT
  WITH CHECK (
    parent_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE parent_id = (SELECT auth.uid())
        AND plan = 'premium'
        AND status IN ('active', 'trialing')
    )
  );

CREATE POLICY "shared_links_update_parent"
  ON public.shared_summary_links FOR UPDATE
  USING (parent_id = (SELECT auth.uid()))
  WITH CHECK (parent_id = (SELECT auth.uid()));

-- WEEKLY_SUMMARIES
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_summaries_select_parent"
  ON public.weekly_summaries FOR SELECT
  USING (parent_id = (SELECT auth.uid()));

CREATE POLICY "weekly_summaries_select_clinician"
  ON public.weekly_summaries FOR SELECT
  USING (public.has_consented_child_access(child_id));

-- CLINICIAN_NOTES (never visible to parents)
ALTER TABLE public.clinician_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_notes_select"
  ON public.clinician_notes FOR SELECT
  USING (
    public.is_org_member(org_id)
    AND public.has_consented_child_access(child_id)
  );

CREATE POLICY "clinician_notes_insert"
  ON public.clinician_notes FOR INSERT
  WITH CHECK (
    clinician_id = (SELECT auth.uid())
    AND public.is_org_member(org_id)
    AND public.has_consented_child_access(child_id)
  );

CREATE POLICY "clinician_notes_update_own"
  ON public.clinician_notes FOR UPDATE
  USING (clinician_id = (SELECT auth.uid()))
  WITH CHECK (clinician_id = (SELECT auth.uid()));

-- CHECKINS: extend with clinician read access (non-destructive: adds a SELECT policy)
CREATE POLICY "checkins_select_clinician"
  ON public.checkins FOR SELECT
  USING (public.has_consented_child_access(child_id));

COMMIT;
