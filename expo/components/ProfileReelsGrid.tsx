import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Dimensions, Pressable, Text, View } from "react-native";
import { useUserReels } from "@/hooks/useReels";
import { useTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/constants/colors";
import type { PublicReel } from "@/lib/reels";

const SCREEN_W = Dimensions.get("window").width;

function formatCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
  return String(v);
}

/**
 * A profile's "Reels" tab grid. Public views show only approved+published reels;
 * the owner (`own`) also sees pending/rejected uploads with a status badge.
 * Tapping a reel opens it in the full-screen reels viewer.
 */
export default function ProfileReelsGrid({
  userId,
  own,
  currentUserId,
}: {
  userId: string | null;
  own?: boolean;
  currentUserId?: string | null;
}) {
  const { colors: c } = useTheme();
  const { reels, loading } = useUserReels(userId, own, currentUserId ?? userId);

  const COLS = 3;
  const GAP = 6;
  const PAD = 12;
  const cardW = Math.floor((SCREEN_W - PAD * 2 - GAP * (COLS - 1)) / COLS);

  if (loading && reels.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 52, paddingHorizontal: 32, gap: 12 }}>
        <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="movie-open-outline" size={30} color={c.primary} />
        </View>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>Hali reels e'lon qilinmagan</Text>
        <Text style={{ color: c.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
          {own ? "Video yuborsangiz, u shu yerda ko'rinadi." : "Bu ijodkor hali reels joylamagan."}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 8 }}>
      {reels.map((reel) => (
        <ReelCell key={reel.id} reel={reel} width={cardW} own={own} c={c} />
      ))}
    </View>
  );
}

function ReelCell({ reel, width, own, c }: { reel: PublicReel; width: number; own?: boolean; c: AppTheme }) {
  const open = () => router.push({ pathname: "/(tabs)/reels", params: { reelId: reel.id } });
  const pending = reel.status != null && reel.status !== "approved";
  const unpublished = !pending && reel.isPublished === false;
  const badge = pending
    ? { label: reel.status === "rejected" ? "Rad etilgan" : "Tekshiruvda", bg: reel.status === "rejected" ? "rgba(220,38,38,0.92)" : "rgba(217,119,6,0.92)" }
    : unpublished
    ? { label: "Yashirin", bg: "rgba(71,85,105,0.92)" }
    : null;

  return (
    <Pressable onPress={open} style={{ width, aspectRatio: 9 / 16, borderRadius: 10, overflow: "hidden", backgroundColor: c.bgElevated }}>
      {reel.thumbnailUrl ? (
        <Image source={{ uri: reel.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="movie-open-outline" size={26} color={c.primary} />
        </View>
      )}
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.72)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" }} />

      <View style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="play" size={13} color="#fff" />
      </View>

      {own && badge ? (
        <View style={{ position: "absolute", top: 6, left: 6, backgroundColor: badge.bg, paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6 }}>
          <Text style={{ color: "#fff", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.2 }}>{badge.label}</Text>
        </View>
      ) : null}

      <View style={{ position: "absolute", left: 6, right: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <MaterialCommunityIcons name="heart" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{formatCount(reel.likesCount)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <MaterialCommunityIcons name="comment" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{formatCount(reel.commentsCount)}</Text>
        </View>
      </View>
    </Pressable>
  );
}
