import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpen, ChevronLeft, Mic, Pencil, Star, UserCheck, UserPlus } from "lucide-react-native";
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
import AuthorWorkCard from "@/components/AuthorWorkCard";
import ProfileContentTabs, { type ProfileTabKey } from "@/components/ProfileContentTabs";
import ProfileReelsGrid from "@/components/ProfileReelsGrid";
import { useAuthorPublicWorks, useAuthorWorks } from "@/hooks/useAuthorAccount";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { books, getAuthor } from "@/mocks/content";
import { useAuth } from "@/providers/AuthProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useAuthGate } from "@/providers/AuthGateProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { AuthorWork } from "@/types/author";
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
  const { userId: currentUserId } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("asarlar");
  const { isFollowing, followersCount: liveFollowers, toggleFollow } = useFollow(id);
  const { promptLogin } = useAuthGate();
  const [badgeInfoOpen, setBadgeInfoOpen] = useState(false);

  const isOwn = !!id && id === me.id;
  const viewedProfileId = id ? String(id) : undefined;
  const viewedAuthorId = profile?.authorId ?? id;
  const {
    works: ownWorks,
    loading: ownWorksLoading,
    error: ownWorksError,
  } = useAuthorWorks();
  const {
    works: publicWorks,
    loading: publicWorksLoading,
    error: publicWorksError,
  } = useAuthorPublicWorks(
    !isOwn ? viewedProfileId : undefined,
    { enabled: !isOwn && !!viewedProfileId }
  );
  const profileWorks = isOwn ? ownWorks : publicWorks;
  const profileWorksLoading = isOwn ? ownWorksLoading : publicWorksLoading;
  const profileWorksError = isOwn ? ownWorksError : publicWorksError;

  useEffect(() => {
    if (!__DEV__) return;
    console.log("[ProfileWorks] currentUserId:", currentUserId);
    console.log("[ProfileWorks] viewedProfileId:", viewedProfileId ?? null);
    console.log("[ProfileWorks] viewedAuthorId:", viewedAuthorId ?? null);
    console.log("[ProfileWorks] isOwnProfile:", isOwn);
    console.log("[ProfileWorks] works:", profileWorks);
    console.log("[ProfileWorks] works error:", profileWorksError);
  }, [currentUserId, isOwn, profileWorks, profileWorksError, viewedAuthorId, viewedProfileId]);

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

  const literaryWorks = profileWorks.filter((work) => work.contentType !== "article" && work.contentType !== "monologue");
  const articleWorks = profileWorks.filter((work) => work.contentType === "article");
  const monologueWorks = profileWorks.filter((work) => work.contentType === "monologue");
  const visibleWorksCount = profileWorksLoading
    ? profile.worksCount
    : profileWorks.filter((work) => work.contentType !== "monologue").length;
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
                  if (!ok) promptLogin("Obuna bo'lish uchun hisobingizga kiring yoki ro'yxatdan o'ting.");
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
          <BadgeCard c={c} gradient={["#52B788", "#2D9B6F"]} icon="book-open-variant" title={`${visibleWorksCount} asar`} subtitle={isOwn ? "Barcha holatlar" : "Nashr etilgan"} />
        </ScrollView>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat value={visibleWorksCount} label="Asar" c={c} />
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
          <ProfileWorksSection
            works={literaryWorks}
            loading={profileWorksLoading}
            error={profileWorksError}
            authorName={profile.displayName}
            emptyText={isOwn
              ? "Hozircha profilingizga biriktirilgan asarlar yo'q."
              : "Bu muallifning hozircha ommaga ochiq asarlari yo'q."}
            icon={<BookOpen color={c.textMuted} size={30} strokeWidth={1.5} />}
            c={c}
            showStats={isOwn}
          />
        ) : activeTab === "reels" ? (
          <ProfileReelsGrid userId={id ?? null} own={isOwn} currentUserId={currentUserId} />
        ) : activeTab === "monologlar" ? (
          <ProfileWorksSection
            works={monologueWorks}
            loading={profileWorksLoading}
            error={profileWorksError}
            authorName={profile.displayName}
            emptyText={isOwn ? "Monologlaringiz hali yo'q." : "Bu ijodkorning ommaga ochiq monologlari yo'q."}
            icon={<Mic color={c.textMuted} size={30} strokeWidth={1.5} />}
            c={c}
            showStats={isOwn}
          />
        ) : (
          <ProfileWorksSection
            works={articleWorks}
            loading={profileWorksLoading}
            error={profileWorksError}
            authorName={profile.displayName}
            emptyText={isOwn ? "Maqolalaringiz hali yo'q." : "Bu muallifning ommaga ochiq maqolalari yo'q."}
            icon={<Star color={c.textMuted} size={30} strokeWidth={1.5} />}
            c={c}
            showStats={isOwn}
          />
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

function ProfileWorksSection({
  works,
  loading,
  error,
  authorName,
  emptyText,
  icon,
  c,
  showStats,
}: {
  works: AuthorWork[];
  loading: boolean;
  error: string | null;
  authorName: string;
  emptyText: string;
  icon: React.ReactNode;
  c: AppTheme;
  showStats: boolean;
}) {
  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 42 }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  if (error) {
    return <Empty c={c} icon={icon} text={error} />;
  }
  if (works.length === 0) {
    return <Empty c={c} icon={icon} text={emptyText} />;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingVertical: 18 }}
    >
      {works.map((work) => (
        <AuthorWorkCard
          key={`${work.contentType}:${work.id}`}
          work={work}
          width={128}
          showStats={showStats}
          authorName={authorName}
        />
      ))}
    </ScrollView>
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
