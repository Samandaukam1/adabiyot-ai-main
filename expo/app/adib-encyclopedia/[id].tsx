import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpen, ChevronLeft, RefreshCw } from "lucide-react-native";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import EncyclopediaApplyButton from "@/components/EncyclopediaApplyButton";
import LiderlarCredit from "@/components/LiderlarCredit";
import { useAdibEntry } from "@/hooks/useAdibEncyclopedia";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/providers/ThemeProvider";
import type { AdibEntry } from "@/types/community";
import { getInitials } from "@/types/profile";

interface FactDefinition {
  label: string;
  quickKeys: string[];
  fallback: (adib: AdibEntry) => unknown;
}

const FACTS: FactDefinition[] = [
  { label: "Ismi", quickKeys: ["Ismi", "full_name", "name"], fallback: (a) => a.fullName },
  { label: "Taxallusi", quickKeys: ["Taxallusi", "pen_name", "penName"], fallback: (a) => a.penName },
  { label: "AdabiyotX taxallusi", quickKeys: ["AdabiyotX taxallusi", "adabiyotx_username"], fallback: (a) => a.adabiyotxUsername ? `@${a.adabiyotxUsername.replace(/^@+/, "")}` : null },
  { label: "Tug'ilgan sana", quickKeys: ["Tug'ilgan sana", "birth_date"], fallback: (a) => a.birthDate },
  { label: "Tug'ilgan yili", quickKeys: ["Tug'ilgan yili", "birth_year"], fallback: (a) => a.birthYear },
  { label: "Tug'ilgan joyi", quickKeys: ["Tug'ilgan joyi", "birth_place"], fallback: (a) => a.birthPlace },
  { label: "Mutaxassisligi", quickKeys: ["Mutaxassisligi", "specialty"], fallback: (a) => a.specialty },
  { label: "Kasbi", quickKeys: ["Kasbi", "profession"], fallback: (a) => a.profession },
  { label: "Millati", quickKeys: ["Millati", "nationality"], fallback: (a) => a.nationality },
  { label: "Partiyaviyligi", quickKeys: ["Partiyaviyligi", "party_affiliation"], fallback: (a) => a.partyAffiliation },
  { label: "Tillar bilishi", quickKeys: ["Tillar bilishi", "languages"], fallback: (a) => a.languages },
];

function normalizeFactKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[‘’ʻʼ`]/g, "'");
}

function displayValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items.join(" | ") : null;
  }
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function factsFor(adib: AdibEntry): { label: string; value: string }[] {
  const quickFacts = new Map(
    Object.entries(adib.quickFacts).map(([key, value]) => [normalizeFactKey(key), value])
  );

  return FACTS.flatMap((definition) => {
    const quickValue = definition.quickKeys
      .map((key) => quickFacts.get(normalizeFactKey(key)))
      .find((value) => displayValue(value) != null);
    const value = displayValue(quickValue) ?? displayValue(definition.fallback(adib));
    return value ? [{ label: definition.label, value }] : [];
  });
}

function decodeHtml(text: string): string {
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  };
  return text.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (match) => entities[match] ?? match);
}

function htmlToReadableText(html: string): string {
  return decodeHtml(
    html
      .replace(/<h[1-6][^>]*>/gi, "\n## ")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(li|p|div|section|article)>/gi, "\n\n")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function BiographyContent({ adib, styles }: { adib: AdibEntry; styles: ReturnType<typeof createStyles> }) {
  const source = adib.biographyHtml
    ? htmlToReadableText(adib.biographyHtml)
    : adib.biographyMarkdown?.trim() || adib.shortDescription?.trim() || "";
  if (!source) return null;

  const blocks = source.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <View style={styles.biographyCard}>
      {blocks.map((block, index) => {
        const heading = block.match(/^#{1,6}\s+(.+)$/s);
        if (heading) return <Text key={index} style={styles.biographyHeading}>{heading[1]}</Text>;
        const cleaned = block
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/__(.*?)__/g, "$1")
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
        return <Text key={index} style={styles.biographyText}>{cleaned}</Text>;
      })}
    </View>
  );
}

const ARTICLE_SECTIONS: { key: string; title: string }[] = [
  { key: "early_life", title: "Erta hayoti va oilasi" },
  { key: "education", title: "Ta’limi" },
  { key: "activity", title: "Faoliyati" },
  { key: "achievements", title: "Yutuqlari" },
  { key: "creative_works", title: "Ijodiy ishlari yoki loyihalari" },
  { key: "values", title: "Qarashlari va qadriyatlari" },
  { key: "future_plans", title: "Kelajakdagi rejalari" },
  { key: "additional", title: "Qo‘shimcha ma’lumot" },
];

function sectionParagraphs(value: unknown): string[] {
  const text = displayValue(value);
  if (!text) return [];
  return text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
}

/** Renders the long-form article body assembled from the `sections` jsonb. */
function ArticleSections({ adib, styles }: { adib: AdibEntry; styles: ReturnType<typeof createStyles> }) {
  const normalized = new Map(
    Object.entries(adib.sections).map(([key, value]) => [key.trim().toLowerCase(), value])
  );
  const present = ARTICLE_SECTIONS.flatMap((item) => {
    const paragraphs = sectionParagraphs(normalized.get(item.key));
    return paragraphs.length ? [{ ...item, paragraphs }] : [];
  });
  if (present.length === 0) return null;

  return (
    <>
      {present.map((item) => (
        <View key={item.key} style={styles.section}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
          <View style={styles.biographyCard}>
            {item.paragraphs.map((paragraph, index) => (
              <Text key={index} style={styles.biographyText}>{paragraph}</Text>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

export default function AdibEncyclopediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = id ? String(id) : undefined;
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { isWebLayout } = useResponsive();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { adib, loading, error, refetch } = useAdibEntry(entryId);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={c.primary} size="large" />
        <Text style={styles.stateText}>Ma’lumotlar yuklanmoqda…</Text>
      </View>
    );
  }

  if (error || !adib) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.stateText}>{error ?? "Maqola topilmadi yoki hali chop etilmagan."}</Text>
        {error ? (
          <PressableScale onPress={() => void refetch()} style={styles.retryButton}>
            <RefreshCw color={c.primary} size={16} />
            <Text style={styles.retryText}>Qayta urinish</Text>
          </PressableScale>
        ) : null}
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>Orqaga</Text></Pressable>
      </View>
    );
  }

  const handle = adib.adabiyotxUsername
    ? `@${adib.adabiyotxUsername.replace(/^@+/, "")}`
    : null;
  const facts = factsFor(adib);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingBottom: insets.bottom + 50 },
          isWebLayout && styles.webContent,
        ]}
      >
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          {adib.coverUrl ? (
            <Image source={{ uri: adib.coverUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : null}
          <LinearGradient
            colors={isDark
              ? ["rgba(13,17,23,0.28)", "rgba(13,17,23,0.92)", c.bg]
              : ["rgba(234,246,239,0.55)", "rgba(255,255,255,0.92)", c.bg]}
            style={StyleSheet.absoluteFillObject}
          />
          <Pressable
            onPress={() => router.back()}
            style={[styles.heroBack, { top: insets.top + 8 }]}
          >
            <ChevronLeft color={c.text} size={22} />
          </Pressable>

          {adib.photoUrl ? (
            <Image source={{ uri: adib.photoUrl }} style={styles.photo} contentFit="cover" />
          ) : (
            <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.photo}>
              <Text style={styles.initials}>{getInitials(adib.fullName)}</Text>
            </LinearGradient>
          )}
          <Text style={styles.name}>{adib.fullName}</Text>
          {adib.penName ? <Text style={styles.pen}>“{adib.penName}”</Text> : null}
          {handle ? <Text style={styles.handle}>{handle}</Text> : null}
          {adib.roles.length ? <Text style={styles.roles}>{adib.roles.join(" | ")}</Text> : null}
          {adib.shortDescription ? <Text style={styles.shortDescription}>{adib.shortDescription}</Text> : null}
        </View>

        <View style={styles.body}>
          <EncyclopediaApplyButton style={styles.topCta} />

          {facts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Qisqacha ma’lumotlar</Text>
              <View style={styles.factsCard}>
                {facts.map((fact, index) => (
                  <View key={fact.label} style={[styles.factRow, index === facts.length - 1 && styles.factRowLast]}>
                    <Text style={styles.factLabel}>{fact.label}</Text>
                    <Text style={styles.factValue}>{fact.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.biographyTitleRow}>
              <View style={styles.biographyIcon}><BookOpen color={c.primary} size={17} /></View>
              <Text style={styles.sectionTitle}>Biografiya</Text>
            </View>
            <BiographyContent adib={adib} styles={styles} />
          </View>

          <ArticleSections adib={adib} styles={styles} />

          <LiderlarCredit align="center" style={styles.detailCredit} />
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center", gap: 15, paddingHorizontal: 28 },
    webContent: { width: "100%", maxWidth: 900, alignSelf: "center" },
    stateText: { color: c.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", fontWeight: "600" },
    retryButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 999, backgroundColor: c.bgCard },
    retryText: { color: c.primary, fontSize: 13, fontWeight: "800" },
    backText: { color: c.primary, fontSize: 13.5, fontWeight: "800", padding: 8 },
    hero: { minHeight: 470, alignItems: "center", paddingHorizontal: 24, paddingBottom: 35, overflow: "hidden" },
    heroBack: {
      position: "absolute",
      top: 0,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(20,25,23,0.75)" : "rgba(255,255,255,0.82)",
      borderWidth: 1,
      borderColor: c.border,
      zIndex: 2,
    },
    photo: { width: 132, height: 150, borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: 54, borderWidth: 4, borderColor: c.bg, backgroundColor: c.surface },
    initials: { color: "#fff", fontSize: 40, fontWeight: "900", fontFamily: FONT.serif },
    name: { color: c.text, fontSize: 28, lineHeight: 34, fontWeight: "900", fontFamily: FONT.serif, textAlign: "center", marginTop: 17 },
    pen: { color: c.primary, fontSize: 14.5, fontWeight: "800", marginTop: 5 },
    handle: { color: c.textMuted, fontSize: 13, fontWeight: "700", marginTop: 4 },
    roles: { color: c.primary, fontSize: 12.5, lineHeight: 19, fontWeight: "700", textAlign: "center", marginTop: 13, maxWidth: 680 },
    shortDescription: { color: c.textDim, fontSize: 14, lineHeight: 21, fontWeight: "500", textAlign: "center", marginTop: 12, maxWidth: 680 },
    body: { paddingHorizontal: 20 },
    topCta: { marginTop: 4 },
    section: { marginTop: 26 },
    sectionTitle: { color: c.text, fontSize: 19, fontWeight: "900", fontFamily: FONT.serif },
    factsCard: { marginTop: 13, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, overflow: "hidden" },
    factRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border },
    factRowLast: { borderBottomWidth: 0 },
    factLabel: { width: 132, color: c.textMuted, fontSize: 12.5, lineHeight: 18, fontWeight: "700" },
    factValue: { flex: 1, color: c.text, fontSize: 13.5, lineHeight: 20, fontWeight: "700" },
    biographyTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    biographyIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(82,183,136,0.13)" : "rgba(82,183,136,0.09)" },
    biographyCard: { marginTop: 13, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, padding: 18, gap: 13 },
    biographyHeading: { color: c.text, fontSize: 17, lineHeight: 23, fontWeight: "900", fontFamily: FONT.serif, marginTop: 3 },
    biographyText: { color: c.textDim, fontSize: 14.5, lineHeight: 24, fontWeight: "500" },
    detailCredit: { marginTop: 30 },
  });
}
