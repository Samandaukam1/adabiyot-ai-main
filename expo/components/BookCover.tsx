import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

/**
 * PremiumBookCover — the single, reusable book-cover look for the whole app.
 *
 * Instead of a flat "A4 rectangle", every cover reads like a real hardback:
 *   • LEFT corners are square (the bound spine side)  → borderLeft*Radius: 0
 *   • RIGHT corners are gently rounded (the page side) → borderRight*Radius: r
 *   • a soft spine/binding shadow + a couple of very thin page layers on the
 *     left give a subtle sense of thickness (no cheap 3D / mockup look)
 *   • a soft premium drop-shadow lifts it off the background (iOS + Android)
 *
 * Sizing: pass a `size` variant ("small" | "medium" | "large") or an explicit
 * `width`; the height always follows the real-book 5:7 ratio via aspectRatio.
 * Callers can still override width (e.g. `style={{ width: "100%" }}`) to fit a
 * grid cell — the 5:7 ratio keeps the proportion correct.
 *
 * `children` render as overlays inside the clipped cover (price / free badges,
 * rating stars, etc.). Keep this ONLY for book covers — regular cards stay fully
 * rounded.
 */
export type BookCoverSize = "small" | "medium" | "large";

const SIZE_WIDTH: Record<BookCoverSize, number> = { small: 96, medium: 128, large: 168 };
const SIZE_RADIUS: Record<BookCoverSize, number> = { small: 9, medium: 12, large: 14 };
const SIZE_SPINE: Record<BookCoverSize, number> = { small: 10, medium: 12, large: 16 };

export default function BookCover({
  uri,
  size = "medium",
  width,
  radius,
  showShadow = true,
  contentFit = "cover",
  placeholderIcon = "book-open-variant",
  style,
  children,
}: {
  uri?: string | null;
  size?: BookCoverSize;
  /** Explicit width in px; overrides the `size` variant. Height follows 5:7. */
  width?: number;
  /** Right-corner radius override. */
  radius?: number;
  showShadow?: boolean;
  contentFit?: "cover" | "contain";
  placeholderIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const { colors: c, isDark } = useTheme();
  const r = radius ?? SIZE_RADIUS[size];
  const spineW = SIZE_SPINE[size];
  const resolvedWidth = width ?? SIZE_WIDTH[size];

  // Hard spine on the left, softly rounded page edge on the right.
  const corners: ViewStyle = {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: r,
    borderBottomRightRadius: r,
  };

  return (
    <View
      style={[
        { width: resolvedWidth, aspectRatio: 5 / 7, backgroundColor: c.bgCard },
        corners,
        showShadow ? (isDark ? styles.shadowDark : styles.shadowLight) : null,
        style,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFillObject,
          corners,
          styles.clip,
          {
            backgroundColor: c.soft,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(13,27,42,0.08)",
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFillObject}
            contentFit={contentFit}
            cachePolicy="disk"
            transition={120}
          />
        ) : (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons
              name={placeholderIcon}
              size={Math.round(resolvedWidth * 0.24)}
              color={c.primary}
            />
          </View>
        )}

        {/* Binding shadow along the spine (left → in). */}
        <LinearGradient
          colors={["rgba(0,0,0,0.30)", "rgba(0,0,0,0.10)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.spine, { width: spineW }]}
          pointerEvents="none"
        />
        {/* A couple of very thin "page" layers to hint at thickness. */}
        <View style={[styles.line, { left: 3, backgroundColor: "rgba(255,255,255,0.10)" }]} pointerEvents="none" />
        <View style={[styles.line, { left: 6, backgroundColor: "rgba(0,0,0,0.12)" }]} pointerEvents="none" />
        {/* Bright inner edge where the binding meets the cover face. */}
        <View style={[styles.line, { left: spineW, backgroundColor: "rgba(255,255,255,0.22)" }]} pointerEvents="none" />

        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", borderWidth: 1 },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0 },
  line: { position: "absolute", top: 0, bottom: 0, width: 1 },
  shadowLight: {
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8,
  },
  shadowDark: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
});
