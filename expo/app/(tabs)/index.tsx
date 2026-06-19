import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Baby,
  Bell,
  Book,
  BookMarked,
  BookOpen,
  Brain,
  Clapperboard,
  Feather,
  FlaskConical,
  GraduationCap,
  Heart,
  LayoutGrid,
  Newspaper,
  Rocket,
  ScrollText,
  Search,
  Smile,
  Sparkles,
  Star,
  User,
} from "lucide-react-native";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale } from "@/components/ui";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import type { DisplayBook } from "@/types/database";

const { width: SW } = Dimensions.get("window");

const L = {
  bg: "#F8F5F0",
  card: "#FFFFFF",
  accent: "#2D6A4F",
  accentLight: "#E8F4EE",
  accentMid: "#52B788",
  gold: "#D4A843",
  text: "#1A1A1A",
  textSub: "#5C5C5C",
  textMuted: "#9A9A9A",
  border: "rgba(0,0,0,0.07)",
};

const GRID_PAD = 16;
const GRID_GAP = 10;
const GRID_CELL = (SW - GRID_PAD * 2 - GRID_GAP * 2) / 3;
const GRID_IMG_H = Math.floor(GRID_CELL * 1.45);

type IconComp = React.ComponentType<{ color: string; size: number; strokeWidth?: number }>;

const GENRE_CATS = ["Hammasi", "She'r", "Roman", "Hikoya", "Ssenariy", "Qissa", "Maqola", "Qo'llanma", "Darslik", "Ertak"] as const;
const THEME_CATS = ["Hayotiy", "Fantastik", "Falsafiy", "Psixologik", "Ilmiy", "Biografik", "Bolalar"] as const;

type GenreCat = typeof GENRE_CATS[number];
type ThemeCat = typeof THEME_CATS[number];
type Cat = GenreCat | ThemeCat;

const GENRE_ICONS: Record<GenreCat, IconComp> = {
  Hammasi: LayoutGrid,
  "She'r": Feather,
  Roman: Book,
  Hikoya: BookOpen,
  Ssenariy: Clapperboard,
  Qissa: ScrollText,
  Maqola: Newspaper,
  "Qo'llanma": BookMarked,
  Darslik: GraduationCap,
  Ertak: Sparkles,
};

const THEME_ICONS: Record<ThemeCat, IconComp> = {
  Hayotiy: Heart,
  Fantastik: Rocket,
  Falsafiy: Brain,
  Psixologik: Smile,
  Ilmiy: FlaskConical,
  Biografik: User,
  Bolalar: Baby,
};

