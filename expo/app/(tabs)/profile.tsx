import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import {
  BadgeCheck,
  BookOpen,
  Globe,
  Instagram,
  Mic,
  Pencil,
  Play,
  Send,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  Youtube,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FadeSlideIn, ScreenTransitionWrapper, StaggeredCard } from "@/components/animations";
import VerificationBadge from "@/components/VerificationBadge";
import VerificationInfoSheet from "@/components/VerificationInfoSheet";
import AccountTypeLabel from "@/components/AccountTypeLabel";
import RealisticWorkCard from "@/components/RealisticWorkCard";
import PremiumCreatorActionButton from "@/components/PremiumCreatorActionButton";
import ProfileContentTabs from "@/components/ProfileContentTabs";
import ProfileReelsGrid from "@/components/ProfileReelsGrid";
import { FONT, PressableScale } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { books, getAuthor, getBookRoute } from "@/mocks/content";
import { getInitials, isApprovedCreator, profileHandle, resolveDisplayBadge } from "@/types/profile";
import AuthorWorkCard from "@/components/AuthorWorkCard";
import { useOwnedContentSet } from "@/hooks/usePayments";
import { useAuthorWorks, useIsAuthor } from "@/hooks/useAuthorAccount";
import { useShelf } from "@/hooks/useShelf";
import { useProfileFollowCounts, fetchFollowers, fetchFollowing } from "@/hooks/useFollowLists";
import { ProfilePeopleModal, ProfileReadsModal } from "@/components/ProfileStatModals";
import type { AuthorWork } from "@/types/author";
import { useProfile } from "@/providers/ProfileProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useBranding } from "@/providers/BrandingProvider";
import { useTheme } from "@/providers/ThemeProvider";

