---
title: "Motor de Reglas GQM — Plan de Implementación"
date: 2026-04-06
tags: [producto, motor-reglas, implementacion]
status: en-progreso
---

# Motor de Reglas Hachiko Kids — Plan de Implementación

> **Contexto**: Este documento captura el diseño completo del motor de reglas determinístico para Hachiko Kids.
> El código se implementa en `/Users/jm95/Documents/hachiko-kids-app` (repo separado de la app).
>
> **Estado DB**: La migración SQL ya fue aplicada al proyecto Supabase `zxwaxpattxlhxvqaawnq`.
> Las tablas `pet_health`, `recommendations`, `weekly_insights` YA EXISTEN, y `children.sport` YA tiene la columna.
> El seed de 15 recomendaciones debe verificarse / aplicarse si aún no se hizo.

---

## 1. Qué hace este motor

Reemplaza los dos sistemas de tips hardcodeados actuales (Edge Function + cliente `summary.tsx`) por un motor determinístico que:

1. Lee check-ins semanales de la tabla `checkins`
2. Calcula métricas por dimensión (positive_rate, negative_rate, delta vs semana anterior)
3. Evalúa el catálogo de recomendaciones (`recommendations`) contra esas métricas
4. Aplica filtros de edad, cooldown anti-repetición y prioridad
5. Escribe el output en `weekly_insights` (Dato + Acción con fuente institucional por dimensión)
6. El padre ve esto en `summary.tsx` en lugar de tips calculados en cliente

---

## 2. Estado de la base de datos (Supabase `zxwaxpattxlhxvqaawnq`)

### Ya aplicado en producción ✓

```sql
-- Columna deporte en children
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS sport text;

-- Tabla pet_health
CREATE TABLE IF NOT EXISTS public.pet_health (
  child_id     uuid    PRIMARY KEY REFERENCES public.children(id) ON DELETE CASCADE,
  health_score integer NOT NULL DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  streak_days  integer NOT NULL DEFAULT 0,
  max_streak   integer NOT NULL DEFAULT 0,
  last_checkin date,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Tabla recommendations (catálogo de reglas)
CREATE TABLE IF NOT EXISTS public.recommendations (
  id             text    PRIMARY KEY,
  dimension      text    NOT NULL CHECK (dimension IN ('instrucciones','socializacion','prosocial','regulacion','animo','general')),
  type           text    NOT NULL CHECK (type IN ('tip_crianza','refuerzo_positivo','alerta','tip_educativo','derivacion')),
  priority       integer NOT NULL DEFAULT 3,
  trigger_metric text    NOT NULL,   -- 'negative_rate' | 'positive_rate' | 'always'
  trigger_op     text    NOT NULL DEFAULT '>=',
  trigger_value  numeric NOT NULL,
  trigger_weeks  integer NOT NULL DEFAULT 1,
  age_groups     text[]  NOT NULL DEFAULT ARRAY['4-6','7-12'],
  text_dato      text    NOT NULL,
  text_accion    text    NOT NULL,
  source_name    text    NOT NULL,
  source_tier    integer NOT NULL DEFAULT 1,
  cooldown_weeks integer NOT NULL DEFAULT 4,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Tabla weekly_insights (output del motor)
CREATE TABLE IF NOT EXISTS public.weekly_insights (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child_id           uuid   NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  week_start         date   NOT NULL,
  dimension_metrics  jsonb  NOT NULL DEFAULT '{}',
  emotion_summary    jsonb  NOT NULL DEFAULT '{}',
  active_days        integer NOT NULL DEFAULT 0,
  total_checkins     integer NOT NULL DEFAULT 0,
  main_rec_id        text    REFERENCES public.recommendations(id),
  main_dato          text    NOT NULL DEFAULT '',
  main_accion        text    NOT NULL DEFAULT '',
  main_source        text,
  dimension_insights jsonb  NOT NULL DEFAULT '{}',
  shown_rec_ids      text[] NOT NULL DEFAULT '{}',
  computed_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_insights_child_week
  ON public.weekly_insights (child_id, week_start DESC);
```

