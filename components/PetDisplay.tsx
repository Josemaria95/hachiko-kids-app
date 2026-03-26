import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { MOOD_STYLES, type PetMood } from "../lib/pet-reactions";
import { colors, fonts, theme } from "../lib/theme";
import type { LunaArchetype, MascotColor } from "../src/types/database";

const MASCOT_COLOR_MAP: Record<MascotColor, string> = {
  purple: colors.purple[500],
  blue: "#60A5FA",
  green: colors.mint[500],
  pink: "#F472B6",
  orange: colors.orange[500],
};

const ARCHETYPE_LABELS: Record<LunaArchetype, string> = {
  exploradora: "Luna Exploradora",
  cuidadora: "Luna Cuidadora",
  tranquila: "Luna Tranquila",
  luchadora: "Luna Luchadora",
  equilibrada: "Luna Equilibrada",
};

const ARCHETYPE_COLORS: Record<LunaArchetype, string> = {
  exploradora: colors.orange[500],
  cuidadora: colors.mint[500],
  tranquila: colors.purple[300],
  luchadora: colors.red[500],
  equilibrada: colors.purple[500],
};

const NEED_COLORS: Record<string, string> = {
  Hambre: colors.orange[500],
  Limpieza: colors.mint[500],
  Felicidad: colors.purple[500],
};

interface NeedsState {
  hunger: number;
  cleanliness: number;
  happiness: number;
}

interface Props {
  mood: PetMood;
  name: string;
  size?: number;
  showName?: boolean;
  mascotColor?: MascotColor;
  archetype?: LunaArchetype;
  needsState?: NeedsState;
}

// ─── Luna drawn character ────────────────────────────────────────────────────

function LunaEyes({ mood, s }: { mood: PetMood; s: number }) {
  const eyeY = s * 0.35;
  const leftX = s * 0.22;
  const rightX = s * 0.55;
  const eyeW = s * 0.13;
  const eyeH = s * 0.10;
  const dark = colors.dark;

  const shared: object = {
    position: "absolute" as const,
    top: eyeY,
  };

  if (mood === "happy") {
    // Closed happy crescent — flat top, curved bottom
    const h = eyeH * 0.85;
    const w = eyeW * 1.1;
    return (
      <>
        <View style={[shared, { left: leftX, width: w, height: h, borderBottomLeftRadius: h, borderBottomRightRadius: h, backgroundColor: dark }]} />
        <View style={[shared, { left: rightX, width: w, height: h, borderBottomLeftRadius: h, borderBottomRightRadius: h, backgroundColor: dark }]} />
      </>
    );
  }

  if (mood === "sad") {
    // Droopy closed crescent — flat bottom, curved top
    const h = eyeH * 0.85;
    const w = eyeW * 1.1;
    return (
      <>
        <View style={[shared, { left: leftX, width: w, height: h, borderTopLeftRadius: h, borderTopRightRadius: h, backgroundColor: dark }]} />
        <View style={[shared, { left: rightX, width: w, height: h, borderTopLeftRadius: h, borderTopRightRadius: h, backgroundColor: dark }]} />
        {/* Tear drops */}
        <View style={{ position: "absolute", top: eyeY + h + s * 0.03, left: leftX + eyeW * 0.3, width: s * 0.04, height: s * 0.06, borderRadius: s * 0.03, backgroundColor: "#93C5FD", opacity: 0.85 }} />
      </>
    );
  }

  if (mood === "angry") {
    // Squinting ovals with angled brows
    const h = eyeH * 0.7;
    const w = eyeW;
    return (
      <>
        {/* Brows */}
        <View style={{ position: "absolute", top: eyeY - s * 0.05, left: leftX - s * 0.01, width: w * 1.2, height: s * 0.025, borderRadius: s * 0.012, backgroundColor: dark, transform: [{ rotate: "-15deg" }] }} />
        <View style={{ position: "absolute", top: eyeY - s * 0.05, left: rightX + s * 0.01, width: w * 1.2, height: s * 0.025, borderRadius: s * 0.012, backgroundColor: dark, transform: [{ rotate: "15deg" }] }} />
        {/* Eyes */}
        <View style={[shared, { left: leftX, width: w, height: h, borderRadius: h / 2, backgroundColor: dark }]} />
        <View style={[shared, { left: rightX, width: w, height: h, borderRadius: h / 2, backgroundColor: dark }]} />
      </>
    );
  }

  if (mood === "scared") {
    // Wide open circles with white highlight
    const r = eyeW * 0.65;
    return (
      <>
        <View style={[shared, { left: leftX - s * 0.015, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: dark }]}>
          <View style={{ position: "absolute", top: r * 0.2, left: r * 0.2, width: r * 0.5, height: r * 0.5, borderRadius: r * 0.25, backgroundColor: "white", opacity: 0.9 }} />
        </View>
        <View style={[shared, { left: rightX - s * 0.015, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: dark }]}>
          <View style={{ position: "absolute", top: r * 0.2, left: r * 0.2, width: r * 0.5, height: r * 0.5, borderRadius: r * 0.25, backgroundColor: "white", opacity: 0.9 }} />
        </View>
      </>
    );
  }

  // neutral — calm ovals
  return (
    <>
      <View style={[shared, { left: leftX, width: eyeW, height: eyeH, borderRadius: eyeH / 2, backgroundColor: dark }]} />
      <View style={[shared, { left: rightX, width: eyeW, height: eyeH, borderRadius: eyeH / 2, backgroundColor: dark }]} />
    </>
  );
}

