import { Image } from "expo-image";
import React from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";

// Cross-platform serif for the premium wordmark/title (Android has no "Georgia").
const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" });

/**
 * ReaderTitlePage — the premium first page shown when ANY book reader opens.
 *
 * Contract (per product spec):
 *   • The logo is taken ONLY from the admin Branding settings (logo_url →
 *     splash_logo_url → app_icon_url). It never falls back to a bundled/static
 *     asset — if no admin logo exists it shows the "ADABIYOTX" wordmark text.
 *   • Below the logo: book title, author, year (year hidden when unknown).
 *   • Themed by the host reader so it matches the current page background.
 */

export interface ReaderTitlePageProps {
  /** Admin branding logo URL (already resolved by priority). Null → text mark. */
  logoUrl?: string | null;
  appName?: string;
  title: string;
  authorName?: string | null;
  year?: string | number | null;
  category?: string | null;
  /** Host reader theme so the page blends with the current paper colour. */
  backgroundColor?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
}

export default function ReaderTitlePage({
  logoUrl,
  appName = "ADABIYOTX",
  title,
  authorName,
  year,
  category,
  backgroundColor = "#FFFDF7",
  textColor = "#1B1712",
  mutedColor = "#6B6357",
  accentColor = "#16A34A",
}: ReaderTitlePageProps) {
  const { width } = useWindowDimensions();
  // Responsive title: bigger on wide/web, comfortable on phones.
  const titleSize = Math.max(28, Math.min(40, width * 0.085));
  const yearText = year != null && String(year).trim() ? String(year).trim() : null;

  return (
    <View style={[styles.root, { backgroundColor }]}>
      {/* Brand — admin logo, or the wordmark when none is configured. */}
      <View style={styles.brandZone}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.logo}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <Text style={[styles.wordmark, { color: textColor }]}>
            {(appName || "ADABIYOTX").toUpperCase()}
          </Text>
        )}
      </View>

      {/* Centre — title + author. */}
      <View style={styles.centerZone}>
        {category ? (
          <Text style={[styles.kicker, { color: accentColor }]} numberOfLines={1}>
            {category.toUpperCase()}
          </Text>
        ) : null}
        <View style={[styles.rule, { backgroundColor: accentColor }]} />
        <Text style={[styles.title, { color: textColor, fontSize: titleSize, lineHeight: titleSize * 1.22 }]} numberOfLines={5}>
          {title}
        </Text>
        {authorName ? (
          <Text style={[styles.author, { color: mutedColor }]} numberOfLines={2}>
            {authorName}
          </Text>
        ) : null}
        <View style={[styles.rule, { marginTop: 22, width: 34, backgroundColor: accentColor }]} />
      </View>

      {/* Bottom — year (only when known). */}
      <View style={styles.bottomZone}>
        {yearText ? <Text style={[styles.year, { color: mutedColor }]}>{yearText}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 52,
    paddingBottom: 44,
  },
  brandZone: { alignItems: "center", justifyContent: "center", minHeight: 96 },
  logo: { width: 140, height: 90 },
  wordmark: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 4,
    fontFamily: SERIF,
  },
  centerZone: { alignItems: "center", justifyContent: "center", flex: 1, paddingHorizontal: 4 },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 16,
  },
  rule: { width: 48, height: 2, borderRadius: 2, marginBottom: 24, opacity: 0.9 },
  title: {
    fontWeight: "800",
    textAlign: "center",
    fontFamily: SERIF,
  },
  author: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  bottomZone: { minHeight: 28, alignItems: "center", justifyContent: "flex-end" },
  year: { fontSize: 18, fontWeight: "700", letterSpacing: 2 },
});
