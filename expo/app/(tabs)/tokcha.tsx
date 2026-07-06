import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  BookOpen,
  Bookmark,
  ChevronRight,
  Clock,
  Film,
  Lock,
  RefreshCw,
  Search,
  ShoppingBag,
  Star,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, Pill, PressableScale, Screen } from "@/components/ui";
import {
  FadeSlideIn,
  ScreenTransitionWrapper,
  StaggeredCard,
  TypingText,
} from "@/components/animations";
import { PullRefreshIndicator } from "@/components/PullRefreshIndicator";
import BookCover from "@/components/BookCover";
import ExploreShortcutButtons from "@/components/ExploreShortcutButtons";
import TokchaBannerCarousel from "@/components/TokchaBannerCarousel";
import { books, Category, getAuthor, getBook, getBookRoute } from "@/mocks/content";
import { useAuth } from "@/providers/AuthProvider";
import { useContentAccessChecker } from "@/hooks/usePayments";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { usePublishedArticles } from "@/hooks/useArticleContent";
import { usePurchasedContent } from "@/hooks/usePurchasedContent";
import { useSavedReels } from "@/hooks/useReels";
import { useShelf, type ShelfItem } from "@/hooks/useShelf";
import { useTheme } from "@/providers/ThemeProvider";
import { useResponsive } from "@/hooks/useResponsive";
import WebTokcha from "@/components/web/WebTokcha";
import type { AppTheme } from "@/constants/colors";
import { type DisplayBook } from "@/types/database";
import type { PublicReel } from "@/lib/reels";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 44) / 2;
const CAT_CARD_W = (SCREEN_W - 56) / 3;

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

type TokchaGenre = Category | "Maqola";

const GENRE_CONFIGS: {
  name: TokchaGenre;
  icon: string;
  gradient: [string, string];
}[] = [
  { name: "Hikoya", icon: "book-open-variant",        gradient: ["#FF9A3C", "#F4511E"] },
  { name: "Roman",  icon: "book-open-page-variant",   gradient: ["#667EEA", "#764BA2"] },
  { name: "She'r",  icon: "feather",                  gradient: ["#F093FB", "#F5576C"] },
  { name: "Ssenariy", icon: "movie-open-outline",     gradient: ["#2C3E50", "#4CA1AF"] },
  { name: "Qissa",  icon: "script-text-outline",      gradient: ["#F7971E", "#FFD200"] },
  { name: "Maqola", icon: "newspaper-variant-outline",gradient: ["#1A78C2", "#56CCF2"] },
  { name: "Qo'llanma", icon: "lightbulb-on-outline",  gradient: ["#11998E", "#38EF7D"] },
  { name: "Darslik", icon: "school-outline",           gradient: ["#00B09B", "#96C93D"] },
  { name: "Ertak",  icon: "auto-fix",                 gradient: ["#A855F7", "#7C3AED"] },
];

type ShelfTab = "Hammasi" | "Saqlangan" | "Sotib olingan" | "Tarix";
const SHELF_TABS: ShelfTab[] = ["Hammasi", "Saqlangan", "Sotib olingan", "Tarix"];

type Filter = "Bepul" | "Pullik" | "Audio" | "Trend" | "Yangi";
const FILTERS: Filter[] = ["Bepul", "Pullik", "Audio", "Trend", "Yangi"];

export default function TokchaScreen() {
  const { isWebLayout } = useResponsive();
  return isWebLayout ? <WebTokcha /> : <MobileTokchaScreen />;
}

function MobileTokchaScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const [q, setQ] = useState<string>("");
  const [cat, setCat] = useState<TokchaGenre | null>(null);
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [shelfTab, setShelfTab] = useState<ShelfTab>("Hammasi");
  const [mode, setMode] = useState<"discover" | "shelf">("discover");
  const [searchFocused, setSearchFocused] = useState(false);

  const { userId } = useAuth();
  const hasAccess = useContentAccessChecker();
  const { reading, planned, refresh: refreshShelf } = useShelf();
  const { items: purchasedItems, loading: purchasedLoading } = usePurchasedContent();
  const { books: supabaseBooks, loading: supabaseLoading, error: supabaseError, refetch } = usePublishedBooks();
  const { articles: realArticles, refetch: refetchArticles } = usePublishedArticles();
  const { reels: savedReels, loading: savedReelsLoading, refresh: refreshSavedReels } = useSavedReels(userId);
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchArticles(), refreshShelf(), refreshSavedReels()]);
  }, [refetch, refetchArticles, refreshSavedReels, refreshShelf]);
  const { refreshing, replayKey, onRefresh } = usePullToRefresh(handleRefresh);

  const handleTokchaBannerCategory = useCallback((categoryName: string) => {
    const normalized = categoryName.trim().toLowerCase();
    const target = GENRE_CONFIGS.find((genre) => genre.name.toLowerCase() === normalized);
    if (!target) return;
    if (target.name === "Ssenariy") {
      router.push("/screenplays");
      return;
    }
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

  const results = useMemo<BookCardData[]>(() => {
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
  }, [q, cat, filters, allBookCards]);

  const articleResults = useMemo(() => {
    if (mode !== "discover" || cat !== "Maqola") return [];
    const normalizedQuery = q.trim().toLowerCase();
    return realArticles.filter((article) => {
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
  }, [q, cat, filters, mode, realArticles]);

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
      <ScreenTransitionWrapper type="up" replayKey={replayKey}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
            colors={[c.primary]}
            progressBackgroundColor={c.bgCard}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* Header */}
        <FadeSlideIn delay={40} distance={-14} style={styles.header}>
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
        </FadeSlideIn>

        <FadeSlideIn delay={130} distance={18}>
          <TokchaBannerCarousel onCategoryPress={handleTokchaBannerCategory} />
        </FadeSlideIn>

        {/* Search bar */}
        <FadeSlideIn delay={220} distance={14} style={styles.searchWrap}>
          <Search color={c.textMuted} size={18} />
          <View style={styles.searchTextLayer}>
            {!q && !searchFocused ? (
              <TypingText
                phrases={[
                  "Istalgan narsangizni qidiring",
                  "Asar, maqola, ssenariy yoki muallif izlash…",
                ]}
                active={!searchFocused}
                style={styles.typingPlaceholder}
              />
            ) : null}
            <TextInput
              style={styles.search}
              placeholder=""
              placeholderTextColor={c.textMuted}
              value={q}
              onChangeText={setQ}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>
          {q ? (
            <Pressable onPress={() => setQ("")} hitSlop={10}>
              <X color={c.textMuted} size={18} />
            </Pressable>
          ) : null}
        </FadeSlideIn>

        {/* Adiblar ensiklopediyasi + Top ro'yxatlar shortcuts */}
        <FadeSlideIn delay={280} distance={12}>
          <ExploreShortcutButtons />
        </FadeSlideIn>

        {/* Mode: Discover */}
        {mode === "discover" && (
          <>
            {/* Categories grid */}
            {showGenreGrid && (
              <>
                <Text style={styles.section}>Janrlar</Text>
                <View style={styles.catsGrid}>
                  {GENRE_CONFIGS.map((genre, index) => (
                    <StaggeredCard key={genre.name} index={index} baseDelay={70}>
                      <GenreCard
                        title={genre.name}
                        icon={genre.icon}
                        gradient={genre.gradient}
                        selected={cat === genre.name}
                        onPress={() => {
                          if (genre.name === "Ssenariy") {
                            router.push("/screenplays");
                            return;
                          }
                          setCat(genre.name);
                        }}
                      />
                    </StaggeredCard>
                  ))}
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
                  <X color={c.primary} size={12} />
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
                {articleResults.map((article, index) => (
                  <StaggeredCard key={article.id} index={index}>
                    <ArticleRow
                      article={article}
                      purchased={hasAccess("article", article.id)}
                    />
                  </StaggeredCard>
                ))}
                {articleResults.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                      {q.length > 0 || filters.size > 0 ? "Maqola topilmadi" : "Hali maqolalar mavjud emas"}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                {supabaseLoading && allBookCards.length === 0 ? (
                  <View style={styles.empty}>
                    <ActivityIndicator color={c.primary} size="large" />
                    <Text style={[styles.emptyText, { marginTop: 12 }]}>Yuklanmoqda...</Text>
                  </View>
                ) : supabaseError && allBookCards.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Hozircha chop etilgan materiallar mavjud emas.</Text>
                    <Pressable
                      onPress={refetch}
                      style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <RefreshCw color={c.primary} size={15} />
                      <Text style={{ color: c.primary, fontSize: 13, fontWeight: "600" }}>
                        Qayta urinish
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {(!isSearching || results.length > 0) && (
                      <>
                        {!isSearching && <Text style={styles.section}>Top adabiyotlar</Text>}
                        {isSearching ? (
                          <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 4 }}>
                            {results.map((b, index) => (
                              <StaggeredCard key={b.id} index={index}>
                                <PressableScale
                                  onPress={() => router.push(`/book/${b.id}`)}
                                  style={{
                                    flexDirection: "row",
                                    gap: 12,
                                    alignItems: "center",
                                    backgroundColor: c.bgCard,
                                    borderRadius: 16,
                                    padding: 10,
                                    borderWidth: StyleSheet.hairlineWidth,
                                    borderColor: c.border,
                                  }}
                                >
                                  <BookCover uri={b.cover} width={52} radius={8} />
                                  <View style={{ flex: 1 }}>
                                    <Text numberOfLines={2} style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>
                                      {b.title}
                                    </Text>
                                    <Text numberOfLines={1} style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>
                                      {b.authorName}
                                    </Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 3,
                                          backgroundColor: c.bgElevated,
                                          paddingHorizontal: 8,
                                          paddingVertical: 3,
                                          borderRadius: 8,
                                        }}
                                      >
                                        <Text style={{ color: c.text, fontSize: 12, fontWeight: "700" }}>
                                          {b.rating.toFixed(1)}
                                        </Text>
                                        <Star color={c.gold} size={11} fill={c.gold} />
                                      </View>
                                      {b.free ? (
                                        <View
                                          style={{
                                            backgroundColor: "rgba(82,183,136,0.14)",
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                            borderRadius: 8,
                                          }}
                                        >
                                          <Text style={{ color: c.primary, fontSize: 11, fontWeight: "800" }}>BEPUL</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  </View>
                                </PressableScale>
                              </StaggeredCard>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.grid}>
                            {results.map((b, index) => (
                              <StaggeredCard key={b.id} index={index}>
                                <PressableScale
                                  onPress={() => router.push(`/book/${b.id}`)}
                                  style={{ width: CARD_W }}
                                >
                                  <BookCover uri={b.cover} width={CARD_W} radius={12}>
                                    {b.free && (
                                      <View style={[styles.freeBadge, { left: 8 + 12 }]}>
                                        <Text style={styles.freeBadgeText}>BEPUL</Text>
                                      </View>
                                    )}
                                    {b.trending && (
                                      <View style={styles.trendBadge}>
                                        <Text style={styles.trendBadgeText}>TREND</Text>
                                      </View>
                                    )}
                                  </BookCover>
                                  <View style={[styles.cardInfo, { padding: 0, paddingTop: 8 }]}>
                                    <Text numberOfLines={2} style={styles.cardTitle}>{b.title}</Text>
                                    <Text numberOfLines={1} style={styles.cardAuthor}>{b.authorName}</Text>
                                    <View style={styles.cardMeta}>
                                      <Star color={c.gold} size={11} fill={c.gold} />
                                      <Text style={styles.cardRating}>{b.rating.toFixed(1)}</Text>
                                      {!b.free && (
                                        <Text style={styles.cardPrice}>{(b.price / 1000).toFixed(0)}k</Text>
                                      )}
                                    </View>
                                  </View>
                                </PressableScale>
                              </StaggeredCard>
                            ))}
                          </View>
                        )}
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

        {/* Mode: Shelf (Tokcham) */}
        {mode === "shelf" && (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <StatCard
                icon={<ShoppingBag color={c.primary} size={18} />}
                label="Sotib olingan"
                value={purchasedItems.length}
                c={c}
              />
              <StatCard
                icon={<BookOpen color={c.secondary} size={18} />}
                label="O'qilayotgan"
                value={reading.length}
                c={c}
              />
              <StatCard
                icon={<Clock color={c.gold} size={18} />}
                label="Rejada"
                value={planned.length}
                c={c}
              />
            </View>

            <ShelfSection
              title="Sotib olinganlar"
              items={purchasedItems}
              loading={purchasedLoading}
              emptyText="Hali adabiyot sotib olinmagan. Sotib olgan asarlaringiz shu yerda jamlanadi."
              c={c}
              styles={styles}
            />
            <ShelfSection
              title="O'qilayotganlar"
              items={reading}
              emptyText="O'qishni boshlagan asarlaringiz shu yerda ko'rinadi."
              c={c}
              styles={styles}
            />
            <ShelfSection
              title="Rejalashtirilganlar"
              items={planned}
              emptyText="«Tez orada o'qiyman» bosilgan asarlar shu yerda to'planadi."
              c={c}
              styles={styles}
            />
            <SavedReelsSection
              title="Reels"
              reels={savedReels}
              loading={savedReelsLoading}
              c={c}
              styles={styles}
            />
          </>
        )}
      </ScrollView>
      <PullRefreshIndicator
        refreshing={refreshing}
        color={c.primary}
        top={insets.top + 8}
        surfaceColor={c.bgCard}
        borderColor={c.border}
      />
      </ScreenTransitionWrapper>
    </Screen>
  );
}

function StatCard({ icon, label, value, c }: { icon: React.ReactNode; label: string; value: number; c: AppTheme }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.bgCard, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
      <View style={{ marginBottom: 8 }}>{icon}</View>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const SHELF_TYPE_LABEL: Record<ShelfItem["contentType"], string> = {
  book: "Kitob",
  poem: "She'r",
  article: "Maqola",
  scenario: "Ssenariy",
};

function goToShelfItem(item: ShelfItem) {
  switch (item.contentType) {
    case "poem":
      router.push(`/poem/${item.contentId}`);
      break;
    case "article":
      router.push({ pathname: "/article/[id]", params: { id: item.contentId } });
      break;
    case "scenario":
      router.push(`/screenplay/${item.contentId}`);
      break;
    default:
      router.push(`/book/${item.contentId}`);
  }
}

function ShelfRow({
  item,
  c,
  styles,
}: {
  item: ShelfItem;
  c: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const progress = typeof item.progress === "number" ? Math.min(100, Math.round(item.progress * 100)) : 0;
  return (
    <PressableScale onPress={() => goToShelfItem(item)} style={styles.shelfRow}>
      <BookCover uri={item.cover} width={52} radius={8} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.shelfTitle} numberOfLines={1}>{item.title || "Nomsiz asar"}</Text>
        {item.author ? (
          <Text style={styles.shelfAuthor} numberOfLines={1}>{item.author}</Text>
        ) : null}
        <View style={styles.shelfBadge}>
          <Text style={styles.shelfBadgeText}>{SHELF_TYPE_LABEL[item.contentType]}</Text>
        </View>
        {progress > 0 ? (
          <View style={styles.shelfProgressTrack}>
            <View style={[styles.shelfProgressFill, { width: `${progress}%` }]} />
          </View>
        ) : null}
      </View>
      <ChevronRight color={c.textMuted} size={18} />
    </PressableScale>
  );
}

function ShelfSection({
  title,
  items,
  loading,
  emptyText,
  c,
  styles,
}: {
  title: string;
  items: ShelfItem[];
  loading?: boolean;
  emptyText: string;
  c: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.shelfSectionHeader}>
        <Text style={styles.shelfSectionTitle}>{title}</Text>
        {items.length > 0 ? <Text style={styles.shelfSectionCount}>{items.length}</Text> : null}
      </View>
      {loading && items.length === 0 ? (
        <View style={styles.shelfEmpty}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.shelfEmpty}>
          <Text style={styles.shelfEmptyText}>{emptyText}</Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {items.map((item, index) => (
            <StaggeredCard key={`${item.contentType}:${item.contentId}`} index={index}>
              <ShelfRow item={item} c={c} styles={styles} />
            </StaggeredCard>
          ))}
        </View>
      )}
    </View>
  );
}

function SavedReelsSection({
  title,
  reels,
  loading,
  c,
  styles,
}: {
  title: string;
  reels: PublicReel[];
  loading?: boolean;
  c: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.shelfSectionHeader}>
        <Text style={styles.shelfSectionTitle}>{title}</Text>
        {reels.length > 0 ? <Text style={styles.shelfSectionCount}>{reels.length}</Text> : null}
      </View>
      {loading && reels.length === 0 ? (
        <View style={styles.shelfEmpty}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.shelfEmpty}>
          <Text style={styles.shelfEmptyText}>Saqlangan reelslaringiz shu yerda ko'rinadi.</Text>
        </View>
      ) : (
        <View style={styles.savedReelsGrid}>
          {reels.map((reel, index) => (
            <StaggeredCard key={reel.id} index={index}>
              <PressableScale
                onPress={() => router.push({ pathname: "/(tabs)/reels", params: { reelId: reel.id } })}
                style={styles.savedReelCard}
              >
                {reel.thumbnailUrl ? (
                  <Image source={{ uri: reel.thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <View style={styles.savedReelFallback}>
                    <Film color={c.primary} size={24} />
                  </View>
                )}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.78)"]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.savedReelBadge}>
                  <Film color="#fff" size={12} />
                </View>
                <View style={styles.savedReelInfo}>
                  <Text style={styles.savedReelTitle} numberOfLines={2}>{reel.title}</Text>
                  {reel.creatorName ? (
                    <Text style={styles.savedReelCreator} numberOfLines={1}>{reel.creatorName}</Text>
                  ) : null}
                </View>
              </PressableScale>
            </StaggeredCard>
          ))}
        </View>
      )}
    </View>
  );
}

function GenreCard({
  title,
  icon,
  gradient,
  selected,
  onPress,
}: {
  title: string;
  icon: string;
  gradient: [string, string];
  selected: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={{
        width: CAT_CARD_W,
        height: 108,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        paddingVertical: 14,
        backgroundColor: c.bgCard,
        borderRadius: 20,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? gradient[0] : c.border,
        shadowColor: selected ? gradient[0] : "#000",
        shadowOpacity: selected ? 0.22 : 0.05,
        shadowRadius: selected ? 12 : 8,
        shadowOffset: { width: 0, height: selected ? 6 : 3 },
        elevation: selected ? 6 : 2,
      }}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 9,
          opacity: selected ? 1 : 0.82,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={24} color="#fff" />
      </LinearGradient>
      <Text
        numberOfLines={1}
        style={{
          maxWidth: "100%",
          color: selected ? gradient[0] : c.text,
          fontSize: 13,
          fontWeight: selected ? "800" : "600",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </PressableScale>
  );
}

function BookRow({ bookId, ts }: { bookId: string; ts?: number }) {
  const { colors: c } = useTheme();
  const book = getBook(bookId);
  if (!book) return null;
  const author = getAuthor(book.authorId);
  return (
    <PressableScale
      onPress={() => router.push(getBookRoute(book))}
      style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.bgCard, padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
    >
      <BookCover uri={book.cover} width={52} radius={8} />
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

function ArticleRow({
  article,
  purchased,
}: {
  // Structural type so both the real DisplayArticle and legacy mock satisfy it.
  article: {
    id: string;
    cover: string;
    category: string;
    readingTime: string;
    title: string;
    description: string;
    author: string;
    price: number;
  };
  purchased: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/article/[id]", params: { id: article.id } })}
      style={{ minHeight: 166, borderRadius: 16, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}
    >
      <Image source={{ uri: article.cover }} style={{ width: 116, minHeight: 166, backgroundColor: c.bgElevated }} contentFit="cover" />
      <View style={{ flex: 1, padding: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: c.primary, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 }}>{article.category}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Clock color={c.textMuted} size={12} />
            <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: "800" }}>{article.readingTime}</Text>
          </View>
        </View>
        <Text style={{ color: c.text, fontFamily: FONT.serif, fontSize: 17, lineHeight: 21, fontWeight: "800", marginTop: 8 }} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={{ color: c.textDim, fontSize: 12, lineHeight: 18, fontWeight: "500", marginTop: 6 }} numberOfLines={3}>
          {article.description}
        </Text>
        <View style={{ marginTop: "auto" as any, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5 }}>
            <User color={c.primary} size={13} />
            <Text style={{ flex: 1, color: c.textDim, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>
              {article.author}
            </Text>
          </View>
          <View style={purchased ? { minHeight: 28, borderRadius: 999, paddingHorizontal: 10, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" } : { minHeight: 28, borderRadius: 999, paddingHorizontal: 9, backgroundColor: c.soft, borderWidth: 1, borderColor: c.borderStrong, flexDirection: "row", alignItems: "center", gap: 4 }}>
            {purchased ? null : <Lock color={c.primary} size={11} />}
            <Text style={{ color: purchased ? "#fff" : c.primary, fontSize: 10, fontWeight: "900" }}>
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

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    h1: {
      color: c.text,
      fontSize: 32,
      fontFamily: FONT.serif,
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    headerTabs: {
      flexDirection: "row",
      gap: 4,
      backgroundColor: c.bgElevated,
      padding: 4,
      borderRadius: 10,
    },
    headerTab: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 7,
    },
    headerTabActive: {
      backgroundColor: c.primary,
    },
    headerTabText: {
      color: c.textDim,
      fontSize: 13,
      fontWeight: "600",
    },
    headerTabTextActive: {
      color: "#fff",
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.bgCard,
      borderRadius: 14,
      marginHorizontal: 20,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    searchTextLayer: {
      flex: 1,
      minHeight: 22,
      justifyContent: "center",
    },
    typingPlaceholder: {
      position: "absolute",
      left: 0,
      right: 0,
      color: c.textMuted,
      fontSize: 14,
    },
    search: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      minHeight: 22,
      padding: 0,
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
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(46,125,50,0.12)",
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.28)" : "rgba(102,187,106,0.32)",
    },
    clearCatText: { color: c.primary, fontSize: 13, fontWeight: "600" },
    section: {
      color: c.text,
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
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 14,
      gap: 12,
      marginBottom: 20,
    },
    bookCard: {
      width: CARD_W,
      backgroundColor: c.bgCard,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    coverWrap: {
      width: "100%",
      aspectRatio: 2 / 3,
      backgroundColor: c.bgElevated,
      overflow: "hidden",
    },
    cover: { width: "100%", height: "100%" },
    freeBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: c.primary,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    freeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
    trendBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: c.soft,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    trendBadgeText: { color: c.primary, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
    cardInfo: { padding: 10 },
    cardTitle: { color: c.text, fontSize: 13, fontWeight: "700", marginBottom: 3 },
    cardAuthor: { color: c.textDim, fontSize: 11, marginBottom: 6 },
    cardMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
    cardRating: { color: c.gold, fontSize: 11, fontWeight: "600", flex: 1 },
    cardPrice: { color: c.secondary, fontSize: 11, fontWeight: "600" },
    articleList: { paddingHorizontal: 20, gap: 14, marginBottom: 22 },
    statsRow: { flexDirection: "row", paddingHorizontal: 14, gap: 8, marginBottom: 18 },
    empty: { paddingVertical: 60, alignItems: "center" },
    emptyText: { color: c.textMuted, fontSize: 14 },
    shelfSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    shelfSectionTitle: {
      color: c.text,
      fontSize: 17,
      fontFamily: FONT.serif,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    shelfSectionCount: {
      color: c.primary,
      fontSize: 12,
      fontWeight: "800",
      backgroundColor: isDark ? "rgba(82,183,136,0.14)" : "rgba(46,125,50,0.10)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: "hidden",
    },
    shelfRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.bgCard,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    shelfCover: { width: 52, height: 74, borderRadius: 8, backgroundColor: c.bgElevated },
    shelfCoverPlaceholder: { alignItems: "center", justifyContent: "center" },
    shelfTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
    shelfAuthor: { color: c.textDim, fontSize: 12, marginTop: 2 },
    shelfBadge: {
      alignSelf: "flex-start",
      marginTop: 6,
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(46,125,50,0.08)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    shelfBadgeText: { color: c.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
    shelfProgressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.bgElevated,
      marginTop: 8,
      overflow: "hidden",
    },
    shelfProgressFill: { height: 4, borderRadius: 2, backgroundColor: c.primary },
    shelfEmpty: {
      marginHorizontal: 20,
      paddingVertical: 26,
      paddingHorizontal: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.border,
      alignItems: "center",
    },
    shelfEmptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
    savedReelsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 20,
      gap: 10,
    },
    savedReelCard: {
      width: (SCREEN_W - 50) / 2,
      aspectRatio: 9 / 14,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    savedReelFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgElevated,
    },
    savedReelBadge: {
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
    savedReelInfo: {
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 10,
    },
    savedReelTitle: { color: "#fff", fontSize: 13, lineHeight: 17, fontWeight: "900" },
    savedReelCreator: { color: "rgba(255,255,255,0.74)", fontSize: 11, fontWeight: "700", marginTop: 3 },
  });
}
