import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import MaterialListCard from "@/components/MaterialListCard";
import { FONT } from "@/components/ui";
import { TOP_LIST_TABS, useTopList, type TopListTab } from "@/hooks/useTopLists";
import { useTheme } from "@/providers/ThemeProvider";
import type { TopMaterial } from "@/types/community";

function routeForMaterial(m: TopMaterial) {
  switch (m.kind) {
    case "article":
      return { pathname: "/article/[id]" as const, params: { id: m.id } };
    case "poem":
      return { pathname: "/poem/[id]" as const, params: { id: m.id } };
    case "script":
      return { pathname: "/screenplay/[id]" as const, params: { id: m.id } };
    default:
      return { pathname: "/book/[id]" as const, params: { id: m.id } };
  }
}

export default function TopListsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [tab, setTab] = useState<TopListTab>("read");
  const { materials, loading } = useTopList(tab);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Top ro'yxatlar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {TOP_LIST_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 40 }}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={c.primary} size="large" />
          </View>
        ) : materials.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Hozircha material yo'q</Text>
          </View>
        ) : (
          materials.map((m, i) => (
            <MaterialListCard
              key={`${m.id}-${i}`}
              material={m}
              rank={i + 1}
              onPress={() => router.push(routeForMaterial(m))}
            />
          ))
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
    tabsScroll: { maxHeight: 56, borderBottomWidth: 1, borderBottomColor: c.border },
    tabsRow: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 10 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { color: c.textDim, fontSize: 13, fontWeight: "700" },
    tabTextActive: { color: "#fff" },
    loadingWrap: { paddingVertical: 60, alignItems: "center" },
    empty: { paddingVertical: 60, alignItems: "center" },
    emptyText: { color: c.textMuted, fontSize: 14 },
  });
}
