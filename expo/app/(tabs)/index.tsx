import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
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
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale } from "@/components/ui";
import {
  AnimatedPressable,
  FadeSlideIn,
  ScreenTransitionWrapper,
  SlideFromLeft,
  SlideFromRight,
  StaggeredCard,
  TypingText,
  useReduceMotion,
} from "@/components/animations";
import { PullRefreshIndicator } from "@/components/PullRefreshIndicator";
import ExploreShortcutButtons from "@/components/ExploreShortcutButtons";
import ArticleHomeCard from "@/components/ArticleHomeCard";
import HomeHeroAdCard from "@/components/HomeHeroAdCard";
import BookCover from "@/components/BookCover";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { useContentCategories, useContentGenres } from "@/hooks/useTaxonomy";
import { bookMatchesCategory, bookMatchesGenre } from "@/lib/taxonomy";
import { useHomeArticleCards } from "@/hooks/useArticleContent";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useHomeHeroAd } from "@/hooks/useHomeHeroAd";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useBranding } from "@/providers/BrandingProvider";
import { useAuth } from "@/providers/AuthProvider";
import { userScopedKey } from "@/lib/userStorage";
import VerificationBadge from "@/components/VerificationBadge";
import { getInitials, resolveDisplayBadge } from "@/types/profile";
import { useResponsive } from "@/hooks/useResponsive";
import WebHome from "@/components/web/WebHome";
import type { AppTheme } from "@/constants/colors";
import type { DisplayBook } from "@/types/database";

const { width: SW } = Dimensions.get("window");

const GRID_PAD = 20;
const GRID_GAP = 16;
const GRID_CELL = (SW - GRID_PAD * 2 - GRID_GAP * 1.5) / 2.5;
const GRID_IMG_H = Math.floor(GRID_CELL * 1.46);

// Chips are built from the LIVE taxonomy (public.content_genres /
// public.content_categories) — the same rows the admin panel tags books with.
// The only hardcoded entries are the "Hammasi" reset chip and the special
// "Eng yangi" filter, which is a frontend-only view over the freshest published
// books rather than a taxonomy row.
const ALL_CHIP = "Hammasi";
const LATEST_CHIP = "Eng yangi";

/** How many books the newest-first carousel shows in each of its two slots. */
const CAROUSEL_LIMIT = 5;
const LATEST_CAROUSEL_LIMIT = 10;

// One vertical rhythm for every section on this page, so the shelves read as a
// dense, even stack instead of drifting apart:
//   …row ⟶ ROW_BOTTOM_PAD ⟶ SECTION_GAP ⟶ title ⟶ SECTION_TITLE_GAP ⟶ row…
const SECTION_GAP = 20;
const SECTION_TITLE_GAP = 11;
const ROW_BOTTOM_PAD = 2;

type Cat = string;

/** Icon per taxonomy name; anything unlisted falls back to a neutral glyph. */
const TAXONOMY_ICONS: Record<string, string> = {
  Hammasi: "view-grid",
  // Janrlar (content_genres)
  Hayotiy: "heart-outline",
  Fantastik: "rocket-launch-outline",
  Falsafiy: "brain",
  Psixologik: "emoticon-outline",
  Ilmiy: "flask-outline",
  Biografik: "account-outline",
  Romantik: "heart-multiple-outline",
  // Kategoriyalar (content_categories, content_group = 'book')
  Roman: "book-open-page-variant",
  Hikoya: "book-open-variant",
  Qissa: "script-text-outline",
  "Qo‘llanma": "book-education-outline",
  "To‘plam": "bookshelf",
  "She’riy to‘plam": "feather",
  Darslik: "school-outline",
  Ertak: "magic-staff",
};

const DEFAULT_CHIP_ICON = "book-outline";

const CATEGORY_ICON_COLORS: Record<string, string> = {
  Hammasi: "#52B788",
  "She'r": "#D946EF",
  Roman: "#2563EB",
  Hikoya: "#0EA5E9",
  Ssenariy: "#F97316",
  Qissa: "#A855F7",
  Maqola: "#14B8A6",
  "Qo'llanma": "#EAB308",
  Darslik: "#22C55E",
  Ertak: "#EC4899",
  Hayotiy: "#EF4444",
  Fantastik: "#8B5CF6",
  Falsafiy: "#06B6D4",
  Psixologik: "#F59E0B",
  Ilmiy: "#10B981",
  Biografik: "#6366F1",
  Romantik: "#F43F5E",
  "Qo‘llanma": "#EAB308",
  "To‘plam": "#0EA5E9",
  "She’riy to‘plam": "#D946EF",
};

