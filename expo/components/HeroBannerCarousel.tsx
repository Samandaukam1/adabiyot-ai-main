import { Image } from "expo-image";
import { router } from "expo-router";
import { BookOpen } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { FONT, PressableScale } from "@/components/ui";
import { useBanners } from "@/hooks/useBanners";
import type { MobileHomeBanner } from "@/types/banner";

const WIDE_BP       = 700;
const GRID_GAP      = 14;
const H_PAD         = 40;
const AUTO_SLIDE_MS = 4000;
const BANNER_H      = 244;

// Module-level constant — never changes on mobile, used as FlatList base
const INITIAL_W = Dimensions.get("window").width;

const FALLBACK_BANNER: MobileHomeBanner = {
  id: "__fallback__",
  badge_text: "BESTSELLER KITOBLAR",
  title: "Maxsus\nTaklif",
  subtitle: "40% gacha chegirma",
  description: null,
  button_text: "Ko'rish",
  button_action_type: "none",
  button_link: null,
  related_content_type: null,
  related_content_id: null,
  image_url: null,
  background_color: "#2E7D32",
  text_color: "#FFFFFF",
  button_bg_color: "#FFFFFF",
  button_text_color: "#2E7D32",
  enable_glow: true,
  glow_primary_color: "#2E7D32",
  glow_secondary_color: "#D6A84F",
  sort_order: 0,
  created_at: "",
  views_count: 0,
  clicks_count: 0,
};

function hexToRgba(hex: string, alpha: number): string {
  try {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) throw new Error();
    return `rgba(${r},${g},${b},${alpha})`;
  } catch {
    return `rgba(46,125,50,${alpha})`;
  }
}

function handleBannerPress(banner: MobileHomeBanner) {
  try {
    const { button_action_type: t, button_link, related_content_id: rid } = banner;
    switch (t) {
      case "link":       if (button_link) Linking.openURL(button_link).catch(() => {}); break;
      case "book":       if (rid) router.push(`/book/${rid}`); break;
      case "article":    if (rid) router.push(`/article/${rid}`); break;
      case "poem":       if (rid) router.push(`/poem/${rid}`); break;
      case "screenplay": if (rid) router.push(`/screenplay/${rid}`); break;
      case "reel":
        router.push({
          pathname: "/(tabs)/reels",
          params: rid ? { reelId: rid } : undefined,
        });
        break;
      case "author":     if (rid) router.push(`/author/${rid}`); break;
      case "publisher":  if (rid) router.push(`/publisher/${rid}`); break;
      default: break;
    }
  } catch { /* silently ignore */ }
}

// ─── BannerCard ─────────────────────────────────────────────────────────────

const BannerCard = memo(function BannerCard({
  item,
  cardWidth,
  cardHeight,
  ownGlow = false,
}: {
  item: MobileHomeBanner;
  cardWidth: number;
  cardHeight: number;
  ownGlow?: boolean;
}) {
  const glowOpacity = useRef(new Animated.Value(0.5)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (animRef.current) animRef.current.stop();
    if (!ownGlow || !item.enable_glow) return;

    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.88,
          duration: 2600,
          useNativeDriver: false, // opacity on View is safer with false on web
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.38,
          duration: 2600,
          useNativeDriver: false,
        }),
      ])
    );
    animRef.current.start();
    return () => { animRef.current?.stop(); };
  // item.id ensures animation restarts only if a different banner, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, ownGlow]);

  const bgColor       = item.background_color  ?? "#2E7D32";
  const textColor     = item.text_color        ?? "#FFFFFF";
  const btnBg         = item.button_bg_color   ?? "#FFFFFF";
  const btnTextColor  = item.button_text_color ?? "#2E7D32";
  const glowPrimary   = item.glow_primary_color   ?? "#2E7D32";
  const glowSecondary = item.glow_secondary_color ?? "#D6A84F";

  const showImage  = !!item.image_url && cardWidth >= 300;
  const imgScale   = Math.min(1, cardWidth / 335);
  const imgW       = Math.round(148 * imgScale);
  const imgH       = Math.round(224 * imgScale);
  const titleSize  = cardWidth >= 400 ? 34 : cardWidth >= 320 ? 26 : 20;
  const titleLineH = Math.round(titleSize * 1.15);
  const paddingL   = cardWidth >= 320 ? 28 : 18;

  return (
    <View style={{ width: cardWidth }}>
      {/* Per-card glow (wide mode) */}
      {ownGlow && item.enable_glow ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ownGlow1,
              { backgroundColor: hexToRgba(glowPrimary, 0.2), width: cardWidth - 12, opacity: glowOpacity },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ownGlow2,
              { backgroundColor: hexToRgba(glowSecondary, 0.13), width: cardWidth - 24, opacity: glowOpacity },
            ]}
          />
        </>
      ) : null}

      <View style={[styles.bannerCard, { backgroundColor: bgColor, height: cardHeight }]}>
        <View style={styles.circleL} />
        <View style={styles.circleR} />

        <View style={[styles.bannerLeft, { paddingLeft: paddingL }, !showImage && styles.bannerLeftFull]}>
          {item.badge_text ? (
            <View style={styles.badge}>
              <BookOpen color="rgba(255,255,255,0.85)" size={10} strokeWidth={2.5} />
              <Text style={styles.badgeText}>{item.badge_text}</Text>
            </View>
          ) : null}

          <Text
            style={[styles.bannerTitle, { color: textColor, fontSize: titleSize, lineHeight: titleLineH }]}
            numberOfLines={3}
          >
            {item.title}
          </Text>

          {item.subtitle ? (
            <Text style={[styles.bannerSubtitle, { color: textColor }]} numberOfLines={2}>
              {item.subtitle}
            </Text>
          ) : null}

          {item.button_text ? (
            <PressableScale
              onPress={() => handleBannerPress(item)}
              style={[styles.ctaBtn, { backgroundColor: btnBg }]}
            >
              <Text style={[styles.ctaText, { color: btnTextColor }]}>{item.button_text}</Text>
            </PressableScale>
          ) : null}
        </View>

        {showImage ? (
          <View style={[styles.bannerRight, { width: imgW + 20 }]}>
            <Image
              source={{ uri: item.image_url! }}
              style={{ width: imgW, height: Math.min(imgH, cardHeight - 10) }}
              contentFit="contain"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});

