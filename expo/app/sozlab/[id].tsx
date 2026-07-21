import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Heart, MessageCircle, Share2 } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AppTheme } from "@/constants/colors";
import ShareTargetNotFound from "@/components/ShareTargetNotFound";
import VerificationBadge from "@/components/VerificationBadge";
import { FONT, PressableScale } from "@/components/ui";
import { openContentPreview } from "@/lib/contentNavigation";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { sharePublicLink } from "@/lib/shareLinks";
import { fetchSozlabPostDetail, type SozlabPostDetail } from "@/lib/sozlabPosts";
import { useTheme } from "@/providers/ThemeProvider";
import { getInitials, type VerificationType } from "@/types/profile";

/**
 * Public share target: `https://adabiyotx.uz/sozlab/<id>`.
 *
 * A standalone view of one So'zLab post — author, text, media, attached work
 * and the like / comment counts — so a shared link always opens the post it
 * names, on the web as well as inside the app.
 */
export default function SozlabPostShareRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const [post, setPost] = useState<SozlabPostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const postId = typeof id === "string" ? id.trim() : "";
    if (!postId) {
      setPost(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSozlabPostDetail(postId)
      .then((detail) => {
        if (!cancelled) setPost(detail);
      })
      .catch(() => {
        if (!cancelled) setPost(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ShareTargetNotFound
          title="Post topilmadi"
          message="Bu So'zLab posti o'chirilgan yoki mavjud emas."
        />
      </>
    );
  }

  const avatar = resolveProfileAvatarUrl(post.authorAvatarUrl);
  const badge = (post.authorVerification ?? "none") as VerificationType;
  const authorName = post.authorName?.trim() || "Kitobxon";
  const openAuthor = () => {
    if (post.userId) router.push({ pathname: "/u/[id]", params: { id: post.userId } });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/sozlab"))}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>So'zLab</Text>
        <Pressable
          onPress={() =>
            void sharePublicLink({ type: "sozlab", id: post.id, title: authorName, message: post.text })
          }
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityLabel="Ulashish"
        >
          <Share2 color={c.text} size={19} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }}>
        <Pressable onPress={openAuthor} style={styles.authorRow}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{getInitials(authorName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.authorName} numberOfLines={1}>
                {authorName}
              </Text>
              {badge !== "none" ? <VerificationBadge verificationType={badge} size="sm" /> : null}
            </View>
            {post.authorUsername ? <Text style={styles.handle}>@{post.authorUsername}</Text> : null}
          </View>
        </Pressable>

        {post.text ? <Text style={styles.text}>{post.text}</Text> : null}

        {post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={styles.media} contentFit="cover" />
        ) : null}

        {post.attachedTitle ? (
          <PressableScale
            onPress={() => {
              void openContentPreview(post.attachedType, post.attachedId, { title: post.attachedTitle });
            }}
            style={styles.attachCard}
          >
            {post.attachedCoverUrl ? (
              <Image source={{ uri: post.attachedCoverUrl }} style={styles.attachCover} contentFit="cover" />
            ) : null}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.attachTitle} numberOfLines={2}>
                {post.attachedTitle}
              </Text>
              {post.attachedAuthor ? (
                <Text style={styles.attachAuthor} numberOfLines={1}>
                  {post.attachedAuthor}
                </Text>
              ) : null}
            </View>
          </PressableScale>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Heart color={c.textMuted} size={17} />
            <Text style={styles.metaText}>{post.likesCount}</Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/(tabs)/sozlab", params: { openPostId: post.id } })
            }
            style={styles.metaItem}
            hitSlop={8}
          >
            <MessageCircle color={c.textMuted} size={17} />
            <Text style={styles.metaText}>{post.commentsCount}</Text>
          </Pressable>
          {post.isEdited ? <Text style={styles.edited}>tahrirlangan</Text> : null}
        </View>

        <PressableScale
          onPress={() => router.push({ pathname: "/(tabs)/sozlab", params: { openPostId: post.id } })}
          style={styles.commentsBtn}
        >
          <MessageCircle color="#fff" size={17} />
          <Text style={styles.commentsBtnText}>Izohlarni ko'rish</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center" },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    topTitle: { color: c.text, fontSize: 16, fontWeight: "800", fontFamily: FONT.serif },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(28,33,40,0.75)" : "rgba(0,0,0,0.03)",
      borderWidth: 1,
      borderColor: c.border,
    },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface },
    avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: c.primary },
    avatarInitials: { color: "#fff", fontSize: 17, fontWeight: "900" },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    authorName: { color: c.text, fontSize: 15.5, fontWeight: "800" },
    handle: { color: c.textMuted, fontSize: 12.5, fontWeight: "600", marginTop: 1 },
    text: { color: c.text, fontSize: 16, lineHeight: 25, fontWeight: "500" },
    media: { width: "100%", height: 260, borderRadius: 18, backgroundColor: c.surface },
    attachCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    attachCover: { width: 46, height: 64, borderRadius: 8, backgroundColor: c.surface },
    attachTitle: { color: c.text, fontSize: 14, fontWeight: "800" },
    attachAuthor: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 20 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { color: c.textMuted, fontSize: 13.5, fontWeight: "700" },
    edited: { color: c.textMuted, fontSize: 12, fontWeight: "600", fontStyle: "italic" },
    commentsBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: c.primary,
    },
    commentsBtnText: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
  });
}
