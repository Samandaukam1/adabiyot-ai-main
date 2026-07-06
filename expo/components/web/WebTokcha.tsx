import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { FONT } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { usePublishedArticles } from "@/hooks/useArticleContent";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { usePurchasedContent } from "@/hooks/usePurchasedContent";
import { useSavedReels } from "@/hooks/useReels";
import { useShelf, type ShelfItem } from "@/hooks/useShelf";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/constants/colors";
import type { DisplayArticle } from "@/lib/articles";
import type { PublicReel } from "@/lib/reels";
import { articles as legacyArticles } from "@/mocks/content";
import { useHover } from "./useHover";
import WebBookCover from "./WebBookCover";
import WebBookGrid, { WebBookGridSkeleton } from "./WebBookGrid";
import WebContainer from "./WebContainer";
import WebFooter from "./WebFooter";
import { cursorPointer, hoverTransition, softShadow } from "./webStyle";

const GAP = 24;

// Ids of the bundled mock articles the shared hook uses as a loading fallback —
// filtered out so the web "Maqolalar" grid only ever shows real Supabase rows.
const MOCK_ARTICLE_IDS = new Set(legacyArticles.map((a) => a.id));

const CATALOG: { id: string; label: string; icon: string }[] = [
  { id: "all", label: "Barcha kitoblar", icon: "bookshelf" },
  { id: "g:She'r", label: "She'rlar", icon: "feather" },
  { id: "g:Roman", label: "Romanlar", icon: "book-open-page-variant" },
  { id: "g:Hikoya", label: "Hikoyalar", icon: "book-open-variant" },
  { id: "g:Ssenariy", label: "Ssenariylar", icon: "movie-open-outline" },
  { id: "g:Qissa", label: "Qissalar", icon: "script-text-outline" },
  { id: "g:Maqola", label: "Maqolalar", icon: "newspaper-variant-outline" },
  { id: "g:Darslik", label: "Darsliklar", icon: "school-outline" },
  { id: "g:Ertak", label: "Ertaklar", icon: "auto-fix" },
];

const SHELF: { id: string; label: string; icon: string }[] = [
  { id: "purchased", label: "Sotib olinganlar", icon: "shopping-outline" },
  { id: "reading", label: "O'qilayotganlar", icon: "book-open-outline" },
  { id: "planned", label: "Rejadagilar", icon: "clock-outline" },
  { id: "reels", label: "Saqlangan Reels", icon: "film-outline" },
];

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

/**
 * Premium web library dashboard for the Tokcha tab: a left category sidebar
 * (catalog genres + the user's shelf) and a responsive content grid. Selected
 * only on `isWebLayout`; the native mobile Tokcha screen is untouched.
 */
