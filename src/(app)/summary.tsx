import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts, theme } from "../../lib/theme";
import SummaryCard from "../../components/SummaryCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Emotion = "happy" | "neutral" | "sad" | "angry" | "scared";
type Dimension = "instrucciones" | "socializacion" | "prosocial" | "regulacion" | "animo";

interface ChildData {
  id: string;
  name: string;
  age_group: string;
  mascot_name: string;
}

interface CheckinRow {
  emotion: Emotion;
  dimension: Dimension;
  check_date: string;
}

interface WeeklyInsight {
  main_dato: string;
  main_accion: string;
  main_source: string | null;
  active_days: number;
  total_checkins: number;
  dimension_metrics: Record<string, {
    positive_rate: number;
    negative_rate: number;
    neutral_rate?: number;
    total: number;
    delta?: number;
  }>;
  emotion_summary: {
    dominant: string;
    variety: number;
    by_day: { day_idx: number; emotion: string; avg_score: number }[];
  };
  dimension_insights: Record<string, {
    level: "normal" | "atencion" | "alerta";
    rec_id: string | null;
    tip: string;
    source: string;
  }>;
}

// ─── Static config per dimension ──────────────────────────────────────────────

const DIMENSION_CONFIG: Record<Dimension, {
  badge: string;
  badgeColor: string;
  title: string;
  tip: string;
}> = {
  instrucciones: {
    badge: "IN",
    badgeColor: colors.purple[500],
    title: "Seguimiento de instrucciones",
    tip: "Usa frases cortas y directas. 'Zapatos' en lugar de '¿Puedes ponerte los zapatos, por favor?'.",
  },
  socializacion: {
    badge: "SO",
    badgeColor: colors.mint[500],
    title: "Socialización",
    tip: "Refuerza sus habilidades sociales nombrando lo positivo que ves.",
  },
  prosocial: {
    badge: "PR",
    badgeColor: colors.mint[700],
    title: "Conducta prosocial",
    tip: "Practica el turno con juegos de mesa. 'Tú primero, luego yo' establece un patrón seguro.",
  },
  regulacion: {
    badge: "RE",
    badgeColor: colors.purple[300],
    title: "Regulación emocional",
    tip: "Nombra las emociones antes de que escalen: 'Veo que estás frustrada. Eso tiene sentido.'",
  },
  animo: {
    badge: "AN",
    badgeColor: colors.orange[500],
    title: "Ánimo general",
    tip: "El ánimo puede variar con el día. Un ritual de bienvenida al llegar del colegio puede marcar la diferencia.",
  },
};

const EMOTION_LABEL: Record<Emotion, string> = {
  happy: "feliz",
  neutral: "tranquilo/a",
  sad: "triste",
  angry: "frustrado/a",
  scared: "nervioso/a",
};

const EMOTION_COLOR: Record<Emotion, string> = {
  happy: "#34D399",
  neutral: "#FCD34D",
  sad: "#93C5FD",
  angry: "#FCA5A5",
  scared: "#FB923C",
};

const DIMENSIONS: Dimension[] = [
  "instrucciones",
  "socializacion",
  "prosocial",
  "regulacion",
  "animo",
];

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

const LEVEL_BADGE: Record<"normal" | "atencion" | "alerta", { icon: string; color: string }> = {
  normal:   { icon: "✓", color: colors.mint[500] },
  atencion: { icon: "!", color: colors.orange[500] },
  alerta:   { icon: "!", color: "#EF4444" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekRange(offset: number): { start: string; end: string; weekStartStr: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday), weekStartStr: fmt(monday) };
}

