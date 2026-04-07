import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts, theme } from "../../lib/theme";
import PetDisplay from "../../components/PetDisplay";

type Mode = "login" | "signup";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert("Error", error.message);
      return;
    }
    if (!data.user) {
      setLoading(false);
      Alert.alert("Verifica tu email", "Revisa tu bandeja de entrada para confirmar tu cuenta.");
      return;
    }
    // Create parents row (required FK for children insert)
    await supabase.from("parents").upsert({
      id: data.user.id,
      email: data.user.email ?? email,
    }, { onConflict: "id" });
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    router.replace("/(app)/welcome-onboarding");
  }

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: children } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .limit(1);
      if (children && children.length > 0) {
        router.replace("/(app)/checkin");
      } else {
        router.replace("/(app)/welcome-onboarding");
      }
    }
  }

  const isLogin = mode === "login";

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: Math.max(insets.top + 20, 52), paddingBottom: Math.max(insets.bottom + 16, 40) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Pet */}
        <View style={s.petWrap}>
          <PetDisplay
            mood={isLogin ? "happy" : "neutral"}
            mascotColor="purple"
            size={80}
            showName={false}
          />
        </View>

        {/* Title */}
        <Text style={s.title}>
          {isLogin ? "Hachiko Kids" : "Crear cuenta"}
        </Text>
        <Text style={s.subtitle}>
          {isLogin
            ? "Tu mascota te entiende"
            : "Únete a las familias que ya usan Hachiko"}
        </Text>

        {/* Input group */}
        <View style={s.inputGroup}>
          <Text style={s.label}>Correo electrónico</Text>
          <TextInput
            style={[s.input, emailFocused && s.inputFocused]}
            placeholder="tu@email.com"
            placeholderTextColor={colors.gray[300]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />

          <Text style={s.label}>Contraseña</Text>
          <TextInput
            style={[s.input, passwordFocused && s.inputFocused]}
            placeholder="••••••••"
            placeholderTextColor={colors.gray[300]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
        </View>

        {/* Primary button */}
        <Pressable
          style={({ pressed }) => [
            s.btn,
            loading && s.btnDisabled,
            pressed && !loading && { opacity: 0.88 },
          ]}
          onPress={isLogin ? handleLogin : handleSignUp}
          disabled={loading}
        >
          <Text style={s.btnText}>
            {loading ? "Cargando..." : isLogin ? "Entrar" : "Crear cuenta"}
          </Text>
        </Pressable>

        {/* Mode toggle link */}
        <Pressable onPress={() => setMode(isLogin ? "signup" : "login")}>
          <Text style={s.toggleLink}>
            {isLogin ? "¿Sin cuenta? Crear cuenta →" : "← Ya tengo cuenta"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },

  container: {
    flexGrow: 1,
    backgroundColor: colors.white,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  petWrap: {
    marginBottom: 16,
  },

  title: {
    fontSize: 32,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 0,
  },

  inputGroup: {
    width: "100%",
    marginTop: 20,
    gap: 12,
  },

  label: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    fontWeight: "600",
    color: colors.gray[700],
    textAlign: "left",
    marginBottom: -6,
  },

  input: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.dark,
  },

  inputFocused: {
    borderColor: colors.purple[500],
    shadowColor: colors.purple[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },

  btn: {
    width: "100%",
    marginTop: 20,
    backgroundColor: colors.purple[500],
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: "rgba(123,97,255,0.35)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },

  btnDisabled: {
    opacity: 0.4,
    elevation: 0,
    shadowOpacity: 0,
  },

  btnText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    color: colors.white,
  },

  toggleLink: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.purple[500],
    textAlign: "center",
    marginTop: 14,
  },
});
