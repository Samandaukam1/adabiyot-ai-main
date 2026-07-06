import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/useResponsive";
import WebHeader from "@/components/web/WebHeader";
import WebCursorGlow from "@/components/web/WebCursorGlow";
import WebJaxongirOrb from "@/components/web/WebJaxongirOrb";
import BrandingLoadingScreen from "@/components/BrandingLoadingScreen";
import { AppProvider } from "@/providers/AppProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { BrandingProvider } from "@/providers/BrandingProvider";
import { ProfileProvider } from "@/providers/ProfileProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { JaxongirAIProvider, useJaxongirAI } from "@/providers/JaxongirAIProvider";
import JaxongirAIAssistant from "@/components/jaxongir-ai/JaxongirAIAssistant";
import SplashIntro from "@/components/SplashIntro";
import {
  fetchActiveSplashIntro,
  markSplashIntroShown,
  shouldShowSplashIntro,
  type SplashIntroConfig,
} from "@/lib/splashIntro";
import { getContextFromPath } from "@/utils/jaxongirContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const HIDDEN_HEADER_OPTIONS = { headerShown: false };
const MODAL_HIDDEN_HEADER_OPTIONS = { presentation: "modal" as const, headerShown: false };
const TRANSPARENT_TITLE_OPTIONS = { title: "", headerTransparent: true };
type SplashGateState = "checking" | "showing" | "done";

function JaxongirAIOverlay() {
  const { isOpen, close, currentBook } = useJaxongirAI();
  const pathname = usePathname();
  const ctx = getContextFromPath(pathname);
  return (
    <JaxongirAIAssistant
      isOpen={isOpen}
      onClose={close}
      sourceScreen={ctx.currentScreen}
      promptContext={ctx.promptContext}
      relatedContentType={ctx.relatedContentType ?? undefined}
      relatedContentId={ctx.relatedContentId ?? undefined}
      currentBook={currentBook ?? ctx.currentBook ?? undefined}
    />
  );
}

function RootLayoutNav() {
  const { colors, isDark } = useTheme();
  const { loading, isAuthenticated, isGuest } = useAuth();
  const segments = useSegments();
  const { isWebLayout } = useResponsive();
  const [splashState, setSplashState] = useState<SplashGateState>("checking");
  const [splashConfig, setSplashConfig] = useState<SplashIntroConfig | null>(null);

  // Redirect between the auth gate and the app based on session / guest state.
  useEffect(() => {
    if (loading) return;
    const onAuthScreen = segments[0] === "auth";
    const canEnter = isAuthenticated || isGuest;
    if (!canEnter && !onAuthScreen) {
      router.replace("/auth");
    } else if (canEnter && onAuthScreen) {
      router.replace("/(tabs)");
    }
  }, [loading, isAuthenticated, isGuest, segments]);

  useEffect(() => {
    if (loading) return;

    let active = true;

    async function prepareSplashIntro() {
      const config = await fetchActiveSplashIntro();
      const shouldShow = config ? await shouldShowSplashIntro(config) : false;

      if (!active) return;

      if (config && shouldShow) {
        setSplashConfig(config);
        setSplashState("showing");
      } else {
        setSplashConfig(null);
        setSplashState("done");
      }
    }

    prepareSplashIntro();

    return () => {
      active = false;
    };
  }, [loading]);

  // Hide the native splash only when we can either display the intro or continue.
  useEffect(() => {
    if (!loading && splashState !== "checking") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading, splashState]);

  const handleSplashShown = useCallback(() => {
    if (!splashConfig) return;
    markSplashIntroShown(splashConfig).catch(() => {});
  }, [splashConfig]);

  const handleSplashFinish = useCallback(() => {
    setSplashConfig(null);
    setSplashState("done");
  }, []);

  // The premium web site header is global (tabs + detail + catalog pages all
  // share it), but never on the auth gate / splash and never on native.
  const onAuthScreen = segments[0] === "auth";
  const showWebHeader =
    isWebLayout && !onAuthScreen && (isAuthenticated || isGuest) && splashState === "done";

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} hidden={false} />
      <View style={{ flex: 1 }}>
        {showWebHeader ? <WebHeader /> : null}
        <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerBackTitle: "Orqaga",
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text, fontWeight: "600" as const },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="auth" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="(tabs)" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="book/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="book-ai/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="screenplays" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="screenplay/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="poem/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="article/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="poem-audio/[bookId]" options={MODAL_HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="reader/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="book-reader/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="rich-reader/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="audio/[id]" options={MODAL_HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="author/[id]" options={TRANSPARENT_TITLE_OPTIONS} />
        <Stack.Screen name="publisher/[id]" options={TRANSPARENT_TITLE_OPTIONS} />
        <Stack.Screen name="muallif/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="muallif/daromadlar" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="muallif/asarlar" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="creator/become" options={MODAL_HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="creator/submit" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="settings/index" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="edit-profile" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="adiblar/index" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="adiblar/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="top-royxatlar" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="kitoblar" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="u/[id]" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="notifications" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="payments/tariflar" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="payments/xaridlar" options={HIDDEN_HEADER_OPTIONS} />
        <Stack.Screen name="payments/tarifim" options={HIDDEN_HEADER_OPTIONS} />
      </Stack>
        </View>
      </View>
      {showWebHeader ? <WebCursorGlow /> : null}
      {showWebHeader ? <WebJaxongirOrb /> : null}
      <JaxongirAIOverlay />
      {loading || splashState === "checking" ? (
        <View pointerEvents="auto" style={styles.loadingOverlay}>
          <BrandingLoadingScreen />
        </View>
      ) : null}
      {splashState === "showing" && splashConfig ? (
        <SplashIntro
          config={splashConfig}
          onShown={handleSplashShown}
          onFinish={handleSplashFinish}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    elevation: 2000,
  },
});

export default function RootLayout() {
  // On web, expo-font (via @expo/vector-icons' FontFaceObserver) rejects with
  // "…ms timeout exceeded" when a large icon font (e.g. MaterialCommunityIcons,
  // ~1.3 MB) is slow to load. It's non-fatal — the font arrives / falls back —
  // so swallow just that rejection instead of letting it trip the error overlay.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onRejection = (event: any) => {
      const msg = String(event?.reason?.message ?? event?.reason ?? "");
      if (msg.includes("timeout exceeded")) event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <ProfileProvider>
                <JaxongirAIProvider>
                  <SafeAreaProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <RootLayoutNav />
                    </GestureHandlerRootView>
                  </SafeAreaProvider>
                </JaxongirAIProvider>
              </ProfileProvider>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}