// ─── Chip ─────────────────────────────────────────────────────────────────────
const ChipRow = memo(function ChipRow({
  cats,
  active,
  onSelect,
  leading,
}: {
  cats: readonly string[];
  active: Cat;
  onSelect: (c: Cat) => void;
  /** Rendered before the taxonomy chips — used for the "Eng yangi" chip. */
  leading?: React.ReactNode;
}) {
  const { colors: L } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipRowStyle}
    >
      {leading}
      {cats.map((c) => {
        const isActive = active === c;
        const iconName = TAXONOMY_ICONS[c] ?? DEFAULT_CHIP_ICON;
        const iconColor = isActive ? "#fff" : CATEGORY_ICON_COLORS[c] ?? L.primary;
        return (
          <AnimatedPressable
            key={c}
            onPress={() => onSelect(c as Cat)}
            pressedScale={0.91}
            style={[
              chipBase(L),
              isActive && { backgroundColor: L.primary, borderColor: L.primary },
            ]}
          >
            {iconName && (
              <MaterialCommunityIcons
                name={iconName as any}
                color={iconColor}
                size={14}
              />
            )}
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[chipLabel, { color: isActive ? "#fff" : L.textDim, fontWeight: "600" }]}
            >
              {c}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
});

/**
 * The special first chip of the kategoriya row. It sits behind a soft brand-green
 * halo that breathes on a ~2.2s loop, so it reads as the shortcut to the newest
 * books without out-shouting the taxonomy chips next to it. Opacity + scale only,
 * so the loop stays on the native driver (and degrades to a plain glow on web /
 * with Reduce Motion on).
 */
const LatestChip = memo(function LatestChip({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const { colors: L } = useTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: active ? [0.55, 1] : [0.3, 0.68],
  });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.05] });

  return (
    <View style={styles.latestChipWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.latestChipGlow,
          {
            backgroundColor: active ? L.primary : L.soft,
            shadowColor: L.primary,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <AnimatedPressable
        onPress={onPress}
        pressedScale={0.91}
        style={[
          chipBase(L),
          {
            backgroundColor: active ? L.primary : L.bgCard,
            borderColor: L.primary,
            shadowOpacity: 0,
            elevation: 0,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="star-four-points"
          size={14}
          color={active ? "#fff" : L.primary}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[chipLabel, { color: active ? "#fff" : L.primary, fontWeight: "800" }]}
        >
          {LATEST_CHIP}
        </Text>
      </AnimatedPressable>
    </View>
  );
});

// ─── Last-read card ────────────────────────────────────────────────────────────
function RotatingLastReadGlow({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: AppTheme;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [pulse, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const auraOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1],
  });

  return (
    <View style={styles.lastReadGlowFrame}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.lastReadGlowAura,
          {
            backgroundColor: theme.isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.1)",
            shadowColor: theme.primary,
            opacity: auraOpacity,
          },
        ]}
      />
      <View pointerEvents="none" style={styles.lastReadGlowClip}>
        <Animated.View style={[styles.lastReadGlowRotor, { transform: [{ rotate }] }]}>
          <LinearGradient
            colors={[
              "rgba(82,183,136,0.03)",
              "rgba(82,183,136,0.56)",
              "rgba(244,162,97,0.28)",
              "rgba(96,165,250,0.34)",
              "rgba(82,183,136,0.03)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.lastReadGlowOrb, { backgroundColor: theme.primary }]} />
          <View style={[styles.lastReadGlowOrbAlt, { backgroundColor: theme.gold }]} />
        </Animated.View>
      </View>
      {children}
    </View>
  );
}

