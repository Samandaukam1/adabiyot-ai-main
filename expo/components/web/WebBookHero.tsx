import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { FONT } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";
import WebBookCover from "./WebBookCover";
import { useHover } from "./useHover";
import { cursorPointer, hoverTransition, softShadow } from "./webStyle";

export interface WebBookHeroChip {
  key: string;
  icon?: React.ReactNode;
  text: string;
  highlight?: boolean;
}

export interface WebBookHeroProps {
  cover?: string | null;
  category: string;
  title: string;
  author?: string;
  onAuthorPress?: () => void;
  description?: string;
  chips: WebBookHeroChip[];
  primaryLabel: string;
  onPrimary: () => void;
  audioLabel?: string | null;
  onAudio?: () => void;
  priceLabel?: string | null;
  aiHint?: string;
  onAiPress?: () => void;
  onBack?: () => void;
  headerActions?: React.ReactNode;
}

/**
 * WebBookHero — a cinematic, "movie-poster" hero for the book detail page on the
 * web (≥768px). Inspired by streaming-service title pages: all copy (badge,
 * title, author, meta, description and the read / audio CTAs) sits on the LEFT,
 * while the book cover is enlarged and turned into a real 3-D hardback on the
 * RIGHT — the same tilted treatment used on the web home hero. A soft green
 * light blooms from the bottom-left corner, and a blurred copy of the cover
 * bleeds behind the poster for colour.
 *
 * Web-only: it is rendered only when `isWebLayout` is true, so the native phone
 * layout is never touched.
 */
export default function WebBookHero({
  cover,
  category,
  title,
  author,
  onAuthorPress,
  description,
  chips,
  primaryLabel,
  onPrimary,
  audioLabel,
  onAudio,
  priceLabel,
  aiHint = "Jaxongir AI'dan kitob haqida so'rang",
  onAiPress,
  onBack,
  headerActions,
}: WebBookHeroProps) {
  const { colors: c, isDark } = useTheme();
  const { isDesktopWeb, isLargeDesktop } = useResponsive();

  const coverW = isLargeDesktop ? 340 : isDesktopWeb ? 300 : 232;
  const glow = isDark ? "rgba(56,239,125,0.20)" : "rgba(46,125,50,0.16)";

  return (
    <View
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: isDesktopWeb ? 560 : 460,
        backgroundColor: c.bg,
      }}
    >
      {/* ── Cinematic backdrop ──────────────────────────────────────────── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Blurred cover bleeding in from the right, for colour behind the poster. */}
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "58%" }}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 26 : 44}
          />
        ) : null}
        {/* Fade the bleed into the page background toward the copy (left). */}
        <LinearGradient
          colors={[c.bg, c.bg, "transparent"]}
          locations={[0, 0.42, 0.95]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Darken/soften the top so the header controls stay legible. */}
        <LinearGradient
          colors={[isDark ? "rgba(13,17,23,0.55)" : "rgba(245,241,234,0.55)", "transparent"]}
          locations={[0, 0.5]}
          style={StyleSheet.absoluteFill}
        />
        {/* Green "light ray" blooming from the bottom-left corner. */}
        <LinearGradient
          colors={[glow, "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0.62, y: 0.15 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── Top bar (back + actions) ────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          style={[styles.iconBtn, { backgroundColor: isDark ? "rgba(28,33,40,0.92)" : "rgba(255,255,255,0.92)", borderColor: c.border }, cursorPointer]}
        >
          <ArrowLeft color={c.text} size={20} />
        </Pressable>
        {headerActions}
      </View>

      {/* ── Content: copy (left) + 3-D poster (right) ───────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 40,
          paddingHorizontal: isDesktopWeb ? 64 : 40,
          paddingTop: isDesktopWeb ? 12 : 8,
          paddingBottom: isDesktopWeb ? 56 : 40,
          maxWidth: 1320,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {/* LEFT — copy */}
        <View style={{ flex: 1, minWidth: 300, maxWidth: 620, zIndex: 2 }}>
          <View style={[styles.badge, { backgroundColor: isDark ? "rgba(244,162,97,0.15)" : "#FFF4D6", borderColor: isDark ? "rgba(244,162,97,0.35)" : "#D6A84F" }]}>
            <Text style={[styles.badgeText, { color: isDark ? "#F4A261" : "#A87500" }]}>{category.toUpperCase()}</Text>
          </View>

          <Text
            style={{
              color: c.text,
              fontSize: isDesktopWeb ? 52 : 38,
              lineHeight: isDesktopWeb ? 58 : 44,
              fontFamily: FONT.serif,
              fontWeight: "800",
              letterSpacing: -1,
              marginTop: 16,
            }}
          >
            {title}
          </Text>

          {author ? (
            <Pressable onPress={onAuthorPress} style={[{ alignSelf: "flex-start", marginTop: 10 }, cursorPointer]}>
              <Text style={{ color: c.primary, fontSize: 17, fontWeight: "700" }}>{author}</Text>
            </Pressable>
          ) : null}

          {/* Meta chips */}
          {chips.length > 0 ? (
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <View
                  key={chip.key}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: chip.highlight
                        ? isDark
                          ? "rgba(82,183,136,0.16)"
                          : "rgba(232,245,233,0.9)"
                        : isDark
                        ? "rgba(28,33,40,0.72)"
                        : "rgba(255,255,255,0.78)",
                      borderColor: c.border,
                    },
                  ]}
                >
                  {chip.icon}
                  <Text style={{ color: chip.highlight ? c.primary : c.textDim, fontSize: 13, fontWeight: chip.highlight ? "700" : "500" }} numberOfLines={1}>
                    {chip.text}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {description ? (
            <Text style={{ color: c.textDim, fontSize: 16, lineHeight: 25, marginTop: 18, maxWidth: 560 }} numberOfLines={3}>
              {description}
            </Text>
          ) : null}

          {/* CTAs */}
          <View style={{ flexDirection: "row", gap: 14, marginTop: 26, flexWrap: "wrap", alignItems: "center" }}>
            <HeroPrimaryButton label={primaryLabel} onPress={onPrimary} />
            {audioLabel && onAudio ? <HeroSecondaryButton label={audioLabel} onPress={onAudio} c={c} isDark={isDark} /> : null}
            {priceLabel ? (
              <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: "700" }}>{priceLabel}</Text>
            ) : null}
          </View>

          {onAiPress ? (
            <Pressable onPress={onAiPress} style={[{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22 }, cursorPointer]}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
              <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: "600" }}>{aiHint}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* RIGHT — 3-D tilted poster */}
        <View style={{ flexGrow: 1, alignItems: "center", justifyContent: "center", minWidth: coverW + 40, zIndex: 2 }}>
          <HeroPoster cover={cover} width={coverW} />
        </View>
      </View>
    </View>
  );
}

