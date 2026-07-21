import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  UserX,
  Wallet,
} from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { formatUzs } from "@/constants/tariffs";
import { useEffectiveAuthorId, useIsAuthor } from "@/hooks/useAuthorAccount";
import { useAuthorRoyalty } from "@/hooks/useAuthorRoyalty";
import { useTheme } from "@/providers/ThemeProvider";
import {
  contentRoute,
  contentTypeLabel,
  formatSaleDateTime,
} from "@/types/author";
import {
  ledgerTypeMeta,
  payoutStatusLabel,
  type RoyaltyLedgerEntry,
} from "@/types/authorRoyalty";

export default function AuthorEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const isAuthor = useIsAuthor();
  // Don't flash "muallif emas" while the authors→account reverse link is
  // still being resolved for accounts without profiles.author_id.
  const { loading: authorResolving } = useEffectiveAuthorId();
  const {
    summary,
    ledger,
    loading,
    error,
    refetch,
    hasComplaint,
    submitComplaint,
    submittingLedgerId,
  } = useAuthorRoyalty();
  // Prefer the summary's count; fall back to counting loaded sale ledger rows.
  const salesCount =
    summary.salesCount || ledger.filter((entry) => entry.transactionType === "sale").length;
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const onComplain = React.useCallback(
    (entry: RoyaltyLedgerEntry) => {
      Alert.alert(
        "Shikoyat yuborish",
        "“Menga hali pul yetib kelmadi” shikoyati admin panelga yuborilsinmi?",
        [
          { text: "Bekor qilish", style: "cancel" },
          {
            text: "Yuborish",
            onPress: () => {
              submitComplaint(entry.id)
                .then(() => {
                  Alert.alert(
                    "Yuborildi",
                    "Shikoyatingiz admin panelga yuborildi. Tez orada ko'rib chiqiladi."
                  );
                })
                .catch((err: unknown) => {
                  Alert.alert(
                    "Xatolik",
                    err instanceof Error
                      ? err.message
                      : "Shikoyat yuborilmadi. Qayta urinib ko'ring."
                  );
                });
            },
          },
        ]
      );
    },
    [submitComplaint]
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft color={c.text} size={22} />
        </PressableScale>
        <Text style={styles.topTitle}>Muallif daromadlari</Text>
        <PressableScale onPress={onRefresh} style={styles.iconBtn}>
          <RefreshCw color={c.text} size={18} />
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        }
      >
        {!isAuthor ? (
          authorResolving ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 60 }} />
          ) : (
            <NotAuthorState c={c} styles={styles} />
          )
        ) : (
          <>
            {/* ─── HERO — mavjud balans ──────────────────────────── */}
            <LinearGradient
              colors={isDark ? ["#12352A", "#1B4D3A", "#0F2C22"] : ["#2D9B6F", "#1F8A5F", "#0F7A52"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroIcon}>
                  <Wallet color="#fff" size={18} strokeWidth={2.4} />
                </View>
                <View style={styles.sharePill}>
                  <BadgeCheck color="#fff" size={13} />
                  <Text style={styles.sharePillText}>
                    Muallif ulushi {Math.round(summary.royaltyPercent)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.heroLabel}>Mavjud balans</Text>
              {loading ? (
                <View style={styles.heroSkeleton} />
              ) : (
                <Text style={styles.heroValue}>{formatUzs(summary.availableBalance)}</Text>
              )}
              <Text style={styles.heroSub}>
                Asarlaringiz sotuvidan hali to'lanmagan ulushingiz
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.heroBalanceRow}>
                <HeroBalance
                  label="Jami topilgan"
                  value={formatUzs(summary.totalEarned)}
                  accent="#B9F6CA"
                  loading={loading}
                />
                <View style={styles.heroBalanceDiv} />
                <HeroBalance
                  label="Jami to'langan"
                  value={formatUzs(summary.totalPaid)}
                  accent="#BBDEFB"
                  loading={loading}
                />
                <View style={styles.heroBalanceDiv} />
                <HeroBalance
                  label="Shu yil to'landi"
                  value={formatUzs(summary.paidThisYear)}
                  accent="#FFE0A3"
                  loading={loading}
                />
              </View>
            </LinearGradient>

            {/* ─── STAT CARDS ────────────────────────────────────── */}
            <View style={styles.statGrid}>
              <StatCard
                styles={styles}
                icon={<TrendingUp color="#2D9B6F" size={18} strokeWidth={2.2} />}
                tint={isDark ? "rgba(45,155,111,0.14)" : "#E8F5EE"}
                label="Jami ishlab topilgan"
                value={loading ? "—" : formatUzs(summary.totalEarned)}
              />
              <StatCard
                styles={styles}
                icon={<ShoppingBag color="#8B5CF6" size={18} strokeWidth={2.2} />}
                tint={isDark ? "rgba(139,92,246,0.14)" : "#F1ECFE"}
                label="Sotuvlar soni"
                value={loading ? "—" : String(salesCount)}
              />
            </View>

            {/* ─── DAROMADLAR TARIXI ─────────────────────────────── */}
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>Daromadlar tarixi</Text>
              <Text style={styles.sectionHint}>
                Sotuvlar, to'lovlar va tuzatishlar — barchasi bitta ro'yxatda
              </Text>
            </View>

            {error ? (
              <ErrorState c={c} styles={styles} onRetry={onRefresh} />
            ) : loading ? (
              <View style={{ gap: 12, paddingHorizontal: 20 }}>
                <RowSkeleton styles={styles} />
                <RowSkeleton styles={styles} />
                <RowSkeleton styles={styles} />
              </View>
            ) : ledger.length === 0 ? (
              <EmptyState c={c} styles={styles} />
            ) : (
              <View style={{ gap: 12, paddingHorizontal: 20 }}>
                {ledger.map((entry) => (
                  <LedgerRow
                    key={entry.id}
                    entry={entry}
                    c={c}
                    styles={styles}
                    complained={hasComplaint(entry.id)}
                    submitting={submittingLedgerId === entry.id}
                    onComplain={() => onComplain(entry)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── SUB-COMPONENTS ─────────────────────────────────────────────── */

function HeroBalance({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={hbStyles.value} numberOfLines={1}>
        {loading ? "—" : value}
      </Text>
      <Text style={[hbStyles.label, { color: accent }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const hbStyles = StyleSheet.create({
  value: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: -0.3 },
  label: { fontSize: 10.5, fontWeight: "700", marginTop: 3 },
});

function StatCard({
  styles,
  icon,
  tint,
  label,
  value,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function LedgerRow({
  entry,
  c,
  styles,
  complained,
  submitting,
  onComplain,
}: {
  entry: RoyaltyLedgerEntry;
  c: AppTheme;
  styles: ReturnType<typeof createStyles>;
  complained: boolean;
  submitting: boolean;
  onComplain: () => void;
}) {
  const meta = ledgerTypeMeta(entry.transactionType, entry.royaltyAmount);
  const isPayout = entry.transactionType === "payout";
  const isSale = entry.transactionType === "sale";
  const disputed = entry.payoutStatus === "disputed" || complained;
  const disputedLabel =
    payoutStatusLabel(entry.payoutStatus) ?? (complained ? "Shikoyat yuborildi" : null);
  const amount = Math.abs(entry.royaltyAmount);
  const when = isPayout
    ? entry.payoutDate ?? entry.createdAt
    : entry.createdAt;
  const title =
    entry.contentTitle ??
    entry.description ??
    (isPayout ? "Muallifga to'lov" : meta.label);
  const onPress =
    isSale && entry.contentId
      ? () => router.push(contentRoute(entry.contentType, entry.contentId as string) as never)
      : undefined;

  return (
    <PressableScale onPress={onPress} style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.rowMetaLine}>
        {entry.contentType ? (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{contentTypeLabel(entry.contentType)}</Text>
          </View>
        ) : null}
        <Clock3 color={c.textMuted} size={12} />
        <Text style={styles.rowDate}>{formatSaleDateTime(when)}</Text>
      </View>

      {/* Amount line: sale "+", payout "−" */}
      <View style={styles.amountLine}>
        <Text style={[styles.amountText, { color: meta.color }]}>
          {meta.sign} {formatUzs(amount)}
        </Text>
        {isSale && entry.royaltyPercent != null ? (
          <Text style={styles.amountHint}>
            Sotuv {formatUzs(entry.grossAmount)} · ulush {Math.round(entry.royaltyPercent)}%
          </Text>
        ) : null}
      </View>

      {entry.description && entry.contentTitle ? (
        <Text style={styles.rowDesc} numberOfLines={2}>
          {entry.description}
        </Text>
      ) : null}

      {isPayout && entry.payoutReference ? (
        <Text style={styles.rowOrder} numberOfLines={1}>
          To'lov raqami: {entry.payoutReference}
        </Text>
      ) : null}

      {/* Payout: "pul yetib kelmadi" complaint */}
      {isPayout ? (
        disputed ? (
          <View style={styles.complaintDone}>
            <AlertCircle color="#B45309" size={14} />
            <Text style={styles.complaintDoneText}>
              {disputedLabel ?? "Ko'rib chiqilmoqda"}
            </Text>
          </View>
        ) : (
          <PressableScale
            onPress={submitting ? undefined : onComplain}
            style={styles.complaintBtn}
          >
            {submitting ? (
              <ActivityIndicator color="#B45309" size="small" />
            ) : (
              <AlertCircle color="#B45309" size={14} />
            )}
            <Text style={styles.complaintBtnText}>Menga hali pul yetib kelmadi</Text>
          </PressableScale>
        )
      ) : null}
    </PressableScale>
  );
}

function NotAuthorState({ c, styles }: { c: AppTheme; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <UserX color={c.primary} size={30} strokeWidth={1.7} />
      </View>
      <Text style={styles.emptyTitle}>Muallif akkaunti emas</Text>
      <Text style={styles.emptyText}>
        Siz hali AdabiyotX platformasida muallif sifatida biriktirilmagansiz.
      </Text>
    </View>
  );
}

function EmptyState({ c, styles }: { c: AppTheme; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <CheckCircle2 color={c.primary} size={30} strokeWidth={1.7} />
      </View>
      <Text style={styles.emptyTitle}>Hozircha daromad mavjud emas</Text>
      <Text style={styles.emptyText}>
        Asarlaringiz sotilganda bu yerda ko'rinadi.
      </Text>
    </View>
  );
}

function ErrorState({
  c,
  styles,
  onRetry,
}: {
  c: AppTheme;
  styles: ReturnType<typeof createStyles>;
  onRetry: () => void;
}) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>Ma'lumotni yuklab bo'lmadi</Text>
      <Text style={styles.emptyText}>Internet aloqasini tekshirib, qayta urinib ko'ring.</Text>
      <PressableScale onPress={onRetry} style={styles.retryBtn}>
        <RefreshCw color="#fff" size={15} />
        <Text style={styles.retryText}>Qayta yuklash</Text>
      </PressableScale>
    </View>
  );
}

function RowSkeleton({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={[styles.row, { gap: 12 }]}>
      <View style={styles.skelLineWide} />
      <View style={styles.skelLine} />
      <View style={styles.skelBlock} />
    </View>
  );
}

/* ─── STYLES ─────────────────────────────────────────────────────── */

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: { color: c.text, fontSize: 17, fontWeight: "800", fontFamily: FONT.serif },

    /* Hero */
    hero: {
      marginHorizontal: 20,
      marginTop: 6,
      borderRadius: 26,
      padding: 20,
      shadowColor: "#0F7A52",
      shadowOpacity: 0.32,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    sharePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    sharePillText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
    heroLabel: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontWeight: "700", marginTop: 18 },
    heroValue: {
      color: "#fff",
      fontSize: 40,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 4,
      fontFamily: FONT.serif,
    },
    heroSkeleton: {
      height: 42,
      width: 210,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.22)",
      marginTop: 6,
    },
    heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 12.5, fontWeight: "500", marginTop: 6 },
    heroDivider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.16)",
      marginVertical: 16,
    },
    heroBalanceRow: { flexDirection: "row", alignItems: "center" },
    heroBalanceDiv: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.16)" },

    /* Stat cards */
    statGrid: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      marginTop: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 8,
    },
    statIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    statValue: { color: c.text, fontSize: 14.5, fontWeight: "900", letterSpacing: -0.3 },
    statLabel: { color: c.textMuted, fontSize: 10.5, fontWeight: "600" },

    /* History */
    historyHeader: { paddingHorizontal: 20, marginTop: 26, marginBottom: 12 },
    sectionTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },
    sectionHint: { color: c.textMuted, fontSize: 12, fontWeight: "500", marginTop: 3 },

    row: {
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
    },
    rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowTitle: { flex: 1, color: c.text, fontSize: 15, fontWeight: "800" },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    statusText: { fontSize: 11, fontWeight: "800" },
    rowMetaLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      backgroundColor: isDark ? "rgba(82,183,136,0.14)" : "rgba(82,183,136,0.10)",
    },
    typeBadgeText: { color: c.primary, fontSize: 10.5, fontWeight: "800" },
    rowDate: { color: c.textMuted, fontSize: 12, fontWeight: "600" },

    amountLine: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: 12,
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,122,82,0.04)",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 8,
    },
    amountText: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
    amountHint: { color: c.textMuted, fontSize: 11, fontWeight: "600", flexShrink: 1 },

    rowDesc: { color: c.textDim, fontSize: 12, fontWeight: "500", marginTop: 8, lineHeight: 17 },
    rowOrder: { color: c.textMuted, fontSize: 11, fontWeight: "500", marginTop: 8 },

    /* Complaint */
    complaintBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      marginTop: 12,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.5)",
      backgroundColor: isDark ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.08)",
    },
    complaintBtnText: { color: "#B45309", fontSize: 12.5, fontWeight: "800" },
    complaintDone: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      marginTop: 12,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.06)",
    },
    complaintDoneText: { color: "#B45309", fontSize: 12.5, fontWeight: "700" },

    /* Empty / error */
    emptyWrap: { alignItems: "center", paddingHorizontal: 40, paddingVertical: 44, gap: 10 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
      marginBottom: 4,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: "800" },
    emptyText: { color: c.textMuted, fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginTop: 8,
      paddingHorizontal: 18,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primary,
    },
    retryText: { color: "#fff", fontSize: 14, fontWeight: "800" },

    /* Skeletons */
    skelLineWide: { height: 16, width: "70%", borderRadius: 8, backgroundColor: c.bgElevated },
    skelLine: { height: 12, width: "45%", borderRadius: 6, backgroundColor: c.bgElevated },
    skelBlock: { height: 44, width: "100%", borderRadius: 12, backgroundColor: c.bgElevated },
  });
}
