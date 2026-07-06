import { router, useLocalSearchParams } from "expo-router";
import { Compass } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { appDeepLink, contentRoutePath, isContentType } from "@/lib/deepLink";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * QR / deep-link landing page.
 *
 * Certificates encode `https://adabiyotx.uz/open?type=..&id=..`. On the web we
 * try to hand off to the native app (`adabiyotx://<type>/<id>`) and, if that
 * doesn't take over within ~1.3s, fall back to the in-app web detail route so
 * a visitor without the app still sees the content.
 */
export default function OpenRoute() {
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();

  const type = String(params.type ?? "").trim().toLowerCase();
  const id = String(params.id ?? "").trim();
  const webPath = useMemo(() => contentRoutePath(type, id), [type, id]);
  const valid = Boolean(webPath) && isContentType(type);

  const [fallbackFired, setFallbackFired] = useState(false);

  useEffect(() => {
    if (!valid || !webPath) return;

    // On native we're already inside the app — jump straight to the detail.
    if (Platform.OS !== "web") {
      router.replace(webPath as any);
      return;
    }

    let cancelled = false;
    const openInWeb = () => {
      if (cancelled) return;
      cancelled = true;
      setFallbackFired(true);
      router.replace(webPath as any);
    };

    // Give the OS a moment to hand off to the app; if the tab is still visible
    // afterwards, no app took over → show the web detail page.
    const timer = setTimeout(openInWeb, 1300);
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.hidden) {
        cancelled = true;
        clearTimeout(timer);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
      document.addEventListener("pagehide", onVisibility);
    }

    // Attempt the native app.
    const appLink = appDeepLink(type, id);
    if (appLink && typeof window !== "undefined") {
      try {
        window.location.href = appLink;
      } catch {
        /* no app registered for the scheme — fallback timer handles it */
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("pagehide", onVisibility);
      }
    };
  }, [valid, webPath, type, id]);

  const styles = createStyles(c);

  if (!valid) {
    return (
      <Screen>
        <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
          <View style={styles.iconCircle}>
            <Compass color={c.primary} size={30} strokeWidth={1.8} />
          </View>
          <Text style={styles.title}>Havola noto'g'ri</Text>
          <Text style={styles.subtitle}>
            Bu QR yoki havola eskirgan yoki noto'g'ri. Iltimos, qaytadan urinib ko'ring.
          </Text>
          <PressableScale onPress={() => router.replace("/")} style={styles.button}>
            <Text style={styles.buttonText}>Bosh sahifaga o'tish</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator color={c.primary} size="large" />
        <Text style={styles.title}>AdabiyotX ochilmoqda…</Text>
        <Text style={styles.subtitle}>Ilova ochilmasa, web sahifa ochiladi.</Text>
        {Platform.OS === "web" && webPath ? (
          <PressableScale onPress={() => router.replace(webPath as any)} style={styles.button}>
            <Text style={styles.buttonText}>
              {fallbackFired ? "Ochilmoqda…" : "Web sahifada ochish"}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </Screen>
  );
}

function createStyles(c: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "flex-start", gap: 16, paddingHorizontal: 30 },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: c.text, fontSize: 22, fontFamily: FONT.serif, fontWeight: "800", textAlign: "center", marginTop: 6 },
    subtitle: { color: c.textDim, fontSize: 15, lineHeight: 22, fontWeight: "500", textAlign: "center", maxWidth: 340 },
    button: {
      height: 48,
      borderRadius: 14,
      backgroundColor: c.primary,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
    },
    buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
}
