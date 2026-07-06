import { router } from "expo-router";
import { CalendarClock, ChevronLeft, Crown, Info } from "lucide-react-native";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT, PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { getTariff } from "@/constants/tariffs";
import { useActiveSubscription, useMyEntitlements } from "@/hooks/usePayments";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

/** "29-iyun, 2026" style date from an ISO string. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const months = [
    "yanvar", "fevral", "mart", "aprel", "may", "iyun",
    "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
  ];
  return `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export default function TarifimScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isAuthenticated } = useAuth();
  const { isLoading } = useMyEntitlements();
  const sub = useActiveSubscription();

  const tariff = getTariff(sub?.plan_key);
  const planTitle = tariff?.title ?? (sub?.plan_key ? `AdabiyotX ${sub.plan_key}` : "Tarif");

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Mening tarifim</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 16 }}
      >
        {isAuthenticated && isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 60 }} />
        ) : sub ? (
          <>
            <View style={styles.planCard}>
              <View style={styles.planTop}>
                <View style={styles.crown}>
                  <Crown color="#fff" size={20} fill="#fff" />
                </View>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Faol</Text>
                </View>
              </View>
              <Text style={styles.planTitle}>{planTitle}</Text>

              <View style={styles.metaRow}>
                <CalendarClock color="rgba(255,255,255,0.9)" size={16} />
                <Text style={styles.metaText}>{`Amal qiladi: ${formatDate(sub.ends_at)}`}</Text>
              </View>
            </View>

            {sub.monthly_limit != null || sub.weekly_limit != null ? (
              <View style={styles.limitsCard}>
                {sub.monthly_limit != null ? (
                  <View style={styles.limitRow}>
                    <Text style={styles.limitLabel}>Oylik limit</Text>
                    <Text style={styles.limitValue}>
                      {`${sub.monthly_used ?? 0} / ${sub.monthly_limit}`}
                    </Text>
                  </View>
                ) : null}
                {sub.weekly_limit != null ? (
                  <View style={[styles.limitRow, styles.limitRowLast]}>
                    <Text style={styles.limitLabel}>Haftalik limit</Text>
                    <Text style={styles.limitValue}>
                      {`${sub.weekly_used ?? 0} / ${sub.weekly_limit}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <PressableScale onPress={() => router.push("/payments/tariflar")} style={styles.renewBtn}>
              <Text style={styles.renewText}>Tarifni yangilash</Text>
            </PressableScale>

            <View style={styles.noteCard}>
              <Info color={c.textDim} size={16} />
              <Text style={styles.noteText}>
                Tarif muddati tugagach, uni qo'lda qayta sotib olishingiz mumkin.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Crown color={c.primary} size={28} />
            </View>
            <Text style={styles.emptyTitle}>Faol tarif yo'q</Text>
            <Text style={styles.emptySub}>
              AdabiyotX tariflaridan birini tanlang va ko'plab kontentga ruxsat oching.
            </Text>
            <PressableScale
              onPress={() => router.push(isAuthenticated ? "/payments/tariflar" : "/auth")}
              style={styles.renewBtn}
            >
              <Text style={styles.renewText}>Tarif tanlash</Text>
            </PressableScale>
          </View>
        )}
      </ScrollView>
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
    planCard: {
      borderRadius: 24,
      backgroundColor: c.primary,
      padding: 22,
      shadowColor: c.primary,
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
    planTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    crown: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    activePill: {
      backgroundColor: "rgba(255,255,255,0.22)",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
    },
    activePillText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    planTitle: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 16, letterSpacing: -0.4 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    metaText: { color: "rgba(255,255,255,0.92)", fontSize: 14, fontWeight: "600" },
    limitsCard: {
      marginTop: 16,
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
    },
    limitRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    limitRowLast: { borderBottomWidth: 0 },
    limitLabel: { fontSize: 14.5, color: c.textDim, fontWeight: "600" },
    limitValue: { fontSize: 15, color: c.text, fontWeight: "800" },
    renewBtn: {
      marginTop: 18,
      height: 52,
      borderRadius: 15,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    renewText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
    noteCard: {
      marginTop: 16,
      flexDirection: "row",
      gap: 10,
      backgroundColor: c.soft,
      borderRadius: 16,
      padding: 14,
      alignItems: "flex-start",
    },
    noteText: { flex: 1, fontSize: 13, color: c.textDim, lineHeight: 19 },
    empty: { alignItems: "center", marginTop: 50, paddingHorizontal: 10 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { fontSize: 20, fontWeight: "800", color: c.text, marginTop: 16 },
    emptySub: { fontSize: 14, color: c.textDim, textAlign: "center", lineHeight: 20, marginTop: 8 },
  });
}
