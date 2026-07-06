import { router } from "expo-router";
import { ChevronLeft, Crown, Receipt } from "lucide-react-native";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT, PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { formatUzs, getTariff } from "@/constants/tariffs";
import { useActiveSubscription, useMyOrders } from "@/hooks/usePayments";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { OrderStatus, PaymentOrder } from "@/types/payments";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Kutilmoqda",
  paid: "To'langan",
  failed: "Amalga oshmadi",
  canceled: "Bekor qilingan",
};

function statusColor(status: OrderStatus, c: AppTheme): string {
  if (status === "paid") return c.success;
  if (status === "failed" || status === "canceled") return "#E5484D";
  return c.gold;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export default function XaridlarScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isAuthenticated } = useAuth();
  const { data: orders, isLoading } = useMyOrders();
  const sub = useActiveSubscription();
  const tariff = getTariff(sub?.plan_key);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Mening xaridlarim</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 16 }}
      >
        {sub ? (
          <PressableScale onPress={() => router.push("/payments/tarifim")} style={styles.tariffBanner}>
            <View style={styles.crown}>
              <Crown color="#fff" size={18} fill="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tariffName}>{tariff?.title ?? "Faol tarif"}</Text>
              <Text style={styles.tariffSub}>Faol tarif — batafsil ko'rish</Text>
            </View>
          </PressableScale>
        ) : null}

        <Text style={styles.sectionLabel}>BUYURTMALAR TARIXI</Text>

        {isAuthenticated && isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        ) : orders && orders.length > 0 ? (
          <View style={styles.list}>
            {orders.map((order, i) => (
              <OrderRow
                key={order.id}
                order={order}
                isLast={i === orders.length - 1}
                styles={styles}
                c={c}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Receipt color={c.primary} size={26} />
            </View>
            <Text style={styles.emptyTitle}>Hali xaridlar yo'q</Text>
            <Text style={styles.emptySub}>
              Kontent yoki tarif sotib olganingizda, u shu yerda ko'rinadi.
            </Text>
            <PressableScale
              onPress={() => router.push(isAuthenticated ? "/payments/tariflar" : "/auth")}
              style={styles.emptyBtn}
            >
              <Text style={styles.emptyBtnText}>Tariflarni ko'rish</Text>
            </PressableScale>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function OrderRow({
  order,
  isLast,
  styles,
  c,
}: {
  order: PaymentOrder;
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
}) {
  const status = order.status;
  const date = formatDate(order.paid_at ?? order.created_at);
  return (
    <View style={[styles.row, ...(isLast ? [] : [styles.rowBorder])]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {order.title || "Xarid"}
        </Text>
        <Text style={styles.rowMeta}>
          {`${order.order_number}${date ? ` · ${date}` : ""}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.rowAmount}>{formatUzs(order.amount_uzs)}</Text>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor(status, c)}22` }]}>
          <Text style={[styles.statusText, { color: statusColor(status, c) }]}>
            {STATUS_LABEL[status] ?? status}
          </Text>
        </View>
      </View>
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
    tariffBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.primary,
      borderRadius: 18,
      padding: 16,
    },
    crown: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    tariffName: { color: "#fff", fontSize: 16, fontWeight: "800" },
    tariffSub: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: 2, fontWeight: "600" },
    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginTop: 26,
      marginBottom: 12,
    },
    list: {
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    rowTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    rowMeta: { fontSize: 12, color: c.textMuted, marginTop: 3, fontWeight: "500" },
    rowAmount: { fontSize: 14.5, fontWeight: "800", color: c.text },
    statusPill: { marginTop: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
    statusText: { fontSize: 11, fontWeight: "800" },
    empty: { alignItems: "center", marginTop: 40, paddingHorizontal: 10 },
    emptyIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { fontSize: 19, fontWeight: "800", color: c.text, marginTop: 14 },
    emptySub: { fontSize: 14, color: c.textDim, textAlign: "center", lineHeight: 20, marginTop: 8 },
    emptyBtn: {
      marginTop: 18,
      height: 48,
      paddingHorizontal: 24,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
}
