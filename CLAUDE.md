# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repo

App móvil **Hachiko Kids** — mascota virtual que ayuda a padres a entender patrones conductuales de sus hijos (4-12 años). El niño cuida a su mascota respondiendo escenarios conductuales; el padre recibe resúmenes semanales con patrones y tips accionables.

La documentación completa del proyecto (visión, mercado, personas, estrategia) vive en `/Users/jm95/Documents/hackia/proyectos/hachiko-kids/`. El CLAUDE.md de ese directorio tiene contexto completo de negocio.

**Estado**: MVP funcional desplegado. En fase piloto con familias.

## Stack

- **Mobile**: React Native (Expo ~54) + Expo Router ~6 + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Build/Deploy**: EAS Build (Android APK) + EAS Update (branch `preview`)
- **Fonts**: Fredoka + Inter (expo-google-fonts)

## Comandos de desarrollo

```bash
# Arrancar en modo dev
cd app && npx expo start

# Target específico
cd app && npx expo start --android

# Publicar update OTA (familias lo reciben sin reinstalar)
cd app && npx eas-cli update --branch preview --message "descripción"

# Nuevo build (solo si cambian dependencias nativas)
cd app && npx eas-cli build --profile preview --platform android --non-interactive
```

> `.npmrc` tiene `legacy-peer-deps=true` — requerido para EAS Build. No eliminar.

## Arquitectura de pantallas

```
src/
├── _layout.tsx          ← Root: carga fuentes, auth listener (SIGNED_OUT → login), push notifications
├── index.tsx            ← Redirect a login
├── (auth)/
│   └── login.tsx        ← Login + signup en mismo archivo
└── (app)/
    ├── checkin.tsx      ← Flujo principal niño (escenario → emoción → reacción mascota → respirar → sticker)
    ├── select-mascot.tsx ← Nombrar a Luna (mascota única)
    └── summary.tsx      ← Dashboard semanal padres

lib/
├── supabase.ts          ← Cliente Supabase con SecureStore para tokens
├── scenarios.ts         ← Escenarios por dimensión conductual
├── pet-reactions.ts     ← Reacciones de Luna (reglas if/else, NO LLM)
├── theme.ts             ← Colores, fuentes, tema global
├── notifications.ts     ← Push notifications (resumen lunes 10am)
└── emojis.ts            ← Emojis para emotion picker

components/
├── PetDisplay.tsx       ← Luna con 5 estados: happy, sad, angry, scared, neutral
├── EmotionPicker.tsx    ← Selector de emoción (5 opciones)
├── ScenarioCard.tsx     ← Tarjeta de escenario conductual
└── SummaryCard.tsx      ← Card expandible (acepta `detailContent: ReactNode`)
```

## DB Schema (3 tablas core)

```sql
parents   (id UUID PK, email TEXT UNIQUE, created_at TIMESTAMP)
children  (id UUID PK, parent_id UUID FK, name TEXT, mascot_type TEXT, mascot_name TEXT, age_group TEXT, created_at TIMESTAMP)
checkins  (id UUID PK, child_id UUID FK, situation TEXT, situation_choice TEXT, emotion TEXT, created_at TIMESTAMP)
-- emociones válidas: 'happy', 'sad', 'angry', 'scared', 'neutral'
```

Schema completo con RLS en `app/supabase-schema.sql`.

## Flujo check-in diario

```
Niño abre app → Escenario → Elige → Emoji emoción → POST /checkins
  → Reacción mascota → Opción "Respirar con Luna" (4 ciclos) o "Siguiente"
  → Sticker estrella → AsyncStorage marca día (key: checkin-{childId}-YYYY-MM-DD)
  Total: ~90 segundos

Lunes 10am → Push notification padre → summary.tsx
  → Dato + Acción (arriba) → 5 cards por dimensión expandibles → navegación semanal ◀ ▶
```

## Variables de entorno

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Configuradas en EAS (environment: preview). Localmente en `app/.env`.

## Convenciones críticas

- **Lenguaje de UI para padres**: siempre conductual ("no sigue instrucciones"), NUNCA clínico ("déficit atencional")
- **El niño nunca se siente evaluado** — todo es juego con la mascota
- **Luna nunca muere, se enferma ni se va** — siempre positiva
- **Sesiones cortas**: 60-90 seg (4-6 años) / 90-180 seg (7-12 años)
- **Emojis no funcionan** con fuentes custom (Fredoka/Inter) en React Native — usar `View` components con colores
- Reacciones de mascota: lógica if/else simple en `pet-reactions.ts`, no requiere LLM
- Nuevo build EAS necesario solo si se agregan/cambian dependencias nativas

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
