---
title: "Referencia: Principal — Moral Dilemma Tamagotchi"
date: 2026-03-25
tags: [producto, wellness, educacion]
status: en-progreso
---

# Referencia Técnica: Principal (cnnmon/moral-dilemma-tamagotchi)

> Repo analizado como referencia arquitectónica para la evolución de Hachiko Kids.
> URL: https://github.com/cnnmon/moral-dilemma-tamagotchi

---

## ¿Qué es?

Un Tamagotchi web donde el pet evoluciona según cómo el usuario responde a dilemas morales. Cada respuesta mueve 6 dimensiones de personalidad cuantificadas (0-10), y la combinación dominante determina la forma que toma el pet.

Desarrollado por **Tiffany Wang** (@cnnmon, SF). Acumuló +30.000 respuestas a dilemas morales, que publicó como dataset en Hugging Face. Es investigación de facto en ética computacional gamificada.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js + TypeScript + Tailwind CSS |
| Backend / DB | Convex (serverless, reactivo) |
| Auth | Clerk |
| IA | GPT-4o-mini |
| Lenguaje | 95.9% TypeScript |

---

## Arquitectura de datos

### Schema (Convex)

**Tabla `pets`**
```ts
{
  userId: string,
  name: string,
  age: number,           // etapa de crecimiento 1-3
  evolutionId: string,
  personality: string,
  baseStats: {
    health: number,
    hunger: number,
    happiness: number,
    sanity: number
  },
  moralStats: {
    compassion: number,   // 0-10
    retribution: number,
    devotion: number,
    dominance: number,
    purity: number,
    ego: number
  }
}
```

**Tabla `dilemmas`**
```ts
{
  userId?: string,
  petId?: Id<"pets">,
  title: string,
  responseText: string,       // respuesta libre del usuario
  outcome?: string,           // reacción del pet
  messages?: { role, content }[],
  updatedMoralStats?: object, // delta aplicado
  updatedPersonality?: string,
  resolved: boolean,
  overridden?: boolean
}
```

---

## Las 6 dimensiones morales

Inspiradas en la **Moral Foundations Theory** de Jonathan Haidt. Cada una es un eje 0-10 con valor neutro en 5.

| Dimensión | Extremo bajo (0) | Extremo alto (10) |
|-----------|-----------------|-------------------|
| Compassion | Lógico | Emocional |
| Retribution | Perdonador | Punitivo |
| Devotion | Íntegro personal | Leal al grupo |
| Dominance | Autónomo | Autoritario |
| Purity | Indulgente | Virtuoso |
| Ego | Auto-sacrificado | Auto-servido |

La función `parseMoralStats()` convierte valores numéricos en texto descriptivo. Valores >7 o <3 se califican como "highly", rango 4-6 como "moderately".

---

## Sistema de evolución (árbol completo)

```
Stage 0 — Baby
│  "curious hatchling taking first steps"
│
├─ Stage 1 (dimensión dominante)
│   ├── Empath        ← Compassion alta
│   ├── Devout        ← Purity alta
│   ├── Watcher       ← Retribution alta
│   ├── Soldier       ← Dominance alta
│   ├── Teacher's Pet ← Devotion alta
│   ├── Hedonist      ← Ego alto
│   └── NPC           ← traits balanceados (fallback)
│
└─ Stage 2 (cruce de 2 dimensiones)
    ├── Saint        ← Empath + Devotion alta  /  Devout + Retribution baja
    ├── Cultleader   ← Empath + Devotion baja  /  Hedonist + Compassion alta
    ├── Gavel        ← Devout + Retribution alta  /  Watcher + Dominance alta
    ├── Vigilante    ← Watcher + Dominance baja
    ├── Godfather    ← Soldier + Ego alto
    ├── Guardian     ← Soldier + Ego bajo
    ├── Aristocrat   ← Teacher's Pet + Purity baja  /  NPC + Compassion baja
    ├── Sigma        ← Hedonist + Compassion baja
    └── NPC          ← NPC + Purity baja (doble fallback)

Stage 3 — Graduated / RIP (finales)
```

---

## Cómo funciona el loop con LLM

