import { LinearGradient } from "expo-linear-gradient";
import { ShoppingCart } from "lucide-react-native";
import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { cursorPointer } from "@/components/web/webStyle";
import type { AppTheme } from "@/constants/colors";
import { formatUzs } from "@/constants/tariffs";
import { PAYMENT_PRODUCT_MISSING_MESSAGE } from "@/hooks/usePayments";
import { useTheme } from "@/providers/ThemeProvider";

export interface BookPurchaseCtaProps {
  /** Only used for the `[BookPurchaseCTA]` debug log. */
  contentId?: string | null;
  isFree: boolean;
  purchased: boolean;
  /** Entitlements still in flight — we cannot claim the book is unpurchased yet. */
  checkingAccess: boolean;
  /** `payment_products` row still loading. */
  productLoading: boolean;
  hasProduct: boolean;
  price: number;
  onPress: () => void;
  /** Outer spacing — the phone layout needs the page's 20pt gutter, the web hero does not. */
  style?: ViewStyle | ViewStyle[];
}

/**
 * The one "Sotib olish" call to action for a paid book, shared by the phone and
 * the desktop-web layouts so both always agree on when it is visible.
 *
 * It disappears only when the book is free or already owned — never because a
 * query is still in flight: while access or the price is loading it stays on
 * screen in a disabled state, and when the `payment_products` row is missing it
 * explains that the admin has to re-save the price.
 */
export default function BookPurchaseCta({
  contentId,
  isFree,
  purchased,
  checkingAccess,
  productLoading,
  hasProduct,
  price,
  onPress,
  style,
}: BookPurchaseCtaProps) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log("[BookPurchaseCTA]", {
      bookId: contentId,
      isFree,
      purchased,
      checkingAccess,
      paymentProductLoading: productLoading,
      hasPaymentProduct: hasProduct,
      price,
    });
  }, [contentId, isFree, purchased, checkingAccess, productLoading, hasProduct, price]);

  if (isFree || purchased) return null;

  const missingProduct = !hasProduct && !checkingAccess && !productLoading;
  const disabled = checkingAccess || productLoading || missingProduct;
  const label = checkingAccess
    ? "Xarid holati tekshirilmoqda…"
    : productLoading
    ? "Narx yuklanmoqda…"
    : price > 0
    ? `${formatUzs(price)} ga sotib olish`
    : "Sotib olish";

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={disabled ? null : cursorPointer}
        testID="book-purchase-cta"
      >
        <LinearGradient
          colors={["#11998E", "#38EF7D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, disabled ? styles.buttonDisabled : null]}
        >
          {checkingAccess || productLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ShoppingCart color="#fff" size={19} />
          )}
          <Text style={styles.buttonText} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>

      {missingProduct ? <Text style={styles.note}>{PAYMENT_PRODUCT_MISSING_MESSAGE}</Text> : null}
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    wrap: { width: "100%" },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 26,
      paddingVertical: 16,
      borderRadius: 16,
      shadowColor: "#11998E",
      shadowOpacity: isDark ? 0.4 : 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
    note: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  });
}
