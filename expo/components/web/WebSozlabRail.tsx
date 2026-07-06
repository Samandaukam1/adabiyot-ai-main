import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { FONT } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/providers/ThemeProvider";
import { getInitials, resolveBadgeType, type VerificationType } from "@/types/profile";
import { useHover } from "./useHover";
import { cursorPointer, hoverTransition } from "./webStyle";

interface FeedItem {
  id: string;
  text: string;
  ts: number;
  likes: number;
  comments: number;
  authorName: string;
  avatarUrl: string | null;
  badge: VerificationType;
}

const AUTHOR_COLS =
  "id,display_name,full_name,pen_name,avatar_url,provider_avatar_url,verification_type,account_type,is_creator,is_adib,is_vip";

// Shown only when there are no real posts yet, so the live rail is never empty.
const SAMPLE: FeedItem[] = [
  { id: "sample-1", text: "\"Tun yarmida shahar uxlar, faqat men uyg'oqman. Derazadan tushayotgan chiroq nuri xonani oltin rangga bo'yaydi.\"", ts: Date.now() - 8 * 60000, likes: 24, comments: 5, authorName: "Kamola Yusupova", avatarUrl: null, badge: "adib_green" },
  { id: "sample-2", text: "Kitob o'qish — bu o'zingga qaytish. Har bir sahifa seni birozgina o'zingga yaqinlashtiradi.", ts: Date.now() - 42 * 60000, likes: 58, comments: 12, authorName: "Jasur Mirzayev", avatarUrl: null, badge: "creator_blue" },
  { id: "sample-3", text: "Kuz kelib, men yana she'r yoza boshladim. Qish — roman, bahor — hikoya, yoz — tanaffus. Kuz esa har doim she'rga to'la.", ts: Date.now() - 3 * 3600000, likes: 91, comments: 20, authorName: "Sardor Rashidov", avatarUrl: null, badge: "creator_adib_gold" },
  { id: "sample-4", text: "Bolalar adabiyotini past sanash noto'g'ri. Malika Yusupovaning \"Oy Bolasi\" — oddiy va chuqur asar. Kattalar ham o'qisin.", ts: Date.now() - 6 * 3600000, likes: 33, comments: 7, authorName: "Nilufar Rashidova", avatarUrl: null, badge: "none" },
];

/**
 * A live So'zLab feed rail for the web home. Polls the real `sozlab_posts` table
 * every 15s (near real-time) and joins each author's identity + combined badge
 * via the shared {@link resolveBadgeType}. Falls back to a few sample posts so
 * the rail always shows conversations, matching the mobile So'zLab feed.
 */
export default function WebSozlabRail() {
  const { colors: L } = useTheme();
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // No strict status filter — the base table is the source of truth so real
    // posts show up regardless of moderation state (matches the mobile feed).
    const { data } = await (supabase as any)
      .from("sozlab_posts")
      .select("id,user_id,body,content,improved_content,created_at,status,is_deleted,likes_count,comments_count")
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (data ?? []).filter((r: any) => r.is_deleted !== true && r.status !== "deleted");
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));

    const authors: Record<string, { name: string; avatar: string | null; badge: VerificationType }> = {};
    if (ids.length > 0) {
      let res = await (supabase as any).from("mobile_public_profiles").select(AUTHOR_COLS).in("id", ids);
      if (res.error) res = await (supabase as any).from("profiles").select(AUTHOR_COLS).in("id", ids);
      (res.data ?? []).forEach((p: any) => {
        authors[p.id] = {
          name: p.pen_name?.trim() || p.display_name?.trim() || p.full_name?.trim() || "Foydalanuvchi",
          avatar: p.avatar_url || p.provider_avatar_url || null,
          badge: resolveBadgeType({
            account_type: p.account_type,
            is_creator: p.is_creator,
            is_adib: p.is_adib,
            verification_type: p.verification_type,
            is_vip: p.is_vip,
          }),
        };
      });
    }

    const mapped: FeedItem[] = rows.map((r: any) => {
      const a = authors[r.user_id ?? ""];
      return {
        id: r.id,
        text: r.content ?? r.body ?? r.improved_content ?? "",
        ts: new Date(r.created_at).getTime(),
        likes: r.likes_count ?? 0,
        comments: r.comments_count ?? 0,
        authorName: a?.name ?? "Foydalanuvchi",
        avatarUrl: a?.avatar ?? null,
        badge: a?.badge ?? "none",
      };
    });

    setPosts(mapped.length > 0 ? mapped : SAMPLE);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      setPosts(SAMPLE);
      setLoading(false);
    });
    const timer = setInterval(() => {
      load().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: L.bgCard,
        borderWidth: 1,
        borderColor: L.border,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 18,
          paddingVertical: 15,
          borderBottomWidth: 1,
          borderBottomColor: L.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Ionicons name="chatbubble-ellipses" size={18} color={L.primary} />
          <Text style={{ color: L.text, fontSize: 16, fontWeight: "800", fontFamily: FONT.serif }}>So'zLab</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: L.success }} />
            <Text style={{ color: L.textMuted, fontSize: 11, fontWeight: "700" }}>jonli</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/sozlab")} style={cursorPointer}>
          <Text style={{ color: L.primary, fontSize: 12.5, fontWeight: "700" }}>Hammasi</Text>
        </Pressable>
      </View>

      {/* Feed — flows with the page (no inner scroll / no pinning) */}
      {loading && posts.length === 0 ? (
        <View style={{ paddingVertical: 44, alignItems: "center" }}>
          <ActivityIndicator color={L.primary} />
        </View>
      ) : (
        posts.map((post, i) => <FeedRow key={post.id} post={post} last={i === posts.length - 1} L={L} />)
      )}
    </View>
  );
}

function FeedRow({ post, last, L }: { post: FeedItem; last: boolean; L: ReturnType<typeof useTheme>["colors"] }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const open = () => {
    if (post.id.startsWith("sample")) router.push("/(tabs)/sozlab");
    else router.push({ pathname: "/(tabs)/sozlab", params: { openPostId: post.id } });
  };
  return (
    <Pressable
      onPress={open}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: L.border,
          backgroundColor: hovered ? L.soft : "transparent",
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {post.avatarUrl ? (
          <Image source={{ uri: post.avatarUrl }} style={{ width: 34, height: 34, borderRadius: 17 }} contentFit="cover" />
        ) : (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: L.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{getInitials(post.authorName)}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text numberOfLines={1} style={{ color: L.text, fontSize: 13.5, fontWeight: "800" }}>
              {post.authorName}
            </Text>
            {post.badge !== "none" ? <VerificationBadge verificationType={post.badge} size="sm" /> : null}
          </View>
          <Text style={{ color: L.textMuted, fontSize: 11, marginTop: 1 }}>{relTime(post.ts)}</Text>
        </View>
      </View>
      <Text numberOfLines={4} style={{ color: L.textDim, fontSize: 13.5, lineHeight: 20 }}>
        {post.text}
      </Text>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
        <Meta icon="heart-outline" value={post.likes} L={L} />
        <Meta icon="chatbubble-outline" value={post.comments} L={L} />
      </View>
    </Pressable>
  );
}

function Meta({ icon, value, L }: { icon: any; value: number; L: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Ionicons name={icon} size={14} color={L.textMuted} />
      <Text style={{ color: L.textMuted, fontSize: 12, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function relTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}
