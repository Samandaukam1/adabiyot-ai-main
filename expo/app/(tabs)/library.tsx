import { Image } from "expo-image";
import { router } from "expo-router";
import { Bookmark, ChevronRight, Clock, Film, ShoppingBag } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import BookCover from "@/components/BookCover";
import { FONT, Pill, PressableScale, Screen } from "@/components/ui";
import { books, getAuthor, getBook, getBookRoute } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useSavedReels } from "@/hooks/useReels";
import { useOwnedContentSet } from "@/hooks/usePayments";
import { useTheme } from "@/providers/ThemeProvider";

type Tab = "Sotib olingan" | "Saqlangan" | "Reels" | "Tarix";
const TABS: Tab[] = ["Sotib olingan", "Saqlangan", "Reels", "Tarix"];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("Sotib olingan");
  const { savedBookIds, history } = useApp();
  const { userId } = useAuth();
  const { reels: savedReels, loading: savedReelsLoading } = useSavedReels(userId);
  const ownedSet = useOwnedContentSet();
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);

  const purchased = useMemo(() => books.filter((b) => ownedSet.has(`book:${b.id}`)), [ownedSet]);
  const saved = useMemo(() => books.filter((b) => savedBookIds.includes(b.id)), [savedBookIds]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 }}
      >
        <Text style={styles.h1}>Kutubxona</Text>
        <Text style={styles.h2}>Sizning shaxsiy to'plamingiz</Text>

        <View style={styles.statsRow}>
          <StatCard c={c} icon={<ShoppingBag color={c.primary} size={18} />} label="Sotib olingan" value={purchased.length} />
          <StatCard c={c} icon={<Bookmark color={c.gold} size={18} />} label="Saqlangan" value={saved.length + savedReels.length} />
          <StatCard c={c} icon={<Clock color={c.secondary} size={18} />} label="Tarix" value={history.length} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <Pill key={t} label={t} active={tab === t} onPress={() => setTab(t)} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          {tab === "Sotib olingan" &&
            (purchased.length === 0 ? (
              <EmptyState c={c} text="Siz hali kitob sotib olmagansiz" />
            ) : (
              purchased.map((b) => <BookRow key={b.id} bookId={b.id} c={c} />)
            ))}
          {tab === "Saqlangan" &&
            (saved.length === 0 ? (
              <EmptyState c={c} text="Saqlangan kitoblar yo'q" />
            ) : (
              saved.map((b) => <BookRow key={b.id} bookId={b.id} c={c} />)
            ))}
          {tab === "Reels" &&
            (savedReelsLoading ? (
              <ActivityIndicator color={c.primary} style={{ paddingVertical: 34 }} />
            ) : savedReels.length === 0 ? (
              <EmptyState c={c} text="Saqlangan reels-lar yo'q" />
            ) : (
              <View style={styles.reelsGrid}>
                {savedReels.map((r) => (
                  <PressableScale
                    key={r.id}
                    onPress={() => router.push({ pathname: "/(tabs)/reels", params: { reelId: r.id } })}
                    style={styles.reelCard}
                  >
                    {r.thumbnailUrl ? (
                      <Image source={{ uri: r.thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    ) : null}
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
              <EmptyState c={c} text="O'qish tarixi bo'sh" />
            ) : (
              history.map((h) => <BookRow key={h.bookId} bookId={h.bookId} ts={h.at} c={c} />)
            ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ icon, label, value, c }: { icon: React.ReactNode; label: string; value: number; c: AppTheme }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.bgCard, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border }}>
      <View style={{ marginBottom: 10 }}>{icon}</View>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function EmptyState({ text, c }: { text: string; c: AppTheme }) {
  return (
    <View style={{ paddingVertical: 60, alignItems: "center" }}>
      <Text style={{ color: c.textMuted, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function BookRow({ bookId, ts, c }: { bookId: string; ts?: number; c: AppTheme }) {
  const book = getBook(bookId);
  if (!book) return null;
  const author = getAuthor(book.authorId);
  return (
    <PressableScale onPress={() => router.push(getBookRoute(book))} style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.bgCard, padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border }}>
      <BookCover uri={book.cover} width={56} radius={8} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>{book.title}</Text>
        <Text style={{ color: c.textDim, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{author?.name}</Text>
        <Text style={{ color: c.secondary, fontSize: 11, marginTop: 4, fontWeight: "600" }}>{book.category}</Text>
        {ts ? <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>{relativeTime(ts)}</Text> : null}
      </View>
      <ChevronRight color={c.textMuted} size={18} />
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

function createStyles(c: AppTheme) {
  return StyleSheet.create({
    h1: {
      color: c.text,
      fontSize: 34,
      fontFamily: FONT.serif,
      fontWeight: "700",
      paddingHorizontal: 20,
      letterSpacing: -0.5,
    },
    h2: { color: c.textDim, fontSize: 14, paddingHorizontal: 20, marginTop: 4 },
    statsRow: { flexDirection: "row", paddingHorizontal: 14, marginTop: 22, gap: 8 },
    tabs: { paddingHorizontal: 20, gap: 8, marginTop: 22 },
    reelsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    reelCard: {
      width: "48%",
      aspectRatio: 9 / 14,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: c.bgCard,
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
}
