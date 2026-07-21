import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { FONT, PressableScale } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/constants/colors";
import type { AuthCallbackParams } from "@/lib/auth";

/**
 * OAuth landing screen — `adabiyotx://auth/callback` on native and
 * `https://adabiyotx.uz/auth/callback` on the web.
 *
 * The in-app browser normally resolves the sign-in itself (see
 * `signInWithOAuthBrowser`), so this screen is the path for everything else:
 * a provider that bounces through the system browser, a cold start from the
 * deep link, and every web sign-in. Once the session exists the root layout
 * moves the user into the tabs on its own.
 */
export default function AuthCallbackScreen() {
  const { colors: c } = useTheme();
  const { completeOAuthCallback } = useAuth();
  const params = useLocalSearchParams();
  const styles = useMemo(() => createStyles(c), [c]);
  const [failed, setFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const finish = async () => {
      if (handled.current) return;
      handled.current = true;
      try {
        // The web URL still holds the raw query/fragment; on native the link was
        // already normalised into search params by `+native-intent`.
        const fromBrowser =
          Platform.OS === "web" &&
          typeof window !== "undefined" &&
          (window.location.search.length > 1 || window.location.hash.length > 1);

        const ok = await completeOAuthCallback(
          fromBrowser ? window.location.href : (params as AuthCallbackParams)
        );
        if (ok) router.replace("/(tabs)");
        else setFailed(true);
      } catch (error) {
        if (__DEV__) console.error("[AuthCallback] failed", error);
        setFailed(true);
      }
    };

    // On web the provider lands in a popup: expo-web-browser posts the URL back
    // to the window that started the sign-in and closes this one, so that window
    // owns the exchange. Only step in if the hand-off never happens.
    const inAuthPopup =
      Platform.OS === "web" && typeof window !== "undefined" && !!window.opener;
    if (inAuthPopup) {
      const timer = setTimeout(finish, 2500);
      return () => clearTimeout(timer);
    }

    finish();
  }, [completeOAuthCallback, params]);

  return (
    <View style={styles.root}>
      {failed ? (
        <>
          <Ionicons name="alert-circle-outline" size={40} color={c.textDim} />
          <Text style={styles.title}>Kirishni yakunlab bo'lmadi</Text>
          <Text style={styles.hint}>Iltimos, qayta urinib ko'ring.</Text>
          <PressableScale onPress={() => router.replace("/auth")} style={styles.btn}>
            <Text style={styles.btnText}>Kirish sahifasiga qaytish</Text>
          </PressableScale>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={styles.title}>Kirish yakunlanmoqda…</Text>
        </>
      )}
    </View>
  );
}

function createStyles(c: AppTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 32,
      backgroundColor: c.bg,
    },
    title: {
      color: c.text,
      fontSize: 17,
      fontWeight: "800",
      fontFamily: FONT.serif,
      textAlign: "center",
    },
    hint: { color: c.textDim, fontSize: 13, textAlign: "center" },
    btn: {
      marginTop: 10,
      backgroundColor: c.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
    },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
}
