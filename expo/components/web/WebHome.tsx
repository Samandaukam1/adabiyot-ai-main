import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FONT } from "@/components/ui";
import HomeHeroAdCard from "@/components/HomeHeroAdCard";
import { useHomeHeroAd } from "@/hooks/useHomeHeroAd";
import { useResponsive } from "@/hooks/useResponsive";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { useShelf } from "@/hooks/useShelf";
import { useTheme } from "@/providers/ThemeProvider";
import type { DisplayBook } from "@/types/database";
import { useHover } from "./useHover";
import WebBookCover from "./WebBookCover";
import WebBookGrid, { WebBookGridSkeleton } from "./WebBookGrid";
import WebContainer from "./WebContainer";
import WebFooter from "./WebFooter";
import WebSection from "./WebSection";
import WebSozlabRail from "./WebSozlabRail";
import { cursorPointer, hoverTransition, softShadow } from "./webStyle";

const RAIL_W = 344;
const COL_GAP = 36;

// ── Hero ────────────────────────────────────────────────────────────────────
function CtaButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          paddingHorizontal: 24,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: primary ? L.primary : L.bgCard,
          borderWidth: primary ? 0 : 1.5,
          borderColor: L.border,
        },
        primary ? softShadow(hovered) : null,
        hovered ? { transform: [{ translateY: -2 }] } : null,
        cursorPointer,
        hoverTransition,
      ]}
    >
      <Text style={{ color: primary ? "#fff" : L.text, fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

/** One tilted cover in the hero's faded background stack. */
function HeroCover({ book, index }: { book: DisplayBook | undefined; index: number }) {
  const rotations = [-9, 0, 9];
  const offsets = [-150, 0, 150];
  const z = [1, 3, 2];
  return (
    <View
      style={{
        position: "absolute",
        transform: [{ translateX: offsets[index] }, { rotate: `${rotations[index]}deg` }],
        zIndex: z[index],
      }}
    >
      <WebBookCover uri={book?.cover} width={214} size="large" />
    </View>
  );
}

function Hero({ books }: { books: DisplayBook[] }) {
  const { colors: L } = useTheme();
  const { isDesktopWeb } = useResponsive();
  const featured = books.slice(0, 3);

  return (
    <View
      style={{
        position: "relative",
        overflow: "hidden",
        paddingTop: isDesktopWeb ? 60 : 40,
        paddingBottom: isDesktopWeb ? 56 : 36,
        minHeight: isDesktopWeb ? 460 : undefined,
      }}
    >
      {/* Faded cover background on the right — sits BEHIND the text and dissolves
          into the page toward the copy, so the headline stays fully readable. */}
      {isDesktopWeb ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={{ position: "absolute", right: -10, top: 0, bottom: 0, width: "60%", alignItems: "center", justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <HeroCover key={i} index={i} book={featured[i]} />
            ))}
          </View>
          <LinearGradient
            colors={[L.bg, L.bg, "transparent"]}
            locations={[0, 0.4, 0.92]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      {/* Copy (on top of the covers) */}
      <View style={{ position: "relative", zIndex: 2, maxWidth: isDesktopWeb ? 560 : undefined }}>
        <View
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: L.soft,
            marginBottom: 22,
          }}
        >
          <MaterialCommunityIcons name="feather" size={15} color={L.primary} />
          <Text style={{ color: L.primary, fontSize: 13, fontWeight: "700" }}>Zamonaviy adabiyot platformasi</Text>
        </View>
        <Text
          style={{
            color: L.text,
            fontSize: isDesktopWeb ? 50 : 38,
            lineHeight: isDesktopWeb ? 56 : 44,
            fontWeight: "900",
            fontFamily: FONT.serif,
            letterSpacing: -1,
          }}
        >
          O'zbek adabiyoti uchun{"\n"}yangi raqamli makon
        </Text>
        <Text style={{ color: L.textDim, fontSize: 18, lineHeight: 28, marginTop: 20, maxWidth: 520 }}>
          Kitoblar, she'rlar, romanlar, ssenariylar, monologlar va ijodkorlar — barchasi bir platformada,
          chiroyli o'qish tajribasi bilan.
        </Text>
        <View style={{ flexDirection: "row", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
          <CtaButton label="O'qishni boshlash" primary onPress={() => router.push("/(tabs)/tokcha")} />
          <CtaButton label="Reelsni ko'rish" onPress={() => router.push("/(tabs)/reels")} />
        </View>
      </View>
    </View>
  );
}

// ── Categories ──────────────────────────────────────────────────────────────
const CATEGORIES: { label: string; icon: string; color: string }[] = [
  { label: "She'r", icon: "feather", color: "#D946EF" },
  { label: "Roman", icon: "book-open-page-variant", color: "#2563EB" },
  { label: "Hikoya", icon: "book-open-variant", color: "#0EA5E9" },
  { label: "Ssenariy", icon: "movie-open-outline", color: "#F97316" },
  { label: "Qissa", icon: "script-text-outline", color: "#A855F7" },
  { label: "Maqola", icon: "newspaper-variant-outline", color: "#14B8A6" },
  { label: "Darslik", icon: "school-outline", color: "#22C55E" },
  { label: "Ertak", icon: "magic-staff", color: "#EC4899" },
];

function CategoryTile({ label, icon, color, width }: { label: string; icon: string; color: string; width: number }) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={() => router.push(label === "Ssenariy" ? "/screenplays" : "/(tabs)/tokcha")}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          width,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: L.bgCard,
          borderWidth: 1,
          borderColor: hovered ? L.primary : L.border,
        },
        softShadow(hovered),
        hovered ? { transform: [{ translateY: -3 }] } : null,
        cursorPointer,
        hoverTransition,
      ]}
    >
      <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: color + "22" }}>
        <MaterialCommunityIcons name={icon as any} size={21} color={color} />
      </View>
      <Text style={{ color: L.text, fontSize: 14.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Categories({ availableWidth }: { availableWidth: number }) {
  const gap = 12;
  const cols = availableWidth > 880 ? 4 : availableWidth > 560 ? 3 : 2;
  const cardWidth = Math.floor((availableWidth - gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {CATEGORIES.map((c) => (
        <CategoryTile key={c.label} {...c} width={cardWidth} />
      ))}
    </View>
  );
}

// ── Web home ────────────────────────────────────────────────────────────────
/**
 * Premium desktop/tablet home. On desktop it is two columns: the hero + book
 * sections (left) and a full-height live So'zLab feed (right). Selected by the
 * HomeScreen wrapper only when `isWebLayout`, so the mobile home is untouched.
 */
export default function WebHome() {
  const { colors: L } = useTheme();
  const { width, contentMaxWidth, isTablet, isDesktopWeb, isLargeDesktop } = useResponsive();
  const { books, loading } = usePublishedBooks();
  const { ad: homeHeroAd, collapsed: homeHeroAdCollapsed, setCollapsed: setHomeHeroAdCollapsed } = useHomeHeroAd();

  const recommended = books.slice(0, 12);
  const top = books.slice(6, 18).length >= 6 ? books.slice(6, 18) : books.slice(0, 12);

  const pad = isTablet ? 24 : 40;
  const inner = Math.min(width, contentMaxWidth) - pad * 2;
  const twoCol = isDesktopWeb;
  const mainAvail = twoCol ? inner - RAIL_W - COL_GAP : inner;
  const mainCols = isLargeDesktop ? 4 : 3;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: L.bg }}>
      <WebContainer>
        <View style={{ flexDirection: twoCol ? "row" : "column", gap: COL_GAP, paddingTop: 8 }}>
          {/* LEFT: continue-reading bar + So'zLab feed (nudged down to line up
              with the categories block on the right) */}
          {twoCol ? (
            <View style={{ width: RAIL_W, gap: COL_GAP, paddingTop: 11 }}>
              {homeHeroAd ? (
                <View style={{ gap: 10 }}>
                  <HomeHeroAdCard
                    ad={homeHeroAd}
                    collapsed={homeHeroAdCollapsed}
                    onCollapsedChange={setHomeHeroAdCollapsed}
                    height={194}
                  />
                  <WebContinueCard compact={!homeHeroAdCollapsed} />
                </View>
              ) : (
                <WebContinueCard />
              )}
              <WebSozlabRail />
            </View>
          ) : null}

          {/* RIGHT: categories → hero → book sections */}
          <View style={{ flex: 1, minWidth: 0 }}>
            {/* Categories sit right under the menu, above the hero (no heading) */}
            <View style={{ paddingTop: 8, paddingBottom: 8 }}>
              <Categories availableWidth={mainAvail} />
            </View>

            {!twoCol && homeHeroAd ? (
              <View style={{ gap: 10, marginBottom: 18 }}>
                <HomeHeroAdCard
                  ad={homeHeroAd}
                  collapsed={homeHeroAdCollapsed}
                  onCollapsedChange={setHomeHeroAdCollapsed}
                  height={220}
                />
                <WebContinueCard compact={!homeHeroAdCollapsed} />
              </View>
            ) : null}

            <Hero books={books} />

            <View style={{ paddingTop: 20 }}>
              <WebSection
                title="Tavsiya etilgan kitoblar"
                subtitle="Tahririyat tanlagan, o'qishga arziydigan asarlar"
                actionLabel="Barchasini ko'rish"
                onAction={() => router.push("/(tabs)/tokcha")}
              >
                {loading && recommended.length === 0 ? (
                  <WebBookGridSkeleton count={mainCols * 2} />
                ) : recommended.length > 0 ? (
                  <WebBookGrid books={recommended} availableWidth={mainAvail} columns={mainCols} />
                ) : (
                  <EmptyRow text="Hozircha kitoblar yo'q" />
                )}
              </WebSection>

              {top.length > 0 ? (
                <WebSection
                  title="Top asarlar"
                  subtitle="Kitobxonlar eng ko'p o'qigan adabiyotlar"
                  actionLabel="Barchasini ko'rish"
                  onAction={() => router.push("/top-royxatlar")}
                >
                  <WebBookGrid books={top} availableWidth={mainAvail} columns={mainCols} />
                </WebSection>
              ) : null}

            </View>
          </View>
        </View>
      </WebContainer>

      <WebFooter />
    </ScrollView>
  );
}