function LunaMouth({ mood, s }: { mood: PetMood; s: number }) {
  const mouthY = s * 0.56;
  const dark = colors.dark;
  const cx = s / 2;

  if (mood === "happy") {
    const w = s * 0.35;
    const h = s * 0.16;
    return (
      <View style={{
        position: "absolute",
        top: mouthY,
        left: cx - w / 2,
        width: w,
        height: h,
        borderBottomLeftRadius: h,
        borderBottomRightRadius: h,
        borderWidth: s * 0.025,
        borderTopWidth: 0,
        borderColor: dark,
        backgroundColor: "transparent",
      }} />
    );
  }

  if (mood === "sad") {
    const w = s * 0.28;
    const h = s * 0.13;
    return (
      <View style={{
        position: "absolute",
        top: mouthY + s * 0.04,
        left: cx - w / 2,
        width: w,
        height: h,
        borderTopLeftRadius: h,
        borderTopRightRadius: h,
        borderWidth: s * 0.022,
        borderBottomWidth: 0,
        borderColor: dark,
        backgroundColor: "transparent",
      }} />
    );
  }

  if (mood === "angry") {
    const w = s * 0.22;
    return (
      <View style={{
        position: "absolute",
        top: mouthY + s * 0.02,
        left: cx - w / 2,
        width: w,
        height: s * 0.025,
        borderRadius: s * 0.012,
        backgroundColor: dark,
      }} />
    );
  }

  if (mood === "scared") {
    const w = s * 0.13;
    const h = s * 0.16;
    return (
      <View style={{
        position: "absolute",
        top: mouthY,
        left: cx - w / 2,
        width: w,
        height: h,
        borderRadius: w / 2,
        borderWidth: s * 0.022,
        borderColor: dark,
        backgroundColor: "transparent",
      }} />
    );
  }

  // neutral — slight soft smile
  const w = s * 0.26;
  const h = s * 0.11;
  return (
    <View style={{
      position: "absolute",
      top: mouthY + s * 0.02,
      left: cx - w / 2,
      width: w,
      height: h,
      borderBottomLeftRadius: h,
      borderBottomRightRadius: h,
      borderWidth: s * 0.02,
      borderTopWidth: 0,
      borderColor: dark,
      backgroundColor: "transparent",
      opacity: 0.6,
    }} />
  );
}

