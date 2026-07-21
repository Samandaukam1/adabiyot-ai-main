import { LinearGradient } from "expo-linear-gradient";
import { BookMarked, RefreshCw, Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AdibEncyclopediaCard from "@/components/AdibEncyclopediaCard";
import EncyclopediaApplyButton from "@/components/EncyclopediaApplyButton";
import LiderlarCredit from "@/components/LiderlarCredit";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { useAdibEncyclopedia } from "@/hooks/useAdibEncyclopedia";
import { useTheme } from "@/providers/ThemeProvider";

/** Real, server-searched encyclopedia section embedded on the Tokcha page. */
export default function AdibEncyclopediaSection() {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [query, setQuery] = useState("");
  const { adibs, loading, error, refetch } = useAdibEncyclopedia(query);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headingLeft}>
          <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.headingIcon}>
            <BookMarked color="#fff" size={19} strokeWidth={2.2} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>TOKCHA MAXSUS LOYIHASI</Text>
            <Text style={styles.title}>Adiblar ensiklopediyasi</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          O‘zbekiston lider yoshlari, ijodkorlar va faol shaxslar haqidagi ensiklopedik maqolalar.
        </Text>
        <LiderlarCredit style={styles.credit} />
      </View>

      <View style={styles.searchWrap}>
        <Search color={c.textMuted} size={17} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ism, taxallus, @username yoki rol bo‘yicha qidiring"
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
          <ActivityIndicator color={c.primary} />
          <Text style={styles.stateText}>Ma’lumotlar yuklanmoqda…</Text>
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>Ma’lumotlarni yuklashda xatolik yuz berdi.</Text>
          <PressableScale onPress={() => void refetch()} style={styles.retryButton}>
            <RefreshCw color={c.primary} size={15} />
            <Text style={styles.retryText}>Qayta urinish</Text>
          </PressableScale>
        </View>
      ) : adibs.length === 0 ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>Hozircha chop etilgan adiblar mavjud emas.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {adibs.map((adib) => (
            <AdibEncyclopediaCard key={adib.id} adib={adib} />
          ))}
        </ScrollView>
      )}

      <EncyclopediaApplyButton style={styles.applyButton} />
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    section: { marginTop: 4, marginBottom: 28 },
    header: { paddingHorizontal: 20 },
    headingLeft: { flexDirection: "row", alignItems: "center", gap: 11 },
    headingIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    eyebrow: { color: c.primary, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
    title: { color: c.text, fontSize: 19, fontWeight: "900", fontFamily: FONT.serif, marginTop: 2 },
    subtitle: { color: c.textDim, fontSize: 13, lineHeight: 19, fontWeight: "500", marginTop: 11 },
    credit: { marginTop: 8 },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 16,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      paddingHorizontal: 13,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, fontWeight: "600", paddingVertical: 10 },
    cardsRow: { paddingHorizontal: 20, gap: 14, paddingBottom: 4 },
    stateWrap: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 },
    stateText: { color: c.textMuted, fontSize: 13.5, lineHeight: 20, textAlign: "center", fontWeight: "600" },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
    },
    retryText: { color: c.primary, fontSize: 12.5, fontWeight: "800" },
    applyButton: { marginHorizontal: 20, marginTop: 18 },
  });
}
