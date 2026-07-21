import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import BrandLogo from "@/components/BrandLogo";
import { FONT, PressableScale } from "@/components/ui";
import { isAppleSignInAvailable } from "@/lib/auth";
import { useAuth } from "@/providers/AuthProvider";
import { useBranding } from "@/providers/BrandingProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { appName } = useBranding();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const {
    signInWithGoogle,
    signInWithApple,
    continueAsGuest,
    signingIn,
  } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const handleGoogle = async () => {
    try {
      const ok = await signInWithGoogle();
      if (ok) router.replace("/(tabs)");
    } catch (e) {
      Alert.alert(
        "Kirishda xatolik",
        e instanceof Error ? e.message : "Google bilan kirib bo'lmadi. Qayta urinib ko'ring."
      );
    }
  };

  const handleApple = async () => {
    try {
      const ok = await signInWithApple();
      if (ok) router.replace("/(tabs)");
    } catch (e) {
      Alert.alert(
        "Kirishda xatolik",
        e instanceof Error ? e.message : "Apple bilan kirib bo'lmadi. Qayta urinib ko'ring."
      );
    }
  };

  const handleGuest = async () => {
    await continueAsGuest();
    router.replace("/(tabs)");
  };

  const busy = signingIn !== null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={
          isDark
            ? ["#0D1117", "#11201A", "#0D1117"]
            : ["#EAF6EF", "#F4EFDD", "#FFFFFF"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        {/* ─── Brand ─────────────────────────────────────────── */}
        <View style={styles.hero}>
          <BrandLogo variant="splash" size={96} radius={30} style={styles.logoBadge} />
          <Text style={styles.brand}>{appName}</Text>
          <Text style={styles.tagline}>
            Adabiyot olamiga xush kelibsiz.{"\n"}Kirib, o'qishni davom ettiring.
          </Text>
        </View>

        {/* ─── Buttons ───────────────────────────────────────── */}
        <View style={styles.actions}>
          <PressableScale
            onPress={busy ? undefined : handleGoogle}
            style={[styles.btn, styles.googleBtn]}
          >
            {signingIn === "google" ? (
              <ActivityIndicator color={isDark ? "#fff" : "#1F2937"} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={styles.googleText}>Google bilan kirish</Text>
              </>
            )}
          </PressableScale>

          {/* Apple: native sheet on iOS, Supabase OAuth in the browser on web. */}
          {(Platform.OS === "web" || (Platform.OS === "ios" && appleAvailable)) && (
            <PressableScale
              onPress={busy ? undefined : handleApple}
              style={[styles.btn, styles.appleBtn]}
            >
              {signingIn === "apple" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={22} color="#fff" />
                  <Text style={styles.appleText}>Apple bilan davom etish</Text>
                </>
              )}
            </PressableScale>
          )}

          <Pressable
            onPress={busy ? undefined : handleGuest}
            style={styles.guestBtn}
            hitSlop={10}
          >
            <Text style={styles.guestText}>Hozircha kirmasdan ko'rish</Text>
          </Pressable>
        </View>

        <Text style={styles.legal}>
          Kirish orqali siz Foydalanish shartlari va Maxfiylik siyosatiga
          rozilik bildirasiz.
        </Text>
      </View>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: "space-between",
    },
    hero: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
    logoBadge: {
      width: 96,
      height: 96,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#2D9B6F",
      shadowOpacity: 0.4,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    brand: {
      color: c.text,
      fontSize: 38,
      fontWeight: "900",
      fontFamily: FONT.serif,
      letterSpacing: -0.5,
    },
    tagline: {
      color: c.textDim,
      fontSize: 15,
      lineHeight: 23,
      textAlign: "center",
      fontWeight: "500",
      paddingHorizontal: 12,
    },
    actions: { gap: 12 },
    btn: {
      height: 56,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    googleBtn: {
      backgroundColor: isDark ? "#1C2128" : "#FFFFFF",
      borderWidth: 1.5,
      borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    googleText: { color: isDark ? c.text : "#1F2937", fontSize: 16, fontWeight: "700" },
    appleBtn: { backgroundColor: "#000000" },
    appleText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    guestBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    guestText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "700",
      textDecorationLine: "underline",
    },
    legal: {
      color: c.textMuted,
      fontSize: 11.5,
      lineHeight: 17,
      textAlign: "center",
      fontWeight: "500",
      paddingHorizontal: 8,
    },
  });
}
