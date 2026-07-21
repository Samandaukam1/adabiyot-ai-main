import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import BrandLogo from "@/components/BrandLogo";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * The launch gate shown while the session + splash config resolve.
 *
 * It is deliberately a PIXEL CONTINUATION of the native splash screen, not a
 * second branded screen: same background colours as `expo-splash-screen` in
 * app.json, the same bundled mark at the same relative size, no wordmark and no
 * coloured badge. Handing over from the native splash should look like nothing
 * happened — otherwise the user sees "logo → another logo → animation".
 */
const SPLASH_BG_LIGHT = "#F7F4ED";
const SPLASH_BG_DARK = "#0D1117";
/** Matches `imageWidth: 220` in the app.json expo-splash-screen config. */
const SPLASH_MARK_SIZE = 220;

export default function BrandingLoadingScreen() {
  const { colors } = useTheme();
  const isDark = colors.isDark;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: isDark ? SPLASH_BG_DARK : SPLASH_BG_LIGHT },
      ]}
    >
      <BrandLogo variant="splash" size={SPLASH_MARK_SIZE} plain bundledOnly />
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  spinner: {
    position: "absolute",
    bottom: 72,
  },
});