const LastReadCard = memo(function LastReadCard({
  book,
  progress,
  loading,
  onPress,
  compact = false,
}: {
  book: DisplayBook | null;
  progress: number;
  loading: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors: L } = useTheme();

  if (loading) {
    if (compact) {
      return (
        <View style={[styles.compactContinue, { backgroundColor: L.bgCard, borderColor: L.border }]}>
          <SkeletonBox w={18} h={18} r={9} />
          <SkeletonBox w="72%" h={13} r={6} />
        </View>
      );
    }
    return (
      <View style={[lastReadCardBase(L), { paddingVertical: 0 }]}>
        <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12, gap: 12, alignItems: "center" }}>
          <SkeletonBox w={70} h={98} r={12} />
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
    if (compact) {
      return (
        <Pressable onPress={() => router.push("/(tabs)/tokcha")} style={[styles.compactContinue, { backgroundColor: L.bgCard, borderColor: L.border }]}>
          <MaterialCommunityIcons name="book-open-variant" size={18} color={L.primary} />
          <Text numberOfLines={1} style={{ flex: 1, color: L.text, fontSize: 13, fontWeight: "800" }}>Kitob o‘qishni boshlash</Text>
          <Text style={{ color: L.primary, fontSize: 12, fontWeight: "800" }}>Boshlash →</Text>
        </Pressable>
      );
    }
    return (
      <Pressable onPress={() => router.push("/(tabs)/tokcha")} style={lastReadCardBase(L)}>
        <LinearGradient
          colors={L.isDark ? ["#1A2A1A", "#0F1B14"] : ["#FEE2E5", "#FFF0F1"]}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14 }}
        >
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: L.isDark ? "rgba(82,183,136,0.18)" : "rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="book-open-variant" size={26} color={L.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: L.text, fontSize: 14, fontWeight: "700", fontFamily: FONT.serif }}>Hali kitob boshlanmagan</Text>
            <Text style={{ color: L.textDim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>Bugun birinchi kitobingizni tanlang</Text>
          </View>
          <View style={{ backgroundColor: L.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Boshlash →</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  if (compact) {
    return (
      <Pressable onPress={onPress} style={[styles.compactContinue, { backgroundColor: L.bgCard, borderColor: L.border }]}>
        <MaterialCommunityIcons name="book-open-page-variant" size={18} color={L.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: L.primary, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Davom etamizmi?</Text>
          <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "800", marginTop: 1 }}>{book.title}</Text>
        </View>
        <Text style={{ color: L.primary, fontSize: 12, fontWeight: "800" }}>{pct}%  →</Text>
      </Pressable>
    );
  }

  return (
    <RotatingLastReadGlow theme={L}>
      <Pressable onPress={onPress} style={lastReadCardBase(L, true)}>
        <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12, gap: 12, alignItems: "center" }}>
          <View style={{ width: 78, height: 110, borderRadius: 14, overflow: "hidden", backgroundColor: L.soft }}>
            {book.cover ? (
              <Image
                source={{ uri: book.cover }}
                style={{ width: "100%", height: "100%", borderRadius: 14 }}
                contentFit="cover"
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: L.soft }}>
                <MaterialCommunityIcons name="book" size={26} color={L.primary} />
              </View>
            )}
          </View>
          <View style={{ flex: 1, justifyContent: "center", gap: 9 }}>
            <View>
              <Text style={{ color: L.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 3 }}>Davom etamizmi?</Text>
              <Text numberOfLines={1} style={{ color: L.text, fontSize: 15.5, fontWeight: "700", lineHeight: 20, fontFamily: FONT.serif }}>{book.title}</Text>
              <Text numberOfLines={1} style={{ color: L.textDim, fontSize: 12, marginTop: 2 }}>{book.authorName}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AnimatedProgressLine pct={pct} color={L.primary} trackColor={L.surface} />
              <Text style={{ color: L.primary, fontSize: 11, fontWeight: "700", minWidth: 28, textAlign: "right" }}>{pct}%</Text>
            </View>
            <View style={{ alignSelf: "flex-start", backgroundColor: L.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "800" }}>Davom etish →</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </RotatingLastReadGlow>
  );
});

function AnimatedProgressLine({
  pct,
  color,
  trackColor,
}: {
  pct: number;
  color: string;
  trackColor: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: Math.max(5, Math.min(100, pct || 5)),
      duration: 820,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, progress]);

  return (
    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: trackColor, overflow: "hidden" }}>
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 2,
          backgroundColor: color,
          width: progress.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}

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
  const { colors: L } = useTheme();
  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 280, friction: 14 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [isActive, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.0] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.0] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Animated.View style={{ width: cW, height: cH, marginRight, transform: [{ scale }, { translateY }], opacity }}>
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        <BookCover uri={book.cover} width={cW} radius={12} style={{ height: cH }}>
          {isActive ? (
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.40)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" }} pointerEvents="none" />
          ) : null}
          {book.isFree && (
            <View style={{ position: "absolute", top: 12, left: 12 + 16, backgroundColor: L.primary, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>BEPUL</Text>
            </View>
          )}
          {isActive && (
            <View style={{ position: "absolute", bottom: 14, left: 14 + 16, flexDirection: "row", gap: 2 }}>
              {[0,1,2,3,4].map(i => <MaterialCommunityIcons key={i} name="star" color={L.gold} size={12} />)}
            </View>
          )}
        </BookCover>
      </Pressable>
    </Animated.View>
  );
});

// ─── Grid book card ────────────────────────────────────────────────────────────
const BookGridCard = memo(function BookGridCard({ book, onPress }: { book: DisplayBook; onPress: () => void }) {
  const { colors: L } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ width: GRID_CELL }}>
      <BookCover uri={book.cover} width={GRID_CELL} radius={10} placeholderIcon="book" style={{ marginBottom: 8 }}>
        <View style={{ position: "absolute", top: 9, left: 9 + 12, backgroundColor: book.isFree ? L.primary : "rgba(0,0,0,0.58)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>{book.isFree ? "BEPUL" : `${Math.floor(book.price / 1000)}k`}</Text>
        </View>
      </BookCover>
      <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: L.text, fontSize: 13, fontWeight: "700", lineHeight: 17 }}>{book.title}</Text>
      <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: L.textDim, fontSize: 11, marginTop: 2 }}>{book.authorName}</Text>
    </PressableScale>
  );
});

