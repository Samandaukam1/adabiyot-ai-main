import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Award, ChevronRight, ScrollText } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { fetchMarathons, type Marathon, type MarathonStatus } from "@/lib/marathons";
import { useTheme } from "@/providers/ThemeProvider";

const SECTIONS: { status: MarathonStatus; title: string }[] = [
  { status: "active", title: "Faol marafonlar" },
  { status: "scheduled", title: "Rejadagi marafonlar" },
  { status: "finished", title: "Tugagan marafonlar" },
];

export default function MarathonsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [marathons, setMarathons] = useState<Marathon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMarathons()
      .then((rows) => {
        if (!cancelled) setMarathons(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byStatus = (s: MarathonStatus) => marathons.filter((m) => m.status === s);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={c.text} size={20} />
          </Pressable>
          <Text style={styles.kicker}>MARAFONLAR</Text>
          <Text style={styles.title}>Marafonlar markazi</Text>
          <Text style={styles.subtitle}>Ijodiy marafonlarda qatnashing va mukofot yutib oling.</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : marathons.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Award color={c.primary} size={28} />
            </View>
            <Text style={styles.emptyText}>Hozircha marafonlar yo'q</Text>
          </View>
        ) : (
          SECTIONS.map((sec) => {
            const items = byStatus(sec.status);
            if (items.length === 0) return null;
            return (
              <View key={sec.status} style={styles.section}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                {items.map((m) => (
                  <MarathonCard key={m.id} m={m} styles={styles} c={c} />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

type StylesType = ReturnType<typeof createStyles>;

function MarathonCard({ m, styles, c }: { m: Marathon; styles: StylesType; c: AppTheme }) {
  return (
    <PressableScale onPress={() => router.push(`/marathons/${m.slug}`)} style={styles.card}>
      <View style={styles.cover}>
        {m.coverUrl ? (
          <Image source={{ uri: m.coverUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.coverFallback]}>
            <ScrollText color="#fff" size={24} strokeWidth={1.5} />
          </View>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFillObject} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{m.title}</Text>
        {m.subtitle ? <Text style={styles.cardSub} numberOfLines={1}>{m.subtitle}</Text> : null}
      </View>
      <ChevronRight color={c.textMuted} size={20} />
    </PressableScale>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    kicker: { color: c.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
    title: { color: c.text, fontSize: 30, fontWeight: "800", fontFamily: FONT.serif, marginTop: 8 },
    subtitle: { color: c.textDim, fontSize: 14, lineHeight: 21, marginTop: 8, fontWeight: "500" },
    center: { paddingTop: 70, alignItems: "center" },
    empty: { alignItems: "center", paddingTop: 60, gap: 14 },
    emptyIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" },
    emptyText: { color: c.textDim, fontSize: 15, fontWeight: "600" },
    section: { marginTop: 22, paddingHorizontal: 18 },
    sectionTitle: { color: c.text, fontSize: 17, fontWeight: "800", fontFamily: FONT.serif, marginBottom: 12 },
    card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, padding: 12, marginBottom: 12 },
    cover: { width: 74, height: 74, borderRadius: 12, overflow: "hidden", backgroundColor: "#14301E" },
    coverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#14301E" },
    cardBody: { flex: 1, minWidth: 0 },
    cardTitle: { color: c.text, fontSize: 16, fontWeight: "800", fontFamily: FONT.serif, lineHeight: 21 },
    cardSub: { color: c.textDim, fontSize: 13, marginTop: 3, fontWeight: "500" },
  });
}
