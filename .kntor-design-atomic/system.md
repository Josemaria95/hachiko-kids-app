# Hachiko Kids — Design System
_Last updated: 2026-03-27_

---

## Intent

**Who:** Padres y madres (28–42 años) con teléfono en mano. Poco tiempo, algo de escepticismo, mucha esperanza respecto a entender a sus hijos.

**What they do:** Configurar la app, recibir resúmenes semanales, entender patrones conductuales de sus hijos.

**How it should feel:** Cálido como una conversación con una psicóloga amable. Progresivo en confianza. Sin jerga clínica. Sin culpa.

---

## Tokens

### Colors
```
Primary:   purple[500] #7B61FF  — acción principal, selección activa
           purple[50]  #F0EDFF  — fondos de info-blocks y bubbles
           purple[700] #5A3FD6  — texto sobre purple[50], estados hover
           purple[100] #D4CCFF  — fondo suave transición (loading/handoff)

Secondary: mint[500]   #34D399  — confirmación, consentimiento
           mint[50]    #ECFDF5  — fondos secundarios

Accent:    orange[500] #F97316  — CTA hijo, handoff, energía
           orange[50]  #FFF7ED  — badge background

Surfaces:
  white    #FFFFFF  — pantallas de bienvenida y valor
  bgCream  #FFF8F0  — fase de recolección de datos
  bgBlueLt #F0F7FF  — pantalla de privacidad
  softPurple purple[100] — pantallas de transición (loading, handoff)

Text:
  dark     #1E1145  — headings
  gray[700] #374151 — cuerpo principal
  gray[500] #6B7280 — subtexto, labels
  gray[300] #D1D5DB — placeholders

Alerts:
  red[500]    — "nunca vendemos datos"
  mint[500]   — "solo tú ves la info"
  orange[500] — "puedes eliminar todo"
```

### Typography
```
Display:      Fredoka            — headings, labels de chip, CTAs
DisplaySemiBold: Fredoka-SemiBold
DisplayBold:  Fredoka-Bold       — headings principales

Body:         Inter              — texto largo, descripciones
BodyMedium:   Inter-Medium
BodySemiBold: Inter-SemiBold
```
> **Regla crítica:** Emojis NO funcionan con Fredoka/Inter en React Native. Usar componentes View-based para iconos.

### Spacing base unit: 4px
```
4   — gap interno mínimo
8   — gap entre elementos relacionados
12  — gap entre chips, items de lista
14  — padding interno de cards/bubbles
16  — padding estándar de inputs
20  — padding horizontal de chips grandes
24  — padding horizontal de página
28  — padding horizontal de pantallas centradas
32  — margen de sección
44  — padding bottom seguro (bottom safe area)
```

### Radii
```
50px — pills (botones, chips de relación)
18px — back button (circle)
16px — cards, bubbles
14px — age chips, info-blocks, privacy items, inputs
12px — tags, badges pequeños
4px  — separadores, barras
```

### Shadows
```
Pill button:    shadowColor=variant, offset(0,4), opacity=0.22, radius=10, elevation=5
Input focused:  shadowColor=purple[500], offset(0,0), opacity=0.12, radius=6, elevation=2
Cards:          offset(0,2), opacity=0.06, radius=8, elevation=2
```

---

## Atoms

### `PillButton`
```
Props: label, variant (purple|mint|orange), disabled, onPress
Border-radius: 50
Padding: 18px vertical
Font: Fredoka-Bold 17px, color white, letterSpacing 0.2
Disabled: opacity 0.38, sin sombra
Shadow: shadowColor según variant (purple[700] | mint[700] | orange[700])
Estados: pressed → opacity 0.88
```

### `BackButton`
```
Position: absolute top=20 left=16, zIndex=50
Size: 36×36, borderRadius=18
Background: rgba(255,255,255,0.82)
Content: "←" fontSize=18, color gray[700]
Visible en: steps value-prop → privacy (no en welcome, loading, handoff)
```

### `ProgressBar`
```
Track: height=4, borderRadius=2, backgroundColor=gray[200], marginHorizontal=24
Fill: backgroundColor=purple[500], animated width con Animated.timing 380ms
Visible solo en PROGRESS_STEPS: child-name (25%), child-age (50%), relationship (75%), privacy (100%)
```

### `InfoBlock`
```
Background: purple[50], borderRadius=14, padding=14
Layout: row, gap=10
Icon: View-based lightbulb (bulbTop 12×12 circle + bulbBase 8×5 rect, color purple[300])
Text: fontSize=13, Inter, color=purple[700], lineHeight=19
Margin top: 14
```

---

## Molecules

### `ValueBubble`
```
Layout: row, alignItems=flex-start, gap=14
Background: purple[50], borderRadius=16, padding=14, marginBottom=12
Icon zone: 40×40, view-based icons (calendar | chart | target)
Title: Fredoka-SemiBold 15px, color dark, marginBottom=3
Desc: Inter 13px, color gray[500], lineHeight=19
```