type ContentTab = "asarlar" | "reels" | "monologlar" | "maqolalar";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const ownedSet = useOwnedContentSet();
  const { colors: c, isDark, toggleTheme } = useTheme();
  const { appName } = useBranding();
  const { profile } = useProfile();
  const { userId, refreshProfileRow } = useAuth();
  const isAuthor = useIsAuthor();
  const { works: authorWorks, refetch: refetchAuthorWorks } = useAuthorWorks();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshProfileRow(), refetchAuthorWorks()]);
  }, [refreshProfileRow, refetchAuthorWorks]);
  const { refreshing, replayKey, onRefresh } = usePullToRefresh(handleRefresh);

  // Never let a stale cached profile hide the author status: re-read the fresh
  // `profiles` row (account_type / author_id) every time this screen is focused.
  useFocusEffect(
    useCallback(() => {
      refreshProfileRow().catch(() => {});
    }, [refreshProfileRow])
  );
  const [activeTab, setActiveTab] = useState<ContentTab>("asarlar");
  const [badgeInfoOpen, setBadgeInfoOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  useEffect(() => { setAvatarError(false); }, [profile.avatarUrl]);
  useEffect(() => { setCoverError(false); }, [profile.coverUrl]);

  const shelf = books.filter((b) => ownedSet.has(`book:${b.id}`));

  // Real profile stats: reads (finished non-poem), followers/following counts.
  const { completed, allReads } = useShelf();
  const followCounts = useProfileFollowCounts(userId);
  const readsForModal = useMemo(() => allReads.filter((x) => x.contentType !== "poem"), [allReads]);
  const readCount = useMemo(() => completed.filter((x) => x.contentType !== "poem").length, [completed]);
  const [peopleModal, setPeopleModal] = useState<"followers" | "following" | null>(null);
  const [readsOpen, setReadsOpen] = useState(false);

  const isCreator = isApprovedCreator(profile);
  const isReader = profile.accountType === "reader" && !isAuthor;
  const isPublisher =
    profile.accountType === "publisher" ||
    profile.accountType === "company";
  const worksCount = isAuthor ? authorWorks.length : profile.worksCount;
  // Combined author/creator badge (spec #6): "Ijodkor + Muallif" / "Ijodkor" /
  // "Muallif". Falls back to the account's own verification badge for VIP etc.
  const displayBadge = resolveDisplayBadge(profile);
  const nameBadgeType = displayBadge?.type ?? profile.verificationType;

  const handleCreatorAction = useCallback(async () => {
    await refreshProfileRow().catch(() => {});
    router.push("/creator/submit");
  }, [refreshProfileRow]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTransitionWrapper type="scale" replayKey={replayKey}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.bgCard}
              progressViewOffset={insets.top}
            />
          }
        >
          {/* ─── COVER ─────────────────────────────────────────── */}
          <View style={styles.coverWrap}>
            {profile.coverUrl && !coverError ? (
              <Image
                source={{ uri: profile.coverUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                onError={() => setCoverError(true)}
              />
            ) : (
              <LinearGradient
                colors={
                  isDark
                    ? ["#15211B", "#172A22", "#101A15"]
                    : ["#EAF6EF", "#F4EFDD", "#E3F0E6"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(13,17,23,0)", "rgba(13,17,23,0.55)", "rgba(13,17,23,0.95)"]
                  : ["rgba(255,255,255,0)", "rgba(255,255,255,0.45)", "rgba(255,255,255,0.92)"]
              }
              style={StyleSheet.absoluteFill}
            />
            {/* Top bar inside cover */}
            <View style={[styles.coverTopBar, { paddingTop: insets.top + 8 }]}>
              {isReader ? (
                <PressableScale
                  onPress={() => router.push("/creator/become")}
                  style={styles.becomeCreatorBtn}
                >
                  <LinearGradient
                    colors={["#52B788", "#2D9B6F"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.becomeCreatorInner}
                  >
                    <Sparkles color="#fff" size={15} strokeWidth={2.4} />
                    <Text style={styles.becomeCreatorText}>Ijodkor bo'lish</Text>
                  </LinearGradient>
                </PressableScale>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <View style={styles.coverTopActions}>
                {/* Muallif akkaunt: oltin "Daromadlar" tugmasi (kun-tun yonida) */}
                {isAuthor ? (
                  <PressableScale
                    onPress={() => router.push("/muallif/daromadlar")}
                    style={styles.earningsTopBtn}
                  >
                    <LinearGradient
                      colors={["#FBBF24", "#F59E0B"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.earningsTopInner}
                    >
                      <TrendingUp color="#fff" size={14} strokeWidth={2.6} />
                      <Text style={styles.earningsTopText} numberOfLines={1}>
                        Daromadlar
                      </Text>
                    </LinearGradient>
                  </PressableScale>
                ) : null}
                <PressableScale onPress={toggleTheme} style={styles.coverBtn}>
                  <Ionicons
                    name={isDark ? "sunny" : "moon"}
                    size={18}
                    color={isDark ? "#F4A261" : "#374151"}
                  />
                </PressableScale>
                <PressableScale onPress={() => router.push("/settings")} style={styles.coverBtn}>
                  <Settings color={isDark ? c.text : "#374151"} size={18} strokeWidth={2} />
                </PressableScale>
              </View>
            </View>
          </View>

          {/* ─── AVATAR ROW ─────────────────────────────────────── */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              {profile.avatarUrl && !avatarError ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(profile.displayName)}
                  </Text>
                </View>
              )}
              {nameBadgeType !== "none" && (
                <View style={styles.badgeOnAvatar}>
                  <VerificationBadge verificationType={nameBadgeType} size="lg" />
                </View>
              )}
              {isPublisher && (
                <View style={styles.publisherRing} />
              )}
            </View>
            <View style={styles.avatarActions}>
              <PressableScale
                onPress={() => router.push("/edit-profile")}
                style={styles.editBtn}
              >
                <Pencil color={c.primary} size={14} strokeWidth={2.4} />
                <Text style={styles.editBtnText} numberOfLines={1}>
                  Tahrirlash
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* ─── NAME / BIO ─────────────────────────────────────── */}
          <View style={styles.nameSect}>
            <FadeSlideIn delay={60} distance={6}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{profile.displayName}</Text>
                {nameBadgeType !== "none" && (
                  <Pressable onPress={() => setBadgeInfoOpen(true)} hitSlop={8}>
                    <VerificationBadge verificationType={nameBadgeType} size="md" />
                  </Pressable>
                )}
              </View>
              <Text style={styles.handle}>@{profileHandle(profile)}</Text>
              <View style={styles.roleRow}>
                <AccountTypeLabel
                  accountType={profile.accountType}
                  publisherSubType={profile.publisherSubType}
                  size="lg"
                  color={c.primary}
                  weight="800"
                />
                {displayBadge ? (
                  <View style={styles.muallifChip}>
                    <BadgeCheck color={c.primary} size={13} strokeWidth={2.4} />
                    <Text style={styles.muallifChipText}>{displayBadge.label}</Text>
                  </View>
                ) : null}
              </View>
              {profile.bio ? (
                <Text style={styles.bio}>{profile.bio}</Text>
              ) : null}
              <SocialLinks profile={profile} c={c} styles={styles} />
            </FadeSlideIn>
          </View>

          {/* Muallif "Daromadlar" tugmasi endi yuqorida, Tahrirlash yonida. */}

          {/* Phone verification moved to Settings → Tasdiqlash for a cleaner profile. */}

          {/* ─── YUTUQLAR — vaqtincha yashirilgan (keyinchalik real yutuqlar
              bilan qaytariladi). BadgeCard komponenti pastda saqlab qolindi. ── */}

          {/* ─── STATS ──────────────────────────────────────────── */}
          <View style={styles.statsRow}>
            <StatItem value={worksCount} label="Asarlar" c={c} onPress={() => setActiveTab("asarlar")} />
            <View style={styles.statDivider} />
            <StatItem value={readCount} label="O'qilgan" c={c} onPress={() => setReadsOpen(true)} />
            <View style={styles.statDivider} />
            <StatItem value={followCounts.followers} label="Obunachilar" c={c} onPress={() => setPeopleModal("followers")} />
            <View style={styles.statDivider} />
            <StatItem value={followCounts.following} label="Obunalar" c={c} onPress={() => setPeopleModal("following")} />
          </View>

          {/* ─── CONTENT TABS (icons, centered) ─────────────────── */}
          <ProfileContentTabs active={activeTab} onChange={setActiveTab} />

          {/* ─── TAB CONTENT (profile content only) ─────────────── */}
          <ContentTabView
            tab={activeTab}
            shelf={shelf}
            isAuthor={isAuthor}
            authorWorks={authorWorks}
            currentUserId={userId}
            c={c}
            isDark={isDark}
            styles={styles}
          />

          <Text style={styles.version}>{appName} v2.4.0</Text>
        </ScrollView>
      </ScreenTransitionWrapper>

      {/* Floating creator submit CTA — only once the user is a creator */}
      <PremiumCreatorActionButton
        label="Ijodni boshlaymiz"
        visible={isCreator}
        bottom={insets.bottom + (Platform.OS === "ios" ? 94 : 80)}
        onPress={handleCreatorAction}
      />

      <VerificationInfoSheet
        visible={badgeInfoOpen}
        verificationType={nameBadgeType}
        onClose={() => setBadgeInfoOpen(false)}
      />

      {peopleModal === "followers" && userId ? (
        <ProfilePeopleModal
          title="Obunachilar"
          emptyText="Hali obunachilar yo'q"
          loader={() => fetchFollowers(userId)}
          onClose={() => setPeopleModal(null)}
          c={c}
        />
      ) : null}
      {peopleModal === "following" && userId ? (
        <ProfilePeopleModal
          title="Obunalar"
          emptyText="Hali obuna bo'lmagan"
          loader={() => fetchFollowing(userId)}
          onClose={() => setPeopleModal(null)}
          c={c}
        />
      ) : null}
      {readsOpen ? (
        <ProfileReadsModal items={readsForModal} onClose={() => setReadsOpen(false)} c={c} />
      ) : null}
    </View>
  );
}

function SocialLinks({
  profile,
  c,
  styles,
}: {
  profile: ReturnType<typeof useProfile>["profile"];
  c: AppTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const items: { key: string; icon: React.ReactNode; url: string }[] = [];
  const open = (url: string) => {
    const full = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(full).catch(() => {});
  };
  if (profile.websiteUrl) items.push({ key: "web", icon: <Globe color={c.primary} size={16} />, url: profile.websiteUrl });
  if (profile.instagramUrl) items.push({ key: "ig", icon: <Instagram color="#E1306C" size={16} />, url: profile.instagramUrl });
  if (profile.telegramUrl) items.push({ key: "tg", icon: <Send color="#229ED9" size={16} />, url: profile.telegramUrl });
  if (profile.youtubeUrl) items.push({ key: "yt", icon: <Youtube color="#FF0000" size={16} />, url: profile.youtubeUrl });

  if (items.length === 0 && profile.links.length === 0) return null;

  return (
    <View style={styles.socialRow}>
      {items.map((it) => (
        <Pressable key={it.key} onPress={() => open(it.url)} style={styles.socialChip}>
          {it.icon}
        </Pressable>
      ))}
      {profile.links.map((l) => (
        <Pressable key={l.id} onPress={() => open(l.url)} style={styles.socialLinkPill}>
          <Globe color={c.primary} size={13} />
          <Text style={styles.socialLinkText} numberOfLines={1}>{l.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ─── SUB-COMPONENTS ─────────────────────────────────────────────── */

function StatItem({ value, label, c, onPress }: { value: number; label: string; c: AppTheme; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ alignItems: "center", flex: 1 }, pressed && onPress ? { opacity: 0.6 } : null]}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.5 }}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 10.5, fontWeight: "600", marginTop: 2 }} numberOfLines={1}>{label}</Text>
    </Pressable>
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
    <View
      style={{
        width: 104,
        height: 110,
        backgroundColor: c.bgCard,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: 8,
        paddingVertical: 11,
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 6,
      }}
    >
      <LinearGradient colors={gradient} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={icon as any} size={18} color="#fff" />
      </LinearGradient>
      <Text numberOfLines={2} style={{ color: c.text, fontSize: 11, fontWeight: "800", textAlign: "center", lineHeight: 14 }}>{title}</Text>
      <Text numberOfLines={1} style={{ color: c.textMuted, fontSize: 9.5, fontWeight: "600", textAlign: "center" }}>{subtitle}</Text>
    </View>
  );
}

function ContentTabView({
  tab,
  shelf,
  isAuthor,
  authorWorks,
  currentUserId,
  c,
  isDark,
  styles,
}: {
  tab: ContentTab;
  shelf: any[];
  isAuthor: boolean;
  authorWorks: AuthorWork[];
  currentUserId: string | null;
  c: AppTheme;
  isDark: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  if (tab === "asarlar") {
    // Author accounts show THEIR OWN works (from the linked author record);
    // readers keep their purchased-books shelf.
    if (isAuthor) {
      if (authorWorks.length === 0) {
        return (
          <EmptyTabState
            c={c}
            icon={<BookOpen color={c.textMuted} size={32} strokeWidth={1.5} />}
            text="Hali asarlar mavjud emas"
            sub="Sizga biriktirilgan asarlar shu yerda ko'rinadi"
          />
        );
      }
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingVertical: 18 }}>
          {authorWorks.map((w) => (
            <AuthorWorkCard key={`${w.contentType}:${w.id}`} work={w} width={128} />
          ))}
        </ScrollView>
      );
    }

    if (shelf.length === 0) {
      return <EmptyTabState c={c} icon={<BookOpen color={c.textMuted} size={32} strokeWidth={1.5} />} text="Hozircha asar yo'q" />;
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingVertical: 18 }}>
        {shelf.map((b) => (
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
    );
  }

  if (tab === "reels") {
    return <ProfileReelsGrid userId={currentUserId} own currentUserId={currentUserId} />;
  }

  if (tab === "monologlar") {
    return (
      <EmptyTabState
        c={c}
        icon={<Mic color={c.textMuted} size={32} strokeWidth={1.5} />}
        text="Monologlar hali yo'q"
        sub="She'r, hikoya va audio ijrolaringizni ulashing"
      />
    );
  }

  return (
    <EmptyTabState
      c={c}
      icon={<Star color={c.textMuted} size={32} strokeWidth={1.5} />}
      text="Maqolalar hali yo'q"
      sub="Adabiy maqolalaringizni ulashing"
    />
  );
}

function EmptyTabState({
  c,
  icon,
  text,
  sub,
}: {
  c: AppTheme;
  icon: React.ReactNode;
  text: string;
  sub?: string;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, gap: 10 }}>
      {icon}
      <Text style={{ color: c.textDim, fontSize: 14, fontWeight: "700" }}>{text}</Text>
      {sub && <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: "500", textAlign: "center", paddingHorizontal: 40 }}>{sub}</Text>}
    </View>
  );
}

