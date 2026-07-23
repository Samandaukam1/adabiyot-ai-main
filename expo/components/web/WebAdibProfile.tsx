import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, ChevronRight, Send, Sparkles } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FONT } from "@/components/ui";
import LiderlarCredit from "@/components/LiderlarCredit";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/providers/ThemeProvider";
import {
  articleSectionsFor,
  biographyBlocks,
  factsFor,
} from "@/lib/adibContent";
import type { AppTheme } from "@/constants/colors";
import type { AdibEntry } from "@/types/community";
import { getInitials } from "@/types/profile";
import { openExternalUrl } from "@/utils/safeLinks";
import { cursorPointer, hoverTransition } from "./webStyle";
import { useHover } from "./useHover";

/* The cinematic hero is always dark (a portrait reads best on charcoal, like a
   movie-poster title page), regardless of the app theme. The editorial body
   below stays theme-aware so it reads cleanly in light and dark. */
const HERO_BG = "#111418";
const HERO_INK = "#F5F1EA";
const HERO_INK_DIM = "rgba(245,241,234,0.62)";
const HERO_LINE = "rgba(245,241,234,0.16)";
const HERO_GREEN = "#52B788";

/**
 * WebAdibProfile — a premium, editorial "hall of fame" profile for the writers'
 * encyclopedia on the web (≥768px). A cinematic dark hero puts the portrait on
 * the left and, on the right, the name in large serif, the pen name, a short
 * bio and a numbered index of the article sections (the reader can jump to any
 * of them). Below, the biography and sections are laid out like a magazine.
 *
 * Web-only: the phone keeps its own layout, so mobile is untouched.
 */