/** The enlarged 3-D hardback. Tilts on a perspective; straightens on hover. */
function HeroPoster({ cover, width }: { cover?: string | null; width: number }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const transform = hovered
    ? ([{ perspective: 1600 }, { rotateY: "-8deg" }, { rotateZ: "0deg" }, { translateY: -8 }] as any)
    : ([{ perspective: 1600 }, { rotateY: "-19deg" }, { rotateX: "3deg" }, { rotateZ: "1.5deg" }] as any);
  return (
    <Pressable onHoverIn={onHoverIn} onHoverOut={onHoverOut} style={[{ transform }, hoverTransition, cursorPointer]}>
      <WebBookCover uri={cover} width={width} size="large" />
    </Pressable>
  );
}

function HeroPrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable onPress={onPress} onHoverIn={onHoverIn} onHoverOut={onHoverOut} style={[hovered ? { transform: [{ translateY: -2 }] } : null, hoverTransition, cursorPointer]}>
      <LinearGradient
        colors={["#11998E", "#38EF7D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          },
          softShadow(hovered),
          { shadowColor: "#11998E", shadowOpacity: hovered ? 0.5 : 0.35 },
        ]}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function HeroSecondaryButton({ label, onPress, c, isDark }: { label: string; onPress: () => void; c: AppTheme; isDark: boolean }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          paddingHorizontal: 24,
          paddingVertical: 15,
          borderRadius: 14,
          backgroundColor: isDark ? "rgba(28,33,40,0.72)" : "rgba(255,255,255,0.82)",
          borderWidth: 1.5,
          borderColor: c.border,
        },
        hovered ? { transform: [{ translateY: -2 }], borderColor: c.borderStrong } : null,
        hoverTransition,
        cursorPointer,
      ]}
    >
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    zIndex: 5,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
