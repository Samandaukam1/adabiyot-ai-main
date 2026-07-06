import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/colors";
import BookCover from "@/components/BookCover";
import { PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * A realistic book-cover style card (5:7 ratio) matching the Home screen depth.
 * Reused across profile works: books, poems, articles, stories, scripts, etc.
 */
export default function RealisticWorkCard({
  title,
  subtitle,
  cover,
  width = 116,
  badge,
  icon = "book-open-variant",
  onPress,
}: {
  title: string;
  subtitle?: string;
  cover?: string | null;
  width?: number;
  badge?: string;
  icon?: string;
  onPress?: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  return (
    <PressableScale onPress={onPress} style={{ width }}>
      <BookCover
        uri={cover}
        width={width}
        placeholderIcon={icon as React.ComponentProps<typeof BookCover>["placeholderIcon"]}
      >
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </BookCover>
      <Text numberOfLines={2} style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function createStyles(c: AppTheme, _isDark: boolean) {
  return StyleSheet.create({
    badge: {
      position: "absolute",
      top: 8,
      left: 8 + 12, // clear of the spine overlay
      backgroundColor: c.primary,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    badgeText: { color: "#fff", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6 },
    title: { color: c.text, fontSize: 12.5, fontWeight: "700", marginTop: 8, lineHeight: 16 },
    subtitle: { color: c.textDim, fontSize: 11, fontWeight: "500", marginTop: 2 },
  });
}
