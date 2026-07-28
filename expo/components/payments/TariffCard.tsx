import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Check, Star } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui";
import { formatUzs, type Tariff } from "@/constants/tariffs";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";

const DEEP_GREEN = "#0B5A3A";
const GRADIENT: [string, string] = [DEEP_GREEN, "#11998E"];

/** A single AdabiyotX tariff card with optional highlight badge + "Tanlash" CTA. */
export default function TariffCard({
  tariff,
  onSelect,
}: {
  tariff: Tariff;
  onSelect: (tariff: Tariff) => void;
}) {
  const { colors: c } = useTheme();
  const highlighted = !!tariff.badge;
  const styles = useMemo(() => createStyles(c, highlighted), [c, highlighted]);

  return (
    <View style={styles.card}>
      {tariff.badge ? (
        <View style={styles.badge}>
          <Star color="#fff" size={12} fill="#fff" />
          <Text style={styles.badgeText}>{tariff.badge}</Text>
        </View>
      ) : null}

      <Text style={styles.title}>{tariff.title}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatUzs(tariff.priceUzs)}</Text>
        <Text style={styles.period}>{` / ${tariff.period}`}</Text>
      </View>

      <View style={styles.features}>
        {tariff.features.map((f) => (
          <View key={f} style={styles.featureRow}>
            <View style={styles.checkDot}>
              <Check color={highlighted ? "#fff" : c.primary} size={12} strokeWidth={3} />
            </View>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* On the highlighted (green) card a white pill gives the contrast; on a
          plain card the gradient does. Neither uses a coloured glow. */}
      <PressableScale onPress={() => onSelect(tariff)} style={styles.ctaWrap}>
        {highlighted ? (
          <View style={[styles.cta, styles.ctaSolid]}>
            <Text style={styles.ctaText}>Tanlash</Text>
            <ArrowRight color={DEEP_GREEN} size={20} strokeWidth={2.6} />
          </View>
        ) : (
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Tanlash</Text>
            <ArrowRight color="#fff" size={20} strokeWidth={2.6} />
          </LinearGradient>
        )}
      </PressableScale>
    </View>
  );
}

function createStyles(c: AppTheme, highlighted: boolean) {
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: highlighted ? c.primary : c.bgCard,
      borderWidth: highlighted ? 0 : 1,
      borderColor: c.borderStrong,
      padding: 22,
      marginBottom: 16,
      ...(highlighted
        ? {
            shadowColor: c.primary,
            shadowOpacity: 0.35,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }
        : {}),
    },
    badge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.gold,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginBottom: 14,
    },
    badgeText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
    title: {
      fontSize: 21,
      fontWeight: "800",
      color: highlighted ? "#fff" : c.text,
      letterSpacing: -0.4,
    },
    priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 8 },
    price: { fontSize: 26, fontWeight: "800", color: highlighted ? "#fff" : c.primary },
    period: { fontSize: 14, fontWeight: "600", color: highlighted ? "rgba(255,255,255,0.85)" : c.textDim },
    features: { marginTop: 18, gap: 12 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    checkDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: highlighted ? "rgba(255,255,255,0.22)" : c.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    featureText: {
      flex: 1,
      fontSize: 14.5,
      color: highlighted ? "rgba(255,255,255,0.95)" : c.text,
      lineHeight: 20,
    },
    // Deliberately tall — this is the primary action of the card. The shadow is
    // neutral and low; a bright coloured halo reads as a rendering artefact.
    ctaWrap: {
      marginTop: 22,
      borderRadius: 18,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: highlighted ? 0.16 : 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    cta: {
      height: 60,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 9,
    },
    ctaSolid: { backgroundColor: "#fff" },
    ctaText: {
      fontSize: 17.5,
      fontWeight: "800",
      letterSpacing: 0.3,
      color: highlighted ? DEEP_GREEN : "#fff",
    },
  });
}
