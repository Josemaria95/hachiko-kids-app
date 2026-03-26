# Plan: Migración DB para nuevo flujo de usuarios Hachiko Kids

## Context

El flujo actual de la app es lineal (login → check-in conductual → resumen padres) sin distinción de roles, sin estado persistente de mascota, y sin onboarding real para padres. El nuevo flujo (diagrama Miro) introduce:

- **Modo niño por defecto** con PIN para acceso padre
- **Mascota con necesidades** (hambre, limpieza, felicidad) + microinteracciones de cuidado ANTES del check-in conductual
- **Onboarding padre** con clasificación de crianza (Baumrind) y rol (madre/padre/tutor)
- **Sugerencias de actividades** para padres recurrentes
- **Directorio de centros de salud mental** + flujo de referencia desde alertas conductuales
- **Vector conductual continuo** (5 dims, 0-10) acumulado por check-in → arquetipos de Luna (inspirado en Principal/moral-dilemma-tamagotchi)

Las migraciones Phase 2 y Phase 3 existentes se aplican sin cambios. Las nuevas migraciones se aplican después.

---

## Orden de aplicación

```
✅ 20260319000001_phase1_pilot_optimization     ← YA APLICADA
⏳ 20260319000002_phase2_premium_clinics         ← Aplicar tal cual
⏳ 20260319000003_phase3_schools_pie             ← Aplicar tal cual
🆕 20260320000001_parent_onboarding_mascot_state ← Nueva
🆕 20260320000002_activity_suggestions           ← Nueva
🆕 20260320000003_mental_health_centers          ← Nueva (depende de Phase 2: behavioral_alerts)
🆕 20260320000004_phase2_patches                 ← Parches post-Phase 2
🆕 20260320000005_conductual_stats_archetypes    ← Nueva (vector conductual + arquetipos Luna)
```

---

## Migration A: `20260320000001_parent_onboarding_mascot_state.sql`

### 1. Extender `parents` para onboarding

```sql
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS:
  - role text CHECK (role IN ('madre','padre','tutor'))
  - display_name text
  - parenting_style text CHECK (IN ('autoritario','democratico','permisivo','negligente','no_clasificado'))
  - parent_pin text  -- hash del PIN 4 dígitos para modo padre
  - onboarding_completed boolean DEFAULT false
  - updated_at timestamptz DEFAULT now()
```

- Trigger `set_updated_at()` (crear si no existe, Phase 2 también lo crea — usar `CREATE OR REPLACE`)
- Backfill: `UPDATE parents SET onboarding_completed = true WHERE EXISTS (SELECT 1 FROM children WHERE parent_id = parents.id)`
- Partial index: `idx_parents_not_onboarded ON parents (id) WHERE onboarding_completed = false`

### 2. Tabla `parenting_quiz_responses`

```sql
parenting_quiz_responses (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  parent_id uuid NOT NULL UNIQUE FK → parents ON DELETE CASCADE,
  -- 6 preguntas Baumrind, respuesta 1-5 (Likert)
  q1_demands smallint CHECK (BETWEEN 1 AND 5),
  q2_responsiveness smallint CHECK (BETWEEN 1 AND 5),
  q3_autonomy smallint CHECK (BETWEEN 1 AND 5),
  q4_warmth smallint CHECK (BETWEEN 1 AND 5),
  q5_control smallint CHECK (BETWEEN 1 AND 5),
  q6_communication smallint CHECK (BETWEEN 1 AND 5),
  computed_style text,  -- resultado calculado
  created_at timestamptz DEFAULT now()
)
```

- RLS: `parent_id = (SELECT auth.uid())`
- RPC `compute_parenting_style(p_parent_id)`: calcula estilo desde respuestas y actualiza `parents.parenting_style`

### 3. Agregar `mascot_color` a `children`

```sql
ALTER TABLE children ADD COLUMN IF NOT EXISTS mascot_color text DEFAULT 'purple'
  CHECK (IN ('purple','blue','green','pink','orange'))
```

### 4. Tabla `mascot_states` (1:1 con children)

