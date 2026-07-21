/**
 * Home-screen "Janrlar" / "Kategoriyalar" cards. They open the full browsers,
 * which read the live taxonomy from Supabase — see app/janrlar.tsx and
 * app/kategoriyalar.tsx.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";

export default function TaxonomyShortcutButtons() {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  return (
    <View style={styles.row}>
      <ShortcutCard
        title="Janrlar"
        subtitle="Adabiy yo‘nalishlar"
        icon="bookshelf"
        gradient={["#52B788", "#2D9B6F"]}
        onPress={() => router.push("/janrlar")}
        styles={styles}
      />
      <ShortcutCard
        title="Kategoriyalar"
        subtitle="Mavzu va turkumlar"
        icon="shape-outline"
        gradient={["#F4A261", "#E76F51"]}
        onPress={() => router.push("/kategoriyalar")}
        styles={styles}
      />
    </View>
  );
}

function ShortcutCard({
  title,
  subtitle,
  icon,
  gradient,
  onPress,
  styles,
}: {
  title: string;
  subtitle: string;
  icon: string;
  gradient: [string, string];
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.cell}>
      <PressableScale onPress={onPress} style={styles.card}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          <MaterialCommunityIcons name={icon as any} size={17} color="#fff" />
        </LinearGradient>
        <View>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    cell: { flex: 1 },
    card: {
      width: "100%",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      padding: 13,
      gap: 12,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.18 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      color: c.text,
      fontSize: 15.5,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    subtitle: {
      color: c.textDim,
      fontSize: 11.5,
      fontWeight: "700",
      marginTop: 1,
    },
  });
}
