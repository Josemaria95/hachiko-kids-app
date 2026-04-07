// =============================================================================
// Hachiko Kids — Weekly Summary Generator (Motor de Reglas GQM)
// Edge Function scheduled via pg_cron: every Monday at 12:00 UTC (09:00 Santiago)
//
// pg_cron schedule:
//   SELECT cron.schedule(
//     'generate-weekly-summaries',
//     '0 12 * * 1',
//     $$
//       SELECT net.http_post(
//         url := current_setting('app.edge_function_url') || '/generate-weekly-summaries',
//         headers := jsonb_build_object(
//           'Content-Type', 'application/json',
//           'Authorization', 'Bearer ' || current_setting('app.service_role_key')
//         ),
//         body := '{}'::jsonb
//       );
//     $$
//   );
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const DIMENSIONS = ['instrucciones', 'socializacion', 'prosocial', 'regulacion', 'animo'] as const;
type Dimension = typeof DIMENSIONS[number];

// Solo estos valores son NEGATIVOS (activan tip_crianza)
const NEGATIVE_CHOICES: Record<string, string[]> = {
  instrucciones: ['refuses'],
  socializacion: ['alone'],
  prosocial:     ['keeps'],
  regulacion:    ['explodes'],
  animo:         ['low'],
};

const POSITIVE_CHOICES: Record<string, string[]> = {
  instrucciones: ['helps'],
  socializacion: ['social', 'one_friend'],
  prosocial:     ['shares', 'compromises'],
  regulacion:    ['regulates'],
  animo:         ['great'],
};

// Emotion numeric scores for avg calculation
const EMOTION_SCORE: Record<string, number> = {
  happy:   2,
  neutral: 1,
  sad:    -1,
  angry:  -2,
  scared: -1,
};

interface Recommendation {
  id: string;
  dimension: string;
  type: string;
  priority: number;
  trigger_metric: string;
  trigger_op: string;
  trigger_value: number;
  trigger_weeks: number;
  age_groups: string[];
  text_dato: string;
  text_accion: string;
  source_name: string;
  source_tier: number;
  cooldown_weeks: number;
}

interface DimensionMetrics {
  positive_rate: number;
  negative_rate: number;
  neutral_rate: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total: number;
  delta?: number;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const monday = getMondayOfLastWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekStartStr = monday.toISOString().slice(0, 10);
  const weekEndStr   = sunday.toISOString().slice(0, 10);

  console.log(`Generating summaries for week: ${weekStartStr}`);

  // 1. Cargar catálogo de recommendations (una vez)
  const { data: recommendations, error: recError } = await supabase
    .from('recommendations')
    .select('*');

  if (recError) {
    console.error('Failed to fetch recommendations:', recError);
    return new Response(JSON.stringify({ error: recError.message }), { status: 500 });
  }

  // 2. Fetch checkins de la semana pasada con child data
  const { data: allCheckins, error: fetchError } = await supabase
    .from('checkins')
    .select('child_id, situation_choice, emotion, dimension, check_date, children!inner(parent_id, age_group)')
    .gte('check_date', weekStartStr)
    .lte('check_date', weekEndStr);

