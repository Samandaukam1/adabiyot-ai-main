import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Feather,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Quote,
  Search,
  Send,
  Share2,
  Sparkles,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import {
  FadeSlideIn,
  ScreenTransitionWrapper,
  StaggeredCard,
  TypingText,
} from "@/components/animations";
import * as Clipboard from "expo-clipboard";
import { PullRefreshIndicator } from "@/components/PullRefreshIndicator";
import VerificationBadge from "@/components/VerificationBadge";
import {
  DeleteConfirmModal,
  EditPostSheet,
  PostActionMenu,
  ReportSheet,
} from "@/components/sozlab/SozlabPostModals";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useTheme } from "@/providers/ThemeProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useAuth } from "@/providers/AuthProvider";
import { books, getAuthor, getBookRoute } from "@/mocks/content";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { openContentPreview } from "@/lib/contentNavigation";
import { createNotification, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { recordMentions, type MentionPick } from "@/lib/mentions";
import { MentionSuggestionList, MentionText, useMentionAutocomplete } from "@/components/sozlab/MentionTextInput";
import { resolveHandleToUserId } from "@/hooks/useMentionSearch";
import { useLiteratureSearch, type LiteratureSearchItem } from "@/hooks/useLiteratureSearch";
import { normalizeKind, TOP_KIND_LABELS, type TopMaterialKind } from "@/types/community";
import type { Book } from "@/mocks/content";
import type { SozlabPostRow, SozlabPostType, SozlabReportReason, SozlabTargetKind } from "@/types/database";
import { resolveBadgeType, resolveDisplayBadge } from "@/types/profile";
import type { UserProfile, VerificationType } from "@/types/profile";

type PostType = SozlabPostType;
type LiteratureKind = SozlabTargetKind;
type DbError = { message: string; code?: string } | null;
type SozlabInsertResult = { data: SozlabPostRow | null; error: DbError };

interface Post {
  id: string;
  userId?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  authorPhoto?: string | null;
  authorVerification?: string | null;
  isEdited?: boolean;
  type: PostType;
  text: string;
  bookId?: string;
  bookTitle?: string;
  targetKind?: LiteratureKind;
  targetId?: string | null;
  targetTitle?: string | null;
  targetAuthor?: string | null;
  /** Optional literature attachment (real `attached_content_*` columns) */
  attachedId?: string | null;
  attachedTitle?: string | null;
  attachedCover?: string | null;
  attachedAuthor?: string | null;
  attachedType?: string | null;
  attachedKind?: TopMaterialKind | null;
  likes: number;
  comments: number;
  ts: number;
  liked?: boolean;
}

const SAMPLE_POSTS: Post[] = [
  {
    id: "p1",
    authorId: "a1",
    type: "quote",
    text: "\"Tun yarmida shahar uxlar, faqat men uyg'oqman. Derazadan tushayotgan chiroq nuri xonami oltin rangga bo'yaydi.\"",
    bookId: "b1",
    bookTitle: "Sukunat Ovozi",
    likes: 342,
    comments: 28,
    ts: Date.now() - 1000 * 60 * 14,
  },
  {
    id: "p2",
    authorId: "a2",
    type: "thought",
    text: "Kitob o'qish — bu o'zingga qaytish. Har bir sahifa seni birozgina o'zingga yaqinlashtiradi.",
    likes: 517,
    comments: 43,
    ts: Date.now() - 1000 * 60 * 47,
  },
  {
    id: "p3",
    authorId: "a5",
    type: "review",
    text: "\"Shaharda Yolg'iz\" — bu faqat she'rlar to'plami emas. Bu zamonaviy shaharda yashayotgan har bir inson hissiyotining oyinasi. Sardor Rashidov tilni o'z qo'liga olib, undan tasvirlar to'qiydi.",
    bookId: "b2",
    bookTitle: "Shaharda Yolg'iz",
    likes: 289,
    comments: 61,
    ts: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "p4",
    authorId: "a4",
    type: "discussion",
    text: "Savol: Qaysi o'zbek romanini ingliz tiliga tarjima qilinishini xohlaysiz? Menga ko'ra, \"Qora Daryo\" jahon adabiyotiga munosib.",
    likes: 196,
    comments: 88,
    ts: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "p5",
    authorId: "a3",
    type: "quote",
    text: "\"Yurak tilida gapiring, tushunmasalar ham, bir kuni eshitadilar.\"",
    bookId: "b8",
    bookTitle: "Yurak Tilida",
    likes: 1204,
    comments: 132,
    ts: Date.now() - 1000 * 60 * 60 * 9,
  },
  {
    id: "p6",
    authorId: "a2",
    type: "thought",
    text: "Kuz kelib, men yana she'r yoza boshladim. Qish — roman, bahor — hikoya, yoz — tanaffus. Kuz esa har doim she'rga to'la.",
    likes: 437,
    comments: 55,
    ts: Date.now() - 1000 * 60 * 60 * 14,
  },
  {
    id: "p7",
    authorId: "a1",
    type: "review",
    text: "Bolalar adabiyotini past sanash noto'g'ri. Malika Yusupovaning \"Oy Bolasi\" — oddiy va chuqur asar. Kattalar ham o'qisin.",
    bookId: "b3",
    bookTitle: "Oy Bolasi",
    likes: 178,
    comments: 24,
    ts: Date.now() - 1000 * 60 * 60 * 22,
  },
];

const TYPE_LABELS: Record<PostType, string> = {
  thought: "FIKR",
  quote: "IQTIBOS",
  review: "TAHLIL",
  discussion: "MUHOKAMA",
};

const TYPE_COLORS: Record<PostType, string> = {
  thought: "#52B788",
  quote: "#52B788",
  review: "#52B788",
  discussion: "#52B788",
};

const TARGET_KIND_LABELS: Record<LiteratureKind, string> = {
  book: "Kitob",
  poem: "She'r",
  screenplay: "Ssenariy",
  other: "Adabiyot",
};

const DEFAULT_AUTHOR_NAME = "So'zLab foydalanuvchisi";
const PROFILE_DISPLAY_NAME = "Aziz Karimov";
const DEFAULT_POST_TYPE: PostType = "thought";
const MODERATION_STATUS_CANDIDATES = ["pending", "approved"] as const;

export default function SozLabScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const { profile } = useProfile();
  const { userId: currentUserId } = useAuth();
  const params = useLocalSearchParams<{ openPostId?: string; focusCommentId?: string }>();
  const { count: unreadCount } = useUnreadNotificationCount();
  const handledDeepLink = useRef<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [composeVisible, setComposeVisible] = useState(false);
  const [remotePosts, setRemotePosts] = useState<Post[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [editTarget, setEditTarget] = useState<Post | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // A post is "own" ONLY when its user_id exactly matches the signed-in user.
  // Never treat author-less / legacy posts as the current account's posts.
  const isOwnPost = useCallback(
    (post: Post) => !!currentUserId && post.userId === currentUserId,
    [currentUserId]
  );

  const handleCopy = useCallback(async (post: Post) => {
    try {
      await Clipboard.setStringAsync(post.text);
      setToastMessage("Nusxa olindi");
    } catch {
      // ignore
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    const post = deleteTarget;
    if (!post) return;
    setActionBusy(true);
    if (post.id.startsWith("local-")) {
      setRemotePosts((prev) => prev.filter((p) => p.id !== post.id));
      setActionBusy(false);
      setDeleteTarget(null);
      setToastMessage("Post o'chirildi");
      return;
    }
    const { error } = await softDeletePost(post.id);
    setActionBusy(false);
    setDeleteTarget(null);
    if (error) {
      setToastMessage("Postni o'chirishda xatolik yuz berdi");
      return;
    }
    setRemotePosts((prev) => prev.filter((p) => p.id !== post.id));
    setToastMessage("Post o'chirildi");
  }, [deleteTarget]);

  const saveEdit = useCallback(async (text: string) => {
    const post = editTarget;
    if (!post) return;
    setActionBusy(true);
    if (post.id.startsWith("local-")) {
      setRemotePosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, text, isEdited: true } : p)));
      setActionBusy(false);
      setEditTarget(null);
      setToastMessage("Post yangilandi");
      return;
    }
    const { error } = await updatePostContent(post.id, text);
    setActionBusy(false);
    if (error) {
      setToastMessage("Postni tahrirlashda xatolik yuz berdi");
      return;
    }
    setRemotePosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, text, isEdited: true } : p)));
    setEditTarget(null);
    setToastMessage("Post yangilandi");
  }, [editTarget]);

  const submitReport = useCallback(async (reason: SozlabReportReason, description: string) => {
    const post = reportTarget;
    if (!post) return;
    setActionBusy(true);
    const { error, duplicate } = await insertReport({
      postId: post.id,
      reportedUserId: post.userId ?? null,
      reason,
      description,
    });
    setActionBusy(false);
    setReportTarget(null);
    if (duplicate) {
      setReportedIds((prev) => new Set(prev).add(post.id));
      setToastMessage("Siz bu post ustidan allaqachon shikoyat yuborgansiz");
      return;
    }
    if (error) {
      setToastMessage("Shikoyat yuborishda xatolik yuz berdi");
      return;
    }
    setReportedIds((prev) => new Set(prev).add(post.id));
    setToastMessage("Shikoyatingiz yuborildi");
  }, [reportTarget]);

  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({ message: `${post.text}\n\n— AdabiyotX · So'zLab` });
    } catch {
      // user cancelled / unavailable — ignore
    }
  }, []);

  const handleCommentAdded = useCallback((postId: string) => {
    setRemotePosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: p.comments + 1 } : p))
    );
  }, []);

  const loadPosts = useCallback(async (date: Date | null) => {
    setLoadingFeed(true);
    setFeedError(null);

    // The base table is the source of truth so a user's freshly published post
    // (moderation_status='pending') shows immediately — the mobile_sozlab_posts
    // view only exposes approved posts. Each author's identity (pen name,
    // avatar, verification) is joined separately from public profiles so every
    // user sees the real author, not the current account.
    let query = (supabase as any)
      .from("sozlab_posts")
      .select("*")
      .eq("status", "published");

    if (date) {
      const { startISO, endISO } = dayRange(date);
      query = query.gte("created_at", startISO).lt("created_at", endISO);
    }

    const { data, error } = (await query
      .order("created_at", { ascending: false })
      .limit(date ? 100 : 50)) as {
        data: SozlabPostRow[] | null;
        error: { message: string } | null;
      };

    if (error) {
      if (__DEV__) {
        console.warn("[SozLab] Supabase posts fetch failed:", error.message);
      }
      setFeedError("So'zLab jadvali topilmadi. SQL migration ishga tushirilgach postlar bazadan keladi.");
      setRemotePosts([]);
      setLoadingFeed(false);
      return;
    }

    const rows = (data ?? []).filter(
      (r) => r.is_deleted !== true && r.status !== "deleted"
    );
    const authorMap = await fetchAuthorMap(rows.map((r) => r.user_id));
    setRemotePosts(rows.map((r) => applyAuthorInfo(rowToPost(r), authorMap[r.user_id ?? ""])));
    setLoadingFeed(false);
  }, []);

  useEffect(() => {
    loadPosts(null);
  }, [loadPosts]);

  // Deep link from a notification: open the target post's comment sheet.
  useEffect(() => {
    const pid = typeof params.openPostId === "string" ? params.openPostId.trim() : "";
    if (!pid || handledDeepLink.current === pid) return;
    handledDeepLink.current = pid;
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("sozlab_posts")
        .select("*")
        .eq("id", pid)
        .maybeSingle();
      if (!active) return;
      if (data) {
        const authorMap = await fetchAuthorMap([data.user_id]);
        setCommentPost(applyAuthorInfo(rowToPost(data), authorMap[data.user_id ?? ""]));
      } else {
        setCommentPost({ id: pid } as Post);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.openPostId]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setCalendarOpen(false);
    loadPosts(date);
  }, [loadPosts]);

  const clearDate = useCallback(() => {
    setSelectedDate(null);
    loadPosts(null);
  }, [loadPosts]);

  const handleRefresh = useCallback(async () => {
    await loadPosts(selectedDate);
  }, [loadPosts, selectedDate]);
  const { refreshing, replayKey, onRefresh } = usePullToRefresh(handleRefresh);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const dateActive = selectedDate != null;
  const feedPosts = dateActive
    ? remotePosts
    : remotePosts.length > 0
      ? remotePosts
      : SAMPLE_POSTS;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filtered = feedPosts.filter((p) => postMatchesSearch(p, normalizedSearch));

  const handlePublish = async (draft: ComposerDraft) => {
    const body = draft.text.trim();
    const att = draft.attachment;

    // Posting requires a real account — the post must be owned by an auth user.
    if (!currentUserId) {
      throw new Error("Fikr yozish uchun avval hisobingizga kiring.");
    }

    if (__DEV__) console.log("INSERT POST USER ID", currentUserId);

    const { data, error } = await insertSozlabPost({
      body,
      draft,
      profile,
      userId: currentUserId,
    });

    if (error) {
      throw new Error(formatSozlabPublishError(error.message));
    }

    const created: Post = data ? rowToPost(data) : {
      id: `local-${Date.now()}`,
      // Owned by the current account so it renders as the user's own post.
      userId: currentUserId,
      authorName: null,
      authorPhoto: null,
      type: DEFAULT_POST_TYPE,
      text: body,
      attachedId: att?.id ?? null,
      attachedTitle: att?.title ?? null,
      attachedCover: att?.cover ?? null,
      attachedAuthor: att?.author ?? null,
      attachedType: att?.contentType ?? null,
      attachedKind: att?.kind ?? null,
      likes: 0,
      comments: 0,
      ts: Date.now(),
    };

    setRemotePosts((prev) => [created, ...prev]);
    if (currentUserId && draft.mentions.length > 0) {
      void recordMentions({
        mentions: draft.mentions,
        actorId: currentUserId,
        text: body,
        postId: data?.id ?? null,
        commentId: null,
      });
    }
    setToastMessage("Fikringiz joylandi");
  };

  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <ScreenTransitionWrapper type="up" style={{ backgroundColor: c.bg }} replayKey={replayKey}>
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          { paddingBottom: 120 },
          // Web: keep the feed compact + centred instead of stretching full-width.
          Platform.OS === "web" && { maxWidth: 620, width: "100%", alignSelf: "center", paddingHorizontal: 16 },
        ]}
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
        {/* Header */}
        <FadeSlideIn delay={50} distance={-12} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerCopy}>
            <Text style={styles.h1}>So'zLab</Text>
            <Text style={styles.h2}>Adabiy fikrlar maydoni</Text>
          </View>
          <View style={styles.headerActions}>
            <PressableScale
              onPress={() => {
                setSearchOpen((open) => {
                  if (open) setSearchQuery("");
                  return !open;
                });
              }}
              style={[styles.headerIconBtn, searchOpen ? styles.headerIconBtnActive : {}]}
            >
              <Search color={searchOpen ? "#fff" : c.textDim} size={20} strokeWidth={2.3} />
            </PressableScale>
            <PressableScale
              onPress={() => setCalendarOpen(true)}
              style={[styles.headerIconBtn, dateActive ? styles.headerIconBtnActive : {}]}
            >
              <CalendarDays color={dateActive ? "#fff" : c.textDim} size={20} strokeWidth={2.3} />
              {dateActive ? <View style={styles.notificationDot} /> : null}
            </PressableScale>
            <PressableScale style={styles.headerIconBtn} onPress={() => router.push("/notifications")}>
              <Bell color={c.textDim} size={20} strokeWidth={2.3} />
              {unreadCount > 0 ? <View style={styles.notificationDot} /> : null}
            </PressableScale>
          </View>
        </FadeSlideIn>

        {searchOpen ? (
          <FadeSlideIn delay={40} distance={12} style={styles.searchWrap}>
            <Search color={c.textMuted} size={18} />
            <View style={styles.searchTextLayer}>
              {!searchQuery && !searchFocused ? (
                <TypingText
                  phrases={[
                    "Fikr yoki asar izlash...",
                    "Bugun qanday fikr yozmoqchisiz?",
                  ]}
                  active={!searchFocused}
                  style={styles.typingPlaceholder}
                />
              ) : null}
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder=""
                placeholderTextColor={c.textMuted}
                style={styles.searchInput}
                autoFocus
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </View>
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                <X color={c.textMuted} size={18} />
              </Pressable>
            ) : null}
          </FadeSlideIn>
        ) : null}

        {selectedDate ? (
          <FadeSlideIn delay={40} distance={12} style={styles.dateBanner}>
            <CalendarDays color={c.primary} size={16} />
            <Text style={styles.dateBannerText}>{formatLongDate(selectedDate)}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={clearDate} hitSlop={10} style={styles.dateBannerClear}>
              <X color={c.textMuted} size={15} />
            </Pressable>
          </FadeSlideIn>
        ) : null}

        {loadingFeed ? (
          <View style={styles.feedStatus}>
            <ActivityIndicator color={c.primary} size="small" />
            <Text style={styles.feedStatusText}>So'zLab yangilanmoqda...</Text>
          </View>
        ) : feedError ? (
          <View style={styles.feedStatus}>
            <Text style={styles.feedStatusText}>{feedError}</Text>
          </View>
        ) : null}

        {/* Feed */}
        {filtered.map((post, idx) => (
          <StaggeredCard key={post.id} index={idx} baseDelay={75}>
            <PostCard
              post={post}
              me={profile}
              liked={likedIds.has(post.id)}
              onLike={() => toggleLike(post.id)}
              onComment={() => setCommentPost(post)}
              onShare={() => handleShare(post)}
              onMore={() => setMenuPost(post)}
              isLast={idx === filtered.length - 1}
            />
          </StaggeredCard>
        ))}

        {dateActive && !loadingFeed && !feedError && filtered.length === 0 ? (
          <FadeSlideIn delay={60} distance={12} style={styles.emptyDay}>
            <CalendarDays color={c.textMuted} size={26} />
            <Text style={styles.emptyDayTitle}>Bu kunda post yo'q</Text>
            <Text style={styles.emptyDayText}>
              {formatLongDate(selectedDate as Date)} sanasida So'zLab posti topilmadi.
            </Text>
            <PressableScale onPress={clearDate} style={styles.emptyDayBtn}>
              <Text style={styles.emptyDayBtnText}>Barcha postlar</Text>
            </PressableScale>
          </FadeSlideIn>
        ) : null}
      </ScrollView>
      <PullRefreshIndicator
        refreshing={refreshing}
        color={c.primary}
        top={insets.top + 8}
        surfaceColor={c.bgCard}
        borderColor={c.border}
      />

      {toastMessage ? (
        <FadeSlideIn delay={0} distance={12} style={[styles.toast, { bottom: insets.bottom + 156 }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </FadeSlideIn>
      ) : null}

      <CalendarSheet
        visible={calendarOpen}
        bottomInset={insets.bottom}
        selectedDate={selectedDate}
        onClose={() => setCalendarOpen(false)}
        onSelect={handleSelectDate}
      />

      <ComposeSheet
        visible={composeVisible}
        bottomInset={insets.bottom}
        onClose={() => setComposeVisible(false)}
        onPublish={handlePublish}
      />

      <CommentSheet
        post={commentPost}
        me={profile}
        bottomInset={insets.bottom}
        highlightCommentId={typeof params.focusCommentId === "string" ? params.focusCommentId : null}
        onClose={() => setCommentPost(null)}
        onAdded={handleCommentAdded}
      />

      <PostActionMenu
        visible={menuPost != null}
        isOwn={menuPost ? isOwnPost(menuPost) : false}
        onClose={() => setMenuPost(null)}
        onEdit={() => { const p = menuPost; setMenuPost(null); setEditTarget(p); }}
        onDelete={() => { const p = menuPost; setMenuPost(null); setDeleteTarget(p); }}
        onReport={() => { const p = menuPost; setMenuPost(null); setReportTarget(p); }}
        onCopy={() => { if (menuPost) handleCopy(menuPost); setMenuPost(null); }}
      />

      <DeleteConfirmModal
        visible={deleteTarget != null}
        busy={actionBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <EditPostSheet
        visible={editTarget != null}
        busy={actionBusy}
        initialText={editTarget?.text ?? ""}
        onClose={() => setEditTarget(null)}
        onSave={saveEdit}
      />

      <ReportSheet
        visible={reportTarget != null}
        busy={actionBusy}
        alreadyReported={reportTarget ? reportedIds.has(reportTarget.id) : false}
        onClose={() => setReportTarget(null)}
        onSubmit={submitReport}
      />

      <FloatingWriteButton
        bottomInset={insets.bottom}
        onPress={() => setComposeVisible(true)}
      />
    </View>
    </ScreenTransitionWrapper>
  );
}

function PostCard({
  post,
  me,
  liked,
  onLike,
  onComment,
  onShare,
  onMore,
  isLast,
}: {
  post: Post;
  me: UserProfile;
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onMore: () => void;
  isLast: boolean;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const author = post.authorId ? getAuthor(post.authorId) : undefined;
  const target = getPostTarget(post);
  const typeColor = TYPE_COLORS[post.type];
  // Current user's posts must render from the shared AdabiyotX profile context,
  // even if an older row still carries stale provider/name fields.
  // Strictly the signed-in user's own post — never claim author-less/legacy rows.
  const isMine = post.userId != null && post.userId === me.id;
  const myName = me.penName?.trim() || me.displayName;
  // Only MY own posts use the current profile's identity. Other posts (incl.
  // author-less/legacy rows) must NEVER borrow the current user's name/avatar.
  const displayName = isMine ? myName : author?.name ?? post.authorName ?? DEFAULT_AUTHOR_NAME;
  const displayPhoto = isMine ? me.avatarUrl : author?.photo ?? post.authorPhoto ?? null;
  const badgeType: VerificationType = isMine
    ? (resolveDisplayBadge(me)?.type ?? me.verificationType)
    : (author ? "none" : ((post.authorVerification as VerificationType) ?? "none"));

  const attachment = post.attachedTitle
    ? {
        id: post.attachedId ?? null,
        title: post.attachedTitle,
        cover: post.attachedCover ?? null,
        author: post.attachedAuthor ?? null,
        kind: (post.attachedKind ?? "material") as TopMaterialKind,
      }
    : null;

  const openAuthor = () => {
    if (!post.authorId) return;
    router.push({ pathname: "/u/[id]", params: { id: post.authorId } });
  };

  const openAttachment = () => {
    openContentPreview(post.attachedType ?? attachment?.kind, attachment?.id, {
      title: attachment?.title,
    });
  };

  return (
    <Pressable
      onLongPress={onMore}
      delayLongPress={350}
      style={[styles.card, isLast && { borderBottomWidth: 0 }]}
    >
      {/* Author row */}
      <View style={styles.authorRow}>
        <Pressable disabled={!post.authorId} onPress={openAuthor}>
          <AvatarImg
            uri={displayPhoto}
            initial={getInitial(displayName)}
            avatarStyle={styles.avatar}
            fallbackStyle={styles.avatarFallback}
            initialStyle={styles.avatarInitial}
          />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.authorMeta}>
            <Pressable disabled={!post.authorId} onPress={openAuthor}>
              <Text style={styles.authorName}>{displayName}</Text>
            </Pressable>
            {badgeType !== "none" && <VerificationBadge verificationType={badgeType} size="sm" />}
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}18`, borderColor: `${typeColor}35` }]}>
              <Text style={[styles.typeLabel, { color: typeColor }]}>
                {TYPE_LABELS[post.type]}
              </Text>
            </View>
          </View>
          <View style={styles.tsRow}>
            <Text style={styles.ts}>{relativeTime(post.ts)}</Text>
            {post.isEdited ? <Text style={styles.editedLabel}>· Tahrirlangan</Text> : null}
          </View>
        </View>
        <Pressable hitSlop={10} onPress={onMore}>
          <MoreHorizontal color={c.textMuted} size={18} />
        </Pressable>
      </View>

      {/* Post content */}
      {post.type === "quote" ? (
        <View style={styles.quoteWrap}>
          <Quote color={c.primary} size={16} style={{ marginBottom: 6 }} />
          <MentionText text={post.text} style={styles.quoteText} onPressMention={openMentionedProfile} />
        </View>
      ) : (
        <MentionText text={post.text} style={styles.bodyText} onPressMention={openMentionedProfile} />
      )}

      {/* Attached literature card (real attachment), else legacy linked book */}
      {attachment ? (
        <PressableScale onPress={openAttachment} style={styles.bookRef}>
          {attachment.cover ? (
            <Image source={{ uri: attachment.cover }} style={styles.bookRefCover} contentFit="cover" />
          ) : (
            <View style={[styles.bookRefCover, styles.bookRefIcon]}>
              <BookOpen color={c.primary} size={18} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.bookRefLabel}>
              <BookOpen color={c.secondary} size={11} />
              <Text style={styles.bookRefLabelText}>{TOP_KIND_LABELS[attachment.kind]}</Text>
            </View>
            <Text style={styles.bookRefTitle} numberOfLines={1}>{attachment.title}</Text>
            {attachment.author ? (
              <Text style={styles.bookRefAuthor} numberOfLines={1}>{attachment.author}</Text>
            ) : null}
          </View>
        </PressableScale>
      ) : target ? (
        <PressableScale
          onPress={target.book ? () => router.push(getBookRoute(target.book as Book)) : undefined}
          style={styles.bookRef}
        >
          {target.cover ? (
            <Image source={{ uri: target.cover }} style={styles.bookRefCover} contentFit="contain" />
          ) : (
            <View style={[styles.bookRefCover, styles.bookRefIcon]}>
              {target.kind === "screenplay" ? (
                <Clapperboard color={c.primary} size={18} />
              ) : target.kind === "poem" ? (
                <Feather color={c.primary} size={18} />
              ) : (
                <BookOpen color={c.primary} size={18} />
              )}
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.bookRefLabel}>
              <BookOpen color={c.secondary} size={11} />
              <Text style={styles.bookRefLabelText}>{TARGET_KIND_LABELS[target.kind]}ga havola</Text>
            </View>
            <Text style={styles.bookRefTitle} numberOfLines={1}>{target.title}</Text>
            {target.author ? (
              <Text style={styles.bookRefAuthor} numberOfLines={1}>{target.author}</Text>
            ) : null}
          </View>
        </PressableScale>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <PressableScale onPress={onLike} style={styles.action}>
          <Heart
            color={liked ? c.primary : c.textMuted}
            fill={liked ? c.primary : "transparent"}
            size={18}
            strokeWidth={2}
          />
          <Text style={[styles.actionText, liked && { color: c.primary }]}>
            {post.likes + (liked ? 1 : 0)}
          </Text>
        </PressableScale>
        <PressableScale onPress={onComment} style={styles.action}>
          <MessageCircle color={c.textMuted} size={18} strokeWidth={2} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </PressableScale>
        <PressableScale onPress={onShare} style={styles.action}>
          <Share2 color={c.textMuted} size={18} strokeWidth={2} />
          <Text style={styles.actionText}>Ulash</Text>
        </PressableScale>
        <View style={{ flex: 1 }} />
        <PressableScale onPress={onShare} style={styles.action}>
          <Send color={c.textMuted} size={16} strokeWidth={2} />
        </PressableScale>
      </View>
    </Pressable>
  );
}

interface ComposerDraft {
  text: string;
  wasImproved: boolean;
  attachment: LiteratureSearchItem | null;
  mentions: MentionPick[];
}

function ComposeSheet({
  visible,
  bottomInset,
  onClose,
  onPublish,
}: {
  visible: boolean;
  bottomInset: number;
  onClose: () => void;
  onPublish: (draft: ComposerDraft) => Promise<void>;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [wasImproved, setWasImproved] = useState(false);
  const [attachment, setAttachment] = useState<LiteratureSearchItem | null>(null);
  const [mentions, setMentions] = useState<MentionPick[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const { results: searchResults, loading: searchLoading } = useLiteratureSearch(searchQuery);
  const mention = useMentionAutocomplete(
    text,
    (next) => {
      setText(next);
      setWasImproved(false);
    },
    (m) => setMentions((prev) => [...prev, m])
  );

  // Literature attachment is fully optional — a thought alone is enough.
  const canPublish = text.trim().length >= 3;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  const resetComposer = () => {
    setText("");
    setAttachment(null);
    setMentions([]);
    setSearchOpen(false);
    setSearchQuery("");
    setWasImproved(false);
    setError(null);
    setStatusText(null);
    onClose();
  };

  const resetAndClose = () => {
    if (busy || improving) return;
    resetComposer();
  };

  const selectAttachment = (item: LiteratureSearchItem) => {
    setAttachment(item);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleImprove = async () => {
    const sourceText = text.trim();
    if (sourceText.length < 10) {
      setError("Yaxshilash uchun kamida 10 ta belgi yozing.");
      return;
    }

    setImproving(true);
    setError(null);
    setStatusText("Jaxongir AI matnni yaxshilamoqda…");

    const { data, error: invokeError } = await supabase.functions.invoke("jaxongir-ai-chat", {
      body: {
        message: sourceText,
        source_screen: "sozlab",
        prompt_context: "sozlab_improve",
        related_content_type: attachment?.contentType ?? null,
        related_content_id: attachment?.id ?? null,
        current_book: attachment ? { id: attachment.id, title: attachment.title } : null,
      },
    }) as {
      data: { answer?: string; error?: string } | null;
      error: { message: string } | null;
    };

    setImproving(false);

    if (invokeError || data?.error || !data?.answer) {
      setError(invokeError?.message ?? data?.error ?? "Matnni yaxshilab bo'lmadi.");
      setStatusText(null);
      return;
    }

    setText(data.answer.trim());
    setWasImproved(true);
    setStatusText("Matn Jaxongir AI bilan yaxshilandi");
  };

  const handlePublish = async () => {
    if (!canPublish || busy) {
      setError("Iltimos, fikr matnini yozing.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onPublish({ text, wasImproved, attachment, mentions });
      setBusy(false);
      resetComposer();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Fikrni saqlashda xatolik yuz berdi.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={resetAndClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetKeyboard}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 4) + 8 }]}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Compact header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Fikr yozish</Text>
              <Pressable onPress={resetAndClose} hitSlop={14} style={styles.iconButton}>
                <X color={c.textDim} size={15} />
              </Pressable>
            </View>

            {/* Optional literature attachment */}
            {searchOpen ? (
              <View style={styles.attachSearchWrap}>
                <View style={styles.attachSearchBar}>
                  <Search color={c.textMuted} size={16} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Adabiyot qidiring (kitob, she'r, maqola...)"
                    placeholderTextColor={c.textMuted}
                    style={styles.attachSearchInput}
                    autoFocus
                  />
                  <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(""); }} hitSlop={10}>
                    <X color={c.textMuted} size={16} />
                  </Pressable>
                </View>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.attachResults}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {searchLoading ? (
                    <ActivityIndicator color={c.primary} style={{ paddingVertical: 18 }} />
                  ) : searchResults.length === 0 ? (
                    <Text style={styles.attachEmpty}>Hech narsa topilmadi</Text>
                  ) : (
                    searchResults.map((item) => (
                      <Pressable
                        key={`${item.contentType}-${item.id}`}
                        onPress={() => selectAttachment(item)}
                        style={styles.attachResultRow}
                      >
                        {item.cover ? (
                          <Image source={{ uri: item.cover }} style={styles.attachResultCover} contentFit="cover" />
                        ) : (
                          <View style={[styles.attachResultCover, styles.attachResultCoverPh]}>
                            <BookOpen color={c.primary} size={16} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={styles.attachResultTitle}>{item.title}</Text>
                          {item.author ? (
                            <Text numberOfLines={1} style={styles.attachResultAuthor}>{item.author}</Text>
                          ) : null}
                        </View>
                        <View style={styles.attachKindBadge}>
                          <Text style={styles.attachKindBadgeText}>{TOP_KIND_LABELS[item.kind]}</Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            ) : attachment ? (
              <View style={styles.attachChip}>
                {attachment.cover ? (
                  <Image source={{ uri: attachment.cover }} style={styles.attachChipCover} contentFit="cover" />
                ) : (
                  <View style={[styles.attachChipCover, styles.attachResultCoverPh]}>
                    <BookOpen color={c.primary} size={14} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.attachChipTitle}>{attachment.title}</Text>
                  <View style={[styles.attachKindBadge, { alignSelf: "flex-start", marginTop: 3 }]}>
                    <Text style={styles.attachKindBadgeText}>{TOP_KIND_LABELS[attachment.kind]}</Text>
                  </View>
                </View>
                <Pressable onPress={() => setAttachment(null)} hitSlop={10} style={styles.attachChipRemove}>
                  <X color={c.textMuted} size={14} />
                </Pressable>
              </View>
            ) : null}

            {error ? <Text style={styles.sheetError}>{error}</Text> : null}
            {statusText ? <Text style={styles.sheetStatus}>{statusText}</Text> : null}

            {/* Input + actions all inside one bar */}
            {mention.visible ? (
              <MentionSuggestionList results={mention.results} loading={mention.loading} onPick={mention.pick} />
            ) : null}
            <View style={styles.editorWrap}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={(next) => {
                  setText(next);
                  setWasImproved(false);
                }}
                onSelectionChange={mention.onSelectionChange}
                placeholder="Fikringizni yozing... (@ bilan do'stlaringizni belgilang)"
                placeholderTextColor={c.textMuted}
                multiline
                textAlignVertical="top"
                style={styles.editor}
              />

              {/* Bottom row inside the bar */}
              <View style={styles.editorActions}>
                <View style={styles.editorActionsLeft}>
                  {/* AI improve */}
                  <Pressable
                    onPress={handleImprove}
                    disabled={improving || busy}
                    style={[styles.improveBtn, (improving || busy) && styles.disabledBtn]}
                  >
                    {improving ? (
                      <ActivityIndicator color={c.secondary} size="small" />
                    ) : (
                      <Sparkles color={c.secondary} size={13} />
                    )}
                    <Text style={styles.improveBtnText} numberOfLines={1}>
                      {improving ? "Yaxshilanmoqda…" : "AI yaxshilash"}
                    </Text>
                  </Pressable>

                  {/* Optional literature attach */}
                  <Pressable
                    onPress={() => setSearchOpen((v) => !v)}
                    disabled={busy}
                    style={[styles.attachBtn, attachment && styles.attachBtnActive]}
                  >
                    <Paperclip color={attachment ? "#fff" : c.primary} size={13} />
                    <Text
                      style={[styles.attachBtnText, attachment && { color: "#fff" }]}
                      numberOfLines={1}
                    >
                      Adabiyot belgilash
                    </Text>
                  </Pressable>
                </View>

                {/* Send — right, round */}
                <Pressable
                  onPress={handlePublish}
                  disabled={!canPublish || busy}
                  style={[styles.publishBtn, (!canPublish || busy) && styles.disabledBtn]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Send color="#fff" size={15} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

interface SozlabComment {
  id: string;
  content: string;
  ts: number;
  userId?: string | null;
  parentId?: string | null;
  authorName?: string | null;
  authorPhoto?: string | null;
  authorVerification?: string | null;
  isEdited?: boolean;
  mine?: boolean;
}

function CommentSheet({
  post,
  me,
  bottomInset,
  highlightCommentId,
  onClose,
  onAdded,
}: {
  post: Post | null;
  me: UserProfile;
  bottomInset: number;
  highlightCommentId?: string | null;
  onClose: () => void;
  onAdded: (postId: string) => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const { userId: currentUserId, refreshProfileRow } = useAuth();
  const [comments, setComments] = useState<SozlabComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<SozlabComment | null>(null);
  const [mentions, setMentions] = useState<MentionPick[]>([]);
  const mention = useMentionAutocomplete(text, setText, (m) => setMentions((prev) => [...prev, m]));

  const visible = !!post;
  const postId = post?.id ?? null;

  // The post author shown at the top of the sheet — always the POST's author,
  // never the current user.
  const postAuthor = post?.authorId ? getAuthor(post.authorId) : undefined;
  const postAuthorName = postAuthor?.name ?? post?.authorName ?? DEFAULT_AUTHOR_NAME;
  const postAuthorPhoto = postAuthor?.photo ?? post?.authorPhoto ?? null;
  const postBadge: VerificationType = postAuthor
    ? "none"
    : ((post?.authorVerification as VerificationType) ?? "none");

  const loadComments = useCallback(async (pid: string) => {
    setLoading(true);

    // Primary source is `mobile_sozlab_comments`: each row carries ITS OWN
    // author (pen name / avatar / badge) joined by user_id, so a reply never
    // inherits the parent comment author, the post author, the current user,
    // or "So'zLab foydalanuvchisi".
    let res = await (supabase as any)
      .from("mobile_sozlab_comments")
      .select("*")
      .eq("post_id", pid)
      .order("created_at", { ascending: true });
    const usedView = !res.error;
    if (res.error) {
      // Fallback: base table + author identity joined separately by user_id.
      res = await (supabase as any)
        .from("sozlab_comments")
        .select("*")
        .eq("post_id", pid)
        .order("created_at", { ascending: true });
    }

    const rows = (!res.error && Array.isArray(res.data) ? res.data : []).filter(
      (r: any) => r.is_deleted !== true && r.status !== "deleted"
    );

    const authorMap = usedView ? {} : await fetchAuthorMap(rows.map((r: any) => r.user_id));

    setComments(
      rows.map((r: any): SozlabComment => {
        const info = !usedView && r.user_id ? authorMap[r.user_id] : undefined;
        return {
          id: r.id,
          content: r.content ?? r.body ?? "",
          ts: new Date(r.created_at).getTime(),
          userId: r.user_id ?? null,
          parentId: r.parent_comment_id ?? null,
          authorName:
            info?.name ??
            r.author_pen_name ??
            r.author_name ??
            r.pen_name ??
            r.display_name ??
            r.full_name ??
            null,
          authorPhoto: resolveProfileAvatarUrl(
            info?.avatar,
            r.author_avatar_url,
            r.avatar_url,
            r.provider_avatar_url
          ),
          authorVerification:
            info?.verification ?? r.author_verification_type ?? r.verification_type ?? null,
          isEdited: r.is_edited === true,
        };
      })
    );
    setLoading(false);
  }, []);

  // Reset input/reply state and reload whenever the post OR the account changes,
  // so a previous account's draft, reply target, or comments never carry over.
  useEffect(() => {
    setText("");
    setError(null);
    setReplyTarget(null);
    setMentions([]);
    if (!postId) {
      setComments([]);
      return;
    }
    loadComments(postId).catch(() => setComments([]));
  }, [postId, currentUserId, loadComments]);

  const handleSend = async () => {
    const body = text.trim();
    if (body.length < 1 || sending || !postId) return;
    if (!currentUserId) {
      setError("Izoh yozish uchun avval hisobingizga kiring.");
      return;
    }
    setSending(true);
    setError(null);

    // Identity guard: every comment/reply is attributed to the exact current
    // auth user. If the cached profile drifted from the session, resync first.
    if (me?.id && me.id !== currentUserId) {
      await refreshProfileRow().catch(() => {});
    }
    if (__DEV__) {
      if (__DEV__) console.log("COMMENT/REPLY INSERT USER ID", currentUserId);
      if (__DEV__) console.log("PROFILE ID", me?.id);
    }

    const replyTo = replyTarget;
    const sentMentions = mentions;
    const { data, error: err } = await (supabase as any)
      .from("sozlab_comments")
      .insert({
        post_id: postId,
        user_id: currentUserId,
        parent_comment_id: replyTo?.id ?? null,
        content: body,
        status: "published",
      })
      .select("*")
      .single();

    setSending(false);

    if (err) {
      const lower = (err.message ?? "").toLowerCase();
      setError(
        lower.includes("row-level security") || lower.includes("violates row")
          ? "Izoh qoldirish uchun ruxsat yo'q. Bazada sozlab_comments RLS qoidasini yangilang."
          : err.message
      );
      return;
    }

    const newCommentId: string | null = data?.id ?? null;

    setText("");
    setReplyTarget(null);
    setMentions([]);
    await loadComments(postId);
    onAdded(postId);

    // Reply → notify the parent comment's author (never yourself).
    if (replyTo?.userId && replyTo.userId !== currentUserId) {
      void createNotification({
        recipientId: replyTo.userId,
        actorId: currentUserId,
        type: "comment_reply",
        title: "Izohingizga javob berildi",
        body: body.slice(0, 140),
        targetType: "sozlab_comment",
        targetPostId: postId,
        targetCommentId: newCommentId,
      });
    }
    // @mentions → notify mentioned users (skip the reply target already notified).
    if (sentMentions.length > 0) {
      void recordMentions({
        mentions: sentMentions,
        actorId: currentUserId,
        text: body,
        postId,
        commentId: newCommentId,
        excludeUserIds: replyTo?.userId ? [replyTo.userId] : [],
      });
    }
  };

  // Build the comment tree: top-level comments + their replies grouped by parent.
  const topLevel = comments.filter((cm) => !cm.parentId);
  const repliesByParent: Record<string, SozlabComment[]> = {};
  for (const cm of comments) {
    if (cm.parentId) {
      if (!repliesByParent[cm.parentId]) repliesByParent[cm.parentId] = [];
      repliesByParent[cm.parentId].push(cm);
    }
  }

  const renderComment = (cm: SozlabComment, isReply: boolean) => {
    const name = cm.authorName?.trim() || DEFAULT_AUTHOR_NAME;
    const badge = (cm.authorVerification as VerificationType) ?? "none";
    const highlighted = !!highlightCommentId && cm.id === highlightCommentId;
    return (
      <View key={cm.id} style={[styles.commentRow, isReply ? { marginLeft: 38 } : null]}>
        <AvatarImg
          uri={cm.authorPhoto}
          initial={getInitial(name)}
          avatarStyle={styles.commentAvatar}
          fallbackStyle={styles.commentAvatarFallback}
          initialStyle={styles.commentAvatarInitial}
        />
        <View style={{ flex: 1 }}>
          <View style={highlighted ? [styles.commentBubble, { borderWidth: 1, borderColor: c.primary }] : styles.commentBubble}>
            <View style={styles.commentAuthorRow}>
              <Text style={styles.commentAuthor}>{name}</Text>
              {badge !== "none" && <VerificationBadge verificationType={badge} size="sm" />}
            </View>
            <MentionText text={cm.content} style={styles.commentText} onPressMention={openMentionedProfile} />
            <Text style={styles.commentTs}>
              {relativeTime(cm.ts)}
              {cm.isEdited ? " · tahrirlandi" : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => setReplyTarget(cm)}
            hitSlop={8}
            style={{ paddingTop: 4, paddingLeft: 4, alignSelf: "flex-start" }}
          >
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: "700" }}>Javob berish</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetKeyboard}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 4) + 8 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Izohlar</Text>
              <Pressable onPress={onClose} hitSlop={14} style={styles.iconButton}>
                <X color={c.textDim} size={15} />
              </Pressable>
            </View>

            {/* Which post is being commented on */}
            {post ? (
              <View style={styles.commentPostPreview}>
                <AvatarImg
                  uri={postAuthorPhoto}
                  initial={getInitial(postAuthorName)}
                  avatarStyle={styles.commentAvatar}
                  fallbackStyle={styles.commentAvatarFallback}
                  initialStyle={styles.commentAvatarInitial}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.commentAuthorRow}>
                    <Text style={styles.commentAuthor}>{postAuthorName}</Text>
                    {postBadge !== "none" && (
                      <VerificationBadge verificationType={postBadge} size="sm" />
                    )}
                  </View>
                  <Text style={styles.commentPostText} numberOfLines={2}>{post.text}</Text>
                </View>
              </View>
            ) : null}

            <ScrollView style={styles.commentList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {loading ? (
                <ActivityIndicator color={c.primary} style={{ paddingVertical: 24 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.commentEmpty}>Hali izoh yo'q. Birinchi bo'lib yozing.</Text>
              ) : (
                topLevel.map((parent) => (
                  <View key={parent.id}>
                    {renderComment(parent, false)}
                    {(repliesByParent[parent.id] ?? []).map((reply) =>
                      renderComment(reply, true)
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            {error ? <Text style={styles.sheetError}>{error}</Text> : null}

            {replyTarget ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingTop: 8,
                }}
              >
                <Text
                  style={{ flex: 1, color: c.primary, fontSize: 12.5, fontWeight: "700" }}
                  numberOfLines={1}
                >
                  Javob: {replyTarget.authorName?.trim() || DEFAULT_AUTHOR_NAME}
                </Text>
                <Pressable onPress={() => setReplyTarget(null)} hitSlop={10}>
                  <X color={c.textMuted} size={14} />
                </Pressable>
              </View>
            ) : null}

            {mention.visible ? (
              <View style={{ paddingHorizontal: 16 }}>
                <MentionSuggestionList results={mention.results} loading={mention.loading} onPick={mention.pick} />
              </View>
            ) : null}
            <View style={styles.commentInputBar}>
              <TextInput
                value={text}
                onChangeText={setText}
                onSelectionChange={mention.onSelectionChange}
                placeholder={
                  replyTarget
                    ? `@${replyTarget.authorName?.trim() || DEFAULT_AUTHOR_NAME} ga javob yozing…`
                    : "Izoh yozing... (@ bilan belgilang)"
                }
                placeholderTextColor={c.textMuted}
                style={styles.commentInput}
                multiline
              />
              <Pressable
                onPress={handleSend}
                disabled={text.trim().length < 1 || sending}
                style={[styles.publishBtn, (text.trim().length < 1 || sending) && styles.disabledBtn]}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={15} />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function FloatingWriteButton({
  bottomInset,
  onPress,
}: {
  bottomInset: number;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const pencilMotion = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pencilLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pencilMotion, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pencilMotion, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pencilLoop.start();
    pulseLoop.start();

    return () => {
      pencilLoop.stop();
      pulseLoop.stop();
    };
  }, [pencilMotion, pulse]);

  const pencilStyle = {
    transform: [
      {
        translateY: pencilMotion.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3],
        }),
      },
      {
        rotate: pencilMotion.interpolate({
          inputRange: [0, 1],
          outputRange: ["-8deg", "8deg"],
        }),
      },
    ],
  };

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.22, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.36],
        }),
      },
    ],
  };

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.floatingWriteBtn, { bottom: bottomInset + 86 }]}
    >
      <Animated.View pointerEvents="none" style={[styles.floatingWritePulse, pulseStyle]} />
      <Animated.View style={pencilStyle}>
        <PenLine color="#fff" size={25} strokeWidth={2.6} />
      </Animated.View>
    </PressableScale>
  );
}

const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
const UZ_WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function CalendarSheet({
  visible,
  bottomInset,
  selectedDate,
  onClose,
  onSelect,
}: {
  visible: boolean;
  bottomInset: number;
  selectedDate: Date | null;
  onClose: () => void;
  onSelect: (date: Date) => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate ?? new Date()));

  useEffect(() => {
    if (visible) setViewMonth(startOfMonth(selectedDate ?? new Date()));
  }, [visible, selectedDate]);

  const weeks = useMemo(() => buildMonthMatrix(viewMonth), [viewMonth]);
  const canGoNext = startOfMonth(viewMonth).getTime() < startOfMonth(today).getTime();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomInset + 18 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Kun bo'yicha</Text>
              <Text style={styles.sheetSub}>Sana tanlang va o'sha kungi fikrlarni ko'ring.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
              <X color={c.textDim} size={18} />
            </Pressable>
          </View>

          <View style={styles.calMonthRow}>
            <Pressable onPress={() => setViewMonth((m) => addMonths(m, -1))} hitSlop={10} style={styles.calNavBtn}>
              <ChevronLeft color={c.textDim} size={20} />
            </Pressable>
            <Text style={styles.calMonthLabel}>
              {UZ_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </Text>
            <Pressable
              onPress={() => canGoNext && setViewMonth((m) => addMonths(m, 1))}
              hitSlop={10}
              disabled={!canGoNext}
              style={[styles.calNavBtn, !canGoNext && styles.calNavBtnOff]}
            >
              <ChevronRight color={canGoNext ? c.textDim : c.textMuted} size={20} />
            </Pressable>
          </View>

          <View style={styles.calWeekRow}>
            {UZ_WEEKDAYS.map((d) => (
              <Text key={d} style={styles.calWeekday}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.calWeekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={styles.calCell} />;
                const isFuture = day.getTime() > today.getTime();
                const isToday = day.getTime() === today.getTime();
                const isSelected =
                  selectedDate != null && startOfDay(selectedDate).getTime() === day.getTime();
                return (
                  <Pressable
                    key={di}
                    disabled={isFuture}
                    onPress={() => onSelect(day)}
                    style={styles.calCell}
                  >
                    <View
                      style={[
                        styles.calDay,
                        isToday && !isSelected && styles.calDayToday,
                        isSelected && styles.calDaySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          isFuture && styles.calDayTextOff,
                          isSelected && styles.calDayTextSelected,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.calFooter}>
            <PressableScale onPress={() => onSelect(today)} style={styles.calTodayBtn}>
              <CalendarDays color="#fff" size={16} />
              <Text style={styles.calTodayBtnText}>Bugun</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function buildMonthMatrix(monthStart: Date): (Date | null)[][] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function dayRange(date: Date): { startISO: string; endISO: string } {
  const start = startOfDay(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function formatLongDate(date: Date): string {
  return `${date.getDate()}-${UZ_MONTHS[date.getMonth()].toLowerCase()}, ${date.getFullYear()}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / (1000 * 60));
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  return `${d} kun oldin`;
}

