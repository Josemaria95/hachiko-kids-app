# Modelo de Datos — Hachiko Kids

> Última actualización: 2026-04-07
> Base de datos: Supabase PostgreSQL (`zxwaxpattxlhxvqaawnq`)

---

## Visión general

El modelo está organizado en **4 capas** que reflejan las fases de crecimiento del producto:

| Capa | Tablas | Para qué sirve |
|------|--------|----------------|
| **Core** | `parents`, `children`, `checkins`, `child_stickers`, `parent_sessions` | Flujo diario de la app: el niño cuida a Luna y responde escenarios |
| **Motor de Reglas** | `pet_health`, `recommendations`, `weekly_insights` | Genera los resúmenes semanales con tips verificados para padres |
| **Phase 2 — B2B Clínicas** | `subscriptions`, `organizations`, `org_members`, `org_child_consents`, `behavioral_alerts`, `shared_summary_links`, `weekly_summaries`, `clinician_notes` | Acceso de clínicos a datos de niños con consentimiento explícito |
| **Phase 3 — Colegios/PIE** | `school_groups`, `group_children`, `cohort_benchmarks`, `mineduc_reports`, `clinical_assessments` | Datos agrupados anonimizados para colegios y reportes Mineduc |

---

## Diagrama de relaciones

```
auth.users (Supabase Auth)
    │
    ├──[1:1]──► parents
    │               │
    │               ├──[1:N]──► children
    │               │               │
    │               │               ├──[1:N]──► checkins
    │               │               │               │
    │               │               │               └──[1:1]──► child_stickers
    │               │               │
    │               │               ├──[1:1]──► pet_health
    │               │               │
    │               │               └──[1:N]──► weekly_insights ──[N:1]──► recommendations
    │               │
    │               ├──[1:1]──► subscriptions
    │               │
    │               ├──[1:N]──► parent_sessions
    │               │
    │               ├──[1:N]──► behavioral_alerts
    │               │
    │               └──[1:N]──► shared_summary_links
    │
    └──[via org_members]──► organizations
                                │
                                ├──[1:N]──► org_members ──[N:1]──► auth.users
                                │
                                ├──[1:N]──► org_child_consents ──[N:1]──► children
                                │                               ──[N:1]──► parents
                                │
                                ├──[1:N]──► clinician_notes ──[N:1]──► children
                                │
                                ├──[1:N]──► school_groups
                                │               │
                                │               ├──[1:N]──► group_children ──[N:1]──► children
                                │               │
                                │               └──[1:N]──► cohort_benchmarks
                                │
                                └──[1:N]──► mineduc_reports
```

---

## Capa 1 — Core

### `parents`
El padre/madre/tutor. Se crea automáticamente al hacer signup, con el mismo `id` de `auth.users`.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | = `auth.users.id` |
| `email` | text | Email único |
| `relationship` | text | 'Mamá', 'Papá', 'Abuelo·a', etc. |
| `consent_at` | timestamptz | Cuándo aceptó los términos |
| `onboarding_completed` | boolean | Si terminó el onboarding |

---

### `children`
El niño. Un padre puede tener múltiples hijos (actualmente la app muestra solo el primero).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | — |
| `parent_id` | UUID FK → `parents` | **OJO**: apunta a `public.parents`, no a `auth.users` |
| `name` | text | Nombre del niño |
| `mascot_type` | text | Solo acepta `'luna'` (por ahora) |
| `mascot_name` | text | Nombre que el niño le puso a Luna |
| `mascot_color` | text | `'purple'` \| `'blue'` \| `'green'` \| `'pink'` \| `'orange'` |
| `age_group` | text | `'4-6'` \| `'7-12'` |
| `sport` | text | Deporte que practica (opcional, para personalización futura) |
| `mascot_level` | smallint | 1–5, sube cada 30 check-ins |
| `total_checkins` | integer | Contador acumulado, actualizado por trigger |
| `last_checkin_at` | timestamptz | Fecha del último check-in |

---

### `checkins`
El registro diario del niño. **Un check-in por día por niño** (enforced por índice único).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | — |
| `child_id` | UUID FK → `children` | — |
| `situation` | text | Texto del escenario presentado |
| `situation_choice` | text | Elección: `helps`, `refuses`, `delays`, `social`, `alone`, etc. |
| `emotion` | text | `'happy'` \| `'neutral'` \| `'sad'` \| `'angry'` \| `'scared'` |
| `dimension` | text | `'instrucciones'` \| `'socializacion'` \| `'prosocial'` \| `'regulacion'` \| `'animo'` |
| `check_date` | date | Generada automáticamente desde `created_at::date` |
| `micro_activity` | text | Actividad de regulación usada (`breathe`, `shake`, etc.) |
| `session_duration_ms` | integer | Duración de la sesión en ms |