export default function WebAdibProfile({ adib }: { adib: AdibEntry }) {
  const { colors: c, isDark } = useTheme();
  const { isDesktopWeb, isLargeDesktop } = useResponsive();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const facts = useMemo(() => factsFor(adib), [adib]);
  const bio = useMemo(() => biographyBlocks(adib), [adib]);
  const sections = useMemo(() => articleSectionsFor(adib), [adib]);

  const handle = adib.adabiyotxUsername ? `@${adib.adabiyotxUsername.replace(/^@+/, "")}` : null;
  const telegram = adib.telegramUsername ? `@${adib.telegramUsername.replace(/^@+/, "")}` : null;

  // Jump-to-section: capture each section's Y as it lays out, then scroll to it.
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const scrollTo = useCallback((key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 90, 0), animated: true });
  }, []);

  const portraitW = isLargeDesktop ? 340 : isDesktopWeb ? 300 : 240;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: c.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ───────────────────────── Cinematic hero ───────────────────────── */}
      <View style={styles.hero}>
        {/* Backdrop: the portrait bled in on the right for colour, plus dark
            gradients and a green corner glow. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {adib.photoUrl ? (
            <Image
              source={{ uri: adib.photoUrl }}
              style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "55%" }}
              contentFit="cover"
              blurRadius={Platform.OS === "web" ? 22 : 40}
            />
          ) : null}
          <LinearGradient
            colors={[HERO_BG, HERO_BG, "transparent"]}
            locations={[0, 0.4, 0.95]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", "rgba(17,20,24,0.7)", HERO_BG]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(82,183,136,0.18)", "transparent"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.6, y: 0.1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Back button */}
        <View style={styles.heroTopBar}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, cursorPointer]}>
            <ArrowLeft color={HERO_INK} size={20} />
          </Pressable>
          <Text style={styles.eyebrow}>ADIBLAR ENSIKLOPEDIYASI</Text>
        </View>

        {/* Content: portrait (left) + copy (right) */}
        <View style={[styles.heroInner, { paddingHorizontal: isDesktopWeb ? 64 : 40 }]}>
          <View style={{ alignItems: "center", gap: 22 }}>
            <Portrait uri={adib.photoUrl} name={adib.fullName} width={portraitW} />

            {/* "Hello" contact block, like the reference's bottom-left card. */}
            <View style={styles.contactBlock}>
              <Text style={styles.contactHello}>Aloqa</Text>
              <View style={styles.contactRule} />
              {handle ? <Text style={styles.contactLine}>{handle}</Text> : null}
              {telegram ? (
                <Pressable
                  onPress={() => openTelegram(adib.telegramUsername)}
                  style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, cursorPointer]}
                >
                  <Send color={HERO_GREEN} size={12} />
                  <Text style={[styles.contactLine, { color: HERO_GREEN }]}>{telegram}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.heroCopy}>
            {adib.roles.length ? <Text style={styles.roleBadge}>{adib.roles.join("  ·  ")}</Text> : null}

            <Text style={[styles.heroName, { fontSize: isLargeDesktop ? 68 : isDesktopWeb ? 58 : 44 }]}>
              {adib.fullName}
            </Text>
            <View style={styles.nameRule} />
            {adib.penName ? <Text style={styles.penName}>"{adib.penName}"</Text> : null}

            {adib.shortDescription ? (
              <Text style={styles.heroSummary} numberOfLines={4}>
                {adib.shortDescription}
              </Text>
            ) : null}

            {/* Apply CTA */}
            <ApplyPill />

            {/* Numbered index of article sections — the signature list. */}
            {sections.length ? (
              <View style={styles.indexList}>
                {sections.map((s, i) => (
                  <IndexRow
                    key={s.key}
                    title={s.title}
                    number={String(i + 1).padStart(2, "0")}
                    onPress={() => scrollTo(s.key)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* ───────────────────────── Editorial body ───────────────────────── */}
      <View style={styles.body}>
        {/* Quick facts as an elegant definition grid. */}
        {facts.length ? (
          <View style={styles.factsWrap}>
            <Text style={styles.bodyKicker}>QISQACHA MA'LUMOTLAR</Text>
            <View style={styles.factsGrid}>
              {facts.map((f) => (
                <View key={f.label} style={styles.factCell}>
                  <Text style={styles.factLabel}>{f.label}</Text>
                  <Text style={styles.factValue}>{f.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Biography */}
        {bio.length ? (
          <View style={styles.article}>
            <SectionHeading number="00" title="Biografiya" styles={styles} />
            {bio.map((block, i) =>
              block.kind === "heading" ? (
                <Text key={i} style={styles.subHeading}>
                  {block.text}
                </Text>
              ) : (
                <Text key={i} style={styles.paragraph}>
                  {block.text}
                </Text>
              )
            )}
          </View>
        ) : null}

        {/* Article sections */}
        {sections.map((s, i) => (
          <View
            key={s.key}
            style={styles.article}
            onLayout={(e) => {
              sectionY.current[s.key] = e.nativeEvent.layout.y;
            }}
          >
            <SectionHeading number={String(i + 1).padStart(2, "0")} title={s.title} styles={styles} />
            {s.paragraphs.map((p, j) => (
              <Text key={j} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <LiderlarCredit align="center" style={{ marginTop: 44 }} />
      </View>
    </ScrollView>
  );
}

/* ──────────────────────────────  Pieces  ────────────────────────────── */

/** The framed portrait. Grayscale by default, colour + straighten on hover. */
function Portrait({ uri, name, width }: { uri: string | null; name: string; width: number }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const height = Math.round(width * 1.2);
  const grayscale = Platform.OS === "web" ? ({ filter: hovered ? "grayscale(0%)" : "grayscale(100%)" } as any) : null;
  const transform = hovered
    ? ([{ perspective: 1200 }, { rotateY: "0deg" }, { translateY: -6 }] as any)
    : ([{ perspective: 1200 }, { rotateY: "-6deg" }, { rotateZ: "-1deg" }] as any);
  return (
    <Pressable
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[{ transform }, hoverTransition, cursorPointer]}
    >
      <View style={[portraitStyles.frame, { width, height }]}>
        {uri ? (
          <Image source={{ uri }} style={[StyleSheet.absoluteFillObject, grayscale]} contentFit="cover" />
        ) : (
          <LinearGradient colors={[HERO_GREEN, "#2D9B6F"]} style={StyleSheet.absoluteFillObject}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 56, fontWeight: "900", fontFamily: FONT.serif }}>
                {getInitials(name)}
              </Text>
            </View>
          </LinearGradient>
        )}
      </View>
    </Pressable>
  );
}

function IndexRow({ title, number, onPress }: { title: string; number: string; onPress: () => void }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[indexStyles.row, cursorPointer]}
    >
      <Text
        style={[
          indexStyles.title,
          { color: hovered ? "#fff" : HERO_INK, transform: [{ translateX: hovered ? 6 : 0 }] },
          hoverTransition,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={[indexStyles.line, { backgroundColor: hovered ? HERO_GREEN : HERO_LINE }, hoverTransition]} />
      <Text style={indexStyles.number}>{number}</Text>
    </Pressable>
  );
}

function ApplyPill() {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={() => router.push("/adib-encyclopedia/apply")}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[applyStyles.wrap, hovered ? { transform: [{ translateY: -2 }] } : null, hoverTransition, cursorPointer]}
    >
      <LinearGradient colors={[HERO_GREEN, "#2D9B6F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={applyStyles.fill}>
        <View style={applyStyles.badge}>
          <Sparkles color="#fff" size={15} strokeWidth={2.3} />
        </View>
        <Text style={applyStyles.label}>Men ham ensiklopediyada chiqishni xohlayman</Text>
        <ChevronRight color="rgba(255,255,255,0.92)" size={17} strokeWidth={2.4} />
      </LinearGradient>
    </Pressable>
  );
}

function SectionHeading({
  number,
  title,
  styles,
}: {
  number: string;
  title: string;
  styles: StylesType;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionNumber}>{number}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function openTelegram(username: string | null) {
  if (!username) return;
  void openExternalUrl(`https://t.me/${username.replace(/^@+/, "")}`);
}

/* ──────────────────────────────  Styles  ────────────────────────────── */

type StylesType = ReturnType<typeof createStyles>;

const portraitStyles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,241,234,0.14)",
    backgroundColor: "#1a1e24",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 30px 60px rgba(0,0,0,0.5)" } as any)
      : { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 24 } }),
  },
});

const indexStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: "800", flexShrink: 1 },
  line: { flex: 1, height: 1, minWidth: 20 },
  number: { color: HERO_INK_DIM, fontSize: 12, fontWeight: "800", letterSpacing: 1, width: 22, textAlign: "right" },
});

const applyStyles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    borderRadius: 15,
    marginTop: 26,
    ...(Platform.OS === "web" ? ({ boxShadow: "0 14px 30px rgba(82,183,136,0.4)" } as any) : {}),
  },
  fill: {
    minHeight: 54,
    maxWidth: 460,
    borderRadius: 15,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  label: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "800" },
});

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    hero: { backgroundColor: HERO_BG, overflow: "hidden", position: "relative", paddingBottom: 64 },
    heroTopBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: 28,
      paddingTop: 22,
      zIndex: 3,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(245,241,234,0.08)",
      borderWidth: 1,
      borderColor: HERO_LINE,
    },
    eyebrow: { color: HERO_INK_DIM, fontSize: 11.5, fontWeight: "900", letterSpacing: 3 },

    heroInner: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 48,
      paddingTop: 28,
      maxWidth: 1320,
      width: "100%",
      alignSelf: "center",
      zIndex: 2,
    },
    contactBlock: { alignSelf: "stretch", gap: 6, paddingTop: 6 },
    contactHello: { color: HERO_INK, fontSize: 15, fontWeight: "900", fontFamily: FONT.serif },
    contactRule: { width: 34, height: 2, backgroundColor: HERO_GREEN, marginVertical: 6, borderRadius: 1 },
    contactLine: { color: HERO_INK_DIM, fontSize: 13, fontWeight: "700" },

    heroCopy: { flex: 1, minWidth: 320, maxWidth: 640, zIndex: 2 },
    roleBadge: { color: HERO_GREEN, fontSize: 13, fontWeight: "800", letterSpacing: 1, marginBottom: 16 },
    heroName: { color: HERO_INK, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -1.5 },
    nameRule: { width: 90, height: 3, backgroundColor: HERO_INK, marginTop: 18, borderRadius: 2 },
    penName: { color: HERO_INK_DIM, fontSize: 18, fontWeight: "700", fontStyle: "italic", marginTop: 14 },
    heroSummary: { color: HERO_INK_DIM, fontSize: 15.5, lineHeight: 25, marginTop: 16, maxWidth: 560 },

    indexList: { marginTop: 30, borderTopWidth: 1, borderTopColor: HERO_LINE },

    body: { width: "100%", maxWidth: 860, alignSelf: "center", paddingHorizontal: 24, marginTop: 8 },

    factsWrap: { marginTop: 44 },
    bodyKicker: { color: c.primary, fontSize: 12, fontWeight: "900", letterSpacing: 2.5, marginBottom: 18 },
    factsGrid: { flexDirection: "row", flexWrap: "wrap" },
    factCell: {
      width: "50%",
      paddingVertical: 14,
      paddingRight: 20,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    factLabel: { color: c.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 5 },
    factValue: { color: c.text, fontSize: 16, lineHeight: 22, fontWeight: "700" },

    article: { marginTop: 46 },
    sectionHead: { flexDirection: "row", alignItems: "baseline", gap: 14, marginBottom: 18 },
    sectionNumber: { color: c.primary, fontSize: 15, fontWeight: "900", letterSpacing: 1, fontVariant: ["tabular-nums"] },
    sectionTitle: { color: c.text, fontSize: 30, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -0.6, flex: 1 },
    subHeading: { color: c.text, fontSize: 20, lineHeight: 27, fontWeight: "800", fontFamily: FONT.serif, marginTop: 22, marginBottom: 4 },
    paragraph: { color: c.textDim, fontSize: 16.5, lineHeight: 29, fontWeight: "400", marginTop: 14 },
  });
}
