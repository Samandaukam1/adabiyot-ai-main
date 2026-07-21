/**
 * Shared "Janrlar" / "Kategoriyalar" browser.
 *
 * Two states in one screen:
 *   list   — searchable cards, one per taxonomy entry that has published books
 *   detail — the published books tagged with the tapped entry
 *
 * Every row comes from Supabase (`content_genres` / `content_categories` + the
 * published catalog). There is no mock fallback: an empty result renders an
 * empty state, never invented data.
 */
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft, Search, X } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BookCover from "@/components/BookCover";
import { FONT, PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { normalizeTaxonomyName } from "@/lib/taxonomy";
import { useTheme } from "@/providers/ThemeProvider";
import type { DisplayBook } from "@/types/database";

/** One taxonomy entry, flattened so genres and categories share this screen. */
export interface TaxonomyEntry {
  id: string;
  name: string;
  slug: string;
  count: number;
}

const GRADIENTS: [string, string][] = [
  ["#52B788", "#2D9B6F"],
  ["#F4A261", "#E76F51"],
  ["#4C8DF6", "#2563EB"],
  ["#A78BFA", "#7C3AED"],
  ["#22D3EE", "#0891B2"],
  ["#FB7185", "#E11D48"],
  ["#FBBF24", "#D97706"],
  ["#34D399", "#059669"],
];

/** Stable per-entry accent so a card keeps its colour between renders. */
function accentFor(slug: string, index: number): [string, string] {
  const seed = slug
    ? slug.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    : index;
  return GRADIENTS[seed % GRADIENTS.length];
}

export interface TaxonomyBrowseScreenProps {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  icon: string;
  entries: TaxonomyEntry[];
  loading: boolean;
  error: string | null;
  /** Books tagged with `entry`, resolved by the caller. */
  booksFor: (entry: TaxonomyEntry) => DisplayBook[];
  emptyListText: string;
  emptyDetailText: string;
  backToListLabel: string;
}

export default function TaxonomyBrowseScreen({
  title,
  subtitle,
  searchPlaceholder,
  icon,
  entries,
  loading,
  error,
  booksFor,
  emptyListText,
  emptyDetailText,
  backToListLabel,
}: TaxonomyBrowseScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TaxonomyEntry | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeTaxonomyName(query);
    if (!q) return entries;
    return entries.filter((e) => normalizeTaxonomyName(e.name).includes(q));
  }, [entries, query]);

  const books = useMemo(() => (selected ? booksFor(selected) : []), [selected, booksFor]);

  const handleBack = useCallback(() => {
    if (selected) setSelected(null);
    else router.back();
  }, [selected]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {selected ? selected.name : title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {selected ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          <Pressable onPress={() => setSelected(null)} style={styles.backToList} hitSlop={6}>
            <ChevronLeft color={c.primary} size={16} />
            <Text style={styles.backToListText}>{backToListLabel}</Text>
          </Pressable>

          {books.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{emptyDetailText}</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {books.map((book) => (
                <BookGridCard key={book.id} book={book} styles={styles} c={c} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.searchWrap}>
            <Search color={c.textMuted} size={17} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={c.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <X color={c.textMuted} size={16} />
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={c.primary} />
              <Text style={styles.stateText}>Ma'lumotlar yuklanmoqda…</Text>
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{error}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>
                {query ? "Hech narsa topilmadi." : emptyListText}
              </Text>
            </View>
          ) : (
            <View style={styles.cardsWrap}>
              {filtered.map((entry, index) => (
                <EntryCard
                  key={entry.id || entry.slug || entry.name}
                  entry={entry}
                  gradient={accentFor(entry.slug, index)}
                  icon={icon}
                  onPress={() => setSelected(entry)}
                  styles={styles}
                  c={c}
                  isDark={isDark}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EntryCard({
  entry,
  gradient,
  icon,
  onPress,
  styles,
  c,
  isDark,
}: {
  entry: TaxonomyEntry;
  gradient: [string, string];
  icon: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
  isDark: boolean;
}) {
  return (
    <View style={styles.cardCell}>
      <PressableScale onPress={onPress} style={styles.card}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardIcon}
        >
          <MaterialCommunityIcons name={icon as any} size={17} color="#fff" />
        </LinearGradient>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {entry.name}
        </Text>
        <Text style={[styles.cardCount, { color: isDark ? c.secondary : c.primaryDim }]}>
          {entry.count} ta asar
        </Text>
      </PressableScale>
    </View>
  );
}

function BookGridCard({
  book,
  styles,
  c,
}: {
  book: DisplayBook;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
}) {
  return (
    <View style={styles.bookCell}>
      <PressableScale onPress={() => router.push(`/book/${book.id}`)}>
        <BookCover uri={book.cover} radius={12} style={styles.bookCover} />
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {book.authorName}
        </Text>
        <Text style={[styles.bookPrice, { color: book.isFree ? c.success : c.primary }]}>
          {book.isFree ? "Bepul" : `${book.price.toLocaleString("ru-RU")} so'm`}
        </Text>
      </PressableScale>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      fontWeight: "800",
      color: c.text,
      fontFamily: FONT.serif,
    },
    subtitle: {
      color: c.textDim,
      fontSize: 13.5,
      fontWeight: "600",
      paddingHorizontal: 20,
      paddingTop: 16,
      lineHeight: 19,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginHorizontal: 20,
      marginTop: 14,
      marginBottom: 6,
      paddingHorizontal: 13,
      height: 44,
      borderRadius: 14,
      backgroundColor: isDark ? c.bgCard : c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: 14.5,
      fontWeight: "500",
      padding: 0,
    },
    cardsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 14,
      paddingTop: 10,
    },
    cardCell: {
      width: "50%",
      padding: 6,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      padding: 14,
      minHeight: 118,
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    cardIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    cardTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    cardCount: {
      fontSize: 11.5,
      fontWeight: "700",
      marginTop: 3,
    },
    backToList: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 4,
    },
    backToListText: {
      color: c.primary,
      fontSize: 13.5,
      fontWeight: "700",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 14,
      paddingTop: 8,
    },
    bookCell: {
      width: "50%",
      padding: 6,
      marginBottom: 10,
    },
    // Let the 5:7 cover fill the grid cell instead of its fixed size variant.
    bookCover: { width: "100%" },
    bookTitle: {
      color: c.text,
      fontSize: 13.5,
      fontWeight: "700",
      marginTop: 8,
      lineHeight: 18,
    },
    bookAuthor: {
      color: c.textDim,
      fontSize: 11.5,
      fontWeight: "600",
      marginTop: 2,
    },
    bookPrice: {
      fontSize: 11.5,
      fontWeight: "800",
      marginTop: 3,
    },
    stateBox: {
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 60,
      paddingHorizontal: 30,
    },
    stateText: {
      color: c.textDim,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 20,
    },
    emptyBox: {
      alignItems: "center",
      paddingVertical: 60,
      paddingHorizontal: 30,
    },
    emptyText: {
      color: c.textDim,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 20,
    },
  });
}
