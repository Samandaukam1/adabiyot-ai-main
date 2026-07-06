import { BookOpen, FileText, Mic, Play } from "lucide-react-native";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";

export type ProfileTabKey = "asarlar" | "reels" | "monologlar" | "maqolalar";

const TABS: { key: ProfileTabKey; label: string; Icon: typeof BookOpen }[] = [
  { key: "asarlar", label: "Asarlar", Icon: BookOpen },
  { key: "reels", label: "Reels", Icon: Play },
  { key: "monologlar", label: "Monolog", Icon: Mic },
  { key: "maqolalar", label: "Maqola", Icon: FileText },
];

/**
 * Centered, equal-width content tabs with an icon above each label.
 * Shared by the Profile and Public Profile screens.
 */
export default function ProfileContentTabs({
  active,
  onChange,
}: {
  active: ProfileTabKey;
  onChange: (key: ProfileTabKey) => void;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  return (
    <View style={styles.row}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}>
            <View style={[styles.inner, isActive && styles.innerActive]}>
              <tab.Icon
                color={isActive ? c.primary : c.textMuted}
                size={14}
                strokeWidth={2.2}
              />
              <Text numberOfLines={1} style={[styles.label, isActive && styles.labelActive]}>
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      paddingHorizontal: 14,
      gap: 8,
      marginTop: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingBottom: 8,
    },
    tab: { flex: 1 },
    inner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 9,
      paddingHorizontal: 4,
      borderRadius: 12,
    },
    innerActive: {
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.22)",
    },
    label: { color: c.textMuted, fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
    labelActive: { color: c.primary, fontWeight: "800" },
  });
}
