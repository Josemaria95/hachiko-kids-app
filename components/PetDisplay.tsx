import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import LunaSvg, { GLOW_COLORS } from "./LunaSvg";
import { fonts, theme } from "../lib/theme";
import type { MascotColor } from "../lib/types/database";
import type { PetMood } from "../lib/pet-reactions";

interface Props {
  mood: PetMood;
  name?: string;
  size?: number;
  showName?: boolean;
  mascotColor?: MascotColor;
  showGlow?: boolean;
}

export default function PetDisplay({
  mood,
  name,
  size = 120,
  showName = false,
  mascotColor = "purple",
  showGlow = false,
}: Props) {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const glowColor = GLOW_COLORS[mascotColor] ?? "#C4BCFF";

  return (
    <View style={styles.container}>
      {showGlow && (
        <View
          style={{
            position: "absolute",
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            backgroundColor: glowColor,
            opacity: 0.5,
          }}
        />
      )}
      <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
        <LunaSvg mood={mood} colorKey={mascotColor} size={size} />
      </Animated.View>
      {showName && name ? (
        <Text style={styles.name}>{name}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  name: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    marginTop: 6,
    color: theme.dark,
  },
});
