// =============================================================================
// Hachiko Kids — Weekly Summary Generator
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

// Positive situation_choice values per dimension
const POSITIVE_CHOICES: Record<string, string[]> = {
  instrucciones: ['helps'],
  socializacion: ['social', 'one_friend'],
  prosocial:     ['shares', 'compromises'],
  regulacion:    ['regulates'],
  animo:         ['great'],
};

// Negative situation_choice values per dimension
const NEGATIVE_CHOICES: Record<string, string[]> = {
  instrucciones: ['refuses', 'delays'],
  socializacion: ['alone'],
  prosocial:     ['keeps'],
  regulacion:    ['explodes', 'withdraws'],
  animo:         ['low'],
};

const DIMENSIONS = ['instrucciones', 'socializacion', 'prosocial', 'regulacion', 'animo'] as const;

Deno.serve(async (req) => {
  // Only accept POST (or GET for manual triggers)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const monday = getMondayOfLastWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  console.log(`Generating summaries for week: ${monday.toISOString().slice(0, 10)}`);

  // Fetch all children who had check-ins last week
  const { data: checkins, error: fetchError } = await supabase
    .from('checkins')
    .select('child_id, children!inner(parent_id)')
    .gte('created_at', monday.toISOString())
    .lte('created_at', sunday.toISOString());

  if (fetchError) {
    console.error('Failed to fetch checkins:', fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  // Deduplicate child IDs
  const childMap = new Map<string, string>();
  for (const row of checkins ?? []) {
    const parentId = (row as any).children?.parent_id;
    if (parentId) childMap.set(row.child_id, parentId);
  }

  let processed = 0;
  let errors = 0;

  for (const [childId, parentId] of childMap) {
    try {
      await generateSummaryForChild(childId, parentId, monday, sunday);
      processed++;
    } catch (err) {
      console.error(`Failed to generate summary for child ${childId}:`, err);
      errors++;
    }
  }

  console.log(`Done. Processed: ${processed}, Errors: ${errors}`);
  return new Response(
    JSON.stringify({ processed, errors, week_start: monday.toISOString().slice(0, 10) }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

async function generateSummaryForChild(
  childId: string,
  parentId: string,
  weekStart: Date,
  weekEnd: Date
) {
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Fetch all check-ins for this child this week
  const { data: checkins, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('child_id', childId)
    .gte('created_at', weekStart.toISOString())
    .lte('created_at', weekEnd.toISOString());

  if (error) throw error;
  if (!checkins || checkins.length === 0) return;

  // Count active days (distinct check_date values)
  const activeDates = new Set(checkins.map((c: any) => c.check_date));
  const activeDays = activeDates.size;

  // Count stickers earned this week
  const { count: stickersEarned } = await supabase
    .from('child_stickers')
    .select('*', { count: 'exact', head: true })
    .eq('child_id', childId)
    .gte('earned_date', weekStartStr)
    .lte('earned_date', weekEnd.toISOString().slice(0, 10));

  // Compute per-dimension stats
  const dimensionStats: Record<string, Record<string, number>> = {};
  const patternFlags: Record<string, number> = {};

  for (const dim of DIMENSIONS) {
    const dimCheckins = checkins.filter((c: any) => c.dimension === dim);
    if (dimCheckins.length === 0) continue;

    const positive = dimCheckins.filter((c: any) =>
      POSITIVE_CHOICES[dim]?.includes(c.situation_choice)
    ).length;

    const negative = dimCheckins.filter((c: any) =>
      NEGATIVE_CHOICES[dim]?.includes(c.situation_choice)
    ).length;

    dimensionStats[dim] = {
      total:           dimCheckins.length,
      positive_choice: positive,
      refuses:   dimCheckins.filter((c: any) => c.situation_choice === 'refuses').length,
      delays:    dimCheckins.filter((c: any) => c.situation_choice === 'delays').length,
      alone:     dimCheckins.filter((c: any) => c.situation_choice === 'alone').length,
      explodes:  dimCheckins.filter((c: any) => c.situation_choice === 'explodes').length,
      withdraws: dimCheckins.filter((c: any) => c.situation_choice === 'withdraws').length,
      regulates: dimCheckins.filter((c: any) => c.situation_choice === 'regulates').length,
      shares:    dimCheckins.filter((c: any) => c.situation_choice === 'shares').length,
      keeps:     dimCheckins.filter((c: any) => c.situation_choice === 'keeps').length,
    };

    // Flag patterns: high negative rate (>=60% of dimension check-ins)
    if (dimCheckins.length >= 2 && negative / dimCheckins.length >= 0.6) {
      const key = `high_negative_${dim}`;
      patternFlags[key] = (patternFlags[key] ?? 0) + 1;
    }
  }

  // Generate behavioral tips (simple rule-based, no LLM)
  const { tip_dato, tip_accion } = generateTip(dimensionStats);

  const { error: upsertError } = await supabase
    .from('weekly_summaries')
    .upsert({
      child_id:          childId,
      parent_id:         parentId,
      week_start:        weekStartStr,
      active_days:       activeDays,
      total_checkins:    checkins.length,
      stickers_earned:   stickersEarned ?? 0,
      dimension_stats:   dimensionStats,
      tip_dato_es:       tip_dato,
      tip_accion_es:     tip_accion,
      pattern_flags:     patternFlags,
      computed_at:       new Date().toISOString(),
    }, {
      onConflict: 'child_id,week_start',
    });

  if (upsertError) throw upsertError;
}

function generateTip(
  dimensionStats: Record<string, Record<string, number>>
): { tip_dato: string; tip_accion: string } {
  // Find the dimension with highest negative rate
  let worstDim = '';
  let worstRate = 0;

  for (const [dim, stats] of Object.entries(dimensionStats)) {
    if (stats.total === 0) continue;
    const negativeChoices =
      (stats.refuses ?? 0) +
      (stats.alone ?? 0) +
      (stats.explodes ?? 0) +
      (stats.withdraws ?? 0) +
      (stats.keeps ?? 0);
    const rate = negativeChoices / stats.total;
    if (rate > worstRate) {
      worstRate = rate;
      worstDim = dim;
    }
  }

  const tips: Record<string, { dato: string; accion: string }> = {
    instrucciones: {
      dato:   'Esta semana le costó seguir instrucciones en varios momentos.',
      accion: 'Prueba dar una instrucción a la vez y agradecer cuando la cumple.',
    },
    socializacion: {
      dato:   'Esta semana prefirió actividades más solitarias.',
      accion: 'Organiza un momento corto de juego con un solo amigo de confianza.',
    },
    prosocial: {
      dato:   'Esta semana le costó compartir o ceder con otros.',
      accion: 'Jueguen juntos a un juego donde los dos puedan ganar (cooperativo).',
    },
    regulacion: {
      dato:   'Esta semana tuvo más momentos de frustración intensa.',
      accion: 'Practica con ella/él la respiración de 4 tiempos antes de que aparezca el enojo.',
    },
    animo: {
      dato:   'Esta semana su ánimo general estuvo más bajo de lo habitual.',
      accion: 'Reserva 10 minutos al día para una actividad que a ella/él le encante, sin agenda.',
    },
  };

  if (worstDim && tips[worstDim]) {
    return { tip_dato: tips[worstDim].dato, tip_accion: tips[worstDim].accion };
  }

  // Default positive tip
  return {
    tip_dato:   '¡Buena semana! Completó sus sesiones con Luna sin problemas.',
    tip_accion: 'Cuéntale que notaste su esfuerzo — el reconocimiento refuerza el hábito.',
  };
}

function getMondayOfLastWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;          // 0=Sunday → 7
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - dayOfWeek - 6);  // go back to last Monday
  lastMonday.setHours(0, 0, 0, 0);
  return lastMonday;
}
