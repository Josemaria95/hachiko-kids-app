# Plan: Prototipo HTML del Onboarding de Padres — Hachiko Kids

## Contexto

Hachiko Kids hoy tiene un onboarding mínimo: login → nombrar mascota → checkin. No hay welcome slides, no hay explicación de valor, no hay consentimiento de privacidad, no hay transición padre→niño.

Se analizaron 30 capturas de **Bondu** (competidor: juguete IA companion) como referencia de flujo y diseño visual. Bondu tiene ~15 pasos de onboarding organizados en fases con fondos diferenciados, progreso visual, inputs grandes y bloques explicativos "Why is this important?".

**Objetivo**: Crear un prototipo HTML estático clickeable para validar el flujo de onboarding antes de implementarlo en la app React Native. El padre configura todo y al final le pasa el teléfono al niño.

## Entregable

**Archivo**: `content/pitch/onboarding-prototype.html` (single file, CSS+JS inline)

---

## Flujo: 8 pantallas en 3 fases

### Fase 1: Welcome (fondo blanco)

| # | Pantalla | Contenido |
|---|----------|-----------|
| 1 | Welcome | Luna (gato.png) + "Entiende a tu hijo a través de Luna" + "Tu hijo cuida una mascota virtual. Tú recibes patrones de su comportamiento cada semana." + botón "Siguiente" + footnote "Sin diagnósticos. Sin culpa. Solo claridad." |
| 2 | Propuesta de valor | 3 icon-bubbles (calendario, gráfico, foco) + "Resúmenes semanales con patrones" + "Cada lunes recibes tips accionables: qué patrón se repite, qué significa y qué puedes hacer esta semana." + botón "Empezar configuración" |

### Fase 2: Datos del niño (fondo crema `#FFF8F0`)

| # | Pantalla | Contenido | Validación |
|---|----------|-----------|------------|
| 3 | Nombre | "¿Cómo se llama tu hijo/a?" + input texto + info-block "Para personalizar la experiencia y que Luna lo llame por su nombre." | >= 2 caracteres |
| 4 | Edad | "¿Cuántos años tiene [nombre]?" + grid clickeable 4-12 + info-block "Adaptamos los escenarios y el lenguaje al nivel de desarrollo de [nombre]." | Siempre válido (default 7) |
| 5 | Relación | "¿Cuál es tu relación con [nombre]?" + chips: Mamá / Papá / Abuelo/a / Tutor/a / Otro + info-block "Para personalizar los tips y recomendaciones que recibas." | Chip seleccionado |

### Fase 2.5: Privacidad (fondo celeste `#F0F7FF`)

| # | Pantalla | Contenido |
|---|----------|-----------|
| 6 | Privacidad | "Los datos de [nombre] están seguros" + 4 bullets con íconos (nunca vender datos, sin etiquetas clínicas, solo tú ves la info, puedes eliminar todo) + botón mint "Acepto y continúo" |

### Fase 3: Transición (fondo gradiente purple claro)

| # | Pantalla | Contenido |
|---|----------|-----------|
| 7 | Loading | Luna flotando + "Preparando el mundo de Luna..." + barra de progreso animada (3s) + "Personalizando escenarios para [nombre]..." → auto-avanza |
| 8 | Handoff | Luna grande + "¡Pásale el teléfono a [nombre]!" + "Es hora de que [nombre] conozca a Luna" + botón orange "¡Empezar!" |

---

## Design System

### Colores (de `app/lib/theme.ts`)

```
--purple-50: #F0EDFF     --purple-500: #7B61FF    --purple-700: #5A3FD6
--mint-500: #34D399      --mint-50: #ECFDF5
--orange-500: #F97316    --orange-50: #FFF7ED
--dark: #1E1145          --gray-50: #F9FAFB       --gray-200: #E5E7EB    --gray-500: #6B7280
--cream: #FFF8F0         --blue-light: #F0F7FF
```

### Tipografía (Google Fonts)

- **Fredoka** (400/500/600/700): headings, botones, child-facing
- **Inter** (400/500/600): body, subtítulos, info-blocks

### Componentes clave