### RPC `refresh_pet_health` (ya aplicada)

```sql
CREATE OR REPLACE FUNCTION public.refresh_pet_health(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last_checkin date; v_streak integer := 0; v_max_streak integer := 0;
  v_health integer := 100; v_today date := current_date; v_days_missed integer;
BEGIN
  IF NOT is_parent_of_child(p_child_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT check_date INTO v_last_checkin FROM checkins
    WHERE child_id = p_child_id ORDER BY check_date DESC LIMIT 1;
  IF v_last_checkin IS NULL THEN RETURN jsonb_build_object('health_score', 100, 'streak_days', 0); END IF;
  SELECT health_score, streak_days, max_streak INTO v_health, v_streak, v_max_streak
    FROM pet_health WHERE child_id = p_child_id;
  IF NOT FOUND THEN v_health := 100; v_streak := 0; v_max_streak := 0; END IF;
  v_days_missed := v_today - v_last_checkin;
  IF v_days_missed = 0 THEN
    v_health := LEAST(100, v_health + 5);
    WITH RECURSIVE streak_cte AS (
      SELECT check_date, 1 AS n FROM checkins WHERE child_id = p_child_id AND check_date = v_today
      UNION ALL
      SELECT c.check_date, s.n + 1 FROM checkins c
        JOIN streak_cte s ON c.check_date = s.check_date - 1 WHERE c.child_id = p_child_id
    ) SELECT COALESCE(MAX(n), 1) INTO v_streak FROM streak_cte;
  ELSIF v_days_missed = 1 THEN v_health := GREATEST(20, v_health - 3); v_streak := 0;
  ELSIF v_days_missed = 2 THEN v_health := GREATEST(20, v_health - 5); v_streak := 0;
  ELSE v_health := GREATEST(20, v_health - 8); v_streak := 0; END IF;
  IF v_streak >= 7 THEN v_health := LEAST(100, v_health + 10); END IF;
  v_max_streak := GREATEST(v_max_streak, v_streak);
  INSERT INTO pet_health (child_id, health_score, streak_days, max_streak, last_checkin, updated_at)
    VALUES (p_child_id, v_health, v_streak, v_max_streak, v_last_checkin, now())
    ON CONFLICT (child_id) DO UPDATE SET
      health_score = EXCLUDED.health_score, streak_days = EXCLUDED.streak_days,
      max_streak = EXCLUDED.max_streak, last_checkin = EXCLUDED.last_checkin, updated_at = now();
  RETURN jsonb_build_object('health_score', v_health, 'streak_days', v_streak, 'max_streak', v_max_streak);
END; $$;
```

### RLS ya configurada (pet_health, recommendations, weekly_insights)

- `pet_health`: padres leen health de sus hijos via `is_parent_of_child()`
- `recommendations`: cualquier usuario autenticado puede leer el catálogo
- `weekly_insights`: padres leen insights de sus hijos via `is_parent_of_child()`

---

## 3. Seed: 15 recomendaciones MVP

**Verificar si ya existe** en Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM recommendations WHERE id LIKE 'REC-%';
```

Si devuelve 0, aplicar el seed completo:

```sql
DELETE FROM public.recommendations WHERE id LIKE 'REC-%';

INSERT INTO public.recommendations
  (id, dimension, type, priority, trigger_metric, trigger_op, trigger_value,
   trigger_weeks, age_groups, text_dato, text_accion, source_name, source_tier, cooldown_weeks)
VALUES
-- INSTRUCCIONES
('REC-001','instrucciones','tip_crianza',2,'negative_rate','>=',0.4,1,ARRAY['4-6','7-12'],
 'Esta semana le costó seguir instrucciones en varios momentos.',
 'Prueba dar una instrucción a la vez y esperar que la complete antes de dar la siguiente. Agradecer cuando la cumple funciona mejor que corregir cuando no.',
 'Maletín Socioemocional — MINEDUC (2023)',1,4),

