import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Quote } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT } from "@/components/ui";
import { useAdibEntry } from "@/hooks/useAdibEncyclopedia";
import { useTheme } from "@/providers/ThemeProvider";
import { getInitials } from "@/types/profile";

const SECTIONS: { key: "biography" | "education" | "activity" | "worksSummary" | "achievements"; label: string; icon: string }[] = [
  { key: "biography", label: "Biografiya", icon: "book-account-outline" },
  { key: "education", label: "Ta'lim", icon: "school-outline" },
  { key: "activity", label: "Faoliyat", icon: "briefcase-outline" },
  { key: "worksSummary", label: "Asarlari", icon: "bookshelf" },
  { key: "achievements", label: "Yutuqlari", icon: "trophy-outline" },
];

export default function AdibDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { adib, loading } = useAdibEntry(id);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!adib) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>Adib topilmadi</Text>
        <Pressable onPress={() => router.back()} style={styles.backInline}>
          <Text style={styles.backInlineText}>Orqaga</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <LinearGradient
          colors={isDark
            ? ["rgba(82,183,136,0.14)", "rgba(13,17,23,0)"]
            : ["rgba(82,183,136,0.12)", "rgba(255,255,255,0)"]}
          style={[styles.hero, { paddingTop: insets.top + 8 }]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={c.text} size={22} />
          </Pressable>

          {adib.avatarUrl ? (
            <Image source={{ uri: adib.avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.avatar}>
              <Text style={styles.initials}>{getInitials(adib.fullName)}</Text>
            </LinearGradient>
          )}
          <Text style={styles.name}>{adib.fullName}</Text>
          {adib.penName ? <Text style={styles.pen}>“{adib.penName}”</Text> : null}
          <View style={styles.metaRow}>
            {adib.birthYear ? (
              <View style={styles.metaPill}>
                <MaterialCommunityIcons name="calendar" size={12} color={c.primary} />
                <Text style={styles.metaText}>{adib.birthYear}</Text>
              </View>
            ) : null}
          </View>
          {adib.shortDescription ? (
            <Text style={styles.shortDesc}>{adib.shortDescription}</Text>
          ) : null}
        </LinearGradient>

        {SECTIONS.map((s) => {
          const value = adib[s.key];
          if (!value) return null;
          return (
            <View key={s.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons name={s.icon as any} size={16} color={c.primary} />
                </View>
                <Text style={styles.sectionLabel}>{s.label}</Text>
              </View>
              <Text style={styles.sectionBody}>{value}</Text>
            </View>
          );
        })}

        {adib.quotes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Quote color={c.primary} size={15} />
              </View>
              <Text style={styles.sectionLabel}>Iqtiboslar</Text>
            </View>
            {adib.quotes.map((quote, i) => (
              <View key={i} style={styles.quoteCard}>
                <Text style={styles.quoteText}>“{quote}”</Text>
              </View>
            ))}
          </View>
        )}

        {adib.sources.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sourcesLabel}>Manbalar</Text>
            {adib.sources.map((src, i) => (
              <Text key={i} style={styles.sourceItem}>• {src}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center", gap: 14 },
    emptyText: { color: c.textMuted, fontSize: 14 },
    backInline: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: c.primary,
    },
    backInlineText: { color: "#fff", fontWeight: "800" },
    hero: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 24 },
    backBtn: {
      position: "absolute",
      left: 16,
      top: 0,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: {
      width: 110,
      height: 110,
      borderRadius: 55,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 44,
      borderWidth: 3,
      borderColor: c.bg,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    initials: { color: "#fff", fontSize: 38, fontWeight: "900", fontFamily: FONT.serif },
    name: {
      color: c.text,
      fontSize: 24,
      fontWeight: "900",
      fontFamily: FONT.serif,
      textAlign: "center",
      marginTop: 14,
      letterSpacing: -0.3,
    },
    pen: { color: c.primary, fontSize: 14, fontWeight: "700", marginTop: 4 },
    metaRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: isDark ? "rgba(82,183,136,0.14)" : "rgba(82,183,136,0.10)",
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    metaText: { color: c.primary, fontSize: 12, fontWeight: "700" },
    shortDesc: {
      color: c.textDim,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 14,
      fontWeight: "500",
    },
    section: { paddingHorizontal: 20, marginTop: 24 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    sectionIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: isDark ? "#162D26" : "#E8F5EE",
      alignItems: "center",
      justifyContent: "center",
    },
    sectionLabel: { color: c.text, fontSize: 16, fontWeight: "800" },
    sectionBody: { color: c.textDim, fontSize: 14.5, lineHeight: 23, fontWeight: "500" },
    quoteCard: {
      backgroundColor: c.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
      padding: 14,
      marginBottom: 10,
    },
    quoteText: {
      color: c.text,
      fontSize: 14.5,
      lineHeight: 22,
      fontStyle: "italic",
      fontFamily: FONT.serif,
    },
    sourcesLabel: { color: c.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
    sourceItem: { color: c.textDim, fontSize: 13, lineHeight: 20, fontWeight: "500" },
  });
}
