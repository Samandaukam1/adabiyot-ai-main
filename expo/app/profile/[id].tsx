import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import ShareTargetNotFound from "@/components/ShareTargetNotFound";
import { resolveProfileIdFromShareKey } from "@/lib/username";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Public share target: `https://adabiyotx.uz/profile/<@username | profile-id>`.
 *
 * The key is resolved to a profile id and handed to the existing public profile
 * screen (`/u/[id]`), which already decides what a visitor may see — a stranger
 * gets bio, works and public stats only, never settings or earnings.
 */
export default function ProfileShareRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: c } = useTheme();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    const key = typeof id === "string" ? id : "";
    if (!key) {
      setProfileId(null);
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    resolveProfileIdFromShareKey(key)
      .then((resolved) => {
        if (!cancelled) setProfileId(resolved);
      })
      .catch(() => {
        if (!cancelled) setProfileId(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (resolving) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!profileId) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ShareTargetNotFound
          title="Profil topilmadi"
          message="Bu foydalanuvchi mavjud emas yoki username o'zgartirilgan."
        />
      </>
    );
  }

  return <Redirect href={{ pathname: "/u/[id]", params: { id: profileId } }} />;
}
