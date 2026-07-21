import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronRight, Sparkles } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Premium call-to-action that opens the encyclopedia application form.
 * Realistic depth: coloured drop shadow + gradient fill + glossy top sheen +
 * a frosted icon badge. Shared by the directory, detail and Tokcha section.
 */
export default function EncyclopediaApplyButton({ style }: { style?: ViewStyle }) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  return (
    <PressableScale
      onPress={() => router.push("/adib-encyclopedia/apply")}
      style={[styles.shadow, style ?? {}]}
    >
      <LinearGradient
        colors={[c.primary, c.primaryDim]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0)"]}
          style={styles.sheen}
          pointerEvents="none"
        />
        <View style={styles.badge}>
          <Sparkles color="#fff" size={16} strokeWidth={2.3} />
        </View>
        <Text style={styles.label} numberOfLines={2}>
          Men ham ensiklopediyada chiqishni xohlayman
        </Text>
        <ChevronRight color="rgba(255,255,255,0.92)" size={18} strokeWidth={2.4} />
      </LinearGradient>
    </PressableScale>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    shadow: {
      borderRadius: 17,
      shadowColor: c.primary,
      shadowOpacity: isDark ? 0.45 : 0.32,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
    },
    fill: {
      minHeight: 56,
      borderRadius: 17,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
    },
    sheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "58%",
    },
    badge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.32)",
    },
    label: {
      flex: 1,
      color: "#fff",
      fontSize: 13.5,
      lineHeight: 18,
      fontWeight: "900",
      letterSpacing: 0.2,
      textShadowColor: "rgba(0,0,0,0.18)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });
}
