import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BuyConfirmSheet from "@/components/payments/BuyConfirmSheet";
import CardPaymentSheet from "@/components/payments/CardPaymentSheet";
import TariffCard from "@/components/payments/TariffCard";
import { FONT } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { TARIFFS, type Tariff } from "@/constants/tariffs";
import { usePurchaseFlow } from "@/hooks/usePayments";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function TariflarScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isAuthenticated } = useAuth();

  const [selected, setSelected] = useState<Tariff | null>(null);
  const purchase = usePurchaseFlow();

  const handleSelect = (tariff: Tariff) => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    setSelected(tariff);
  };

  const handleConfirm = () => {
    if (!selected) return;
    const planKey = selected.planKey;
    setSelected(null);
    void purchase.start({ plan_key: planKey });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Tariflar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 12 }}
      >
        <Text style={styles.lead}>AdabiyotX tariflari</Text>
        <Text style={styles.sub}>
          30 kunlik kirish. Tarif muddati tugagach, uni qo'lda qayta sotib olishingiz mumkin.
        </Text>

        {TARIFFS.map((tariff) => (
          <TariffCard key={tariff.planKey} tariff={tariff} onSelect={handleSelect} />
        ))}
      </ScrollView>

      <BuyConfirmSheet
        visible={!!selected}
        title={selected?.title ?? ""}
        priceUzs={selected?.priceUzs ?? 0}
        benefits={selected?.features ?? []}
        onConfirm={handleConfirm}
        onClose={() => setSelected(null)}
      />

      <CardPaymentSheet
        flow={purchase}
        success={{
          kind: "subscription",
          onPrimary: () => {
            purchase.reset();
            router.replace("/payments/tarifim");
          },
          onSecondary: () => {
            purchase.reset();
            router.replace("/");
          },
        }}
        onClose={purchase.reset}
      />
    </View>
  );
}

function createStyles(c: AppTheme, _isDark: boolean) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },
    lead: {
      fontSize: 26,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -0.5,
      marginBottom: 8,
      marginTop: 6,
      fontFamily: FONT.serif,
    },
    sub: { fontSize: 14, color: c.textDim, lineHeight: 20, marginBottom: 22 },
  });
}
