import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, theme } from "../lib/theme";

interface Props {
  title: string;
  iconLabel: string;
  description: string;
  detail?: string;
  detailContent?: ReactNode;
  color?: string;
}

export default function SummaryCard({
  title,
  iconLabel,
  description,
  detail,
  detailContent,
  color = colors.purple[500],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!detail || !!detailContent;

  return (
    <Pressable
      onPress={hasDetail ? () => setExpanded((v) => !v) : undefined}
      style={[styles.card, { borderLeftColor: color }]}
    >
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: color + "20" }]}>
          <Text style={[styles.iconText, { color }]}>{iconLabel}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {hasDetail && (
          <Text style={styles.chevron}>{expanded ? "\u25B2" : "\u25BC"}</Text>
        )}
      </View>
      <Text style={styles.description}>{description}</Text>
      {expanded && (
        <View style={styles.detailBox}>
          {detailContent}
          {detail && <Text style={styles.detailText}>{detail}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconText: { fontSize: 14, fontFamily: fonts.bodySemiBold },
  title: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: theme.dark, flex: 1 },
  chevron: { fontSize: 12, color: theme.textLight, marginLeft: 8 },
  description: { fontSize: 14, fontFamily: fonts.body, color: theme.textSecondary, lineHeight: 20 },
  detailBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  detailText: { fontSize: 13, fontFamily: fonts.body, color: theme.textSecondary, lineHeight: 19 },
});
