import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { FONT, PressableScale } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/constants/colors";
import {
  clearWebCallbackUrl,
  readWebCallbackParams,
  type AuthCallbackParams,
} from "@/lib/auth";

/**
 * OAuth landing screen — `adabiyotx://auth/callback` on native and
 * `https://adabiyotx.uz/auth/callback` on the web.
 *
 * This screen OWNS the code→session exchange (the Supabase client runs with
 * `detectSessionInUrl: false`, so nothing else touches the URL). It handles
 * both shapes a provider can return:
 *
 *   ?code=…                            → exchangeCodeForSession   (PKCE)
 *   #access_token=…&refresh_token=…    → setSession               (implicit)
 *
 * On native the deep link arrives already normalised into search params by
 * `+native-intent`; on web we read `window.location` directly.
 */
const CALLBACK_TIMEOUT_MS = 20_000;

export default function AuthCallbackScreen() {
  const { colors: c } = useTheme();
  const { completeOAuthCallback } = useAuth();
  const params = useLocalSearchParams();
  const styles = useMemo(() => createStyles(c), [c]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    let done = false;

    // Never leave the user on a spinner: if the exchange hangs (offline, a
    // provider that never answers) surface it instead of spinning forever.
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      console.error("[AuthCallback] timed out waiting for the session exchange");
      setErrorMessage("Kirish juda uzoq davom etdi. Qaytadan urinib ko'ring.");
    }, CALLBACK_TIMEOUT_MS);

    (async () => {
      try {
        // Web: the raw ?code= / #access_token= from the address bar.
        // Native: the params expo-router parsed out of the deep link.
        const callbackParams: AuthCallbackParams =
          Platform.OS === "web"
            ? readWebCallbackParams()
            : (params as AuthCallbackParams);

        console.log("[AuthCallback] handling redirect", {
          platform: Platform.OS,
          hasCode: !!callbackParams.code,
          hasAccessToken: !!callbackParams.access_token,
          error: callbackParams.error ?? null,
        });

        const ok = await completeOAuthCallback(callbackParams);
        if (done) return;
        done = true;
        clearTimeout(timeout);

        if (ok) {
          // Spent code / token must not linger in the address bar.
          clearWebCallbackUrl();
          console.log("[AuthCallback] session created");
          router.replace("/");
          return;
        }

        console.error("[AuthCallback] callback carried no code or token");
        setErrorMessage("Kirish ma'lumotlari topilmadi. Qaytadan urinib ko'ring.");
      } catch (error) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        const message = error instanceof Error ? error.message : String(error);
        console.error("[AuthCallback]", message, error);
        setErrorMessage(message);
      }
    })();

    return () => clearTimeout(timeout);
  }, [completeOAuthCallback, params]);

  return (
    <View style={styles.root}>
      {errorMessage ? (
        <>
          <Ionicons name="alert-circle-outline" size={40} color={c.textDim} />
          <Text style={styles.title}>Kirishni yakunlab bo'lmadi</Text>
          <Text style={styles.hint}>{errorMessage}</Text>
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
