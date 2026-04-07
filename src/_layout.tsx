import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { useFonts } from "expo-font";
import {
  Fredoka_400Regular,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import * as Sentry from "@sentry/react-native";
import { supabase } from "../lib/supabase";
import { theme, fonts } from "../lib/theme";
import { ErrorBoundary } from "../components/ErrorBoundary";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka: Fredoka_400Regular,
    "Fredoka-SemiBold": Fredoka_600SemiBold,
    "Fredoka-Bold": Fredoka_700Bold,
    Inter: Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
  });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const bannerAnim = useRef(new Animated.Value(-64)).current;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/(auth)/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/(app)/summary");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          setUpdateAvailable(true);
          Animated.spring(bannerAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      } catch {
        // No bloquear la app si falla la comprobación de update
      }
    })();
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setIsUpdating(false);
    }
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      {updateAvailable && (
        <Animated.View
          style={[styles.banner, { transform: [{ translateY: bannerAnim }] }]}
        >
          <Text style={styles.bannerText}>
            {isUpdating ? "Actualizando..." : "Nueva version disponible"}
          </Text>
          {!isUpdating && (
            <TouchableOpacity onPress={handleUpdate} style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Actualizar</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: theme.primary,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: "#FFFFFF",
    flex: 1,
  },
  bannerButton: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 12,
  },
  bannerButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: "#FFFFFF",
  },
});
