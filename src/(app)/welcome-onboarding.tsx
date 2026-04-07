import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, fonts, theme } from "../../lib/theme";
import PetDisplay from "../../components/PetDisplay";
import { Circle, Line, Path, Rect, Svg } from "react-native-svg";

// ─── SVG Icons (emoji don't render with custom fonts in React Native) ──────────

function CalendarSvg({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Rect x="2" y="5" width="24" height="20" rx="3" fill="white" stroke="#E2E8F0" strokeWidth="1" />
      <Rect x="2" y="5" width="24" height="8" rx="3" fill="#EF4444" />
      <Rect x="2" y="10" width="24" height="3" fill="#EF4444" />
      <Rect x="9" y="2" width="3" height="6" rx="1.5" fill="#94A3B8" />
      <Rect x="16" y="2" width="3" height="6" rx="1.5" fill="#94A3B8" />
      <Rect x="10" y="13" width="8" height="2" rx="1" fill="rgba(255,255,255,0.7)" />
      <Rect x="8" y="16" width="12" height="2" rx="1" fill="rgba(255,255,255,0.5)" />
      <Rect x="6" y="18" width="4" height="3" rx="1" fill="#CBD5E1" />
      <Rect x="12" y="18" width="4" height="3" rx="1" fill="#CBD5E1" />
      <Rect x="18" y="18" width="4" height="3" rx="1" fill="#CBD5E1" />
    </Svg>
  );
}

