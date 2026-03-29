import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Circle, Ellipse, Path, Svg } from "react-native-svg";
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
import type { MascotColor } from "../../lib/types/database";

type Step =
  | "loading"
  | "mascot_care"
  | "care_thanks"
  | "scenario"
  | "emotion"
  | "reaction"
  | "breathe"
  | "sticker"
  | "done_today"
  | "done_care_thanks"
  | "error";

interface ChildData {
  id: string;
  name: string;
  mascot_name: string;
  mascot_color: string;
}

// Breathe phases
const BREATHE_PHASES = [
  { label: "Inhala…", desc: "Llena tu panza de aire", duration: 3500 },
  { label: "Aguanta…", desc: "Aguanta el aire", duration: 1500 },
  { label: "Exhala…", desc: "Suelta el aire", duration: 3500 },
  { label: "Descansa", desc: "Descansa", duration: 1000 },
];
const TOTAL_CYCLES = 4;

// SVG icons — emoji don't render with custom fonts in React Native
function AppleIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Body */}
      <Ellipse cx="16" cy="19" rx="11" ry="10" fill="#E74C3C" />
      {/* Highlight */}
      <Ellipse cx="12" cy="15" rx="3.5" ry="3" fill="#FF6B6B" opacity="0.6" />
      {/* Stem */}
      <Path d="M16 10 Q17 6 20 5" stroke="#5D4037" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Leaf */}
      <Path d="M16 10 Q20 8 21 11 Q18 12 16 10Z" fill="#27AE60" />
    </Svg>
  );
}

function BathIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Tub body */}
      <Path d="M4 17 Q4 26 16 26 Q28 26 28 17 Z" fill="#90CAF9" />
      {/* Tub rim */}
      <Path d="M3 17 H29" stroke="#5B8DB8" strokeWidth="2" strokeLinecap="round" />
      {/* Left leg */}
      <Path d="M7 26 L6 30" stroke="#5B8DB8" strokeWidth="2" strokeLinecap="round" />
      {/* Right leg */}
      <Path d="M25 26 L26 30" stroke="#5B8DB8" strokeWidth="2" strokeLinecap="round" />
      {/* Faucet pipe */}
      <Path d="M7 17 L7 8" stroke="#78909C" strokeWidth="2.5" strokeLinecap="round" />
      {/* Water drops */}
      <Circle cx="14" cy="13" r="1.5" fill="#64B5F6" opacity="0.8" />
      <Circle cx="18" cy="11" r="1" fill="#64B5F6" opacity="0.6" />
      <Circle cx="21" cy="14" r="1.2" fill="#64B5F6" opacity="0.7" />
    </Svg>
  );
}

function BallIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Ball body */}
      <Circle cx="16" cy="16" r="13" fill="#CDDC39" />
      {/* White seam curves */}
      <Path d="M6 10 Q12 16 6 22" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M26 10 Q20 16 26 22" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Highlight */}
      <Ellipse cx="12" cy="11" rx="3" ry="2" fill="white" opacity="0.25" />
    </Svg>
  );
}

const CARE_CARDS = [
  {
    color: colors.orange[500],
    icon: "apple" as const,
    getTitle: () => "Darle de comer",
    getSubtitle: (n: string) => `${n} tiene mucha hambre hoy`,
    urgent: true,
  },
  {
    color: colors.mint[500],
    icon: "bath" as const,
    getTitle: () => "Darle un baño",
    getSubtitle: () => "¡El pelo está muy enredado!",
    urgent: false,
  },
  {
    color: colors.purple[500],
    icon: "ball" as const,
    getTitle: (n: string) => `Jugar con ${n}`,
    getSubtitle: () => "Quiere correr y saltar",
    urgent: false,
  },
];

function getMoodTitle(mood: PetMood): string {
  switch (mood) {
    case "happy":
      return "¡Luna está muy contenta!";
    case "neutral":
      return "Luna está tranquila";
    case "sad":
      return "Luna siente lo mismo que tú";
    case "angry":
      return "Luna lo entiende";
    case "scared":
      return "Luna está aquí contigo";
    default:
      return "Luna está aquí contigo";
  }
}

