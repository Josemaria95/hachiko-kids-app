import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getScenarioForToday, type Scenario } from "../../lib/scenarios";
import {
  getPetReaction,
  type PetMood,
  type PetReaction,
} from "../../lib/pet-reactions";
import { colors, fonts, theme } from "../../lib/theme";
import PetDisplay from "../../components/PetDisplay";
import ScenarioCard from "../../components/ScenarioCard";
import EmotionPicker from "../../components/EmotionPicker";
import { scheduleMondaySummaryNotification } from "../../lib/notifications";
import type { MicroActivity, MascotColor, LunaArchetype } from "../types/database";

type Step =
  | "loading"
  | "done_today"
  | "mascot_care"
  | "scenario"
  | "emotion"
  | "reaction"
  | "breathe"
  | "sticker"
  | "error";

interface ChildData {
  id: string;
  name: string;
  mascot_type: string;
  mascot_name: string;
  mascot_color: string;
  luna_archetype: string;
}

type MascotAction = "feed" | "wash" | "play";

const MASCOT_ACTION_CONFIG: Record<
  MascotAction,
  { label: string; accentColor: string; need: "hunger" | "cleanliness" | "happiness" }
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

export default function CheckInScreen() {
  const [step, setStep] = useState<Step>("loading");
  const [child, setChild] = useState<ChildData | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [choiceValue, setChoiceValue] = useState<string>("");
  const [emotion, setEmotion] = useState<string>("");
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [petMood, setPetMood] = useState<PetMood>("happy");
  const [breathCycle, setBreathCycle] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [microActivity, setMicroActivity] = useState<MicroActivity | null>(null);
  const [mascotState, setMascotState] = useState<{
    hunger: number;
    cleanliness: number;
    happiness: number;
  } | null>(null);
  const [archetypeBefore, setArchetypeBefore] = useState<string | null>(null);
  const [archetypeEvolved, setArchetypeEvolved] = useState(false);
  const [mascotCareAction, setMascotCareAction] = useState<string | null>(null);

  const sessionStartRef = useRef<number>(Date.now());
  const breathScale = useRef(new Animated.Value(1)).current;
  const stickerScale = useRef(new Animated.Value(0)).current;

  const todayKey = () => {
    if (!child) return "";
    const d = new Date();
    return `checkin-${child.id}-${d.toISOString().slice(0, 10)}`;
  };

  useEffect(() => {
    loadChild();
  }, []);

  async function loadChild() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const { data: children, error } = await supabase
        .from("children")
        .select("id, name, mascot_type, mascot_name, mascot_color, luna_archetype")
        .eq("parent_id", user.id)
        .limit(1);

      if (error) throw error;

      if (!children || children.length === 0) {
        router.replace("/(app)/select-mascot");
        return;
      }

      const c = children[0];
      setChild(c);
      setArchetypeBefore(c.luna_archetype ?? null);

      scheduleMondaySummaryNotification(c.mascot_name).catch((err) => {
        console.warn("Failed to schedule notification:", err);
      });

      try {
        const { data: ms } = await supabase.rpc("apply_mascot_decay", {
          p_child_id: c.id,
        });
        if (ms) {
          setMascotState({
            hunger: ms.hunger ?? 80,
            cleanliness: ms.cleanliness ?? 80,
            happiness: ms.happiness ?? 80,
          });
        }
      } catch (err) {
        console.warn("mascot decay error:", err);
      }

      const done = await AsyncStorage.getItem(
        `checkin-${c.id}-${new Date().toISOString().slice(0, 10)}`
      );
      if (done) {
        setStep("done_today");
      } else {
        sessionStartRef.current = Date.now();
        setStep("mascot_care");
      }
    } catch (err) {
      console.warn("loadChild error:", err);
      setErrorMsg("No pudimos cargar los datos. Revisa tu conexi\u00F3n.");
      setStep("error");
    }
  }

  const handleMascotAction = useCallback(
    async (action: MascotAction) => {
      if (!child) return;
      setMascotCareAction(action);
      try {
        const { data: newState } = await supabase.rpc("perform_mascot_action", {
          p_child_id: child.id,
          p_action: action,
        });
        if (newState) {
          setMascotState({
            hunger: newState.hunger,
            cleanliness: newState.cleanliness,
            happiness: newState.happiness,
          });
        }
      } catch (err) {
        console.warn("mascot action error:", err);
      }
      setTimeout(() => {
        setMascotCareAction(null);
        setScenario(getScenarioForToday(child.id));
        setStep("scenario");
      }, 1500);
    },
    [child]
  );

  const handleChoice = useCallback((value: string) => {
    setChoiceValue(value);
    setStep("emotion");
  }, []);

  const handleEmotion = useCallback(
    async (emo: string) => {
      if (!child || !scenario) return;
      setEmotion(emo);

      const r = getPetReaction(scenario.dimension, choiceValue, child.mascot_name, emo);
      setReaction(r);
      setPetMood(r.mood);

      try {
        const { error } = await supabase.rpc("upsert_checkin", {
          p_child_id:         child.id,
          p_situation:        scenario.id,
          p_situation_choice: choiceValue,
          p_emotion:          emo,
          p_dimension:        scenario.dimension,
          p_micro_activity:   null,
          p_session_duration: null,
        });
        if (error) throw error;
      } catch (err) {
        console.warn("checkin upsert error:", err);
      }

      setStep("reaction");
    },
    [child, scenario, choiceValue]
  );

  const startBreathe = useCallback(() => {
    setMicroActivity("breathe");
    setStep("breathe");
    setBreathCycle(1);
    const totalCycles = 4;
    const cycles = Array.from({ length: totalCycles }).flatMap((_, i) => [
      Animated.timing(breathScale, {
        toValue: 1.5,
        duration: 3500,
        useNativeDriver: true,
      }),
      {
        start: (cb?: (result: { finished: boolean }) => void) => {
          setBreathCycle(i + 1);
          Animated.timing(breathScale, {
            toValue: 1,
            duration: 3500,
            useNativeDriver: true,
          }).start(cb);
        },
        stop: () => {},
        reset: () => {},
      } as Animated.CompositeAnimation,
    ]);
    Animated.sequence(cycles).start(() => showSticker("breathe"));
  }, [breathScale]);

  const showSticker = useCallback(
    async (activity?: MicroActivity) => {
      setStep("sticker");
      Animated.spring(stickerScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();

      if (child && scenario) {
        const sessionDuration = Date.now() - sessionStartRef.current;
        const resolvedActivity = activity ?? microActivity ?? null;

        try {
          await supabase.rpc("upsert_checkin", {
            p_child_id:         child.id,
            p_situation:        scenario.id,
            p_situation_choice: choiceValue,
            p_emotion:          emotion,
            p_dimension:        scenario.dimension,
            p_micro_activity:   resolvedActivity,
            p_session_duration: sessionDuration,
          });
        } catch (err) {
          console.warn("checkin finalize error:", err);
        }

        await AsyncStorage.setItem(todayKey(), "done");

        try {
          const { data: updatedChild } = await supabase
            .from("children")
            .select("luna_archetype")
            .eq("id", child.id)
            .single();
          if (
            updatedChild &&
            updatedChild.luna_archetype &&
            updatedChild.luna_archetype !== archetypeBefore
          ) {
            setArchetypeEvolved(true);
          }
        } catch (err) {
          console.warn("archetype check error:", err);
        }
      }
    },
    [stickerScale, child, scenario, choiceValue, emotion, microActivity, archetypeBefore]
  );

  const skipToSticker = useCallback(() => {
    showSticker(undefined);
  }, [showSticker]);

  function getDominantNeed(): MascotAction {
    if (!mascotState) return "play";
    const { hunger, cleanliness, happiness } = mascotState;
    const min = Math.min(hunger, cleanliness, happiness);
    if (min === hunger) return "feed";
    if (min === cleanliness) return "wash";
    return "play";
  }

  function getDominantNeedMessage(): string {
    if (!mascotState || !child) return "";
    const dominant = getDominantNeed();
    if (dominant === "feed") return `${child.mascot_name} tiene hambre`;
    if (dominant === "wash") return `${child.mascot_name} quiere ba\u00F1arse`;
    return `${child.mascot_name} quiere jugar`;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (step === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.doneText}>{errorMsg}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            styles.primaryBtnTop,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={() => {
            setStep("loading");
            setErrorMsg("");
            loadChild();
          }}
        >
          <Text style={styles.primaryBtnText}>Reintentar</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && styles.logoutBtnPressed,
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Cerrar sesi\u00F3n</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "done_today") {
    return (
      <View style={styles.center}>
        {child && (
          <PetDisplay
            mood="happy"
            name={child.mascot_name}
            size={220}
            mascotColor={(child.mascot_color as MascotColor) || undefined}
            archetype={(child.luna_archetype as LunaArchetype) || undefined}
          />
        )}
        <Text style={styles.doneText}>
          {"\u00A1"}{child?.mascot_name}{" te espera ma\u00F1ana!"}
        </Text>
        <Text style={styles.doneSubtext}>Hoy ya jugaron juntos</Text>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && styles.secondaryBtnPressed,
          ]}
          onPress={() => router.push("/(app)/summary")}
        >
          <Text style={styles.secondaryBtnText}>Resumen semanal (padres)</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            styles.secondaryBtnSmallTop,
            pressed && styles.secondaryBtnPressed,
          ]}
          onPress={() => router.push("/(app)/parent-pin")}
        >
          <Text style={styles.secondaryBtnText}>Modo padres</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && styles.logoutBtnPressed,
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Cerrar sesi\u00F3n</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "mascot_care" && child) {
    if (mascotCareAction) {
      return (
        <View style={styles.center}>
          <PetDisplay
            mood="happy"
            name={child.mascot_name}
            size={200}
            needsState={mascotState ?? undefined}
            mascotColor={(child.mascot_color as MascotColor) || undefined}
            archetype={(child.luna_archetype as LunaArchetype) || undefined}
          />
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
            name={child.mascot_name}
            size={200}
            needsState={mascotState ?? undefined}
            mascotColor={(child.mascot_color as MascotColor) || undefined}
            archetype={(child.luna_archetype as LunaArchetype) || undefined}
          />
        </View>

        {mascotState && (
          <View style={styles.needMessageRow}>
            <View
              style={[
                styles.needDot,
                { backgroundColor: MASCOT_ACTION_CONFIG[dominantNeed].accentColor },
              ]}
            />
            <Text style={styles.needMessage}>{getDominantNeedMessage()}</Text>
          </View>
        )}

        <View style={styles.mascotActions}>
          {(["feed", "wash", "play"] as MascotAction[]).map((action) => {
            const cfg = MASCOT_ACTION_CONFIG[action];
            const isDominant = action === dominantNeed;
            return (
              <Pressable
                key={action}
                style={({ pressed }) => [
                  styles.mascotActionCard,
                  isDominant && styles.mascotActionCardDominant,
                  pressed && styles.mascotActionCardPressed,
                ]}
                onPress={() => handleMascotAction(action)}
              >
                <View
                  style={[
                    styles.mascotActionBar,
                    { backgroundColor: cfg.accentColor },
                  ]}
                />
                <Text
                  style={[
                    styles.mascotActionLabel,
                    isDominant && styles.mascotActionLabelDominant,
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
                      style={[
                        styles.dominantChipText,
                        { color: cfg.accentColor },
                      ]}
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
          style={({ pressed }) => [
            styles.skipBtn,
            pressed && styles.skipBtnPressed,
          ]}
          onPress={() => {
            setScenario(getScenarioForToday(child.id));
            setStep("scenario");
          }}
        >
          <Text style={styles.skipText}>Saltar</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "scenario" && scenario && child) {
    return (
      <View style={styles.container}>
        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={160}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <View style={styles.spacer24} />
        <ScenarioCard
          scenario={scenario}
          petName={child.mascot_name}
          onChoose={handleChoice}
        />
      </View>
    );
  }

  if (step === "emotion" && child) {
    return (
      <View style={styles.container}>
        <PetDisplay
          mood="neutral"
          name={child.mascot_name}
          size={140}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <EmotionPicker
          onSelect={handleEmotion}
          selected={emotion}
          petName={child.mascot_name}
        />
      </View>
    );
  }

  if (step === "reaction" && child && reaction) {
    return (
      <View style={styles.container}>
        <PetDisplay
          mood={petMood}
          name={child.mascot_name}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <Text style={styles.reactionText}>{reaction.message}</Text>
        <View style={styles.reactionButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.breatheBtn,
              pressed && styles.breatheBtnPressed,
            ]}
            onPress={startBreathe}
          >
            <Text style={styles.breatheText}>
              Respirar con {child.mascot_name}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.skipReactionBtn,
              pressed && styles.skipBtnPressed,
            ]}
            onPress={skipToSticker}
          >
            <Text style={styles.skipText}>Siguiente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "breathe" && child) {
    return (
      <View style={styles.center}>
        <Text style={styles.breatheTitle}>
          Respira con {child.mascot_name}
        </Text>
        <Animated.View
          style={[
            styles.breatheCircle,
            { transform: [{ scale: breathScale }] },
          ]}
        >
          <Text style={styles.breatheCounterInside}>{breathCycle}</Text>
        </Animated.View>
        <Text style={styles.breatheHint}>Inhala... Exhala...</Text>
      </View>
    );
  }

  if (step === "sticker" && child) {
    return (
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.stickerContainer,
            { transform: [{ scale: stickerScale }] },
          ]}
        >
          <View style={styles.starBg}>
            <Text style={styles.starIcon}>★</Text>
          </View>
        </Animated.View>
        <Text style={styles.stickerText}>
          {"\u00A1Ganaste tu estrella!"}
        </Text>

        {archetypeEvolved && child.luna_archetype && (
          <Text style={styles.evolvedText}>
            {"\u00A1Luna ha evolucionado a "}
            {child.luna_archetype.charAt(0).toUpperCase() +
              child.luna_archetype.slice(1)}
            {"!"}
          </Text>
        )}

        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={120}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
          archetype={(child.luna_archetype as LunaArchetype) || undefined}
        />
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            styles.primaryBtnTop,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={() => setStep("done_today")}
        >
          <Text style={styles.primaryBtnText}>
            Volver con {child.mascot_name}
          </Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

async function handleLogout() {
  await supabase.auth.signOut();
  router.replace("/(auth)/login");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: "center",
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  petSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  spacer24: { height: 24 },
  // Need message
  needMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
    alignSelf: "center",
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
  // Mascot care action cards
  mascotActions: {
    width: "100%",
    gap: 12,
  },
  mascotActionCard: {
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
  mascotActionCardDominant: {
    elevation: 4,
    shadowOpacity: 0.1,
  },
  mascotActionCardPressed: {
    opacity: 0.82,
  },
  mascotActionBar: {
    width: 4,
    alignSelf: "stretch",
  },
  mascotActionLabel: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    paddingHorizontal: 16,
  },
  mascotActionLabelDominant: {
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
  // Done today
  doneText: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    marginTop: 24,
    textAlign: "center",
  },
  doneSubtext: {
    fontSize: 16,
    fontFamily: fonts.display,
    color: theme.textSecondary,
    marginTop: 8,
    marginBottom: 24,
  },
  // Buttons
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnTop: {
    marginTop: 24,
  },
  primaryBtnPressed: {
    backgroundColor: theme.primaryDark,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
  },
  secondaryBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.border,
  },
  secondaryBtnSmallTop: {
    marginTop: 8,
  },
  secondaryBtnPressed: {
    backgroundColor: colors.gray[100],
  },
  secondaryBtnText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  logoutBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutBtnPressed: {
    opacity: 0.5,
  },
  logoutText: {
    color: theme.textLight,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  // Skip
  skipBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  skipBtnPressed: {
    opacity: 0.5,
  },
  skipReactionBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  skipText: {
    color: theme.textLight,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  // Reaction
  reactionText: {
    fontSize: 18,
    fontFamily: fonts.display,
    color: theme.dark,
    textAlign: "center",
    marginTop: 24,
    marginHorizontal: 8,
    lineHeight: 28,
  },
  reactionButtons: {
    marginTop: 32,
    width: "100%",
    gap: 12,
  },
  breatheBtn: {
    backgroundColor: colors.mint[500],
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  breatheBtnPressed: {
    backgroundColor: colors.mint[700],
  },
  breatheText: {
    color: colors.white,
    fontSize: 17,
    fontFamily: fonts.displaySemiBold,
  },
  // Breathe step
  breatheTitle: {
    fontSize: 22,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    marginBottom: 40,
    textAlign: "center",
  },
  breatheCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.mint[300],
    alignItems: "center",
    justifyContent: "center",
  },
  breatheCounterInside: {
    fontSize: 64,
    fontFamily: fonts.displayBold,
    color: colors.white,
  },
  breatheHint: {
    fontSize: 18,
    fontFamily: fonts.display,
    color: theme.textSecondary,
    marginTop: 32,
  },
  // Sticker
  stickerContainer: { marginBottom: 16 },
  starBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.orange[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.orange[300],
  },
  starIcon: {
    fontSize: 40,
    color: colors.orange[500],
  },
  stickerText: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    marginBottom: 8,
    textAlign: "center",
  },
  evolvedText: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: colors.purple[700],
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  // Thanks
  thanksText: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    marginTop: 16,
    textAlign: "center",
  },
});
