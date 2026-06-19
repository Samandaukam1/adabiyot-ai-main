import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Book,
  BookOpen,
  Bookmark,
  ChevronRight,
  Clapperboard,
  Clock,
  Feather,
  GraduationCap,
  Lightbulb,
  Lock,
  Newspaper,
  RefreshCw,
  Scroll,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import TokchaBannerCarousel from "@/components/TokchaBannerCarousel";
import { articles, books, Category, getAuthor, getBook, getBookRoute, type Article } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { type DisplayBook } from "@/types/database";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 44) / 2;
const CAT_CARD_W = (SCREEN_W - 56) / 3;
const GENRE_ACCENT = "#2E7D32";
const GENRE_SOFT = "#E8F5E9";

interface BookCardData {
  id: string;
  title: string;
  authorName: string;
  cover: string;
  rating: number;
  price: number;
  free: boolean;
  trending: boolean;
  audioAvailable: boolean;
  category: string;
}

function mockBookToCard(b: ReturnType<typeof getBook>): BookCardData | null {
  if (!b) return null;
  const a = getAuthor(b.authorId);
  return {
    id: b.id,
    title: b.title,
    authorName: a?.name ?? "",
    cover: b.cover,
    rating: b.rating,
    price: b.price,
    free: b.free,
    trending: b.trending ?? false,
    audioAvailable: b.audioAvailable,
    category: b.category,
  };
}

function supabaseBookToCard(b: DisplayBook): BookCardData {
  return {
    id: b.id,
    title: b.title,
    authorName: b.authorName,
    cover: b.cover,
    rating: 0,
    price: b.price,
    free: b.isFree,
    trending: false,
    audioAvailable: !!b.audioUrl,
    category: b.genre,
  };
}

const ICONS: Record<string, React.ComponentType<{ color: string; size: number; strokeWidth?: number }>> = {
  BookOpen,
  Book,
  Feather,
  Lightbulb,
  GraduationCap,
  Sparkles,
  Clapperboard,
  Scroll,
  Newspaper,
};

type TokchaGenre = Category | "Maqola";

const TOKCHA_GENRES: { name: TokchaGenre; icon: string }[] = [
  { name: "Hikoya", icon: "BookOpen" },
  { name: "Roman", icon: "Book" },
  { name: "She'r", icon: "Feather" },
  { name: "Ssenariy", icon: "Clapperboard" },
  { name: "Qissa", icon: "Scroll" },
  { name: "Maqola", icon: "Newspaper" },
  { name: "Qo'llanma", icon: "Lightbulb" },
  { name: "Darslik", icon: "GraduationCap" },
  { name: "Ertak", icon: "Sparkles" },
];

type ShelfTab = "Hammasi" | "Saqlangan" | "Sotib olingan" | "Tarix";
const SHELF_TABS: ShelfTab[] = ["Hammasi", "Saqlangan", "Sotib olingan", "Tarix"];

type Filter = "Bepul" | "Pullik" | "Audio" | "Trend" | "Yangi";
const FILTERS: Filter[] = ["Bepul", "Pullik", "Audio", "Trend", "Yangi"];

