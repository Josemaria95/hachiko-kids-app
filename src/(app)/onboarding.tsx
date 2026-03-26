import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts, theme } from "../../lib/theme";
import type { ParentRole, ParentingStyle } from "../types/database";

type Step = 1 | 2 | 3;

interface QuizAnswers {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  q5: number | null;
  q6: number | null;
}

const QUIZ_QUESTIONS = [
  {
    key: "q1" as const,
    text: "\u00BFCon qu\u00E9 frecuencia estableces reglas claras en casa?",
  },
  {
    key: "q2" as const,
    text: "\u00BFQu\u00E9 tan f\u00E1cil te resulta escuchar lo que siente tu hijo/a?",
  },
  {
    key: "q3" as const,
    text: "\u00BFCu\u00E1nto espacio le das para tomar sus propias decisiones?",
  },
  {
    key: "q4" as const,
    text: "\u00BFCon qu\u00E9 frecuencia muestras afecto f\u00EDsico (abrazos, caricias)?",
  },
  {
    key: "q5" as const,
    text: "\u00BFQu\u00E9 tan consistente eres con los l\u00EDmites que pones?",
  },
  {
    key: "q6" as const,
    text: "\u00BFCon qu\u00E9 frecuencia explicas el por qu\u00E9 de las reglas?",
  },
];

const STYLE_MESSAGES: Record<ParentingStyle, { title: string; desc: string }> =
  {
    democratico: {
      title: "Crianza con equilibrio",
      desc: "Tienes un balance entre l\u00EDmites claros y mucha calidez.",
    },
    autoritario: {
      title: "Crianza estructurada",
      desc: "Priorizas la disciplina y la consistencia.",
    },
    permisivo: {
      title: "Crianza afectiva",
      desc: "Tu calidez y cercan\u00EDa son tu mayor fortaleza.",
    },
    negligente: {
      title: "Crianza en construcci\u00F3n",
      desc: "Hay espacio para conectar m\u00E1s con tu hijo/a.",
    },
    no_clasificado: {
      title: "Crianza \u00FAnica",
      desc: "\u00A1Tu estilo es dif\u00EDcil de clasificar, y eso est\u00E1 bien!",
    },
  };

