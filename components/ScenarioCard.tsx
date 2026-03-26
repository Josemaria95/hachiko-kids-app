import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Scenario } from "../lib/scenarios";
import { fonts, theme } from "../lib/theme";

interface Props {
  scenario: Scenario;
  petName: string;
  onChoose: (choiceValue: string) => void;
}

export default function ScenarioCard({ scenario, petName, onChoose }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.situation}>
        {petName} {scenario.situation}
      </Text>
      <View style={styles.choices}>
        {scenario.choices.map((c) => (
          <Pressable
            key={c.value}
            style={styles.choiceBtn}
            onPress={() => onChoose(c.value)}
          >
            <Text style={styles.choiceText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  situation: {
    fontSize: 20,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 28,
  },
  choices: { gap: 12 },
  choiceBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
  },
  choiceText: { color: "#FFF", fontSize: 17, fontFamily: fonts.displaySemiBold },
});