// ─── Genre row section ─────────────────────────────────────────────────────────
/** Title + "Barchasi" + a horizontal shelf of the books in one janr. */
const GenreRowSection = memo(function GenreRowSection({
  title,
  books,
  delay,
  onBook,
  onSeeAll,
  L,
}: {
  title: string;
  books: DisplayBook[];
  delay: number;
  onBook: (id: string) => void;
  onSeeAll: () => void;
  L: AppTheme;
}) {
  if (books.length === 0) return null;
  return (
    <>
      <FadeSlideIn
        delay={delay}
        distance={14}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingHorizontal: 20,
          marginBottom: SECTION_TITLE_GAP,
          marginTop: SECTION_GAP,
        }}
      >
        <Text style={{ color: L.text, fontSize: 20, fontWeight: "800", fontFamily: FONT.serif, letterSpacing: -0.4 }}>
          {title}
        </Text>
        <Text onPress={onSeeAll} style={{ color: L.primary, fontSize: 13, fontWeight: "600" }}>
          Barchasi
        </Text>
      </FadeSlideIn>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={GRID_CELL + GRID_GAP}
        contentContainerStyle={{ paddingHorizontal: GRID_PAD, gap: GRID_GAP, paddingBottom: ROW_BOTTOM_PAD }}
      >
        {books.map((book, index) => (
          <StaggeredCard key={book.id} index={index}>
            <BookGridCard book={book} onPress={() => onBook(book.id)} />
          </StaggeredCard>
        ))}
      </ScrollView>
    </>
  );
});

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonBox = memo(function SkeletonBox({ w, h, r = 12 }: { w: number | `${number}%`; h: number; r?: number }) {
  const { colors: L } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: L.surface, opacity: pulse }} />;
});

// ─── Style helpers ─────────────────────────────────────────────────────────────
// `paddingHorizontal: 20` matches the "Adabiyotlar" heading above, so the first
// chip of BOTH rows starts on the same line as the title. The vertical padding
// is what keeps the "Eng yangi" halo from being clipped by the horizontal
// ScrollView on Android — with 7 top and bottom the two rows sit 14pt apart,
// in proportion to the 10pt gap between chips.
const chipRowStyle = { paddingHorizontal: 20, paddingVertical: 7, gap: 10, alignItems: "center" as const };

const styles = StyleSheet.create({
  // No padding: any inset here would push the second row out of line with the
  // first. The glow bleeds outwards via negative insets instead.
  latestChipWrap: {},
  latestChipGlow: {
    position: "absolute",
    top: 0,
    left: 2,
    right: 2,
    bottom: 0,
    borderRadius: 20,
    shadowOpacity: 0.6,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  lastReadGlowFrame: {
    marginHorizontal: 13,
    padding: 3,
    borderRadius: 26,
    overflow: "visible",
  },
  lastReadGlowAura: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  lastReadGlowClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: "hidden",
  },
  lastReadGlowRotor: {
    position: "absolute",
    top: -170,
    right: -170,
    bottom: -170,
    left: -170,
  },
  lastReadGlowOrb: {
    position: "absolute",
    top: 118,
    right: 116,
    width: 168,
    height: 168,
    borderRadius: 84,
    opacity: 0.34,
  },
  lastReadGlowOrbAlt: {
    position: "absolute",
    bottom: 114,
    left: 116,
    width: 136,
    height: 136,
    borderRadius: 68,
    opacity: 0.24,
  },
  compactContinue: {
    marginHorizontal: 16,
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});

/**
 * One chip size for every chip in both rows.
 *
 * `height` (not paddingVertical) so a 13pt icon and a 14pt one can never make
 * two chips different heights, and min/maxWidth so the row reads as a set of
 * equal buttons instead of ragged text pills. Labels longer than `CHIP_MAX_W`
 * are truncated with "…" by the Text itself (`numberOfLines`), which is why the
 * width can be capped without breaking a long taxonomy name.
 */
const CHIP_HEIGHT = 40;
const CHIP_MIN_W = 108;
const CHIP_MAX_W = 164;

function chipBase(L: AppTheme) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingHorizontal: 14,
    height: CHIP_HEIGHT,
    minWidth: CHIP_MIN_W,
    maxWidth: CHIP_MAX_W,
    borderRadius: CHIP_HEIGHT / 2,
    borderWidth: 1.5,
    borderColor: L.border,
    backgroundColor: L.bgCard,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  };
}

/** Shared label style — `flexShrink` is what lets the "…" actually appear. */
const chipLabel = { fontSize: 12.5, flexShrink: 1 as const };

function lastReadCardBase(L: AppTheme, framed = false) {
  return {
    marginHorizontal: framed ? 0 : 16,
    backgroundColor: L.bgCard,
    borderRadius: 22,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: L.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  };
}

// ─── Home screen ───────────────────────────────────────────────────────────────
/**
 * Selector: on web ≥ 768px render the premium {@link WebHome}; otherwise the
 * native mobile home below, unchanged. Keeping this a thin wrapper (one hook)
 * means the mobile screen's hook order is never affected by the breakpoint.
 */
export default function HomeScreen() {
  console.log("[Home] ACTIVE HOME SCREEN");
  const { isWebLayout } = useResponsive();
  return isWebLayout ? <WebHome /> : <MobileHomeScreen />;
}

function MobileHomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();
  const { colors: L } = useTheme();
  const { appName } = useBranding();
  const { profile } = useProfile();
  const profileName = profile.displayName || profile.fullName || profile.penName || "Kitobxon";
  const firstName = profileName.split(" ")[0];

  const cW = Math.floor(sw * 0.62);
  const cH = Math.floor(cW * 1.46);
  const cGap = 14;
  const cPad = (sw - cW) / 2;
  const carouselStep = cW + cGap;

  const [activeCat, setActiveCat] = useState<Cat>(ALL_CHIP);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [lastBookId, setLastBookId] = useState<string | null>(null);
  const [lastBookProgress, setLastBookProgress] = useState(0);
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const { userId, refreshProfileRow } = useAuth();
  const { ad: homeHeroAd, collapsed: homeHeroAdCollapsed, setCollapsed: setHomeHeroAdCollapsed } = useHomeHeroAd();

  useEffect(() => { setHeaderAvatarError(false); }, [profile.avatarUrl]);
  const { count: unreadCount, refresh: refreshUnreadCount } = useUnreadNotificationCount();

  const { books: supaBooks, loading: booksLoading, refetch } = usePublishedBooks();
  const { genres } = useContentGenres();
  const { categories } = useContentCategories("book");
  const { cards: articleCards, refetch: refetchArticles } = useHomeArticleCards();
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchArticles(), refreshProfileRow(), refreshUnreadCount()]);
  }, [refetch, refetchArticles, refreshProfileRow, refreshUnreadCount]);
  const { refreshing, replayKey, onRefresh } = usePullToRefresh(handleRefresh);

  useFocusEffect(
    useCallback(() => {
      refreshProfileRow().catch(() => {});
      refreshUnreadCount().catch(() => {});
    }, [refreshProfileRow, refreshUnreadCount])
  );

  const ARTICLE_CARD_W = Math.floor(SW * 0.42);

  const titleOpacity = useRef(new Animated.Value(1)).current;
  const prevIdxRef = useRef(0);
  const carouselScrollRef = useRef<ScrollView>(null);
  const dragStartXRef = useRef(0);
  const lastCarouselIdxRef = useRef(0);
  const pageScrollRef = useRef<ScrollView>(null);
  // Where the "Adabiyotlar" block starts, so tapping "Eng yangi" can bring the
  // newest shelf into view instead of leaving it below the fold.
  const adabiyotlarYRef = useRef(0);

  const handleSelectCat = useCallback(
    (cat: Cat) => {
      setActiveCat(cat);
      if (cat !== LATEST_CHIP) return;
      // Land the section title just under the status bar, not behind it.
      pageScrollRef.current?.scrollTo({
        y: Math.max(0, adabiyotlarYRef.current - insets.top - 8),
        animated: true,
      });
    },
    [insets.top]
  );

  useEffect(() => {
    AsyncStorage.multiGet([
      userScopedKey("last_book_id", userId),
      userScopedKey("last_book_progress", userId),
    ])
      .then(([[, id], [, prog]]) => {
        // Reset on account switch — a new account has no reading history.
        setLastBookId(id ?? null);
        setLastBookProgress(prog ? parseFloat(prog) || 0 : 0);
      })
      .catch(() => {});
  }, [userId]);

  // "Eng yangi" is a frontend-only filter: `supaBooks` already arrives
  // newest-first (published_at desc, created_at as the fallback), so the latest
  // shelf is just the head of that list — no separate query, no mock data.
  const isLatestSelected = activeCat === LATEST_CHIP;
  const newBooks = useMemo(
    () => supaBooks.slice(0, isLatestSelected ? LATEST_CAROUSEL_LIMIT : CAROUSEL_LIMIT),
    [supaBooks, isLatestSelected]
  );

  const lastReadBook = useMemo(
    () => (lastBookId ? (supaBooks.find((b) => b.id === lastBookId) ?? null) : null),
    [lastBookId, supaBooks]
  );

  // Only offer a chip when at least one published book actually carries it, so
  // tapping a chip can never land on an empty shelf.
  const genreChips = useMemo(
    () => [
      ALL_CHIP,
      ...genres.filter((g) => supaBooks.some((b) => bookMatchesGenre(b, g))).map((g) => g.name),
    ],
    [genres, supaBooks]
  );

  // The "Eng yangi" chip is prepended separately (see `leading` on ChipRow) so it
  // always stays first, even before the taxonomy has loaded.
  const categoryChips = useMemo(
    () =>
      categories
        .filter((cat) => supaBooks.some((b) => bookMatchesCategory(b, cat)))
        .map((cat) => cat.name),
    [categories, supaBooks]
  );

  // One horizontal row per JANR (content_genres) that actually has published
  // books. Empty genres are dropped so no bare section ever renders. Hidden
  // while a chip filter is active — the filtered row above already answers it.
  const genreSections = useMemo(() => {
    if (activeCat !== ALL_CHIP && activeCat !== LATEST_CHIP) return [];
    return genres
      .map((genre) => ({ genre, books: supaBooks.filter((b) => bookMatchesGenre(b, genre)) }))
      .filter((section) => section.books.length > 0);
  }, [genres, supaBooks, activeCat]);

  const gridBooks = useMemo(() => {
    // "Eng yangi" only reorders the page — Top asarlar keeps its full shelf.
    if (activeCat === ALL_CHIP || activeCat === LATEST_CHIP) return supaBooks.slice(0, 8);

    const genre = genres.find((g) => g.name === activeCat);
    if (genre) return supaBooks.filter((b) => bookMatchesGenre(b, genre)).slice(0, 8);

    const category = categories.find((cat) => cat.name === activeCat);
    if (category) return supaBooks.filter((b) => bookMatchesCategory(b, category)).slice(0, 8);

    return [];
  }, [activeCat, supaBooks, genres, categories]);

  // The carousel remounts when it swaps between its default slot and the top of
  // the Adabiyotlar block, so start it back at the first (newest) book.
  useEffect(() => {
    setCarouselIdx(0);
    lastCarouselIdxRef.current = 0;
    carouselScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [isLatestSelected]);

  useEffect(() => {
    if (prevIdxRef.current === carouselIdx) return;
    prevIdxRef.current = carouselIdx;
    Animated.sequence([
      Animated.timing(titleOpacity, { toValue: 0.58, duration: 80, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [carouselIdx, titleOpacity]);

  const triggerCarouselHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const settleCarouselToIndex = useCallback(
    (idx: number, animated = true, haptic = false) => {
      if (newBooks.length === 0) return;
      const nextIdx = Math.max(0, Math.min(idx, newBooks.length - 1));
      const changed = nextIdx !== lastCarouselIdxRef.current;

      if (changed) {
        lastCarouselIdxRef.current = nextIdx;
        setCarouselIdx(nextIdx);
        if (haptic) triggerCarouselHaptic();
      }

      carouselScrollRef.current?.scrollTo({
        x: nextIdx * carouselStep,
        y: 0,
        animated,
      });
    },
    [carouselStep, newBooks.length, triggerCarouselHaptic]
  );

  const handleCarouselBeginDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragStartXRef.current = e.nativeEvent.contentOffset.x;
  }, []);

  const handleCarouselEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const startX = dragStartXRef.current;
      const delta = x - startX;
      const startIdx = Math.max(0, Math.min(Math.round(startX / carouselStep), newBooks.length - 1));
      const velocityX =
        (e.nativeEvent as NativeScrollEvent & { velocity?: { x?: number } }).velocity?.x ?? 0;
      const shouldAdvance = Math.abs(delta) > 18 || Math.abs(velocityX) > 0.08;
      const direction = delta === 0 ? Math.sign(velocityX) : Math.sign(delta);
      const nextIdx = shouldAdvance
        ? startIdx + (direction >= 0 ? 1 : -1)
        : Math.round(x / carouselStep);

      settleCarouselToIndex(nextIdx, true, true);
    },
    [carouselStep, newBooks.length, settleCarouselToIndex]
  );

  const handleCarouselMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      settleCarouselToIndex(Math.round(x / carouselStep), false);
    },
    [carouselStep, settleCarouselToIndex]
  );

  const onBook = useCallback((id: string) => {
    router.push({ pathname: "/book/[id]", params: { id } });
  }, []);

  const onArticle = useCallback((id: string) => {
    router.push({ pathname: "/article/[id]", params: { id } });
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long" });

  /**
   * The newest-books carousel. It lives in exactly ONE place at a time: at the
   * top of the Adabiyotlar block while "Eng yangi" is selected, in its usual
   * slot further down otherwise.
   */
  const renderLatestCarousel = () => {
    if (booksLoading && newBooks.length === 0) {
      return (
        <View style={{ paddingHorizontal: cPad, gap: cGap, flexDirection: "row" }}>
          {[0, 1, 2].map((i) => <SkeletonBox key={i} w={cW} h={cH} r={24} />)}
        </View>
      );
    }
    if (newBooks.length === 0) return null;
    return (
      <>
        <ScrollView
          ref={carouselScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={newBooks.map((_, i) => i * carouselStep)}
          disableIntervalMomentum
          decelerationRate="fast"
          style={{ height: cH }}
          contentContainerStyle={{ paddingHorizontal: cPad }}
          onScrollBeginDrag={handleCarouselBeginDrag}
          onScrollEndDrag={handleCarouselEndDrag}
          onMomentumScrollEnd={handleCarouselMomentumEnd}
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

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 12 }}>
          {newBooks.map((_, i) => (
            <View key={i} style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: L.surface }, i === carouselIdx && { width: 22, height: 6, backgroundColor: L.primary }]} />
          ))}
        </View>

        <Animated.View style={{ alignItems: "center", marginTop: 10, paddingHorizontal: 40, opacity: titleOpacity }}>
          <Text numberOfLines={1} style={{ color: L.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif, textAlign: "center", letterSpacing: -0.3 }}>{newBooks[carouselIdx]?.title ?? ""}</Text>
          <Text numberOfLines={1} style={{ color: L.primary, fontSize: 13, fontWeight: "600", marginTop: 4, textAlign: "center" }}>{newBooks[carouselIdx]?.authorName ?? ""}</Text>
        </Animated.View>
      </>
    );
  };

  return (
    <ScreenTransitionWrapper type="up" style={{ backgroundColor: L.bg }} replayKey={replayKey}>
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      <ScrollView
        ref={pageScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={L.primary}
            colors={[L.primary]}
            progressBackgroundColor={L.bgCard}
            progressViewOffset={insets.top}
          />
        }
      >

        {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
        <View style={{ paddingBottom: 18, paddingHorizontal: 20, paddingTop: insets.top + 16, backgroundColor: L.bg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <FadeSlideIn delay={80} distance={10}>
              <PressableScale onPress={() => router.push("/(tabs)/profile")} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, borderColor: L.primary, overflow: "hidden" }}>
                {profile.avatarUrl && !headerAvatarError ? (
                  <Image
                    source={{ uri: profile.avatarUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    onError={() => setHeaderAvatarError(true)}
                  />
                ) : (
                  <View style={{ width: "100%", height: "100%", backgroundColor: L.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", fontFamily: FONT.serif }}>
                      {getInitials(profileName)}
                    </Text>
                  </View>
                )}
              </PressableScale>
              </FadeSlideIn>
              <View style={{ marginLeft: 13 }}>
                <Text style={{ color: L.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>{dateStr}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
                  <TypingText
                    phrases={[`Salom, ${firstName}`]}
                    loop={false}
                    typingSpeed={45}
                    style={{ color: L.text, fontSize: 18, fontWeight: "700", fontFamily: FONT.serif }}
                  />
                  {(() => {
                    // Same badge as the profile page (combined author/creator).
                    const badgeType = resolveDisplayBadge(profile)?.type ?? profile.verificationType;
                    return badgeType !== "none" ? (
                      <VerificationBadge verificationType={badgeType} size="sm" />
                    ) : null;
                  })()}
                </View>
                <FadeSlideIn delay={480} distance={8}>
                <Text style={{ color: L.textDim, fontSize: 12, marginTop: 1 }}>{appName}da bugun nima o'qiysiz?</Text>
                </FadeSlideIn>
              </View>
            </View>
            <FadeSlideIn delay={170} distance={-10} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PressableScale style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: L.soft, alignItems: "center", justifyContent: "center" }} onPress={() => router.push("/(tabs)/tokcha")}>
                <Ionicons name="search" size={18} color={L.primary} />
              </PressableScale>
              <PressableScale style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: L.soft, alignItems: "center", justifyContent: "center" }} onPress={() => router.push("/notifications")}>
                <Ionicons name="notifications" size={18} color={L.primary} />
                {unreadCount > 0 ? (
                  <View style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: L.gold, borderWidth: 1.5, borderColor: L.bg }} />
                ) : null}
              </PressableScale>
            </FadeSlideIn>
          </View>
        </View>

        {/* ── LAST READ CARD ──────────────────────────────────────────────────── */}
        <FadeSlideIn delay={240} distance={20} style={{ marginTop: 0 }}>
          {homeHeroAd ? (
            <View style={{ gap: 10 }}>
              <View style={{ marginHorizontal: 16 }}>
                <HomeHeroAdCard
                  ad={homeHeroAd}
                  collapsed={homeHeroAdCollapsed}
                  onCollapsedChange={setHomeHeroAdCollapsed}
                  height={Math.max(180, Math.min(240, sw * 0.54))}
                />
              </View>
              <LastReadCard
                book={lastReadBook}
                progress={lastBookProgress}
                loading={booksLoading && !lastBookId}
                compact={!homeHeroAdCollapsed}
                onPress={() => lastBookId && onBook(lastBookId)}
              />
            </View>
          ) : (
          <LastReadCard
            book={lastReadBook}
            progress={lastBookProgress}
            loading={booksLoading && !lastBookId}
            onPress={() => lastBookId && onBook(lastBookId)}
          />
          )}
        </FadeSlideIn>

        {/* ── ADABIYOTLAR SECTION ─────────────────────────────────────────────── */}
        <View onLayout={(e) => { adabiyotlarYRef.current = e.nativeEvent.layout.y; }}>
          <FadeSlideIn delay={320} distance={14} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 20, marginBottom: SECTION_TITLE_GAP, marginTop: SECTION_GAP }}>
            <Text style={{ color: L.text, fontSize: 22, fontWeight: "800", fontFamily: FONT.serif, letterSpacing: -0.4 }}>Adabiyotlar</Text>
            <Text onPress={() => router.push("/kitoblar")} style={{ color: L.primary, fontSize: 13, fontWeight: "600" }}>Barcha asarlar</Text>
          </FadeSlideIn>
        </View>

        {/* ── JANR CHIPS (content_genres) ─────────────────────────────────────── */}
        {genreChips.length > 1 ? (
          <SlideFromLeft delay={380}>
            <ChipRow cats={genreChips} active={activeCat} onSelect={handleSelectCat} />
          </SlideFromLeft>
        ) : null}

        {/* ── KATEGORIYA CHIPS ("Eng yangi" + content_categories) ─────────────── */}
        <SlideFromRight delay={460}>
          <ChipRow
            cats={categoryChips}
            active={activeCat}
            onSelect={handleSelectCat}
            leading={
              <LatestChip
                active={isLatestSelected}
                onPress={() => handleSelectCat(isLatestSelected ? ALL_CHIP : LATEST_CHIP)}
              />
            }
          />
        </SlideFromRight>

        {/* ── ENG YANGI CAROUSEL (only while that chip is selected) ───────────── */}
        {isLatestSelected ? (
          <FadeSlideIn delay={80} distance={16} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 20, marginBottom: SECTION_TITLE_GAP }}>
              <Text style={{ color: L.text, fontSize: 20, fontWeight: "800", fontFamily: FONT.serif, letterSpacing: -0.4 }}>Eng yangi adabiyotlar</Text>
              <Text onPress={() => router.push("/kitoblar")} style={{ color: L.primary, fontSize: 13, fontWeight: "600" }}>Barchasi</Text>
            </View>
            {renderLatestCarousel()}
          </FadeSlideIn>
        ) : null}

        {/* ── BOOK GRID ────────────────────────────────────────────────────────── */}
        <FadeSlideIn delay={580} distance={14} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 20, marginBottom: SECTION_TITLE_GAP, marginTop: SECTION_GAP }}>
          <Text style={{ color: L.text, fontSize: 22, fontWeight: "800", fontFamily: FONT.serif, letterSpacing: -0.4 }}>Top asarlar</Text>
          <Text onPress={() => router.push("/kitoblar")} style={{ color: L.primary, fontSize: 13, fontWeight: "600" }}>Barchasi</Text>
        </FadeSlideIn>
        <View>
          {booksLoading && gridBooks.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={GRID_CELL + GRID_GAP}
              contentContainerStyle={{ paddingHorizontal: GRID_PAD, gap: GRID_GAP, paddingBottom: ROW_BOTTOM_PAD }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <View key={i} style={{ width: GRID_CELL }}>
                  <SkeletonBox w={GRID_CELL} h={GRID_IMG_H} r={10} />
                  <View style={{ marginTop: 6, gap: 4 }}>
                    <SkeletonBox w={GRID_CELL * 0.85} h={12} r={6} />
                    <SkeletonBox w={GRID_CELL * 0.6} h={10} r={6} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : gridBooks.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 22, gap: 8 }}>
              <MaterialCommunityIcons name="book-open-variant" size={32} color={L.textMuted} />
              <Text style={{ color: L.textMuted, fontSize: 13 }}>Bu kategoriyada kitoblar yo'q</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={GRID_CELL + GRID_GAP}
              contentContainerStyle={{ paddingHorizontal: GRID_PAD, gap: GRID_GAP, paddingBottom: ROW_BOTTOM_PAD }}
            >
              {gridBooks.map((book, index) => (
                <StaggeredCard key={book.id} index={index}>
                  <BookGridCard book={book} onPress={() => onBook(book.id)} />
                </StaggeredCard>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── JANRLAR BO‘YICHA ROW SECTIONLAR ──────────────────────────────── */}
        {genreSections.map((section, index) => (
          <GenreRowSection
            key={section.genre.id || section.genre.slug}
            title={section.genre.name}
            books={section.books}
            delay={620 + index * 60}
            onBook={onBook}
            onSeeAll={() => router.push(`/janrlar?genre=${encodeURIComponent(section.genre.slug)}`)}
            L={L}
          />
        ))}

        {/* ── CAROUSEL (default slot — moves up when "Eng yangi" is on) ───────── */}
        {isLatestSelected ? null : (
          <FadeSlideIn delay={520} distance={18} style={{ marginTop: SECTION_GAP }}>
            {renderLatestCarousel()}
          </FadeSlideIn>
        )}

        {/* ── MAQOLALAR (A4 ARTICLE CARDS) ────────────────────────────────────── */}
        {articleCards.length > 0 ? (
          <>
            <FadeSlideIn delay={600} distance={14} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 20, marginBottom: SECTION_TITLE_GAP, marginTop: SECTION_GAP }}>
              <Text style={{ color: L.text, fontSize: 22, fontWeight: "800", fontFamily: FONT.serif, letterSpacing: -0.4 }}>Maqolalar</Text>
              <Pressable onPress={() => router.push("/(tabs)/maqolalar")}>
                <Text style={{ color: L.primary, fontSize: 13, fontWeight: "600" }}>Barchasi</Text>
              </Pressable>
            </FadeSlideIn>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={ARTICLE_CARD_W + 14}
              contentContainerStyle={{ paddingHorizontal: GRID_PAD, gap: 14, paddingBottom: ROW_BOTTOM_PAD }}
            >
              {articleCards.map((card, index) => (
                <StaggeredCard key={card.id} index={index}>
                  <ArticleHomeCard card={card} width={ARTICLE_CARD_W} onPress={() => onArticle(card.id)} />
                </StaggeredCard>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* ── EXPLORE SHORTCUTS ─────────────────────────────────────────────── */}
        <FadeSlideIn delay={620} distance={14} style={{ marginTop: SECTION_GAP }}>
          <ExploreShortcutButtons />
        </FadeSlideIn>

      </ScrollView>
      <PullRefreshIndicator
        refreshing={refreshing}
        color={L.primary}
        top={insets.top + 8}
        surfaceColor={L.bgCard}
        borderColor={L.border}
      />
    </View>
    </ScreenTransitionWrapper>
  );
}
