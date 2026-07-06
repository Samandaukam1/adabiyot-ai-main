import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { useAdibEncyclopedia } from "@/hooks/useAdibEncyclopedia";
import { useTheme } from "@/providers/ThemeProvider";
import type { AdibEntry } from "@/types/community";
import { getInitials } from "@/types/profile";

export default function AdiblarScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { adibs, loading } = useAdibEncyclopedia();
  const [q, setQ] = useState("");

  const featured = useMemo(() => adibs.filter((a) => a.featured), [adibs]);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return adibs;
    return adibs.filter(
      (a) =>
        a.fullName.toLowerCase().includes(query) ||
        (a.penName ?? "").toLowerCase().includes(query) ||
        (a.shortDescription ?? "").toLowerCase().includes(query)
    );
  }, [adibs, q]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Adiblar ensiklopediyasi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <View style={styles.searchWrap}>
          <Search color={c.textMuted} size={18} />
          <TextInput
            style={styles.search}
            placeholder="Adib qidiring…"
            placeholderTextColor={c.textMuted}
            value={q}
            onChangeText={setQ}
          />
          {q ? (
            <Pressable onPress={() => setQ("")} hitSlop={10}>
              <X color={c.textMuted} size={18} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={c.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Featured */}
            {!q && featured.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Tanlangan adiblar</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
                >
                  {featured.map((a) => (
                    <FeaturedCard key={a.id} adib={a} styles={styles} c={c} isDark={isDark} />
                  ))}
                </ScrollView>
              </>
            )}

            {/* List */}
            <Text style={styles.sectionTitle}>
              {q ? `Natijalar · ${filtered.length}` : "Barcha adiblar"}
            </Text>
            <View style={{ paddingHorizontal: 20 }}>
              {filtered.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Adib topilmadi</Text>
                </View>
              ) : (
                filtered.map((a) => (
                  <AdibRow key={a.id} adib={a} styles={styles} c={c} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FeaturedCard({
  adib,
  styles,
  c,
  isDark,
}: {
  adib: AdibEntry;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
  isDark: boolean;
}) {
  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/adiblar/[id]", params: { id: adib.id } })}
      style={styles.featuredCard}
    >
      {adib.avatarUrl ? (
        <Image source={{ uri: adib.avatarUrl }} style={styles.featuredAvatar} contentFit="cover" />
      ) : (
        <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.featuredAvatar}>
          <Text style={styles.featuredInitials}>{getInitials(adib.fullName)}</Text>
        </LinearGradient>
      )}
      <Text numberOfLines={1} style={styles.featuredName}>{adib.fullName}</Text>
      {adib.penName ? (
        <Text numberOfLines={1} style={styles.featuredPen}>{adib.penName}</Text>
      ) : null}
      {adib.birthYear ? (
        <Text style={styles.featuredYear}>{adib.birthYear}</Text>
      ) : null}
    </PressableScale>
  );
}

function AdibRow({
  adib,
  styles,
  c,
}: {
  adib: AdibEntry;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
}) {
  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/adiblar/[id]", params: { id: adib.id } })}
      style={styles.row}
    >
      {adib.avatarUrl ? (
        <Image source={{ uri: adib.avatarUrl }} style={styles.rowAvatar} contentFit="cover" />
      ) : (
        <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.rowAvatar}>
          <Text style={styles.rowInitials}>{getInitials(adib.fullName)}</Text>
        </LinearGradient>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.rowName}>{adib.fullName}</Text>
        {adib.shortDescription ? (
          <Text numberOfLines={2} style={styles.rowDesc}>{adib.shortDescription}</Text>
        ) : adib.penName ? (
          <Text numberOfLines={1} style={styles.rowDesc}>{adib.penName}</Text>
        ) : null}
      </View>
      <ChevronRight color={c.textMuted} size={18} />
    </PressableScale>
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
    topTitle: { color: c.text, fontSize: 16, fontWeight: "800", fontFamily: FONT.serif },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginHorizontal: 20,
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    search: { flex: 1, color: c.text, fontSize: 14, padding: 0 },
    loadingWrap: { paddingVertical: 60, alignItems: "center" },
    sectionTitle: {
      color: c.text,
      fontSize: 17,
      fontWeight: "800",
      fontFamily: FONT.serif,
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 14,
    },
    featuredCard: {
      width: 120,
      alignItems: "center",
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    featuredAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    featuredInitials: { color: "#fff", fontSize: 22, fontWeight: "900", fontFamily: FONT.serif },
    featuredName: { color: c.text, fontSize: 13, fontWeight: "800", textAlign: "center" },
    featuredPen: { color: c.primary, fontSize: 11, fontWeight: "600", marginTop: 2, textAlign: "center" },
    featuredYear: { color: c.textMuted, fontSize: 10.5, fontWeight: "600", marginTop: 3 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 12,
    },
    rowAvatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: "center",
      justifyContent: "center",
    },
    rowInitials: { color: "#fff", fontSize: 18, fontWeight: "900", fontFamily: FONT.serif },
    rowName: { color: c.text, fontSize: 15, fontWeight: "800" },
    rowDesc: { color: c.textDim, fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: "500" },
    empty: { paddingVertical: 50, alignItems: "center" },
    emptyText: { color: c.textMuted, fontSize: 14 },
  });
}