function getLiteratureKind(book: Book): LiteratureKind {
  if (book.category === "She'r") return "poem";
  if (book.category === "Ssenariy") return "screenplay";
  return "book";
}

/** Derives a non-empty title for the (NOT NULL) title column from the body. */
function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "So'zLab fikri";
  return t.length <= 80 ? t : `${t.slice(0, 77)}…`;
}

async function insertSozlabPost({
  body,
  draft,
  profile,
  userId,
}: {
  body: string;
  draft: ComposerDraft;
  profile: UserProfile;
  userId: string;
}): Promise<SozlabInsertResult> {
  const att = draft.attachment;
  const title = att?.title ?? deriveTitle(body);

  // Primary payload — matches the deployed sozlab_posts schema exactly.
  // `user_id` ties the post to the signed-in account (isolation + RLS).
  const primaryPayload = {
    user_id: userId,
    title,
    content: body,
    post_type: DEFAULT_POST_TYPE,
    status: "published",
    improved_content: draft.wasImproved ? body : null,
    image_url: att?.cover ?? null,
    attached_content_id: att?.id ?? null,
    attached_content_type: att?.contentType ?? null,
    attached_content_title: att?.title ?? null,
    attached_content_cover_url: att?.cover ?? null,
    attached_content_author: att?.author ?? null,
  };

  const primary = await insertPostPayload(primaryPayload);

  if (
    !isMissingColumnError(primary.error, [
      "title",
      "content",
      "post_type",
      "improved_content",
      "image_url",
      "attached_content_id",
      "attached_content_type",
      "attached_content_title",
      "attached_content_cover_url",
      "attached_content_author",
    ])
  ) {
    return primary;
  }

  // Legacy fallback — the original migration schema (body / target_*).
  const legacyPayload = {
    user_id: userId,
    display_name: profile.penName?.trim() || profile.displayName || PROFILE_DISPLAY_NAME,
    type: DEFAULT_POST_TYPE,
    target_kind: "other",
    target_title: title,
    target_author: att?.author ?? null,
    body,
    improved_body: draft.wasImproved ? body : null,
    metadata: { client: "expo", attached_cover: att?.cover ?? null },
  };

  return await insertPostPayload(legacyPayload);
}