async function loadStreak(childId: string): Promise<boolean[]> {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  const results: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `checkin-${childId}-${d.toISOString().slice(0, 10)}`;
    const val = await AsyncStorage.getItem(key);
    results.push(val === "1");
  }
  return results;
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("loading");
  const [child, setChild] = useState<ChildData | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [choiceValue, setChoiceValue] = useState<string>("");
  const [emotion, setEmotion] = useState<string | null>(null);
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [petMood, setPetMood] = useState<PetMood>("happy");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [streak, setStreak] = useState<boolean[]>([]);

  // Breathe state
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(0);

  // Animations
  const breathScale = useRef(new Animated.Value(1)).current;
  const stickerScale = useRef(new Animated.Value(0.2)).current;

  // Timer refs for cleanup
  const breathTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const careThankTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Cleanup all timers
  const clearBreathTimers = useCallback(() => {
    breathTimersRef.current.forEach(clearTimeout);
    breathTimersRef.current = [];
    if (breathAnimRef.current) {
      breathAnimRef.current.stop();
      breathAnimRef.current = null;
    }
  }, []);

  const clearCareTimer = useCallback(() => {
    if (careThankTimerRef.current) {
      clearTimeout(careThankTimerRef.current);
      careThankTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearBreathTimers();
      clearCareTimer();
    };
  }, [clearBreathTimers, clearCareTimer]);

  // Load child data on mount
  const loadChild = useCallback(async () => {
    try {
      setStep("loading");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const { data: children, error } = await supabase
        .from("children")
        .select("id, name, mascot_name, mascot_color")
        .eq("parent_id", user.id)
        .limit(1);

      if (error) throw error;

      if (!children || children.length === 0) {
        router.replace("/(app)/welcome-onboarding");
        return;
      }

      // No mascot color yet — still needs to complete select-mascot step
      if (!children[0].mascot_color) {
        router.replace("/(app)/select-mascot");
        return;
      }

      const c = children[0] as ChildData;
      setChild(c);

      scheduleMondaySummaryNotification(c.mascot_name).catch(console.warn);

      const todayKey = `checkin-${c.id}-${new Date().toISOString().slice(0, 10)}`;
      const done = await AsyncStorage.getItem(todayKey);

      if (done === "1") {
        const s = await loadStreak(c.id);
        setStreak(s);
        setStep("done_today");
      } else {
        const sc = getScenarioForToday(c.id);
        setScenario(sc);
        setStep("mascot_care");
      }
    } catch (err) {
      console.warn("loadChild error:", err);
      setErrorMsg("No pudimos cargar los datos. Revisa tu conexión.");
      setStep("error");
    }
  }, []);

  useEffect(() => {
    loadChild();
  }, [loadChild]);

  // Load streak when entering done_today
  useEffect(() => {
    if (step === "done_today" && child) {
      loadStreak(child.id).then(setStreak).catch(console.warn);
    }
  }, [step, child]);

  // Breathe animation + phase tracking
  useEffect(() => {
    if (step !== "breathe") {
      clearBreathTimers();
      return;
    }

    setCurrentPhase(0);
    setCurrentCycle(0);
    breathScale.setValue(1);

    // Scale animation loop (inhale + exhale phases only)
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, {
          toValue: 1.22,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(breathScale, {
          toValue: 1.0,
          duration: 3500,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    breathAnimRef.current = anim;

    // Phase tracking
    const totalMs = TOTAL_CYCLES * BREATHE_PHASES.reduce((s, p) => s + p.duration, 0);
    let elapsed = 0;

    for (let cycle = 0; cycle < TOTAL_CYCLES; cycle++) {
      for (let phase = 0; phase < BREATHE_PHASES.length; phase++) {
        const cycleCapture = cycle;
        const phaseCapture = phase;
        const t = setTimeout(() => {
          setCurrentCycle(cycleCapture);
          setCurrentPhase(phaseCapture);
        }, elapsed);
        breathTimersRef.current.push(t);
        elapsed += BREATHE_PHASES[phase].duration;
      }
    }

    // Auto-advance after all cycles
    const doneTimer = setTimeout(() => {
      setStep("sticker");
    }, totalMs);
    breathTimersRef.current.push(doneTimer);

    return () => {
      clearBreathTimers();
    };
  }, [step]);

  // Sticker animation
  useEffect(() => {
    if (step === "sticker") {
      stickerScale.setValue(0.2);
      Animated.spring(stickerScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [step]);

  const handleCareCard = useCallback((fromDone = false) => {
    clearCareTimer();
    setStep(fromDone ? "done_care_thanks" : "care_thanks");
    const t = setTimeout(() => {
      setStep(fromDone ? "done_today" : "scenario");
    }, 1600);
    careThankTimerRef.current = t;
  }, [clearCareTimer]);

  const handleChoice = useCallback((value: string) => {
    setChoiceValue(value);
    setEmotion(null);
    setStep("emotion");
  }, []);

  const handleNextEmotion = useCallback(() => {
    if (!child || !scenario || !emotion) return;
    const r = getPetReaction(scenario.dimension, choiceValue, child.mascot_name, emotion);
    setReaction(r);
    setPetMood(r.mood);
    setStep("reaction");

    supabase
      .from("checkins")
      .insert({
        child_id: child.id,
        situation: scenario.situation,
        situation_choice: choiceValue,
        emotion: emotion,
        dimension: scenario.dimension,
        check_date: new Date().toISOString().slice(0, 10),
      })
      .then(({ error }) => { if (error) console.warn(error); });
  }, [child, scenario, choiceValue, emotion]);

  const handleBreathe = useCallback(() => {
    setStep("breathe");
  }, []);

  const markDone = useCallback(async () => {
    if (!child) return;
    const todayKey = `checkin-${child.id}-${new Date().toISOString().slice(0, 10)}`;
    await AsyncStorage.setItem(todayKey, "1");
    const s = await loadStreak(child.id);
    setStreak(s);
  }, [child]);

  const handleStickerDone = useCallback(async () => {
    await markDone();
    setStep("done_today");
  }, [markDone]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }, []);

  // ── Renders ───────────────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (step === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Algo salió mal</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.pillBtn,
            styles.pillBtnPurple,
            styles.pillBtnTop,
            pressed && { opacity: 0.82 },
          ]}
          onPress={loadChild}
        >
          <Text style={styles.pillBtnText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "mascot_care" && child) {
    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Pet */}
        <View style={styles.petTop}>
          <PetDisplay
            mood="neutral"
            name={child.mascot_name}
            size={180}
            mascotColor={(child.mascot_color as MascotColor) || undefined}
          />
        </View>

        {/* Status indicator */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: colors.orange[500] }]} />
          <Text style={styles.statusLabel}>{child.mascot_name} tiene hambre</Text>
        </View>

        {/* Care cards */}
        <View style={styles.careCards}>
          {CARE_CARDS.map((card, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.careCard,
                pressed && { opacity: 0.82 },
              ]}
              onPress={() => handleCareCard(false)}
            >
              <View style={[styles.careCardBar, { backgroundColor: card.color }]} />
              <View style={styles.careCardInner}>
                {card.icon === "apple" ? <AppleIcon size={36} /> : card.icon === "bath" ? <BathIcon size={36} /> : <BallIcon size={36} />}
                <View style={styles.careCardText}>
                  <Text style={styles.careCardTitle}>{card.getTitle(child.mascot_name)}</Text>
                  <Text style={styles.careCardSubtitle}>{card.getSubtitle(child.mascot_name)}</Text>
                </View>
                {card.urgent && (
                  <View style={styles.urgentChip}>
                    <Text style={styles.urgentChipText}>Lo necesita</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

      </ScrollView>
    );
  }

  if (step === "care_thanks" && child) {
    return (
      <View style={styles.center}>
        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={160}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <Text style={styles.careThanksTitle}>¡Gracias por cuidarla!</Text>
        <Text style={styles.careThanksSubtitle}>{child.mascot_name} está muy feliz</Text>
      </View>
    );
  }

  if (step === "scenario" && scenario && child) {
    return (
      <View style={[styles.scenarioContainer, { paddingTop: insets.top + 20 }]}>
        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={140}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <View style={{ height: 12 }} />
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
      <ScrollView
        contentContainerStyle={[styles.emotionScrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <PetDisplay
          mood="neutral"
          name={child.mascot_name}
          size={120}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <View style={{ height: 12 }} />
        <Text style={styles.emotionQuestion}>¿Cómo te sientes tú ahora?</Text>
        <EmotionPicker selected={emotion} onSelect={setEmotion} />
        <Pressable
          style={({ pressed }) => [
            styles.pillBtn,
            styles.pillBtnPurple,
            styles.pillBtnTop,
            !emotion && styles.pillBtnDisabled,
            pressed && emotion ? { opacity: 0.82 } : null,
          ]}
          onPress={handleNextEmotion}
          disabled={!emotion}
        >
          <Text style={styles.pillBtnText}>Siguiente</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === "reaction" && child && reaction) {
    const moodTitle = getMoodTitle(petMood);
    return (
      <ScrollView
        contentContainerStyle={[styles.reactionScrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <PetDisplay
          mood={petMood}
          name={child.mascot_name}
          size={160}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <View style={{ height: 12 }} />
        <View style={styles.reactionBox}>
          <Text style={styles.reactionBoxTitle}>{moodTitle}</Text>
          <Text style={styles.reactionBoxBody}>{reaction.message}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.pillBtn,
            styles.pillBtnMint,
            styles.pillBtnTop,
            pressed && { opacity: 0.82 },
          ]}
          onPress={handleBreathe}
        >
          <Text style={styles.pillBtnText}>Respirar con {child.mascot_name}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.ghostBtn,
            pressed && { opacity: 0.6 },
          ]}
          onPress={() => setStep("sticker")}
        >
          <Text style={styles.ghostBtnText}>Siguiente</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === "breathe" && child) {
    const phase = BREATHE_PHASES[currentPhase];
    const scale = breathScale.interpolate({
      inputRange: [1, 1.22],
      outputRange: [1, 1.22],
    });
    return (
      <ScrollView
        contentContainerStyle={[styles.breatheScrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.breatheTitle}>Respira con {child.mascot_name}</Text>
        <Text style={styles.breatheSubtitle}>4 respiraciones juntos</Text>

        {/* Breathing ring */}
        <View style={styles.breatheRingWrap}>
          <Animated.View
            style={[
              styles.breatheRingOuter,
              { transform: [{ scale }] },
            ]}
          >
            <View style={styles.breatheRingInner} />
          </Animated.View>
        </View>

        <Text style={styles.breathePhaseLabel}>{phase.label}</Text>
        <Text style={styles.breathePhaseDesc}>{phase.desc}</Text>

        {/* Dots counter */}
        <View style={styles.breatheDots}>
          {Array.from({ length: TOTAL_CYCLES }).map((_, i) => {
            const isDone = i < currentCycle;
            const isActive = i === currentCycle;
            return (
              <View
                key={i}
                style={[
                  styles.breatheDot,
                  isDone && styles.breatheDotDone,
                  isActive && styles.breatheDotActive,
                ]}
              />
            );
          })}
        </View>

        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={80}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />

        <Pressable
          style={({ pressed }) => [
            styles.pillBtn,
            styles.pillBtnPurple,
            styles.pillBtnTop,
            pressed && { opacity: 0.82 },
          ]}
          onPress={() => {
            clearBreathTimers();
            setStep("sticker");
          }}
        >
          <Text style={styles.pillBtnText}>Listo</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === "sticker" && child) {
    return (
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.stickerBadge,
            { transform: [{ scale: stickerScale }] },
          ]}
        >
          <Text style={styles.stickerStar}>★</Text>
        </Animated.View>
        <Text style={styles.stickerTitle}>¡Ganaste tu estrella!</Text>
        <Text style={styles.stickerSubtitle}>
          Hoy hiciste algo muy especial con {child.mascot_name}
        </Text>
        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={120}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <Pressable
          style={({ pressed }) => [
            styles.pillBtn,
            styles.pillBtnPurple,
            styles.pillBtnTop,
            pressed && { opacity: 0.82 },
          ]}
          onPress={handleStickerDone}
        >
          <Text style={styles.pillBtnText}>Volver con {child.mascot_name}</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "done_care_thanks" && child) {
    return (
      <View style={styles.center}>
        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={160}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <Text style={styles.careThanksTitle}>¡Gracias por cuidarla!</Text>
        <Text style={styles.careThanksSubtitle}>{child.mascot_name} está muy feliz</Text>
      </View>
    );
  }

  if (step === "done_today" && child) {
    return (
      <ScrollView
        contentContainerStyle={[styles.doneScrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <PetDisplay
          mood="happy"
          name={child.mascot_name}
          size={160}
          mascotColor={(child.mascot_color as MascotColor) || undefined}
        />
        <Text style={styles.doneTitle}>¡{child.mascot_name} te espera mañana!</Text>
        <Text style={styles.doneSubtitle}>Hoy ya jugaron juntos</Text>

        {/* Care cards — el niño siempre puede cuidar a Luna */}
        <View style={styles.careCards}>
          {CARE_CARDS.map((card, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.careCard,
                pressed && { opacity: 0.82 },
              ]}
              onPress={() => handleCareCard(true)}
            >
              <View style={[styles.careCardBar, { backgroundColor: card.color }]} />
              <View style={styles.careCardInner}>
                {card.icon === "apple" ? <AppleIcon size={36} /> : card.icon === "bath" ? <BathIcon size={36} /> : <BallIcon size={36} />}
                <View style={styles.careCardText}>
                  <Text style={styles.careCardTitle}>{card.getTitle(child.mascot_name)}</Text>
                  <Text style={styles.careCardSubtitle}>{card.getSubtitle(child.mascot_name)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Streak card */}
        <View style={styles.streakCard}>
          <Text style={styles.streakLabel}>RACHA ACTUAL</Text>
          <View style={styles.streakDots}>
            {Array.from({ length: 7 }).map((_, i) => {
              const done = streak[i] === true;
              // Opacity: count from right among done days
              let dotOpacity = 1;
              if (done) {
                const doneAfter = streak.slice(i + 1).filter(Boolean).length;
                const opacities = [1.0, 0.8, 0.6, 0.4, 0.3];
                dotOpacity = opacities[Math.min(doneAfter, opacities.length - 1)];
              }
              return (
                <View
                  key={i}
                  style={[
                    styles.streakDot,
                    done
                      ? [styles.streakDotDone, { opacity: dotOpacity }]
                      : styles.streakDotPending,
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.streakDayLabels}>{DAY_LABELS.join("  ")}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          onPress={() => router.push("/(app)/summary")}
        >
          <Text style={styles.summaryLink}>Resumen semanal (padres) →</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutLink}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  // ── mascot_care ────────────────────────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  petTop: {
    alignItems: "center",
    paddingBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    fontWeight: "600",
    color: colors.gray[700],
  },
  careCards: {
    width: "100%",
    gap: 10,
  },
  careCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  careCardBar: {
    width: 5,
  },
  careCardInner: {
    flex: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  careCardText: {
    flex: 1,
  },
  careCardTitle: {
    fontSize: 16,
    fontFamily: fonts.display,
    color: theme.dark,
  },
  careCardSubtitle: {
    fontSize: 12.5,
    fontFamily: fonts.body,
    color: colors.gray[500],
    marginTop: 2,
  },
  urgentChip: {
    backgroundColor: colors.orange[50],
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  urgentChipText: {
    fontSize: 11.5,
    fontFamily: fonts.bodySemiBold,
    fontWeight: "600",
    color: colors.orange[500],
  },
  ghostBtn: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 8,
  },
  ghostBtnText: {
    fontSize: 14,
    fontFamily: fonts.display,
    color: colors.purple[500],
  },

  // ── care_thanks ───────────────────────────────────────────────────────────
  careThanksTitle: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: theme.dark,
    marginTop: 12,
    textAlign: "center",
  },
  careThanksSubtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.gray[500],
    marginTop: 4,
    textAlign: "center",
  },

  // ── scenario ──────────────────────────────────────────────────────────────
  scenarioContainer: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // ── emotion ───────────────────────────────────────────────────────────────
  emotionScrollContent: {
    flexGrow: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emotionQuestion: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 8,
  },

  // ── reaction ──────────────────────────────────────────────────────────────
  reactionScrollContent: {
    flexGrow: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  reactionBox: {
    backgroundColor: colors.purple[50],
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: "100%",
    marginVertical: 8,
  },
  reactionBoxTitle: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    fontWeight: "600",
    color: colors.purple[700],
    marginBottom: 6,
  },
  reactionBoxBody: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: theme.dark,
    lineHeight: 22,
  },

  // ── breathe ───────────────────────────────────────────────────────────────
  breatheScrollContent: {
    flexGrow: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  breatheTitle: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 4,
  },
  breatheSubtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 8,
  },
  breatheRingWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    width: 200,
    height: 200,
  },
  breatheRingOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(110,231,183,0.25)",
    borderWidth: 3,
    borderColor: colors.mint[300],
    alignItems: "center",
    justifyContent: "center",
  },
  breatheRingInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.mint[500],
    opacity: 0.7,
  },
  breathePhaseLabel: {
    fontSize: 21,
    fontFamily: fonts.display,
    color: colors.mint[700],
    textAlign: "center",
    marginTop: 10,
  },
  breathePhaseDesc: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginTop: 4,
  },
  breatheDots: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 12,
  },
  breatheDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gray[200],
  },
  breatheDotDone: {
    backgroundColor: colors.mint[500],
  },
  breatheDotActive: {
    backgroundColor: colors.mint[700],
    transform: [{ scale: 1.3 }],
  },

  // ── sticker ───────────────────────────────────────────────────────────────
  stickerBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFA500",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 8,
    marginBottom: 8,
  },
  stickerStar: {
    fontSize: 52,
    color: "#FF9800",
    lineHeight: 64,
  },
  stickerTitle: {
    fontSize: 32,
    fontFamily: fonts.display,
    color: theme.dark,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  stickerSubtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 8,
  },

  // ── done_today ────────────────────────────────────────────────────────────
  doneScrollContent: {
    flexGrow: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  doneTitle: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 6,
    marginTop: 0,
  },
  doneSubtitle: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 24,
  },
  streakCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  streakLabel: {
    fontSize: 14,
    fontFamily: fonts.display,
    fontWeight: "600",
    color: colors.gray[500],
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  streakDots: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  streakDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  streakDotDone: {
    backgroundColor: colors.purple[500],
  },
  streakDotPending: {
    backgroundColor: colors.gray[100],
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.gray[200],
  },
  streakDayLabels: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.gray[300],
    marginTop: 8,
    textAlign: "center",
    letterSpacing: 2,
  },
  summaryLink: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    fontWeight: "500",
    color: colors.purple[500],
    textAlign: "center",
    marginTop: 12,
  },
  logoutLink: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.gray[300],
    textAlign: "center",
    marginTop: 4,
  },

  // ── error ─────────────────────────────────────────────────────────────────
  errorTitle: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
  },

  // ── shared buttons ────────────────────────────────────────────────────────
  pillBtn: {
    borderRadius: 50,
    paddingVertical: 17,
    paddingHorizontal: 32,
    alignItems: "center",
    width: "100%",
  },
  pillBtnPurple: {
    backgroundColor: colors.purple[500],
  },
  pillBtnMint: {
    backgroundColor: colors.mint[500],
  },
  pillBtnDisabled: {
    opacity: 0.4,
  },
  pillBtnTop: {
    marginTop: 16,
  },
  pillBtnText: {
    fontSize: 16,
    fontFamily: fonts.display,
    color: colors.white,
    fontWeight: "600",
  },
});
