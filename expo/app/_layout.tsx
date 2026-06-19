import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo } from "react";
import type { ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/providers/AppProvider";
import { palette } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const HIDDEN_HEADER_OPTIONS = { headerShown: false };
const MODAL_HIDDEN_HEADER_OPTIONS = { presentation: "modal" as const, headerShown: false };
const TRANSPARENT_TITLE_OPTIONS = { title: "", headerTransparent: true };

function RootLayoutNav() {
  const screenOptions = useMemo(
    () => ({
      headerBackTitle: "Orqaga",
      headerStyle: { backgroundColor: palette.bg },
      headerTitleStyle: { color: palette.text, fontWeight: "600" as const },
      headerTintColor: palette.text,
      contentStyle: { backgroundColor: palette.bg },
    }),
    []
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="book/[id]" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="screenplays" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="screenplay/[id]" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="poem/[id]" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="poem-audio/[bookId]" options={MODAL_HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="reader/[id]" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="book-reader/[id]" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="rich-reader/[id]" options={HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="audio/[id]" options={MODAL_HIDDEN_HEADER_OPTIONS} />
      <Stack.Screen name="author/[id]" options={TRANSPARENT_TITLE_OPTIONS} />
      <Stack.Screen name="publisher/[id]" options={TRANSPARENT_TITLE_OPTIONS} />
    </Stack>
  );
}

export default function RootLayout() {
  const rootStyle = useMemo<ViewStyle>(
    () => ({ flex: 1, backgroundColor: palette.bg }),
    []
  );

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={rootStyle}>
            <StatusBar style="dark" />
            <RootLayoutNav />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
