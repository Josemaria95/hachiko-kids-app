import { useState } from "react";
import {
  Alert,
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
import PetDisplay from "../../components/PetDisplay";
import {
  requestNotificationPermissions,
  scheduleMondaySummaryNotification,
} from "../../lib/notifications";
import type { MascotColor } from "../types/database";

const AGE_GROUPS = [
  { value: "4-6", label: "4-6 a\u00F1os" },
  { value: "7-12", label: "7-12 a\u00F1os" },
];

const MASCOT_COLORS: { value: MascotColor; color: string }[] = [
  { value: "purple", color: colors.purple[500] },
  { value: "blue", color: "#60A5FA" },
  { value: "green", color: colors.mint[500] },
  { value: "pink", color: "#F472B6" },
  { value: "orange", color: colors.orange[500] },
];

export default function SelectMascotScreen() {
  const [mascotName, setMascotName] = useState("");
  const [childName, setChildName] = useState("");
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [mascotColor, setMascotColor] = useState<MascotColor>("purple");
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (!mascotName.trim() || !childName.trim() || !ageGroup) {
      Alert.alert("Completa todos los campos");
      return;
    }

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Error", "No se encontr\u00F3 la sesi\u00F3n");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("children").insert({
      parent_id: user.id,
      name: childName.trim(),
      mascot_type: "luna",
      mascot_name: mascotName.trim(),
      age_group: ageGroup,
      mascot_color: mascotColor,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    const granted = await requestNotificationPermissions();
    if (granted) {
      await scheduleMondaySummaryNotification(mascotName.trim());
    }

    router.replace("/(app)/checkin");
  }

  const selectedColorHex =
    MASCOT_COLORS.find((mc) => mc.value === mascotColor)?.color ??
    colors.purple[500];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Conoce a tu compa\u00F1era</Text>
      <Text style={styles.subtitle}>
        Ella te acompa\u00F1ar\u00E1 todos los d\u00EDas
      </Text>

      {/* Luna preview with glow in selected color */}
      <View style={styles.mascotContainer}>
        <View
          style={[
            styles.mascotGlow,
            { backgroundColor: selectedColorHex + "28" },
          ]}
        />
        <PetDisplay
          mood="happy"
          name=""
          size={160}
          showName={false}
          mascotColor={mascotColor}
        />
      </View>

      {/* Color picker */}
      <Text style={styles.sectionLabel}>Elige el color de Luna</Text>
      <View style={styles.colorRow}>
        {MASCOT_COLORS.map((mc) => {
          const isSelected = mascotColor === mc.value;
          return (
            <Pressable
              key={mc.value}
              onPress={() => setMascotColor(mc.value)}
              style={({ pressed }) => [
                styles.colorCircle,
                { backgroundColor: mc.color },
                isSelected && styles.colorCircleSelected,
                pressed && !isSelected && styles.colorCirclePressed,
                isSelected && { borderColor: mc.color },
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.label}>\u00BFC\u00F3mo quieres llamarla?</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre de tu mascota"
        placeholderTextColor={colors.gray[300]}
        value={mascotName}
        onChangeText={setMascotName}
      />

      <Text style={styles.label}>\u00BFCu\u00E1l es tu nombre?</Text>
      <TextInput
        style={styles.input}
        placeholder="Tu nombre"
        placeholderTextColor={colors.gray[300]}
        value={childName}
        onChangeText={setChildName}
      />

      <Text style={styles.label}>\u00BFCu\u00E1ntos a\u00F1os tienes?</Text>
      <View style={styles.ageRow}>
        {AGE_GROUPS.map((ag) => (
          <Pressable
            key={ag.value}
            style={({ pressed }) => [
              styles.ageBtn,
              ageGroup === ag.value && styles.ageBtnSelected,
              pressed && ageGroup !== ag.value && styles.ageBtnPressed,
            ]}
            onPress={() => setAgeGroup(ag.value)}
          >
            <Text
              style={[
                styles.ageText,
                ageGroup === ag.value && styles.ageTextSelected,
              ]}
            >
              {ag.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.startBtn,
          loading && styles.startBtnDisabled,
          pressed && !loading && styles.startBtnPressed,
        ]}
        onPress={handleStart}
        disabled={loading}
      >
        <Text style={styles.startText}>
          {loading ? "Creando..." : "\u00A1Comenzar!"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },
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
    marginBottom: 16,
  },
  mascotContainer: {
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },
  mascotGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: "50%",
    alignSelf: "center",
    transform: [{ translateY: -100 }],
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  colorCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: "transparent",
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: colors.white,
    transform: [{ scale: 1.1 }],
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  colorCirclePressed: {
    opacity: 0.8,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    fontFamily: fonts.body,
  },
  ageRow: { flexDirection: "row", gap: 12, marginBottom: 32 },
  ageBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.bgCard,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.border,
  },
  ageBtnSelected: {
    borderColor: theme.primary,
    backgroundColor: colors.purple[50],
  },
  ageBtnPressed: {
    backgroundColor: colors.gray[100],
  },
  ageText: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: theme.textSecondary,
  },
  ageTextSelected: {
    color: theme.primary,
    fontFamily: fonts.displaySemiBold,
  },
  startBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  startBtnPressed: {
    backgroundColor: theme.primaryDark,
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  startText: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.displayBold,
  },
});
