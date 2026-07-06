import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ChevronLeft,
  Clock3,
  RefreshCw,
  TrendingUp,
  Wallet,
  BadgeCheck,
  ShoppingBag,
  CheckCircle2,
} from "lucide-react-native";
import React, { useMemo } from "react";
import {
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
import { useAuthorEarnings } from "@/hooks/useAuthorAccount";
import { useTheme } from "@/providers/ThemeProvider";
import {
  contentRoute,
  contentTypeLabel,
  earningStatusMeta,
  formatSaleDateTime,
  type AuthorEarning,
} from "@/types/author";

export default function AuthorEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { summary, rows, loading, error, refetch } = useAuthorEarnings();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

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
        {/* ─── HERO — umumiy daromad ─────────────────────────────── */}
        <LinearGradient
          colors={isDark ? ["#12352A", "#1B4D3A", "#0F2C22"] : ["#2D9B6F", "#1F8A5F", "#0F7A52"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <TrendingUp color="#fff" size={18} strokeWidth={2.4} />
            </View>
            <View style={styles.sharePill}>
              <BadgeCheck color="#fff" size={13} />
              <Text style={styles.sharePillText}>Muallif ulushi 50%</Text>
            </View>
          </View>
          <Text style={styles.heroLabel}>Umumiy daromad</Text>
          {loading ? (
            <View style={styles.heroSkeleton} />
          ) : (
            <Text style={styles.heroValue}>{formatUzs(summary.totalEarned)}</Text>
          )}
          <Text style={styles.heroSub}>Sizning asarlaringizdan tushgan ulush</Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroBalanceRow}>
            <HeroBalance label="Mavjud balans" value={formatUzs(summary.availableBalance)} accent="#B9F6CA" loading={loading} />
            <View style={styles.heroBalanceDiv} />
            <HeroBalance label="Kutilayotgan" value={formatUzs(summary.pendingAmount)} accent="#FFE0A3" loading={loading} />
            <View style={styles.heroBalanceDiv} />
            <HeroBalance label="To'langan" value={formatUzs(summary.paidOutAmount)} accent="#BBDEFB" loading={loading} />
          </View>
        </LinearGradient>

        {/* ─── STAT CARDS ────────────────────────────────────────── */}
        <View style={styles.statGrid}>
          <StatCard
            c={c}
            styles={styles}
            icon={<ShoppingBag color="#2D9B6F" size={18} strokeWidth={2.2} />}
            tint={isDark ? "rgba(45,155,111,0.14)" : "#E8F5EE"}
            label="Jami sotuvlar"
            value={loading ? "—" : String(summary.salesCount)}
          />
          <StatCard
            c={c}
            styles={styles}
            icon={<ShoppingBag color="#F4A261" size={18} strokeWidth={2.2} />}
            tint={isDark ? "rgba(244,162,97,0.14)" : "#FFF4E8"}
            label="Umumiy savdo"
            value={loading ? "—" : formatUzs(summary.grossTotal)}
          />
          <StatCard
            c={c}
            styles={styles}
            icon={<Wallet color="#38BDF8" size={18} strokeWidth={2.2} />}
            tint={isDark ? "rgba(56,189,248,0.14)" : "#EAF6FF"}
            label="Sizning ulushingiz"
            value={loading ? "—" : formatUzs(summary.totalEarned)}
          />
        </View>

        {/* ─── SOTUVLAR TARIXI ───────────────────────────────────── */}
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Sotuvlar tarixi</Text>
          <Text style={styles.sectionHint}>Har bir sotuvdan 50% muallif ulushi</Text>
        </View>

        {error ? (
          <ErrorState c={c} styles={styles} onRetry={onRefresh} />
        ) : loading ? (
          <View style={{ gap: 12, paddingHorizontal: 20 }}>
            <RowSkeleton styles={styles} />
            <RowSkeleton styles={styles} />
            <RowSkeleton styles={styles} />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState c={c} styles={styles} />
        ) : (
          <View style={{ gap: 12, paddingHorizontal: 20 }}>
            {rows.map((row) => (
              <EarningRow key={row.id} row={row} c={c} styles={styles} />
            ))}
          </View>
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
  c,
  styles,
  icon,
  tint,
  label,
  value,
}: {
  c: AppTheme;
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

function EarningRow({
  row,
  c,
  styles,
}: {
  row: AuthorEarning;
  c: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const meta = earningStatusMeta(row.status);
  const onPress = row.contentId
    ? () => router.push(contentRoute(row.contentType, row.contentId as string) as never)
    : undefined;

  return (
    <PressableScale onPress={onPress} style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.contentTitle}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.rowMetaLine}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{contentTypeLabel(row.contentType)}</Text>
        </View>
        <Clock3 color={c.textMuted} size={12} />
        <Text style={styles.rowDate}>{formatSaleDateTime(row.soldAt)}</Text>
      </View>

      <View style={styles.rowAmountBox}>
        <View style={styles.rowAmountItem}>
          <Text style={styles.rowAmountLabel}>Sotuv</Text>
          <Text style={styles.rowAmountValue}>{formatUzs(row.saleAmountUzs)}</Text>
        </View>
        <View style={styles.rowAmountItem}>
          <Text style={styles.rowAmountLabel}>Ulush {Math.round(row.authorSharePercent)}%</Text>
          <Text style={styles.rowAmountValue}>{Math.round(row.authorSharePercent)}%</Text>
        </View>
        <View style={styles.rowAmountItem}>
          <Text style={styles.rowAmountLabel}>Sizga tushgan</Text>
          <Text style={styles.rowShareValue}>{formatUzs(row.authorAmountUzs)}</Text>
        </View>
      </View>

      {row.orderNumber ? (
        <Text style={styles.rowOrder} numberOfLines={1}>
          Buyurtma: {row.orderNumber}
          {row.paymentStatus ? ` · ${row.paymentStatus}` : ""}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function EmptyState({ c, styles }: { c: AppTheme; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <CheckCircle2 color={c.primary} size={30} strokeWidth={1.7} />
      </View>
      <Text style={styles.emptyTitle}>Hali daromad mavjud emas</Text>
      <Text style={styles.emptyText}>
        Asaringiz sotilganda, har bir sotuvdan 50% muallif ulushi shu yerda ko'rinadi.
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
    rowAmountBox: {
      flexDirection: "row",
      marginTop: 12,
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,122,82,0.04)",
      borderRadius: 12,
      paddingVertical: 10,
    },
    rowAmountItem: { flex: 1, alignItems: "center" },
    rowAmountLabel: { color: c.textMuted, fontSize: 10, fontWeight: "600" },
    rowAmountValue: { color: c.textDim, fontSize: 12.5, fontWeight: "800", marginTop: 3 },
    rowShareValue: { color: c.primary, fontSize: 13.5, fontWeight: "900", marginTop: 3 },
    rowOrder: { color: c.textMuted, fontSize: 11, fontWeight: "500", marginTop: 10 },

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