/* ─── STYLES ─────────────────────────────────────────────────────── */

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    /* Cover */
    coverWrap: {
      height: 200,
      width: "100%",
      backgroundColor: isDark ? c.bgElevated : c.surface,
      overflow: "hidden",
    },
    coverTopBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    coverTopActions: { flexDirection: "row", gap: 8 },
    becomeCreatorBtn: {
      borderRadius: 999,
      overflow: "hidden",
      shadowColor: "#2D9B6F",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    becomeCreatorInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    becomeCreatorText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
    coverBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? "rgba(28,33,40,0.75)" : "rgba(255,255,255,0.82)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      alignItems: "center",
      justifyContent: "center",
    },

    /* Avatar row */
    avatarRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 20,
      marginTop: -54,
      gap: 12,
    },
    avatarWrap: {
      position: "relative",
      borderRadius: 60,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.45 : 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    avatar: {
      width: 118,
      height: 118,
      borderRadius: 59,
      borderWidth: 4,
      borderColor: c.bg,
      backgroundColor: c.surface,
    },
    avatarPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary,
    },
    avatarInitials: {
      color: "#fff",
      fontSize: 42,
      fontWeight: "900",
      fontFamily: FONT.serif,
    },
    badgeOnAvatar: {
      position: "absolute",
      bottom: 6,
      right: 2,
    },
    publisherRing: {
      position: "absolute",
      inset: -3,
      borderRadius: 62,
      borderWidth: 2,
      borderColor: "#374151",
    },
    avatarActions: {
      flexDirection: "row",
      flex: 1,
      justifyContent: "flex-end",
      gap: 8,
      paddingBottom: 10,
    },
    editBtn: {
      flexShrink: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.06)",
    },
    editBtnText: { color: c.primary, fontSize: 13.5, fontWeight: "800" },
    /* Muallif "Daromadlar" — cover ustidagi oltin tugma (kun-tun yonida) */
    earningsTopBtn: {
      borderRadius: 999,
      overflow: "hidden",
      shadowColor: "#B8860B",
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    },
    earningsTopInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 38,
      paddingHorizontal: 14,
    },
    earningsTopText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },

    /* Name / bio */
    nameSect: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 4 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    displayName: { color: c.text, fontSize: 22, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -0.3 },
    handle: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
    roleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
    muallifChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.14)" : "rgba(82,183,136,0.10)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.30)",
    },
    muallifChipText: { color: c.primary, fontSize: 11.5, fontWeight: "800" },
    bio: { color: c.textDim, fontSize: 13, lineHeight: 20, marginTop: 6, fontWeight: "500" },

    socialRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 },
    socialChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    socialLinkPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: 160,
      paddingHorizontal: 12,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.06)",
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    socialLinkText: { color: c.primary, fontSize: 12.5, fontWeight: "700" },
    phoneVerifyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      marginHorizontal: 20,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      opacity: 0.62,
    },
    phoneVerifyIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgElevated,
    },
    phoneVerifyTitle: {
      flex: 1,
      color: c.text,
      fontSize: 13.5,
      lineHeight: 18,
      fontWeight: "800",
    },
    phoneVerifyPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(17,24,39,0.06)",
    },
    phoneVerifyPillText: { color: c.textMuted, fontSize: 11, fontWeight: "800" },

    /* Stats */
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 20,
      marginTop: 12,
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 11,
    },
    statDivider: { width: 1, height: 22, backgroundColor: c.border },

    /* Creator banner */
    creatorBannerWrap: { marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: "hidden" },
    creatorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(56,189,248,0.20)",
    },
    creatorBannerIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(56,189,248,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    creatorBannerTitle: { color: c.text, fontSize: 13, fontWeight: "800" },
    creatorBannerDesc: { color: c.textMuted, fontSize: 12, marginTop: 2, fontWeight: "500" },

    /* Content tabs */
    tabsContainer: {
      marginTop: 20,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tabsScroll: { paddingHorizontal: 16, gap: 4 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      marginBottom: 4,
    },
    tabActive: {
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.22)",
    },
    tabLabel: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
    tabLabelActive: { color: c.primary, fontWeight: "800" },

    /* Section labels */
    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 10,
    },

    /* Menu card */
    menuCard: {
      marginHorizontal: 20,
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    menuIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    menuText: { flex: 1, color: c.text, fontSize: 15, fontWeight: "600" },

    /* Version */
    version: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 32,
      fontWeight: "500",
    },
  });
}