('REC-002','instrucciones','refuerzo_positivo',3,'positive_rate','>=',0.6,1,ARRAY['4-6','7-12'],
 '¡Esta semana siguió instrucciones con mucha facilidad!',
 'Nombra específicamente lo que notaste: "vi que guardaste los juguetes cuando te lo pedí — eso me alegra mucho." El reconocimiento concreto refuerza el hábito.',
 'Orientaciones SEL — MINEDUC (2022)',1,4),

('REC-003','instrucciones','tip_educativo',4,'always','>=',0,1,ARRAY['4-6','7-12'],
 'Seguir instrucciones a esta edad es un proceso activo, no automático.',
 'Los niños de 4 a 12 años siguen instrucciones mejor cuando entienden el "por qué". Una breve explicación ("ordenamos para que no perdamos los juguetes") hace una gran diferencia.',
 'Guía de Crianza Positiva — UNICEF Chile (2021)',2,3),

-- SOCIALIZACIÓN
('REC-004','socializacion','tip_crianza',2,'negative_rate','>=',0.5,1,ARRAY['4-6','7-12'],
 'Esta semana eligió actividades solitarias la mayor parte del tiempo.',
 'Invita a un solo amigo de confianza a casa — los grupos pequeños son más fáciles que los grandes para niños que prefieren la calma.',
 'Maletín Socioemocional — MINEDUC (2023)',1,4),

('REC-005','socializacion','refuerzo_positivo',3,'positive_rate','>=',0.6,1,ARRAY['4-6','7-12'],
 'Esta semana eligió jugar con otros varias veces.',
 'Pregúntale cómo se sintió jugando con amigos — escuchar sus experiencias sociales positivas las refuerza.',
 'Habilidades para la Vida — MINEDUC (2021)',1,4),

('REC-006','socializacion','tip_educativo',4,'always','>=',0,1,ARRAY['4-6','7-12'],
 'Preferir jugar solo a veces es completamente normal a esta edad.',
 'El juego solitario desarrolla concentración y creatividad. Preocúpate solo si es la única forma de jugar durante varias semanas consecutivas.',
 'Guía de Crianza Positiva — UNICEF Chile (2021)',2,3),

-- PROSOCIAL
('REC-007','prosocial','tip_crianza',2,'negative_rate','>=',0.4,1,ARRAY['4-6','7-12'],
 'Esta semana le costó compartir o ceder con otros.',
 'Los juegos cooperativos donde todos ganan (rompecabezas en familia, construir juntos) practican el trabajo en equipo sin la presión de ceder.',
 'Programa Habilidades Socioemocionales — MINEDUC (2022)',1,4),

('REC-008','prosocial','refuerzo_positivo',3,'positive_rate','>=',0.6,1,ARRAY['4-6','7-12'],
 'Esta semana mostró generosidad y cooperación varias veces.',
 'Nómbralo específicamente: "vi que compartiste tu juguete — eso fue muy amable de tu parte." La conducta nombrada se repite.',
 'Orientaciones SEL — MINEDUC (2022)',1,4),

('REC-009','prosocial','tip_educativo',4,'always','>=',0,1,ARRAY['4-6','7-12'],
 'La conducta prosocial se desarrolla entre los 4 y los 10 años con práctica y modelado.',
 'Los niños aprenden a compartir viéndolo en los adultos. Cuando tú cedes o compartes, nómbralo en voz alta: "voy a compartir esto porque me importa que estemos todos bien."',
 'Habilidades para la Vida — MINEDUC (2021)',1,3),

