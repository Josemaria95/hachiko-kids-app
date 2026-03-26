import type { Dimension } from "./scenarios";
import { colors } from "./theme";

export type PetMood = "happy" | "sad" | "angry" | "scared" | "neutral";

export interface MoodStyle {
  scale: number;
  opacity: number;
  glowColor: string;
  label: string;
}

export const MOOD_STYLES: Record<PetMood, MoodStyle> = {
  happy: {
    scale: 1.05,
    opacity: 1,
    glowColor: colors.purple[500],
    label: "Feliz",
  },
  neutral: {
    scale: 1,
    opacity: 0.9,
    glowColor: colors.gray[300],
    label: "Normal",
  },
  sad: {
    scale: 0.88,
    opacity: 0.65,
    glowColor: "rgba(0,0,0,0.1)",
    label: "Triste",
  },
  angry: {
    scale: 1.0,
    opacity: 1,
    glowColor: colors.orange[500],
    label: "Enojado",
  },
  scared: {
    scale: 0.82,
    opacity: 0.75,
    glowColor: colors.mint[500],
    label: "Asustado",
  },
};

// Emotions the child can pick (mapped to PetMood for visual)
export interface EmotionOption {
  value: string;
  label: string;
  emoji: string;
  mood: PetMood;
  color: string;
}

export const EMOTION_OPTIONS: EmotionOption[] = [
  { value: "sad", label: "Triste", emoji: "😢", mood: "sad", color: colors.purple[300] },
  { value: "angry", label: "Enojado", emoji: "😠", mood: "angry", color: colors.orange[500] },
  { value: "neutral", label: "Normal", emoji: "😐", mood: "neutral", color: colors.gray[500] },
  { value: "happy", label: "Contento", emoji: "😊", mood: "happy", color: colors.purple[500] },
  { value: "scared", label: "Asustado", emoji: "😨", mood: "scared", color: colors.mint[500] },
];

export interface PetReaction {
  mood: PetMood;
  message: string;
}

type ReactionMap = Record<string, PetReaction>;

const reactionsByDimension: Record<Dimension, ReactionMap> = {
  instrucciones: {
    helps: {
      mood: "happy",
      message: "¡Qué bien! {name} está feliz de que le ayudaste.",
    },
    refuses: {
      mood: "neutral",
      message: "{name} entiende. A veces cuesta, pero mañana será más fácil.",
    },
    delays: {
      mood: "neutral",
      message: "{name} esperará. Tómate tu tiempo.",
    },
  },
  socializacion: {
    social: {
      mood: "happy",
      message: "¡{name} ama jugar con amigos! Se divirtió mucho.",
    },
    alone: {
      mood: "neutral",
      message: "{name} disfruta su tiempo a solas. Está tranquila.",
    },
    one_friend: {
      mood: "happy",
      message: "{name} pasó un lindo rato con su amigo.",
    },
  },
  prosocial: {
    shares: {
      mood: "happy",
      message: "¡{name} está orgullosa! Compartir se siente bien.",
    },
    keeps: {
      mood: "neutral",
      message: "A veces es difícil compartir. {name} te entiende.",
    },
    compromises: {
      mood: "happy",
      message: "¡Buena idea! {name} encontró una solución juntos.",
    },
  },
  regulacion: {
    regulates: {
      mood: "happy",
      message: "¡Muy bien! {name} se siente más tranquila ahora.",
    },
    explodes: {
      mood: "sad",
      message: "A veces las emociones son grandes. {name} te acompaña.",
    },
    withdraws: {
      mood: "neutral",
      message: "{name} entiende. Está bien tomarse un momento.",
    },
  },
  animo: {
    great: {
      mood: "happy",
      message: "¡{name} también está feliz! ¡Qué buen día!",
    },
    okay: {
      mood: "neutral",
      message: "{name} está tranquila. Un día normal también está bien.",
    },
    low: {
      mood: "sad",
      message: "{name} te da un abrazo. Mañana será mejor.",
    },
  },
};

// When the child's emotion doesn't match the scenario reaction,
// the mascot ALWAYS acknowledges how the child feels first.
// Principle: "La mascota nunca invalida. Siempre valida."
const EMOTION_OVERRIDES: Record<string, PetReaction> = {
  sad: {
    mood: "sad",
    message: "{name} te abraza fuerte. No pasa nada por estar triste, yo estoy contigo.",
  },
  angry: {
    mood: "angry",
    message: "{name} se queda cerca. Cuando algo nos enoja, se siente grande por dentro. Vamos a respirar juntos.",
  },
  scared: {
    mood: "scared",
    message: "{name} se acurruca contigo. No tengas miedo, estamos juntos y todo va a estar bien.",
  },
};

// Negative emotions that should trigger an override
const NEGATIVE_EMOTIONS = new Set(["sad", "angry", "scared"]);

export function getPetReaction(
  dimension: Dimension,
  choiceValue: string,
  petName: string,
  emotion?: string
): PetReaction {
  const dimensionReactions = reactionsByDimension[dimension];
  let reaction = dimensionReactions?.[choiceValue] ?? {
    mood: "neutral" as PetMood,
    message: `${petName} te acompa\u00F1a.`,
  };

  // If child expressed a negative emotion, always override unless
  // the scenario reaction already matches (e.g. "explodes" -> sad)
  if (
    emotion &&
    NEGATIVE_EMOTIONS.has(emotion) &&
    EMOTION_OVERRIDES[emotion] &&
    reaction.mood !== emotion
  ) {
    reaction = EMOTION_OVERRIDES[emotion];
  }

  return {
    ...reaction,
    message: reaction.message.replace(/{name}/g, petName),
  };
}