async function insertPostPayload(payload: Record<string, unknown>): Promise<SozlabInsertResult> {
  let lastResult: SozlabInsertResult | null = null;

  for (const moderation_status of MODERATION_STATUS_CANDIDATES) {
    const result = await (supabase as any)
      .from("sozlab_posts")
      .insert({ ...payload, moderation_status })
      .select("*")
      .single() as SozlabInsertResult;

    if (isMissingColumnError(result.error, ["moderation_status"])) {
      return await (supabase as any)
        .from("sozlab_posts")
        .insert(payload)
        .select("*")
        .single() as SozlabInsertResult;
    }

    if (!isModerationStatusConstraintError(result.error)) {
      return result;
    }

    lastResult = result;
  }

  return lastResult ?? {
    data: null,
    error: { message: "So'zLab moderation status qiymati bazaga mos kelmadi" },
  };
}

/** Soft-deletes a post (is_deleted/deleted_at), falling back to status='deleted'. */
async function softDeletePost(id: string): Promise<{ error: { message: string } | null }> {
  const now = new Date().toISOString();
  const res = await (supabase as any)
    .from("sozlab_posts")
    .update({ is_deleted: true, deleted_at: now, deleted_by: null })
    .eq("id", id);
  if (!isMissingColumnError(res.error, ["is_deleted", "deleted_at", "deleted_by"])) {
    return { error: res.error };
  }
  const fallback = await (supabase as any)
    .from("sozlab_posts")
    .update({ status: "deleted" })
    .eq("id", id);
  return { error: fallback.error };
}

