import { Clock, Tag } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "@/constants/colors";
import { formatUzs } from "@/constants/tariffs";
import { usePromoCountdown } from "@/hooks/usePromo";
import { useTheme } from "@/providers/ThemeProvider";

const DEEP_GREEN = "#0B5A3A";

/**
 * Premium discount block for content detail pages. Shows the struck-through old
 * price, the deep-green discounted price, a "-N%" badge, the applied promo code
 * and a live countdown. Renders nothing when there is no active promo, or once
 * the countdown reaches zero — so the page falls back to the normal price.
 */
export default function PromoPriceBlock({
  originalAmount,
  finalAmount,
  discountPercent,
  promoCode,
  endsAt,
  isActive,
}: {
  originalAmount: number;
  finalAmount: number;
  discountPercent: number;
  promoCode: string;
  endsAt: string | null;
  isActive: boolean;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const countdown = usePromoCountdown(endsAt);

  if (!isActive || (endsAt && countdown.expired)) return null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>-{discountPercent}%</Text>
        </View>
        <View style={styles.codeChip}>
          <Tag color={isDark ? c.secondary : DEEP_GREEN} size={12} />
          <Text style={styles.codeText} numberOfLines={1}>
            {promoCode} qo'llandi
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.oldPrice}>{formatUzs(originalAmount)}</Text>
        <Text style={styles.newPrice}>{formatUzs(finalAmount)}</Text>
      </View>

      {endsAt ? (
        <View style={styles.countdownRow}>
          <Clock color={c.gold} size={14} />
          <Text style={styles.countdownLabel}>Chegirma tugashiga: </Text>
          <Text style={styles.countdownValue}>{countdown.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  const accent = isDark ? c.secondary : DEEP_GREEN;
  return StyleSheet.create({
    card: {
      borderRadius: 18,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(11,90,58,0.05)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.28)" : "rgba(11,90,58,0.14)",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.gold,
    },
    badgeText: { color: "#3A2400", fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
    codeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.16)" : "rgba(11,90,58,0.08)",
    },
    codeText: { color: accent, fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
    priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    oldPrice: {
      fontSize: 15,
      color: c.textMuted,
      textDecorationLine: "line-through",
      fontWeight: "600",
      marginBottom: 2,
    },
    newPrice: { fontSize: 26, fontWeight: "900", color: accent, letterSpacing: -0.5 },
    countdownRow: { flexDirection: "row", alignItems: "center" },
    countdownLabel: { fontSize: 12.5, color: c.textDim, fontWeight: "600" },
    countdownValue: { fontSize: 13, color: c.text, fontWeight: "800", fontVariant: ["tabular-nums"] },
  });
}