-- REGULACIÓN
('REC-010','regulacion','tip_crianza',2,'negative_rate','>=',0.4,1,ARRAY['4-6','7-12'],
 'Esta semana tuvo momentos de explosión emocional con más frecuencia.',
 'Practica juntos la respiración de 4 tiempos cuando todo está tranquilo: inhala 4, aguanta 4, suelta 4. La práctica en calma la hace disponible cuando hay tormenta.',
 'Maletín Socioemocional — MINEDUC (2023)',1,4),

('REC-011','regulacion','refuerzo_positivo',3,'positive_rate','>=',0.6,1,ARRAY['4-6','7-12'],
 'Esta semana eligió regularse la mayoría de las veces ante momentos difíciles.',
 'Reconoce el esfuerzo, no solo el resultado: "vi que te costó no enojarte y lo manejaste muy bien." Eso consolida la habilidad.',
 'Programa Habilidades Socioemocionales — MINEDUC (2022)',1,4),

('REC-012','regulacion','tip_educativo',4,'always','>=',0,1,ARRAY['4-6','7-12'],
 'La regulación emocional es una habilidad que se construye lentamente, especialmente entre los 4 y 8 años.',
 'El cerebro emocional de un niño todavía está en desarrollo. Modelar tu propia regulación en voz alta ("estoy enojado y voy a respirar antes de responder") es la herramienta más poderosa.',
 'Guía de Crianza Positiva — UNICEF Chile (2021)',2,3),

-- ÁNIMO
('REC-013','animo','tip_crianza',2,'negative_rate','>=',0.4,1,ARRAY['4-6','7-12'],
 'Esta semana su ánimo general estuvo más bajo de lo usual.',
 'Reserva 10 minutos de atención exclusiva al día — sin teléfono, sin agenda — haciendo algo que él o ella elija. La atención indivisa es el lenguaje del amor para los niños.',
 'Guía de Crianza Positiva — UNICEF Chile (2021)',2,4),

('REC-014','animo','refuerzo_positivo',3,'positive_rate','>=',0.6,1,ARRAY['4-6','7-12'],
 '¡Esta semana mostró buen ánimo en general!',
 'Sigan con la rutina — la consistencia en los hábitos diarios es lo que más protege el bienestar emocional a esta edad.',
 'Habilidades para la Vida — MINEDUC (2021)',1,4),

('REC-015','animo','tip_educativo',4,'always','>=',0,1,ARRAY['4-6','7-12'],
 'El ánimo de los niños fluctúa más que el de los adultos — eso es normal y saludable.',
 'Enseñar nombres de emociones amplía el vocabulario emocional: "estás frustrado, no solo enojado". Un niño que puede nombrar lo que siente puede manejarlo mejor.',
 'Programa Habilidades Socioemocionales — MINEDUC (2022)',1,3);
```

---

## 4. Clasificación de choices (decisión de diseño)

**Solo son NEGATIVOS** (activan tip_crianza y alertas):
- instrucciones: `refuses`
- socializacion: `alone`
- prosocial: `keeps`
- regulacion: `explodes`
- animo: `low`

**Son NEUTROS** (no activan nada negativo):
- instrucciones: `delays` (negocia tiempo — estrategia verbal válida)
- regulacion: `withdraws` (se aleja a calmarse — estrategia legítima)
- animo: `okay`
- socializacion: `one_friend` (sigue siendo social, solo con uno)

**Son POSITIVOS**:
- instrucciones: `helps`
- socializacion: `social`, `one_friend`
- prosocial: `shares`, `compromises`
- regulacion: `regulates`
- animo: `great`

---

## 5. Archivos a crear/modificar en la app (`/Users/jm95/Documents/hachiko-kids-app`)

### 5.1 `lib/scenarios.ts` — Agregar exports

Buscar el tipo `Dimension` al principio del archivo y agregar inmediatamente después:

```typescript
// Exportar para uso en Edge Function y summary.tsx
export const POSITIVE_CHOICES: Record<Dimension, string[]> = {
  instrucciones: ["helps"],
  socializacion: ["social", "one_friend"],
  prosocial:     ["shares", "compromises"],
  regulacion:    ["regulates"],
  animo:         ["great"],
};

