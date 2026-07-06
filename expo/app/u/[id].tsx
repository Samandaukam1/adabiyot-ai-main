import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpen, ChevronLeft, Mic, Pencil, Play, Star, UserCheck, UserPlus } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { useFollow } from "@/hooks/useFollow";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import VerificationInfoSheet from "@/components/VerificationInfoSheet";
import AccountTypeLabel from "@/components/AccountTypeLabel";
import RealisticWorkCard from "@/components/RealisticWorkCard";
import ProfileContentTabs, { type ProfileTabKey } from "@/components/ProfileContentTabs";
import ProfileReelsGrid from "@/components/ProfileReelsGrid";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { books, getAuthor, getBookRoute } from "@/mocks/content";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import {
  getInitials,
  resolveDisplayBadge,
  resolveAccountType,
  resolveVerificationType,
  type AccountType,
  type CreatorStatus,
  type PublicProfileRow,
  type VerificationType,
} from "@/types/profile";

interface PublicProfile {
  id: string;
  displayName: string;
  username: string | null;
  penName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  accountType: AccountType;
  verificationType: VerificationType;
  creatorStatus: CreatorStatus;
  isCreator: boolean;
  creatorBadge: string | null;
  authorId: string | null;
  worksCount: number;
  readCount: number;
  followersCount: number;
  likesCount: number;
  workBookIds: string[];
}

function firstNonEmpty(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "Kitobxon";
}

function mapRow(row: PublicProfileRow): PublicProfile {
  // Derive the account type + badge the SAME way the own-profile does — the
  // public view exposes account_type='author' but a raw verification_type of
  // 'none', so a linked Muallif must still resolve to "Adib" + green tick.
  const accountType = resolveAccountType({
    account_type: row.account_type,
    is_creator: row.is_creator,
    is_adib: row.is_adib,
    author_id: row.author_id,
  });
  const verificationType = resolveVerificationType(
    accountType,
    row.verification_type,
    row.is_vip
  );
  return {
    id: row.id,
    displayName: firstNonEmpty(
      row.display_name,
      row.full_name,
      row.pen_name,
      row.provider_full_name
    ),
    username: row.username?.trim() || null,
    penName: row.pen_name,
    avatarUrl: resolveProfileAvatarUrl(row.avatar_url, row.provider_avatar_url),
    coverUrl: row.cover_url,
    bio: row.bio,
    accountType,
    verificationType,
    creatorStatus: (row.creator_status as CreatorStatus) ?? "none",
    isCreator: row.is_creator === true,
    creatorBadge: row.creator_badge ?? null,
    authorId: row.author_id ?? null,
    worksCount: row.works_count ?? 0,
    readCount: row.read_count ?? 0,
    followersCount: row.followers_count ?? 0,
    likesCount: row.likes_count ?? 0,
    workBookIds: [],
  };
}

