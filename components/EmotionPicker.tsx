import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { EMOTION_OPTIONS } from "../lib/pet-reactions";
import { colors, fonts, theme } from "../lib/theme";

interface Props {
  onSelect: (emotion: string) => void;
  selected?: string;
  petName: string;
}

// Brandbook states for Luna (section 04):
// Feliz:   scale 1.05, purple glow, bright
// Triste:  scale 0.88, desaturated, pale, low posture
// Enojado: scale 1.0,  saturated, orange glow, subtle eyebrows
// Neutral: scale 1.0,  base state
// Miedo:   scale 0.82, big eyes, mint glow, alert posture
interface LunaState {
  imageScale: number;
  opacity: number;
  glowColor: string;
  badgeColor: string;
}

const LUNA_STATES: Record<string, LunaState> = {
  happy:   { imageScale: 1.05, opacity: 1,    glowColor: colors.purple[500], badgeColor: colors.purple[500] },
  sad:     { imageScale: 0.88, opacity: 0.6,  glowColor: colors.purple[300], badgeColor: colors.purple[300] },
  angry:   { imageScale: 1.0,  opacity: 1,    glowColor: colors.orange[500], badgeColor: colors.orange[500] },
  neutral: { imageScale: 1.0,  opacity: 0.85, glowColor: colors.gray[300],   badgeColor: colors.gray[500] },
  scared:  { imageScale: 0.82, opacity: 0.75, glowColor: colors.mint[500],   badgeColor: colors.mint[500] },
};

const LUNA_IMG = require("../assets/logo.png");

function LunaMini({ emotion, size }: { emotion: string; size: number }) {
  const state = LUNA_STATES[emotion] || LUNA_STATES.neutral;
  const glowSize = size + 8;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize / 2,
          backgroundColor: state.glowColor,
          opacity: 0.2,
        }}
      />
      <Image
        source={LUNA_IMG}
        style={{
          width: size * state.imageScale,
          height: size * state.imageScale,
          opacity: state.opacity,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export default function EmotionPicker({ onSelect, selected, petName }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{"\u00BFC\u00F3mo se siente " + petName + "?"}</Text>
      <View style={styles.grid}>
        {EMOTION_OPTIONS.map((e) => {
          const isSelected = selected === e.value;
          const state = LUNA_STATES[e.value] || LUNA_STATES.neutral;
          return (
            <Pressable
              key={e.value}
              onPress={() => onSelect(e.value)}
              style={[
                styles.button,
                { borderColor: isSelected ? state.badgeColor : "transparent" },
                isSelected && { backgroundColor: state.badgeColor + "20" },
              ]}
            >
              <LunaMini emotion={e.value} size={64} />
              <Text
                style={[
                  styles.label,
                  isSelected && { color: state.badgeColor, fontWeight: "700" },
                ]}
              >
                {e.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 },
  title: {
    fontSize: 22,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    marginBottom: 24,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.bgCard,
    borderWidth: 3,
    width: "30%",
    minHeight: 120,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
});
