import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useEventListener } from "expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import type { HomeHeroAd } from "@/types/homeHeroAd";
import { isSafeExternalUrl, isSafeInternalRoute, openExternalUrl } from "@/utils/safeLinks";

export function openHomeHeroAdLink(ad: HomeHeroAd) {
  const link = ad.anchor_link?.trim();
  if (ad.target_type !== "none" && ad.target_type !== "external" && isSafeInternalRoute(link)) {
    try {
      router.push(link as any);
    } catch {}
    return;
  }
  if (ad.target_type === "external" && isSafeExternalUrl(link)) {
    void openExternalUrl(link);
  }
}

function canOpenAd(ad: HomeHeroAd): boolean {
  return ad.target_type !== "none" && ad.target_type !== "external"
    ? isSafeInternalRoute(ad.anchor_link)
    : ad.target_type === "external"
      ? isSafeExternalUrl(ad.anchor_link)
      : false;
}

function AdFallback() {
  return (
    <LinearGradient colors={["#123C2A", "#2E7D54", "#D6A84F"]} style={StyleSheet.absoluteFill}>
      <View style={styles.fallbackMark}>
        <Ionicons name="sparkles" size={30} color="rgba(255,255,255,0.9)" />
      </View>
    </LinearGradient>
  );
}

function HomeHeroAdMedia({ ad, playing }: { ad: HomeHeroAd; playing: boolean }) {
  const fallbackImage = ad.media_type === "video"
    ? ad.poster_url?.trim() || ad.thumbnail_url?.trim() || ad.image_url?.trim() || null
    : ad.image_url?.trim() || ad.poster_url?.trim() || ad.thumbnail_url?.trim() || null;
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const source = ad.media_type === "video" && ad.video_url?.trim() ? ad.video_url.trim() : null;
  const player = useVideoPlayer(source, (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = true;
    nextPlayer.volume = 0;
    nextPlayer.allowsExternalPlayback = false;
    nextPlayer.staysActiveInBackground = false;
  });

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") setVideoFailed(true);
  });

  useEffect(() => {
    try {
      if (playing && source && !videoFailed) player.play();
      else player.pause();
    } catch {
      setVideoFailed(true);
    }
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player, playing, source, videoFailed]);

  const showVideo = !!source && !videoFailed;
  const showImage = !!fallbackImage && !imageFailed && (!showVideo || !firstFrame);

  return (
    <View style={StyleSheet.absoluteFill}>
      {!showVideo && !showImage ? <AdFallback /> : null}
      {showVideo ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          startsPictureInPictureAutomatically={false}
          onFirstFrameRender={() => setFirstFrame(true)}
        />
      ) : null}
      {showImage ? (
        <Image
          source={{ uri: fallbackImage }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </View>
  );
}

export default function HomeHeroAdCard({
  ad,
  collapsed,
  onCollapsedChange,
  height = 210,
}: {
  ad: HomeHeroAd;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  height?: number;
}) {
  const { colors: L } = useTheme();
  const focused = useIsFocused();
  const open = useCallback(() => openHomeHeroAdLink(ad), [ad]);

  if (collapsed) {
    return (
      <Pressable
        onPress={() => onCollapsedChange(false)}
        accessibilityRole="button"
        style={[styles.pill, { backgroundColor: L.bgCard, borderColor: L.border }]}
      >
        <Ionicons name="megaphone-outline" size={16} color={L.primary} />
        <Text numberOfLines={1} style={[styles.pillText, { color: L.text }]}>
          {ad.title?.trim() || "Reklama"}
        </Text>
        <Ionicons name="eye-outline" size={18} color={L.primary} />
      </Pressable>
    );
  }

  const pressable = canOpenAd(ad);
  return (
    <View style={[styles.shadow, { height }]}>
      <Pressable
        disabled={!pressable}
        onPress={pressable ? open : undefined}
        style={styles.card}
        accessibilityRole={pressable ? "link" : undefined}
      >
        <HomeHeroAdMedia ad={ad} playing={focused} />
      </Pressable>
      <Pressable
        onPress={() => onCollapsedChange(true)}
        hitSlop={8}
        accessibilityLabel="Reklamani kichraytirish"
        style={styles.hideButton}
      >
        <Ionicons name="eye-off-outline" size={19} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8,
  },
  card: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#123C2A" },
  fallbackMark: { flex: 1, alignItems: "center", justifyContent: "center" },
  hideButton: { position: "absolute", top: 12, right: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  pill: { height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  pillText: { flex: 1, fontSize: 13, fontWeight: "800" },
});
