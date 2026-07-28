import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Info,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT, PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { formatUzs, getTariff, TARIFFS } from "@/constants/tariffs";
import { useActiveSubscription, useMyEntitlements } from "@/hooks/usePayments";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

/** The payments module's deep green — dark enough for white text to sit on it. */
const DEEP_GREEN = "#0B5A3A";
const GRADIENT: [string, string] = [DEEP_GREEN, "#11998E"];

/** What a tariff actually buys. Shown when the user has none. */
const SELLING_POINTS = [
  "Yuzlab kitob, she'r va ssenariyga ruxsat",
  "Audio talqinlar va Jaxongir AI",
  "Marafonlar va AdabiyotX kuponlari",
];

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
  const openTariffs = () => router.push(isAuthenticated ? "/payments/tariflar" : "/auth");

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
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          paddingTop: 16,
        }}
      >
        {isAuthenticated && isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 60 }} />
        ) : sub ? (
          <>
            <LinearGradient
              colors={GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planCard}
            >
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
            </LinearGradient>

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

            <PressableScale onPress={() => router.push("/payments/tariflar")} style={styles.ctaWrap}>
              <LinearGradient
                colors={GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Crown color="#fff" size={19} fill="#fff" />
                <Text style={styles.ctaText}>Tarifni yangilash</Text>
              </LinearGradient>
            </PressableScale>

            <View style={styles.noteCard}>
              <Info color={c.textDim} size={16} />
              <Text style={styles.noteText}>
                Tarif muddati tugagach, uni qo'lda qayta sotib olishingiz mumkin.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* One composed hero instead of a lone button on an empty screen:
                it says what a tariff is for and carries the action itself. */}
            <LinearGradient
              colors={GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroCrown}>
                <Crown color="#fff" size={26} fill="#fff" />
              </View>

              <Text style={styles.heroTitle}>Faol tarif yo&apos;q</Text>
              <Text style={styles.heroSub}>
                AdabiyotX tariflaridan birini tanlang va kutubxonani to&apos;liq oching.
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.points}>
                {SELLING_POINTS.map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <View style={styles.pointCheck}>
                      <Check color="#fff" size={12} strokeWidth={3.2} />
                    </View>
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
              </View>

              <PressableScale onPress={openTariffs} style={styles.heroCta}>
                <Text style={styles.heroCtaText}>Tarif tanlash</Text>
                <ArrowRight color={DEEP_GREEN} size={20} strokeWidth={2.6} />
              </PressableScale>
            </LinearGradient>

            {/* Prices up front, so the screen answers "how much?" without a tap. */}
            <Text style={styles.listLabel}>TARIFLAR</Text>
            <View style={styles.listCard}>
              {TARIFFS.map((item, index) => (
                <Pressable
                  key={item.planKey}
                  onPress={openTariffs}
                  style={({ pressed }) => [
                    styles.listRow,
                    ...(index === TARIFFS.length - 1 ? [styles.listRowLast] : []),
                    ...(pressed ? [{ opacity: 0.6 }] : []),
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.listTitleRow}>
                      <Text style={styles.listTitle}>{item.title}</Text>
                      {item.badge ? (
                        <View style={styles.listBadge}>
                          <Text style={styles.listBadgeText}>Maqbul</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.listPeriod}>{item.period}</Text>
                  </View>
                  <Text style={styles.listPrice}>{formatUzs(item.priceUzs)}</Text>
                  <ChevronRight color={c.textMuted} size={18} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.footNote}>
              Tarif 30 kunlik. Avtomatik yangilanmaydi — muddati tugagach o&apos;zingiz qayta
              sotib olasiz.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
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

    /* ── active subscription ───────────────────────────────────────────── */
    planCard: {
      borderRadius: 26,
      padding: 22,
      // Soft and low, never a halo: a wide bright glow around a coloured shape
      // reads as a rendering artefact rather than as depth.
      shadowColor: DEEP_GREEN,
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
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

    // `overflow: hidden` on the wrapper, so the gradient keeps the radius.
    ctaWrap: { marginTop: 20, borderRadius: 18, overflow: "hidden" },
    cta: {
      height: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    ctaText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },

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

    /* ── no subscription ───────────────────────────────────────────────── */
    hero: {
      borderRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 26,
      paddingBottom: 22,
      shadowColor: DEEP_GREEN,
      shadowOpacity: 0.2,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 6,
    },
    heroCrown: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.24)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      color: "#fff",
      fontSize: 27,
      fontWeight: "800",
      marginTop: 18,
      letterSpacing: -0.5,
      fontFamily: FONT.serif,
    },
    heroSub: {
      color: "rgba(255,255,255,0.86)",
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
      fontWeight: "500",
    },
    heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.18)", marginTop: 20 },
    points: { marginTop: 18, gap: 12 },
    pointRow: { flexDirection: "row", alignItems: "center", gap: 11 },
    pointCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    pointText: { flex: 1, color: "#fff", fontSize: 14.5, lineHeight: 20, fontWeight: "600" },
    heroCta: {
      marginTop: 24,
      height: 56,
      borderRadius: 17,
      backgroundColor: "#fff",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      // Grounds the white pill on the gradient without glowing.
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    heroCtaText: { color: DEEP_GREEN, fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },

    listLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginTop: 28,
      marginBottom: 10,
    },
    listCard: {
      backgroundColor: c.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    listRowLast: { borderBottomWidth: 0 },
    listTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    listTitle: { color: c.text, fontSize: 15.5, fontWeight: "700" },
    listBadge: {
      backgroundColor: c.gold,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    listBadgeText: { color: "#3A2400", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
    listPeriod: { color: c.textMuted, fontSize: 12.5, marginTop: 3, fontWeight: "600" },
    listPrice: { color: isDark ? c.secondary : DEEP_GREEN, fontSize: 15, fontWeight: "800" },

    footNote: {
      marginTop: 18,
      fontSize: 12.5,
      lineHeight: 19,
      color: c.textMuted,
      textAlign: "center",
      fontWeight: "500",
    },
  });
}
