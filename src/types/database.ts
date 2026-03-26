// =============================================================================
// Hachiko Kids — Database Types
// Mirrors the Supabase schema across all 3 phases.
// =============================================================================

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
export type Dimension =
  | 'instrucciones'
  | 'socializacion'
  | 'prosocial'
  | 'regulacion'
  | 'animo';

export type Emotion = 'happy' | 'sad' | 'angry' | 'scared' | 'neutral';
export type MicroActivity = 'breathe' | 'shake' | 'paint' | 'stars' | 'sleep';
export type AgeGroup = '4-6' | '7-12';

// ---------------------------------------------------------------------------
// New type aliases
export type MascotColor = 'purple' | 'blue' | 'green' | 'pink' | 'orange';
export type LunaArchetype = 'exploradora' | 'cuidadora' | 'tranquila' | 'luchadora' | 'equilibrada';
export type ParentRole = 'madre' | 'padre' | 'tutor';
export type ParentingStyle = 'autoritario' | 'democratico' | 'permisivo' | 'negligente' | 'no_clasificado';

// ---------------------------------------------------------------------------
// Phase 1 — Core tables
// ---------------------------------------------------------------------------
export interface Parent {
  id: string;           // uuid, matches auth.users.id
  email: string;
  created_at: string;
  // Phase 3 additions
  role: ParentRole | null;
  display_name: string | null;
  parenting_style: ParentingStyle | null;
  parent_pin: string | null;
  onboarding_completed: boolean;
  updated_at: string;
}

export interface Child {
  id: string;           // uuid
  parent_id: string;
  name: string;
  mascot_type: 'luna';
  mascot_name: string;
  age_group: AgeGroup;
  // Phase 2 additions
  mascot_level: number;       // 1-5
  total_checkins: number;
  last_checkin_at: string | null;
  created_at: string;
  // Phase 3 additions
  mascot_color: MascotColor;
  luna_archetype: LunaArchetype;
}

export interface Checkin {
  id: string;           // uuid
  child_id: string;
  situation: string;    // e.g. 'inst-1'
  situation_choice: string;
  emotion: Emotion;
  dimension: Dimension;
  check_date: string;   // date, generated column (created_at::date)
  micro_activity: MicroActivity | null;
  session_duration_ms: number | null;
  created_at: string;
}

export interface ChildSticker {
  id: number;           // bigint
  child_id: string;
  earned_date: string;  // date
  sticker_type: string;
  checkin_id: string | null;
  created_at: string;
}

export interface ParentSession {
  id: number;
  parent_id: string;
  screen: 'checkin' | 'summary' | 'summary_prev' | 'onboarding' | 'mascot_care' | 'activity' | 'centers';
  started_at: string;
  duration_ms: number | null;
  app_version: string | null;
  platform: 'ios' | 'android' | null;
}

// upsert_checkin RPC params
export interface UpsertCheckinParams {
  p_child_id:         string;
  p_situation:        string;
  p_situation_choice: string;
  p_emotion:          Emotion;
  p_dimension:        Dimension;
  p_micro_activity?:  MicroActivity | null;
  p_session_duration?: number | null;
}

// ---------------------------------------------------------------------------
// Phase 2 — Premium + B2B Clinics
// ---------------------------------------------------------------------------
export type SubscriptionPlan   = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type OrgType            = 'clinic' | 'school' | 'pie';
export type OrgMemberRole      = 'admin' | 'clinician' | 'observer';
export type AlertType          = 'pattern_persists' | 'engagement_drop' | 'crisis';
export type AlertSeverity      = 'low' | 'medium' | 'high' | 'crisis';

