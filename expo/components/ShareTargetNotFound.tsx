import { router } from "expo-router";
import { Compass } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { FONT, PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Shown when a shared link points at content that no longer exists (deleted
 * post, unpublished reel, wrong @username). A shared link must never dead-end
 * on a blank screen — there is always a way back to the home page.
 */
export default function ShareTargetNotFound({
  title = "Sahifa topilmadi",
  message,
}: {
  title?: string;
  message?: string;
}) {
  const { colors: c, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
            borderColor: c.borderStrong,
          },
        ]}
      >
        <Compass color={c.primary} size={34} strokeWidth={1.8} />
      </View>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.message, { color: c.textDim }]}>
        {message ?? "Bu havola eskirgan yoki kontent o'chirilgan bo'lishi mumkin."}
      </Text>
      <PressableScale
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={[styles.button, { backgroundColor: c.primary }]}
      >
        <Text style={styles.buttonText}>Bosh sahifaga qaytish</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -0.3 },
  message: { fontSize: 14, lineHeight: 21, fontWeight: "500", textAlign: "center", maxWidth: 320 },
  button: { marginTop: 10, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 999 },
  buttonText: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
});