// Rotating glow + pulsing aura behind the continue card — mirrors the mobile home.
function WebLastReadGlow({ children }: { children: React.ReactNode }) {
  const { colors: L, isDark } = useTheme();
  const spin = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6200, easing: Easing.linear, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ])
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [pulse, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const auraOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] });
  const gold = (L as any).gold ?? "#F4A261";

  return (
    <View style={{ padding: 3, borderRadius: 26 }}>
      <Animated.View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 26,
          backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.1)",
          shadowColor: L.primary,
          shadowOpacity: 0.34,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
          opacity: auraOpacity,
        }}
      />
      <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, borderRadius: 26, overflow: "hidden" }}>
        <Animated.View style={{ position: "absolute", top: -170, right: -170, bottom: -170, left: -170, transform: [{ rotate }] }}>
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
          <View style={{ position: "absolute", top: 118, right: 116, width: 168, height: 168, borderRadius: 84, opacity: 0.34, backgroundColor: L.primary }} />
          <View style={{ position: "absolute", bottom: 114, left: 116, width: 136, height: 136, borderRadius: 68, opacity: 0.24, backgroundColor: gold }} />
        </Animated.View>
      </View>
      {children}
    </View>
  );
}

// Web "Davom etamizmi?" continue-reading card — mirrors the mobile home card.
// Height (176) + glow padding (2×3) = 182 = the 2-row categories block on the left.
function WebContinueCard({ compact = false }: { compact?: boolean }) {
  const { colors: L } = useTheme();
  const { reading } = useShelf();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const item = reading[0];
  if (!item) return null;

  const pct = Math.max(0, Math.min(100, Math.round((item.progress ?? 0) * 100)));
  const open = () => {
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
        router.push(`/rich-reader/${item.contentId}`);
    }
  };

  if (compact) {
    return (
      <Pressable
        onPress={open}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        style={[
          { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 17, backgroundColor: L.bgCard, borderWidth: 1, borderColor: L.border },
          softShadow(hovered),
          cursorPointer,
          hoverTransition,
        ]}
      >
        <MaterialCommunityIcons name="book-open-page-variant" size={18} color={L.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: L.primary, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Davom etamizmi?</Text>
          <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "800", marginTop: 1 }}>{item.title || "Nomsiz asar"}</Text>
        </View>
        <Text style={{ color: L.primary, fontSize: 12, fontWeight: "800" }}>{pct}%  →</Text>
      </Pressable>
    );
  }

  return (
    <WebLastReadGlow>
      <Pressable
        onPress={open}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        style={[
          {
            minHeight: 130,
            flexDirection: "row",
            gap: 12,
            padding: 12,
            borderRadius: 20,
            backgroundColor: L.bgCard,
            borderWidth: 1,
            borderColor: L.border,
          },
          softShadow(hovered),
          cursorPointer,
          hoverTransition,
        ]}
      >
        <View style={{ width: 74, height: 104, borderRadius: 11, overflow: "hidden", backgroundColor: L.soft }}>
          {item.cover ? (
            <Image source={{ uri: item.cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="book" size={24} color={L.primary} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, justifyContent: "center", gap: 6 }}>
          <Text style={{ color: L.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.9, textTransform: "uppercase" }}>
            Davom etamizmi?
          </Text>
          <Text numberOfLines={2} style={{ color: L.text, fontSize: 15, fontWeight: "800", lineHeight: 19, fontFamily: FONT.serif }}>
            {item.title || "Nomsiz asar"}
          </Text>
          {item.author ? (
            <Text numberOfLines={1} style={{ color: L.textDim, fontSize: 12 }}>{item.author}</Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: L.surface, overflow: "hidden" }}>
              <View style={{ height: "100%", width: `${Math.max(4, pct)}%`, backgroundColor: L.primary, borderRadius: 2 }} />
            </View>
            <Text style={{ color: L.primary, fontSize: 10.5, fontWeight: "800", minWidth: 26, textAlign: "right" }}>{pct}%</Text>
          </View>
          <View style={{ alignSelf: "flex-start", backgroundColor: L.primary, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 9 }}>
            <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "800" }}>Davom etish →</Text>
          </View>
        </View>
      </Pressable>
    </WebLastReadGlow>
  );
}

function EmptyRow({ text }: { text: string }) {
  const { colors: L } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 }}>
      <MaterialCommunityIcons name="book-open-variant" size={34} color={L.textMuted} />
      <Text style={{ color: L.textMuted, fontSize: 15 }}>{text}</Text>
    </View>
  );
}
