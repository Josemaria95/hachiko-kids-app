import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts, theme } from "../../lib/theme";

interface MentalHealthCenter {
  id: number;
  name: string;
  address: string;
  city: string;
  region: string;
  country: string;
  phone: string | null;
  specialties: string[];
  accepts_fonasa: boolean;
  accepts_isapre: boolean;
  is_public: boolean;
  is_verified: boolean;
  is_active: boolean;
}

export default function CentersScreen() {
  const [centers, setCenters] = useState<MentalHealthCenter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCenters();
  }, []);

  async function loadCenters() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("mental_health_centers")
        .select(
          "id, name, address, city, region, country, phone, specialties, accepts_fonasa, accepts_isapre, is_public, is_verified, is_active"
        )
        .eq("is_active", true);
      setCenters((data as MentalHealthCenter[]) ?? []);
    } catch (err) {
      console.warn("loadCenters error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.backBtnPressed,
          ]}
          onPress={() => router.back()}
        >
          <View style={styles.backArrow} />
        </Pressable>
        <Text style={styles.headerTitle}>Centros de apoyo</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.content}
        >
          {/* Crisis Banner */}
          <View style={styles.crisisBanner}>
            <View style={styles.crisisAccentBar} />
            <View style={styles.crisisBannerInner}>
              <Text style={styles.crisisBannerLabel}>
                L\u00EDNEA DE AYUDA INFANTIL
              </Text>
              <Text style={styles.crisisPhone}>Fono Infancia</Text>
              <Text style={styles.crisisNumber}>800-200-818</Text>
              <Text style={styles.crisisNote}>
                Gratuita, disponible las 24 horas
              </Text>
            </View>
          </View>

          {centers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No hay centros disponibles en este momento
              </Text>
            </View>
          ) : (
            centers.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.centerName} numberOfLines={2}>
                    {c.name}
                  </Text>
                  {c.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>Verificado</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.centerAddress}>
                  {c.address}, {c.city}
                </Text>

                {c.specialties && c.specialties.length > 0 && (
                  <View style={styles.tagsRow}>
                    {c.specialties.map((sp, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{sp}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.badgesRow}>
                  {c.accepts_fonasa && (
                    <View style={styles.fonasaBadge}>
                      <Text style={styles.fonasaText}>FONASA</Text>
                    </View>
                  )}
                  {c.accepts_isapre && (
                    <View style={styles.isapreBadge}>
                      <Text style={styles.isapreText}>ISAPRE</Text>
                    </View>
                  )}
                  {c.is_public && (
                    <View style={styles.publicBadge}>
                      <Text style={styles.publicText}>P\u00FAblico</Text>
                    </View>
                  )}
                </View>

                {c.phone && (
                  <Text style={styles.phone}>{c.phone}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: {
    opacity: 0.5,
  },
  backArrow: {
    width: 12,
    height: 12,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.dark,
    transform: [{ rotate: "45deg" }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    color: theme.dark,
  },
  headerSpacer: { width: 40 },
  scrollContainer: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  crisisBanner: {
    backgroundColor: colors.red[50],
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.red[100],
  },
  crisisAccentBar: {
    width: 6,
    backgroundColor: colors.red[700],
  },
  crisisBannerInner: {
    flex: 1,
    padding: 16,
  },
  crisisBannerLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.red[700],
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  crisisPhone: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: colors.red[900],
  },
  crisisNumber: {
    fontSize: 28,
    fontFamily: fonts.displayBold,
    color: colors.red[700],
    letterSpacing: 1,
    marginTop: 2,
  },
  crisisNote: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.red[700],
    marginTop: 4,
  },
  emptyState: {
    marginTop: 64,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: theme.textSecondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 2,
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 8,
  },
  centerName: {
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
    color: theme.dark,
    flex: 1,
    lineHeight: 22,
  },
  verifiedBadge: {
    backgroundColor: colors.mint[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.mint[300],
    flexShrink: 0,
  },
  verifiedText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.mint[700],
  },
  centerAddress: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: theme.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tagText: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: theme.textSecondary,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  fonasaBadge: {
    backgroundColor: colors.mint[100],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fonasaText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.mint[900],
  },
  isapreBadge: {
    backgroundColor: colors.purple[50],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  isapreText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.purple[700],
  },
  publicBadge: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  publicText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.gray[700],
  },
  phone: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: theme.primary,
    marginTop: 4,
  },
});