export default function WebTokcha() {
  const { colors: L } = useTheme();
  const { userId } = useAuth();
  const { width, contentMaxWidth, isTablet, isDesktopWeb } = useResponsive();
  const { books, loading, refetch } = usePublishedBooks();
  const { articles, loading: articlesLoading, refetch: refetchArticles } = usePublishedArticles();
  const { reading, planned } = useShelf();
  const { items: purchased, loading: purchasedLoading } = usePurchasedContent();
  const { reels: savedReels, loading: savedReelsLoading } = useSavedReels(userId);

  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");

  const pad = isTablet ? 24 : 40;
  const inner = Math.min(width, contentMaxWidth) - pad * 2;
  const sidebarW = isDesktopWeb ? 252 : 208;
  const mainAvail = inner - sidebarW - 36;
  const gridCols = mainAvail > 900 ? 4 : mainAvail > 620 ? 3 : 2;
  const cardW = Math.floor((mainAvail - GAP * (gridCols - 1)) / gridCols);

  // "Maqolalar" is served by the real `articles` table (usePublishedArticles),
  // not by book-genre filtering — so it gets its own branch below.
  const isArticles = active === "g:Maqola";
  const isCatalog = !isArticles && (active === "all" || active.startsWith("g:"));
  const genre = active.startsWith("g:") ? active.slice(2) : null;

  const catalogBooks = useMemo(() => {
    let list = books;
    if (genre) list = list.filter((b) => b.genre === genre);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => b.title.toLowerCase().includes(q) || b.authorName.toLowerCase().includes(q));
    return list;
  }, [books, genre, query]);

  // Only REAL Supabase articles — drop the mock/demo seed the shared hook merges
  // in as a loading fallback so the web never shows placeholder maqolalar.
  const realArticles = useMemo(() => articles.filter((a) => !MOCK_ARTICLE_IDS.has(a.id)), [articles]);

  const articleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return realArticles;
    return realArticles.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.author ?? "").toLowerCase().includes(q)
    );
  }, [realArticles, query]);

  useEffect(() => {
    if (!isArticles) return;
    console.log("[WebArticles] fetching...");
    console.log("[WebArticles] count:", realArticles.length);
  }, [isArticles, realArticles.length]);

  const shelfItems = useMemo(() => {
    const base = active === "purchased" ? purchased : active === "reading" ? reading : active === "planned" ? planned : [];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((it) => (it.title ?? "").toLowerCase().includes(q) || (it.author ?? "").toLowerCase().includes(q));
  }, [active, purchased, reading, planned, query]);

  const reelItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedReels;
    return savedReels.filter((r) => (r.title ?? "").toLowerCase().includes(q) || (r.creatorName ?? "").toLowerCase().includes(q));
  }, [savedReels, query]);

  const counts: Record<string, number> = {
    purchased: purchased.length,
    reading: reading.length,
    planned: planned.length,
    reels: savedReels.length,
  };

  const activeLabel = [...CATALOG, ...SHELF].find((s) => s.id === active)?.label ?? "Tokcha";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: L.bg }}>
      <View style={{ paddingTop: isDesktopWeb ? 40 : 28 }}>
        <WebContainer>
          {/* Page head */}
          <View style={{ marginBottom: 26 }}>
            <Text style={{ color: L.text, fontSize: isDesktopWeb ? 40 : 30, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -0.8 }}>
              Tokcha
            </Text>
            <Text style={{ color: L.textDim, fontSize: 16, marginTop: 8 }}>Kutubxonangiz va butun adabiyot to'plami</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 36 }}>
            {/* Sidebar */}
            <View style={{ width: sidebarW }}>
              <SidebarGroup title="Kutubxona" L={L}>
                {CATALOG.map((it) => (
                  <SidebarItem
                    key={it.id}
                    icon={it.icon}
                    label={it.label}
                    active={active === it.id}
                    onPress={() => {
                      if (it.id === "g:Ssenariy") {
                        router.push("/screenplays");
                        return;
                      }
                      setActive(it.id);
                    }}
                    L={L}
                  />
                ))}
              </SidebarGroup>
              <View style={{ height: 22 }} />
              <SidebarGroup title="Mening tokcham" L={L}>
                {SHELF.map((it) => (
                  <SidebarItem key={it.id} icon={it.icon} label={it.label} count={counts[it.id]} active={active === it.id} onPress={() => setActive(it.id)} L={L} />
                ))}
              </SidebarGroup>
            </View>

            {/* Main */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
                <Text style={{ color: L.text, fontSize: 22, fontWeight: "800", fontFamily: FONT.serif }}>{activeLabel}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: L.bgCard, borderWidth: 1, borderColor: L.border, borderRadius: 12, paddingHorizontal: 14, height: 42, minWidth: 240 }}>
                  <MaterialCommunityIcons name="magnify" size={18} color={L.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Tokcha ichida qidirish…"
                    placeholderTextColor={L.textMuted}
                    style={[{ flex: 1, color: L.text, fontSize: 14.5, fontWeight: "600" }, { outlineStyle: "none" } as any]}
                  />
                </View>
              </View>

              {isArticles ? (
                articlesLoading && articleItems.length === 0 ? (
                  <Spinner L={L} />
                ) : articleItems.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                    {articleItems.map((a) => (
                      <ArticleCard key={a.id} article={a} width={cardW} L={L} />
                    ))}
                  </View>
                ) : (
                  <Empty icon="newspaper-variant-outline" text="Hali maqolalar mavjud emas" L={L} onRetry={refetchArticles} />
                )
              ) : isCatalog ? (
                loading && catalogBooks.length === 0 ? (
                  <WebBookGridSkeleton count={gridCols * 2} />
                ) : catalogBooks.length > 0 ? (
                  <WebBookGrid books={catalogBooks} availableWidth={mainAvail} columns={gridCols} />
                ) : (
                  <Empty icon="book-search-outline" text="Bu bo'limda kitob topilmadi" L={L} onRetry={refetch} />
                )
              ) : active === "reels" ? (
                savedReelsLoading && reelItems.length === 0 ? (
                  <Spinner L={L} />
                ) : reelItems.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                    {reelItems.map((r) => (
                      <ReelCard key={r.id} reel={r} width={cardW} L={L} />
                    ))}
                  </View>
                ) : (
                  <Empty icon="film-outline" text="Saqlangan reels yo'q. Reelsda saqlagan videolaringiz shu yerda ko'rinadi." L={L} />
                )
              ) : (active === "purchased" && purchasedLoading && shelfItems.length === 0) ? (
                <Spinner L={L} />
              ) : shelfItems.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                  {shelfItems.map((it) => (
                    <ShelfCard key={`${it.contentType}:${it.contentId}`} item={it} width={cardW} L={L} />
                  ))}
                </View>
              ) : (
                <Empty
                  icon={active === "purchased" ? "shopping-outline" : active === "reading" ? "book-open-outline" : "clock-outline"}
                  text={
                    active === "purchased"
                      ? "Hali adabiyot sotib olinmagan. Sotib olgan asarlaringiz shu yerda jamlanadi."
                      : active === "reading"
                      ? "O'qishni boshlagan asarlaringiz shu yerda ko'rinadi."
                      : "«Tez orada o'qiyman» bosilgan asarlar shu yerda to'planadi."
                  }
                  L={L}
                />
              )}
            </View>
          </View>
        </WebContainer>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function SidebarGroup({ title, children, L }: { title: string; children: React.ReactNode; L: AppTheme }) {
  return (
    <View>
      <Text style={{ color: L.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10, paddingHorizontal: 6 }}>
        {title}
      </Text>
      <View style={{ gap: 2 }}>{children}</View>
    </View>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onPress,
  L,
}: {
  icon: string;
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
  L: AppTheme;
}) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: active ? L.soft : hovered ? L.surface : "transparent",
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={19} color={active ? L.primary : L.textDim} />
      <Text style={{ flex: 1, color: active ? L.text : L.textDim, fontSize: 14.5, fontWeight: active ? "800" : "600" }} numberOfLines={1}>
        {label}
      </Text>
      {count != null && count > 0 ? (
        <View style={{ minWidth: 22, paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: active ? L.primary : L.surface, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: active ? "#fff" : L.textDim, fontSize: 11, fontWeight: "800" }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────
function ShelfCard({ item, width, L }: { item: ShelfItem; width: number; L: AppTheme }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const progress = typeof item.progress === "number" ? Math.min(100, Math.round(item.progress * 100)) : 0;
  return (
    <Pressable
      onPress={() => goToShelfItem(item)}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[{ width }, cursorPointer, hoverTransition, hovered ? { transform: [{ translateY: -6 }] } : null]}
    >
      <WebBookCover uri={item.cover} width={width} size="large">
        <View style={{ position: "absolute", top: 12, left: 14, backgroundColor: "rgba(0,0,0,0.62)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 }}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>{SHELF_TYPE_LABEL[item.contentType]}</Text>
        </View>
      </WebBookCover>
      <Text numberOfLines={1} style={{ color: L.text, fontSize: 14.5, fontWeight: "700", marginTop: 12, fontFamily: FONT.serif }}>
        {item.title || "Nomsiz asar"}
      </Text>
      {item.author ? (
        <Text numberOfLines={1} style={{ color: L.textDim, fontSize: 12.5, marginTop: 3 }}>
          {item.author}
        </Text>
      ) : null}
      {progress > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: L.surface, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${progress}%`, backgroundColor: L.primary, borderRadius: 2 }} />
          </View>
          <Text style={{ color: L.primary, fontSize: 11, fontWeight: "700" }}>{progress}%</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ReelCard({ reel, width, L }: { reel: PublicReel; width: number; L: AppTheme }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const h = Math.round((width * 16) / 9);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(tabs)/reels", params: { reelId: reel.id } })}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[{ width }, cursorPointer, hoverTransition, hovered ? { transform: [{ translateY: -6 }] } : null]}
    >
      <View style={[{ width, height: h, borderRadius: 16, overflow: "hidden", backgroundColor: L.surface, borderWidth: 1, borderColor: L.border }, softShadow(hovered)]}>
        {reel.thumbnailUrl ? (
          <Image source={{ uri: reel.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="film" size={30} color={L.primary} />
          </View>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.82)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" }} />
        <View style={{ position: "absolute", top: 12, left: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="play" size={17} color="#fff" />
        </View>
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <Text numberOfLines={2} style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{reel.title}</Text>
          {reel.creatorName ? (
            <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "700", marginTop: 3 }}>{reel.creatorName}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ArticleCard({ article, width, L }: { article: DisplayArticle; width: number; L: AppTheme }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const h = Math.round(width * 0.62);
  const meta = [formatArticleDate(article.publishedAt), article.readingMinutes > 0 ? `${article.readingMinutes} daqiqa` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/article/[id]", params: { id: article.id } })}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[{ width }, cursorPointer, hoverTransition, hovered ? { transform: [{ translateY: -6 }] } : null]}
    >
      <View style={[{ width, height: h, borderRadius: 16, overflow: "hidden", backgroundColor: L.surface, borderWidth: 1, borderColor: L.border }, softShadow(hovered)]}>
        {article.cover ? (
          <Image source={{ uri: article.cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="newspaper-variant-outline" size={30} color={L.primary} />
          </View>
        )}
        {article.category ? (
          <View style={{ position: "absolute", top: 12, left: 12, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>{article.category}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={{ color: L.text, fontSize: 15, fontWeight: "800", marginTop: 12, fontFamily: FONT.serif, lineHeight: 20 }}>
        {article.title}
      </Text>
      {article.description ? (
        <Text numberOfLines={2} style={{ color: L.textDim, fontSize: 13, marginTop: 5, lineHeight: 19 }}>
          {article.description}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {article.hasAuthor && article.author ? (
          <Text numberOfLines={1} style={{ color: L.primary, fontSize: 12, fontWeight: "700" }}>{article.author}</Text>
        ) : null}
        {meta ? <Text numberOfLines={1} style={{ color: L.textMuted, fontSize: 12, fontWeight: "600" }}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

function formatArticleDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
  return `${date.getDate()}-${months[date.getMonth()]}, ${date.getFullYear()}`;
}

// ── Bits ──────────────────────────────────────────────────────────────────
function Spinner({ L }: { L: AppTheme }) {
  return (
    <View style={{ paddingVertical: 70, alignItems: "center" }}>
      <ActivityIndicator color={L.primary} size="large" />
    </View>
  );
}

function Empty({ icon, text, L, onRetry }: { icon: string; text: string; L: AppTheme; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 72, gap: 12, paddingHorizontal: 24 }}>
      <MaterialCommunityIcons name={icon as any} size={36} color={L.textMuted} />
      <Text style={{ color: L.textMuted, fontSize: 15, textAlign: "center", maxWidth: 420, lineHeight: 22 }}>{text}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={[{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 }, cursorPointer]}>
          <MaterialCommunityIcons name="refresh" size={16} color={L.primary} />
          <Text style={{ color: L.primary, fontSize: 13.5, fontWeight: "700" }}>Qayta urinish</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
