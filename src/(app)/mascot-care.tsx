import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts, theme } from "../../lib/theme";
import PetDisplay from "../../components/PetDisplay";
import type { MascotColor, LunaArchetype } from "../types/database";

interface NeedsState {
  hunger: number;
  cleanliness: number;
  happiness: number;
}

type MascotAction = "feed" | "wash" | "play";

const ACTION_CONFIG: Record<
  MascotAction,
  { label: string; accentColor: string; need: keyof NeedsState }
> = {
  feed: {
    label: "Darle de comer",
    accentColor: colors.orange[500],
    need: "hunger",
  },
  wash: {
    label: "Ba\u00F1arla",
    accentColor: colors.mint[500],
    need: "cleanliness",
  },
  play: {
    label: "Jugar con ella",
    accentColor: colors.purple[500],
    need: "happiness",
  },
};

export default function MascotCareScreen() {
  const { childId, mascotName, mascotColor, archetype } =
    useLocalSearchParams<{
      childId: string;
      mascotName: string;
      mascotColor?: string;
      archetype?: string;
    }>();

  const [needsState, setNeedsState] = useState<NeedsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionDone, setActionDone] = useState<MascotAction | null>(null);

  useEffect(() => {
    loadMascotState();
  }, []);

  async function loadMascotState() {
    if (!childId) return;
    try {
      const { data } = await supabase.rpc("apply_mascot_decay", {
        p_child_id: childId,
      });
      if (data) {
        setNeedsState({
          hunger: data.hunger ?? 80,
          cleanliness: data.cleanliness ?? 80,
          happiness: data.happiness ?? 80,
        });
      } else {
        setNeedsState({ hunger: 80, cleanliness: 80, happiness: 80 });
      }
    } catch (err) {
      console.warn("mascot decay error:", err);
      setNeedsState({ hunger: 80, cleanliness: 80, happiness: 80 });
    } finally {
      setLoading(false);
    }
  }

  const handleAction = useCallback(
    async (action: MascotAction) => {
      if (!childId) return;
      setActionDone(action);
      try {
        const { data: newState } = await supabase.rpc(
          "perform_mascot_action",
          {
            p_child_id: childId,
            p_action: action,
          }
        );
        if (newState) {
          setNeedsState({
            hunger: newState.hunger,
            cleanliness: newState.cleanliness,
            happiness: newState.happiness,
          });
        }
      } catch (err) {
        console.warn("mascot action error:", err);
      }
      setTimeout(() => {
        router.replace("/(app)/checkin");
      }, 1500);
    },
    [childId]
  );

  const handleSkip = useCallback(() => {
    router.replace("/(app)/checkin");
  }, []);

  function getDominantNeed(): MascotAction {
    if (!needsState) return "play";
    const { hunger, cleanliness, happiness } = needsState;
    const min = Math.min(hunger, cleanliness, happiness);
    if (min === hunger) return "feed";
    if (min === cleanliness) return "wash";
    return "play";
  }

  function getDominantNeedMessage(): string {
    if (!needsState) return "";
    const dominant = getDominantNeed();
    const name = mascotName || "Luna";
    if (dominant === "feed") return `${name} tiene hambre`;
    if (dominant === "wash") return `${name} quiere ba\u00F1arse`;
    return `${name} quiere jugar`;
  }

  const name = mascotName || "Luna";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (actionDone) {
    return (
      <View style={styles.center}>
        <View style={styles.petWrapper}>
          <PetDisplay
            mood="happy"
            name={name}
            size={200}
            needsState={needsState ?? undefined}
            mascotColor={mascotColor as MascotColor | undefined}
            archetype={archetype as LunaArchetype | undefined}
          />
        </View>
        <Text style={styles.thanksText}>
          {"\u00A1Gracias por cuidarla!"}
        </Text>
      </View>
    );
  }

  const dominantNeed = getDominantNeed();

  return (
    <View style={styles.container}>
      <View style={styles.petSection}>
        <PetDisplay
          mood="neutral"
          name={name}
          size={200}
          needsState={needsState ?? undefined}
          mascotColor={mascotColor as MascotColor | undefined}
          archetype={archetype as LunaArchetype | undefined}
        />
      </View>

      {needsState && (
        <View style={styles.needMessageRow}>
          <View
            style={[
              styles.needDot,
              { backgroundColor: ACTION_CONFIG[dominantNeed].accentColor },
            ]}
          />
          <Text style={styles.needMessage}>{getDominantNeedMessage()}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {(["feed", "wash", "play"] as MascotAction[]).map((action) => {
          const cfg = ACTION_CONFIG[action];
          const isDominant = action === dominantNeed;
          return (
            <Pressable
              key={action}
              style={({ pressed }) => [
                styles.actionCard,
                isDominant && styles.actionCardDominant,
                pressed && styles.actionCardPressed,
              ]}
              onPress={() => handleAction(action)}
            >
              <View
                style={[
                  styles.actionAccentBar,
                  { backgroundColor: cfg.accentColor },
                ]}
              />
              <Text
                style={[
                  styles.actionLabel,
                  isDominant && styles.actionLabelDominant,
                ]}
              >
                {cfg.label}
              </Text>
              {isDominant && (
                <View
                  style={[
                    styles.dominantChip,
                    { backgroundColor: cfg.accentColor + "22" },
                  ]}
                >
                  <Text
                    style={[styles.dominantChipText, { color: cfg.accentColor }]}
                  >
                    Lo necesita
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [styles.skipLink, pressed && styles.skipLinkPressed]}
        onPress={handleSkip}
      >
        <Text style={styles.skipText}>Saltar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  petSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  petWrapper: {
    alignItems: "center",
    marginBottom: 16,
  },
  needMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  needDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  needMessage: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    height: 72,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 2,
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  actionCardDominant: {
    borderColor: theme.border,
    elevation: 4,
    shadowOpacity: 0.1,
  },
  actionCardPressed: {
    opacity: 0.82,
  },
  actionAccentBar: {
    width: 4,
    alignSelf: "stretch",
  },
  actionLabel: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    paddingHorizontal: 16,
  },
  actionLabelDominant: {
    color: theme.dark,
  },
  dominantChip: {
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dominantChipText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },
  skipLink: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipLinkPressed: {
    opacity: 0.5,
  },
  skipText: {
    fontSize: 15,
    color: theme.textLight,
    fontFamily: fonts.body,
  },
  thanksText: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    marginTop: 16,
    textAlign: "center",
  },
});
