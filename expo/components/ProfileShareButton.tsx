import { Share2 } from "lucide-react-native";
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { PressableScale } from "@/components/ui";
import { getProfileShareUrl, sharePublicLink } from "@/lib/shareLinks";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Round "ulashish" button that sits next to Tahrirlash / Kuzatish on a profile.
 *
 * It always shares the profile it is GIVEN — on someone else's page that is
 * their link, never the signed-in user's. The @username is preferred, with the
 * profile id as the fallback for accounts that haven't claimed one.
 */
export default function ProfileShareButton({
  profileId,
  username,
  displayName,
  size = 44,
}: {
  profileId: string | null | undefined;
  username?: string | null;
  displayName?: string | null;
  size?: number;
}) {
  const { colors: c, isDark } = useTheme();

  const onShare = useCallback(() => {
    const key = username?.trim().replace(/^@/, "") || profileId;
    if (!key) return;
    void sharePublicLink({ type: "profile", id: key, title: displayName ?? null });
  }, [profileId, username, displayName]);

  if (!getProfileShareUrl({ username, id: profileId })) return null;

  return (
    <PressableScale
      onPress={onShare}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: c.borderStrong,
          backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
          shadowColor: isDark ? "#000" : "#2D9B6F",
        },
      ]}
    >
      <View style={styles.inner}>
        <Share2 color={c.primary} size={19} strokeWidth={2.2} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inner: { alignItems: "center", justifyContent: "center" },
});