export default function TokchaScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState<string>("");
  const [cat, setCat] = useState<TokchaGenre | null>(null);
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [shelfTab, setShelfTab] = useState<ShelfTab>("Hammasi");
  const [mode, setMode] = useState<"discover" | "shelf">("discover");

  const { purchasedArticleIds, purchasedBookIds, savedBookIds, history } = useApp();
  const { books: supabaseBooks, loading: supabaseLoading, error: supabaseError, refetch } = usePublishedBooks();

  const handleTokchaBannerCategory = useCallback((categoryName: string) => {
    const normalized = categoryName.trim().toLowerCase();
    const target = TOKCHA_GENRES.find((genre) => genre.name.toLowerCase() === normalized);

    if (!target) return;

    setMode("discover");
    setQ("");
    setFilters(new Set());
    setCat(target.name);
  }, []);

  const allBookCards = useMemo<BookCardData[]>(() => {
    if (supabaseBooks.length > 0) {
      return supabaseBooks.map(supabaseBookToCard);
    }
    return books.map((b) => mockBookToCard(b)).filter((b): b is BookCardData => b !== null);
  }, [supabaseBooks]);

  const purchased = useMemo(() => books.filter((b) => purchasedBookIds.includes(b.id)), [purchasedBookIds]);
  const saved = useMemo(() => books.filter((b) => savedBookIds.includes(b.id)), [savedBookIds]);
  const historyBooks = useMemo(
    () => history.map((h) => ({ book: getBook(h.bookId), at: h.at })).filter((x) => x.book),
    [history]
  );

  const results = useMemo<BookCardData[]>(() => {
    if (mode === "shelf") {
      if (shelfTab === "Saqlangan") return saved.map((b) => mockBookToCard(b)).filter((b): b is BookCardData => b !== null);
      if (shelfTab === "Sotib olingan") return purchased.map((b) => mockBookToCard(b)).filter((b): b is BookCardData => b !== null);
      if (shelfTab === "Tarix") return historyBooks.map((x) => mockBookToCard(x.book!)).filter((b): b is BookCardData => b !== null);
      return allBookCards;
    }
    return allBookCards.filter((b) => {
      if (q && !b.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (cat === "Maqola") return false;
      if (cat && b.category !== cat) return false;
      if (filters.has("Bepul") && !b.free) return false;
      if (filters.has("Pullik") && b.free) return false;
      if (filters.has("Audio") && !b.audioAvailable) return false;
      if (filters.has("Trend") && !b.trending) return false;
      return true;
    });
  }, [q, cat, filters, mode, shelfTab, saved, purchased, historyBooks, allBookCards]);

  const articleResults = useMemo(() => {
    if (mode !== "discover" || cat !== "Maqola") return [];

    const normalizedQuery = q.trim().toLowerCase();
    return articles.filter((article) => {
      if (
        normalizedQuery &&
        !article.title.toLowerCase().includes(normalizedQuery) &&
        !article.description.toLowerCase().includes(normalizedQuery) &&
        !article.author.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      if (filters.has("Bepul") && article.price > 0) return false;
      if (filters.has("Pullik") && article.price === 0) return false;
      if (filters.has("Trend") && article.popularity < 85) return false;
      return true;
    });
  }, [q, cat, filters, mode]);

  const toggleFilter = (f: Filter) => {
    setFilters((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  };

  const isSearching = q.length > 0 || cat !== null || filters.size > 0;
  const showGenreGrid = q.length === 0 && filters.size === 0;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.h1}>Tokcha</Text>
          <View style={styles.headerTabs}>
            <Pressable
              onPress={() => setMode("discover")}
              style={[styles.headerTab, mode === "discover" && styles.headerTabActive]}
            >
              <Text style={[styles.headerTabText, mode === "discover" && styles.headerTabTextActive]}>
                Kashf et
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("shelf")}
              style={[styles.headerTab, mode === "shelf" && styles.headerTabActive]}
            >
              <Text style={[styles.headerTabText, mode === "shelf" && styles.headerTabTextActive]}>
                Tokcham
              </Text>
            </Pressable>
          </View>
        </View>

        <TokchaBannerCarousel onCategoryPress={handleTokchaBannerCategory} />

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Search color={palette.textMuted} size={18} />
          <TextInput
            style={styles.search}
            placeholder="Asar, maqola, ssenariy yoki muallif izlash..."
            placeholderTextColor={palette.textMuted}
            value={q}
            onChangeText={setQ}
          />
          {q ? (
            <Pressable onPress={() => setQ("")} hitSlop={10}>
              <X color={palette.textMuted} size={18} />
            </Pressable>
          ) : null}
        </View>

        {/* Mode: Discover */}
        {mode === "discover" && (
          <>
            {/* Categories grid */}
            {showGenreGrid && (
              <>
                <Text style={styles.section}>Janrlar</Text>
                <View style={styles.catsGrid}>
                  {TOKCHA_GENRES.map((c) => {
                    const Icon = ICONS[c.icon] ?? Book;
                    return (
                      <GenreCard
                        key={c.name}
                        title={c.name}
                        icon={<Icon color={GENRE_ACCENT} size={23} strokeWidth={2} />}
                        selected={cat === c.name}
                        onPress={() => {
                          setCat(c.name);
                        }}
                      />
                    );
                  })}
                </View>
              </>
            )}

            {/* Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => (
                <Pill key={f} label={f} active={filters.has(f)} onPress={() => toggleFilter(f)} />
              ))}
              {cat ? (
                <Pressable onPress={() => setCat(null)} style={styles.clearCat}>
                  <X color={palette.primary} size={12} />
                  <Text style={styles.clearCatText}>{cat}</Text>
                </Pressable>
              ) : null}
            </ScrollView>

            {/* Results section title */}
            {isSearching && (
              <View style={styles.resultHeader}>
                <Text style={styles.section}>
                  {cat ? cat : "Natijalar"} · {cat === "Maqola" ? articleResults.length : results.length}
                </Text>
              </View>
            )}

            {/* Books and articles grid */}
            {cat === "Maqola" ? (
              <View style={styles.articleList}>
                {articleResults.map((article) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    purchased={purchasedArticleIds.includes(article.id)}
                  />
                ))}
                {articleResults.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Maqola topilmadi</Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                {supabaseLoading && allBookCards.length === 0 ? (
                  <View style={styles.empty}>
                    <ActivityIndicator color={palette.primary} size="large" />
                    <Text style={[styles.emptyText, { marginTop: 12 }]}>Yuklanmoqda...</Text>
                  </View>
                ) : supabaseError && allBookCards.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Hozircha chop etilgan materiallar mavjud emas.</Text>
                    <Pressable
                      onPress={refetch}
                      style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <RefreshCw color={palette.primary} size={15} />
                      <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "600" }}>
                        Qayta urinish
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {(!isSearching || results.length > 0) && (
                      <>
                        {!isSearching && <Text style={styles.section}>Top adabiyotlar</Text>}
                        <View style={styles.grid}>
                          {results.map((b) => (
                            <PressableScale
                              key={b.id}
                              onPress={() => router.push(`/book/${b.id}`)}
                              style={styles.bookCard}
                            >
                              <View style={styles.coverWrap}>
                                <Image
                                  source={{ uri: b.cover }}
                                  style={styles.cover}
                                  contentFit="contain"
                                />
                                {b.free && (
                                  <View style={styles.freeBadge}>
                                    <Text style={styles.freeBadgeText}>BEPUL</Text>
                                  </View>
                                )}
                                {b.trending && (
                                  <View style={styles.trendBadge}>
                                    <Text style={styles.trendBadgeText}>TREND</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.cardInfo}>
                                <Text numberOfLines={2} style={styles.cardTitle}>{b.title}</Text>
                                <Text numberOfLines={1} style={styles.cardAuthor}>{b.authorName}</Text>
                                <View style={styles.cardMeta}>
                                  <Star color={palette.gold} size={11} fill={palette.gold} />
                                  <Text style={styles.cardRating}>{b.rating.toFixed(1)}</Text>
                                  {!b.free && (
                                    <Text style={styles.cardPrice}>{(b.price / 1000).toFixed(0)}k</Text>
                                  )}
                                </View>
                              </View>
                            </PressableScale>
                          ))}
                        </View>
                      </>
                    )}
                    {isSearching && results.length === 0 && (
                      <View style={styles.empty}>
                        <Text style={styles.emptyText}>Hozircha chop etilgan materiallar mavjud emas.</Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Mode: Shelf */}
        {mode === "shelf" && (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <StatCard
                icon={<ShoppingBag color={palette.primary} size={18} />}
                label="Sotib olingan"
                value={purchased.length}
              />
              <StatCard
                icon={<Bookmark color={palette.gold} size={18} />}
                label="Saqlangan"
                value={saved.length}
              />
              <StatCard
                icon={<Clock color={palette.secondary} size={18} />}
                label="Tarix"
                value={history.length}
              />
            </View>

            {/* Shelf tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {SHELF_TABS.map((t) => (
                <Pill key={t} label={t} active={shelfTab === t} onPress={() => setShelfTab(t)} />
              ))}
            </ScrollView>

            {/* Shelf content */}
            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              {results.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {shelfTab === "Saqlangan"
                      ? "Saqlangan kitoblar yo'q"
                      : shelfTab === "Sotib olingan"
                      ? "Sotib olingan kitoblar yo'q"
                      : shelfTab === "Tarix"
                      ? "O'qish tarixi bo'sh"
                      : "Kitoblar topilmadi"}
                  </Text>
                </View>
              ) : (
                results.map((b) => (
                  <BookRow
                    key={b.id}
                    bookId={b.id}
                    ts={
                      shelfTab === "Tarix"
                        ? historyBooks.find((h) => h.book?.id === b.id)?.at
                        : undefined
                    }
                  />
                ))
              )}
            </View>
          </>
        )}
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

function GenreCard({
  title,
  icon,
  selected,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={selected ? [styles.catCard, styles.catCardSelected] : styles.catCard}>
        <View style={[styles.catIcon, selected && styles.catIconSelected]}>{icon}</View>
        <Text numberOfLines={1} style={[styles.catName, selected && styles.catNameSelected]}>
          {title}
        </Text>
    </PressableScale>
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

function ArticleRow({
  article,
  purchased,
}: {
  article: Article;
  purchased: boolean;
}) {
  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/article/[id]", params: { id: article.id } })}
      style={styles.articleCard}
    >
      <Image source={{ uri: article.cover }} style={styles.articleImage} contentFit="cover" />
      <View style={styles.articleBody}>
        <View style={styles.articleTopRow}>
          <Text style={styles.articleCategory}>{article.category}</Text>
          <View style={styles.articleReadTime}>
            <Clock color={palette.textMuted} size={12} />
            <Text style={styles.articleReadTimeText}>{article.readingTime}</Text>
          </View>
        </View>
        <Text style={styles.articleTitle} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.articleDesc} numberOfLines={3}>
          {article.description}
        </Text>
        <View style={styles.articleFooter}>
          <View style={styles.articleAuthor}>
            <User color={palette.primary} size={13} />
            <Text style={styles.articleAuthorText} numberOfLines={1}>
              {article.author}
            </Text>
          </View>
          <View style={purchased ? styles.articleOwnedPill : styles.articlePricePill}>
            {purchased ? null : <Lock color={palette.primary} size={11} />}
            <Text style={purchased ? styles.articleOwnedText : styles.articlePriceText}>
              {purchased ? "Ochiq" : formatPrice(article.price)}
            </Text>
          </View>
        </View>
      </View>
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

function formatPrice(value: number): string {
  return `${value.toLocaleString()} so'm`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  h1: {
    color: palette.text,
    fontSize: 32,
    fontFamily: FONT.serif,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerTabs: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: palette.bgElevated,
    padding: 4,
    borderRadius: 10,
  },
  headerTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
  },
  headerTabActive: {
    backgroundColor: palette.primary,
  },
  headerTabText: {
    color: palette.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  headerTabTextActive: {
    color: "#fff",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.bgCard,
    borderRadius: 14,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  search: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  clearCat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(46,125,50,0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(102,187,106,0.32)",
  },
  clearCatText: { color: palette.primary, fontSize: 13, fontWeight: "600" },
  section: {
    color: palette.text,
    fontSize: 18,
    fontFamily: FONT.serif,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 18,
  },
  catCard: {
    width: CAT_CARD_W,
    height: 105,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  catCardSelected: {
    backgroundColor: "rgba(232,245,233,0.92)",
    shadowOpacity: 0.035,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GENRE_SOFT,
    marginBottom: 7,
  },
  catIconSelected: {
    backgroundColor: "#D7EED9",
  },
  catName: {
    maxWidth: "100%",
    color: "#111111",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  catNameSelected: {
    color: GENRE_ACCENT,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 20,
  },
  bookCard: {
    width: CARD_W,
    backgroundColor: palette.bgCard,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  coverWrap: {
    width: "100%",
    aspectRatio: 2 / 3,
    backgroundColor: palette.bgElevated,
    overflow: "hidden",
  },
  cover: { width: "100%", height: "100%" },
  freeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  freeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  trendBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: palette.soft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  trendBadgeText: { color: palette.primary, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  cardInfo: { padding: 10 },
  cardTitle: { color: palette.text, fontSize: 13, fontWeight: "700", marginBottom: 3 },
  cardAuthor: { color: palette.textDim, fontSize: 11, marginBottom: 6 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardRating: { color: palette.gold, fontSize: 11, fontWeight: "600", flex: 1 },
  cardPrice: { color: palette.secondary, fontSize: 11, fontWeight: "600" },
  articleList: {
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 22,
  },
  articleCard: {
    minHeight: 166,
    borderRadius: 16,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  articleImage: {
    width: 116,
    minHeight: 166,
    backgroundColor: palette.bgElevated,
  },
  articleBody: {
    flex: 1,
    padding: 13,
  },
  articleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  articleCategory: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  articleReadTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  articleReadTimeText: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  articleTitle: {
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 8,
  },
  articleDesc: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 6,
  },
  articleFooter: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  articleAuthor: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  articleAuthorText: {
    flex: 1,
    color: palette.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  articlePricePill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  articlePriceText: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  articleOwnedPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  articleOwnedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  statsRow: { flexDirection: "row", paddingHorizontal: 14, gap: 8, marginBottom: 18 },
  stat: {
    flex: 1,
    backgroundColor: palette.bgCard,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statIcon: { marginBottom: 8 },
  statValue: { color: palette.text, fontSize: 20, fontWeight: "700" },
  statLabel: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.bgCard,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bookRowCover: { width: 52, height: 74, borderRadius: 8, backgroundColor: palette.bgElevated },
  bookRowTitle: { color: palette.text, fontSize: 15, fontWeight: "700" },
  bookRowAuthor: { color: palette.textDim, fontSize: 12, marginTop: 2 },
  bookRowCat: { color: palette.secondary, fontSize: 11, marginTop: 4, fontWeight: "600" },
  bookRowTs: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  empty: { paddingVertical: 60, alignItems: "center" },
  emptyText: { color: palette.textMuted, fontSize: 14 },
});
