import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { BookMarked, TrendingUp } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Two side-by-side shortcut buttons used on both the Tokcha and Home screens.
 * They route to the shared Adiblar ensiklopediyasi and Top ro'yxatlar pages.
 */
export default function ExploreShortcutButtons() {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  return (
    <View style={styles.row}>
      <View style={styles.cell}>
        <PressableScale onPress={() => router.push("/adiblar")} style={styles.btn}>
          <LinearGradient
            colors={["#52B788", "#2D9B6F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <BookMarked color="#fff" size={18} strokeWidth={2.2} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>Adiblar</Text>
            <Text style={styles.sub} numberOfLines={1}>ensiklopediyasi</Text>
          </View>
        </PressableScale>
      </View>

      <View style={styles.cell}>
        <PressableScale onPress={() => router.push("/top-royxatlar")} style={styles.btn}>
          <LinearGradient
            colors={["#F4A261", "#E76F51"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <TrendingUp color="#fff" size={18} strokeWidth={2.4} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>Top</Text>
            <Text style={styles.sub} numberOfLines={1}>ro'yxatlar</Text>
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 18,
    },
    cell: { flex: 1 },
    btn: {
      width: "100%",
      height: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: isDark ? c.bgCard : "#FFFDF8",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? c.border : "rgba(82,183,136,0.18)",
      paddingHorizontal: 13,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.18 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: c.text, fontSize: 13.5, fontWeight: "800", letterSpacing: -0.2 },
    sub: { color: c.primary, fontSize: 11.5, fontWeight: "600", marginTop: 1 },
  });
}