export const NEGATIVE_CHOICES: Record<Dimension, string[]> = {
  instrucciones: ["refuses"],
  socializacion: ["alone"],
  prosocial:     ["keeps"],
  regulacion:    ["explodes"],
  animo:         ["low"],
};
```

### 5.2 `src/(app)/select-mascot.tsx` — Agregar selector de deporte

Agregar estado y UI para deporte. El campo se guarda en `children.sport` al hacer insert.

**Estado nuevo:**
```typescript
const [sport, setSport] = useState<string | null>(null);
```

**Opciones:**
```typescript
const SPORT_OPTIONS = [
  "Fútbol", "Natación", "Básquetbol", "Tenis",
  "Gimnasia", "Artes marciales", "Danza / Ballet", "Otro", "Ninguno",
];
```

**En el insert de children agregar:**
```typescript
sport: sport ?? "ninguno",
```

**UI:** Grid de chips seleccionables tipo pill, debajo del selector de edad, antes del botón "¡Comenzar!". Es opcional (no bloquea el flujo si no se selecciona).

### 5.3 `src/(app)/checkin.tsx` — Actualizar pet_health al finalizar

En la función `showSticker()`, después del `upsert_checkin` y antes de `AsyncStorage.setItem`, agregar:

```typescript
// Actualizar pet_health (fire-and-forget — no bloquea el sticker)
supabase.rpc("refresh_pet_health", { p_child_id: child.id })
  .then(({ error }) => { if (error) console.warn("pet_health error:", error); });
```

### 5.4 `components/PetDisplay.tsx` — Prop healthScore (opcional)

Agregar prop opcional `healthScore?: number` a la interfaz `Props`.

Cuando se pase, usar para modular la opacidad del glow:
```typescript
const glowOpacity = healthScore !== undefined
  ? 0.05 + (healthScore / 100) * 0.20   // 0.05 (sin energía) → 0.25 (máx)
  : 0.15;
```

Pasar `glowOpacity` en lugar del `opacity: 0.15` hardcodeado en el View del glow.

### 5.5 `src/(app)/summary.tsx` — Consumir weekly_insights

**Cambios estructurales:**
1. Agregar interfaz `WeeklyInsight` que mapea las columnas de `weekly_insights`
2. Agregar estado `const [insight, setInsight] = useState<WeeklyInsight | null>(null)`
3. En `loadData()`, hacer fetch en paralelo de `checkins` (para timeline de ánimo) y `weekly_insights` (para tips)
4. Eliminar función `generateTip()` — el dato+acción viene de `insight.main_dato` / `insight.main_accion`
5. Mantener `summarizeDimension()` como fallback para semana sin insights aún
6. Mostrar `insight.main_source` como fuente citada debajo de la acción
7. En dimension cards: mostrar nivel de atención (✓/!/!) según `insight.dimension_insights[dim].level`
8. Si no hay insight (semana actual, edge function aún no corrió): mostrar card placeholder "Resumen disponible el próximo lunes"

**Interfaz WeeklyInsight:**
```typescript
interface WeeklyInsight {
  main_dato: string;
  main_accion: string;
  main_source: string | null;
  active_days: number;
  total_checkins: number;
  dimension_metrics: Record<string, {
    positive_rate: number;
    negative_rate: number;
    total: number;
    delta?: number;
  }>;
  emotion_summary: {
    dominant: string;
    variety: number;
    by_day: { day_idx: number; emotion: string; avg_score: number }[];
  };
  dimension_insights: Record<string, {
    level: "normal" | "atencion" | "alerta";
    rec_id: string | null;
    tip: string;
    source: string;
  }>;
}
```

**Fetch en loadData():**
```typescript
const { weekStartStr } = getWeekRange(weekOffset); // agregar weekStartStr al helper