/** Updates a post's content + edit flags, degrading gracefully on old schemas. */
async function updatePostContent(id: string, content: string): Promise<{ error: { message: string } | null }> {
  const now = new Date().toISOString();
  let res = await (supabase as any)
    .from("sozlab_posts")
    .update({ content, is_edited: true, edited_at: now, updated_at: now })
    .eq("id", id);
  if (isMissingColumnError(res.error, ["is_edited", "edited_at", "updated_at"])) {
    res = await (supabase as any).from("sozlab_posts").update({ content }).eq("id", id);
  }
  if (isMissingColumnError(res.error, ["content"])) {
    res = await (supabase as any).from("sozlab_posts").update({ body: content }).eq("id", id);
  }
  return { error: res.error };
}

/** Inserts a report; returns `duplicate` when the user already reported it. */
async function insertReport(params: {
  postId: string;
  reportedUserId: string | null;
  reason: SozlabReportReason;
  description: string;
}): Promise<{ error: { message: string } | null; duplicate: boolean }> {
  const res = await (supabase as any).from("sozlab_post_reports").insert({
    post_id: params.postId,
    reporter_user_id: null,
    reported_user_id: params.reportedUserId,
    reason: params.reason,
    description: params.description || null,
    status: "pending",
  });
  const msg = res.error?.message?.toLowerCase() ?? "";
  const duplicate = msg.includes("duplicate") || msg.includes("unique") || res.error?.code === "23505";
  return { error: res.error, duplicate };
}

