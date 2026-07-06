import { router } from "expo-router";
import { Lock, ShoppingBag, Sparkles } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui";
import { formatUzs } from "@/constants/tariffs";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";
import { CONTENT_TYPE_LABEL, type PaymentContentType } from "@/types/payments";

/**
 * Paywall card shown in place of locked paid content. Offers two paths: buy the
 * single item ("Sotib olish") or unlock via a tariff ("Tarif tanlash").
 */
export default function PremiumPaywallCard({
  contentType,
  title,
  priceUzs,
  onBuy,
  onSelectTariff,
}: {
  contentType: PaymentContentType;
  title?: string;
  priceUzs: number;
  onBuy: () => void;
  onSelectTariff?: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const label = CONTENT_TYPE_LABEL[contentType] ?? "kontent";

  const handleTariff = onSelectTariff ?? (() => router.push("/payments/tariflar"));

  return (
    <View style={styles.card}>
      <View style={styles.lockBadge}>
        <Lock color={c.primary} size={22} />
      </View>

      <Text style={styles.title}>Bu {label} pullik</Text>
      {title ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {title}
        </Text>
      ) : null}

      <Text style={styles.price}>{`Ushbu ${label}: ${formatUzs(priceUzs)}`}</Text>

      <PressableScale onPress={onBuy} style={styles.buyBtn}>
        <View style={styles.btnInner}>
          <ShoppingBag color="#fff" size={18} />
          <Text style={styles.buyText}>Sotib olish</Text>
        </View>
      </PressableScale>

      <PressableScale onPress={handleTariff} style={styles.tariffBtn}>
        <View style={styles.btnInner}>
          <Sparkles color={c.primary} size={17} />
          <Text style={styles.tariffText}>Tarif tanlash</Text>
        </View>
      </PressableScale>

      <Text style={styles.hint}>Tarif orqali ochsangiz, ko'plab kontentga ruxsat ochiladi.</Text>
    </View>
  );
}

function createStyles(c: AppTheme) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 20,
      marginTop: 12,
      borderRadius: 22,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.borderStrong,
      padding: 22,
      alignItems: "center",
    },
    lockBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: c.text,
      marginTop: 16,
      textAlign: "center",
      letterSpacing: -0.3,
    },
    subtitle: { fontSize: 14, color: c.textDim, marginTop: 6, textAlign: "center", lineHeight: 20 },
    price: { fontSize: 20, fontWeight: "800", color: c.primary, marginTop: 14 },
    buyBtn: {
      marginTop: 18,
      height: 52,
      width: "100%",
      borderRadius: 15,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    tariffBtn: {
      marginTop: 10,
      height: 50,
      width: "100%",
      borderRadius: 15,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    btnInner: { flexDirection: "row", alignItems: "center", gap: 9 },
    buyText: { color: "#fff", fontSize: 15.5, fontWeight: "800", letterSpacing: 0.2 },
    tariffText: { color: c.primary, fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
    hint: { fontSize: 12, color: c.textMuted, marginTop: 14, textAlign: "center", lineHeight: 17 },
  });
}
