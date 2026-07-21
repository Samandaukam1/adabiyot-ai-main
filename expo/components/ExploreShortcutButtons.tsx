import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { BarChart3, BookMarked, Library, TrendingUp } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";

export type ExploreSection = "adib_encyclopedia" | "top_lists";

interface CardFamily {
  gradient: [string, string];
  tintLight: string;
  borderLight: string;
  titleLight: string;
  titleDark: string;
  ghost: string;
}

const GREEN: CardFamily = {
  gradient: ["#52B788", "#2D9B6F"],
  tintLight: "#EDF9F2",
  borderLight: "rgba(82,183,136,0.28)",
  titleLight: "#1F8055",
  titleDark: "#7FD9AC",
  ghost: "#52B788",
};

const CORAL: CardFamily = {
  gradient: ["#F4A261", "#E76F51"],
  tintLight: "#FDF1EA",
  borderLight: "rgba(231,111,81,0.26)",
  titleLight: "#C0532E",
  titleDark: "#F2A98C",
  ghost: "#E76F51",
};

/**
 * Two side-by-side editorial cards for Adiblar ensiklopediyasi and Top
 * ro'yxatlar: small icon top-left, title bottom-left, large faded illustration
 * bottom-right, one color family per card.
 *
 * - Controlled mode: pass `activeSection` + `onSelect` to use them as a switcher.
 * - Uncontrolled mode (default): they navigate to the standalone routes.
 */
export default function ExploreShortcutButtons({
  activeSection,
  onSelect,
}: {
  activeSection?: ExploreSection | null;
  onSelect?: (section: ExploreSection) => void;
} = {}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const handlePress = (section: ExploreSection, route: "/adib-encyclopedia" | "/top-royxatlar") => {
    if (onSelect) onSelect(section);
    else router.push(route);
  };

  return (
    <View style={styles.row}>
      <EditorialCard
        family={GREEN}
        title="Adiblar"
        subtitle="ensiklopediyasi"
        smallIcon={<BookMarked color="#fff" size={15} strokeWidth={2.3} />}
        ghostIcon={<Library color={GREEN.ghost} size={104} strokeWidth={1.4} />}
        active={activeSection === "adib_encyclopedia"}
        onPress={() => handlePress("adib_encyclopedia", "/adib-encyclopedia")}
        styles={styles}
        c={c}
        isDark={isDark}
      />
      <EditorialCard
        family={CORAL}
        title="Top"
        subtitle="ro‘yxatlar"
        smallIcon={<TrendingUp color="#fff" size={15} strokeWidth={2.5} />}
        ghostIcon={<BarChart3 color={CORAL.ghost} size={104} strokeWidth={1.4} />}
        active={activeSection === "top_lists"}
        onPress={() => handlePress("top_lists", "/top-royxatlar")}
        styles={styles}
        c={c}
        isDark={isDark}
      />
    </View>
  );
}

function EditorialCard({
  family,
  title,
  subtitle,
  smallIcon,
  ghostIcon,
  active,
  onPress,
  styles,
  c,
  isDark,
}: {
  family: CardFamily;
  title: string;
  subtitle: string;
  smallIcon: React.ReactNode;
  ghostIcon: React.ReactNode;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
  isDark: boolean;
}) {
  const titleColor = isDark ? family.titleDark : family.titleLight;
  const cardStyle: ViewStyle[] = [
    styles.card,
    {
      backgroundColor: isDark ? c.bgCard : family.tintLight,
      borderColor: isDark ? c.border : family.borderLight,
    },
  ];
  if (active) cardStyle.push({ borderColor: family.ghost, borderWidth: 2 });

  return (
    <View style={styles.cell}>
      <PressableScale onPress={onPress} style={cardStyle}>
        <View style={[styles.ghost, { opacity: isDark ? 0.16 : 0.12 }]} pointerEvents="none">
          {ghostIcon}
        </View>
        <LinearGradient
          colors={family.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          {smallIcon}
        </LinearGradient>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: titleColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 18,
    },
    cell: { flex: 1 },
    card: {
      width: "100%",
      height: 112,
      borderRadius: 20,
      borderWidth: 1,
      padding: 13,
      overflow: "hidden",
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.18 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    ghost: {
      position: "absolute",
      right: -14,
      bottom: -18,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    titleWrap: {},
    title: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
    subtitle: { fontSize: 12.5, fontWeight: "700", marginTop: 1 },
  });
}
