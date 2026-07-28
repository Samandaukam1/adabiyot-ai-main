import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Check, X } from "lucide-react-native";
import React, { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
const DEEP_GREEN_GRADIENT: readonly [string, string] = [DEEP_GREEN, "#11998E"];

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
  const scrollRef = useRef<ScrollView>(null);

  // Opening the promo field raises the keyboard over the bottom of the sheet.
  // KeyboardAvoidingView lifts the sheet; this scrolls the input + "Qo'llash"
  // + the pay button into what's left of the visible area.
  const handlePromoExpanded = useCallback((expanded: boolean) => {
    if (!expanded) return;
    // After the keyboard's own animation, otherwise we scroll the old layout.
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* iOS pads the sheet up, Android resizes it. On web there is no
          software keyboard to avoid, so no behavior at all. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined
        }
      >
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 18 }}
          >
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
                onExpandedChange={handlePromoExpanded}
              />
            </View>
          ) : null}

          <PressableScale
            onPress={busy ? undefined : onConfirm}
            style={[styles.ctaWrap, ...(busy ? [styles.ctaWrapDisabled] : [])]}
          >
            <LinearGradient
              colors={busy ? ([c.textMuted, c.textMuted] as const) : DEEP_GREEN_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.ctaText}>{busy ? "Iltimos, kuting…" : "To'lovni davom ettirish"}</Text>
              {busy ? null : <ArrowRight color="#fff" size={21} strokeWidth={2.6} />}
            </LinearGradient>
          </PressableScale>

          <Text style={styles.note}>
            To'lov AdabiyotX backend orqali xavfsiz amalga oshiriladi.
          </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  const accent = isDark ? c.secondary : DEEP_GREEN;
  return StyleSheet.create({
    flex: { flex: 1 },
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
      // Bounded so the inner ScrollView can actually scroll once the keyboard
      // has eaten the bottom half of the screen.
      maxHeight: "92%",
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
    // The pay button is the whole point of this sheet — tall and unmistakable.
    // The shadow is neutral and low, never a coloured halo.
    ctaWrap: {
      marginTop: 24,
      borderRadius: 18,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.3 : 0.14,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    ctaWrapDisabled: { shadowOpacity: 0, elevation: 0 },
    cta: {
      height: 60,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    ctaText: { color: "#fff", fontSize: 17.5, fontWeight: "800", letterSpacing: 0.3 },
    note: {
      marginTop: 12,
      fontSize: 12,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 17,
    },
  });
}
