export type Dimension =
  | "instrucciones"
  | "socializacion"
  | "prosocial"
  | "regulacion"
  | "animo";

export interface Scenario {
  id: string;
  dimension: Dimension;
  situation: string;
  choices: { label: string; value: string }[];
}

const scenarios: Scenario[] = [
  // Seguimiento de instrucciones (6)
  {
    id: "inst-1",
    dimension: "instrucciones",
    situation: "necesita ordenar sus juguetes. ¿La ayudas?",
    choices: [
      { label: "¡Sí, vamos!", value: "helps" },
      { label: "Ahora no", value: "refuses" },
      { label: "Un ratito más", value: "delays" },
    ],
  },
  {
    id: "inst-2",
    dimension: "instrucciones",
    situation: "tiene que lavarse las patitas antes de comer.",
    choices: [
      { label: "¡A lavarse!", value: "helps" },
      { label: "No quiero", value: "refuses" },
      { label: "Después", value: "delays" },
    ],
  },
  {
    id: "inst-3",
    dimension: "instrucciones",
    situation: "es hora de guardar los crayones.",
    choices: [
      { label: "Los guardo", value: "helps" },
      { label: "No quiero", value: "refuses" },
      { label: "Cinco minutos más", value: "delays" },
    ],
  },
  {
    id: "inst-4",
    dimension: "instrucciones",
    situation: "tiene que ponerse el abrigo antes de salir.",
    choices: [
      { label: "¡Me lo pongo!", value: "helps" },
      { label: "No tengo frío", value: "refuses" },
      { label: "Después", value: "delays" },
    ],
  },
  {
    id: "inst-5",
    dimension: "instrucciones",
    situation: "necesita hacer su camita.",
    choices: [
      { label: "¡Vamos a hacerla!", value: "helps" },
      { label: "No quiero", value: "refuses" },
      { label: "Más tarde", value: "delays" },
    ],
  },
  {
    id: "inst-6",
    dimension: "instrucciones",
    situation: "tiene que apagar la tele y prepararse para dormir.",
    choices: [
      { label: "Bueno, vamos", value: "helps" },
      { label: "Un rato más", value: "delays" },
      { label: "¡No!", value: "refuses" },
    ],
  },

  // Socialización (6)
  {
    id: "soc-1",
    dimension: "socializacion",
    situation: "quiere jugar. ¿Prefiere sola o con amigos?",
    choices: [
      { label: "Con amigos", value: "social" },
      { label: "Solita", value: "alone" },
      { label: "Con uno nomás", value: "one_friend" },
    ],
  },
  {
    id: "soc-2",
    dimension: "socializacion",
    situation: "hay una fiesta de mascotas. ¿Quiere ir?",
    choices: [
      { label: "¡Vamos!", value: "social" },
      { label: "Prefiero quedarme", value: "alone" },
      { label: "Solo si va mi amigo", value: "one_friend" },
    ],
  },
  {
    id: "soc-3",
    dimension: "socializacion",
    situation: "llegó una mascota nueva al barrio.",
    choices: [
      { label: "¡Voy a saludarla!", value: "social" },
      { label: "Mejor la veo de lejos", value: "alone" },
      { label: "Le mando un dibujo", value: "one_friend" },
    ],
  },
  {
    id: "soc-4",
    dimension: "socializacion",
    situation: "es hora del recreo. ¿Qué quiere hacer?",
    choices: [
      { label: "Jugar con todos", value: "social" },
      { label: "Leer solita", value: "alone" },
      { label: "Pasear con un amigo", value: "one_friend" },
    ],
  },
  {
    id: "soc-5",
    dimension: "socializacion",
    situation: "puede hacer un proyecto en grupo o sola.",
    choices: [
      { label: "¡En grupo!", value: "social" },
      { label: "Sola es mejor", value: "alone" },
      { label: "Con un compañero", value: "one_friend" },
    ],
  },
  {
    id: "soc-6",
    dimension: "socializacion",
    situation: "hay un juego nuevo en el parque.",
    choices: [
      { label: "¡Todos a jugar!", value: "social" },
      { label: "Lo pruebo sola", value: "alone" },
      { label: "Voy con mi mejor amigo", value: "one_friend" },
    ],
  },

  // Conducta prosocial (6)
  {
    id: "pro-1",
    dimension: "prosocial",
    situation: "Otra mascota quiere su juguete favorito.",
    choices: [
      { label: "Se lo presto", value: "shares" },
      { label: "Es mío", value: "keeps" },
      { label: "Jugamos juntos", value: "compromises" },
    ],
  },
  {
    id: "pro-2",
    dimension: "prosocial",
    situation: "Un amigo se cayó y le duele la rodilla.",
    choices: [
      { label: "Lo ayudo", value: "shares" },
      { label: "Sigo jugando", value: "keeps" },
      { label: "Llamo a alguien", value: "compromises" },
    ],
  },
  {
    id: "pro-3",
    dimension: "prosocial",
    situation: "Queda un solo dulce y su amigo también quiere.",
    choices: [
      { label: "Se lo doy", value: "shares" },
      { label: "Me lo como yo", value: "keeps" },
      { label: "Lo partimos", value: "compromises" },
    ],
  },
  {
    id: "pro-4",
    dimension: "prosocial",
    situation: "Su amigo no entiende la tarea.",
    choices: [
      { label: "Le explico", value: "shares" },
      { label: "Que pregunte solo", value: "keeps" },
      { label: "Le doy una pista", value: "compromises" },
    ],
  },
  {
    id: "pro-5",
    dimension: "prosocial",
    situation: "Otra mascota está triste y solita.",
    choices: [
      { label: "Me siento con ella", value: "shares" },
      { label: "No es mi problema", value: "keeps" },
      { label: "Le mando un dibujo", value: "compromises" },
    ],
  },
  {
    id: "pro-6",
    dimension: "prosocial",
    situation: "Hay que limpiar después de jugar.",
    choices: [
      { label: "Ayudo a todos", value: "shares" },
      { label: "Solo lo mío", value: "keeps" },
      { label: "Ayudo un poquito", value: "compromises" },
    ],
  },

  // Regulación emocional (6)
  {
    id: "reg-1",
    dimension: "regulacion",
    situation: "está enojada porque perdió en un juego. ¿Qué quiere hacer?",
    choices: [
      { label: "Respirar profundo", value: "regulates" },
      { label: "Gritar", value: "explodes" },
      { label: "Alejarse un rato", value: "withdraws" },
    ],
  },
  {
    id: "reg-2",
    dimension: "regulacion",
    situation: "está frustrada porque no le sale un dibujo.",
    choices: [
      { label: "Intentar de nuevo", value: "regulates" },
      { label: "Romper el papel", value: "explodes" },
      { label: "Dejar de dibujar", value: "withdraws" },
    ],
  },
  {
    id: "reg-3",
    dimension: "regulacion",
    situation: "alguien se burló de ella.",
    choices: [
      { label: "Decir cómo se siente", value: "regulates" },
      { label: "Pegarle", value: "explodes" },
      { label: "No decir nada", value: "withdraws" },
    ],
  },
  {
    id: "reg-4",
    dimension: "regulacion",
    situation: "no puede dormir porque está preocupada.",
    choices: [
      { label: "Contar estrellas", value: "regulates" },
      { label: "Llorar fuerte", value: "explodes" },
      { label: "Quedarse callada", value: "withdraws" },
    ],
  },
  {
    id: "reg-5",
    dimension: "regulacion",
    situation: "su torre de bloques se cayó.",
    choices: [
      { label: "Armarla de nuevo", value: "regulates" },
      { label: "Tirar los bloques", value: "explodes" },
      { label: "Ya no quiero jugar", value: "withdraws" },
    ],
  },
  {
    id: "reg-6",
    dimension: "regulacion",
    situation: "tiene que esperar su turno y está impaciente.",
    choices: [
      { label: "Cantar bajito", value: "regulates" },
      { label: "Empujar para pasar", value: "explodes" },
      { label: "Irse", value: "withdraws" },
    ],
  },

  // Ánimo general (6)
  {
    id: "ani-1",
    dimension: "animo",
    situation: "acaba de despertar. ¿Cómo se siente hoy?",
    choices: [
      { label: "¡Genial!", value: "great" },
      { label: "Normal", value: "okay" },
      { label: "No muy bien", value: "low" },
    ],
  },
  {
    id: "ani-2",
    dimension: "animo",
    situation: "terminó un día largo. ¿Cómo está?",
    choices: [
      { label: "Contenta", value: "great" },
      { label: "Cansada", value: "okay" },
      { label: "Triste", value: "low" },
    ],
  },
  {
    id: "ani-3",
    dimension: "animo",
    situation: "es fin de semana. ¿Cómo amaneció?",
    choices: [
      { label: "¡Feliz!", value: "great" },
      { label: "Tranquila", value: "okay" },
      { label: "Aburrida", value: "low" },
    ],
  },
  {
    id: "ani-4",
    dimension: "animo",
    situation: "vuelve del colegio. ¿Cómo le fue?",
    choices: [
      { label: "¡Súper bien!", value: "great" },
      { label: "Normal", value: "okay" },
      { label: "Fue difícil", value: "low" },
    ],
  },
  {
    id: "ani-5",
    dimension: "animo",
    situation: "es hora de jugar. ¿Tiene ganas?",
    choices: [
      { label: "¡Sí, muchas!", value: "great" },
      { label: "Un poquito", value: "okay" },
      { label: "No mucho", value: "low" },
    ],
  },
  {
    id: "ani-6",
    dimension: "animo",
    situation: "va a dormir. ¿Cómo estuvo su día?",
    choices: [
      { label: "¡Muy lindo!", value: "great" },
      { label: "Normal", value: "okay" },
      { label: "No tan bueno", value: "low" },
    ],
  },
];

export function getScenarioForToday(childId: string): Scenario {
  const today = new Date();
  const dayOfYear =
    Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        86400000
    );
  // Use childId hash + day to get different scenario per child per day
  const hash = childId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = (dayOfYear + hash) % scenarios.length;
  return scenarios[index];
}

export function getDimensionLabel(dimension: Dimension): string {
  const labels: Record<Dimension, string> = {
    instrucciones: "Seguimiento de instrucciones",
    socializacion: "Socialización",
    prosocial: "Conducta prosocial",
    regulacion: "Regulación emocional",
    animo: "Ánimo general",
  };
  return labels[dimension];
}