function getWeekLabel(offset: number): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(monday)} \u2014 ${fmt(sunday)}`;
}

function dominantEmotion(rows: CheckinRow[]): Emotion | null {
  if (rows.length === 0) return null;
  const counts: Partial<Record<Emotion, number>> = {};
  for (const row of rows) {
    counts[row.emotion] = (counts[row.emotion] ?? 0) + 1;
  }
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0] as Emotion;
}

function getDeltaLabel(delta?: number): string | null {
  if (delta === undefined) return null;
  if (delta > 0.05)  return "↑ Mejoró";
  if (delta < -0.05) return "↓ Bajó";
  return "→ Estable";
}

// ─── AnimoTimeline ────────────────────────────────────────────────────────────

function AnimoTimeline({ dailyEmotions }: { dailyEmotions: (Emotion | null)[] }) {
  return (
    <View style={animoStyles.container}>
      {DAY_LABELS.map((label, i) => {
        const emotion = dailyEmotions[i];
        return (
          <View key={label} style={animoStyles.dayCol}>
            <View
              style={[
                animoStyles.dot,
                { backgroundColor: emotion ? EMOTION_COLOR[emotion] : "#E5E7EB" },
              ]}
            />
            <Text style={animoStyles.dayLabel}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const animoStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  dayCol: {
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.gray[500],
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WeeklySummaryScreen() {
  const insets = useSafeAreaInsets();
  const [child, setChild] = useState<ChildData | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [insight, setInsight] = useState<WeeklyInsight | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingCheckins, setLoadingCheckins] = useState(false);

  // Load child on mount
  useEffect(() => {
    async function loadChild() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }
      const { data: children } = await supabase
        .from("children")
        .select("id, name, age_group, mascot_name")
        .eq("parent_id", user.id)
        .limit(1);
      if (children && children.length > 0) setChild(children[0] as ChildData);
      setLoading(false);
    }
    loadChild();
  }, []);

  // Load checkins + insight when child or week changes
  useEffect(() => {
    if (!child) return;
    async function loadData() {
      setLoadingCheckins(true);
      const { start, end, weekStartStr } = getWeekRange(weekOffset);

      const [checkinsResult, insightResult] = await Promise.all([
        supabase
          .from("checkins")
          .select("emotion, dimension, check_date")
          .eq("child_id", child!.id)
          .gte("check_date", start)
          .lte("check_date", end),
        supabase
          .from("weekly_insights")
          .select("*")
          .eq("child_id", child!.id)
          .eq("week_start", weekStartStr)
          .maybeSingle(),
      ]);

      setCheckins((checkinsResult.data as CheckinRow[]) ?? []);
      setInsight((insightResult.data as WeeklyInsight) ?? null);
      setLoadingCheckins(false);
    }
    loadData();
  }, [child, weekOffset]);

  // Computed: distinct active days
  const activeDays = useMemo(
    () => insight?.active_days ?? new Set(checkins.map((c) => c.check_date)).size,
    [checkins, insight]
  );

  // Computed: stats per dimension (fallback cuando no hay insight)
  const dimensionStats = useMemo(() => {
    return DIMENSIONS.map((dim) => {
      const rows = checkins.filter((c) => c.dimension === dim);
      const emotionCount: Partial<Record<Emotion, number>> = {};
      for (const row of rows) {
        emotionCount[row.emotion] = (emotionCount[row.emotion] ?? 0) + 1;
      }
      return { dimension: dim, count: rows.length, emotionCount, dominant: dominantEmotion(rows) };
    });
  }, [checkins]);

  // Computed: daily dominant emotion (Mon–Sun) for ánimo timeline
  const dailyEmotions = useMemo((): (Emotion | null)[] => {
    const { start } = getWeekRange(weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayRows = checkins.filter((c) => c.check_date === dateStr);
      return dominantEmotion(dayRows);
    });
  }, [checkins, weekOffset]);

  // Build summary cards
  const summaryCards = useMemo(() => {
    return DIMENSIONS.map((dim) => {
      const config = DIMENSION_CONFIG[dim];
      const stat = dimensionStats.find((s) => s.dimension === dim)!;
      const dimInsight = insight?.dimension_insights?.[dim];
      const dimMetrics = insight?.dimension_metrics?.[dim];

      let subtitle: string;
      let detailText: string;
      let levelBadge: { icon: string; color: string } | null = null;

      if (stat.count === 0) {
        subtitle = "Sin datos esta semana";
        detailText = `No hubo actividad en esta área esta semana.\n\nTip: ${config.tip}`;
      } else {
        const dominantLabel = stat.dominant ? EMOTION_LABEL[stat.dominant] : "neutral";
        const deltaLabel = getDeltaLabel(dimMetrics?.delta);
        subtitle = `${stat.count} día${stat.count > 1 ? "s" : ""} · mayormente ${dominantLabel}${deltaLabel ? ` · ${deltaLabel}` : ""}`;

        if (dimInsight) {
          levelBadge = LEVEL_BADGE[dimInsight.level];
          const sourceText = dimInsight.source ? `\n\nFuente: ${dimInsight.source}` : "";
          detailText = `${dimInsight.tip}${sourceText}`;
        } else {
          const breakdown = Object.entries(stat.emotionCount)
            .sort(([, a], [, b]) => b - a)
            .map(([e, n]) => `${EMOTION_LABEL[e as Emotion]} (${n})`)
            .join(", ");
          detailText = `Participó ${stat.count} vez${stat.count > 1 ? "es" : ""} esta semana.\n\nEmociones: ${breakdown}.\n\nTip: ${config.tip}`;
        }
      }

      const detailContent: ReactNode | undefined =
        dim === "animo" ? <AnimoTimeline dailyEmotions={dailyEmotions} /> : undefined;

      return {
        badge: config.badge,
        badgeColor: config.badgeColor,
        title: config.title,
        subtitle,
        detailText,
        detailContent,
        levelBadge,
      };
    });
  }, [dimensionStats, dailyEmotions, insight]);

  // ── Derived text ─────────────────────────────────────────────────────────────
  const childName  = child?.name ?? "tu hijo/a";
  const mascotName = child?.mascot_name ?? "Luna";
  const ageLabel   = child?.age_group === "4-6" ? "4-6 años" : "7-12 años";
  const weekLabel  = getWeekLabel(weekOffset);

  // Dato + Acción desde weekly_insights; si no existe, calcular en cliente
  const insightDimension = useMemo((): Dimension | null => {
    if (insight) return null; // ya tenemos dato del motor
    if (checkins.length === 0) return null;
    const negatives: Emotion[] = ["sad", "angry", "scared"];
    let maxNeg = 0;
    let result: Dimension | null = null;
    for (const stat of dimensionStats) {
      const neg = negatives.reduce((s, e) => s + (stat.emotionCount[e] ?? 0), 0);
      if (neg > maxNeg) { maxNeg = neg; result = stat.dimension; }
    }
    return result;
  }, [dimensionStats, checkins, insight]);

  const datoText =
    insight?.main_dato ??
    (checkins.length === 0
      ? "No hay actividad registrada esta semana."
      : insightDimension
      ? `El área de "${DIMENSION_CONFIG[insightDimension].title}" tuvo más emociones difíciles para ${childName} esta semana.`
      : `${childName} tuvo una semana positiva en todas las dimensiones.`);

  const accionText =
    insight?.main_accion ??
    (insightDimension
      ? DIMENSION_CONFIG[insightDimension].tip
      : "Sigue con las rutinas que ya están funcionando bien.");

  const sourceText = insight?.main_source ?? null;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom + 40, 80),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.replace("/(app)/checkin")}>
            <Text style={styles.backLink}>← Volver con {mascotName}</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace("/(auth)/login");
            }}
          >
            <Text style={styles.headerLogout}>Cerrar sesión</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Resumen semanal</Text>
        {child && (
          <Text style={styles.childMeta}>
            {child.name} · {ageLabel}
          </Text>
        )}
      </View>

      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Pressable
          style={styles.arrowBtn}
          onPress={() => setWeekOffset((w) => Math.max(w - 1, -4))}
        >
          <Text style={styles.arrowText}>◀</Text>
        </Pressable>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <Pressable
          style={[styles.arrowBtn, weekOffset === 0 && styles.arrowBtnDisabled]}
          onPress={() => setWeekOffset((w) => w + 1)}
          disabled={weekOffset === 0}
        >
          <Text
            style={[styles.arrowText, weekOffset === 0 && styles.arrowTextDisabled]}
          >
            ▶
          </Text>
        </Pressable>
      </View>

      {/* Active days */}
      {loadingCheckins ? (
        <ActivityIndicator size="small" color={colors.purple[300]} style={{ marginVertical: 12 }} />
      ) : (
        <Text style={styles.activeDays}>
          Días activos:{" "}
          <Text style={styles.activeDaysCount}>{activeDays}</Text>/7
        </Text>
      )}

      {/* Placeholder si semana actual sin insight */}
      {weekOffset === 0 && !insight && checkins.length > 0 && (
        <View style={[styles.highlightCard, { borderLeftColor: colors.gray[200] }]}>
          <Text style={[styles.highlightTag, { color: colors.gray[400] }]}>
            RESUMEN EN PROCESO
          </Text>
          <Text style={styles.highlightText}>
            El resumen con fuentes verificadas estará disponible el próximo lunes. Mientras tanto, puedes ver el detalle por dimensión abajo.
          </Text>
        </View>
      )}

      {/* Dato de la semana */}
      {(insight || checkins.length > 0) && (
        <>
          <View style={[styles.highlightCard, { borderLeftColor: "#EF4444" }]}>
            <Text style={[styles.highlightTag, { color: "#EF4444" }]}>
              ! DATO DE LA SEMANA
            </Text>
            <Text style={styles.highlightText}>{datoText}</Text>
          </View>

          {/* Qué puedes hacer */}
          <View style={[styles.highlightCard, { borderLeftColor: colors.mint[500] }]}>
            <Text style={[styles.highlightTag, { color: colors.mint[700] }]}>
              {"✓ QUÉ PUEDES HACER"}
            </Text>
            <Text style={styles.highlightText}>{accionText}</Text>
            {sourceText && (
              <Text style={styles.sourceText}>{sourceText}</Text>
            )}
          </View>
        </>
      )}

      {/* Dimension section label */}
      <Text style={styles.sectionLabel}>DETALLE POR DIMENSIÓN</Text>

      {/* Summary cards */}
      <View style={styles.cardsContainer}>
        {summaryCards.map((card) => (
          <View key={card.badge} style={styles.cardWrapper}>
            {card.levelBadge && (
              <View style={[styles.levelBadge, { backgroundColor: card.levelBadge.color }]}>
                <Text style={styles.levelBadgeIcon}>{card.levelBadge.icon}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <SummaryCard
                badge={card.badge}
                badgeColor={card.badgeColor}
                title={card.title}
                subtitle={card.subtitle}
                detailText={card.detailText}
                detailContent={card.detailContent}
              />
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    padding: 20,
  },
  header: {
    paddingBottom: 0,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLogout: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: "#EF4444",
  },
  backLink: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    fontWeight: "500",
    color: colors.purple[500],
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.display,
    fontWeight: "700",
    color: colors.dark,
    marginTop: 12,
  },
  childMeta: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    fontWeight: "500",
    color: colors.gray[500],
    marginTop: 2,
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginVertical: 12,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray[100],
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtnDisabled: {
    opacity: 0.4,
  },
  arrowText: {
    fontSize: 12,
    color: colors.gray[700],
  },
  arrowTextDisabled: {
    color: colors.gray[300],
  },
  weekLabel: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    fontWeight: "600",
    color: colors.gray[700],
  },
  activeDays: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 12,
  },
  activeDaysCount: {
    color: colors.purple[700],
    fontFamily: fonts.bodySemiBold,
    fontWeight: "700",
  },
  highlightCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightTag: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  highlightText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.gray[700],
  },
  sourceText: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.gray[400],
    marginTop: 6,
    fontStyle: "italic",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.gray[300],
    marginTop: 16,
    marginBottom: 10,
    width: "100%",
  },
  cardsContainer: {
    gap: 8,
  },
  cardWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  levelBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  levelBadgeIcon: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    fontWeight: "700",
    color: colors.white,
  },
});
