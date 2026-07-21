import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import ShareTargetNotFound from "@/components/ShareTargetNotFound";
import { fetchReelById } from "@/lib/reels";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Public share target: `https://adabiyotx.uz/reels/<id>`.
 *
 * The reel is verified first (a deleted / unpublished one must not silently
 * open somebody else's video), then the feed is opened focused on it — the
 * Reels tab pulls the exact reel in by id when it isn't on the first page.
 */
export default function ReelShareRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { colors: c } = useTheme();
  const [state, setState] = useState<"loading" | "found" | "missing">("loading");

  useEffect(() => {
    const reelId = typeof id === "string" ? id.trim() : "";
    if (!reelId) {
      setState("missing");
      return;
    }
    let cancelled = false;
    setState("loading");
    fetchReelById(reelId, userId)
      .then((reel) => {
        if (!cancelled) setState(reel ? "found" : "missing");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (state === "missing") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ShareTargetNotFound
          title="Reels topilmadi"
          message="Bu reels o'chirilgan yoki hozircha ommaga ochiq emas."
        />
      </>
    );
  }

  return <Redirect href={{ pathname: "/(tabs)/reels", params: { reelId: String(id) } }} />;
}
