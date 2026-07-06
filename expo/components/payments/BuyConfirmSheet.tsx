import { Check, X } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PromoCodeInput from "@/components/payments/PromoCodeInput";
import { FONT, PressableScale } from "@/components/ui";
import { formatUzs } from "@/constants/tariffs";
import type { AppTheme } from "@/constants/colors";
import type { PromoState } from "@/hooks/usePromo";
import { useTheme } from "@/providers/ThemeProvider";

const DEEP_GREEN = "#0B5A3A";

/**
 * Confirmation bottom sheet shown before payment. Lists the product, its price
 * and what the user gets, with a single deep-green "To'lovni davom ettirish" CTA.
 */
export default function BuyConfirmSheet({
  visible,
  title,
  priceUzs,
  benefits = [],
  onConfirm,
  onClose,
  busy = false,
  promo,
}: {
  visible: boolean;
  title: string;
  priceUzs: number;
  benefits?: string[];
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  /** Optional promo state (from `usePromo`) — enables the discount UI. */
  promo?: PromoState;
}) {
  const { colors: c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const promoActive = !!promo?.isActive && !!promo.pricing;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.heading}>To'lovni tasdiqlash</Text>
            <Pressable onPress={busy ? undefined : onClose} hitSlop={10} style={styles.closeBtn}>
              <X color={c.textDim} size={20} />
            </Pressable>
          </View>

          <Text style={styles.productTitle} numberOfLines={2}>
            {title}
          </Text>

          {promoActive && promo?.pricing ? (
            <View style={styles.breakdown}>
              <View style={styles.brRow}>
                <Text style={styles.brLabel}>Asl narx</Text>
                <Text style={styles.brOld}>{formatUzs(promo.pricing.original_amount_uzs)}</Text>
              </View>
              <View style={styles.brRow}>
                <View style={styles.brDiscountLabel}>
                  <Text style={styles.brLabel}>Chegirma</Text>
                  <View style={styles.brBadge}>
                    <Text style={styles.brBadgeText}>-{promo.pricing.discount_percent}%</Text>
                  </View>
                </View>
                <Text style={styles.brDiscount}>−{formatUzs(promo.pricing.discount_amount_uzs)}</Text>
              </View>
              <View style={styles.brDivider} />
              <View style={styles.brRow}>
                <Text style={styles.brTotalLabel}>To'lov summasi</Text>
                <Text style={styles.brTotal}>{formatUzs(promo.pricing.final_amount_uzs)}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.price}>{formatUzs(priceUzs)}</Text>
          )}

          {benefits.length > 0 ? (
            <View style={styles.benefits}>
              {benefits.map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <View style={styles.checkDot}>
                    <Check color="#fff" size={12} strokeWidth={3} />
                  </View>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {promo ? (
            <View style={styles.promoSection}>
              <PromoCodeInput
                appliedCode={promo.appliedCode}
                validating={promo.validating}
                error={promo.error}
                success={promo.justApplied}
                onApply={promo.apply}
                onRemove={promo.remove}
              />
            </View>
          ) : null}

          <PressableScale
            onPress={busy ? undefined : onConfirm}
            style={[styles.cta, ...(busy ? [styles.ctaDisabled] : [])]}
          >
            <View style={styles.ctaInner}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.ctaText}>{busy ? "Iltimos, kuting…" : "To'lovni davom ettirish"}</Text>
            </View>
          </PressableScale>

          <Text style={styles.note}>
            To'lov AdabiyotX backend orqali xavfsiz amalga oshiriladi.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  const accent = isDark ? c.secondary : DEEP_GREEN;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 22,
      paddingTop: 10,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginBottom: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heading: { fontSize: 15, fontWeight: "700", color: c.textDim, letterSpacing: 0.2 },
    closeBtn: { padding: 2 },
    productTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      marginTop: 14,
      letterSpacing: -0.4,
      fontFamily: FONT.serif,
    },
    price: { fontSize: 26, fontWeight: "800", color: c.primary, marginTop: 6 },

    breakdown: {
      marginTop: 14,
      borderRadius: 16,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(11,90,58,0.05)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.24)" : "rgba(11,90,58,0.12)",
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 9,
    },
    brRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brLabel: { fontSize: 13.5, color: c.textDim, fontWeight: "600" },
    brOld: { fontSize: 14, color: c.textMuted, textDecorationLine: "line-through", fontWeight: "600" },
    brDiscountLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
    brBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: c.gold },
    brBadgeText: { fontSize: 11, fontWeight: "900", color: "#3A2400" },
    brDiscount: { fontSize: 14, color: accent, fontWeight: "800" },
    brDivider: { height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(11,90,58,0.10)" },
    brTotalLabel: { fontSize: 14.5, color: c.text, fontWeight: "800" },
    brTotal: { fontSize: 22, color: accent, fontWeight: "900", letterSpacing: -0.4 },

    promoSection: { marginTop: 18 },

    benefits: { marginTop: 18, gap: 12 },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    checkDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    benefitText: { flex: 1, fontSize: 14.5, color: c.text, lineHeight: 20 },
    cta: {
      marginTop: 24,
      height: 54,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaDisabled: { backgroundColor: c.textMuted },
    ctaInner: { flexDirection: "row", alignItems: "center", gap: 10 },
    ctaText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
    note: {
      marginTop: 12,
      fontSize: 12,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 17,
    },
  });
}
