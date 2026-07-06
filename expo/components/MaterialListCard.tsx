import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Heart, Eye, MessageCircle } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";
import { TOP_KIND_LABELS, type TopMaterial } from "@/types/community";

const KIND_ICON: Record<string, string> = {
  book: "book-open-variant",
  poem: "feather",
  article: "newspaper-variant-outline",
  story: "book-open-page-variant",
  script: "movie-open-outline",
  tale: "auto-fix",
  guide: "lightbulb-on-outline",
  novel: "book",
  monologue: "microphone-outline",
  reel: "play-circle-outline",
  material: "file-document-outline",
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function MaterialListCard({
  material,
  rank,
  onPress,
}: {
  material: TopMaterial;
  rank?: number;
  onPress?: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const icon = KIND_ICON[material.kind] ?? "file-document-outline";

  return (
    <PressableScale onPress={onPress} style={styles.card}>
      {rank != null ? (
        <View style={styles.rankWrap}>
          <Text style={[styles.rank, rank <= 3 && styles.rankTop]}>{rank}</Text>
        </View>
      ) : null}
      <View style={styles.coverWrap}>
        {material.cover ? (
          <Image source={{ uri: material.cover }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <MaterialCommunityIcons name={icon as any} size={22} color={c.primary} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name={icon as any} size={11} color={c.primary} />
          <Text style={styles.badgeText}>{TOP_KIND_LABELS[material.kind]}</Text>
        </View>
        <Text numberOfLines={2} style={styles.title}>
          {material.title}
        </Text>
        <Text numberOfLines={1} style={styles.author}>
          {material.authorName}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Eye color={c.textMuted} size={12} />
            <Text style={styles.metaText}>{formatCount(material.readsCount)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Heart color={c.textMuted} size={12} />
            <Text style={styles.metaText}>{formatCount(material.likesCount)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MessageCircle color={c.textMuted} size={12} />
            <Text style={styles.metaText}>{formatCount(material.commentsCount)}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.18 : 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    rankWrap: { width: 22, alignItems: "center" },
    rank: { color: c.textMuted, fontSize: 16, fontWeight: "900" },
    rankTop: { color: c.primary },
    coverWrap: {
      width: 54,
      height: 76,
      borderRadius: 9,
      overflow: "hidden",
      backgroundColor: c.soft,
    },
    cover: { width: "100%", height: "100%" },
    coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      backgroundColor: isDark ? "rgba(82,183,136,0.14)" : "rgba(82,183,136,0.10)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 5,
    },
    badgeText: { color: c.primary, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.3 },
    title: { color: c.text, fontSize: 14, fontWeight: "700", lineHeight: 18 },
    author: { color: c.textDim, fontSize: 12, marginTop: 2, fontWeight: "500" },
    metaRow: { flexDirection: "row", gap: 14, marginTop: 7 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { color: c.textMuted, fontSize: 11, fontWeight: "600" },
  });
}