function fromMockAuthor(id: string): PublicProfile | null {
  const a = getAuthor(id);
  if (!a) return null;
  return {
    id,
    displayName: a.name,
    username: null,
    penName: null,
    avatarUrl: a.photo,
    coverUrl: null,
    bio: a.bio,
    accountType: "adib",
    verificationType: "adib_green",
    creatorStatus: "none",
    isCreator: false,
    creatorBadge: null,
    authorId: id,
    worksCount: a.works.length,
    readCount: a.reads,
    followersCount: a.followers,
    likesCount: Math.round(a.reads / 12),
    workBookIds: books.filter((b) => b.authorId === id).map((b) => b.id),
  };
}

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { profile: me } = useProfile();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("asarlar");
  const { isFollowing, followersCount: liveFollowers, toggleFollow } = useFollow(id);
  const [badgeInfoOpen, setBadgeInfoOpen] = useState(false);

  const isOwn = !!id && id === me.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await (supabase as any)
        .from("mobile_public_profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (!error && data) {
        setProfile(mapRow(data as PublicProfileRow));
      } else {
        setProfile(
          fromMockAuthor(id) ?? {
            id,
            displayName: "Kitobxon",
            username: null,
            penName: null,
            avatarUrl: null,
            coverUrl: null,
            bio: null,
            accountType: "reader",
            verificationType: "none",
            creatorStatus: "none",
            isCreator: false,
            creatorBadge: null,
            authorId: null,
            worksCount: 0,
            readCount: 0,
            followersCount: 0,
            likesCount: 0,
            workBookIds: [],
          }
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading || !profile) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  const workBooks = books.filter((b) => profile.workBookIds.includes(b.id));
  const displayBadge = resolveDisplayBadge(profile);
  const badgeType = displayBadge?.type ?? profile.verificationType;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Cover */}
        <View style={styles.coverWrap}>
          {profile.coverUrl ? (
            <Image source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={isDark ? ["#15211B", "#172A22", "#101A15"] : ["#EAF6EF", "#F4EFDD", "#E3F0E6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={isDark
              ? ["rgba(13,17,23,0)", "rgba(13,17,23,0.55)", "rgba(13,17,23,0.95)"]
              : ["rgba(255,255,255,0)", "rgba(255,255,255,0.45)", "rgba(255,255,255,0.92)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.coverTopBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft color={isDark ? c.text : "#374151"} size={22} />
            </Pressable>
          </View>
        </View>

        {/* Avatar + action */}
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{getInitials(profile.displayName)}</Text>
              </View>
            )}
            {badgeType !== "none" && (
              <View style={styles.badgeOnAvatar}>
                <VerificationBadge verificationType={badgeType} size="lg" />
              </View>
            )}
          </View>
          <View style={styles.actions}>
            {isOwn ? (
              <PressableScale onPress={() => router.push("/edit-profile")} style={styles.editBtn}>
                <Pencil color={c.primary} size={14} strokeWidth={2.4} />
                <Text style={styles.editBtnText}>Tahrirlash</Text>
              </PressableScale>
            ) : (
              <PressableScale
                onPress={async () => {
                  const ok = await toggleFollow();
                  if (!ok) router.push("/auth");
                }}
                style={isFollowing ? styles.followingBtn : styles.followBtn}
              >
                {isFollowing ? (
                  <>
                    <UserCheck color={c.primary} size={15} strokeWidth={2.4} />
                    <Text style={styles.followingText}>Kuzatilmoqda</Text>
                  </>
                ) : (
                  <>
                    <UserPlus color="#fff" size={15} strokeWidth={2.4} />
                    <Text style={styles.followText}>Kuzatish</Text>
                  </>
                )}
              </PressableScale>
            )}
          </View>
        </View>

        {/* Name / bio */}
        <View style={styles.nameSect}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            {badgeType !== "none" && (
              <Pressable onPress={() => setBadgeInfoOpen(true)} hitSlop={8}>
                <VerificationBadge verificationType={badgeType} size="md" />
              </Pressable>
            )}
          </View>
          {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          <View style={styles.roleRow}>
            <AccountTypeLabel accountType={profile.accountType} size="lg" color={c.primary} weight="800" />
            {displayBadge ? (
              <View style={styles.displayBadgeChip}>
                <Text style={styles.displayBadgeText}>{displayBadge.label}</Text>
              </View>
            ) : null}
          </View>
          {profile.penName ? <Text style={styles.pen}>“{profile.penName}”</Text> : null}
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Yutuqlar (above stats) */}
        <Text style={styles.sectionLabel}>YUTUQLAR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          <BadgeCard c={c} gradient={["#FFD700", "#FFA000"]} icon="trophy" title="Faol muallif" subtitle="Adabiyot" />
          <BadgeCard c={c} gradient={["#A855F7", "#7C3AED"]} icon="star-shooting" title="Tan olingan" subtitle="Ijodkor" />
          <BadgeCard c={c} gradient={["#52B788", "#2D9B6F"]} icon="book-open-variant" title={`${profile.worksCount} asar`} subtitle="Nashr etilgan" />
        </ScrollView>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat value={profile.worksCount} label="Asar" c={c} />
          <View style={styles.statDivider} />
          <Stat value={profile.readCount} label="O'qildi" c={c} />
          <View style={styles.statDivider} />
          <Stat value={liveFollowers ?? profile.followersCount} label="Obunachilar" c={c} />
          <View style={styles.statDivider} />
          <Stat value={profile.likesCount} label="Layklar" c={c} />
        </View>

        {/* Tabs */}
        <ProfileContentTabs active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        {activeTab === "asarlar" ? (
          workBooks.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingVertical: 18 }}>
              {workBooks.map((b) => (
                <RealisticWorkCard
                  key={b.id}
                  title={b.title}
                  subtitle={getAuthor(b.authorId)?.name}
                  cover={b.cover}
                  width={124}
                  badge={b.free ? "BEPUL" : undefined}
                  onPress={() => router.push(getBookRoute(b))}
                />
              ))}
            </ScrollView>
          ) : (
            <Empty c={c} icon={<BookOpen color={c.textMuted} size={30} strokeWidth={1.5} />} text="Hozircha asar yo'q" />
          )
        ) : activeTab === "reels" ? (
          <ProfileReelsGrid userId={id ?? null} own={isOwn} currentUserId={me.id} />
        ) : activeTab === "monologlar" ? (
          <Empty c={c} icon={<Mic color={c.textMuted} size={30} strokeWidth={1.5} />} text="Monologlar hali yo'q" />
        ) : (
          <Empty c={c} icon={<Star color={c.textMuted} size={30} strokeWidth={1.5} />} text="Maqolalar hali yo'q" />
        )}
      </ScrollView>

      <VerificationInfoSheet
        visible={badgeInfoOpen}
        verificationType={badgeType}
        subjectName={isOwn ? null : profile.displayName}
        onClose={() => setBadgeInfoOpen(false)}
      />
    </View>
  );
}

