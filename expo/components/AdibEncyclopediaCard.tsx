import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";
import type { AdibEntry } from "@/types/community";
import { getInitials } from "@/types/profile";

export default function AdibEncyclopediaCard({
  adib,
  style,
}: {
  adib: AdibEntry;
  style?: ViewStyle;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const handle = adib.adabiyotxUsername
    ? `@${adib.adabiyotxUsername.replace(/^@+/, "")}`
    : null;

  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/adib-encyclopedia/[id]", params: { id: adib.id } })}
      style={style ? [styles.card, style] : styles.card}
    >
      <View style={styles.topRow}>
        {adib.photoUrl ? (
          <Image source={{ uri: adib.photoUrl }} style={styles.photo} contentFit="cover" />
        ) : (
          <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.photo}>
            <Text style={styles.initials}>{getInitials(adib.fullName)}</Text>
          </LinearGradient>
        )}
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={2}>{adib.fullName}</Text>
          {adib.penName ? <Text style={styles.pen} numberOfLines={1}>“{adib.penName}”</Text> : null}
          {handle ? <Text style={styles.handle} numberOfLines={1}>{handle}</Text> : null}
        </View>
      </View>

      {adib.roles.length > 0 ? (
        <Text style={styles.roles} numberOfLines={1} ellipsizeMode="tail">{adib.roles.join(" | ")}</Text>
      ) : null}
      {adib.shortDescription ? (
        <Text style={styles.description} numberOfLines={3}>{adib.shortDescription}</Text>
      ) : null}

      <View style={styles.moreRow}>
        <Text style={styles.moreText}>Batafsil</Text>
        <ChevronRight color={c.primary} size={16} strokeWidth={2.4} />
      </View>
    </PressableScale>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    card: {
      width: 310,
      minHeight: 224,
      backgroundColor: c.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.2 : 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    topRow: { flexDirection: "row", alignItems: "center", gap: 13 },
    photo: {
      width: 72,
      height: 82,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
    initials: { color: "#fff", fontSize: 24, fontWeight: "900", fontFamily: FONT.serif },
    identity: { flex: 1, minWidth: 0 },
    name: { color: c.text, fontSize: 17, lineHeight: 21, fontWeight: "900", fontFamily: FONT.serif },
    pen: { color: c.primary, fontSize: 12.5, fontWeight: "700", marginTop: 4 },
    handle: { color: c.textMuted, fontSize: 12, fontWeight: "700", marginTop: 3 },
    roles: { color: c.primary, fontSize: 11.5, lineHeight: 17, fontWeight: "700", marginTop: 13 },
    description: { color: c.textDim, fontSize: 12.5, lineHeight: 18, fontWeight: "500", marginTop: 8 },
    moreRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 12, alignSelf: "flex-end" },
    moreText: { color: c.primary, fontSize: 12.5, fontWeight: "800" },
  });
}
