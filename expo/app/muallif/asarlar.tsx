import { router } from "expo-router";
import { BookMarked, ChevronLeft, RefreshCw } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import AuthorWorkCard from "@/components/AuthorWorkCard";
import { FONT, PressableScale } from "@/components/ui";
import { useAuthorWorks } from "@/hooks/useAuthorAccount";
import { useTheme } from "@/providers/ThemeProvider";

// 2-column grid: screen − outer(14×2) − inner gutter(6×2) split in two.
const CARD_WIDTH = (Dimensions.get("window").width - 28 - 24) / 2;

export default function AuthorWorksScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { works, loading, error, refetch } = useAuthorWorks();
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
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft color={c.text} size={22} />
        </PressableScale>
        <Text style={styles.topTitle}>Asarlarim</Text>
        <PressableScale onPress={onRefresh} style={styles.iconBtn}>
          <RefreshCw color={c.text} size={18} />
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        }
      >
        {!loading && !error && works.length > 0 ? (
          <Text style={styles.countLine}>{works.length} ta asar</Text>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : error ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Asarlarni yuklab bo'lmadi</Text>
            <PressableScale onPress={onRefresh} style={styles.retryBtn}>
              <RefreshCw color="#fff" size={15} />
              <Text style={styles.retryText}>Qayta yuklash</Text>
            </PressableScale>
          </View>
        ) : works.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <BookMarked color={c.primary} size={30} strokeWidth={1.6} />
            </View>
            <Text style={styles.emptyTitle}>Hali asarlar mavjud emas</Text>
            <Text style={styles.emptyText}>
              Sizga biriktirilgan asarlar shu yerda ko'rinadi. Tahririyat
              asaringizni qo'shgach, ular avtomatik paydo bo'ladi.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {works.map((w) => (
              <View key={`${w.contentType}:${w.id}`} style={styles.gridCell}>
                <AuthorWorkCard work={w} width={CARD_WIDTH} />
              </View>
            ))}
          </View>
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
    topTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },
    countLine: {
      color: c.textMuted,
      fontSize: 12.5,
      fontWeight: "600",
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    center: { paddingVertical: 60, alignItems: "center" },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 14,
      paddingTop: 16,
    },
    gridCell: { width: "50%", paddingHorizontal: 6, marginBottom: 20 },
    emptyWrap: { alignItems: "center", paddingHorizontal: 40, paddingVertical: 60, gap: 10 },
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
    emptyText: { color: c.textMuted, fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 20 },
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
  });
}
