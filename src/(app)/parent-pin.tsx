import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts, theme } from "../../lib/theme";

type Mode = "loading" | "create" | "create_confirm" | "enter";

export default function ParentPinScreen() {
  const [mode, setMode] = useState<Mode>("loading");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    setUserId(user.id);

    const { data } = await supabase
      .from("parents")
      .select("parent_pin")
      .eq("id", user.id)
      .single();

    if (data?.parent_pin) {
      setMode("enter");
    } else {
      setMode("create");
    }
  }

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4) return;
      const next = pin + digit;
      setPin(next);
      setError("");

      if (next.length === 4) {
        handlePinComplete(next);
      }
    },
    [pin, mode, firstPin, userId]
  );

  async function handlePinComplete(completed: string) {
    if (mode === "create") {
      setFirstPin(completed);
      setPin("");
      setMode("create_confirm");
      return;
    }

    if (mode === "create_confirm") {
      if (completed !== firstPin) {
        setError("Los PINs no coinciden. Intenta de nuevo.");
        setPin("");
        setMode("create");
        setFirstPin("");
        return;
      }
      if (userId) {
        await supabase
          .from("parents")
          .update({ parent_pin: completed })
          .eq("id", userId);
      }
      await navigateAfterPin();
      return;
    }

    if (mode === "enter") {
      const { data } = await supabase
        .from("parents")
        .select("parent_pin, onboarding_completed")
        .eq("id", userId!)
        .single();

      if (data?.parent_pin === completed) {
        const onboardingDone = data?.onboarding_completed ?? false;
        if (!onboardingDone) {
          router.replace("/(app)/onboarding");
        } else {
          router.replace("/(app)/summary");
        }
      } else {
        setError("PIN incorrecto. Intenta de nuevo.");
        setPin("");
      }
    }
  }

  async function navigateAfterPin() {
    if (!userId) return;
    const { data } = await supabase
      .from("parents")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    const onboardingDone = data?.onboarding_completed ?? false;
    if (!onboardingDone) {
      router.replace("/(app)/onboarding");
    } else {
      router.replace("/(app)/summary");
    }
  }

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  }, []);

  function getTitle(): string {
    if (mode === "create") return "Modo padres";
    if (mode === "create_confirm") return "Confirma tu PIN";
    return "Ingresa tu PIN";
  }

  function getSubtitle(): string {
    if (mode === "create") return "Elige un PIN de 4 d\u00EDgitos";
    if (mode === "create_confirm") return "Escribe el PIN nuevamente para confirmar";
    return "Ingresa tu PIN para continuar";
  }

  if (mode === "loading") {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.cancelLink, pressed && styles.cancelLinkPressed]}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>{getTitle()}</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>

        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled]}
            />
          ))}
        </View>

        {error !== "" && <Text style={styles.error}>{error}</Text>}

        <View style={styles.numpad}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["", "0", "del"],
          ].map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((key) => {
                if (key === "") {
                  return <View key="empty" style={styles.numpadEmpty} />;
                }
                if (key === "del") {
                  return (
                    <Pressable
                      key="del"
                      style={({ pressed }) => [
                        styles.numpadKey,
                        styles.numpadKeyDelete,
                        pressed && styles.numpadKeyPressed,
                      ]}
                      onPress={handleDelete}
                    >
                      <View style={styles.deleteIcon}>
                        <View style={styles.deleteBar} />
                        <View
                          style={[
                            styles.deleteBar,
                            styles.deleteBarCross,
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.numpadKey,
                      pressed && styles.numpadKeyPressed,
                    ]}
                    onPress={() => handleDigit(key)}
                  >
                    <Text style={styles.numpadText}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 24,
  },
  cancelLink: {
    alignSelf: "flex-start",
    paddingTop: 56,
    paddingBottom: 8,
    paddingRight: 16,
  },
  cancelLinkPressed: {
    opacity: 0.5,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.displayBold,
    color: theme.dark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: theme.textSecondary,
    marginTop: 8,
    marginBottom: 32,
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 16,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.purple[300],
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: colors.purple[500],
    borderColor: colors.purple[500],
  },
  error: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.red[500],
    marginBottom: 12,
    textAlign: "center",
  },
  numpad: {
    marginTop: 24,
    width: 260,
  },
  numpadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  numpadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 2,
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  numpadKeyDelete: {
    backgroundColor: colors.gray[100],
    borderColor: theme.border,
  },
  numpadKeyPressed: {
    backgroundColor: colors.purple[50],
    borderColor: colors.purple[200],
  },
  numpadEmpty: {
    width: 72,
    height: 72,
  },
  numpadText: {
    fontSize: 24,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
  },
  deleteIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBar: {
    position: "absolute",
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gray[500],
    transform: [{ rotate: "45deg" }],
  },
  deleteBarCross: {
    transform: [{ rotate: "90deg" }],
  },
});