function isMissingColumnError(error: { message?: string } | null, columns: string[]): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  if (!message) return false;
  return columns.some((column) => {
    const name = column.toLowerCase();
    return (
      message.includes(`'${name}'`) ||
      message.includes(`.${name}`) ||
      message.includes(`${name} column`) ||
      message.includes(`column ${name}`)
    );
  });
}

function isModerationStatusConstraintError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("sozlab_posts_moderation_status_check") ||
    (message.includes("moderation_status") && message.includes("check constraint"))
  );
}

function formatSozlabPublishError(message: string): string {
  const lower = message.toLowerCase();
  if (isModerationStatusConstraintError({ message })) {
    return "So'zLab moderation holati bazadagi qoida bilan mos emas. Baza migrationini yangilab qayta urinib ko'ring.";
  }
  if (lower.includes("row-level security") || lower.includes("violates row")) {
    return "Fikr joylash uchun ruxsat yo'q. AdabiyotX bazasida So'zLab post qoidasini (RLS) yangilash kerak.";
  }
  if (isMissingColumnError({ message }, ["body", "title", "content", "post_type", "target_title", "target_kind", "moderation_status"])) {
    return "So'zLab jadvali ilova bilan mos emas. Iltimos, baza sxemasini yangilab qayta urinib ko'ring.";
  }
  return message;
}

