import { RotateCcw } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * App-wide fallback rendered by Expo Router when a screen throws during render.
 * Exported as `ErrorBoundary` from `app/_layout.tsx`, so any uncaught render
 * error shows this retry screen instead of a white screen / full crash.
 *
 * It renders outside the app's ThemeProvider, so it cannot use `useTheme` —
 * colors come from the OS `useColorScheme` and stay self-contained.
 */
export default function RootErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => Promise<void>;
}) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();

  const bg = isDark ? "#0E1512" : "#F4F7F5";
  const card = isDark ? "#16211C" : "#FFFFFF";
  const text = isDark ? "#EAF2EE" : "#12201A";
  const muted = isDark ? "#9BB0A6" : "#5E7268";
  const accent = "#2E7D32";

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.card, { backgroundColor: card }]}>
        <Text style={[styles.title, { color: text }]}>Xatolik yuz berdi</Text>
        <Text style={[styles.message, { color: muted }]}>
          Nimadir noto&apos;g&apos;ri ketdi. Iltimos, qayta urinib ko&apos;ring.
        </Text>

        {__DEV__ && error?.message ? (
          <Text style={[styles.debug, { color: muted }]} numberOfLines={4}>
            {error.message}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void retry();
          }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <RotateCcw color="#FFFFFF" size={18} />
          <Text style={styles.buttonText}>Qayta urinib ko&apos;rish</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  debug: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 4,
  },
  button: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
