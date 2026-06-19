import { Image } from "expo-image";
import { router } from "expo-router";
import { Bookmark, ChevronRight, Clock, Film, ShoppingBag } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, Pill, PressableScale, Screen } from "@/components/ui";
import { books, getAuthor, getBook, getBookRoute, reels } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

type Tab = "Sotib olingan" | "Saqlangan" | "Reels" | "Tarix";
const TABS: Tab[] = ["Sotib olingan", "Saqlangan", "Reels", "Tarix"];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("Sotib olingan");
  const { purchasedBookIds, savedBookIds, savedReelIds, history } = useApp();

  const purchased = useMemo(() => books.filter((b) => purchasedBookIds.includes(b.id)), [purchasedBookIds]);
  const saved = useMemo(() => books.filter((b) => savedBookIds.includes(b.id)), [savedBookIds]);
  const savedReels = useMemo(() => reels.filter((r) => savedReelIds.includes(r.id)), [savedReelIds]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 }}
      >
        <Text style={styles.h1}>Kutubxona</Text>
        <Text style={styles.h2}>Sizning shaxsiy to'plamingiz</Text>

        <View style={styles.statsRow}>
          <StatCard icon={<ShoppingBag color={palette.primary} size={18} />} label="Sotib olingan" value={purchased.length} />
          <StatCard icon={<Bookmark color={palette.gold} size={18} />} label="Saqlangan" value={saved.length + savedReels.length} />
          <StatCard icon={<Clock color={palette.secondary} size={18} />} label="Tarix" value={history.length} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <Pill key={t} label={t} active={tab === t} onPress={() => setTab(t)} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          {tab === "Sotib olingan" &&
            (purchased.length === 0 ? (
              <EmptyState text="Siz hali kitob sotib olmagansiz" />
            ) : (
              purchased.map((b) => <BookRow key={b.id} bookId={b.id} />)
            ))}
          {tab === "Saqlangan" &&
            (saved.length === 0 ? (
              <EmptyState text="Saqlangan kitoblar yo'q" />
            ) : (
              saved.map((b) => <BookRow key={b.id} bookId={b.id} />)
            ))}
          {tab === "Reels" &&
            (savedReels.length === 0 ? (
              <EmptyState text="Saqlangan reels-lar yo'q" />
            ) : (
              <View style={styles.reelsGrid}>
                {savedReels.map((r) => (
                  <PressableScale
                    key={r.id}
                    onPress={() => router.push("/(tabs)/reels")}
                    style={styles.reelCard}
                  >
                    <Image source={{ uri: r.poster }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    <View style={styles.reelBadge}>
                      <Film color="#fff" size={12} />
                    </View>
                    <Text style={styles.reelCardTitle} numberOfLines={2}>{r.title}</Text>
                  </PressableScale>
                ))}
              </View>
            ))}
          {tab === "Tarix" &&
            (history.length === 0 ? (
              <EmptyState text="O'qish tarixi bo'sh" />
            ) : (
              history.map((h) => <BookRow key={h.bookId} bookId={h.bookId} ts={h.at} />)
            ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ paddingVertical: 60, alignItems: "center" }}>
      <Text style={{ color: palette.textMuted, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function BookRow({ bookId, ts }: { bookId: string; ts?: number }) {
  const book = getBook(bookId);
  if (!book) return null;
  const author = getAuthor(book.authorId);
  return (
    <PressableScale onPress={() => router.push(getBookRoute(book))} style={styles.bookRow}>
      <Image source={{ uri: book.cover }} style={styles.bookRowCover} contentFit="contain" />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.bookRowTitle} numberOfLines={1}>{book.title}</Text>
        <Text style={styles.bookRowAuthor} numberOfLines={1}>{author?.name}</Text>
        <Text style={styles.bookRowCat}>{book.category}</Text>
        {ts ? <Text style={styles.bookRowTs}>{relativeTime(ts)}</Text> : null}
      </View>
      <ChevronRight color={palette.textMuted} size={18} />
    </PressableScale>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) return "hozirgina";
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  return `${d} kun oldin`;
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
  statsRow: { flexDirection: "row", paddingHorizontal: 14, marginTop: 22, gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: palette.bgCard,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statIcon: { marginBottom: 10 },
  statValue: { color: palette.text, fontSize: 22, fontWeight: "700" },
  statLabel: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  tabs: { paddingHorizontal: 20, gap: 8, marginTop: 22 },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.bgCard,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  bookRowCover: { width: 56, height: 80, borderRadius: 8, backgroundColor: palette.bg },
  bookRowTitle: { color: palette.text, fontSize: 15, fontWeight: "700" },
  bookRowAuthor: { color: palette.textDim, fontSize: 12, marginTop: 2 },
  bookRowCat: { color: palette.secondary, fontSize: 11, marginTop: 4, fontWeight: "600" },
  bookRowTs: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  reelsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reelCard: {
    width: "48%",
    aspectRatio: 9 / 14,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: palette.bgCard,
  },
  reelBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  reelCardTitle: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
