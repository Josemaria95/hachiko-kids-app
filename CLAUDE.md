# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repo

App móvil **Hachiko Kids** — mascota virtual que ayuda a padres a entender patrones conductuales de sus hijos (4-12 años). El niño cuida a su mascota respondiendo escenarios conductuales; el padre recibe resúmenes semanales con patrones y tips accionables.

La documentación completa del proyecto (visión, mercado, personas, estrategia) vive en `/Users/jm95/Documents/hackia/proyectos/hachiko-kids/`.

**Estado**: MVP funcional desplegado. En fase piloto con familias.

## Stack

- **Mobile**: React Native (Expo ~54) + Expo Router ~6 + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Build/Deploy**: EAS Build (Android APK) + EAS Update (branch `preview`)
- **Fonts**: Fredoka + Inter (expo-google-fonts)
- **SVG**: `react-native-svg` — requerido para Luna y todos los íconos (dependencia nativa)

## Comandos de desarrollo

```bash
# Arrancar en modo dev (ejecutar desde la raíz del repo, NO hay subdirectorio app/)
npx expo start
npx expo start --ios
npx expo start --android

# Publicar update OTA (familias lo reciben sin reinstalar)
npx eas-cli update --branch preview --message "descripción"

# Nuevo build (solo si cambian dependencias nativas como react-native-svg)
npx eas-cli build --profile preview --platform android --non-interactive
```

> `.npmrc` tiene `legacy-peer-deps=true` — requerido para EAS Build. No eliminar.

## Arquitectura de pantallas

```
src/
├── _layout.tsx               ← Root: carga fuentes, auth listener (SIGNED_OUT → login)
├── index.tsx                 ← Routing inteligente: sin sesión → login; con sesión →
│                               si tiene hijos → checkin, si no → welcome-onboarding
├── (auth)/
│   └── login.tsx             ← Login + signup (crea fila en public.parents al hacer signup)
└── (app)/
    ├── welcome-onboarding.tsx ← Onboarding padre: 8 pasos (welcome → value-prop →
    │                            child-name → child-age → relationship → privacy →
    │                            loading [INSERT children] → handoff)
    ├── select-mascot.tsx     ← Elige color y nombre de Luna → UPDATE children
    ├── checkin.tsx           ← Flujo niño: mascot_care → scenario → emotion →
    │                            reaction → breathe → sticker → done_today
    └── summary.tsx           ← Dashboard semanal padres

lib/
├── supabase.ts          ← Cliente Supabase con SecureStore para tokens
├── scenarios.ts         ← 30 escenarios por dimensión conductual
├── pet-reactions.ts     ← Reacciones de Luna (reglas if/else, NO LLM)
├── theme.ts             ← Colores, fuentes, tema global
├── notifications.ts     ← Push notifications (resumen lunes 10am)
└── types/database.ts    ← Tipos TypeScript (MascotColor, etc.)

components/
├── LunaSvg.tsx          ← Mascota SVG: 5 moods × 5 colores con react-native-svg
├── PetDisplay.tsx       ← Wrapper: LunaSvg + animación float + glow opcional
├── EmotionPicker.tsx    ← 5 caras SVG (happy/neutral/sad/angry/scared)
├── ScenarioCard.tsx     ← Card escenario + 3 opciones con íconos SVG
├── SummaryCard.tsx      ← Card expandible (acepta `detailContent: ReactNode`)
└── EmojiText.tsx        ← Wrapper Text sin fontFamily (NO usar — ver gotchas)
```

## DB Schema (tablas core con columnas relevantes)