interface AuthorInfo {
  name: string | null;
  avatar: string | null;
  verification: string | null;
}

/**
 * Resolve each author's public identity (pen name / avatar / verification) by
 * user_id from `mobile_public_profiles`. Used to render every So'zLab post &
 * comment with its real author — never the current account.
 */
async function fetchAuthorMap(
  userIds: (string | null | undefined)[]
): Promise<Record<string, AuthorInfo>> {
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
  if (ids.length === 0) return {};
  const colsWithProvider =
    "id,display_name,full_name,pen_name,avatar_url,provider_avatar_url,verification_type,account_type,is_creator,is_adib,is_vip";
  const fallbackCols =
    "id,display_name,full_name,pen_name,avatar_url,verification_type,account_type,is_creator,is_adib,is_vip";
  let { data, error } = await (supabase as any)
    .from("mobile_public_profiles")
    .select(colsWithProvider)
    .in("id", ids);
  if (error) {
    const retry = await (supabase as any)
      .from("mobile_public_profiles")
      .select(fallbackCols)
      .in("id", ids);
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    const fb = await (supabase as any)
      .from("profiles")
      .select(colsWithProvider)
      .in("id", ids);
    data = fb.data;
  }
  const map: Record<string, AuthorInfo> = {};
  (data ?? []).forEach((p: any) => {
    // Derive the SAME combined badge the profile shows (gold Ijodkor+Muallif /
    // blue Ijodkor / green Muallif), from the author's raw fields — a linked
    // Muallif has verification_type='none', so it must be derived, not read raw.
    map[p.id] = {
      name: p.pen_name?.trim() || p.display_name?.trim() || p.full_name?.trim() || null,
      avatar: resolveProfileAvatarUrl(p.avatar_url, p.provider_avatar_url),
      verification: resolveBadgeType({
        account_type: p.account_type,
        is_creator: p.is_creator,
        is_adib: p.is_adib,
        verification_type: p.verification_type,
        is_vip: p.is_vip,
      }),
    };
  });
  return map;
}

