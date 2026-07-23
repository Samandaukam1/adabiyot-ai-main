import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, ArrowRight, Globe, Mail, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT } from "@/components/ui";
import WebContainer from "@/components/web/WebContainer";
import WebFooter from "@/components/web/WebFooter";
import { cursorPointer, hoverTransition } from "@/components/web/webStyle";
import { useHover } from "@/components/web/useHover";
import type { AppTheme } from "@/constants/colors";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/providers/ThemeProvider";
import { isSafeInternalRoute, openExternalUrl } from "@/utils/safeLinks";

/* ──────────────────────────  Shared brand facts  ─────────────────────── */

export const LEGAL_BRAND = "AdabiyotX";
export const LEGAL_COMPANY = "Mukammal Media Group";
export const LEGAL_CONTACT_EMAIL = "jaxongir_man@icloud.com";
export const LEGAL_WEBSITE_URL = "https://adabiyotx.uz";
export const LEGAL_WEBSITE_LABEL = "adabiyotx.uz";

/** Chosen language persists across sessions — on web AsyncStorage is localStorage. */
const LANG_STORAGE_KEY = "adabiyot.legal.lang.v1";
export type LegalLang = "uz" | "en";

/* ──────────────────────────  Content model  ─────────────────────────── */

/** A paragraph, or a bulleted list, inside a section. */
export type LegalBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

/** Everything the scaffold needs for ONE language. */
export interface LegalContent {
  /** Big serif page title, e.g. "Maxfiylik siyosati". */
  title: string;
  /** One-line intro under the title. */
  subtitle: string;
  /** "Oxirgi yangilanish" / "Last updated". */
  updatedLabel: string;
  /** Formatted date, e.g. "23-iyul, 2026" / "23 July 2026". */
  updatedValue: string;
  sections: LegalSection[];
  contactTitle: string;
  contactIntro: string;
  emailLabel: string;
  websiteLabel: string;
  /** Label of the button linking to the sibling legal page. */
  crossLinkLabel: string;
  /** "Barcha huquqlar himoyalangan." / "All rights reserved." */
  rightsReserved: string;
}

export interface LegalDocumentProps {
  uz: LegalContent;
  en: LegalContent;
  /** Route of the sibling legal page (e.g. "/terms" from the privacy page). */
  crossLinkHref: string;
}

/**
 * Bilingual legal page scaffold shared by /privacy and /terms. Renders a
 * UZ | EN switcher (default Uzbek, persisted), a branded hero, the sections,
 * a contact card and a link to the sibling document — in the AdabiyotX
 * green/cream style, responsive on phone and desktop web. Public: reachable
 * without a session so App Store / Google Play reviewers can open the URL.
 */
