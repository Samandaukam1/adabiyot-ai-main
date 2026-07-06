import { BlurView } from "expo-blur";
import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Liquid-glass surface. On iOS it renders a real frosted-glass effect
 * (native UIVisualEffectView via expo-blur) with a translucent tint and a
 * bright rim highlight. On Android / web it falls back to a clean solid card
 * so those platforms stay simple and performant.
 *
 * Use it for floating buttons, pills and bars. Children render above the glass.
 */
export function GlassSurface({
  children,
  style,
  radius = 22,
  intensity,
  rim = true,
  tintOverlay,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  rim?: boolean;
  /** Override the translucent tint drawn over the blur. */
  tintOverlay?: string;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(), []);

  if (Platform.OS !== "ios") {
    return (
      <View
        style={[
          {
            backgroundColor: colors.bgCard,
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const overlay =
    tintOverlay ?? (isDark ? "rgba(22,28,36,0.40)" : "rgba(255,255,255,0.45)");
  const rimColor = isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.80)";

  return (
    <View style={[{ borderRadius: radius }, style]}>
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
        <BlurView
          intensity={intensity ?? (isDark ? 55 : 45)}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
        </BlurView>
      </View>
      {rim ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: rimColor },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    clip: { overflow: "hidden" },
  });
}