```sql
parents (
  id UUID PK,              -- = auth.users.id
  email TEXT NOT NULL,
  relationship TEXT,       -- 'Mamá','Papá','Abuelo·a','Tutor·a','Otro'
  consent_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT false
)

children (
  id UUID PK,
  parent_id UUID FK → parents(id),  -- FK a public.parents, NO a auth.users
  name TEXT NOT NULL,
  mascot_type TEXT NOT NULL,         -- CHECK: solo 'luna','gato','perro','conejo','panda'
  mascot_name TEXT NOT NULL,
  mascot_color TEXT DEFAULT 'purple', -- 'purple','blue','green','pink','orange'
  age_group TEXT NOT NULL,            -- '4-6' | '7-12'
  mascot_level SMALLINT DEFAULT 1
)

checkins (
  id UUID PK,
  child_id UUID FK → children(id),
  situation TEXT NOT NULL,
  situation_choice TEXT NOT NULL,
  emotion TEXT NOT NULL,             -- 'happy','sad','angry','scared','neutral'
  dimension TEXT NOT NULL,           -- 'instrucciones','socializacion','prosocial','regulacion','animo'
  check_date DATE NOT NULL           -- YYYY-MM-DD
)
```

RLS activo en todas las tablas. Políticas: cada usuario solo accede a sus propios datos.

## Flujo check-in diario

```
Niño abre app → mascot_care (3 care cards) → scenario (elige opción) →
  emotion (5 caras SVG) → reaction (mensaje mascota) →
  breathe (4 ciclos: inhala 3.5s → aguanta 1.5s → exhala 3.5s → descansa 1s) →
  sticker estrella → AsyncStorage marca día (key: checkin-{childId}-YYYY-MM-DD)
  Total: ~90 segundos

Lunes 10am → Push notification padre → summary.tsx
  → Dato + Acción → 5 SummaryCards por dimensión expandibles → navegación semanal ◀▶
```

## Variables de entorno

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Configuradas en EAS (environment: preview). Localmente en `.env`.

## Gotchas críticos

- **Emojis no renderizan** con fuentes custom (Fredoka/Inter) en React Native — ni con `EmojiText` (que omite fontFamily). Solución: usar siempre `react-native-svg` para íconos y caras.

- **FK parents → children**: `children.parent_id` apunta a `public.parents`, NO directamente a `auth.users`. Hay que crear la fila en `public.parents` ANTES de insertar un hijo. Se hace en `handleSignUp` (login.tsx) y en `handlePrivacyAccept` (welcome-onboarding.tsx).

- **CHECK constraint mascot_type**: Solo acepta `'luna'|'gato'|'perro'|'conejo'|'panda'`. Nunca insertar `'cat'` u otros valores.

- **checkins requiere `dimension` y `check_date`**: Son NOT NULL sin default. Siempre incluirlos en el INSERT.

- **react-native-svg es nativa**: Si se reinstala o agrega en un proyecto nuevo, requiere nuevo build EAS. No funciona solo con OTA update.

- **Routing loop**: Si `checkin.tsx` encuentra 0 hijos → redirige a `welcome-onboarding`. Si el INSERT de children falla silenciosamente, el usuario queda atrapado en loop. El loading step debe manejar errores explícitamente.

- **AsyncStorage de racha**: Clave `checkin-{childId}-YYYY-MM-DD`. Si el checkin del día ya está marcado, el niño va directo a `done_today` (sin flujo de escenario).

- **Nuevo build EAS necesario** solo si se agregan/cambian dependencias nativas.

## IDs de deploy

| Recurso | Valor |
|---------|-------|
| Expo project ID | `e46b24fb-84f8-4168-81ef-99dc6d4cee06` |
| EAS Update branch | `preview` |
| Android package | `com.jm95.hachikokids` |
| Supabase project | `zxwaxpattxlhxvqaawnq` |

## Líneas rojas (no negociables)

1. NUNCA vender datos de niños
2. NUNCA usar muerte/abandono de mascota como castigo
3. NUNCA mostrar contenido que genere culpa/ansiedad en padres o niños
4. NUNCA compartir datos individuales con colegios sin consentimiento explícito
5. Si se detecta riesgo severo (autolesión, abuso) → protocolo de crisis inmediato
