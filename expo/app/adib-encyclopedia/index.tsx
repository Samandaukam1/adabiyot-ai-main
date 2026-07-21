import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EncyclopediaApplyButton from "@/components/EncyclopediaApplyButton";
import LiderlarCredit from "@/components/LiderlarCredit";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { useAdibEncyclopedia } from "@/hooks/useAdibEncyclopedia";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/providers/ThemeProvider";
import type { AdibEntry } from "@/types/community";
import { getInitials } from "@/types/profile";

export default function AdibEncyclopediaDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { isWebLayout } = useResponsive();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [query, setQuery] = useState("");
  const { adibs, loading, error, refetch } = useAdibEncyclopedia(query);

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Adiblar ensiklopediyasi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 36 },
          isWebLayout && styles.webContent,
        ]}
      >
        <Text style={styles.heroTitle}>O‘zbek adabiyoti va zamonaviy ijodkorlar</Text>
        <Text style={styles.heroDescription}>
          O‘zbekiston lider yoshlari, ijodkorlar va faol shaxslar haqidagi ensiklopedik maqolalar.
        </Text>
        <LiderlarCredit align="center" style={styles.headerCredit} />

        <View style={styles.searchWrap}>
          <Search color={c.textMuted} size={17} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ism, taxallus, @username yoki rol…"
            placeholderTextColor={c.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <X color={c.textMuted} size={17} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={styles.stateText}>Ma’lumotlar yuklanmoqda…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>Ma’lumotlarni yuklashda xatolik yuz berdi.</Text>
            <PressableScale onPress={() => void refetch()} style={styles.retryButton}>
              <RefreshCw color={c.primary} size={16} />
              <Text style={styles.retryText}>Qayta urinish</Text>
            </PressableScale>
          </View>
        ) : adibs.length === 0 ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>Hozircha chop etilgan adiblar mavjud emas.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {adibs.map((adib, index) => (
              <AdibListRow
                key={adib.id}
                adib={adib}
                isLast={index === adibs.length - 1}
                styles={styles}
                c={c}
              />
            ))}
          </View>
        )}

        <EncyclopediaApplyButton style={styles.applyButton} />
      </ScrollView>
    </View>
  );
}

function AdibListRow({
  adib,
  isLast,
  styles,
  c,
}: {
  adib: AdibEntry;
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
}) {
  const handle = adib.adabiyotxUsername ? `@${adib.adabiyotxUsername.replace(/^@+/, "")}` : null;
  const subtitle = handle ?? (adib.penName ? `“${adib.penName}”` : null);

  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/adib-encyclopedia/[id]", params: { id: adib.id } })}
      style={isLast ? styles.row : [styles.row, styles.rowDivider]}
    >
      {adib.photoUrl ? (
        <Image source={{ uri: adib.photoUrl }} style={styles.rowPhoto} contentFit="cover" />
      ) : (
        <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.rowPhoto}>
          <Text style={styles.rowInitials}>{getInitials(adib.fullName)}</Text>
        </LinearGradient>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{adib.fullName}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text> : null}
        {adib.roles.length > 0 ? (
          <Text style={styles.rowRoles} numberOfLines={1} ellipsizeMode="tail">{adib.roles.join(" | ")}</Text>
        ) : adib.shortDescription ? (
          <Text style={styles.rowRoles} numberOfLines={1} ellipsizeMode="tail">{adib.shortDescription}</Text>
        ) : null}
      </View>
      <ChevronRight color={c.textMuted} size={17} />
    </PressableScale>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.bg,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    topTitle: { color: c.text, fontSize: 15.5, fontWeight: "900", fontFamily: FONT.serif },
    content: { paddingHorizontal: 16, paddingTop: 14 },
    webContent: { width: "100%", maxWidth: 720, alignSelf: "center" },
    heroTitle: { color: c.text, fontSize: 20, lineHeight: 25, fontWeight: "900", fontFamily: FONT.serif, textAlign: "center" },
    heroDescription: { color: c.textDim, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 6 },
    headerCredit: { marginTop: 8 },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      minHeight: 42,
      marginTop: 14,
      marginBottom: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13.5, paddingVertical: 8 },
    list: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowPhoto: {
      width: 42,
      height: 50,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
    rowInitials: { color: "#fff", fontSize: 15, fontWeight: "900", fontFamily: FONT.serif },
    rowBody: { flex: 1, minWidth: 0 },
    rowName: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "800" },
    rowSub: { color: c.textMuted, fontSize: 11, lineHeight: 15, fontWeight: "700", marginTop: 1 },
    rowRoles: { color: c.primary, fontSize: 10.5, lineHeight: 15, fontWeight: "700", marginTop: 2 },
    stateWrap: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
    stateText: { color: c.textMuted, fontSize: 13.5, lineHeight: 20, fontWeight: "600", textAlign: "center" },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
    },
    retryText: { color: c.primary, fontSize: 13, fontWeight: "800" },
    applyButton: { marginTop: 16 },
  });
}