**Clasificación de choices:**
- **Positivos**: `helps`, `social`, `one_friend`, `shares`, `compromises`, `regulates`, `great`
- **Negativos**: `refuses`, `alone`, `keeps`, `explodes`, `low`
- **Neutros**: `delays`, `withdraws`, `okay` ← estrategias válidas, no activan alertas

---

### `child_stickers`
Una estrella por día por niño. La app guarda en AsyncStorage como caché; esta tabla es la fuente de verdad.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `child_id` | UUID FK | — |
| `earned_date` | date | Un sticker máximo por día (UNIQUE) |
| `sticker_type` | text | `'star'` por defecto |
| `checkin_id` | UUID FK → `checkins` | El check-in que lo desbloqueó |

---

### `parent_sessions`
Tracking pasivo de cuando el padre abre la app. Útil para detectar desenganche.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `parent_id` | UUID FK | — |
| `screen` | text | `'checkin'` \| `'summary'` \| `'summary_prev'` |
| `started_at` | timestamptz | — |
| `duration_ms` | integer | Tiempo en pantalla |
| `platform` | text | `'ios'` \| `'android'` |

---

## Capa 2 — Motor de Reglas

### `recommendations`
Catálogo estático de 15 tips (seed del 2026-04-07). Cada regla define cuándo activarse.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | text PK | `'REC-001'` ... `'REC-015'` |
| `dimension` | text | Dimensión conductual a la que aplica |
| `type` | text | `'tip_crianza'` \| `'refuerzo_positivo'` \| `'tip_educativo'` |
| `priority` | integer | Menor número = mayor prioridad (1=urgente, 4=educativo) |
| `trigger_metric` | text | `'negative_rate'` \| `'positive_rate'` \| `'always'` |
| `trigger_op` | text | `'>='` \| `'<='` \| `'=='` |
| `trigger_value` | numeric | Umbral (ej: `0.4` = 40% de respuestas negativas) |
| `age_groups` | text[] | `['4-6', '7-12']` o solo uno |
| `text_dato` | text | Frase "Dato de la semana" que ve el padre |
| `text_accion` | text | Frase "Qué puedes hacer" |
| `source_name` | text | Fuente institucional (MINEDUC/UNICEF) |
| `cooldown_weeks` | integer | Semanas antes de poder repetir esta rec |

---

### `pet_health`
Estado de salud de la mascota. Una fila por niño, actualizada por la RPC `refresh_pet_health`.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `child_id` | UUID PK FK | — |
| `health_score` | integer | 0–100. **Mínimo 20** (la mascota nunca muere) |
| `streak_days` | integer | Racha actual de días consecutivos |
| `max_streak` | integer | Récord histórico de racha |
| `last_checkin` | date | Fecha del último check-in registrado |

**Reglas de salud:**
- Check-in hoy → +5 puntos
- 1 día sin check-in → -3 puntos
- 2 días → -5 puntos
- 3+ días → -8 puntos
- Racha de 7+ días → bonus +10 puntos

---

### `weekly_insights`
Output del motor de reglas. La Edge Function la escribe cada lunes; `summary.tsx` la lee.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `child_id` | UUID FK | — |
| `week_start` | date | Lunes de la semana (UNIQUE con child_id) |
| `main_rec_id` | text FK → `recommendations` | Rec principal seleccionada |
| `main_dato` | text | Texto del dato de la semana |
| `main_accion` | text | Texto de la acción recomendada |
| `main_source` | text | Fuente institucional |
| `active_days` | integer | Días con check-in esa semana |
| `total_checkins` | integer | Total de check-ins |
| `dimension_metrics` | jsonb | `{ instrucciones: { positive_rate, negative_rate, total, delta } }` |
| `emotion_summary` | jsonb | `{ dominant, variety, by_day[] }` |
| `dimension_insights` | jsonb | `{ instrucciones: { level, rec_id, tip, source } }` |
| `shown_rec_ids` | text[] | IDs de recs usadas esta semana (para cooldown) |

**Niveles en `dimension_insights`:**
- `normal` → negative_rate < 30%
- `atencion` → entre 30% y 60%
- `alerta` → más del 60%

---

## Capa 3 — Phase 2: B2B Clínicas

### `subscriptions`
Estado de suscripción B2C. Se crea automáticamente (trigger) cuando se crea un padre.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `parent_id` | UUID FK unique | — |
| `plan` | text | `'free'` \| `'premium'` |
| `status` | text | `'active'` \| `'trialing'` \| `'past_due'` \| `'canceled'` |
| `stripe_customer_id` | text | Para integración con Stripe |

---