| Componente | Descripción |
|------------|-------------|
| `btn-primary` | purple-500, white text, border-radius 50px, padding 18px, full-width, sombra purple |
| `btn-accent` | orange-500 con sombra naranja — botón final "¡Empezar!" |
| `btn-mint` | mint-500 — consentimiento de privacidad |
| `chip` (edad/relación) | pill con borde gray-200; al seleccionar: borde purple-500, fondo purple-50 |
| `info-block` | fondo purple-50, border-radius 12px, padding 16px, ícono + texto explicativo |
| `text-input` | borde 2px gray-200, border-radius 14px, Fredoka 1.2rem, centrado, focus: borde purple |
| `progress-bar` | barra 4px en top, fill purple-500, transición 0.4s — visible solo pasos 3-6 |

### Layout

- `.phone-frame`: max-width 375px, centrado, min-height 100dvh
- Desktop (>420px): fondo purple-50, phone-frame con border-radius 32px y sombra (simula teléfono)
- Mobile (≤420px): full-width, sin bordes

### Animaciones

| Nombre | Descripción |
|--------|-------------|
| `float` | translateY oscilante para Luna |
| `fadeInUp` | entrada de contenido por pantalla |
| `fillBar` | width 0→100% en 3s en pantalla loading |
| transiciones de pantalla | opacity + translateX con 0.4s ease |

---

## JavaScript

### Estado

```js
const state = {
  currentStep: 0,
  childName: '',
  childAge: 7,
  relationship: null,
  loadingTimer: null,
}
```

### Funciones core

| Función | Responsabilidad |
|---------|----------------|
| `goToStep(n)` | Toggle clase `.active` entre screens, actualizar progress bar, si n===6 (loading) auto-advance 3.2s |
| `goBack()` | Navega al paso anterior |
| `updateName()` | On input → actualiza state + `injectName()` + toggle disabled en botón |
| `injectName()` | `querySelectorAll('[data-name]')` → textContent = nombre (fallback: "tu hijo/a") |
| `selectAge(age)` | Toggle selección visual en grid |
| `selectRelationship(rel)` | Toggle selección en chips + enable botón siguiente |
| `startLoading()` | Resetea y reanima la barra, auto-avanza a paso 7 tras 3.2s |
| `restartDemo()` | Resetea todo el estado para iterar desde paso 0 |

### Nombre dinámico

Todos los `[nombre]` en pantallas 4-8 usan `<span data-name>...</span>` que se actualizan con `injectName()` en tiempo real.

### Barra de navegación dev

Dots en la parte inferior para saltar entre pantallas durante sesiones de validación. No aparece en la app real.

---

## Archivos de referencia

| Archivo | Uso |
|---------|-----|
| `app/lib/theme.ts` | Colores y tokens exactos |
| `landing/index.html` | Patrones de animación y estilo |
| `landing/img/gato.png` | Imagen de Luna (path relativo desde prototype: `../../landing/img/gato.png`) |
| `content/flyers/flyer-clinica.html` | Design system más refinado del proyecto |
| `app/src/(app)/select-mascot.tsx` | Datos que se recolectan hoy (childName, mascotName, ageGroup) |

---

## Reglas de contenido (líneas rojas)

- Lenguaje **conductual**, nunca clínico ("patrones conductuales", NO "screening")
- Luna **nunca** muere/enferma/se va — siempre positiva
- **Nunca** vender datos de niños
- El niño **nunca** debe sentirse evaluado

---

## Checklist de verificación

- [ ] Las 8 pantallas navegan correctamente con botones
- [ ] Escribir un nombre → aparece dinámicamente en pantallas 4-8
- [ ] Progress bar solo visible en pasos 3-6
- [ ] Loading auto-avanza después de 3 segundos
- [ ] Responsive: mobile (375px) y desktop (pantalla completa con frame de teléfono)
- [ ] Imagen de Luna carga desde `../../landing/img/gato.png`
- [ ] Fallback SVG funciona si la imagen no carga

---

## Siguiente paso: implementar en React Native

Una vez validado el prototipo con usuarios reales, la implementación en app sigue este mapeo:

| Pantalla prototipo | Pantalla app |
|--------------------|-------------|
| 1-2 Welcome/Valor | `onboarding/welcome.tsx` (nueva) |
| 3-5 Datos del niño | Extender `select-mascot.tsx` con pasos adicionales |
| 6 Privacidad | `onboarding/privacy.tsx` (nueva) — guarda flag en Supabase `parents.consent_at` |
| 7-8 Loading/Handoff | `onboarding/handoff.tsx` (nueva) |

**DB changes necesarios** (para cuando se implemente):
- `parents`: agregar `relationship TEXT`, `consent_at TIMESTAMP`
- `children`: `age` ya existe como `age_group TEXT` — migrar a `age INTEGER` o mantener grupos
