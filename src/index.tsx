import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "../lib/supabase";
import { theme } from "../lib/theme";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState<
    "/(app)/checkin" | "/(app)/welcome-onboarding" | "/(auth)/login" | null
  >(null);

  useEffect(() => {
    async function resolve() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setDestination("/(auth)/login");
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: children } = await supabase
          .from("children")
          .select("id")
          .eq("parent_id", user.id)
          .limit(1);

        if (children && children.length > 0) {
          setDestination("/(app)/checkin");
        } else {
          setDestination("/(app)/welcome-onboarding");
        }
      } else {
        setDestination("/(auth)/login");
      }

      setLoading(false);
    }

    resolve();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) {
        setDestination("/(auth)/login");
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || !destination) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
  },
});
