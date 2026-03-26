import { useCallback, useEffect, useState } from "react";
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
import { colors, fonts, theme } from "../../lib/theme";

interface ActivityCatalogItem {
  id: number;
  title_es: string;
  description_es: string;
  duration_min: number;
  difficulty: string;
}

interface ActivitySuggestionItem {
  id: number;
  child_id: string;
  activity_id: number;
  status: string;
  week_start: string | null;
  activity: ActivityCatalogItem | null;
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export default function ActivitiesScreen() {
  const [suggestions, setSuggestions] = useState<ActivitySuggestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, []);

  async function loadActivities() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const { data: children } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .limit(1);

      if (!children || children.length === 0) {
        setLoading(false);
        return;
      }

      const cId = children[0].id;
      setChildId(cId);

      const weekStart = getMonday(new Date());

      const { data: existing } = await supabase
        .from("activity_suggestions")
        .select("id")
        .eq("child_id", cId)
        .eq("week_start", weekStart)
        .neq("status", "dismissed")
        .limit(1);

      if (!existing || existing.length === 0) {
        try {
          await supabase.rpc("generate_activity_suggestions", {
            p_child_id: cId,
          });
        } catch (err) {
          console.warn("generate suggestions error:", err);
        }
      }

      const { data: items } = await supabase
        .from("activity_suggestions")
        .select("*, activity:activity_catalog(*)")
        .eq("child_id", cId)
        .eq("week_start", weekStart)
        .neq("status", "dismissed");

      setSuggestions((items as ActivitySuggestionItem[]) ?? []);
    } catch (err) {
      console.warn("loadActivities error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleCompleted = useCallback(async (id: number) => {
    await supabase
      .from("activity_suggestions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "completed" } : s))
    );
  }, []);

  const handleDismiss = useCallback(async (id: number) => {
    await supabase
      .from("activity_suggestions")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .eq("id", id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const activeSuggestions = suggestions.filter(
    (s) => s.status !== "dismissed"
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.backBtnPressed,
          ]}
          onPress={() => router.back()}
        >
          <View style={styles.backArrow} />
        </Pressable>
        <Text style={styles.headerTitle}>Actividades</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.content}
        >
          {activeSuggestions.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIllustration}>
                <View style={styles.emptyCircle} />
              </View>
              <Text style={styles.emptyTitle}>Todo al d\u00EDa</Text>
              <Text style={styles.emptyText}>
                No hay actividades pendientes esta semana. Vuelve pronto.
              </Text>
            </View>
          ) : (
            activeSuggestions.map((item) => {
              const act = item.activity;
              if (!act) return null;
              const isDone = item.status === "completed";
              return (
                <View
                  key={item.id}
                  style={[styles.card, isDone && styles.cardDone]}
                >
                  <View style={styles.cardAccentBar} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Text
                        style={[
                          styles.cardTitle,
                          isDone && styles.cardTitleDone,
                        ]}
                        numberOfLines={2}
                      >
                        {act.title_es}
                      </Text>
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>
                          {act.duration_min} min
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.cardDesc} numberOfLines={3}>
                      {act.description_es}
                    </Text>

                    {isDone ? (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneText}>Completada</Text>
                      </View>
                    ) : (
                      <View style={styles.cardActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.completedBtn,
                            pressed && styles.completedBtnPressed,
                          ]}
                          onPress={() => handleCompleted(item.id)}
                        >
                          <Text style={styles.completedBtnText}>
                            Lo hicimos
                          </Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.dismissBtn,
                            pressed && styles.dismissBtnPressed,
                          ]}
                          onPress={() => handleDismiss(item.id)}
                        >
                          <Text style={styles.dismissBtnText}>
                            Despu\u00E9s
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: {
    opacity: 0.5,
  },
  backArrow: {
    width: 12,
    height: 12,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.dark,
    transform: [{ rotate: "45deg" }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
  },
  headerSpacer: { width: 40 },
  scrollContainer: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: {
    marginTop: 64,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyIllustration: {
    marginBottom: 20,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.purple[50],
    borderWidth: 2,
    borderColor: colors.purple[100],
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 2,
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardDone: {
    opacity: 0.5,
  },
  cardAccentBar: {
    width: 4,
    backgroundColor: theme.primary,
  },
  cardBody: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: fonts.bodySemiBold,
    color: theme.dark,
    flex: 1,
    lineHeight: 22,
  },
  cardTitleDone: {
    textDecorationLine: "line-through",
    color: theme.textSecondary,
  },
  durationBadge: {
    backgroundColor: colors.purple[50],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  durationText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.purple[700],
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 16,
  },
  completedBtn: {
    paddingVertical: 4,
  },
  completedBtnPressed: {
    opacity: 0.6,
  },
  completedBtnText: {
    color: colors.mint[700],
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
  dismissBtn: {
    paddingVertical: 4,
  },
  dismissBtnPressed: {
    opacity: 0.6,
  },
  dismissBtnText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  doneBadge: {
    backgroundColor: colors.mint[50],
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  doneText: {
    color: colors.mint[700],
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