/** Overlay joined author identity onto a post (falls back to row fields). */
function applyAuthorInfo(post: Post, info?: AuthorInfo): Post {
  if (!info) return post;
  return {
    ...post,
    authorName: info.name ?? post.authorName,
    authorPhoto: resolveProfileAvatarUrl(info.avatar, post.authorPhoto),
    authorVerification: info.verification ?? post.authorVerification,
  };
}

/** Resolve a tapped @handle to its profile and open that user's page. */
async function openMentionedProfile(handle: string): Promise<void> {
  const id = await resolveHandleToUserId(handle);
  if (id) router.push({ pathname: "/u/[id]", params: { id } });
}

function rowToPost(row: SozlabPostRow): Post {
  // NOTE: `row.title` is the post's OWN title (auto-derived from the body for
  // the NOT NULL column) — it is NOT a literature reference. Only treat a post
  // as having a linked work when the legacy `target_*` or the new
  // `attached_content_*` columns are actually set.
  const legacyTitle = row.target_title ?? null;
  const matchedBook = legacyTitle ? findBookByTitle(legacyTitle) : null;
  const targetKind = normalizeTargetKind(row.target_kind) ?? (matchedBook ? getLiteratureKind(matchedBook) : "book");

  const hasAttachment = !!(row.attached_content_id || row.attached_content_title);
  const attachedType = row.attached_content_type ?? null;

  return {
    id: row.id,
    userId: row.user_id ?? null,
    authorId: row.author_id ?? row.user_id ?? null,
    authorName:
      row.author_pen_name ??
      row.author_name ??
      row.pen_name ??
      row.display_name ??
      row.full_name ??
      row.provider_full_name ??
      null,
    authorPhoto: resolveProfileAvatarUrl(row.author_avatar_url, row.avatar_url, row.provider_avatar_url),
    authorVerification: row.author_verification_type ?? row.verification_type ?? null,
    isEdited: row.is_edited === true,
    type: normalizePostType(row.type ?? row.post_type),
    text: row.content ?? row.body ?? row.improved_content ?? "",
    targetKind,
    targetId: legacyTitle ? (row.target_id ?? matchedBook?.id ?? null) : null,
    targetTitle: legacyTitle,
    targetAuthor: legacyTitle
      ? row.target_author ?? (matchedBook ? getAuthor(matchedBook.authorId)?.name ?? null : null)
      : null,
    attachedId: hasAttachment ? row.attached_content_id ?? null : null,
    attachedTitle: hasAttachment ? row.attached_content_title ?? null : null,
    attachedCover: hasAttachment ? row.attached_content_cover_url ?? null : null,
    attachedAuthor: hasAttachment ? row.attached_content_author ?? null : null,
    attachedType: hasAttachment ? attachedType : null,
    attachedKind: hasAttachment && attachedType ? normalizeKind(attachedType) : null,
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    ts: new Date(row.created_at).getTime(),
  };
}

function normalizePostType(value?: string | null): PostType {
  if (value === "quote" || value === "review" || value === "discussion" || value === "thought") {
    return value;
  }
  return DEFAULT_POST_TYPE;
}

function normalizeTargetKind(value?: string | null): LiteratureKind | undefined {
  if (value === "book" || value === "poem" || value === "screenplay" || value === "other") {
    return value;
  }
  return undefined;
}

function findBookByTitle(title: string): Book | null {
  const normalized = title.trim().toLowerCase();
  return books.find((item) => item.title.trim().toLowerCase() === normalized) ?? null;
}

function getPostTarget(post: Post): {
  kind: LiteratureKind;
  title: string;
  author: string | null;
  cover: string | null;
  book: Book | null;
} | null {
  const id = post.targetId ?? post.bookId ?? null;
  const book = id ? books.find((item) => item.id === id) ?? null : null;
  const kind = post.targetKind ?? (book ? getLiteratureKind(book) : "book");
  const author = book ? getAuthor(book.authorId)?.name ?? null : post.targetAuthor ?? null;
  const title = book?.title ?? post.targetTitle ?? post.bookTitle ?? null;

  if (!title) return null;

  return {
    kind,
    title,
    author,
    cover: book?.cover ?? null,
    book,
  };
}

/** Avatar with automatic initials fallback when the image URL fails to load. */
function AvatarImg({
  uri,
  initial,
  avatarStyle,
  fallbackStyle,
  initialStyle,
}: {
  uri: string | null | undefined;
  initial: string;
  avatarStyle: any;
  fallbackStyle: any;
  initialStyle: any;
}) {
  const [err, setErr] = useState(false);
  React.useEffect(() => { setErr(false); }, [uri]);
  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={avatarStyle}
        contentFit="cover"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={[avatarStyle, fallbackStyle]}>
      <Text style={initialStyle}>{initial}</Text>
    </View>
  );
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "S";
}

