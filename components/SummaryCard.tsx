import { type ReactNode, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, theme } from "../lib/theme";

interface Props {
  badge: string;         // e.g. "IN", "SO"
  badgeColor: string;
  title: string;
  subtitle: string;
  detailText?: string;
  detailContent?: ReactNode;
}

export default function SummaryCard({
  badge,
  badgeColor,
  title,
  subtitle,
  detailText,
  detailContent,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!detailText || !!detailContent;

  return (
    <Pressable onPress={hasDetail ? () => setExpanded((v) => !v) : undefined} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {hasDetail && (
          <Text style={[styles.chevron, expanded && styles.chevronOpen]}>▾</Text>
        )}
      </View>
      {expanded && (
        <View style={styles.body}>
          {detailContent}
          {detailText ? <Text style={styles.bodyText}>{detailText}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: fonts.displayBold,
    fontSize: 12,
    color: colors.white,
  },
  info: { flex: 1 },
  title: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 15.5,
    color: theme.dark,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: fonts.body,
    color: colors.gray[500],
    marginTop: 2,
  },
  chevron: {
    fontSize: 14,
    color: colors.gray[300],
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  bodyText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.gray[500],
    lineHeight: 21,
  },
});