const ROLE_OPTIONS: { value: ParentRole; label: string }[] = [
  { value: "madre", label: "Mam\u00E1" },
  { value: "padre", label: "Pap\u00E1" },
  { value: "tutor", label: "Tutor/a" },
];

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<ParentRole | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    q5: null,
    q6: null,
  });
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [parentingStyle, setParentingStyle] =
    useState<ParentingStyle | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Animate progress bar whenever step or question changes
  useEffect(() => {
    let progress = 0;
    if (step === 1) {
      progress = 1 / TOTAL_STEPS;
    } else if (step === 2) {
      const questionProgress =
        (currentQuestion + 1) / QUIZ_QUESTIONS.length;
      progress = (1 + questionProgress) / TOTAL_STEPS;
    } else {
      progress = 1;
    }
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step, currentQuestion]);

  const handleStep1Next = useCallback(async () => {
    if (!displayName.trim() || !role) return;
    if (!userId) return;
    setLoading(true);
    try {
      await supabase
        .from("parents")
        .update({ display_name: displayName.trim(), role })
        .eq("id", userId);
    } catch (err) {
      console.warn("step1 save error:", err);
    } finally {
      setLoading(false);
    }
    setStep(2);
  }, [displayName, role, userId]);

  const handleQuizAnswer = useCallback(
    (value: number) => {
      const key = QUIZ_QUESTIONS[currentQuestion].key;
      setQuizAnswers((prev) => ({ ...prev, [key]: value }));
    },
    [currentQuestion]
  );

  const handleQuizNext = useCallback(async () => {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      return;
    }
    if (!userId) return;
    setLoading(true);
    try {
      await supabase.from("parenting_quiz_responses").upsert(
        {
          parent_id: userId,
          q1_demands: quizAnswers.q1,
          q2_responsiveness: quizAnswers.q2,
          q3_autonomy: quizAnswers.q3,
          q4_warmth: quizAnswers.q4,
          q5_control: quizAnswers.q5,
          q6_communication: quizAnswers.q6,
        },
        { onConflict: "parent_id" }
      );
    } catch (err) {
      console.warn("quiz save error:", err);
    } finally {
      setLoading(false);
    }
    setStep(3);
    loadParentingStyle();
  }, [currentQuestion, quizAnswers, userId]);

  async function loadParentingStyle() {
    if (!userId) return;
    try {
      const { data } = await supabase.rpc("compute_parenting_style", {
        p_parent_id: userId,
      });
      setParentingStyle((data as ParentingStyle) ?? "no_clasificado");
    } catch (err) {
      console.warn("compute style error:", err);
      setParentingStyle("no_clasificado");
    }
  }

  const handleFinish = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await supabase
        .from("parents")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    } catch (err) {
      console.warn("finish onboarding error:", err);
    } finally {
      setLoading(false);
    }
    router.replace("/(app)/summary");
  }, [userId]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  function ProgressBar() {
    return (
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: progressWidth }]}
        />
      </View>
    );
  }

  // Step 1 — Name and role
  if (step === 1) {
    return (
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ProgressBar />

        <Text style={styles.stepLabel}>Paso 1 de 3</Text>
        <Text style={styles.title}>Bienvenido/a</Text>
        <Text style={styles.subtitle}>Cu\u00E9ntanos un poco sobre ti</Text>

        <Text style={styles.label}>\u00BFC\u00F3mo prefieres que te llamemos?</Text>
        <TextInput
          style={styles.input}
          placeholder="Tu nombre"
          placeholderTextColor={colors.gray[300]}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>Tu rol en la familia</Text>
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map((r) => (
            <Pressable
              key={r.value}
              style={({ pressed }) => [
                styles.roleBtn,
                role === r.value && styles.roleBtnSelected,
                pressed && styles.roleBtnPressed,
              ]}
              onPress={() => setRole(r.value)}
            >
              <Text
                style={[
                  styles.roleText,
                  role === r.value && styles.roleTextSelected,
                ]}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (!displayName.trim() || !role || loading) && styles.btnDisabled,
            pressed &&
              !(!displayName.trim() || !role || loading) &&
              styles.primaryBtnPressed,
          ]}
          onPress={handleStep1Next}
          disabled={!displayName.trim() || !role || loading}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? "Guardando..." : "Siguiente"}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Step 2 — Quiz
  if (step === 2) {
    const q = QUIZ_QUESTIONS[currentQuestion];
    const currentAnswer = quizAnswers[q.key];
    const canAdvance = currentAnswer !== null;

    return (
      <View style={styles.container}>
        <ProgressBar />

        <Text style={styles.stepLabel}>
          Pregunta {currentQuestion + 1} de {QUIZ_QUESTIONS.length}
        </Text>

        <Text style={styles.questionText}>{q.text}</Text>

        <View style={styles.likertRow}>
          {[1, 2, 3, 4, 5].map((val) => {
            const selected = currentAnswer === val;
            return (
              <Pressable
                key={val}
                style={({ pressed }) => [
                  styles.likertBtn,
                  selected && styles.likertBtnSelected,
                  pressed && !selected && styles.likertBtnPressed,
                ]}
                onPress={() => handleQuizAnswer(val)}
              >
                <Text
                  style={[
                    styles.likertNumber,
                    selected && styles.likertNumberSelected,
                  ]}
                >
                  {val}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.likertExtremes}>
          <Text style={styles.likertExtremeLabel}>Nunca</Text>
          <Text style={styles.likertExtremeLabel}>Siempre</Text>
        </View>

        <View style={styles.navRow}>
          {currentQuestion > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.backBtnPressed,
              ]}
              onPress={() => setCurrentQuestion((p) => p - 1)}
            >
              <Text style={styles.backBtnText}>Anterior</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.navPrimary,
              (!canAdvance || loading) && styles.btnDisabled,
              pressed &&
                !(!canAdvance || loading) &&
                styles.primaryBtnPressed,
            ]}
            onPress={handleQuizNext}
            disabled={!canAdvance || loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading
                ? "Guardando..."
                : currentQuestion < QUIZ_QUESTIONS.length - 1
                ? "Siguiente"
                : "Ver mi perfil"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Step 3 — Result
  const styleInfo = parentingStyle ? STYLE_MESSAGES[parentingStyle] : null;

  return (
    <View style={styles.container}>
      <ProgressBar />

      <Text style={styles.stepLabel}>Paso 3 de 3</Text>
      <Text style={styles.title}>Tu estilo de crianza</Text>

      {!styleInfo ? (
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={styles.resultLoader}
        />
      ) : (
        <>
          <View style={styles.resultCard}>
            <View style={styles.resultAccentBar} />
            <View style={styles.resultCardInner}>
              <Text style={styles.resultTitle}>{styleInfo.title}</Text>
              <Text style={styles.resultDesc}>{styleInfo.desc}</Text>
            </View>
          </View>

          <Text style={styles.resultNote}>
            Este perfil se va actualizando con el tiempo seg\u00FAn c\u00F3mo interactúas en la app.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              loading && styles.btnDisabled,
              pressed && !loading && styles.primaryBtnPressed,
            ]}
            onPress={handleFinish}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? "Guardando..." : "Comenzar"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: theme.bg },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[200],
    marginBottom: 24,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.primary,
  },
  stepLabel: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: theme.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    fontFamily: fonts.body,
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.bgCard,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.border,
  },
  roleBtnSelected: {
    borderColor: theme.primary,
    backgroundColor: colors.purple[50],
  },
  roleBtnPressed: {
    backgroundColor: colors.gray[100],
  },
  roleText: {
    fontSize: 14,
    fontFamily: fonts.display,
    color: theme.textSecondary,
  },
  roleTextSelected: {
    color: theme.primary,
    fontFamily: fonts.displaySemiBold,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnPressed: {
    backgroundColor: theme.primaryDark,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
  },
  btnDisabled: { opacity: 0.5 },
  questionText: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 40,
    marginTop: 8,
    lineHeight: 32,
  },
  likertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  likertBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: theme.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.border,
  },
  likertBtnSelected: {
    borderColor: theme.primary,
    backgroundColor: colors.purple[50],
  },
  likertBtnPressed: {
    backgroundColor: colors.gray[100],
  },
  likertNumber: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: theme.textSecondary,
  },
  likertNumberSelected: { color: theme.primary },
  likertExtremes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
    paddingHorizontal: 4,
  },
  likertExtremeLabel: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: theme.textLight,
  },
  navRow: {
    flexDirection: "row",
    gap: 12,
  },
  navPrimary: {
    flex: 1,
    marginTop: 0,
  },
  backBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: {
    backgroundColor: colors.gray[100],
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: theme.textSecondary,
  },
  resultLoader: {
    marginTop: 48,
  },
  resultCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    marginTop: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.purple[100],
    overflow: "hidden",
    flexDirection: "row",
    elevation: 2,
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  resultAccentBar: {
    width: 4,
    backgroundColor: theme.primary,
  },
  resultCardInner: {
    flex: 1,
    padding: 24,
    alignItems: "center",
  },
  resultTitle: {
    fontSize: 24,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    marginBottom: 8,
    textAlign: "center",
  },
  resultDesc: {
    fontSize: 16,
    fontFamily: fonts.display,
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  resultNote: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: theme.textLight,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
});
