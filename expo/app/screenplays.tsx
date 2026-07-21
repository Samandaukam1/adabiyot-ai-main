import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Clapperboard, Eye, Film, Shield } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { formatUzs } from "@/constants/tariffs";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { usePublishedScreenplays } from "@/hooks/useScreenplays";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import type { ScreenplayCard } from "@/lib/screenplays";
import { useTheme } from "@/providers/ThemeProvider";

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_GAP = 12;
const GRID_PAD = 18;
const CARD_W = (SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2;

const ALL_GENRES = "Hammasi";

export default function ScreenplaysHub() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { screenplays, loading, error, refetch } = usePublishedScreenplays();
  const refresh = usePullToRefresh(refetch);
  const [genre, setGenre] = useState<string>(ALL_GENRES);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const item of screenplays) if (item.genre) set.add(item.genre);
    return [ALL_GENRES, ...Array.from(set)];
  }, [screenplays]);

  const filtered = useMemo(
    () => (genre === ALL_GENRES ? screenplays : screenplays.filter((s) => s.genre === genre)),
    [screenplays, genre]
  );

  useEffect(() => {
    if (__DEV__) console.log("[ScreenplaysPage] mounted");
  }, []);

  useEffect(() => {
    if (__DEV__) console.log("[ScreenplaysPage] count:", screenplays?.length);
    if (__DEV__) console.log("[ScreenplaysPage] data:", screenplays);
    if (__DEV__) console.log("[ScreenplaysPage] error:", error);
  }, [error, screenplays]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 130 }}
        refreshControl={
          <RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor={c.primary} />
        }
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={c.text} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>SSENARIYLAR</Text>
            <Text style={styles.title}>Ijodiy ssenariy markazi</Text>
            <Text style={styles.subtitle}>
              Kino, sahna va tadbir ssenariylarini o'qing — har biri sahnama-sahna tayyor.
            </Text>
          </View>
        </View>

        {genres.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {genres.map((g) => {
              const active = g === genre;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGenre(g)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading && screenplays.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={c.primary} />
            <Text style={styles.stateText}>Ssenariylar yuklanmoqda…</Text>
          </View>
        ) : screenplays.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Clapperboard color={c.primary} size={30} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>
              {error ? "Ssenariylarni yuklab bo'lmadi" : "Hali ssenariylar mavjud emas"}
            </Text>
            <Text style={styles.emptyText}>
              {error
                ? "Internetni tekshirib, sahifani yangilang."
                : "Yangi ssenariylar chiqishi bilan shu yerda ko'rinadi."}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {(filtered.length > 0 ? filtered : screenplays).map((item) => (
              <ScreenplayGridCard key={item.id} item={item} c={c} styles={styles} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

type StylesType = ReturnType<typeof createStyles>;

function ScreenplayGridCard({
  item,
  c,
  styles,
}: {
  item: ScreenplayCard;
  c: AppTheme;
  styles: StylesType;
}) {
  return (
    <PressableScale
      onPress={() => router.push(`/screenplay/${item.id}`)}
      style={styles.card}
    >
      <View style={styles.poster}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]}>
            <Film color={c.primary} size={30} strokeWidth={1.6} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(6,14,9,0.72)"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.badge}>
          <Film color="#fff" size={11} />
          <Text style={styles.badgeText}>SSENARIY</Text>
        </View>
        <View style={styles.priceTag}>
          <Text style={styles.priceTagText}>{item.isFree ? "Bepul" : formatUzs(item.price)}</Text>
        </View>
        {item.ageRating ? (
          <View style={styles.ageTag}>
            <Shield color="#fff" size={10} />
            <Text style={styles.ageTagText}>{item.ageRating}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      {item.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
      ) : null}
      <Text style={styles.cardMeta} numberOfLines={1}>{item.author}</Text>
      <View style={styles.cardFoot}>
        <Text style={styles.cardGenre} numberOfLines={1}>{item.genre}</Text>
        {item.readCount > 0 ? (
          <View style={styles.readRow}>
            <Eye color={c.textMuted} size={12} />
            <Text style={styles.readText}>{formatCount(item.readCount)}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 8 },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    headerCopy: {
      backgroundColor: isDark ? c.bgCard : "rgba(255,255,255,0.60)",
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
    },
    kicker: { color: c.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
    title: {
      color: c.text,
      fontFamily: FONT.serif,
      fontSize: 31,
      lineHeight: 36,
      fontWeight: "800",
      marginTop: 8,
    },
    subtitle: { color: c.textDim, fontSize: 14, lineHeight: 21, marginTop: 8, fontWeight: "500" },

    chipsRow: { paddingHorizontal: 18, gap: 8, paddingVertical: 16 },
    chip: {
      height: 36,
      borderRadius: 999,
      paddingHorizontal: 16,
      justifyContent: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.textDim, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: "#fff" },

    loadingState: { alignItems: "center", gap: 12, paddingTop: 80 },
    stateText: { color: c.textDim, fontSize: 14, fontWeight: "600" },

    emptyState: { alignItems: "center", paddingTop: 70, paddingHorizontal: 40 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    emptyTitle: {
      color: c.text,
      fontSize: 19,
      fontFamily: FONT.serif,
      fontWeight: "800",
      textAlign: "center",
    },
    emptyText: {
      color: c.textDim,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 8,
      fontWeight: "500",
    },

    grid: {
      paddingHorizontal: GRID_PAD,
      paddingTop: 4,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GRID_GAP,
    },
    card: { width: CARD_W },
    poster: {
      width: "100%",
      aspectRatio: 0.7,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: c.soft,
      borderWidth: 1,
      borderColor: c.border,
    },
    posterFallback: { alignItems: "center", justifyContent: "center", backgroundColor: c.soft },
    badge: {
      position: "absolute",
      top: 10,
      left: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(47,158,110,0.95)",
      borderRadius: 7,
      paddingHorizontal: 8,
      height: 22,
    },
    badgeText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
    priceTag: {
      position: "absolute",
      bottom: 10,
      left: 10,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 8,
      paddingHorizontal: 9,
      height: 24,
      justifyContent: "center",
    },
    priceTagText: { color: "#fff", fontSize: 11, fontWeight: "800" },
    ageTag: {
      position: "absolute",
      top: 10,
      right: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 7,
      paddingHorizontal: 7,
      height: 22,
    },
    ageTagText: { color: "#fff", fontSize: 10, fontWeight: "800" },
    cardTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: "800",
      fontFamily: FONT.serif,
      marginTop: 10,
      lineHeight: 20,
    },
    cardDescription: { color: c.textDim, fontSize: 12, lineHeight: 16, marginTop: 5, fontWeight: "500" },
    cardMeta: { color: c.textDim, fontSize: 12, fontWeight: "600", marginTop: 3 },
    cardFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
    },
    cardGenre: { color: c.primary, fontSize: 11, fontWeight: "800", flex: 1 },
    readRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    readText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  });
}
