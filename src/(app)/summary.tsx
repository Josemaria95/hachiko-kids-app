import { useEffect, useState, type ReactNode } from "react";
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

interface ChildData {
  id: string;
  name: string;
  age_group: string;
  mascot_name: string;
}

function getWeekLabel(offset: number): string {
  const now = new Date();
  const day = now.getDay(); // 0=sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(monday)} \u2014 ${fmt(sunday)}`;
}

const DAY_COLORS = ["#FCA5A5", "#FCD34D", "#6EE7B7", "#34D399", "#6EE7B7"];
const DAY_LABELS = ["L", "M", "X", "J", "V"];

function AnimoTimeline() {
  return (
    <View style={animoStyles.container}>
      {DAY_LABELS.map((label, i) => (
        <View key={label} style={animoStyles.dayCol}>
          <View
            style={[animoStyles.dot, { backgroundColor: DAY_COLORS[i] }]}
          />
          <Text style={animoStyles.dayLabel}>{label}</Text>
        </View>
      ))}
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

type SummaryCardData = {
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  detailText?: string;
  detailContent?: ReactNode;
};

export default function WeeklySummaryScreen() {
  const insets = useSafeAreaInsets();
  const [child, setChild] = useState<ChildData | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeDays] = useState(4);
  const [loading, setLoading] = useState(true);

  const summaryCards: SummaryCardData[] = [
    {
      badge: "IN",
      badgeColor: colors.purple[500],
      title: "Seguimiento de instrucciones",
      subtitle: "Ayudó 3/5 veces esta semana",
      detailText:
        "Siguió instrucciones con facilidad cuando las actividades eran de su interés.\n\nTip: Usa frases cortas y directas. 'Zapatos' en lugar de '¿Puedes ponerte los zapatos, por favor?'.",
    },
    {
      badge: "SO",
      badgeColor: colors.mint[500],
      title: "Socialización",
      subtitle: "Eligió jugar con amigos 4/5 días",
      detailText:
        "Muy buena semana social. Buscó activamente la compañía de otros y mostró iniciativa.\n\nTip: Refuerza sus habilidades sociales nombrando lo positivo que ves.",
    },
    {
      badge: "PR",
      badgeColor: colors.mint[700],
      title: "Conducta prosocial",
      subtitle: "Compartió o colaboró 3/5 veces",
      detailText:
        "Mostró conductas de colaboración especialmente en juegos de roles.\n\nTip: Practica el turno con juegos de mesa. 'Tú primero, luego yo' establece un patrón seguro.",
    },
    {
      badge: "RE",
      badgeColor: colors.purple[300],
      title: "Regulación emocional",
      subtitle: "Eligió regularse 2/5 veces",
      detailText:
        "Esta dimensión necesita más apoyo. Dificultades para manejar la frustración.\n\nTip: Nombra las emociones antes de que escalen: 'Veo que estás frustrada. Eso tiene sentido.'",
    },
    {
      badge: "AN",
      badgeColor: colors.orange[500],
      title: "Ánimo general",
      subtitle: "Ánimo estable esta semana",
      detailText:
        "La semana en general fue positiva. El lunes empezó con ánimo bajo pero mejoró hacia el miércoles.\n\nTip: El patrón del lunes es consistente.",
      detailContent: <AnimoTimeline />,
    },
  ];

  useEffect(() => {
    async function load() {
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
      if (children && children.length > 0) setChild(children[0]);
      setLoading(false);
    }
    load();
  }, []);

  const mascotName = child?.mascot_name ?? "Luna";
  const ageLabel =
    child?.age_group === "4-6" ? "4-6 años" : "7-12 años";
  const weekLabel = getWeekLabel(weekOffset);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/(app)/checkin")}>
          <Text style={styles.backLink}>
            {"\u2190"} Volver con {mascotName}
          </Text>
        </Pressable>
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
            style={[
              styles.arrowText,
              weekOffset === 0 && styles.arrowTextDisabled,
            ]}
          >
            ▶
          </Text>
        </Pressable>
      </View>

      {/* Active days */}
      <Text style={styles.activeDays}>
        Días activos:{" "}
        <Text style={styles.activeDaysCount}>{activeDays}</Text>/7
      </Text>

      {/* Dato de la semana */}
      <View style={[styles.highlightCard, { borderLeftColor: "#EF4444" }]}>
        <Text style={[styles.highlightTag, { color: "#EF4444" }]}>
          ! DATO DE LA SEMANA
        </Text>
        <Text style={styles.highlightText}>
          Los lunes parecen más difíciles emocionalmente para{" "}
          {child?.name ?? "tu hijo/a"}.
        </Text>
      </View>

      {/* Qué puedes hacer */}
      <View style={[styles.highlightCard, { borderLeftColor: colors.mint[500] }]}>
        <Text style={[styles.highlightTag, { color: colors.mint[700] }]}>
          {"\u2713"} QUÉ PUEDES HACER
        </Text>
        <Text style={styles.highlightText}>
          Intenta un ritual de despedida especial antes del colegio los lunes.
        </Text>
      </View>

      {/* Dimension section label */}
      <Text style={styles.sectionLabel}>DETALLE POR DIMENSIÓN</Text>

      {/* Summary cards */}
      <View style={styles.cardsContainer}>
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.badge}
            badge={card.badge}
            badgeColor={card.badgeColor}
            title={card.title}
            subtitle={card.subtitle}
            detailText={card.detailText}
            detailContent={card.detailContent}
          />
        ))}
      </View>

      {/* Logout */}
      <Pressable
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        }}
        style={styles.logoutBtn}
      >
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
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
    paddingBottom: 100,
  },
  header: {
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 0,
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
  logoutBtn: {
    marginTop: 20,
    paddingBottom: 20,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.gray[300],
    textAlign: "center",
  },
});
