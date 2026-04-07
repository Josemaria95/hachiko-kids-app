import { useState } from "react";
import {
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
import type { MascotColor } from "../../lib/types/database";

const MASCOT_COLORS: { value: MascotColor; hex: string; glowHex: string }[] = [
  { value: "purple", hex: "#7B61FF", glowHex: "#C4BCFF" },
  { value: "blue",   hex: "#60A5FA", glowHex: "#93C5FD" },
  { value: "green",  hex: "#34D399", glowHex: "#6EE7B7" },
  { value: "pink",   hex: "#F472B6", glowHex: "#F9A8D4" },
  { value: "orange", hex: "#F97316", glowHex: "#FDBA74" },
];

const SPORT_OPTIONS = [
  "Fútbol", "Natación", "Básquetbol", "Tenis",
  "Gimnasia", "Artes marciales", "Danza / Ballet", "Otro", "Ninguno",
];

export default function SelectMascotScreen() {
  const insets = useSafeAreaInsets();
  const [mascotColor, setMascotColor] = useState<MascotColor>("purple");
  const [mascotName, setMascotName] = useState("Luna");
  const [sport, setSport] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = MASCOT_COLORS.find((mc) => mc.value === mascotColor)!;

  async function handleStart() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: children } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .limit(1);

      if (children && children.length > 0) {
        await supabase
          .from("children")
          .update({
            mascot_color: mascotColor,
            mascot_name: mascotName || "Luna",
            sport: sport ?? "ninguno",
          })
          .eq("id", children[0].id);
      }

      router.replace("/(app)/checkin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 20, 52), paddingBottom: Math.max(insets.bottom + 24, 48) }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Conoce a Luna</Text>
      <Text style={styles.subtext}>Personaliza a tu nueva compañera</Text>

      {/* Luna with glow */}
      <View style={styles.mascotWrapper}>
        <View
          style={[
            styles.glowCircle,
            { backgroundColor: "rgba(255,255,255,0.75)" },
          ]}
        />
        <PetDisplay
          mood="happy"
          mascotColor={mascotColor}
          size={160}
          showName={false}
          showGlow={false}
        />
      </View>

      {/* Color label */}
      <Text style={styles.colorLabel}>ELIGE EL COLOR DE LUNA</Text>

      {/* Color circles */}
      <View style={styles.colorRow}>
        {MASCOT_COLORS.map((mc) => {
          const isSelected = mascotColor === mc.value;
          return (
            <Pressable
              key={mc.value}
              onPress={() => setMascotColor(mc.value)}
              style={[
                styles.colorCircle,
                { backgroundColor: mc.hex },
                isSelected
                  ? { borderColor: colors.dark, transform: [{ scale: 1.18 }] }
                  : { borderColor: "transparent" },
              ]}
            />
          );
        })}
      </View>

      {/* Name label */}
      <Text style={styles.nameLabel}>{"\u00BFCómo quieres llamarla?"}</Text>

      {/* Name input */}
      <TextInput
        style={styles.input}
        value={mascotName}
        onChangeText={setMascotName}
        placeholder="Luna"
        placeholderTextColor={colors.gray[300]}
      />

      {/* Sport label */}
      <Text style={[styles.nameLabel, { marginTop: 16 }]}>¿Hace algún deporte? (opcional)</Text>

      {/* Sport chips */}
      <View style={styles.sportGrid}>
        {SPORT_OPTIONS.map((option) => {
          const isSelected = sport === option;
          return (
            <Pressable
              key={option}
              onPress={() => setSport(isSelected ? null : option)}
              style={[
                styles.sportChip,
                isSelected && styles.sportChipSelected,
              ]}
            >
              <Text style={[styles.sportChipText, isSelected && styles.sportChipTextSelected]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.startBtn,
          saving && { opacity: 0.6 },
          pressed && !saving && { opacity: 0.85 },
        ]}
        onPress={handleStart}
        disabled={saving}
      >
        <Text style={styles.startText}>
          {saving ? "Guardando..." : "¡Comenzar!"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgCream,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  heading: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: colors.dark,
    textAlign: "center",
    marginBottom: 4,
  },
  subtext: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 12,
  },
  mascotWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    width: 220,
    height: 220,
  },
  glowCircle: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.5,
  },
  colorLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    fontWeight: "600",
    letterSpacing: 1,
    color: colors.gray[500],
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  colorRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
    marginBottom: 16,
  },
  colorCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
  },
  nameLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    fontWeight: "500",
    color: colors.gray[700],
    textAlign: "left",
    width: "100%",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    fontFamily: fonts.display,
    fontSize: 19,
    textAlign: "center",
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    color: colors.dark,
    backgroundColor: colors.white,
  },
  sportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    width: "100%",
    marginBottom: 4,
  },
  sportChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  sportChipSelected: {
    borderColor: colors.purple[500],
    backgroundColor: colors.purple[50],
  },
  sportChipText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.gray[500],
  },
  sportChipTextSelected: {
    color: colors.purple[700],
    fontFamily: fonts.bodySemiBold,
    fontWeight: "600",
  },
  startBtn: {
    width: "100%",
    backgroundColor: colors.purple[500],
    paddingVertical: 17,
    borderRadius: 50,
    alignItems: "center",
    marginTop: 16,
  },
  startText: {
    color: colors.white,
    fontSize: 17,
    fontFamily: fonts.displaySemiBold,
  },
});