function LunaMascot({ size, color, mood }: { size: number; color: string; mood: PetMood }) {
  const headSize = size * 0.76;
  const earSize = size * 0.28;
  const innerEarSize = earSize * 0.52;
  const earOverlap = earSize * 0.35;
  const headTop = earSize - earOverlap;
  const headLeft = (size - headSize) / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Left ear */}
      <View style={{
        position: "absolute",
        width: earSize,
        height: earSize,
        borderRadius: earSize / 2,
        backgroundColor: color,
        top: 0,
        left: headLeft + earSize * 0.18,
      }}>
        <View style={{
          position: "absolute",
          width: innerEarSize,
          height: innerEarSize,
          borderRadius: innerEarSize / 2,
          backgroundColor: "#FFB3C6",
          top: (earSize - innerEarSize) / 2,
          left: (earSize - innerEarSize) / 2,
        }} />
      </View>

      {/* Right ear */}
      <View style={{
        position: "absolute",
        width: earSize,
        height: earSize,
        borderRadius: earSize / 2,
        backgroundColor: color,
        top: 0,
        right: headLeft + earSize * 0.18,
      }}>
        <View style={{
          position: "absolute",
          width: innerEarSize,
          height: innerEarSize,
          borderRadius: innerEarSize / 2,
          backgroundColor: "#FFB3C6",
          top: (earSize - innerEarSize) / 2,
          left: (earSize - innerEarSize) / 2,
        }} />
      </View>

      {/* Head */}
      <View style={{
        position: "absolute",
        width: headSize,
        height: headSize,
        borderRadius: headSize / 2,
        backgroundColor: color,
        top: headTop,
        left: headLeft,
        overflow: "hidden",
      }}>
        {/* Belly tint — soft white oval in lower center */}
        <View style={{
          position: "absolute",
          width: headSize * 0.68,
          height: headSize * 0.58,
          borderRadius: headSize * 0.34,
          backgroundColor: "rgba(255,255,255,0.28)",
          bottom: headSize * 0.06,
          left: headSize * 0.16,
        }} />

        {/* Eyes */}
        <LunaEyes mood={mood} s={headSize} />

        {/* Rosy cheeks */}
        <View style={{
          position: "absolute",
          width: headSize * 0.15,
          height: headSize * 0.09,
          borderRadius: headSize * 0.05,
          backgroundColor: "rgba(255,138,138,0.42)",
          top: headSize * 0.53,
          left: headSize * 0.12,
        }} />
        <View style={{
          position: "absolute",
          width: headSize * 0.15,
          height: headSize * 0.09,
          borderRadius: headSize * 0.05,
          backgroundColor: "rgba(255,138,138,0.42)",
          top: headSize * 0.53,
          right: headSize * 0.12,
        }} />

        {/* Mouth */}
        <LunaMouth mood={mood} s={headSize} />

        {/* Forehead sparkle — two crossing ovals */}
        <View style={{
          position: "absolute",
          top: headSize * 0.1,
          left: headSize * 0.44,
          width: headSize * 0.12,
          height: headSize * 0.04,
          borderRadius: headSize * 0.02,
          backgroundColor: "rgba(255,255,255,0.65)",
          transform: [{ rotate: "45deg" }],
        }} />
        <View style={{
          position: "absolute",
          top: headSize * 0.1,
          left: headSize * 0.44,
          width: headSize * 0.12,
          height: headSize * 0.04,
          borderRadius: headSize * 0.02,
          backgroundColor: "rgba(255,255,255,0.65)",
          transform: [{ rotate: "-45deg" }],
        }} />
      </View>
    </View>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function PetDisplay({
  mood,
  name,
  size = 200,
  showName = true,
  mascotColor,
  archetype,
  needsState,
}: Props) {
  const scale = useRef(new Animated.Value(MOOD_STYLES[mood].scale)).current;
  const opacity = useRef(new Animated.Value(MOOD_STYLES[mood].opacity)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const style = MOOD_STYLES[mood];
    Animated.parallel([
      Animated.spring(scale, {
        toValue: style.scale,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: style.opacity,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    if (shakeAnim.current) {
      shakeAnim.current.stop();
      shakeAnim.current = null;
    }

    if (mood === "angry") {
      shakeAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeX, { toValue: 2, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -2, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 2, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 80, useNativeDriver: true }),
        ])
      );
      shakeAnim.current.start();
    } else {
      shakeX.setValue(0);
    }

    return () => {
      if (shakeAnim.current) shakeAnim.current.stop();
    };
  }, [mood]);

  const moodStyle = MOOD_STYLES[mood];
  const glowColor = mascotColor ? MASCOT_COLOR_MAP[mascotColor] : moodStyle.glowColor;
  const bodyColor = mascotColor ? MASCOT_COLOR_MAP[mascotColor] : colors.purple[500];
  const archetypeColor = archetype ? ARCHETYPE_COLORS[archetype] : null;

  return (
    <View style={styles.container}>
      {/* Ambient glow */}
      <View
        style={{
          position: "absolute",
          width: size + 32,
          height: size + 32,
          borderRadius: (size + 32) / 2,
          backgroundColor: glowColor,
          opacity: 0.18,
        }}
      />

      {/* Animated mascot */}
      <Animated.View
        style={{
          transform: [{ scale }, { translateX: shakeX }],
          opacity,
        }}
      >
        <LunaMascot size={size} color={bodyColor} mood={mood} />
      </Animated.View>

      {showName && <Text style={styles.name}>{name}</Text>}

      {archetype && archetypeColor && (
        <View style={[styles.archetypePill, { backgroundColor: archetypeColor + "22" }]}>
          <Text style={[styles.archetypeText, { color: archetypeColor }]}>
            {ARCHETYPE_LABELS[archetype]}
          </Text>
        </View>
      )}

      {needsState && (
        <View style={styles.needsBars}>
          <NeedBar label="Hambre" value={needsState.hunger} color={NEED_COLORS["Hambre"]} />
          <NeedBar label="Limpieza" value={needsState.cleanliness} color={NEED_COLORS["Limpieza"]} />
          <NeedBar label="Felicidad" value={needsState.happiness} color={NEED_COLORS["Felicidad"]} />
        </View>
      )}
    </View>
  );
}

function NeedBar({ label, value, color }: { label: string; value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={needBarStyles.wrapper}>
      <View style={needBarStyles.labelRow}>
        <View style={[needBarStyles.dot, { backgroundColor: color }]} />
        <Text style={needBarStyles.label}>{label}</Text>
      </View>
      <View style={needBarStyles.track}>
        <View style={[needBarStyles.fill, { width: `${clamped}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const needBarStyles = StyleSheet.create({
  wrapper: { alignItems: "flex-start", marginHorizontal: 6, width: 88 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, fontFamily: fonts.body, color: theme.textSecondary },
  track: { width: 88, height: 6, borderRadius: 3, backgroundColor: colors.gray[100], overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  name: {
    fontSize: 20,
    fontFamily: fonts.displaySemiBold,
    marginTop: 8,
    color: theme.dark,
  },
  archetypePill: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "center",
  },
  archetypeText: { fontSize: 12, fontFamily: fonts.bodySemiBold },
  needsBars: { flexDirection: "row", marginTop: 16, justifyContent: "center" },
});
