import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getDimensionLabel, type Dimension } from "../../lib/scenarios";
import { colors, fonts, theme } from "../../lib/theme";
import SummaryCard from "../../components/SummaryCard";

interface ChildData {
  id: string;
  name: string;
  mascot_type: string;
  mascot_name: string;
}

interface CheckIn {
  situation: string;
  situation_choice: string;
  emotion: string;
  created_at: string;
}

const DIMENSION_ICON_LABELS: Record<Dimension, string> = {
  instrucciones: "IN",
  socializacion: "SO",
  prosocial: "PR",
  regulacion: "RE",
  animo: "AN",
};

const DIMENSION_COLORS: Record<Dimension, string> = {
  instrucciones: colors.purple[500],
  socializacion: colors.mint[500],
  prosocial: colors.mint[700],
  regulacion: colors.purple[300],
  animo: colors.orange[500],
};

const DIMENSION_DETAILS_BASE: Record<Dimension, string> = {
  instrucciones: "Mide si el ni\u00F1o ayuda cuando la mascota necesita ordenar, guardar cosas o seguir rutinas. M\u00E1s ayuda = mejor seguimiento de instrucciones.",
  socializacion: "Mide si el ni\u00F1o prefiere que la mascota juegue sola o con amigos. Muestra patrones de preferencia social.",
  prosocial: "Mide si el ni\u00F1o elige compartir, colaborar o quedarse con las cosas. Refleja la capacidad de cooperaci\u00F3n.",
  regulacion: "Mide c\u00F3mo el ni\u00F1o maneja las emociones fuertes de la mascota: respirar, explotar o aislarse.",
  animo: "Muestra c\u00F3mo se sinti\u00F3 la mascota cada d\u00EDa de la semana. Permite ver tendencias de \u00E1nimo.",
};

const EMOTION_SCORES: Record<string, number> = {
  happy: 2, neutral: 1, sad: 0, angry: 0, scared: 0,
};

function scoreToEmotion(avg: number): string {
  if (avg <= 0.25) return "sad";
  if (avg <= 0.75) return "scared";
  if (avg <= 1.25) return "neutral";
  if (avg <= 1.75) return "happy";
  return "happy";
}

interface DayMood {
  day: string;
  emotion: string;
  color: string;
  label: string;
}

function getAnimoByDay(checkins: CheckIn[]): DayMood[] {
  const relevant = checkins.filter(
    (c) => getDimensionFromSituation(c.situation) === "animo"
  );
  if (relevant.length === 0) return [];

  const byDay = new Map<number, number[]>();
  for (const c of relevant) {
    const d = new Date(c.created_at);
    const dayIdx = (d.getDay() || 7) - 1;
    const scores = byDay.get(dayIdx) ?? [];
    scores.push(EMOTION_SCORES[c.emotion] ?? 1);
    byDay.set(dayIdx, scores);
  }

  const result: DayMood[] = [];
  for (let i = 0; i < 7; i++) {
    const scores = byDay.get(i);
    if (!scores) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const emo = scoreToEmotion(avg);
    result.push({
      day: DAY_LABELS[i],
      emotion: emo,
      color: EMOTION_COLORS[emo] ?? colors.gray[300],
      label: EMOTION_LABEL_ES[emo] ?? "Neutro",
    });
  }
  return result;
}