### `organizations`
Clínicas o colegios que usan la plataforma B2B.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `slug` | text unique | Identificador URL-friendly |
| `org_type` | text | `'clinic'` \| `'school'` \| `'pie'` |
| `billing_plan` | text | `'pilot'` \| `'basic'` \| `'professional'` \| `'institutional'` |
| `features` | jsonb | Feature flags por organización |

---

### `org_members`
Personal de la organización (clínicos, coordinadores).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `org_id` | bigint FK | — |
| `user_id` | UUID FK → `auth.users` | — |
| `role` | text | `'admin'` \| `'clinician'` \| `'observer'` |

---

### `org_child_consents`
**Tabla crítica de privacidad.** Sin una fila aquí con `consent_granted=true`, ningún clínico puede ver datos del niño.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `org_id` | bigint FK | — |
| `child_id` | UUID FK | — |
| `parent_id` | UUID FK | — |
| `consent_granted` | boolean | **Debe ser true** para dar acceso |
| `granted_at` | timestamptz | Cuándo el padre aceptó |
| `revoked_at` | timestamptz | La revocación es inmediata |
| `invite_token` | text unique | Token para invitar al padre a dar consentimiento |

---

### `behavioral_alerts`
Alertas generadas cuando un patrón persiste 3+ semanas. **Las alertas `crisis` nunca se comparten con orgs B2B.**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `alert_type` | text | `'pattern_persists'` \| `'engagement_drop'` \| `'crisis'` |
| `severity` | text | `'low'` \| `'medium'` \| `'high'` \| `'crisis'` |
| `dimension` | text | Dimensión afectada |
| `message_es` | text | Mensaje en lenguaje conductual (sin diagnósticos) |

---

### `shared_summary_links`
Links de 30 días que el padre premium puede generar para compartir con un clínico.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `token` | text unique | 32 bytes aleatorios en hex |
| `weeks_count` | integer | Cuántas semanas incluye (1–52) |
| `expires_at` | timestamptz | 30 días por defecto |
| `revoked_at` | timestamptz | El padre puede revocar en cualquier momento |
| `access_count` | integer | Cuántas veces fue abierto |

---

### `clinician_notes`
Notas clínicas internas. **Nunca visibles para padres.**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `org_id` | bigint FK | — |
| `child_id` | UUID FK | — |
| `note_text` | text | Anotación libre del clínico |
| `is_flagged` | boolean | Marcada para revisión por el admin |

---

## Capa 4 — Phase 3: Colegios y PIE

### `school_groups`
Curso o programa dentro de un colegio. PIE usa `program_type = 'pie'` o `'pie_tea'`.

---

### `group_children`
Mapeo niño ↔ curso. Un niño puede estar en más de un grupo (curso normal + PIE).

---

### `cohort_benchmarks`
**Estadísticas anonimizadas del grupo.** K-anonimato enforced: si hay menos de 5 niños activos, los datos se suprimen. Los porcentajes se redondean al 5% más cercano.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `n_children` | smallint | Total de niños en el grupo |
| `pct_positive` | numeric | % de respuestas positivas (redondeado a 5%) |
| `pct_negative` | numeric | % de respuestas negativas |
| `suppressed` | boolean | `true` si n_children < 5 → stats son NULL |

---

### `clinical_assessments`
Evaluación estructurada con scoring 1–5 por dimensión. Correlacionado con SDQ. **Nunca visible para padres.**

---

### `mineduc_reports`
Snapshots de reportes en formato Mineduc para programas PIE. Se puede generar PDF guardado en Supabase Storage.

---

## Vistas y funciones clave

### Vista: `vw_weekly_summary`
Agrega check-ins por niño × semana × dimensión. La usa el dashboard de clínicos.

### RPC: `upsert_checkin`
Inserción idempotente de check-ins. Maneja el UNIQUE diario, asigna sticker automáticamente. El cliente debería llamar a esta función en lugar de hacer INSERT directo.

### RPC: `refresh_pet_health`
Recalcula `health_score` y `streak_days` basado en el historial de check-ins. La app la llama al finalizar cada check-in (fire-and-forget).

### Función: `is_parent_of_child(uuid)`
Helper de RLS. Verifica que el usuario autenticado sea el padre del niño dado. Usada en la mayoría de las políticas.

### Función: `has_consented_child_access(uuid)`
Verifica que haya consentimiento activo antes de dar acceso a datos de un niño desde un org B2B.

---

## Reglas de privacidad (no negociables)

1. Ningún dato individual de niños fluye a colegios u orgs sin `org_child_consents.consent_granted = true`
2. `behavioral_alerts` con `alert_type = 'crisis'` **nunca** son visibles para orgs B2B
3. `clinician_notes` y `clinical_assessments` **nunca** son visibles para padres
4. `cohort_benchmarks` solo contiene datos agregados y anonimizados (k≥5, redondeado a 5%)
5. `pet_health.health_score` nunca baja de 20 — la mascota no puede "morir"