const [checkinsResult, insightResult] = await Promise.all([
  supabase
    .from("checkins")
    .select("situation, situation_choice, emotion, created_at, dimension")
    .eq("child_id", c.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at"),
  supabase
    .from("weekly_insights")
    .select("*")
    .eq("child_id", c.id)
    .eq("week_start", weekStartStr)
    .maybeSingle(),
]);

setCheckins(checkinsResult.data ?? []);
setInsight(insightResult.data ?? null);
```

**Indicadores de nivel en dimension cards:**
```typescript
const LEVEL_BADGE = {
  normal:   { icon: "✓", color: colors.mint[500] },
  atencion: { icon: "!", color: colors.orange[500] },
  alerta:   { icon: "!", color: colors.red[500] },
};
```

**Delta semanal** (cuando hay insight): agregar `↑ Mejoró / → Estable / ↓ Bajó` a la descripción de la dimensión si `delta > 0.05 / abs < 0.05 / < -0.05`.

### 5.6 `supabase/functions/generate-weekly-summaries/index.ts` — Motor de reglas

**Reescribir completamente** con la siguiente lógica:

```
1. Cargar catálogo de recommendations de DB (una vez)
2. Fetch checkins de la semana pasada con children!inner(parent_id, age_group)
3. Agrupar por child_id
4. Para cada niño:
   a. computeDimensionMetrics(checkins) → positive_rate, negative_rate, neutral_rate, counts
      IMPORTANTE: usar nuevos NEGATIVE_CHOICES (solo refuses/explodes/keeps/alone/low)
   b. Fetch weekly_insights de semana anterior → calcular delta por dimensión
   c. Fetch últimas 4 semanas de shown_rec_ids → Set para cooldown
   d. computeEmotionSummary(checkins) → dominant, variety, by_day[]
   e. Filtrar recommendations: age_group match + no en cooldown + trigger cumplido
   f. Evaluar trigger: si trigger_metric='always' → true; si no → calcular métrica y comparar
   g. Ordenar por priority (menor = mayor prioridad)
   h. Seleccionar mainRec (primera elegible)
   i. Para cada dimensión: buscar mejor rec específica → calcular level (normal/atencion/alerta)
      - normal: negative_rate < 0.3
      - atencion: 0.3 <= negative_rate < 0.6
      - alerta: negative_rate >= 0.6
   j. Upsert en weekly_insights
   k. Actualizar pet_health (calcular streak, ajustar health_score)
   l. Upsert en weekly_summaries (compatibilidad Phase 2)
```

**Función evaluateTrigger:**
```typescript
function evaluateTrigger(rec, metrics): boolean {
  if (rec.trigger_metric === 'always') return true;
  const dimMetrics = metrics[rec.dimension];
  if (!dimMetrics || dimMetrics.total === 0) return false;
  const value = dimMetrics[rec.trigger_metric]; // 'negative_rate' | 'positive_rate'
  switch (rec.trigger_op) {
    case '>=': return value >= rec.trigger_value;
    case '<=': return value <= rec.trigger_value;
    case '==': return Math.abs(value - rec.trigger_value) < 0.01;
    default: return false;
  }
}
```

**dimension_insights JSONB output:**
```json
{
  "instrucciones": {
    "level": "normal|atencion|alerta",
    "rec_id": "REC-001",
    "tip": "Prueba dar una instrucción a la vez...",
    "source": "Maletín Socioemocional — MINEDUC (2023)"
  }
}
```

**dimension_metrics JSONB output:**
```json
{
  "instrucciones": {
    "positive_rate": 0.6,
    "negative_rate": 0.2,
    "neutral_rate": 0.2,
    "positive_count": 3,
    "negative_count": 1,
    "total": 5,
    "delta": 0.1
  }
}
```

**emotion_summary JSONB output:**
```json
{
  "dominant": "happy",
  "variety": 3,
  "by_day": [
    { "day_idx": 0, "emotion": "happy", "avg_score": 1.8 },
    { "day_idx": 2, "emotion": "neutral", "avg_score": 1.0 }
  ]
}
```

---

## 6. Decisiones de diseño importantes

| Decisión | Razón |
|----------|-------|
| `delays` y `withdraws` son neutros | Son estrategias válidas, no señales de riesgo. Evita falsos positivos con datos escasos del piloto |
| Umbral negative_rate >= 0.4 para tip_crianza | Conservador para MVP con 1-2 check-ins/semana |
| Cooldown de 4 semanas por rec | Evita que el padre vea el mismo tip todas las semanas |
| Semana actual sin insights → card placeholder | Edge Function corre lunes para semana anterior; la semana actual no tiene insight hasta el próximo lunes |
| pet_health mínimo = 20 | La mascota nunca "muere" — línea roja del producto |
| Fuentes institucionales en cada tip | MINEDUC/UNICEF verificables — crítico para credibilidad con padres y clínicos |

---

## 7. Archivos que NO cambian

- `lib/pet-reactions.ts` — sin cambios
- `lib/theme.ts` — sin cambios
- `lib/notifications.ts` — sin cambios
- `components/SummaryCard.tsx` — sin cambios (ya soporta `detailContent`)
- `components/ScenarioCard.tsx` — sin cambios
- `components/EmotionPicker.tsx` — sin cambios
- `lib/emojis.ts` — sin cambios
- Todas las migraciones existentes (Phase 1, 2, 3)

---

## 8. Orden de implementación recomendado

```
1. lib/scenarios.ts        → agregar exports POSITIVE_CHOICES, NEGATIVE_CHOICES (5 min)
2. select-mascot.tsx       → agregar selector deporte (15 min)
3. checkin.tsx             → agregar refresh_pet_health al finalizar (5 min)
4. PetDisplay.tsx          → agregar prop healthScore opcional (5 min)
5. Edge Function           → reescribir motor de reglas (60 min)
6. summary.tsx             → consumir weekly_insights (45 min)
7. Verificar seed          → SELECT COUNT(*) FROM recommendations
8. Deploy Edge Function    → supabase functions deploy generate-weekly-summaries
9. Test manual             → GET /functions/v1/generate-weekly-summaries
10. Verificar UI           → abrir summary.tsx con datos de piloto
```

---

## 9. Edge cases a verificar

| Caso | Comportamiento esperado |
|------|------------------------|
| 0 check-ins en la semana | No se genera insight (edge function skip silencioso) |
| 1 solo check-in | Se genera insight, pero con 1 dato — tip_educativo probablemente gana |
| Solo 1 dimensión con datos | Las otras 4 dimensiones muestran "Sin datos esta semana" |
| Semana anterior sin datos (delta N/A) | `delta` queda `undefined` en el JSONB, UI no muestra flecha |
| Todas las recs en cooldown | Fallback: "¡Buena semana! Patrones estables." sin rec_id |
| Niño recién creado (primera semana) | No hay semana anterior → delta = undefined, sin cooldown previo |
| pet_health nunca inicializado | RPC crea la fila con defaults (score=100, streak=0) |

---

## 10. Verificación post-implementación

```sql
-- Ver insights generados
SELECT child_id, week_start, main_dato, active_days, total_checkins, computed_at
FROM weekly_insights ORDER BY computed_at DESC LIMIT 5;

-- Ver distribución de recomendaciones usadas
SELECT main_rec_id, COUNT(*) FROM weekly_insights
WHERE main_rec_id IS NOT NULL GROUP BY main_rec_id ORDER BY count DESC;

-- Ver pet_health actual de todos los niños
SELECT c.name, ph.health_score, ph.streak_days, ph.last_checkin
FROM pet_health ph JOIN children c ON c.id = ph.child_id;

-- Verificar que el catálogo de recomendaciones está completo
SELECT dimension, type, COUNT(*) FROM recommendations GROUP BY dimension, type ORDER BY dimension;
```
