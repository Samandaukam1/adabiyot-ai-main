import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookOpen, Check, Plus, Users } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { books, getAuthor, getBookRoute } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W } = Dimensions.get("window");

export default function AuthorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const author = useMemo(() => getAuthor(String(id)), [id]);
  const { followedAuthorIds, toggleFollowAuthor } = useApp();

  if (!author) return null;
  const followed = followedAuthorIds.includes(author.id);
  const works = books.filter((b) => b.authorId === author.id);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: author.photo }} style={StyleSheet.absoluteFillObject} blurRadius={40} />
          <LinearGradient
            colors={["rgba(10,10,11,0.4)", "rgba(10,10,11,0.85)", palette.bg]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={palette.text} size={20} />
            </Pressable>
            <View style={styles.encBadge}>
              <Text style={styles.encBadgeText}>ENSIKLOPEDIYA</Text>
            </View>
          </View>
          <View style={styles.heroInner}>
            <Image source={{ uri: author.photo }} style={styles.photo} />
            <Text style={styles.name}>{author.name}</Text>
            <Text style={styles.role}>Zamonaviy o'zbek adibi</Text>
            <View style={styles.statsRow}>
              <Stat icon={<Users color={palette.secondary} size={14} />} label="Kuzatuvchilar" value={formatK(author.followers)} />
              <View style={styles.statDiv} />
              <Stat icon={<BookOpen color={palette.secondary} size={14} />} label="O'qilgan" value={formatK(author.reads)} />
              <View style={styles.statDiv} />
              <Stat label="Asarlar" value={works.length.toString()} />
            </View>

            <PressableScale
              onPress={() => toggleFollowAuthor(author.id)}
              style={[
                styles.followBtn,
                followed ? { backgroundColor: "transparent", borderColor: palette.borderStrong } : {},
              ]}
            >
              {followed ? (
                <Check color={palette.text} size={16} />
              ) : (
                <Plus color="#fff" size={16} />
              )}
              <Text style={[styles.followText, followed ? { color: palette.text } : {}]}>
                {followed ? "Kuzatilmoqda" : "Kuzatish"}
              </Text>
            </PressableScale>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Biografiya</Text>
        <View style={styles.bioBox}>
          <Text style={styles.bioText}>{author.bio}</Text>
          <Text style={styles.bioNote}>
            Muharrirlik tomonidan tasdiqlangan. Foydalanuvchilar tahrirlay olmaydi.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Asarlar</Text>
        <View style={styles.worksGrid}>
          {works.map((b) => (
            <PressableScale
              key={b.id}
              onPress={() => router.push(getBookRoute(b))}
              style={styles.workCard}
            >
              <Image source={{ uri: b.cover }} style={styles.workCover} contentFit="contain" />
              <Text style={styles.workTitle} numberOfLines={1}>{b.title}</Text>
              <Text style={styles.workCat}>{b.category}</Text>
            </PressableScale>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

const styles = StyleSheet.create({
  heroWrap: { minHeight: 540, paddingBottom: 30 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  encBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(46,125,50,0.12)",
    borderWidth: 1,
    borderColor: "rgba(102,187,106,0.32)",
  },
  encBadgeText: {
    color: palette.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heroInner: { alignItems: "center", paddingHorizontal: 24, marginTop: 24 },
  photo: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: palette.gold,
  },
  name: {
    color: palette.text,
    fontSize: 28,
    fontFamily: FONT.serif,
    fontWeight: "700",
    marginTop: 18,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  role: { color: palette.secondary, fontSize: 13, marginTop: 6 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: palette.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    width: "100%",
  },
  statDiv: { width: 1, height: 30, backgroundColor: palette.border },
  statValue: { color: palette.text, fontSize: 16, fontWeight: "700", marginTop: 4 },
  statLabel: { color: palette.textMuted, fontSize: 10, marginTop: 2 },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    borderWidth: 1,
    paddingHorizontal: 30,
    height: 48,
    borderRadius: 24,
  },
  followText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  bioBox: {
    marginHorizontal: 20,
    padding: 18,
    backgroundColor: palette.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  bioText: { color: palette.text, fontSize: 14, lineHeight: 22 },
  bioNote: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 12,
    fontStyle: "italic",
  },
  worksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
  },
  workCard: { width: (SCREEN_W - 28) / 2, padding: 6 },
  workCover: { width: "100%", aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: palette.bgCard },
  workTitle: { color: palette.text, fontSize: 14, fontWeight: "700", marginTop: 8 },
  workCat: { color: palette.secondary, fontSize: 11, marginTop: 2, fontWeight: "600" },
});