export interface Subscription {
  id: number;
  parent_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  revenuecat_user_id: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  slug: string;
  display_name: string;
  org_type: OrgType;
  country: string;
  city: string | null;
  billing_plan: string;
  billing_status: string;
  pilot_ends_at: string | null;
  admin_email: string;
  features: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: number;
  org_id: number;
  user_id: string;
  role: OrgMemberRole;
  display_name: string;
  profession: string | null;
  is_active: boolean;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface OrgChildConsent {
  id: number;
  org_id: number;
  child_id: string;
  parent_id: string;
  consent_granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  consent_version: string;
  consent_text_hash: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BehavioralAlert {
  id: number;
  child_id: string;
  parent_id: string;
  alert_type: AlertType;
  dimension: Dimension | null;
  pattern_key: string | null;
  weeks_count: number | null;
  severity: AlertSeverity;
  message_es: string;
  suggestion_es: string | null;
  is_read: boolean;
  read_at: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
  center_suggested: boolean;
  center_suggested_at: string | null;
}

export interface SharedSummaryLink {
  id: number;
  parent_id: string;
  child_id: string;
  token: string;
  week_start: string | null;
  weeks_count: number;
  dimensions: string[];
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export interface DimensionStats {
  total: number;
  positive_choice: number;
  refuses?: number;
  delays?: number;
  alone?: number;
  explodes?: number;
  withdraws?: number;
  regulates?: number;
  shares?: number;
  keeps?: number;
}

export interface WeeklySummary {
  id: number;
  child_id: string;
  parent_id: string;
  week_start: string;
  active_days: number;
  total_checkins: number;
  stickers_earned: number;
  dimension_stats: Partial<Record<Dimension, DimensionStats>>;
  tip_dato_es: string | null;
  tip_accion_es: string | null;
  pattern_flags: Record<string, number>;
  computed_at: string;
  is_premium_summary: boolean;
}

export interface ClinicianNote {
  id: number;
  org_id: number;
  child_id: string;
  clinician_id: string;
  week_start: string | null;
  note_text: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Phase 3 — B2B Schools + PIE
// ---------------------------------------------------------------------------
export type SchoolProgramType = 'general' | 'pie' | 'pie_tea' | 'pie_dif';

export interface SchoolGroup {
  id: number;
  org_id: number;
  name: string;
  grade_level: string | null;
  program_type: SchoolProgramType;
  academic_year: number;
  coordinator_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GroupChild {
  id: number;
  group_id: number;
  child_id: string;
  org_id: number;
  enrolled_at: string;
  left_at: string | null;
}

export interface CohortBenchmark {
  id: number;
  group_id: number;
  org_id: number;
  week_start: string;
  dimension: Dimension;
  n_children: number;
  pct_positive: number | null;   // null when suppressed
  pct_negative: number | null;
  pct_active: number | null;
  avg_emotion_score: number | null;
  suppressed: boolean;           // true when n_children < 5
  computed_at: string;
}

export interface MineducReport {
  id: number;
  org_id: number;
  group_id: number | null;
  report_type: 'pie_monthly' | 'pie_annual' | 'general_monthly';
  period_start: string;
  period_end: string;
  academic_year: number;
  report_data: Record<string, unknown>;
  generated_by: string | null;
  generated_at: string;
  storage_path: string | null;
}

export interface ClinicalAssessment {
  id: number;
  org_id: number;
  child_id: string;
  clinician_id: string;
  assessment_date: string;
  score_instrucciones: number | null;  // 1-5
  score_socializacion: number | null;
  score_prosocial: number | null;
  score_regulacion: number | null;
  score_animo: number | null;
  risk_level: 'low' | 'moderate' | 'high' | 'crisis' | null;
  internal_notes: string | null;
  referral_recommended: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Phase 3 — Mascot Care + Parenting + Activities + Centers
// ---------------------------------------------------------------------------

export interface MascotState {
  id: number;
  child_id: string;
  hunger: number;        // 0-100
  cleanliness: number;   // 0-100
  happiness: number;     // 0-100
  last_decay_at: string;
  updated_at: string;
}

export interface MascotInteraction {
  id: number;
  child_id: string;
  action: 'feed' | 'wash' | 'play' | 'clean';
  need_type: 'hunger' | 'cleanliness' | 'happiness';
  need_before: number | null;
  need_after: number | null;
  created_at: string;
}

export interface ChildConductualStats {
  id: number;
  child_id: string;
  instrucciones: number;  // 0-10 EMA
  socializacion: number;
  prosocial: number;
  regulacion: number;
  animo: number;
  total_samples: number;
  luna_archetype: LunaArchetype;
  archetype_updated_at: string;
  updated_at: string;
}

export interface ParentingQuizResponses {
  id: number;
  parent_id: string;
  q1_demands: number | null;
  q2_responsiveness: number | null;
  q3_autonomy: number | null;
  q4_warmth: number | null;
  q5_control: number | null;
  q6_communication: number | null;
  computed_style: ParentingStyle | null;
  created_at: string;
}

export interface ActivityCatalog {
  id: number;
  slug: string;
  title_es: string;
  description_es: string;
  dimension: Dimension | null;
  age_group: AgeGroup | 'all' | null;
  duration_min: number;
  difficulty: 'easy' | 'medium' | 'hard';
  materials_es: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ActivitySuggestion {
  id: number;
  parent_id: string;
  child_id: string;
  activity_id: number;
  status: 'pending' | 'shown' | 'completed' | 'dismissed';
  shown_at: string | null;
  completed_at: string | null;
  dismissed_at: string | null;
  feedback_rating: number | null;
  week_start: string | null;
  created_at: string;
}

export interface MentalHealthCenter {
  id: number;
  name: string;
  address: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  specialties: string[];
  accepts_fonasa: boolean;
  accepts_isapre: boolean;
  is_public: boolean;
  opening_hours: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CenterReferral {
  id: number;
  parent_id: string;
  child_id: string;
  center_id: number;
  alert_id: number | null;
  status: 'suggested' | 'viewed' | 'contacted' | 'visited' | 'dismissed';
  suggested_at: string;
  viewed_at: string | null;
  contacted_at: string | null;
  visited_at: string | null;
  dismissed_at: string | null;
  parent_notes: string | null;
  created_at: string;
}