**Iconos view-based para ValueBubble:**
- `calendar` → header rect (purple[300]) + 2 lines (purple[200])
- `chart` → 4 bars distintas alturas (purple[200/300/500/700])
- `target` → 3 círculos concéntricos anidados (orange[300/500])

### `AgeChip`
```
Layout: 3 columnas (width "30%"), flexWrap
Padding: 14px vertical
BorderRadius: 14, borderWidth=2
Default: borderColor=gray[200], bg=white
Selected: borderColor=purple[500], bg=purple[50]
Content: número (Fredoka-Bold 24px) + "años" (Inter 10px uppercase, letterSpacing=0.5)
Selected text: number=purple[700], label=purple[500]
```

### `RelChip`
```
Padding: 13px vertical, 22px horizontal
BorderRadius: 50 (pill)
Default: borderColor=gray[200], bg=white
Selected: borderColor=purple[500], bg=purple[50]
Font: Fredoka 15px
Sin emojis (incompatibilidad con fuentes custom en RN)
```

### `PrivacyItem`
```
Layout: row, gap=12
Background: rgba(255,255,255,0.65) — translúcido sobre bgBlueLight
BorderRadius: 14, padding=14, marginBottom=10
Dot indicator: 10×10 circle, color semántico por item
Title: Fredoka-SemiBold 14px, color dark
Desc: Inter 12px, color gray[500], lineHeight=17

Contenido canónico (en orden):
  red[500]    "Nunca vendemos datos de niños"
  purple[500] "Sin etiquetas clínicas"
  mint[500]   "Solo tú ves la información"
  orange[500] "Puedes eliminar todo"
```

---

## Organisms

### `LoadingBar`
```
Track: height=8, borderRadius=50, bg=rgba(123,97,255,0.18)
Fill: bg=purple[500], animated width Animated.timing 3000ms
Label: Inter 13px, color=purple[700], fade-in a los 600ms, incluye nombre del niño
```

### `PetDisplay` (reutilizado de components/)
```
Props: mood, name, size, showName, mascotColor
Usos en onboarding:
  Welcome:  size=160, showName=false
  ChildName: size=100, showName=false (encima del input)
  Loading:  size=180, showName=false + float animation (translateY ±10, 900ms loop)
  Handoff:  size=200, showName=false
```

---

## Templates

### Pantalla centrada (welcome, loading, handoff)
```
flex: 1
┌─────────────────────────┐
│   [centered: flex=1]    │ → PetDisplay + heading + subtext / loading bar
│                         │
│   [bottom: pb=44]       │ → PillButton + footnote
└─────────────────────────┘
paddingHorizontal centrado: 28px
```

### Pantalla de formulario (child-name, child-age, relationship, privacy)
```
flex: 1
┌─────────────────────────┐
│ [BackButton absolute]   │
│ [ProgressBar]           │ → height=4, marginHorizontal=24
│ [stepHint "Paso X de 4"]│
│                         │
│ [formContent: flex=1]   │ → heading + subtext + input/grid/chips + infoBlock
│ (ScrollView si overflow)│
│                         │
│ [bottom: pb=44]         │ → PillButton
└─────────────────────────┘
formContent paddingHorizontal: 24px
```

### Pantalla de scroll (value-prop)
```
┌─────────────────────────┐
│ [BackButton absolute]   │
│ [ScrollView]            │
│   paddingTop=64         │ → espacio para el back button
│   sectionHeading        │
│   ValueBubble × 3       │
│   PillButton            │
│   paddingBottom=32      │
└─────────────────────────┘
```

---

## Progresión de fondos

```
welcome    → white    (apertura, confianza inicial)
value-prop → white    (continuidad, misma fase)
child-name → bgCream  (calidez, "aquí me conoces")
child-age  → bgCream  (continuidad fase datos)
relationship → bgCream
privacy    → bgBlueLt (seriedad serena, transparencia)
loading    → softPurple / purple[100]  (celebración suave)
handoff    → softPurple / purple[100]  (cierre cálido)
```

---

## Reglas de nombre dinámico

- `displayName = childName.trim() || "tu hijo/a"` — nunca mostrar campo vacío
- Aparece en color `purple[500]` dentro de headings
- En handoff el nombre aparece en `purple[700]`
- En el CTA del handoff: `¡Empezar, [nombre]!` si hay nombre, `¡Empezar!` si no

---

## Reglas de navegación

```
welcome → value-prop → child-name → child-age → relationship → privacy → loading → handoff → select-mascot

Back visible: value-prop, child-name, child-age, relationship, privacy
Back oculto:  welcome, loading, handoff

Disabled CTA:
  child-name: si childName.trim().length < 2
  relationship: si !relationship
  (child-age y privacy siempre habilitados)
```

---

## Componentes NO modificar

- `components/PetDisplay.tsx` — se usa tal cual, no extender
- `lib/theme.ts` — tokens ya incluidos: bgCream, bgBlueLight
- `lib/pet-reactions.ts` — lógica if/else, no LLM
