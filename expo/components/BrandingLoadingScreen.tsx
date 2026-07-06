import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import BrandLogo from "@/components/BrandLogo";
import { FONT } from "@/components/ui";
import { useBranding } from "@/providers/BrandingProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function BrandingLoadingScreen() {
  const { colors } = useTheme();
  const { appName } = useBranding();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <BrandLogo variant="splash" size={92} radius={26} style={styles.logo} />
      <Text style={[styles.title, { color: colors.text }]}>{appName}</Text>
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
  logo: {
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "900",
    fontFamily: FONT.serif,
  },
  spinner: {
    marginTop: 18,
  },
});
