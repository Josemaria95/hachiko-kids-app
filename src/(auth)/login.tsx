import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, theme } from "../../lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
    // Parent row is created automatically via DB trigger.
    // Small delay to let the trigger run before navigating.
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    router.replace("/(app)/select-mascot");
  }

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
        router.replace("/(app)/select-mascot");
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Hachiko Kids</Text>
        <Text style={styles.subtitle}>
          Entiende a tu hijo a través de su mascota
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.gray[300]}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.gray[300]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, styles.primaryBtn]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.primaryText}>
            {loading ? "Cargando..." : "Iniciar sesión"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.secondaryBtn]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>Crear cuenta</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    alignItems: "center",
  },
  logo: { width: 100, height: 100, marginBottom: 16 },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: theme.dark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 40,
  },
  input: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    width: "100%",
  },
  button: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  primaryBtn: { backgroundColor: theme.primary },
  primaryText: { color: "#FFF", fontSize: 17, fontWeight: "600" },
  secondaryBtn: { backgroundColor: "transparent" },
  secondaryText: { color: theme.primary, fontSize: 16, fontWeight: "500" },
});
