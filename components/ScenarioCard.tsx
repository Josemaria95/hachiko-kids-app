import { Pressable, StyleSheet, Text, View } from "react-native";
import { Circle, Line, Path, Polygon, Svg } from "react-native-svg";
import type { Scenario } from "../lib/scenarios";
import { colors, fonts, theme } from "../lib/theme";

interface Props {
  scenario: Scenario;
  petName: string;
  onChoose: (choiceValue: string) => void;
}

function SparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Polygon points="10,2 11.5,8.5 18,10 11.5,11.5 10,18 8.5,11.5 2,10 8.5,8.5" fill="#F59E0B" />
    </Svg>
  );
}

function NeutralFaceIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="9" fill="#FCD34D" />
      <Circle cx="7.5" cy="8.5" r="1.2" fill="#374151" />
      <Circle cx="12.5" cy="8.5" r="1.2" fill="#374151" />
      <Line x1="7" y1="13" x2="13" y2="13" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function TimerIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="11" r="8" fill="#E0E7FF" stroke="#6366F1" strokeWidth="1.5" />
      <Line x1="10" y1="11" x2="10" y2="7" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="10" y1="11" x2="13" y2="11" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="7" y1="2" x2="13" y2="2" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="2" x2="10" y2="3.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

const CHOICE_ICON_COMPONENTS = [SparkleIcon, NeutralFaceIcon, TimerIcon];

export default function ScenarioCard({ scenario, petName, onChoose }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.situationText}>
        {petName} {scenario.situation}
      </Text>
      <View style={styles.choices}>
        {scenario.choices.map((c, i) => {
          const IconComponent = CHOICE_ICON_COMPONENTS[i];
          return (
            <Pressable
              key={c.value}
              style={({ pressed }) => [styles.choiceBtn, pressed && styles.choiceBtnPressed]}
              onPress={() => onChoose(c.value)}
            >
              {IconComponent ? <IconComponent size={20} /> : null}
              <Text style={styles.choiceText}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
    marginVertical: 8,
    marginBottom: 12,
  },
  situationText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    color: theme.dark,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 16,
  },
  choices: { gap: 10 },
  choiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderRadius: 14,
    backgroundColor: theme.bgCard,
  },
  choiceBtnPressed: {
    borderColor: colors.purple[500],
    backgroundColor: colors.purple[50],
  },
  choiceText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 15,
    color: colors.gray[700],
    flex: 1,
  },
});