1. GPT-4o-mini presenta un escenario ético al usuario
2. El usuario responde en **texto libre** (no opciones predefinidas)
3. El modelo evalúa la respuesta y calcula un **delta de moralStats**
4. El delta se persiste en `dilemmas.updatedMoralStats`
5. Los stats acumulados determinan la forma de evolución

**Costo computacional**: GPT-4o-mini es viable incluso en free tier — el modelo hace evaluación semántica ligera, no generación extensa.

---

## Relevancia para Hachiko Kids

### Puntos de contacto directos

| Concepto en Principal | Equivalente en Hachiko Kids |
|-----------------------|----------------------------|
| `moralStats` (6 dims, 0-10) | 5 dimensiones conductuales (seguimiento instrucciones, socialización, prosocial, regulación emocional, ánimo) |
| Pet evoluciona según dimensiones dominantes | Luna evoluciona / cambia de estado según patrón conductual |
| GPT-4o-mini interpreta texto libre | Hachiko MVP usa if/else — este repo valida que el LLM es viable a escala |
| Dataset de 30K respuestas publicado | Oportunidad: Hachiko puede acumular datos conductuales en español de niños LATAM |
| Árbol de evolución con arquetipos | Propuesta: arquetipos conductuales para Luna (ej: "Luna exploradora", "Luna cuidadora") |

### Diferencias críticas (contexto infantil)

| Dimensión | Principal | Hachiko Kids |
|-----------|-----------|-------------|
| Usuario | Adulto | Niño 4-12 años |
| Input | Texto libre (razonamiento moral) | Selección visual (escenarios + emoji emoción) |
| Objetivo | Entretenimiento + reflexión ética | Captura conductual clínica + engagement |
| Marco teórico | Moral Foundations Theory (Haidt) | SDQ-like (5 dimensiones conductuales) |
| Audiencia del dato | El propio usuario | El padre + profesional de salud |
| Lenguaje clínico | No aplica | Solo en backend, NUNCA en UI |

---

## Propuestas de arquitectura derivadas

### 1. Cuantificar las 5 dimensiones como vector continuo

En lugar de solo guardar la emoción del check-in, acumular un vector análogo a `moralStats`:

```ts
conductualStats: {
  instrucciones: number,   // 0-10 (no sigue ↔ sigue bien)
  socializacion: number,   // 0-10 (solitario ↔ muy social)
  prosocial: number,       // 0-10 (no comparte ↔ comparte siempre)
  regulacion: number,      // 0-10 (desborda ↔ regula bien)
  animo: number            // 0-10 (bajo ↔ alto)
}
```

Esto permite: trending semanal, alertas por desviación, y eventualmente correlación con SDQ.

### 2. Árbol de evolución conductual para Luna

Implementar etapas de evolución basadas en dimensiones dominantes (análogo directo al árbol de Principal):

```
Luna Bebé → Luna Exploradora (socializacion alta)
           → Luna Cuidadora (prosocial alta)
           → Luna Tranquila (regulacion alta)
           → Luna Luchadora (instrucciones baja, regulacion baja)
           → Luna Equilibrada (todas dims ~5, fallback positivo)
```

Esto refuerza el loop de retención (H1) sin agregar carga clínica.

### 3. Reemplazar if/else por GPT-4o-mini (fase 2)

El MVP actual usa reglas fijas para generar reacciones de Luna. Principal valida que GPT-4o-mini puede:
- Interpretar contexto conductual
- Generar reacciones personalizadas
- Calcular deltas de dimensiones

Migrar en Fase 2 cuando haya datos suficientes para evaluar coherencia del modelo.

### 4. Acumular dataset propio desde el piloto

Cada check-in es un dato. Con 30 niños × 30 días × 1 check-in = 900 registros iniciales.
Publicar dataset anonimizado (con consentimiento) sería diferenciador único en LATAM.

---

## Referencias

- Repo: https://github.com/cnnmon/moral-dilemma-tamagotchi
- Dataset Hugging Face: buscar "moral-dilemma-responses" (cnnmon)
- Moral Foundations Theory: Jonathan Haidt — `The Righteous Mind`

→ Arquitectura actual: [[mvp-minimo]]
→ Instrumentos clínicos de referencia: [[instrumentos-clinicos]]
→ Contexto del proyecto: [[hachiko-proyecto-maestro]]