```sql
mascot_states (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  child_id uuid NOT NULL UNIQUE FK → children ON DELETE CASCADE,
  hunger smallint DEFAULT 80 CHECK (BETWEEN 0 AND 100),
  cleanliness smallint DEFAULT 80 CHECK (BETWEEN 0 AND 100),
  happiness smallint DEFAULT 80 CHECK (BETWEEN 0 AND 100),
  last_decay_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

- **Decay**: función `apply_mascot_decay(p_child_id)` — SECURITY DEFINER
  - Calcula horas desde `last_decay_at`
  - Decay: ~5 puntos por 8 horas, floor en 10 (NUNCA llega a 0 — Luna nunca muere)
  - Max decay total: 70 puntos (3+ días sin entrar)
- **Trigger**: `on_child_created()` — auto-insert `mascot_states` al crear hijo
- **Backfill**: insertar estado para hijos existentes
- Index: `idx_mascot_states_child ON mascot_states (child_id)` (ya es UNIQUE pero explícito para RLS joins)

### 5. Tabla `mascot_interactions`

```sql
mascot_interactions (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  child_id uuid NOT NULL FK → children ON DELETE CASCADE,
  action text NOT NULL CHECK (IN ('feed','wash','play','clean')),
  need_type text NOT NULL CHECK (IN ('hunger','cleanliness','happiness')),
  need_before smallint CHECK (BETWEEN 0 AND 100),
  need_after smallint CHECK (BETWEEN 0 AND 100),
  created_at timestamptz DEFAULT now()
)
```

- RPC `perform_mascot_action(p_child_id, p_action)` — SECURITY DEFINER
  - Mapeo: feed→hunger+25, wash→cleanliness+30, play/clean→happiness+20
  - `SELECT ... FOR UPDATE` en mascot_states (evita race conditions)
  - Loguea en mascot_interactions
  - Retorna mascot_states actualizado
- Index: `idx_mascot_interactions_child ON (child_id, created_at DESC)`

### 6. RLS para tablas nuevas

Todas con `ENABLE ROW LEVEL SECURITY`:
- `mascot_states`: SELECT/INSERT/UPDATE usando `is_parent_of_child(child_id)`
- `mascot_interactions`: SELECT/INSERT usando `is_parent_of_child(child_id)`
- `parenting_quiz_responses`: SELECT/INSERT/UPDATE usando `parent_id = (SELECT auth.uid())`

---

## Migration B: `20260320000002_activity_suggestions.sql`

### 1. Tabla `activity_catalog` (catálogo de actividades)

```sql
activity_catalog (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  slug text UNIQUE NOT NULL,
  title_es text NOT NULL,
  description_es text NOT NULL,
  dimension text CHECK (IN dimensiones),
  age_group text CHECK (IN ('4-6','7-12','all')),
  duration_min smallint DEFAULT 15 CHECK (BETWEEN 5 AND 120),
  difficulty text DEFAULT 'easy' CHECK (IN ('easy','medium','hard')),
  materials_es text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)
