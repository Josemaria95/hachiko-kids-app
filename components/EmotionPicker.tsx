import { Pressable, StyleSheet, Text, View } from "react-native";
import { Circle, Ellipse, Line, Path, Svg } from "react-native-svg";
import { colors, fonts } from "../lib/theme";

// SVG face icons — emoji don't render with custom fonts in React Native
function HappyFace({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx="14" cy="14" r="13" fill="#FCD34D" />
      <Circle cx="10" cy="11.5" r="1.4" fill="#374151" />
      <Circle cx="18" cy="11.5" r="1.4" fill="#374151" />
      <Path d="M9 16.5 Q14 21 19 16.5" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Ellipse cx="10" cy="17" rx="2" ry="1.2" fill="#F87171" opacity="0.4" />
      <Ellipse cx="18" cy="17" rx="2" ry="1.2" fill="#F87171" opacity="0.4" />
    </Svg>
  );
}

function NeutralFace({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx="14" cy="14" r="13" fill="#FCD34D" />
      <Circle cx="10" cy="12" r="1.4" fill="#374151" />
      <Circle cx="18" cy="12" r="1.4" fill="#374151" />
      <Line x1="10" y1="18" x2="18" y2="18" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function SadFace({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx="14" cy="14" r="13" fill="#93C5FD" />
      <Circle cx="10" cy="11.5" r="1.4" fill="#374151" />
      <Circle cx="18" cy="11.5" r="1.4" fill="#374151" />
      <Path d="M9 19 Q14 15 19 19" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Path d="M17 10 Q17.5 8 18.5 9" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function AngryFace({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx="14" cy="14" r="13" fill="#FCA5A5" />
      <Path d="M8 10 L12 12" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      <Path d="M20 10 L16 12" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      <Circle cx="10" cy="13" r="1.4" fill="#374151" />
      <Circle cx="18" cy="13" r="1.4" fill="#374151" />
      <Path d="M9 20 Q14 16 19 20" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function ScaredFace({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx="14" cy="14" r="13" fill="#FED7AA" />
      <Path d="M8 11 Q10 9 12 11" stroke="#374151" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Path d="M16 11 Q18 9 20 11" stroke="#374151" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Ellipse cx="10" cy="13" rx="1.8" ry="2" fill="#374151" />
      <Ellipse cx="18" cy="13" rx="1.8" ry="2" fill="#374151" />
      <Ellipse cx="10.5" cy="12.3" rx="0.7" ry="0.8" fill="white" />
      <Ellipse cx="18.5" cy="12.3" rx="0.7" ry="0.8" fill="white" />
      <Ellipse cx="14" cy="19.5" rx="3" ry="2.2" fill="#374151" />
      <Circle cx="13" cy="19.5" r="0.6" fill="white" />
      <Circle cx="15" cy="19.5" r="0.6" fill="white" />
    </Svg>
  );
}

const EMOTIONS = [
  { value: "happy",   label: "Feliz",     Icon: HappyFace,   bgColor: "#D1FAE5" },
  { value: "neutral", label: "Normal",    Icon: NeutralFace, bgColor: colors.gray[100] },
  { value: "sad",     label: "Triste",    Icon: SadFace,     bgColor: "#DBEAFE" },
  { value: "angry",   label: "Enojado",   Icon: AngryFace,   bgColor: "#FEE2E2" },
  { value: "scared",  label: "Asustado",  Icon: ScaredFace,  bgColor: colors.orange[50] },
];

interface Props {
  selected: string | null;
  onSelect: (value: string) => void;
}

export default function EmotionPicker({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {EMOTIONS.map((emo) => {
        const isSelected = selected === emo.value;
        return (
          <Pressable
            key={emo.value}
            style={[styles.item, isSelected && styles.itemSelected]}
            onPress={() => onSelect(emo.value)}
          >
            <View style={[styles.dot, { backgroundColor: emo.bgColor }]}>
              <emo.Icon size={28} />
            </View>
            <Text style={styles.label}>{emo.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginVertical: 16,
    width: "100%",
  },
  item: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  itemSelected: {
    borderColor: colors.dark,
    backgroundColor: "rgba(30,17,69,0.04)",
  },
  dot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.gray[500],
  },
});