// ─── BannerSkeleton ──────────────────────────────────────────────────────────

function BannerSkeleton({ cardH }: { cardH: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.8] });

  return (
    <View style={styles.carouselWrap}>
      <Animated.View style={[styles.skeleton, { height: cardH, opacity }]} />
      <View style={styles.dotsRow}>
        {[0, 1, 2].map((i) => <View key={i} style={styles.dot} />)}
      </View>
    </View>
  );
}

// ─── HeroBannerCarousel ──────────────────────────────────────────────────────

export default function HeroBannerCarousel() {
  // useWindowDimensions for responsive detection only — value stored in ref
  // to prevent dependency cascade in callbacks
  const { width: screenW } = useWindowDimensions();
  const screenWRef = useRef(INITIAL_W);
  screenWRef.current = screenW; // sync on every render, no setState called

  const { banners, loading } = useBanners();
  const [activeDot, setActiveDot]   = useState(0);
  const flatRef     = useRef<FlatList<MobileHomeBanner>>(null);
  const currentIdx  = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Narrow-mode glow animation — single shared instance
  const glowOpacity = useRef(new Animated.Value(0.5)).current;
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const displayBanners  = banners.length > 0 ? banners : [FALLBACK_BANNER];
  const isWide          = screenW >= WIDE_BP;

  // Store in refs so interval callbacks always see latest values without
  // being recreated on every render (breaks the dependency cascade)
  const displayBannersRef = useRef(displayBanners);
  displayBannersRef.current = displayBanners;
  const isWideRef = useRef(isWide);
  isWideRef.current = isWide;

  // ── Narrow glow ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (glowAnimRef.current) glowAnimRef.current.stop();
    if (isWide) return;

    glowAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.9, duration: 2600, useNativeDriver: false }),
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 2600, useNativeDriver: false }),
      ])
    );
    glowAnimRef.current.start();
    return () => { glowAnimRef.current?.stop(); };
  }, [glowOpacity, isWide]); // only re-run when layout mode changes

  // ── goToIndex — STABLE (no deps, uses refs) ───────────────────────────────
  const goToIndex = useCallback((idx: number, animated = true) => {
    try {
      flatRef.current?.scrollToOffset({ offset: idx * screenWRef.current, animated });
    } catch { /* not mounted */ }
    currentIdx.current = idx;
    setActiveDot(idx);
  }, []); // intentionally empty — all mutable state via refs

  // ── startAutoSlide — stable (uses refs internally) ────────────────────────
  const startAutoSlide = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isWideRef.current) return;             // no auto-slide in wide mode
    if (displayBannersRef.current.length <= 1) return;

    intervalRef.current = setInterval(() => {
      const next = (currentIdx.current + 1) % displayBannersRef.current.length;
      goToIndex(next);
    }, AUTO_SLIDE_MS);
  }, [goToIndex]); // goToIndex is stable → startAutoSlide is also stable

  // ── Start/stop auto-slide when layout or banner count changes ─────────────
  useEffect(() => {
    startAutoSlide();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startAutoSlide, isWide, displayBanners.length]);
  // isWide and displayBanners.length are explicit triggers (not inside startAutoSlide)

  // ── onMomentumScrollEnd — stable ─────────────────────────────────────────
  const onMomentumScrollEnd = useCallback((event: any) => {
    const idx = Math.round(event.nativeEvent.contentOffset.x / screenWRef.current);
    const clamped = Math.max(0, Math.min(idx, displayBannersRef.current.length - 1));
    if (clamped !== currentIdx.current) {
      currentIdx.current = clamped;
      setActiveDot(clamped);
      startAutoSlide(); // restart timer after manual swipe
    }
  }, [startAutoSlide]); // startAutoSlide is stable → this is stable too

  // ── FlatList helpers — stable ─────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: MobileHomeBanner }) => (
    <View style={{ width: screenWRef.current, paddingHorizontal: 20 }}>
      <BannerCard
        item={item}
        cardWidth={screenWRef.current - H_PAD}
        cardHeight={BANNER_H}
        ownGlow={false}
      />
    </View>
  ), []); // stable — reads screenWRef.current at call time

  const keyExtractor = useCallback((item: MobileHomeBanner) => item.id, []);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: INITIAL_W,          // use module-level constant for layout calc
    offset: INITIAL_W * index,
    index,
  }), []);

  if (loading) return <BannerSkeleton cardH={isWide ? 210 : BANNER_H} />;

  // ── WIDE: horizontal ScrollView (like "Top Adabiyotlar") ──────────────────
  if (isWide) {
    const wCardW = Math.min(440, Math.max(300, Math.round(screenW * 0.3)));
    const wCardH = wCardW >= 380 ? 220 : 196;

    return (
      <View style={styles.carouselWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={Platform.OS === "web"}
          contentContainerStyle={styles.wideScrollContent}
          decelerationRate="fast"
        >
          {displayBanners.map((item) => (
            <BannerCard key={item.id} item={item} cardWidth={wCardW} cardHeight={wCardH} ownGlow />
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── NARROW: single-card carousel with auto-slide ──────────────────────────
  const activeBanner  = displayBanners[activeDot] ?? displayBanners[0];
  const showGlow      = activeBanner?.enable_glow ?? true;
  const glowPrimary   = activeBanner?.glow_primary_color  ?? "#2E7D32";
  const glowSecondary = activeBanner?.glow_secondary_color ?? "#D6A84F";

  return (
    <View style={styles.carouselWrap}>
      {showGlow ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowRing1,
              { backgroundColor: hexToRgba(glowPrimary, 0.2), opacity: glowOpacity },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowRing2,
              { backgroundColor: hexToRgba(glowSecondary, 0.13), opacity: glowOpacity },
            ]}
          />
        </>
      ) : null}

      <FlatList
        ref={flatRef}
        data={displayBanners}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces={false}
        removeClippedSubviews={false}
        initialNumToRender={3}
      />

      <View style={styles.dotsRow}>
        {displayBanners.map((_, i) => (
          <Pressable
            key={i}
            hitSlop={8}
            onPress={() => { goToIndex(i); startAutoSlide(); }}
          >
            <View style={[styles.dot, activeDot === i && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  carouselWrap: { marginBottom: 8 },

  // Wide scroll
  wideScrollContent: {
    paddingHorizontal: 20,
    gap: GRID_GAP,
    alignItems: "flex-start",
  },

  // Per-card glow (wide mode)
  ownGlow1: {
    position: "absolute",
    top: 8,
    left: 6,
    height: "110%",
    borderRadius: 36,
  },
  ownGlow2: {
    position: "absolute",
    top: 14,
    left: 12,
    height: "100%",
    borderRadius: 30,
  },

  // Narrow-mode shared glow (matches card at 20px inset)
  glowRing1: {
    position: "absolute",
    top: 8,
    left: 14,
    right: 14,
    height: BANNER_H + 12,
    borderRadius: 36,
  },
  glowRing2: {
    position: "absolute",
    top: 14,
    left: 22,
    right: 22,
    height: BANNER_H + 4,
    borderRadius: 30,
  },

  // Banner card
  bannerCard: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  circleL: {
    position: "absolute",
    top: -58,
    left: 96,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  circleR: {
    position: "absolute",
    bottom: -48,
    right: 44,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(255,255,255,0.045)",
  },

  bannerLeft: {
    flex: 1,
    paddingRight: 10,
    paddingVertical: 26,
    zIndex: 2,
  },
  bannerLeftFull: { paddingRight: 26 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  bannerTitle: {
    fontWeight: "800",
    fontFamily: FONT.serif,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.72,
    marginBottom: 18,
  },
  ctaBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  ctaText: { fontSize: 13, fontWeight: "800" },

  bannerRight: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    zIndex: 2,
  },

  // Skeleton
  skeleton: {
    marginHorizontal: 20,
    borderRadius: 28,
    backgroundColor: "rgba(46,125,50,0.15)",
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(46,125,50,0.22)",
  },
  dotActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2E7D32",
  },
});