```

- Partial index: `idx_activity_catalog_active ON (dimension, age_group) WHERE is_active = true`
- RLS: SELECT para todos los authenticated
- Seed: 5 actividades iniciales (1 por dimensión)

### 2. Tabla `activity_suggestions` (por padre/hijo)

```sql
activity_suggestions (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  parent_id uuid FK → parents,
  child_id uuid FK → children,
  activity_id bigint FK → activity_catalog,
  status text DEFAULT 'pending' CHECK (IN ('pending','shown','completed','dismissed')),
  shown_at timestamptz,
  completed_at timestamptz,
  dismissed_at timestamptz,
  feedback_rating smallint CHECK (BETWEEN 1 AND 5),
  week_start date,
  created_at timestamptz DEFAULT now(),
  UNIQUE (child_id, activity_id, week_start)
)
```

- Partial index: `idx_suggestions_pending ON (parent_id, status, created_at DESC) WHERE status IN ('pending','shown')`
- RPC `generate_activity_suggestions(p_child_id, p_week_start)`: genera hasta 3 por semana, filtrado por age_group
- RLS: parent_id = (SELECT auth.uid())

---

## Migration C: `20260320000003_mental_health_centers.sql`

### 1. Tabla `mental_health_centers` (directorio manual)

```sql
mental_health_centers (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  name text NOT NULL,
  address text NOT NULL,
  city text DEFAULT 'Santiago',
  region text DEFAULT 'Metropolitana',
  country text DEFAULT 'CL',
  lat numeric(10,7),
  lng numeric(10,7),
  phone text,
  email text,
  website text,
  specialties text[] DEFAULT '{}',     -- {'infantil','familiar','TEA'}
  accepts_fonasa boolean DEFAULT false,
  accepts_isapre boolean DEFAULT false,
  is_public boolean DEFAULT false,      -- CESFAM, hospital público
  opening_hours text,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

- Partial index: `idx_centers_city_active ON (city) WHERE is_active = true`
- Index: `idx_centers_location ON (lat, lng) WHERE is_active AND lat IS NOT NULL`
- RLS: SELECT para authenticated WHERE is_active = true
- Seed: ~20 centros verificados en Santiago/RM

### 2. Tabla `center_referrals` (tracking de sugerencias)

```sql
center_referrals (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  parent_id uuid FK → parents,
  child_id uuid FK → children,
  center_id bigint FK → mental_health_centers,
  alert_id bigint FK → behavioral_alerts (nullable),
  status text DEFAULT 'suggested' CHECK (IN ('suggested','viewed','contacted','visited','dismissed')),
  suggested_at timestamptz DEFAULT now(),
  viewed_at, contacted_at, visited_at, dismissed_at timestamptz,
  parent_notes text,
  created_at timestamptz DEFAULT now()
)
```

- NO comparte datos con el centro — solo trackea acciones del padre
- Indexes: parent_id, child_id+status (partial WHERE NOT dismissed), alert_id
- RLS: parent_id = (SELECT auth.uid())

### 3. Extender `behavioral_alerts`

```sql
ALTER TABLE behavioral_alerts ADD COLUMN IF NOT EXISTS:
  - center_suggested boolean DEFAULT false
  - center_suggested_at timestamptz
```

### 4. RPC `suggest_centers_for_alert(p_alert_id, p_city, p_limit)`

- Verifica ownership del alert
- Marca alert como `center_suggested = true`
- Retorna centros activos en la ciudad, priorizando verificados

---

## Migration D: `20260320000004_phase2_patches.sql`

### 1. Reemplazar trigger `on_checkin_upsert` para boost de mascota + stats conductuales

Al completar check-in, la función hace tres cosas:

```sql
CREATE OR REPLACE FUNCTION on_checkin_with_mascot_boost() ...
  UPDATE children SET total_checkins, last_checkin_at, mascot_level ...
  UPDATE mascot_states SET happiness = LEAST(100, happiness + 5) ...
  -- también llama update_conductual_stats() con el delta de la dimensión del escenario
  SELECT update_conductual_stats(NEW.child_id, dimension_from_scenario(NEW.situation), delta_from_emotion(NEW.emotion))
```

Las funciones auxiliares:
- `dimension_from_scenario(situation text) → text`: mapea el campo `situation` (que ya codifica la dimensión, ej. `'instrucciones_*'`) al eje conductual correspondiente
- `delta_from_emotion(emotion text) → smallint`: mapea la emoción al delta (+1 positiva, -1 negativa, 0 neutral)

### 2. Expandir CHECK de `parent_sessions.screen`

Agregar: `'onboarding', 'mascot_care', 'activity', 'centers'`

---

## Migration E: `20260320000005_conductual_stats_archetypes.sql`

> Inspirado en el modelo `moralStats` (0-10, 6 dims) de Principal/moral-dilemma-tamagotchi.
> Mismo patrón, adaptado a las 5 dimensiones conductuales del SDQ.

### 1. Tabla `child_conductual_stats` (1:1 con children)

```sql
child_conductual_stats (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  child_id uuid NOT NULL UNIQUE FK → children ON DELETE CASCADE,
  instrucciones numeric(4,2) DEFAULT 5.0 CHECK (BETWEEN 0 AND 10),  -- no sigue ↔ sigue bien
  socializacion numeric(4,2) DEFAULT 5.0 CHECK (BETWEEN 0 AND 10),  -- solitario ↔ muy social
  prosocial    numeric(4,2) DEFAULT 5.0 CHECK (BETWEEN 0 AND 10),   -- no comparte ↔ comparte
  regulacion   numeric(4,2) DEFAULT 5.0 CHECK (BETWEEN 0 AND 10),   -- desborda ↔ regula bien
  animo        numeric(4,2) DEFAULT 5.0 CHECK (BETWEEN 0 AND 10),   -- bajo ↔ alto
  total_samples integer DEFAULT 0,   -- check-ins acumulados (para ponderar)
  luna_archetype text DEFAULT 'equilibrada'
    CHECK (IN ('exploradora','cuidadora','tranquila','luchadora','equilibrada')),
  archetype_updated_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

- Trigger `set_updated_at()` al modificar
- Trigger `on_child_created()`: auto-insert con defaults al crear hijo
- Backfill: insertar para hijos existentes
- RLS: SELECT/UPDATE usando `is_parent_of_child(child_id)`
- Index: ya cubierto por UNIQUE en child_id

### 2. RPC `update_conductual_stats(p_child_id, p_dimension, p_delta)` — SECURITY DEFINER

```sql
-- p_dimension: 'instrucciones' | 'socializacion' | 'prosocial' | 'regulacion' | 'animo'
-- p_delta: -1 | 0 | 1  (derivado de emoción del check-in)
-- Lógica: EMA (exponential moving average) con α=0.15 para suavizar señal
--   nuevo_valor = viejo * (1 - α) + (5 + p_delta * 2.5) * α
--   Clamp entre 0 y 10
-- También incrementa total_samples y llama compute_luna_archetype()
```

### 3. RPC `compute_luna_archetype(p_child_id)` — SECURITY DEFINER

Árbol de arquetipos (análogo al árbol de evolución de Principal):

```
Dimensión dominante (valor > 7.0):
  socializacion alta  → 'exploradora'   (Luna Exploradora)
  prosocial alta      → 'cuidadora'     (Luna Cuidadora)
  regulacion alta     → 'tranquila'     (Luna Tranquila)
  instrucciones < 3.0 AND regulacion < 3.0 → 'luchadora'  (Luna Luchadora)
  ninguna dominante   → 'equilibrada'   (Luna Equilibrada — fallback positivo)

Actualiza children.luna_archetype + archetype_updated_at
```

> **Regla crítica**: todos los arquetipos son positivos. 'Luchadora' = "tiene mucha energía", no "problema". El lenguaje clínico NUNCA llega al niño.

### 4. Agregar `luna_archetype` a `children`

```sql
ALTER TABLE children ADD COLUMN IF NOT EXISTS luna_archetype text DEFAULT 'equilibrada'
  CHECK (IN ('exploradora','cuidadora','tranquila','luchadora','equilibrada'))
```

### 5. RLS

- `child_conductual_stats`: SELECT/INSERT/UPDATE con `is_parent_of_child(child_id)`

---

## Flujo completo resultante (nuevo)

```
Login (email) → App siempre abre en MODO NIÑO
  │
  ├── Niño (default):
  │   1. apply_mascot_decay() → Luna saluda con estado actual + badge de arquetipo
  │   2. Luna indica necesidad (la más baja de hunger/cleanliness/happiness)
  │   3. Microinteracción: feed/wash/play (~30s) → perform_mascot_action()
  │   4. Luna dice "gracias" → mascota feliz
  │   5. Escenario conductual (flujo actual) → upsert_checkin()
  │   6. Emoción → Reacción → update_conductual_stats() → Respirar(opcional) → Sticker
  │      (si arquetipo cambia en este check-in → animación de evolución)
  │   Total: ~90-120s
  │
  ├── Padre (PIN 4 dígitos):
  │   ├── Primera vez:
  │   │   1. Onboarding: rol + display_name
  │   │   2. Quiz Baumrind (6 preguntas) → compute_parenting_style()
  │   │   3. Explicación menú
  │   │   4. Onboarding hijo: nombre + edad + color mascota
  │   │   5. → Dashboard
  │   │
  │   └── Recurrente:
  │       1. generate_activity_suggestions() → sugerencia de actividad
  │       2. Dashboard principal (resumen semanal)
  │       3. Si hay alertas con severity >= high → suggest_centers_for_alert()
  │
  └── Crisis flow:
      behavioral_alert(type='crisis') → sugerencia centro de salud mental
      → center_referrals tracking → Fono Infancia 800-200-818
```

---

## Archivos críticos a modificar (frontend, post-migraciones)

| Archivo | Cambio |
|---------|--------|
| `src/index.tsx` | Quitar redirect a login; siempre ir a modo niño si hay sesión |
| `src/(app)/checkin.tsx` | Agregar paso mascot-care antes del escenario; llamar `apply_mascot_decay` + `perform_mascot_action`; mostrar animación de evolución si cambia arquetipo |
| `src/(app)/select-mascot.tsx` | Agregar selector de color; integrar con onboarding padre |
| `src/(auth)/login.tsx` | Post-login: ir a modo niño, no a checkin |
| `lib/pet-reactions.ts` | Leer `mascot_states` para renderizar indicadores de necesidades; leer `luna_archetype` para personalizar reacciones por arquetipo |
| `lib/scenarios.ts` | Asegurar que cada escenario tiene campo `dimension` (mapeado al eje conductual) para que `dimension_from_scenario()` funcione |
| `components/PetDisplay.tsx` | Mostrar barras de necesidades (hunger/cleanliness/happiness) + badge de arquetipo ("Luna Exploradora") |
| `src/types/database.ts` | Agregar tipos: MascotState, MascotInteraction, ChildConductualStats, ActivityCatalog, MentalHealthCenter, etc. |
| **Nuevas pantallas** | `src/(app)/mascot-care.tsx`, `src/(app)/parent-pin.tsx`, `src/(app)/onboarding.tsx`, `src/(app)/activities.tsx`, `src/(app)/centers.tsx` |

---

## Verificación

1. **Aplicar Phase 2 y 3** via `mcp__supabase__apply_migration`
2. **Aplicar Migrations A-E** via `mcp__supabase__apply_migration`
3. **Verificar** con `mcp__supabase__list_tables` que todas las tablas existen con RLS enabled
4. **Test RPCs** via `mcp__supabase__execute_sql`:
   - `SELECT apply_mascot_decay('child-uuid')`
   - `SELECT perform_mascot_action('child-uuid', 'feed')`
   - `SELECT generate_activity_suggestions('child-uuid')`
   - `SELECT update_conductual_stats('child-uuid', 'socializacion', 1)`
   - `SELECT compute_luna_archetype('child-uuid')` → debe retornar uno de los 5 arquetipos
5. **Verificar EMA**: hacer 10 llamadas a `update_conductual_stats` con delta=1 en misma dim → valor debe converger gradualmente, no saltar
6. **Verificar RLS** intentando acceder datos sin auth (debe fallar)
7. **Verificar indexes** con `mcp__supabase__get_advisors`

---

## Hoja de ruta Fase 2 (post-piloto)

> Validado por el repo Principal: GPT-4o-mini es viable incluso a escala de free tier para evaluación semántica ligera.

### 1. Reemplazar if/else por GPT-4o-mini en reacciones de Luna

El MVP usa `pet-reactions.ts` con reglas fijas. Con ~900 check-ins del piloto (30 niños × 30 días), migrar a:
- Input: `{ situation, emotion, conductual_stats, luna_archetype }`
- Output: reacción personalizada al arquetipo actual + delta de dimensión calculado por el modelo
- Costo estimado: GPT-4o-mini ~$0.0001/call → insignificante a escala piloto

### 2. Acumular dataset propio

Cada check-in es un dato etiquetado:
```
{ situation, emotion, dimension, delta_aplicado, arquetipo_resultante }
```
Con 30 niños × 90 días = ~2.700 registros iniciales en español LATAM.
Publicar dataset anonimizado (con consentimiento explícito en onboarding) sería diferenciador único frente a datasets anglosajones.

### 3. Correlación SDQ

Con suficientes muestras, `child_conductual_stats` puede correlacionarse con el SDQ formal completado por padres → validación clínica del instrumento.

---

## Best practices aplicadas (Supabase Postgres)

- `(SELECT auth.uid())` en todas las RLS policies (cached, no per-row)
- `SECURITY DEFINER` + `SET search_path = public` en funciones helper
- `bigint GENERATED ALWAYS AS IDENTITY` para PKs de tablas nuevas (no UUID v4)
- Partial indexes en queries filtradas (`WHERE is_active = true`, `WHERE status IN (...)`)
- `text` con CHECK constraints para enums
- `timestamptz` en todos los timestamps
- `FOR UPDATE` en operaciones de mascota (prevent race conditions)
- UPSERT pattern (`ON CONFLICT DO UPDATE/NOTHING`) para idempotencia
- Indexes en todas las FK columns y columnas usadas en RLS
- Transacciones cortas (sin llamadas externas dentro de funciones DB)