function postMatchesSearch(post: Post, query: string): boolean {
  if (!query) return true;
  const target = getPostTarget(post);
  return [
    post.text,
    post.authorName,
    post.bookTitle,
    post.targetTitle,
    post.targetAuthor,
    target?.title,
    target?.author,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function createStyles(c: AppTheme) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 3 },
    headerIconBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    headerIconBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    notificationDot: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.gold,
      borderWidth: 1,
      borderColor: c.bgCard,
    },
    h1: { color: c.text, fontSize: 32, fontFamily: FONT.serif, fontWeight: "700", letterSpacing: -0.5 },
    h2: { color: c.textMuted, fontSize: 13, marginTop: 3 },
    searchWrap: {
      minHeight: 46,
      marginHorizontal: 20,
      marginBottom: 14,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    searchTextLayer: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
    },
    typingPlaceholder: {
      position: "absolute",
      left: 0,
      right: 0,
      color: c.textMuted,
      fontSize: 14,
    },
    searchInput: { flex: 1, minHeight: 44, color: c.text, fontSize: 14, padding: 0 },
    toast: {
      position: "absolute",
      left: 20,
      right: 20,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.primary,
      shadowOpacity: 0.26,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 7 },
      elevation: 8,
    },
    toastText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },
    floatingWriteBtn: {
      position: "absolute",
      right: 22,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.primary,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 9,
    },
    floatingWritePulse: {
      position: "absolute",
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.primary,
    },
    feedStatus: {
      marginHorizontal: 20,
      marginBottom: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    feedStatusText: { flex: 1, color: c.textDim, fontSize: 12, lineHeight: 17 },
    dateBanner: {
      marginHorizontal: 20,
      marginBottom: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.isDark ? "rgba(116,201,164,0.24)" : "rgba(29,53,87,0.14)",
      backgroundColor: c.isDark ? "rgba(116,201,164,0.10)" : "rgba(29,53,87,0.06)",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dateBannerText: { color: c.text, fontSize: 13, fontWeight: "800" },
    dateBannerClear: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgElevated,
    },
    emptyDay: {
      marginHorizontal: 20,
      marginTop: 8,
      paddingVertical: 30,
      paddingHorizontal: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      alignItems: "center",
      gap: 8,
    },
    emptyDayTitle: { color: c.text, fontSize: 15, fontWeight: "800", marginTop: 2 },
    emptyDayText: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: "center" },
    emptyDayBtn: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: c.primary,
    },
    emptyDayBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    divider: { height: 0, backgroundColor: "transparent", marginHorizontal: 0 },
    card: {
      marginHorizontal: 20,
      marginBottom: 12,
      paddingHorizontal: 18,
      paddingVertical: 18,
      backgroundColor: c.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgElevated },
    avatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong },
    avatarInitial: { color: c.primaryDim, fontSize: 15, fontWeight: "800" },
    authorMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    authorName: { color: c.text, fontSize: 14, fontWeight: "700" },
    typeBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
      borderWidth: 1,
      backgroundColor: c.soft,
      borderColor: c.borderStrong,
    },
    typeLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
    tsRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
    ts: { color: c.textMuted, fontSize: 12 },
    editedLabel: { color: c.textMuted, fontSize: 11, fontWeight: "600", fontStyle: "italic" },
    quoteWrap: { borderLeftWidth: 2, borderLeftColor: c.primary, paddingLeft: 14, marginBottom: 14 },
    quoteText: { color: c.text, fontSize: 15, fontFamily: FONT.serif, lineHeight: 24, fontStyle: "italic" },
    bodyText: { color: c.text, fontSize: 15, lineHeight: 24, marginBottom: 14 },
    bookRef: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.bgElevated,
      borderRadius: 12,
      padding: 10,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    bookRefCover: { width: 36, height: 52, borderRadius: 6, backgroundColor: c.bgCard },
    bookRefIcon: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong },
    bookRefLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
    bookRefLabelText: { color: c.secondary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
    bookRefTitle: { color: c.text, fontSize: 13, fontWeight: "700" },
    bookRefAuthor: { color: c.textDim, fontSize: 11, marginTop: 1 },
    actions: { flexDirection: "row", alignItems: "center", gap: 4 },
    action: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
    actionText: { color: c.textMuted, fontSize: 13 },
    sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: c.isDark ? "rgba(0,0,0,0.6)" : "rgba(13,27,42,0.26)" },
    sheetDismiss: { flex: 1 },
    sheetKeyboard: { width: "100%" },
    sheet: {
      backgroundColor: c.bgGlass,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 6,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: -6 },
      elevation: 10,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.isDark ? "rgba(255,255,255,0.14)" : "rgba(13,27,42,0.15)",
      marginBottom: 10,
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sheetTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
    sheetSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    iconButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgElevated,
    },
    sheetContent: { paddingTop: 10, paddingBottom: 8, gap: 8 },
    nameInput: {
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      paddingHorizontal: 12,
      color: c.text,
      fontSize: 13,
      marginBottom: 8,
    },
    // Compact kind pills
    segmentRow: { gap: 6, paddingBottom: 10 },
    segment: {
      height: 28,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: { backgroundColor: c.primary, borderColor: c.primary },
    segmentText: { color: c.textDim, fontSize: 12, fontWeight: "600" },
    segmentTextActive: { color: "#fff" },
    // Compact target chips (no big cards)
    targetRow: { gap: 8, paddingBottom: 10 },
    targetChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      maxWidth: 152,
    },
    targetChipActive: { borderColor: c.primary, backgroundColor: c.primary },
    targetCover: { width: 22, height: 32, borderRadius: 4, backgroundColor: c.bgElevated, flexShrink: 0 },
    targetCopy: { flex: 1, minWidth: 0 },
    targetTitle: { color: c.text, fontSize: 12, fontWeight: "700", flexShrink: 1 },
    targetTitleActive: { color: "#fff" },
    targetAuthor: { color: c.textMuted, fontSize: 10, marginTop: 1 },
    targetAuthorActive: { color: "rgba(255,255,255,0.75)" },
    sheetError: { color: "#B42318", fontSize: 11, lineHeight: 16, marginBottom: 4 },
    sheetStatus: { color: c.primary, fontSize: 11, lineHeight: 16, fontWeight: "700", marginBottom: 4 },
    // Editor bar — input + actions inside one container
    editorWrap: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      overflow: "hidden",
    },
    editor: {
      minHeight: 80,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
      color: c.text,
      fontSize: 14,
      lineHeight: 20,
    },
    // Bottom row inside the bar
    editorActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    // AI improve button — subtle, left side
    improveBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: c.isDark ? "rgba(116,201,164,0.08)" : "rgba(46,125,50,0.06)",
    },
    improveBtnText: { color: c.secondary, fontSize: 12, fontWeight: "600" },
    // Send button — round circle, bottom-right
    publishBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary,
    },
    publishBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    disabledBtn: { opacity: 0.45 },
    editorActionsLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, marginRight: 8 },
    attachBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 12,
      flexShrink: 1,
      borderWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: c.isDark ? "rgba(82,183,136,0.08)" : "rgba(82,183,136,0.06)",
    },
    attachBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    attachBtnText: { color: c.primary, fontSize: 12, fontWeight: "600", flexShrink: 1 },
    attachSearchWrap: { marginBottom: 10 },
    attachSearchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.bgElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    attachSearchInput: { flex: 1, color: c.text, fontSize: 14, padding: 0 },
    attachResults: { marginTop: 8, maxHeight: 220 },
    attachEmpty: { color: c.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 18 },
    attachResultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 12,
    },
    attachResultCover: { width: 38, height: 52, borderRadius: 7, backgroundColor: c.bgElevated },
    attachResultCoverPh: { alignItems: "center", justifyContent: "center" },
    attachResultTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
    attachResultAuthor: { color: c.textDim, fontSize: 12, marginTop: 2 },
    attachKindBadge: {
      backgroundColor: c.isDark ? "rgba(82,183,136,0.16)" : "rgba(82,183,136,0.10)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    attachKindBadgeText: { color: c.primary, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.3 },
    attachChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
      backgroundColor: c.bgElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 8,
    },
    attachChipCover: { width: 34, height: 46, borderRadius: 6, backgroundColor: c.bgCard },
    attachChipTitle: { color: c.text, fontSize: 13.5, fontWeight: "700" },
    attachChipRemove: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgCard,
    },
    commentPostPreview: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 6,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    commentPostText: { color: c.textDim, fontSize: 13, lineHeight: 18, marginTop: 3, fontWeight: "500" },
    commentList: { maxHeight: 320, paddingHorizontal: 16, paddingTop: 10 },
    commentEmpty: { color: c.textMuted, fontSize: 14, textAlign: "center", paddingVertical: 28 },
    commentRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.bgElevated },
    commentAvatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong },
    commentAvatarInitial: { color: c.primaryDim, fontSize: 13, fontWeight: "800" },
    commentBubble: {
      flex: 1,
      backgroundColor: c.bgElevated,
      borderRadius: 14,
      borderTopLeftRadius: 4,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    commentAuthorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    commentAuthor: { color: c.text, fontSize: 13, fontWeight: "800" },
    commentText: { color: c.textDim, fontSize: 14, lineHeight: 20, marginTop: 3, fontWeight: "500" },
    commentTs: { color: c.textMuted, fontSize: 11, marginTop: 5, fontWeight: "500" },
    commentInputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    commentInput: {
      flex: 1,
      maxHeight: 110,
      minHeight: 40,
      backgroundColor: c.bgElevated,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: c.text,
      fontSize: 15,
      fontWeight: "500",
    },
    // legacy (unused but keeps TS happy)
    sheetFooter: { flexDirection: "row" as const, gap: 8 },
    cancelBtn: { height: 36 },
    cancelBtnText: { color: c.textDim },
    calMonthRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 14,
      paddingBottom: 10,
    },
    calNavBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    calNavBtnOff: { opacity: 0.4 },
    calMonthLabel: { color: c.text, fontSize: 16, fontWeight: "800" },
    calWeekRow: { flexDirection: "row", marginBottom: 4 },
    calWeekday: {
      flex: 1,
      textAlign: "center",
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "700",
      paddingVertical: 4,
    },
    calCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 3 },
    calDay: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    calDayToday: { borderWidth: 1.5, borderColor: c.primary },
    calDaySelected: { backgroundColor: c.primary },
    calDayText: { color: c.text, fontSize: 14, fontWeight: "600" },
    calDayTextOff: { color: c.textMuted, opacity: 0.5 },
    calDayTextSelected: { color: "#fff", fontWeight: "800" },
    calFooter: { paddingTop: 14, alignItems: "center" },
    calTodayBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 23,
      backgroundColor: c.primary,
    },
    calTodayBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
}