export default function LegalDocument({ uz, en, crossLinkHref }: LegalDocumentProps) {
  const { colors: c, isDark } = useTheme();
  const { isWebLayout, isDesktopWeb } = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const [lang, setLang] = useState<LegalLang>("uz");
  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then((val) => {
      if (val === "en" || val === "uz") setLang(val);
    });
  }, []);
  const chooseLang = (next: LegalLang) => {
    setLang(next);
    AsyncStorage.setItem(LANG_STORAGE_KEY, next).catch(() => {});
  };

  const t = lang === "en" ? en : uz;
  const titleSize = isDesktopWeb ? 46 : isWebLayout ? 38 : 30;

  const goCrossLink = () => {
    if (isSafeInternalRoute(crossLinkHref)) router.push(crossLinkHref as never);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: isWebLayout ? 0 : 48 }}>
      {/* Native-only back bar — on web the global WebHeader handles navigation. */}
      {!isWebLayout ? (
        <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft color={c.text} size={22} />
          </Pressable>
          <Text style={styles.backTitle} numberOfLines={1}>
            {t.title}
          </Text>
          <LangSwitch lang={lang} onChoose={chooseLang} styles={styles} c={c} />
        </View>
      ) : null}

      <View style={{ paddingTop: isWebLayout ? (isDesktopWeb ? 40 : 28) : 8 }}>
        <WebContainer maxWidth={880}>
          {/* Web language switch, right-aligned above the hero. */}
          {isWebLayout ? (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 16 }}>
              <LangSwitch lang={lang} onChoose={chooseLang} styles={styles} c={c} />
            </View>
          ) : null}

          {/* Hero */}
          <LinearGradient
            colors={isDark ? ["rgba(82,183,136,0.14)", "rgba(29,53,87,0.10)"] : ["#E8F5EE", "#F5F1EA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <ShieldCheck color={c.primary} size={16} />
                <Text style={styles.brandBadgeText}>{LEGAL_COMPANY.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={[styles.heroTitle, { fontSize: titleSize }]}>{t.title}</Text>
            <Text style={styles.heroSubtitle}>{t.subtitle}</Text>
            <Text style={styles.updated}>
              {t.updatedLabel}: {t.updatedValue}
            </Text>
          </LinearGradient>

          {/* Sections */}
          <View style={styles.sections}>
            {t.sections.map((section) => (
              <PolicySection key={section.title} section={section} styles={styles} c={c} />
            ))}

            {/* Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.contactTitle}</Text>
              <Text style={styles.paragraph}>{t.contactIntro}</Text>
              <View style={styles.contactCard}>
                <ContactRow
                  icon={<Mail color={c.primary} size={18} />}
                  label={t.emailLabel}
                  value={LEGAL_CONTACT_EMAIL}
                  onPress={() => void openExternalUrl(`mailto:${LEGAL_CONTACT_EMAIL}`)}
                  styles={styles}
                />
                <View style={styles.contactDivider} />
                <ContactRow
                  icon={<Globe color={c.primary} size={18} />}
                  label={t.websiteLabel}
                  value={LEGAL_WEBSITE_LABEL}
                  onPress={() => void openExternalUrl(LEGAL_WEBSITE_URL)}
                  styles={styles}
                />
              </View>
            </View>

            {/* Link to the sibling legal document */}
            <CrossLinkButton label={t.crossLinkLabel} onPress={goCrossLink} styles={styles} c={c} />

            <Text style={styles.footerNote}>
              © {new Date().getFullYear()} {LEGAL_COMPANY}. {LEGAL_BRAND}. {t.rightsReserved}
            </Text>
          </View>
        </WebContainer>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function LangSwitch({
  lang,
  onChoose,
  styles,
  c,
}: {
  lang: LegalLang;
  onChoose: (l: LegalLang) => void;
  styles: StylesType;
  c: AppTheme;
}) {
  return (
    <View style={styles.langSwitch}>
      {(["uz", "en"] as LegalLang[]).map((opt) => {
        const active = lang === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChoose(opt)}
            style={[styles.langOption, active ? styles.langOptionActive : null, cursorPointer]}
          >
            <Text style={[styles.langText, { color: active ? "#fff" : c.textDim }]}>
              {opt.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PolicySection({ section, styles, c }: { section: LegalSection; styles: StylesType; c: AppTheme }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.blocks.map((block, i) =>
        block.kind === "text" ? (
          <Text key={i} style={styles.paragraph}>
            {block.text}
          </Text>
        ) : (
          <View key={i} style={styles.list}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.listItem}>
                <View style={styles.bullet} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
  styles: StylesType;
}) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable onPress={onPress} onHoverIn={onHoverIn} onHoverOut={onHoverOut} style={[styles.contactRow, cursorPointer]}>
      <View style={styles.contactIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={[styles.contactValue, hovered ? styles.contactValueHover : null, hoverTransition]}>{value}</Text>
      </View>
    </Pressable>
  );
}

function CrossLinkButton({
  label,
  onPress,
  styles,
  c,
}: {
  label: string;
  onPress: () => void;
  styles: StylesType;
  c: AppTheme;
}) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[styles.crossLink, hovered ? styles.crossLinkHover : null, hoverTransition, cursorPointer]}
    >
      <Text style={styles.crossLinkText}>{label}</Text>
      <ArrowRight color={c.primary} size={18} />
    </Pressable>
  );
}

type StylesType = ReturnType<typeof createStyles>;

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    backBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
    backTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif, flex: 1 },

    langSwitch: {
      flexDirection: "row",
      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
      borderRadius: 999,
      padding: 3,
      borderWidth: 1,
      borderColor: c.border,
    },
    langOption: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, minWidth: 42, alignItems: "center" },
    langOptionActive: { backgroundColor: c.primary },
    langText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },

    hero: {
      borderRadius: 24,
      padding: Platform.OS === "web" ? 40 : 24,
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.22)" : "rgba(82,183,136,0.28)",
    },
    brandRow: { flexDirection: "row", marginBottom: 18 },
    brandBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.16)" : "rgba(255,255,255,0.75)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.30)" : "rgba(82,183,136,0.35)",
    },
    brandBadgeText: { color: c.primaryDim, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
    heroTitle: {
      color: c.text,
      fontWeight: "900",
      fontFamily: FONT.serif,
      letterSpacing: -1,
      lineHeight: Platform.OS === "web" ? undefined : 38,
    },
    heroSubtitle: { color: c.textDim, fontSize: 16, lineHeight: 25, marginTop: 14, maxWidth: 620 },
    updated: { color: c.primaryDim, fontSize: 13, fontWeight: "700", marginTop: 18 },

    sections: { marginTop: 8 },
    section: { marginTop: 30 },
    sectionTitle: { color: c.text, fontSize: 21, fontWeight: "800", fontFamily: FONT.serif, marginBottom: 12 },
    paragraph: { color: c.textDim, fontSize: 15.5, lineHeight: 26, marginTop: 4 },

    list: { marginTop: 10, gap: 10 },
    listItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingRight: 4 },
    bullet: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.primary, marginTop: 9 },
    listText: { color: c.textDim, fontSize: 15.5, lineHeight: 25, flex: 1 },

    contactCard: {
      marginTop: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: isDark ? c.bgCard : "#FFFFFF",
      overflow: "hidden",
    },
    contactRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
    contactIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.soft,
    },
    contactLabel: { color: c.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
    contactValue: { color: c.text, fontSize: 15.5, fontWeight: "700", marginTop: 2 },
    contactValueHover: { color: c.primary },
    contactDivider: { height: 1, backgroundColor: c.border, marginLeft: 70 },

    crossLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 28,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: isDark ? "rgba(82,183,136,0.30)" : "rgba(82,183,136,0.35)",
      backgroundColor: c.soft,
    },
    crossLinkHover: { borderColor: c.primary },
    crossLinkText: { color: c.text, fontSize: 15.5, fontWeight: "800" },

    footerNote: { color: c.textMuted, fontSize: 13, lineHeight: 20, marginTop: 36, textAlign: "center" },
  });
}