function ChartSvg({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Rect x="3" y="18" width="5" height="8" rx="1.5" fill="#EF4444" />
      <Rect x="11" y="10" width="5" height="16" rx="1.5" fill="#F97316" />
      <Rect x="19" y="5" width="5" height="21" rx="1.5" fill="#22C55E" />
      <Line x1="2" y1="26" x2="26" y2="26" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function TargetSvg({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx="14" cy="14" r="12" fill="#EF4444" />
      <Circle cx="14" cy="14" r="8" fill="white" />
      <Circle cx="14" cy="14" r="4" fill="#EF4444" />
      <Path d="M22 6 L20 10 L16 8 Z" fill="#4B5563" />
      <Line x1="14" y1="14" x2="21" y2="7" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function BulbSvg({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3C8.7 3 6 5.7 6 9c0 2.4 1.3 4.4 3.3 5.5V17h5.4v-2.5C16.7 13.4 18 11.4 18 9c0-3.3-2.7-6-6-6z" fill="#FCD34D" />
      <Rect x="9.3" y="17" width="5.4" height="1.5" rx="0.75" fill="#D1A827" />
      <Rect x="10" y="19" width="4" height="1.5" rx="0.75" fill="#D1A827" />
      <Line x1="12" y1="1" x2="12" y2="2.2" stroke="#FCD34D" strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="5" y1="3.5" x2="5.8" y2="4.3" stroke="#FCD34D" strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="19" y1="3.5" x2="18.2" y2="4.3" stroke="#FCD34D" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}

function NoSvg({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill="#EF4444" />
      <Line x1="5.5" y1="5.5" x2="18.5" y2="18.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

function TagSvg({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 7.5L3 3.5 7.5 3.5 14.5 10.5 10.5 14.5Z" fill="#F59E0B" />
      <Circle cx="6" cy="6" r="1" fill="white" />
      <Path d="M10.5 14.5L14.5 10.5 20.5 16.5 16.5 20.5Z" fill="#FCD34D" />
    </Svg>
  );
}

function EyeSvg({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 12C2 12 5 6 12 6C19 6 22 12 22 12C22 12 19 18 12 18C5 18 2 12 2 12Z" fill="#7C3AED" opacity="0.15" stroke="#7C3AED" strokeWidth="1.5" />
      <Circle cx="12" cy="12" r="3" fill="#7C3AED" />
      <Circle cx="13" cy="11" r="1" fill="white" opacity="0.7" />
    </Svg>
  );
}

function TrashSvg({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7H20" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M10 7V5H14V7" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 7L7 19H17L18 7" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="10" y1="11" x2="10" y2="16" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="14" y1="11" x2="14" y2="16" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function PersonSvg({ size = 18, color = colors.gray[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" fill={color} />
      <Path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStep =
  | "welcome"
  | "value-prop"
  | "child-name"
  | "child-age"
  | "relationship"
  | "privacy"
  | "loading"
  | "handoff"
  | "error";

const PROGRESS_STEPS: OnboardingStep[] = [
  "child-name",
  "child-age",
  "relationship",
  "privacy",
];

const RELATIONSHIPS: { label: string; color: string }[] = [
  { label: "Mamá", color: "#F472B6" },
  { label: "Papá", color: "#60A5FA" },
  { label: "Abuelo·a", color: "#FB923C" },
  { label: "Tutor·a", color: "#34D399" },
  { label: "Otro", color: "#A78BFA" },
];

const AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

const BACK_STEPS: Record<OnboardingStep, OnboardingStep | null> = {
  welcome: null,
  "value-prop": "welcome",
  "child-name": "value-prop",
  "child-age": "child-name",
  relationship: "child-age",
  privacy: "relationship",
  loading: null,
  handoff: null,
  error: null,
};

// ─── Atoms ────────────────────────────────────────────────────────────────────

function PillButton({
  label,
  variant = "purple",
  disabled = false,
  onPress,
}: {
  label: string;
  variant?: "purple" | "mint" | "orange";
  disabled?: boolean;
  onPress: () => void;
}) {
  const bg = { purple: colors.purple[500], mint: colors.mint[500], orange: colors.orange[500] }[variant];
  const shadowColor = {
    purple: "rgba(123,97,255,0.35)",
    mint: "rgba(52,211,153,0.35)",
    orange: "rgba(249,115,22,0.38)",
  }[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        a.pill,
        { backgroundColor: bg, shadowColor },
        disabled && a.pillDisabled,
        pressed && !disabled && { opacity: 0.88 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={a.pillText}>{label}</Text>
    </Pressable>
  );
}

function BackButton({ onPress, insetTop = 0 }: { onPress: () => void; insetTop?: number }) {
  return (
    <Pressable
      style={({ pressed }) => [a.backBtn, { top: insetTop + 8 }, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Text style={a.backBtnText}>←</Text>
    </Pressable>
  );
}

function InfoBlock({ text }: { text: string }) {
  return (
    <View style={a.infoBlock}>
      <BulbSvg size={22} />
      <Text style={a.infoText}>{text}</Text>
    </View>
  );
}

function ProgressBar({ step }: { step: OnboardingStep }) {
  const idx = PROGRESS_STEPS.indexOf(step);
  if (idx < 0) return null;

  const target = (idx + 1) / PROGRESS_STEPS.length;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration: 380,
      useNativeDriver: false,
    }).start();
  }, [target]);

  return (
    <View style={a.progressTrack}>
      <Animated.View
        style={[
          a.progressFill,
          {
            width: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

// ─── Molecules ────────────────────────────────────────────────────────────────

function ValueBubble({
  icon,
  title,
  desc,
}: {
  icon: "calendar" | "chart" | "target";
  title: string;
  desc: string;
}) {
  return (
    <View style={m.bubble}>
      <View style={m.bubbleIconWrap}>
        {icon === "calendar" ? <CalendarSvg size={32} /> : icon === "chart" ? <ChartSvg size={32} /> : <TargetSvg size={32} />}
      </View>
      <View style={m.bubbleText}>
        <Text style={m.bubbleTitle}>{title}</Text>
        <Text style={m.bubbleDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function AgeChip({
  age,
  selected,
  onPress,
}: {
  age: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        m.ageChip,
        selected && m.ageChipSelected,
        pressed && !selected && { backgroundColor: colors.gray[100] },
      ]}
      onPress={onPress}
    >
      <Text style={[m.ageNum, selected && m.ageNumSelected]}>{age}</Text>
      <Text style={[m.ageLabel, selected && m.ageLabelSelected]}>años</Text>
    </Pressable>
  );
}

function RelChip({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        m.relChip,
        selected && m.relChipSelected,
        pressed && !selected && { backgroundColor: colors.gray[100] },
      ]}
      onPress={onPress}
    >
      <View style={[m.relChipIconCircle, { backgroundColor: color + "33" }]}>
        <PersonSvg size={16} color={color} />
      </View>
      <Text style={[m.relChipText, selected && m.relChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PrivacyItem({
  icon = "no",
  title,
  desc,
}: {
  icon?: "no" | "tag" | "eye" | "trash";
  title: string;
  desc: string;
}) {
  return (
    <View style={m.privacyItem}>
      {icon === "no" ? <NoSvg size={22} /> : icon === "tag" ? <TagSvg size={22} /> : icon === "eye" ? <EyeSvg size={22} /> : <TrashSvg size={22} />}
      <View style={{ flex: 1 }}>
        <Text style={m.privacyTitle}>{title}</Text>
        <Text style={m.privacyDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ─── Organism: Loading bar ────────────────────────────────────────────────────

function LoadingBar({
  progress,
  childName,
}: {
  progress: Animated.Value;
  childName: string;
}) {
  const labelOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={o.loadingBarWrap}>
      <View style={o.loadingTrack}>
        <Animated.View
          style={[
            o.loadingFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <Animated.Text style={[o.loadingLabel, { opacity: labelOpacity }]}>
        {"Personalizando escenarios para "}
        <Text style={{ fontFamily: fonts.displaySemiBold }}>{childName}</Text>
        {"…"}
      </Animated.Text>
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WelcomeOnboarding() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState<number | null>(7);
  const [relationship, setRelationship] = useState<string | null>(null);

  const loadingProgress = useRef(new Animated.Value(0)).current;
  const [insertError, setInsertError] = useState<string>("");

  const displayName = childName.trim() || "tu hijo/a";
  const showBack = ["value-prop", "child-name", "child-age", "relationship", "privacy"].includes(step);

  function goBack() {
    const prev = BACK_STEPS[step];
    if (prev) setStep(prev);
  }

  // ── Loading auto-advance + Supabase insert ────────────────────────────────
  useEffect(() => {
    if (step !== "loading") return;

    loadingProgress.setValue(0);

    Animated.timing(loadingProgress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      // Check if child already exists (re-entrant onboarding)
      const { data: existing } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error } = await supabase.from("children").insert({
          parent_id: user.id,
          name: childName,
          mascot_type: "luna",
          mascot_name: "Luna",
          age_group: (childAge ?? 7) <= 6 ? "4-6" : "7-12",
        });

        if (error && !cancelled) {
          console.warn("children insert error:", error);
          setInsertError(error.message ?? JSON.stringify(error));
          setStep("error");
          return;
        }
      }

      // Wait for animation to finish (minimum 3.2s from start)
      const remaining = 3200 - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }

      if (!cancelled) setStep("handoff");
    })();

    return () => { cancelled = true; };
  }, [step]);

  // ── Privacy accept ────────────────────────────────────────────────────────
  async function handlePrivacyAccept() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("parents").upsert({
        id: user.id,
        email: user.email ?? "",
        relationship,
        consent_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }
    setStep("loading");
  }

  function handleHandoffNext() {
    router.replace("/(app)/select-mascot");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WELCOME (s2)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <View style={[p.screen, { backgroundColor: colors.white }]}>
        <View style={p.centered}>
          <PetDisplay mood="happy" mascotColor="purple" size={160} showName={false} />
          <Text style={p.heroHeading}>
            {"Entiende a tu hijo\na través de Luna"}
          </Text>
          <Text style={p.heroSubtext}>
            {"Tu hijo cuida una mascota virtual.\nTú recibes patrones de su comportamiento\ny tips concretos cada semana."}
          </Text>
        </View>
        <View style={[p.bottom, { paddingBottom: Math.max(insets.bottom + 20, 44) }]}>
          <PillButton label="Siguiente" onPress={() => setStep("value-prop")} />
          <Text style={p.footnote}>Sin diagnósticos. Sin culpa. Solo claridad.</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VALUE PROP (s3)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "value-prop") {
    return (
      <View style={[p.screen, { backgroundColor: colors.white }]}>
        {showBack && <BackButton onPress={goBack} insetTop={insets.top} />}
        <ScrollView
          contentContainerStyle={p.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={p.sectionHeading}>{"Lo que vas\na descubrir"}</Text>

          <ValueBubble
            icon="calendar"
            title="Resúmenes semanales"
            desc="Cada lunes recibes qué pasó con tu hijo esta semana: qué patrones se repiten y cómo hablar sobre eso."
          />
          <ValueBubble
            icon="chart"
            title="Patrones de comportamiento"
            desc="Visualiza cómo reacciona ante distintas situaciones: instrucciones, conflictos, emociones intensas."
          />
          <ValueBubble
            icon="target"
            title="Tips accionables"
            desc="No solo 'qué pasa' sino 'qué puedes hacer esta semana' — concreto y sin culpa."
          />

          <View style={{ marginTop: "auto", paddingTop: 16 }}>
            <PillButton
              label="Empezar configuración"
              onPress={() => setStep("child-name")}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHILD NAME (s4)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "child-name") {
    const valid = childName.trim().length >= 2;
    return (
      <View style={[p.screen, { backgroundColor: theme.bgCream }]}>
        {showBack && <BackButton onPress={goBack} insetTop={insets.top} />}
        <ProgressBar step="child-name" />

        <View style={p.formContent}>
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <PetDisplay mood="neutral" mascotColor="purple" size={130} showName={false} />
          </View>

          <Text style={p.formHeading}>{"¿Cómo se llama\ntu hijo/a?"}</Text>
          <Text style={p.formSubtext}>Para que Luna lo llame por su nombre.</Text>

          <TextInput
            style={[p.nameInput, valid && p.nameInputFilled]}
            placeholder="Ej: Sofía, Mateo..."
            placeholderTextColor={colors.gray[300]}
            value={childName}
            onChangeText={setChildName}
            autoFocus
            autoCapitalize="words"
            maxLength={30}
            autoCorrect={false}
          />

          <InfoBlock text="Para personalizar la experiencia y que Luna lo llame por su nombre en cada sesión." />
        </View>

        <View style={[p.bottom, { paddingBottom: Math.max(insets.bottom + 20, 44) }]}>
          <PillButton
            label="Siguiente"
            disabled={!valid}
            onPress={() => setStep("child-age")}
          />
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHILD AGE (s5)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "child-age") {
    return (
      <View style={[p.screen, { backgroundColor: theme.bgCream }]}>
        {showBack && <BackButton onPress={goBack} insetTop={insets.top} />}
        <ProgressBar step="child-age" />

        <ScrollView
          contentContainerStyle={p.formContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={p.formHeading}>
            {"¿Cuántos años tiene\n"}
            <Text style={{ color: colors.purple[500] }}>{displayName}</Text>
            {"?"}
          </Text>
          <Text style={p.formSubtext}>
            Adaptamos los escenarios a su nivel de desarrollo.
          </Text>

          <View style={p.ageGrid}>
            {AGES.map((age) => (
              <AgeChip
                key={age}
                age={age}
                selected={childAge === age}
                onPress={() => setChildAge(age)}
              />
            ))}
          </View>

          <InfoBlock
            text={`Adaptamos los escenarios al nivel de desarrollo de ${displayName}.`}
          />
        </ScrollView>

        <View style={[p.bottom, { paddingBottom: Math.max(insets.bottom + 20, 44) }]}>
          <PillButton
            label="Siguiente"
            disabled={childAge === null}
            onPress={() => setStep("relationship")}
          />
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RELATIONSHIP (s6)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "relationship") {
    return (
      <View style={[p.screen, { backgroundColor: theme.bgCream }]}>
        {showBack && <BackButton onPress={goBack} insetTop={insets.top} />}
        <ProgressBar step="relationship" />

        <ScrollView
          contentContainerStyle={p.formContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={p.formHeading}>
            {"¿Cuál es tu relación\ncon "}
            <Text style={{ color: colors.purple[500] }}>{displayName}</Text>
            {"?"}
          </Text>
          <Text style={p.formSubtext}>
            Para personalizar los tips que recibes.
          </Text>

          <View style={p.chipsWrap}>
            {RELATIONSHIPS.map(({ label, color }) => (
              <RelChip
                key={label}
                label={label}
                color={color}
                selected={relationship === label}
                onPress={() => setRelationship(label)}
              />
            ))}
          </View>

          <InfoBlock text="Para personalizar los tips y recomendaciones que recibas cada semana." />
        </ScrollView>

        <View style={[p.bottom, { paddingBottom: Math.max(insets.bottom + 20, 44) }]}>
          <PillButton
            label="Siguiente"
            disabled={!relationship}
            onPress={() => setStep("privacy")}
          />
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVACY (s7)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "privacy") {
    return (
      <View style={[p.screen, { backgroundColor: theme.bgBlueLight }]}>
        {showBack && <BackButton onPress={goBack} insetTop={insets.top} />}
        <ProgressBar step="privacy" />

        <ScrollView
          contentContainerStyle={p.formContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Svg width={44} height={44} viewBox="0 0 24 24">
              <Rect x="5" y="11" width="14" height="10" rx="2" fill={colors.purple[500]} />
              <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={colors.purple[500]} strokeWidth="2" fill="none" strokeLinecap="round" />
              <Circle cx="12" cy="16" r="1.5" fill="white" />
            </Svg>
          </View>

          <Text style={p.formHeading}>
            {"Los datos de\n"}
            <Text style={{ color: colors.purple[500] }}>{displayName}</Text>
            {"\nestán seguros"}
          </Text>
          <Text style={p.formSubtext}>
            Antes de continuar, queremos ser transparentes.
          </Text>

          <View style={p.privacyList}>
            <PrivacyItem
              icon="no"
              title="Nunca vendemos datos de niños"
              desc={`La información de ${displayName} no se vende ni se comparte con terceros.`}
            />
            <PrivacyItem
              icon="tag"
              title="Sin etiquetas clínicas"
              desc="Hachiko identifica patrones conductuales, no hace diagnósticos."
            />
            <PrivacyItem
              icon="eye"
              title="Solo tú ves la información"
              desc={`Los datos de ${displayName} no se comparten con colegios sin tu permiso.`}
            />
            <PrivacyItem
              icon="trash"
              title="Puedes eliminar todo"
              desc="En cualquier momento puedes borrar la cuenta y todos los datos asociados."
            />
          </View>
        </ScrollView>

        <View style={[p.bottom, { paddingBottom: Math.max(insets.bottom + 20, 44) }]}>
          <PillButton
            label="Acepto y continúo"
            variant="mint"
            onPress={handlePrivacyAccept}
          />
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <View style={[p.screen, { backgroundColor: colors.white }]}>
        <View style={p.centered}>
          <Text style={{ fontSize: 22, fontFamily: fonts.displayBold, color: colors.dark, textAlign: "center", marginBottom: 8 }}>
            Algo salió mal
          </Text>
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.gray[500], textAlign: "center", marginBottom: 8 }}>
            No pudimos guardar los datos.
          </Text>
          {insertError ? (
            <Text style={{ fontSize: 12, fontFamily: fonts.body, color: "#EF4444", textAlign: "center", marginBottom: 16, paddingHorizontal: 8 }}>
              {insertError}
            </Text>
          ) : null}
          <PillButton label="Reintentar" onPress={() => setStep("loading")} />
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING (s8)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <View style={[p.screen, { backgroundColor: theme.bgCream }]}>
        <View style={p.centered}>
          <PetDisplay mood="happy" mascotColor="purple" size={200} showName={false} />
          <Text style={p.transitionHeading}>
            {"Preparando el\nmundo de Luna…"}
          </Text>
          <LoadingBar
            progress={loadingProgress}
            childName={childName.trim() || "tu hijo/a"}
          />
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HANDOFF (s9)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[p.screen, { backgroundColor: theme.bgCream }]}>
      <View style={p.centered}>
        <View style={p.badge}>
          <Text style={p.badgeText}>¡Todo listo!</Text>
        </View>

        <View style={{ marginVertical: 12 }}>
          <PetDisplay mood="happy" mascotColor="purple" size={200} showName={false} />
        </View>

        <Text style={p.transitionHeading}>
          {"¡Pásale el teléfono\na "}
          <Text style={{ color: colors.purple[700] }}>
            {childName.trim() || "tu hijo/a"}
          </Text>
          {"!"}
        </Text>
        <Text style={p.transitionSubtext}>
          {"Es hora de que "}
          {childName.trim() || "tu hijo/a"}
          {" conozca\na su nueva amiga Luna"}
        </Text>
      </View>

      <View style={p.bottom}>
        <PillButton
          label="¡Empezar!"
          variant="orange"
          onPress={handleHandoffNext}
        />
      </View>
    </View>
  );
}

// ─── Design tokens (atoms) ────────────────────────────────────────────────────

const a = StyleSheet.create({
  pill: {
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
    width: "100%",
  },
  pillDisabled: { opacity: 0.4, elevation: 0, shadowOpacity: 0 },
  pillText: {
    fontSize: 17,
    fontFamily: fonts.displaySemiBold,
    color: colors.white,
  },

  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 50,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 18,
    color: colors.gray[700],
    lineHeight: 22,
  },

  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[100],
    marginHorizontal: 0,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.purple[500],
  },

  infoBlock: {
    backgroundColor: colors.purple[50],
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
  },
  infoText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.purple[700],
    lineHeight: 19,
    flex: 1,
  },
});

// ─── Molecule styles ──────────────────────────────────────────────────────────

const m = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.purple[50],
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 14,
  },
  bubbleIconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubbleText: { flex: 1 },
  bubbleTitle: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.dark,
    marginBottom: 3,
  },
  bubbleDesc: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.gray[500],
    lineHeight: 19,
  },

  ageChip: {
    width: "30%",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
    alignItems: "center",
  },
  ageChipSelected: {
    borderColor: colors.purple[500],
    backgroundColor: colors.purple[50],
  },
  ageNum: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: colors.gray[700],
    lineHeight: 28,
  },
  ageNumSelected: { color: colors.purple[700] },
  ageLabel: {
    fontSize: 10,
    fontFamily: fonts.body,
    color: colors.gray[500],
    letterSpacing: 0.5,
  },
  ageLabelSelected: { color: colors.purple[500] },

  relChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  relChipSelected: {
    borderColor: colors.purple[500],
    backgroundColor: colors.purple[50],
  },
  relChipText: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: colors.gray[700],
  },
  relChipTextSelected: {
    color: colors.purple[700],
    fontFamily: fonts.displaySemiBold,
  },
  relChipIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  privacyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    gap: 12,
    marginBottom: 10,
  },
  privacyTitle: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.dark,
    marginBottom: 2,
  },
  privacyDesc: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.gray[500],
    lineHeight: 17,
  },
});

// ─── Organism styles ──────────────────────────────────────────────────────────

const o = StyleSheet.create({
  loadingBarWrap: { width: "100%", marginTop: 28, paddingHorizontal: 8 },
  loadingTrack: {
    height: 8,
    borderRadius: 50,
    backgroundColor: "rgba(123,97,255,0.15)",
    overflow: "hidden",
  },
  loadingFill: {
    height: 8,
    borderRadius: 50,
    backgroundColor: colors.purple[500],
  },
  loadingLabel: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.purple[700],
    textAlign: "center",
    marginTop: 10,
  },
});

// ─── Page / template styles ───────────────────────────────────────────────────

const p = StyleSheet.create({
  screen: { flex: 1 },

  gradientBg: { backgroundColor: "#D4CCFF" },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 44,
    paddingTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
    flexGrow: 1,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    flex: 1,
  },

  heroHeading: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: colors.dark,
    textAlign: "center",
    lineHeight: 36,
    marginTop: 24,
    marginBottom: 12,
  },
  heroSubtext: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 300,
    marginBottom: 32,
  },
  footnote: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.gray[300],
    textAlign: "center",
    marginTop: 12,
  },

  sectionHeading: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: colors.dark,
    textAlign: "center",
    lineHeight: 36,
    marginTop: 16,
    marginBottom: 20,
  },

  formHeading: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: colors.dark,
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 6,
  },
  formSubtext: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 20,
  },

  nameInput: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 19,
    fontFamily: fonts.displaySemiBold,
    color: colors.dark,
    textAlign: "center",
  },
  nameInputFilled: {
    borderColor: colors.purple[500],
    shadowColor: colors.purple[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },

  ageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 0,
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 0,
  },

  privacyList: { marginTop: 4 },

  petGlowWrap: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },

  transitionHeading: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: colors.dark,
    textAlign: "center",
    lineHeight: 36,
    marginTop: 16,
    marginBottom: 8,
  },
  transitionSubtext: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.purple[700],
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },

  badge: {
    backgroundColor: colors.orange[50],
    borderWidth: 2,
    borderColor: "rgba(249,115,22,0.2)",
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginBottom: 0,
  },
  badgeText: {
    fontSize: 14,
    fontFamily: fonts.displaySemiBold,
    color: colors.orange[500],
  },
});