function AnimoTimeline({ days }: { days: DayMood[] }) {
  if (days.length === 0) return null;
  return (
    <View style={animoStyles.container}>
      {days.map((d, i) => (
        <View key={i} style={animoStyles.dayCol}>
          <View style={[animoStyles.dot, { backgroundColor: d.color }]} />
          <Text style={animoStyles.dayLabel}>{d.day}</Text>
          <Text style={[animoStyles.moodLabel, { color: d.color }]}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const animoStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    marginBottom: 10,
  },
  dayCol: {
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: theme.dark,
  },
  moodLabel: {
    fontSize: 10,
    fontFamily: fonts.body,
  },
});

const EMOTION_COLORS: Record<string, string> = {
  sad: colors.purple[300],
  angry: colors.red[500],
  neutral: colors.gray[300],
  happy: colors.mint[500],
  scared: colors.orange[500],
};

const EMOTION_LABEL_ES: Record<string, string> = {
  sad: "Triste",
  angry: "Enojado",
  neutral: "Neutro",
  happy: "Feliz",
  scared: "Asustado",
};

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function getWeekRange(offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const label = `${monday.getDate()}/${monday.getMonth() + 1} - ${sunday.getDate()}/${sunday.getMonth() + 1}`;
  return { start: monday, end: sunday, label };
}

function getDimensionFromSituation(situationId: string): Dimension {
  const prefix = situationId.split("-")[0];
  const map: Record<string, Dimension> = {
    inst: "instrucciones",
    soc: "socializacion",
    pro: "prosocial",
    reg: "regulacion",
    ani: "animo",
  };
  return map[prefix] ?? "animo";
}

function summarizeDimension(
  dimension: Dimension,
  checkins: CheckIn[],
): string {
  const relevant = checkins.filter(
    (c) => getDimensionFromSituation(c.situation) === dimension
  );
  if (relevant.length === 0) return "Sin datos esta semana";

  const total = relevant.length;

  switch (dimension) {
    case "instrucciones": {
      const helped = relevant.filter((c) => c.situation_choice === "helps").length;
      return `Ayudó ${helped}/${total} veces esta semana`;
    }
    case "socializacion": {
      const alone = relevant.filter((c) => c.situation_choice === "alone").length;
      const social = relevant.filter((c) => c.situation_choice === "social").length;
      if (alone > social) return `Prefirió jugar sola ${alone}/${total} días`;
      return `Eligió jugar con amigos ${social}/${total} días`;
    }
    case "prosocial": {
      const shared = relevant.filter(
        (c) => c.situation_choice === "shares" || c.situation_choice === "compromises"
      ).length;
      return `Compartió o colaboró ${shared}/${total} veces`;
    }
    case "regulacion": {
      const regulated = relevant.filter(
        (c) => c.situation_choice === "regulates"
      ).length;
      return `Eligió regularse ${regulated}/${total} veces`;
    }
    case "animo": {
      // Average scores per day
      const byDay = new Map<number, number[]>();
      for (const c of relevant) {
        const d = new Date(c.created_at);
        const dayIdx = (d.getDay() || 7) - 1;
        const scores = byDay.get(dayIdx) ?? [];
        scores.push(EMOTION_SCORES[c.emotion] ?? 1);
        byDay.set(dayIdx, scores);
      }
      const dayAvgs = Array.from(byDay.entries())
        .sort(([a], [b]) => a - b)
        .map(([, scores]) => scores.reduce((a, b) => a + b, 0) / scores.length);

      if (dayAvgs.length <= 1) {
        const avg = dayAvgs[0] ?? 1;
        if (avg >= 1.5) return "Buen ánimo hoy";
        if (avg >= 0.5) return "Ánimo neutro hoy";
        return "Día difícil emocionalmente";
      }
      const mid = Math.ceil(dayAvgs.length / 2);
      const avgFirst = dayAvgs.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const avgSecond = dayAvgs.slice(mid).reduce((a, b) => a + b, 0) / (dayAvgs.length - mid);
      const diff = avgSecond - avgFirst;
      if (diff >= 0.5) return "Mejor hacia el fin de semana";
      if (diff <= -0.5) return "Más bajoneada los últimos días";
      return "Ánimo estable esta semana";
    }
  }
}

interface TipResult {
  dato: string;
  accion: string;
}

function generateTip(checkins: CheckIn[]): TipResult {
  if (checkins.length === 0) {
    return {
      dato: "Sin datos suficientes esta semana.",
      accion: "¡Completa check-ins para recibir tips personalizados!",
    };
  }

  const mondayCheckins = checkins.filter(
    (c) => new Date(c.created_at).getDay() === 1
  );
  const mondaySad = mondayCheckins.filter(
    (c) => c.emotion === "sad" || c.emotion === "angry"
  );
  if (mondaySad.length > 0) {
    return {
      dato: "Los lunes parecen más difíciles emocionalmente.",
      accion: "Intenta un ritual de despedida especial antes del colegio.",
    };
  }

  const regCheckins = checkins.filter(
    (c) => getDimensionFromSituation(c.situation) === "regulacion"
  );
  const explodes = regCheckins.filter(
    (c) => c.situation_choice === "explodes"
  );
  if (explodes.length >= 2) {
    return {
      dato: "Las emociones fuertes aparecen seguido esta semana.",
      accion: "Practicar respiración juntos antes de dormir puede ayudar.",
    };
  }

  const socCheckins = checkins.filter(
    (c) => getDimensionFromSituation(c.situation) === "socializacion"
  );
  const alone = socCheckins.filter((c) => c.situation_choice === "alone");
  if (alone.length >= 3) {
    return {
      dato: "Prefiere jugar solo/a bastante esta semana.",
      accion: "Invitar un amigo a casa puede ayudar a abrir el espacio social.",
    };
  }

  const instCheckins = checkins.filter(
    (c) => getDimensionFromSituation(c.situation) === "instrucciones"
  );
  const refuses = instCheckins.filter((c) => c.situation_choice === "refuses");
  if (refuses.length >= 3) {
    return {
      dato: "Le cuesta seguir instrucciones esta semana.",
      accion: "Dar opciones en vez de órdenes: '¿Quieres ordenar los rojos o los azules primero?'",
    };
  }

  const proCheckins = checkins.filter(
    (c) => getDimensionFromSituation(c.situation) === "prosocial"
  );
  const keeps = proCheckins.filter((c) => c.situation_choice === "keeps");
  if (keeps.length >= 3) {
    return {
      dato: "Compartir le está costando esta semana.",
      accion: "Jugar a 'turnos' con un timer puede hacer que compartir sea más fácil.",
    };
  }

  const aniCheckins = checkins.filter(
    (c) => getDimensionFromSituation(c.situation) === "animo"
  );
  const lowMood = aniCheckins.filter((c) => (EMOTION_SCORES[c.emotion] ?? 1) === 0);
  if (lowMood.length >= 3) {
    return {
      dato: "Varios días con ánimo bajo esta semana.",
      accion: "Pasar 10 minutos de atención exclusiva antes de dormir puede marcar la diferencia.",
    };
  }

  const regWithdraws = regCheckins.filter((c) => c.situation_choice === "withdraws");
  if (regWithdraws.length >= 3) {
    return {
      dato: "Tiende a aislarse cuando las emociones son grandes.",
      accion: "Validar su emoción primero ('entiendo que estás frustrada') antes de proponer soluciones.",
    };
  }

  if (aniCheckins.length >= 3) {
    const mid = Math.ceil(aniCheckins.length / 2);
    const avgFirst = aniCheckins.slice(0, mid).reduce((s, c) => s + (EMOTION_SCORES[c.emotion] ?? 1), 0) / mid;
    const avgSecond = aniCheckins.slice(mid).reduce((s, c) => s + (EMOTION_SCORES[c.emotion] ?? 1), 0) / (aniCheckins.length - mid);
    if (avgSecond - avgFirst >= 0.5) {
      return {
        dato: "El ánimo mejoró hacia el fin de semana.",
        accion: "Lo que están haciendo funciona — sigan con la rutina.",
      };
    }
  }

  return {
    dato: "¡Buena semana! Patrones estables.",
    accion: "Sigan con la rutina diaria — la consistencia es clave.",
  };
}

export default function WeeklySummaryScreen() {
  const [child, setChild] = useState<ChildData | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [weekOffset]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const { data: children, error: childErr } = await supabase
        .from("children")
        .select("id, name, mascot_type, mascot_name")
        .eq("parent_id", user.id)
        .limit(1);

      if (childErr) throw childErr;
      if (!children || children.length === 0) return;

      const c = children[0];
      setChild(c);

      const { start, end } = getWeekRange(weekOffset);

      const { data: weekCheckins, error: checkErr } = await supabase
        .from("checkins")
        .select("situation, situation_choice, emotion, created_at")
        .eq("child_id", c.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at");

      if (checkErr) throw checkErr;
      setCheckins(weekCheckins ?? []);
    } catch (err) {
      console.warn("loadData error:", err);
      setError("No pudimos cargar los datos. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  const week = getWeekRange(weekOffset);
  const dimensions: Dimension[] = [
    "instrucciones",
    "socializacion",
    "prosocial",
    "regulacion",
    "animo",
  ];
  const activeDays = new Set(
    checkins.map((c) => new Date(c.created_at).toDateString())
  ).size;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={true}
    >
      <Pressable style={styles.backBtn} onPress={() => router.replace("/(app)/checkin")}>
        <Text style={styles.backText}>← Volver con {child?.mascot_name ?? "Luna"}</Text>
      </Pressable>

      <Text style={styles.title}>Resumen semanal</Text>
      {child && (
        <Text style={styles.childName}>{child.name}</Text>
      )}

      <View style={styles.weekNav}>
        <Pressable onPress={() => setWeekOffset((w) => w - 1)}>
          <Text style={styles.navArrow}>◀</Text>
        </Pressable>
        <Text style={styles.weekLabel}>{week.label}</Text>
        <Pressable
          onPress={() => setWeekOffset((w) => Math.min(w + 1, 0))}
          disabled={weekOffset >= 0}
        >
          <Text
            style={[styles.navArrow, weekOffset >= 0 && { opacity: 0.3 }]}
          >
            ▶
          </Text>
        </Pressable>
      </View>

      <Text style={styles.activeDays}>
        Días activos: {activeDays}/7
      </Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={{ marginTop: 40 }}
        />
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : checkins.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌙</Text>
          <Text style={styles.emptyTitle}>No hay datos esta semana</Text>
          <Text style={styles.emptyText}>
            {"\u00A1"}Juega con {child?.mascot_name ?? "Luna"} para ver tu resumen!
          </Text>
        </View>
      ) : (
        <>
          {(() => {
            const tip = generateTip(checkins);
            return (
              <>
                <View style={styles.datoCard}>
                  <View style={styles.datoHeader}>
                    <View style={[styles.tipIcon, { backgroundColor: colors.red[500] + "20" }]}>
                      <Text style={[styles.tipIconText, { color: colors.red[500] }]}>!</Text>
                    </View>
                    <Text style={styles.datoTitle}>Dato de la semana</Text>
                  </View>
                  <Text style={styles.datoText}>{tip.dato}</Text>
                </View>
                <View style={styles.accionCard}>
                  <View style={styles.datoHeader}>
                    <View style={[styles.tipIcon, { backgroundColor: colors.mint[500] + "20" }]}>
                      <Text style={[styles.tipIconText, { color: colors.mint[500] }]}>{"\u2714"}</Text>
                    </View>
                    <Text style={styles.accionTitle}>{"Qu\u00E9 puedes hacer"}</Text>
                  </View>
                  <Text style={styles.accionText}>{tip.accion}</Text>
                </View>
              </>
            );
          })()}

          <Text style={styles.sectionLabel}>Detalle por dimensi{"ó"}n</Text>

          {dimensions.map((dim) => {
            const isAnimo = dim === "animo";
            const animoDays = isAnimo ? getAnimoByDay(checkins) : [];
            return (
              <SummaryCard
                key={dim}
                title={getDimensionLabel(dim)}
                iconLabel={DIMENSION_ICON_LABELS[dim]}
                description={summarizeDimension(dim, checkins)}
                detail={DIMENSION_DETAILS_BASE[dim]}
                detailContent={isAnimo && animoDays.length > 0 ? <AnimoTimeline days={animoDays} /> : undefined}
                color={DIMENSION_COLORS[dim]}
              />
            );
          })}
        </>
      )}

      <Pressable
        style={styles.logoutBtn}
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        }}
      >
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  backBtn: { marginBottom: 16 },
  backText: { color: theme.primary, fontSize: 16, fontWeight: "500" },
  title: {
    fontSize: 26,
    fontFamily: fonts.bodySemiBold,
    color: theme.dark,
  },
  childName: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: theme.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 8,
  },
  navArrow: { fontSize: 20, color: theme.primary },
  weekLabel: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: theme.dark },
  activeDays: {
    textAlign: "center",
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: theme.textSecondary,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: theme.textLight,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  datoCard: {
    backgroundColor: colors.red[50],
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.red[500],
  },
  datoHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  tipIconText: { fontSize: 16, fontFamily: fonts.bodySemiBold },
  datoTitle: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.red[900] },
  datoText: { fontSize: 14, fontFamily: fonts.body, color: colors.red[900], lineHeight: 20 },
  accionCard: {
    backgroundColor: colors.mint[50],
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.mint[500],
  },
  accionTitle: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.mint[900] },
  accionText: { fontSize: 14, fontFamily: fonts.body, color: colors.mint[900], lineHeight: 20 },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.bodySemiBold,
    color: theme.dark,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  retryText: { color: "#FFF", fontSize: 15, fontFamily: fonts.bodySemiBold },
  logoutBtn: { marginTop: 32, alignItems: "center" },
  logoutText: { color: theme.textLight, fontSize: 14 },
});
