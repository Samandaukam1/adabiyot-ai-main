import React from "react";
import { StyleSheet, View } from "react-native";
import SplashPulse, { SPLASH_BG } from "@/components/SplashPulse";

/**
 * The launch gate shown while the session + splash config resolve.
 *
 * It is deliberately a PIXEL CONTINUATION of the native splash screen: the same
 * flat background colour as `expo-splash-screen` in app.json (which carries no
 * image), and NO logo, wordmark or text of its own. The first branded thing the
 * user sees is the admin splash animation — handing over from the native splash
 * should look like nothing happened.
 */
export default function BrandingLoadingScreen() {
  return (
    <View style={styles.root}>
      <SplashPulse />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SPLASH_BG,
  },
});