// ─── Chip ─────────────────────────────────────────────────────────────────────
const ChipRow = memo(function ChipRow({
  cats,
  icons,
  active,
  onSelect,
}: {
  cats: readonly string[];
  icons: Record<string, IconComp>;
  active: Cat;
  onSelect: (c: Cat) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {cats.map((c) => {
        const isActive = active === c;
        const Icon = icons[c];
        return (
          <Pressable
            key={c}
            onPress={() => onSelect(c as Cat)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            {Icon && <Icon color={isActive ? "#fff" : L.accent} size={13} strokeWidth={2} />}
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

// ─── Last-read card ────────────────────────────────────────────────────────────
const LastReadCard = memo(function LastReadCard({
  book,
  progress,
  loading,
  onPress,
}: {
  book: DisplayBook | null;
  progress: number;
  loading: boolean;
  onPress: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.lastReadCard}>
        <View style={styles.lastReadInner}>
          <SkeletonBox w={72} h={100} r={12} />
          <View style={{ flex: 1, gap: 10 }}>
            <SkeletonBox w="85%" h={15} r={6} />
            <SkeletonBox w="60%" h={12} r={6} />
            <SkeletonBox w="100%" h={5} r={3} />
            <SkeletonBox w={90} h={32} r={10} />
          </View>
        </View>
      </View>
    );
  }

  if (!book) {
    return (
      <Pressable onPress={() => router.push("/(tabs)/tokcha")} style={styles.lastReadCard}>
        <LinearGradient
          colors={["#E8F4EE", "#F0F9F4"]}
          style={styles.lastReadEmpty}
        >
          <View style={styles.lastReadEmptyIcon}>
            <BookOpen color={L.accent} size={26} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.lastReadEmptyTitle}>Hali kitob boshlanmagan</Text>
            <Text style={styles.lastReadEmptySub}>Bugun birinchi kitobingizni tanlang</Text>
          </View>
          <View style={styles.lastReadEmptyBtn}>
            <Text style={styles.lastReadEmptyBtnText}>Boshlash →</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <Pressable onPress={onPress} style={styles.lastReadCard}>
      <View style={styles.lastReadInner}>
        <View style={styles.lastReadCover}>
          {book.cover ? (
            <Image
              source={{ uri: book.cover }}
              style={{ width: "100%", height: "100%", borderRadius: 12 }}
              contentFit="cover"
            />
          ) : (
            <View style={styles.lastReadCoverPlaceholder}>
              <Book color={L.accent} size={22} />
            </View>
          )}
        </View>
        <View style={styles.lastReadInfo}>
          <View>
            <Text style={styles.lastReadLabel}>Davom etmoqdasiz</Text>
            <Text numberOfLines={2} style={styles.lastReadTitle}>{book.title}</Text>
            <Text numberOfLines={1} style={styles.lastReadAuthor}>{book.authorName}</Text>
          </View>
          <View>
            <View style={styles.lastReadProgressWrap}>
              <View style={styles.lastReadProgressBg}>
                <View style={[styles.lastReadProgressFill, { width: `${pct || 5}%` }]} />
              </View>
              <Text style={styles.lastReadProgressTxt}>{pct}%</Text>
            </View>
            <View style={styles.lastReadBtn}>
              <Text style={styles.lastReadBtnText}>Davom etish →</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// ─── Carousel item ─────────────────────────────────────────────────────────────
const CarouselItem = memo(function CarouselItem({
  book,
  isActive,
  cW,
  cH,
  marginRight,
  onPress,
}: {
  book: DisplayBook;
  isActive: boolean;
  cW: number;
  cH: number;
  marginRight: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 280, friction: 14 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 80, useNativeDriver: true }).start();
    }
  }, [isActive, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.0] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.0] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Animated.View style={{ width: cW, height: cH, marginRight, transform: [{ scale }, { translateY }], opacity }}>
      <Pressable
        onPress={onPress}
        style={{ width: cW, height: cH, borderRadius: 24, overflow: "hidden", backgroundColor: L.accentLight }}
      >
        {book.cover ? (
          <Image source={{ uri: book.cover }} style={{ width: "100%", height: "100%", borderRadius: 24 }} contentFit="cover" />
        ) : (
          <View style={styles.carouselPlaceholder}>
            <Book color={L.accent} size={36} strokeWidth={1.5} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={StyleSheet.absoluteFillObject}
        />
        {book.isFree && (
          <View style={styles.carouselBadge}>
            <Text style={styles.carouselBadgeText}>BEPUL</Text>
          </View>
        )}
        {isActive && (
          <View style={styles.carouselStarRow}>
            <Star color={L.gold} size={12} fill={L.gold} />
            <Star color={L.gold} size={12} fill={L.gold} />
            <Star color={L.gold} size={12} fill={L.gold} />
            <Star color={L.gold} size={12} fill={L.gold} />
            <Star color={L.gold} size={12} fill={L.gold} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

// ─── Grid book card ────────────────────────────────────────────────────────────
const BookGridCard = memo(function BookGridCard({ book, onPress }: { book: DisplayBook; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.gridCard}>
      <View style={[styles.gridCover, { height: GRID_IMG_H }]}>
        {book.cover ? (
          <Image source={{ uri: book.cover }} style={{ width: "100%", height: "100%", borderRadius: 14 }} contentFit="cover" />
        ) : (
          <View style={styles.gridCoverPlaceholder}>
            <Book color={L.accent} size={18} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)"]}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
        />
        <View style={[styles.gridBadge, { backgroundColor: book.isFree ? L.accent : "rgba(0,0,0,0.55)" }]}>
          <Text style={styles.gridBadgeText}>{book.isFree ? "BEPUL" : `${Math.floor(book.price / 1000)}k`}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.gridTitle}>{book.title}</Text>
      <Text numberOfLines={1} style={styles.gridAuthor}>{book.authorName}</Text>
    </PressableScale>
  );
});

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonBox = memo(function SkeletonBox({ w, h, r = 12 }: { w: number | string; h: number; r?: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: "#DDD8CE", opacity: pulse }} />;
});

// ─── Home screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();

  const cW = Math.floor(sw * 0.62);
  const cH = Math.floor(cW * 1.46);
  const cGap = 14;
  const cPad = (sw - cW) / 2;

  const [activeCat, setActiveCat] = useState<Cat>("Hammasi");
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [lastBookId, setLastBookId] = useState<string | null>(null);
  const [lastBookProgress, setLastBookProgress] = useState(0);

  const { books: supaBooks, loading: booksLoading } = usePublishedBooks();

  const titleOpacity = useRef(new Animated.Value(1)).current;
  const prevIdxRef = useRef(0);

  useEffect(() => {
    AsyncStorage.multiGet(["adabiyot.last_book_id", "adabiyot.last_book_progress"])
      .then(([[, id], [, prog]]) => {
        if (id) setLastBookId(id);
        if (prog) setLastBookProgress(parseFloat(prog) || 0);
      })
      .catch(() => {});
  }, []);

  const newBooks = useMemo(() => supaBooks.slice(0, 5), [supaBooks]);

  const lastReadBook = useMemo(
    () => (lastBookId ? (supaBooks.find((b) => b.id === lastBookId) ?? null) : null),
    [lastBookId, supaBooks]
  );

  const gridBooks = useMemo(() => {
    const list = activeCat === "Hammasi" ? supaBooks : supaBooks.filter((b) => b.genre === activeCat);
    return list.slice(0, 9);
  }, [activeCat, supaBooks]);

  useEffect(() => {
    if (prevIdxRef.current === carouselIdx) return;
    prevIdxRef.current = carouselIdx;
    Animated.sequence([
      Animated.timing(titleOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [carouselIdx, titleOpacity]);

  const lastCarouselIdxRef = useRef(0);
  const handleCarouselEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.max(0, Math.min(Math.round(x / (cW + cGap)), newBooks.length - 1));
      if (idx !== lastCarouselIdxRef.current) {
        lastCarouselIdxRef.current = idx;
        setCarouselIdx(idx);
      }
    },
    [cW, cGap, newBooks.length]
  );

  const onBook = useCallback((id: string) => {
    router.push({ pathname: "/book/[id]", params: { id } });
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long" });

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#2D6A4F", "#1B4D38"]}
          style={[styles.heroGrad, { paddingTop: insets.top + 18 }]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <PressableScale onPress={() => router.push("/(tabs)/profile")} style={styles.avatarRing}>
                <Image
                  source={{ uri: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200" }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </PressableScale>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.dateLabel}>{dateStr}</Text>
                <Text style={styles.greeting}>Salom, Aziz! 👋</Text>
                <Text style={styles.greetingSub}>Bugun nima o'qiysiz?</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <PressableScale style={styles.iconBtn} onPress={() => router.push("/(tabs)/tokcha")}>
                <Search color="#fff" size={18} strokeWidth={2} />
              </PressableScale>
              <PressableScale style={styles.iconBtn}>
                <Bell color="#fff" size={18} strokeWidth={2} />
                <View style={styles.notifDot} />
              </PressableScale>
            </View>
          </View>
        </LinearGradient>

        {/* ── LAST READ CARD ──────────────────────────────────────────────────── */}
        <View style={{ marginTop: -18 }}>
          <LastReadCard
            book={lastReadBook}
            progress={lastBookProgress}
            loading={booksLoading && !lastBookId}
            onPress={() => lastBookId && onBook(lastBookId)}
          />
        </View>

        {/* ── ADABIYOTLAR SECTION ─────────────────────────────────────────────── */}
        <View style={[styles.sectionRow, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Adabiyotlar</Text>
          <Text style={styles.sectionSub}>Barcha asarlar</Text>
        </View>

        {/* ── GENRE CHIPS ─────────────────────────────────────────────────────── */}
        <ChipRow cats={GENRE_CATS} icons={GENRE_ICONS} active={activeCat} onSelect={setActiveCat} />
        <View style={{ marginTop: 8 }}>
          <ChipRow cats={THEME_CATS} icons={THEME_ICONS} active={activeCat} onSelect={setActiveCat} />
        </View>

        {/* ── CAROUSEL ────────────────────────────────────────────────────────── */}
        <View style={{ marginTop: 22 }}>
          {booksLoading && newBooks.length === 0 ? (
            <View style={{ paddingHorizontal: cPad, gap: cGap, flexDirection: "row" }}>
              {[0, 1, 2].map((i) => <SkeletonBox key={i} w={cW} h={cH} r={24} />)}
            </View>
          ) : newBooks.length > 0 ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToOffsets={newBooks.map((_, i) => i * (cW + cGap))}
                disableIntervalMomentum
                decelerationRate="fast"
                style={{ height: cH }}
                contentContainerStyle={{ paddingHorizontal: cPad }}
                onMomentumScrollEnd={handleCarouselEnd}
                onScrollEndDrag={handleCarouselEnd}
                scrollEventThrottle={16}
              >
                {newBooks.map((book, index) => (
                  <CarouselItem
                    key={book.id}
                    book={book}
                    isActive={index === carouselIdx}
                    cW={cW}
                    cH={cH}
                    marginRight={index < newBooks.length - 1 ? cGap : 0}
                    onPress={() => onBook(book.id)}
                  />
                ))}
              </ScrollView>

              <View style={styles.dotsRow}>
                {newBooks.map((_, i) => (
                  <View key={i} style={[styles.dot, i === carouselIdx && styles.dotActive]} />
                ))}
              </View>

              <Animated.View style={[styles.carouselInfo, { opacity: titleOpacity }]}>
                <Text numberOfLines={1} style={styles.carouselTitle}>{newBooks[carouselIdx]?.title ?? ""}</Text>
                <Text numberOfLines={1} style={styles.carouselAuthor}>{newBooks[carouselIdx]?.authorName ?? ""}</Text>
              </Animated.View>
            </>
          ) : null}
        </View>

        {/* ── BOOK GRID ────────────────────────────────────────────────────────── */}
        <View style={[styles.sectionRow, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Top asarlar</Text>
        </View>
        <View style={{ marginTop: 4 }}>
          {booksLoading && gridBooks.length === 0 ? (
            <View style={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={{ width: GRID_CELL }}>
                  <SkeletonBox w={GRID_CELL} h={GRID_IMG_H} r={14} />
                  <View style={{ marginTop: 6, gap: 4 }}>
                    <SkeletonBox w={GRID_CELL * 0.85} h={12} r={6} />
                    <SkeletonBox w={GRID_CELL * 0.6} h={10} r={6} />
                  </View>
                </View>
              ))}
            </View>
          ) : gridBooks.length === 0 ? (
            <View style={styles.emptyState}>
              <BookOpen color={L.textMuted} size={32} strokeWidth={1.5} />
              <Text style={styles.emptyText}>Bu kategoriyada kitoblar yo'q</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {gridBooks.map((book) => (
                <BookGridCard key={book.id} book={book} onPress={() => onBook(book.id)} />
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  heroGrad: {
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarRing: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.6)",
    overflow: "hidden",
  },
  dateLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  greeting: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", fontFamily: FONT.serif, marginTop: 1 },
  greetingSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  notifDot: {
    position: "absolute", top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: L.gold, borderWidth: 1.5, borderColor: L.accent,
  },

  // Last-read card
  lastReadCard: {
    marginHorizontal: 16, backgroundColor: L.card, borderRadius: 22, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  lastReadInner: { flexDirection: "row", padding: 16, gap: 14, alignItems: "center" },
  lastReadCover: { width: 74, height: 104, borderRadius: 12, overflow: "hidden", backgroundColor: L.accentLight },
  lastReadCoverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: L.accentLight },
  lastReadInfo: { flex: 1, height: 104, justifyContent: "space-between" },
  lastReadLabel: { color: L.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 },
  lastReadTitle: { color: L.text, fontSize: 15, fontWeight: "700", lineHeight: 20, fontFamily: FONT.serif },
  lastReadAuthor: { color: L.textSub, fontSize: 12, marginTop: 2 },
  lastReadProgressWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  lastReadProgressBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#EEE9E0", overflow: "hidden" },
  lastReadProgressFill: { height: "100%", borderRadius: 2, backgroundColor: L.accent },
  lastReadProgressTxt: { color: L.accent, fontSize: 11, fontWeight: "700", minWidth: 28, textAlign: "right" },
  lastReadBtn: { alignSelf: "flex-start", backgroundColor: L.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, marginTop: 6 },
  lastReadBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  lastReadEmpty: { flexDirection: "row", alignItems: "center", padding: 18, gap: 14 },
  lastReadEmptyIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center" },
  lastReadEmptyTitle: { color: L.text, fontSize: 14, fontWeight: "700", fontFamily: FONT.serif },
  lastReadEmptySub: { color: L.textSub, fontSize: 12, marginTop: 3, lineHeight: 17 },
  lastReadEmptyBtn: { backgroundColor: L.accent, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  lastReadEmptyBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Section
  sectionRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle: { color: L.text, fontSize: 22, fontWeight: "800", fontFamily: FONT.serif, letterSpacing: -0.4 },
  sectionSub: { color: L.accent, fontSize: 13, fontWeight: "600" },

  // Carousel
  carouselPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: L.accentLight, borderRadius: 24 },
  carouselBadge: {
    position: "absolute", top: 12, left: 12,
    backgroundColor: L.accent, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10,
  },
  carouselBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  carouselStarRow: { position: "absolute", bottom: 14, left: 14, flexDirection: "row", gap: 2 },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D5CCBC" },
  dotActive: { width: 22, height: 6, backgroundColor: L.accent },
  carouselInfo: { alignItems: "center", marginTop: 12, paddingHorizontal: 40, marginBottom: 4 },
  carouselTitle: { color: L.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif, textAlign: "center", letterSpacing: -0.3 },
  carouselAuthor: { color: L.accent, fontSize: 13, fontWeight: "600", marginTop: 4, textAlign: "center" },

  // Chips
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: L.card,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  chipActive: { backgroundColor: L.accent, borderColor: L.accent },
  chipText: { color: L.textSub, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: GRID_PAD, gap: GRID_GAP },
  gridCard: { width: GRID_CELL },
  gridCover: {
    width: GRID_CELL, borderRadius: 14, overflow: "hidden", backgroundColor: L.accentLight, marginBottom: 8,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  gridCoverPlaceholder: { width: "100%", height: "100%", borderRadius: 14, backgroundColor: L.accentLight, alignItems: "center", justifyContent: "center" },
  gridBadge: { position: "absolute", top: 7, left: 7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7 },
  gridBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  gridTitle: { color: L.text, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  gridAuthor: { color: L.textSub, fontSize: 11, marginTop: 2 },

  // Empty
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: L.textMuted, fontSize: 13 },
});
