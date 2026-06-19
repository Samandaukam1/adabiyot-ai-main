import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, Plus, ShieldCheck } from "lucide-react-native";
import React, { useMemo } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { books, getAuthor, getBookRoute, getPublisher } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W } = Dimensions.get("window");

export default function PublisherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const publisher = useMemo(() => getPublisher(String(id)), [id]);
  const { followedPublisherIds, toggleFollowPublisher } = useApp();

  if (!publisher) return null;
  const followed = followedPublisherIds.includes(publisher.id);
  const catalog = books.filter((b) => b.publisherId === publisher.id);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.hero}>
          <Image source={{ uri: publisher.logo }} style={StyleSheet.absoluteFillObject} blurRadius={40} />
          <LinearGradient
            colors={["rgba(10,10,11,0.5)", "rgba(10,10,11,0.92)", palette.bg]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={palette.text} size={20} />
            </Pressable>
          </View>
          <View style={styles.heroInner}>
            <Image source={{ uri: publisher.logo }} style={styles.logo} />
            <View style={styles.verifiedRow}>
              <ShieldCheck color={palette.gold} size={14} />
              <Text style={styles.verifiedText}>TASDIQLANGAN NASHRIYOT</Text>
            </View>
            <Text style={styles.name}>{publisher.name}</Text>
            <Text style={styles.about}>{publisher.about}</Text>
            <PressableScale
              onPress={() => toggleFollowPublisher(publisher.id)}
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
                {followed ? "Obuna bo'lingan" : "Obuna bo'lish"}
              </Text>
            </PressableScale>
          </View>
        </View>

        <Text style={styles.section}>Katalog · {catalog.length} ta asar</Text>
        <View style={styles.grid}>
          {catalog.map((b) => {
            const a = getAuthor(b.authorId);
            return (
              <PressableScale
                key={b.id}
                onPress={() => router.push(getBookRoute(b))}
                style={styles.item}
              >
                <Image source={{ uri: b.cover }} style={styles.cover} contentFit="contain" />
                <Text style={styles.itemTitle} numberOfLines={1}>{b.title}</Text>
                <Text style={styles.itemAuthor} numberOfLines={1}>{a?.name}</Text>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 420, paddingBottom: 30 },
  topBar: { paddingHorizontal: 16 },
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
  heroInner: { alignItems: "center", paddingHorizontal: 24, marginTop: 20 },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(46,125,50,0.12)",
    borderWidth: 1,
    borderColor: "rgba(102,187,106,0.32)",
  },
  verifiedText: { color: palette.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  name: {
    color: palette.text,
    fontSize: 26,
    fontFamily: FONT.serif,
    fontWeight: "700",
    marginTop: 12,
  },
  about: {
    color: palette.textDim,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 19,
  },
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
  section: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14 },
  item: { width: (SCREEN_W - 28) / 2, padding: 6 },
  cover: { width: "100%", aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: palette.bgCard },
  itemTitle: { color: palette.text, fontSize: 14, fontWeight: "700", marginTop: 8 },
  itemAuthor: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
});
