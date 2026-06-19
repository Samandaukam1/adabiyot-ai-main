import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Book,
  BookOpen,
  Clapperboard,
  Feather,
  GraduationCap,
  Lightbulb,
  Scroll,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, Pill, PressableScale, Screen } from "@/components/ui";
import { books, categories, Category, getAuthor, getBookRoute } from "@/mocks/content";

const { width: SCREEN_W } = Dimensions.get("window");
const ICONS: Record<string, React.ComponentType<{ color: string; size: number; strokeWidth?: number }>> = {
  BookOpen,
  Book,
  Feather,
  Lightbulb,
  GraduationCap,
  Sparkles,
  Clapperboard,
  Scroll,
};

type Filter = "Bepul" | "Pullik" | "Audio" | "Trend" | "Yangi";
const FILTERS: Filter[] = ["Bepul", "Pullik", "Audio", "Trend", "Yangi"];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState<string>("");
  const [cat, setCat] = useState<Category | null>(null);
  const [filters, setFilters] = useState<Set<Filter>>(new Set());

  const results = useMemo(() => {
    return books.filter((b) => {
      if (q && !b.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (cat && b.category !== cat) return false;
      if (filters.has("Bepul") && !b.free) return false;
      if (filters.has("Pullik") && b.free) return false;
      if (filters.has("Audio") && !b.audioAvailable) return false;
      if (filters.has("Trend") && !b.trending) return false;
      return true;
    });
  }, [q, cat, filters]);

  const toggleFilter = (f: Filter) => {
    setFilters((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>Kashf eting</Text>
        <Text style={styles.h2}>Adabiyot olamiga sayohat</Text>

        <View style={styles.searchWrap}>
          <Search color={palette.textMuted} size={18} />
          <TextInput
            style={styles.search}
            placeholder="Kitob, muallif yoki nashriyot..."
            placeholderTextColor={palette.textMuted}
            value={q}
            onChangeText={setQ}
            testID="search-input"
          />
          {q ? (
            <Pressable onPress={() => setQ("")} hitSlop={10}>
              <X color={palette.textMuted} size={18} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => (
            <Pill key={f} label={f} active={filters.has(f)} onPress={() => toggleFilter(f)} />
          ))}
        </ScrollView>

        {!q && !cat ? (
          <>
            <Text style={styles.section}>Janrlar</Text>
            <View style={styles.catsGrid}>
              {categories.map((c) => {
                const Icon = ICONS[c.icon] ?? Book;
                return (
                  <PressableScale
                    key={c.name}
                    onPress={() => {
                      if (c.name === "Ssenariy") {
                        router.push("/screenplays");
                        return;
                      }
                      setCat(c.name);
                    }}
                    style={styles.catCard}
                  >
                    <View style={[styles.catIcon, { backgroundColor: `${c.color}22`, borderColor: `${c.color}55` }]}>
                      <Icon color={c.color} size={22} strokeWidth={2} />
                    </View>
                    <Text style={styles.catName}>{c.name}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </>
        ) : null}

        {cat ? (
          <View style={styles.activeCatRow}>
            <Text style={styles.section}>{cat}</Text>
            <Pressable onPress={() => setCat(null)} hitSlop={10}>
              <Text style={{ color: palette.primary, fontWeight: "600" }}>Tozalash</Text>
            </Pressable>
          </View>
        ) : (
          (q || filters.size > 0) && <Text style={styles.section}>Natijalar</Text>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 14 }}
          renderItem={({ item }) => {
            const a = getAuthor(item.authorId);
            return (
              <PressableScale
                onPress={() => router.push(getBookRoute(item))}
                style={styles.resItem}
              >
                <Image source={{ uri: item.cover }} style={styles.resCover} contentFit="contain" />
                <View style={styles.resRating}>
                  <Star color={palette.gold} size={10} fill={palette.gold} />
                  <Text style={styles.resRatingText}>{item.rating.toFixed(1)}</Text>
                </View>
                {item.free ? (
                  <View style={styles.resBadge}>
                    <Text style={styles.resBadgeText}>BEPUL</Text>
                  </View>
                ) : null}
                <Text numberOfLines={1} style={styles.resTitle}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.resAuthor}>{a?.name}</Text>
              </PressableScale>
            );
          }}
          ListEmptyComponent={
            (q || cat || filters.size > 0) ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Hech narsa topilmadi</Text>
              </View>
            ) : null
          }
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    color: palette.text,
    fontSize: 34,
    fontFamily: FONT.serif,
    fontWeight: "700",
    paddingHorizontal: 20,
    letterSpacing: -0.5,
  },
  h2: { color: palette.textDim, fontSize: 14, paddingHorizontal: 20, marginTop: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.bgCard,
    marginHorizontal: 20,
    marginTop: 18,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  search: { flex: 1, color: palette.text, fontSize: 15 },
  filters: { paddingHorizontal: 20, gap: 8, marginTop: 14 },
  section: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  catsGrid: {
    paddingHorizontal: 14,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  catCard: {
    width: (SCREEN_W - 28) / 2,
    padding: 6,
  },
  catIcon: {
    height: 96,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  catName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    marginLeft: 4,
  },
  activeCatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 20,
  },
  resItem: { flex: 1, margin: 6 },
  resCover: { width: "100%", aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: palette.bgCard },
  resRating: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  resRatingText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  resBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  resBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  resTitle: { color: palette.text, fontSize: 13, fontWeight: "600", marginTop: 8 },
  resAuthor: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  empty: { paddingTop: 40, alignItems: "center" },
  emptyText: { color: palette.textMuted, fontSize: 14 },
});