function Stat({ value, label, c }: { value: number; label: string; c: AppTheme }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.5 }}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function BadgeCard({
  c,
  gradient,
  icon,
  title,
  subtitle,
}: {
  c: AppTheme;
  gradient: [string, string];
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ width: 120, backgroundColor: c.bgCard, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, alignItems: "center", gap: 8 }}>
      <LinearGradient colors={gradient} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={icon as any} size={22} color="#fff" />
      </LinearGradient>
      <Text style={{ color: c.text, fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 16 }}>{title}</Text>
      <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: "600", textAlign: "center" }}>{subtitle}</Text>
    </View>
  );
}

function Empty({ c, icon, text }: { c: AppTheme; icon: React.ReactNode; text: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
      {icon}
      <Text style={{ color: c.textDim, fontSize: 14, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    coverWrap: { height: 190, width: "100%", backgroundColor: isDark ? c.bgElevated : c.surface, overflow: "hidden" },
    coverTopBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? "rgba(28,33,40,0.75)" : "rgba(255,255,255,0.82)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, marginTop: -54, gap: 12 },
    avatarWrap: {
      position: "relative",
      borderRadius: 60,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.45 : 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    avatar: { width: 118, height: 118, borderRadius: 59, borderWidth: 4, borderColor: c.bg, backgroundColor: c.surface },
    avatarPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: c.primary },
    avatarInitials: { color: "#fff", fontSize: 42, fontWeight: "900", fontFamily: FONT.serif },
    badgeOnAvatar: { position: "absolute", bottom: 6, right: 2 },
    actions: { flex: 1, flexDirection: "row", justifyContent: "flex-end", paddingBottom: 10 },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.06)",
    },
    editBtnText: { color: c.primary, fontSize: 14, fontWeight: "800" },
    followBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: c.primary,
    },
    followText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    followingBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.06)",
    },
    followingText: { color: c.primary, fontSize: 14, fontWeight: "800" },
    nameSect: { paddingHorizontal: 20, paddingTop: 14, gap: 5 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    displayName: { color: c.text, fontSize: 22, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -0.3 },
    handle: { color: c.textMuted, fontSize: 14, fontWeight: "600" },
    roleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
    displayBadgeChip: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.14)" : "rgba(82,183,136,0.10)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.30)",
    },
    displayBadgeText: { color: c.primary, fontSize: 11.5, fontWeight: "800" },
    pen: { color: c.primary, fontSize: 13, fontWeight: "700" },
    bio: { color: c.textDim, fontSize: 13, lineHeight: 20, marginTop: 4, fontWeight: "500" },
    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 14,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 20,
      marginTop: 18,
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 16,
    },
    statDivider: { width: 1, height: 28, backgroundColor: c.border },
  });
}