  if (fetchError) {
    console.error('Failed to fetch checkins:', fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  // 3. Agrupar por child_id
  const childMap = new Map<string, { parentId: string; ageGroup: string; checkins: any[] }>();
  for (const row of allCheckins ?? []) {
    const child = (row as any).children;
    if (!child) continue;
    if (!childMap.has(row.child_id)) {
      childMap.set(row.child_id, { parentId: child.parent_id, ageGroup: child.age_group, checkins: [] });
    }
    childMap.get(row.child_id)!.checkins.push(row);
  }

  let processed = 0;
  let errors = 0;

  for (const [childId, { parentId, ageGroup, checkins }] of childMap) {
    try {
      await processChild(childId, parentId, ageGroup, checkins, weekStartStr, weekEndStr, recommendations as Recommendation[]);
      processed++;
    } catch (err) {
      console.error(`Failed to process child ${childId}:`, err);
      errors++;
    }
  }

  console.log(`Done. Processed: ${processed}, Errors: ${errors}`);
  return new Response(
    JSON.stringify({ processed, errors, week_start: weekStartStr }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

async function processChild(
  childId: string,
  parentId: string,
  ageGroup: string,
  checkins: any[],
  weekStartStr: string,
  weekEndStr: string,
  recommendations: Recommendation[]
) {
  if (checkins.length === 0) return;

  // a. Calcular métricas por dimensión
  const dimensionMetrics = computeDimensionMetrics(checkins);

  // b. Fetch semana anterior para calcular delta
  const prevMonday = new Date(weekStartStr);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevMondayStr = prevMonday.toISOString().slice(0, 10);

  const { data: prevInsight } = await supabase
    .from('weekly_insights')
    .select('dimension_metrics')
    .eq('child_id', childId)
    .eq('week_start', prevMondayStr)
    .maybeSingle();

  // Agregar delta a métricas
  if (prevInsight?.dimension_metrics) {
    for (const dim of DIMENSIONS) {
      if (dimensionMetrics[dim] && prevInsight.dimension_metrics[dim]) {
        const prevPositive = prevInsight.dimension_metrics[dim].positive_rate ?? 0;
        dimensionMetrics[dim].delta = dimensionMetrics[dim].positive_rate - prevPositive;
      }
    }
  }

  // c. Fetch shown_rec_ids de las últimas 4 semanas para cooldown
  const fourWeeksAgo = new Date(weekStartStr);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const { data: recentInsights } = await supabase
    .from('weekly_insights')
    .select('shown_rec_ids')
    .eq('child_id', childId)
    .gte('week_start', fourWeeksAgo.toISOString().slice(0, 10))
    .lt('week_start', weekStartStr);

  const cooldownSet = new Set<string>();
  for (const row of recentInsights ?? []) {
    for (const recId of row.shown_rec_ids ?? []) {
      cooldownSet.add(recId);
    }
  }

  // d. Calcular emotion summary
  const emotionSummary = computeEmotionSummary(checkins, weekStartStr);

  // e-g. Filtrar y ordenar recommendations elegibles
  const eligible = recommendations
    .filter(rec => {
      if (!rec.age_groups.includes(ageGroup)) return false;
      if (cooldownSet.has(rec.id)) return false;
      return evaluateTrigger(rec, dimensionMetrics);
    })
    .sort((a, b) => a.priority - b.priority);

  // h. Seleccionar mainRec
  const mainRec = eligible[0] ?? null;

  // i. Para cada dimensión: mejor rec específica + nivel
  const dimensionInsights: Record<string, {
    level: 'normal' | 'atencion' | 'alerta';
    rec_id: string | null;
    tip: string;
    source: string;
  }> = {};

  for (const dim of DIMENSIONS) {
    const metrics = dimensionMetrics[dim];
    const negRate = metrics?.negative_rate ?? 0;
    const level: 'normal' | 'atencion' | 'alerta' =
      negRate >= 0.6 ? 'alerta' :
      negRate >= 0.3 ? 'atencion' :
      'normal';

    // Mejor rec para esta dimensión específica
    const dimRec = eligible.find(r => r.dimension === dim) ?? null;

    dimensionInsights[dim] = {
      level,
      rec_id: dimRec?.id ?? null,
      tip: dimRec?.text_accion ?? 'Sin datos suficientes esta semana.',
      source: dimRec?.source_name ?? '',
    };
  }

  // Contador de días activos
  const activeDates = new Set(checkins.map((c: any) => c.check_date));

  // Texto fallback si todas las recs en cooldown
  const mainDato   = mainRec?.text_dato   ?? '¡Buena semana! Patrones estables.';
  const mainAccion = mainRec?.text_accion ?? 'Sigue con las rutinas que ya están funcionando bien.';
  const mainSource = mainRec?.source_name ?? null;

  const shownRecIds = [
    ...(mainRec ? [mainRec.id] : []),
    ...Object.values(dimensionInsights)
      .map(d => d.rec_id)
      .filter((id): id is string => id !== null && id !== mainRec?.id),
  ];

  // j. Upsert en weekly_insights
  const { error: insightError } = await supabase
    .from('weekly_insights')
    .upsert({
      child_id:          childId,
      week_start:        weekStartStr,
      dimension_metrics: dimensionMetrics,
      emotion_summary:   emotionSummary,
      active_days:       activeDates.size,
      total_checkins:    checkins.length,
      main_rec_id:       mainRec?.id ?? null,
      main_dato:         mainDato,
      main_accion:       mainAccion,
      main_source:       mainSource,
      dimension_insights: dimensionInsights,
      shown_rec_ids:     shownRecIds,
      computed_at:       new Date().toISOString(),
    }, { onConflict: 'child_id,week_start' });

  if (insightError) throw insightError;

  // k. Actualizar pet_health vía RPC
  await supabase.rpc('refresh_pet_health', { p_child_id: childId });

  // l. Upsert en weekly_summaries (compatibilidad Phase 2)
  await supabase
    .from('weekly_summaries')
    .upsert({
      child_id:       childId,
      parent_id:      parentId,
      week_start:     weekStartStr,
      active_days:    activeDates.size,
      total_checkins: checkins.length,
      stickers_earned: 0,
      dimension_stats: computeLegacyDimensionStats(checkins),
      tip_dato_es:    mainDato,
      tip_accion_es:  mainAccion,
      pattern_flags:  {},
      computed_at:    new Date().toISOString(),
    }, { onConflict: 'child_id,week_start' })
    .then(({ error }) => {
      if (error) console.warn('weekly_summaries upsert warn (non-blocking):', error.message);
    });
}

function computeDimensionMetrics(checkins: any[]): Record<string, DimensionMetrics> {
  const result: Record<string, DimensionMetrics> = {};
  for (const dim of DIMENSIONS) {
    const rows = checkins.filter((c: any) => c.dimension === dim);
    if (rows.length === 0) continue;

    const positiveCount = rows.filter((c: any) => POSITIVE_CHOICES[dim]?.includes(c.situation_choice)).length;
    const negativeCount = rows.filter((c: any) => NEGATIVE_CHOICES[dim]?.includes(c.situation_choice)).length;
    const neutralCount  = rows.length - positiveCount - negativeCount;

    result[dim] = {
      positive_rate:  positiveCount / rows.length,
      negative_rate:  negativeCount / rows.length,
      neutral_rate:   neutralCount  / rows.length,
      positive_count: positiveCount,
      negative_count: negativeCount,
      neutral_count:  neutralCount,
      total:          rows.length,
    };
  }
  return result;
}

function computeEmotionSummary(checkins: any[], weekStartStr: string) {
  const emotionCounts: Record<string, number> = {};
  for (const c of checkins) {
    emotionCounts[c.emotion] = (emotionCounts[c.emotion] ?? 0) + 1;
  }

  const dominant = Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'neutral';
  const variety  = Object.keys(emotionCounts).length;

  const weekStart = new Date(weekStartStr);
  const byDay = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayCheckins = checkins.filter((c: any) => c.check_date === dateStr);
    if (dayCheckins.length === 0) continue;

    const avgScore = dayCheckins.reduce((s: number, c: any) => s + (EMOTION_SCORE[c.emotion] ?? 0), 0) / dayCheckins.length;
    const dayCounts: Record<string, number> = {};
    for (const c of dayCheckins) dayCounts[c.emotion] = (dayCounts[c.emotion] ?? 0) + 1;
    const dayEmotion = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'neutral';

    byDay.push({ day_idx: i, emotion: dayEmotion, avg_score: avgScore });
  }

  return { dominant, variety, by_day: byDay };
}

function evaluateTrigger(rec: Recommendation, metrics: Record<string, DimensionMetrics>): boolean {
  if (rec.trigger_metric === 'always') return true;
  const dimMetrics = metrics[rec.dimension];
  if (!dimMetrics || dimMetrics.total === 0) return false;

  const value = (dimMetrics as any)[rec.trigger_metric] as number;
  if (value === undefined) return false;

  switch (rec.trigger_op) {
    case '>=': return value >= rec.trigger_value;
    case '<=': return value <= rec.trigger_value;
    case '==': return Math.abs(value - rec.trigger_value) < 0.01;
    default:   return false;
  }
}

function computeLegacyDimensionStats(checkins: any[]): Record<string, Record<string, number>> {
  const stats: Record<string, Record<string, number>> = {};
  for (const dim of DIMENSIONS) {
    const rows = checkins.filter((c: any) => c.dimension === dim);
    if (rows.length === 0) continue;
    const positive = rows.filter((c: any) => POSITIVE_CHOICES[dim]?.includes(c.situation_choice)).length;
    const negative = rows.filter((c: any) => NEGATIVE_CHOICES[dim]?.includes(c.situation_choice)).length;
    stats[dim] = { total: rows.length, positive_choice: positive, negative_choice: negative };
  }
  return stats;
}

function getMondayOfLastWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - dayOfWeek - 6);
  lastMonday.setHours(0, 0, 0, 0);
  return lastMonday;
}
