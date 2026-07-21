import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Send,
  Upload,
  X,
} from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/useResponsive";
import { WEB_HEADER_HEIGHT } from "@/components/web/WebHeader";
import { FadeSlideIn, ScreenTransitionWrapper } from "@/components/animations";
import BookCover from "@/components/BookCover";
import { PullRefreshIndicator } from "@/components/PullRefreshIndicator";
import { FONT, PressableScale } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePublicReels } from "@/hooks/useReels";
import { openContentPreview } from "@/lib/contentNavigation";
import {
  addReelComment,
  fetchReelComments,
  fetchReelLinkedWork,
  formatReelError,
  recordReelShare,
  recordReelView,
  submitReel,
  toggleReelCommentLike,
  toggleReelLike,
  toggleReelSave,
  updateReelMetadata,
  uploadReelThumbnail,
  type PublicReel,
  type ReelComment,
  type ReelLinkedWork,
  type ReelMetadataUpdate,
  type ReelUploadAsset,
} from "@/lib/reels";
import { contentTypeLabel } from "@/types/author";
import { MentionSuggestionList, MentionText, useMentionAutocomplete } from "@/components/sozlab/MentionTextInput";
import { resolveHandleToUserId } from "@/hooks/useMentionSearch";
import { recordMentions, type MentionPick } from "@/lib/mentions";
import { useReelAttachmentSearch } from "@/hooks/useReelAttachmentSearch";
import { type LiteratureSearchItem } from "@/hooks/useLiteratureSearch";
import { normalizeKind, TOP_KIND_LABELS } from "@/types/community";
import VerificationBadge from "@/components/VerificationBadge";
import { useAuth } from "@/providers/AuthProvider";
import { useHideTabBar } from "@/providers/TabBarVisibility";
import { useTheme } from "@/providers/ThemeProvider";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const { isWebLayout } = useResponsive();
  const { width: winW, height: winH } = useWindowDimensions();
  // On web the feed is a centered 9:16 column under the site header — never a
  // full-bleed stretched video. Native keeps the exact full-screen dimensions.
  const itemHeight = isWebLayout ? Math.max(520, winH - WEB_HEADER_HEIGHT) : SCREEN_H;
  const feedWidth = isWebLayout ? Math.min(winW, Math.round((itemHeight * 9) / 16)) : SCREEN_W;
  const { reelId } = useLocalSearchParams<{ reelId?: string }>();
  const { userId, profileRow } = useAuth();
  const { reels, setReels, loading, error, refresh } = usePublicReels(userId);
  const { refreshing, replayKey, onRefresh } = usePullToRefresh(refresh);
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailReel, setDetailReel] = useState<PublicReel | null>(null);
  const [commentReel, setCommentReel] = useState<PublicReel | null>(null);
  const [editReel, setEditReel] = useState<PublicReel | null>(null);
  // Immersive mode: a two-finger pinch hides all overlays for an unobstructed view.
  const [immersive, setImmersive] = useState(false);
  // Playback is paused whenever this tab loses focus so a reel never keeps
  // playing (with sound) behind another screen.
  const [screenFocused, setScreenFocused] = useState(true);
  const uploadOpen = false;
  const listRef = useRef<FlatList<PublicReel>>(null);
  const viewedThisSession = useRef<Set<string>>(new Set());
  const reelsLengthRef = useRef(0);
  const loopedReels = useMemo(
    () => (reels.length > 1 ? [...reels, reels[0]!] : reels),
    [reels]
  );

  useEffect(() => {
    reelsLengthRef.current = reels.length;
  }, [reels.length]);

  const initialReelIndex = useMemo(() => {
    if (!reelId) return 0;
    const idx = reels.findIndex((item) => item.id === reelId);
    return idx >= 0 ? idx : 0;
  }, [reelId, reels]);

  useEffect(() => {
    if (reels.length === 0) {
      setActiveIndex(0);
      return;
    }
    const nextIndex = Math.min(initialReelIndex, reels.length - 1);
    setActiveIndex(nextIndex);
    if (nextIndex > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: nextIndex, animated: false });
      });
    }
  }, [initialReelIndex, reels.length]);

  // Leaving a reel always restores the overlays (a stuck immersive state
  // would otherwise hide the UI on the next video).
  useEffect(() => {
    setImmersive(false);
  }, [activeIndex]);

  // Hide the floating bottom tab bar while the comment panel is open.
  const hideTabBar = useHideTabBar();
  useEffect(() => {
    hideTabBar(!!commentReel);
    return () => hideTabBar(false);
  }, [commentReel, hideTabBar]);

  // Pause every reel when the user navigates away (opening a creator profile, a
  // book, another tab…) and resume the active one on return.
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, [])
  );

  useEffect(() => {
    const reel = reels[activeIndex];
    if (!reel || !userId || viewedThisSession.current.has(reel.id)) return;
    viewedThisSession.current.add(reel.id);
    recordReelView({ reelId: reel.id, userId }).catch((err) => {
      if (__DEV__) console.warn("[reels] view insert failed:", err?.message ?? err);
    });
  }, [activeIndex, reels, userId]);

  const updateReel = useCallback(
    (reelIdToUpdate: string, updater: (reel: PublicReel) => PublicReel) => {
      setReels((prev) => prev.map((item) => (item.id === reelIdToUpdate ? updater(item) : item)));
      setDetailReel((prev) => (prev?.id === reelIdToUpdate ? updater(prev) : prev));
      setCommentReel((prev) => (prev?.id === reelIdToUpdate ? updater(prev) : prev));
    },
    [setReels]
  );

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      const rawIndex = viewableItems[0].index;
      const reelCount = reelsLengthRef.current;
      setActiveIndex(reelCount > 0 ? rawIndex % reelCount : 0);
    }
  }).current;

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (reels.length <= 1) return;
      const rawIndex = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
      if (rawIndex < reels.length) return;
      requestAnimationFrame(() => {
        setActiveIndex(0);
        listRef.current?.scrollToIndex({ index: 0, animated: false });
      });
    },
    [itemHeight, reels.length]
  );

  return (
    <ScreenTransitionWrapper type="right" style={{ backgroundColor: "#000" }} replayKey={replayKey}>
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: isWebLayout ? "center" : "stretch" }}>
        {loading && reels.length === 0 ? (
          <FeedStatus topInset={insets.top} text="Reels yuklanmoqda..." loading />
        ) : reels.length === 0 ? (
          <FeedStatus topInset={insets.top} text="Hozircha reels mavjud emas" />
        ) : (
          <FlatList
            ref={listRef}
            data={loopedReels}
            keyExtractor={(item, index) => `${item.id}:${index === reels.length ? "loop" : index}`}
            style={isWebLayout ? { width: feedWidth, height: itemHeight, flexGrow: 0 } : undefined}
            initialScrollIndex={initialReelIndex > 0 ? initialReelIndex : undefined}
            pagingEnabled
            snapToInterval={itemHeight}
            decelerationRate="fast"
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            updateCellsBatchingPeriod={80}
            removeClippedSubviews={Platform.OS !== "web"}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            onScrollToIndexFailed={({ index }) => {
              requestAnimationFrame(() => {
                listRef.current?.scrollToOffset({ offset: itemHeight * index, animated: false });
              });
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#52B788"
                colors={["#52B788"]}
                progressBackgroundColor="#111"
                progressViewOffset={insets.top}
              />
            }
            renderItem={({ item, index }) => (
              <ReelItem
                reel={item}
                active={(reels.length > 0 ? index % reels.length : index) === activeIndex}
                screenFocused={screenFocused}
                commentsOpen={commentReel?.id === item.id}
                isOwner={!!userId && userId === item.userId}
                height={itemHeight}
                width={feedWidth}
                currentUserId={userId}
                immersive={immersive}
                onImmersiveChange={setImmersive}
                onUpdate={updateReel}
                onOpenDetails={() => setDetailReel(item)}
                onOpenComments={() => setCommentReel(item)}
                onOpenEdit={() => setEditReel(item)}
              />
            )}
            getItemLayout={(_, index) => ({
              length: itemHeight,
              offset: itemHeight * index,
              index,
            })}
          />
        )}
        {error ? (
          <View style={[styles.feedError, { top: insets.top + 82 }]}>
            <Text style={styles.feedErrorText}>{error}</Text>
          </View>
        ) : null}
        <PullRefreshIndicator
          refreshing={refreshing}
          color="#52B788"
          top={insets.top + 8}
          surfaceColor="#111"
          borderColor="rgba(82, 183, 136, 0.35)"
        />

        <DetailSheet reel={detailReel} onClose={() => setDetailReel(null)} />
        {commentReel ? (
          <ReelCommentMode
            reel={commentReel}
            currentUserId={userId}
            insets={insets}
            onClose={() => setCommentReel(null)}
            onCountDelta={(delta) =>
              updateReel(commentReel.id, (item) => ({
                ...item,
                commentsCount: Math.max(0, item.commentsCount + delta),
              }))
            }
          />
        ) : null}
        {editReel ? (
          <ReelOwnerEditSheet
            reel={editReel}
            currentUserId={userId}
            insets={insets}
            onClose={() => setEditReel(null)}
            onUpdated={(patch) => updateReel(editReel.id, (item) => ({ ...item, ...patch }))}
          />
        ) : null}
        <UploadReelSheet
          visible={uploadOpen}
          profileId={profileRow?.id ?? null}
          authorId={profileRow?.author_id ?? null}
          onClose={() => {}}
        />
      </View>
    </ScreenTransitionWrapper>
  );
}

function FeedStatus({
  topInset,
  text,
  loading,
}: {
  topInset: number;
  text: string;
  loading?: boolean;
}) {
  return (
    <View style={[styles.feedStatus, { paddingTop: topInset + 120 }]}>
      {loading ? <ActivityIndicator color="#52B788" size="large" /> : null}
      <Text style={styles.feedStatusText}>{text}</Text>
    </View>
  );
}

function ReelItem({
  reel,
  active,
  screenFocused,
  commentsOpen,
  isOwner,
  height,
  width,
  currentUserId,
  immersive,
  onImmersiveChange,
  onUpdate,
  onOpenDetails,
  onOpenComments,
  onOpenEdit,
}: {
  reel: PublicReel;
  active: boolean;
  screenFocused: boolean;
  commentsOpen: boolean;
  isOwner: boolean;
  height: number;
  width: number;
  currentUserId: string | null;
  immersive: boolean;
  onImmersiveChange: (value: boolean) => void;
  onUpdate: (reelId: string, updater: (reel: PublicReel) => PublicReel) => void;
  onOpenDetails: () => void;
  onOpenComments: () => void;
  onOpenEdit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [busyAction, setBusyAction] = useState<"like" | "save" | "share" | null>(null);
  const [holdMode, setHoldMode] = useState<"pause" | "fast" | null>(null);
  // A single tap toggles this: the reel stays paused until the next tap.
  const [manualPaused, setManualPaused] = useState(false);
  const [linkedWork, setLinkedWork] = useState<ReelLinkedWork | null>(null);
  const heartScale = useRef(new Animated.Value(1)).current;
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const pinchScale = useSharedValue(1);
  const player = useVideoPlayer(reel.videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  // Resolve the attached adabiyot (book/poem/…) shown on the reel card.
  useEffect(() => {
    if (!reel.linkedContentId) {
      setLinkedWork(null);
      return;
    }
    let cancelled = false;
    fetchReelLinkedWork(reel.linkedContentType, reel.linkedContentId)
      .then((work) => {
        if (!cancelled) setLinkedWork(work);
      })
      .catch(() => {
        if (!cancelled) setLinkedWork(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reel.linkedContentId, reel.linkedContentType]);

  // Play only the visible reel, and only while the screen is focused and the
  // user hasn't tap-paused it. When the comment panel opens this SAME player is
  // just shrunk to the top (below), so playback continues seamlessly.
  useEffect(() => {
    const shouldPlay = active && screenFocused && !manualPaused;
    if (shouldPlay) {
      try {
        player.play();
      } catch (e) {
        if (__DEV__) console.log("[reels] play err", e);
      }
    } else {
      try {
        player.pause();
      } catch (e) {
        if (__DEV__) console.log("[reels] pause err", e);
      }
    }
  }, [active, screenFocused, manualPaused, player]);

  // A tap-pause only applies to the reel you paused; scrolling away clears it.
  useEffect(() => {
    if (!active) setManualPaused(false);
  }, [active]);

  const requireAuth = useCallback(() => {
    if (currentUserId) return true;
    Alert.alert("Hisobga kiring", "Bu amal uchun avval AdabiyotX hisobingizga kiring.");
    return false;
  }, [currentUserId]);

  const onLike = useCallback(async () => {
    if (!requireAuth() || busyAction) return;
    const wasLiked = reel.likedByMe;
    setBusyAction("like");
    onUpdate(reel.id, (item) => ({
      ...item,
      likedByMe: !wasLiked,
      likesCount: Math.max(0, item.likesCount + (wasLiked ? -1 : 1)),
    }));
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
    try {
      const liked = await toggleReelLike({ reelId: reel.id, userId: currentUserId as string, liked: wasLiked });
      onUpdate(reel.id, (item) => ({ ...item, likedByMe: liked }));
    } catch (err) {
      onUpdate(reel.id, (item) => ({
        ...item,
        likedByMe: wasLiked,
        likesCount: Math.max(0, item.likesCount + (wasLiked ? 1 : -1)),
      }));
      Alert.alert("Like saqlanmadi", formatReelError(err, "Like amalida xatolik yuz berdi."));
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, currentUserId, heartScale, onUpdate, reel.id, reel.likedByMe, requireAuth]);

  const onSave = useCallback(async () => {
    if (!requireAuth() || busyAction) return;
    const wasSaved = reel.savedByMe;
    setBusyAction("save");
    onUpdate(reel.id, (item) => ({
      ...item,
      savedByMe: !wasSaved,
      savesCount: Math.max(0, item.savesCount + (wasSaved ? -1 : 1)),
    }));
    try {
      const saved = await toggleReelSave({ reelId: reel.id, userId: currentUserId as string, saved: wasSaved });
      onUpdate(reel.id, (item) => ({ ...item, savedByMe: saved }));
    } catch (err) {
      onUpdate(reel.id, (item) => ({
        ...item,
        savedByMe: wasSaved,
        savesCount: Math.max(0, item.savesCount + (wasSaved ? 1 : -1)),
      }));
      Alert.alert("Saqlanmadi", formatReelError(err, "Reels saqlashda xatolik yuz berdi."));
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, currentUserId, onUpdate, reel.id, reel.savedByMe, requireAuth]);

  const onShare = useCallback(async () => {
    if (busyAction) return;
    setBusyAction("share");
    const link = Linking.createURL("/reels", { queryParams: { reelId: reel.id } });
    try {
      const result = await Share.share({
        title: reel.title,
        message: [reel.title, reel.caption, link, "AdabiyotX Reels"].filter(Boolean).join("\n"),
        url: link,
      });
      const shared = Platform.OS === "android" || result.action === Share.sharedAction;
      if (shared) {
        onUpdate(reel.id, (item) => ({ ...item, sharesCount: item.sharesCount + 1 }));
        if (currentUserId) {
          recordReelShare({ reelId: reel.id, userId: currentUserId, shareTarget: result.activityType ?? null }).catch((err) => {
            if (__DEV__) console.warn("[reels] share insert failed:", err?.message ?? err);
          });
        }
      }
    } catch (err) {
      Alert.alert("Ulashilmadi", err instanceof Error ? err.message : "Ulashishda xatolik yuz berdi.");
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, currentUserId, onUpdate, reel.caption, reel.id, reel.title]);

  const creatorName = reel.creatorName?.trim() || "AdabiyotX ijodkori";
  const creatorHandle = reel.creatorUsername ? `@${reel.creatorUsername}` : null;

  const openCreator = useCallback(() => {
    const authorTarget = reel.authorId ?? reel.userId;
    if (authorTarget) {
      router.push({ pathname: "/author/[id]", params: { id: authorTarget } });
    }
  }, [reel.authorId, reel.userId]);

  // ── Gestures ───────────────────────────────────────────────────────────
  // Double-tap → like (with a heart burst). Hold RIGHT half → 2× playback,
  // hold LEFT half → pause while held. Two-finger pinch → immersive (hide UI).
  const runBurst = useCallback(() => {
    burstScale.setValue(0.4);
    burstOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(burstOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  }, [burstOpacity, burstScale]);

  const doubleTapLike = useCallback(() => {
    runBurst();
    if (!reel.likedByMe) onLike();
  }, [onLike, reel.likedByMe, runBurst]);

  const togglePause = useCallback(() => {
    setManualPaused((prev) => !prev);
  }, []);

  const startHold = useCallback(
    (x: number) => {
      if (x > width / 2) {
        setHoldMode("fast");
        try { player.playbackRate = 2; } catch {}
      } else {
        setHoldMode("pause");
        try { player.pause(); } catch {}
      }
    },
    [player, width]
  );

  const endHold = useCallback(() => {
    setHoldMode(null);
    try { player.playbackRate = 1; } catch {}
    if (active) {
      try { player.play(); } catch {}
    }
  }, [active, player]);

  const singleTap = useMemo(
    () => Gesture.Tap().maxDuration(250).onEnd(() => runOnJS(togglePause)()),
    [togglePause]
  );
  const doubleTap = useMemo(
    () => Gesture.Tap().numberOfTaps(2).maxDuration(300).onEnd(() => runOnJS(doubleTapLike)()),
    [doubleTapLike]
  );
  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(230)
        .onStart((e) => runOnJS(startHold)(e.x))
        .onEnd(() => runOnJS(endHold)())
        .onFinalize(() => runOnJS(endHold)()),
    [endHold, startHold]
  );
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => runOnJS(onImmersiveChange)(true))
        .onUpdate((e) => {
          pinchScale.value = Math.min(Math.max(e.scale, 1), 2.6);
        })
        .onEnd(() => {
          pinchScale.value = withTiming(1);
          runOnJS(onImmersiveChange)(false);
        }),
    [onImmersiveChange, pinchScale]
  );
  // Single tap must wait for the double-tap (like) to fail before it toggles
  // pause — Exclusive gives the double tap priority.
  const composed = useMemo(
    () => Gesture.Race(pinch, longPress, Gesture.Exclusive(doubleTap, singleTap)),
    [doubleTap, longPress, pinch, singleTap]
  );
  const videoAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: pinchScale.value }] }));

  // When the comment panel is open, this SAME player shrinks to a small 9:16 box
  // at the top (kept playing — no restart); the panel overlays everything below.
  const topH = Math.round(SCREEN_H * 0.34);
  const cVidH = Math.max(150, topH - insets.top - 20);
  const cVidW = Math.round((cVidH * 9) / 16);
  const commentVideoStyle = {
    position: "absolute" as const,
    top: insets.top + Math.max(0, Math.round((topH - insets.top - cVidH) / 2)),
    left: Math.round((width - cVidW) / 2),
    width: cVidW,
    height: cVidH,
    borderRadius: 16,
    overflow: "hidden" as const,
  };

  return (
    <View style={{ height, width, backgroundColor: "#000" }}>
      <GestureDetector gesture={composed}>
        <Reanimated.View style={commentsOpen ? commentVideoStyle : [StyleSheet.absoluteFillObject, videoAnimStyle]}>
          {reel.thumbnailUrl ? (
            <Image
              source={{ uri: reel.thumbnailUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : null}
          <VideoView
            style={StyleSheet.absoluteFillObject}
            player={player}
            contentFit="cover"
            nativeControls={false}
          />
        </Reanimated.View>
      </GestureDetector>
      {commentsOpen ? null : (
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.92)"]}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}

      {/* Double-tap heart burst */}
      <Animated.View
        pointerEvents="none"
        style={[styles.burstWrap, { opacity: burstOpacity, transform: [{ scale: burstScale }] }]}
      >
        <Heart color="#fff" size={120} fill="#52B788" strokeWidth={0} />
      </Animated.View>

      {/* Hold indicator (2× / pause) */}
      {holdMode && !commentsOpen ? (
        <View pointerEvents="none" style={styles.holdBadge}>
          <Text style={styles.holdBadgeText}>
            {holdMode === "fast" ? "2× tezlik" : "To'xtatildi"}
          </Text>
        </View>
      ) : null}

      {/* Tap-to-pause indicator (center play glyph) */}
      {manualPaused && !holdMode && !commentsOpen ? (
        <View pointerEvents="none" style={styles.pausedOverlay}>
          <View style={styles.pausedCircle}>
            <Play color="#fff" size={34} fill="#fff" strokeWidth={0} style={{ marginLeft: 3 }} />
          </View>
        </View>
      ) : null}

      {/* Owner-only "Parametrlar" (edit) button — only the reel's owner sees it. */}
      {isOwner && !immersive && !commentsOpen ? (
        <Pressable onPress={onOpenEdit} hitSlop={8} style={[styles.ownerBtn, { top: insets.top + 10 }]}>
          <MoreHorizontal color="#fff" size={22} />
        </Pressable>
      ) : null}

      {immersive || commentsOpen ? null : (
      <>
      <FadeSlideIn delay={160} distance={14} style={[styles.rightCol, { bottom: insets.bottom + 78 }]}>
        <PressableScale onPress={onLike} style={styles.actionBtn}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <ActionCircle active={reel.likedByMe} tint="#52B788">
              <Heart
                color={reel.likedByMe ? "#52B788" : "#fff"}
                size={22}
                fill={reel.likedByMe ? "#52B788" : "transparent"}
                strokeWidth={2.2}
              />
            </ActionCircle>
          </Animated.View>
          <Text style={styles.actionText}>{formatCount(reel.likesCount)}</Text>
        </PressableScale>
        <PressableScale onPress={onOpenComments} style={styles.actionBtn}>
          <ActionCircle>
            <MessageCircle color="#fff" size={22} strokeWidth={2.2} />
          </ActionCircle>
          <Text style={styles.actionText}>{formatCount(reel.commentsCount)}</Text>
        </PressableScale>
        <PressableScale onPress={onSave} style={styles.actionBtn}>
          <ActionCircle active={reel.savedByMe} tint="#F4A261">
            <Bookmark
              color={reel.savedByMe ? "#F4A261" : "#fff"}
              fill={reel.savedByMe ? "#F4A261" : "transparent"}
              size={21}
              strokeWidth={2.2}
            />
          </ActionCircle>
          <Text style={styles.actionText}>{reel.savedByMe ? "Saqlandi" : "Saqla"}</Text>
        </PressableScale>
        <PressableScale onPress={onShare} style={styles.actionBtn}>
          <ActionCircle>
            <Send color="#fff" size={20} strokeWidth={2.2} />
          </ActionCircle>
          <Text style={styles.actionText}>Ulash</Text>
        </PressableScale>
      </FadeSlideIn>

      <FadeSlideIn delay={230} distance={18} style={[styles.leftCol, { bottom: insets.bottom + 70 }]}>
        <View style={styles.authorRow}>
          <Pressable onPress={openCreator} hitSlop={6}>
            <AvatarCircle uri={reel.creatorAvatarUrl} name={creatorName} />
          </Pressable>
          <Pressable onPress={openCreator} style={{ flex: 1, marginLeft: 10 }} hitSlop={6}>
            <View style={styles.creatorNameRow}>
              <Text style={styles.authorName} numberOfLines={1}>{creatorName}</Text>
              {reel.creatorBadge ? (
                <View style={styles.creatorBadge}>
                  <Text style={styles.creatorBadgeText}>Ijodkor</Text>
                </View>
              ) : null}
            </View>
            {creatorHandle ? <Text style={styles.creatorHandle}>{creatorHandle}</Text> : null}
          </Pressable>
        </View>

        <Text style={styles.reelTitle}>{reel.title}</Text>

        <LinkedWork work={linkedWork} reel={reel} onOpen={onOpenDetails} />
      </FadeSlideIn>
      </>
      )}
    </View>
  );
}

function AvatarCircle({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.authorAvatar} contentFit="cover" />;
  }
  return (
    <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
      <Text style={styles.authorAvatarInitial}>{name.trim().charAt(0).toUpperCase() || "A"}</Text>
    </View>
  );
}

function ActionCircle({
  active,
  tint,
  children,
}: {
  active?: boolean;
  tint?: string;
  children: React.ReactNode;
}) {
  const activeBg =
    active && tint === "#52B788"
      ? "rgba(82,183,136,0.20)"
      : active && tint === "#F4A261"
      ? "rgba(244,162,97,0.20)"
      : "rgba(255,255,255,0.07)";
  const activeBorder =
    active && tint === "#52B788"
      ? "rgba(82,183,136,0.55)"
      : active && tint === "#F4A261"
      ? "rgba(244,162,97,0.55)"
      : "rgba(255,255,255,0.18)";

  if (Platform.OS === "web") {
    return (
      <View style={[styles.actionCircle, { backgroundColor: activeBg, borderColor: activeBorder }]}>
        {children}
      </View>
    );
  }
  return (
    <BlurView intensity={20} tint="dark" style={[styles.actionCircle, { borderColor: activeBorder }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: activeBg }]} />
      {children}
    </BlurView>
  );
}

const LINKED_ICON: Record<string, any> = {
  book: "book-open-variant",
  poem: "feather",
  article: "text-box-outline",
  screenplay: "movie-open-outline",
  scenario: "movie-open-outline",
};

/**
 * The card under the reel title. When the reel has an attached adabiyot
 * (book/poem/…) it shows that work — cover, type, title, author — and opens it
 * on tap. With nothing attached it degrades to a plain caption (no "HAQIDA").
 */
function LinkedWork({
  work,
  reel,
  onOpen,
}: {
  work: ReelLinkedWork | null;
  reel: PublicReel;
  onOpen: () => void;
}) {
  if (work) {
    const open = () => openContentPreview(work.contentType, work.id, { title: work.title });
    const Wrap: any = Platform.OS === "web" ? View : BlurView;
    const wrapProps: any =
      Platform.OS === "web"
        ? { style: [styles.workCard, { backgroundColor: "rgba(20,20,22,0.72)" }] }
        : { intensity: 40, tint: "dark", style: styles.workCard };
    return (
      <PressableScale onPress={open} style={{ marginTop: 12 }}>
        <Wrap {...wrapProps}>
          <View style={styles.workInner}>
            <BookCover
              uri={work.coverUrl}
              width={40}
              size="small"
              placeholderIcon={LINKED_ICON[work.contentType] ?? "book-open-variant"}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.workLabel}>{contentTypeLabel(work.contentType).toUpperCase()}</Text>
              <Text style={styles.workTitle} numberOfLines={1}>{work.title}</Text>
              {work.author ? (
                <Text style={styles.workAuthor} numberOfLines={1}>{work.author}</Text>
              ) : null}
            </View>
            <BookOpen color="#74C9A4" size={18} strokeWidth={2.2} />
          </View>
        </Wrap>
      </PressableScale>
    );
  }

  const caption = reel.caption || reel.description;
  if (!caption) return null;
  return (
    <PressableScale onPress={onOpen}>
      <Text numberOfLines={2} style={styles.captionPlain}>{caption}</Text>
    </PressableScale>
  );
}

function DetailSheet({ reel, onClose }: { reel: PublicReel | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  if (!reel) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bgElevated, borderColor: c.border, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.sheetGrabber, { backgroundColor: c.borderStrong }]} />
        <Pressable onPress={onClose} style={[styles.sheetClose, { backgroundColor: c.surface }]} hitSlop={10}>
          <X color={c.text} size={20} />
        </Pressable>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>{reel.title}</Text>
          <Text style={[styles.sheetAuthor, { color: c.primary }]}>
            {reel.creatorName || "AdabiyotX ijodkori"}
            {reel.creatorBadge ? " · Ijodkor" : ""}
          </Text>
          {reel.creatorUsername ? (
            <Text style={[styles.sheetPub, { color: c.textDim }]}>@{reel.creatorUsername}</Text>
          ) : null}
          <Text style={[styles.sheetDesc, { color: c.textDim }]}>
            {reel.description || reel.caption || "Ushbu reels haqida qo'shimcha ma'lumot kiritilmagan."}
          </Text>
          <View style={styles.sheetStats}>
            <SheetStat c={c} label="Like" value={formatCount(reel.likesCount)} />
            <SheetStat c={c} label="Izoh" value={formatCount(reel.commentsCount)} />
            <SheetStat c={c} label="Saqlash" value={formatCount(reel.savesCount)} />
            <SheetStat c={c} label="Ulashish" value={formatCount(reel.sharesCount)} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SheetStat({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <View style={[styles.sheetStat, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <Text style={[styles.sheetStatValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.sheetStatLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const COMMENT_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

/**
 * Instagram-style comment mode. The reel's OWN player (in ReelItem) shrinks to
 * the top and keeps playing seamlessly; this overlay leaves the top area
 * transparent (the video shows through) and renders the comments panel below —
 * likes, nested replies, @mentions, literature attachment and share.
 */
function ReelCommentMode({
  reel,
  currentUserId,
  insets,
  onClose,
  onCountDelta,
}: {
  reel: PublicReel;
  currentUserId: string | null;
  insets: { top: number; bottom: number };
  onClose: () => void;
  onCountDelta: (delta: number) => void;
}) {
  const { colors: c } = useTheme();

  const [comments, setComments] = useState<ReelComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReelComment | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [attachment, setAttachment] = useState<LiteratureSearchItem | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [busyLike, setBusyLike] = useState<string | null>(null);
  const mentionsRef = useRef<MentionPick[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchReelComments(reel.id, currentUserId);
      setComments(rows);
    } catch (err) {
      setComments([]);
      setError(formatReelError(err, "Izohlar yuklanmadi."));
    } finally {
      setLoading(false);
    }
  }, [reel.id, currentUserId]);

  useEffect(() => { load(); }, [load]);

  const onMentionPicked = useCallback((m: MentionPick) => {
    mentionsRef.current = [...mentionsRef.current, m];
  }, []);
  const mention = useMentionAutocomplete(text, setText, onMentionPicked);

  const openProfile = useCallback((userId?: string | null) => {
    if (!userId) return;
    onClose();
    router.push({ pathname: "/u/[id]", params: { id: userId } });
  }, [onClose]);

  const openMention = useCallback(async (handle: string) => {
    const id = await resolveHandleToUserId(handle);
    if (id) { onClose(); router.push({ pathname: "/u/[id]", params: { id } }); }
  }, [onClose]);

  const onToggleLike = useCallback(async (comment: ReelComment) => {
    if (!currentUserId) { setError("Like bosish uchun hisobingizga kiring."); return; }
    if (busyLike) return;
    setBusyLike(comment.id);
    const was = comment.likedByMe;
    setComments((prev) => prev.map((x) => x.id === comment.id ? { ...x, likedByMe: !was, likeCount: Math.max(0, x.likeCount + (was ? -1 : 1)) } : x));
    try {
      await toggleReelCommentLike({ commentId: comment.id, userId: currentUserId, liked: was });
    } catch {
      setComments((prev) => prev.map((x) => x.id === comment.id ? { ...x, likedByMe: was, likeCount: Math.max(0, x.likeCount + (was ? 1 : -1)) } : x));
    } finally {
      setBusyLike(null);
    }
  }, [busyLike, currentUserId]);

  const onShare = useCallback(async (comment: ReelComment) => {
    const link = Linking.createURL("/reels", { queryParams: { reelId: reel.id } });
    try {
      await Share.share({
        message: [`"${comment.content}"`, `— ${comment.authorName ?? "AdabiyotX"}`, link, "AdabiyotX Reels"].filter(Boolean).join("\n"),
        url: link,
      });
    } catch {}
  }, [reel.id]);

  const send = async () => {
    const body = text.trim();
    if ((!body && !attachment) || sending) return;
    if (!currentUserId) { setError("Izoh yozish uchun avval hisobingizga kiring."); return; }
    const finalText = body || (attachment ? attachment.title : "");
    setSending(true);
    setError(null);
    try {
      const created = await addReelComment({
        reelId: reel.id,
        userId: currentUserId,
        content: finalText,
        parentId: replyTarget?.id ?? null,
        attachment: attachment
          ? { contentType: attachment.contentType, contentId: attachment.id, title: attachment.title, coverUrl: attachment.cover, author: attachment.author }
          : null,
      });
      if (created && mentionsRef.current.length > 0) {
        recordMentions({ mentions: mentionsRef.current, actorId: currentUserId, text: finalText, postId: null, commentId: created.id }).catch(() => {});
      }
      setText("");
      setAttachment(null);
      setReplyTarget(null);
      mentionsRef.current = [];
      await load();
      onCountDelta(1);
    } catch (err) {
      setError(formatReelError(err, "Izoh yuborilmadi."));
    } finally {
      setSending(false);
    }
  };

  const topLevel = comments.filter((x) => !x.parentId);
  const repliesByParent = comments.reduce<Record<string, ReelComment[]>>((acc, x) => {
    if (x.parentId) acc[x.parentId] = [...(acc[x.parentId] ?? []), x];
    return acc;
  }, {});

  const topH = Math.round(SCREEN_H * 0.34);

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 40 }]}>
      {/* Transparent area over the reel's own (shrunk) video — blocks feed swipes
          and holds the close button; the video shows through from behind. */}
      <View style={{ height: topH }}>
        <Pressable onPress={onClose} hitSlop={10} style={[styles.commentModeClose, { top: insets.top + 6 }]}>
          <X color="#fff" size={22} />
        </Pressable>
      </View>

      {/* Comments panel */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[styles.commentPanel, { backgroundColor: c.bgElevated }]}>
          <View style={[styles.sheetGrabber, { backgroundColor: c.borderStrong }]} />
          <View style={styles.commentHeader}>
            <Text style={[styles.commentTitle, { color: c.text }]}>Izohlar</Text>
            <Pressable onPress={onClose} style={[styles.commentClose, { backgroundColor: c.surface }]} hitSlop={12}>
              <X color={c.textDim} size={16} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={c.primary} style={{ paddingVertical: 28 }} />
            ) : comments.length === 0 ? (
              <Text style={[styles.commentEmpty, { color: c.textMuted }]}>Hali izoh yo'q. Birinchi bo'lib yozing.</Text>
            ) : (
              topLevel.map((parent) => {
                const replies = repliesByParent[parent.id] ?? [];
                const isOpen = expanded.has(parent.id);
                const shown = isOpen ? replies : replies.slice(0, 2);
                return (
                  <View key={parent.id}>
                    <CommentItem comment={parent} c={c} busyLike={busyLike} onLike={onToggleLike} onReply={setReplyTarget} onProfile={openProfile} onMention={openMention} onShare={onShare} />
                    {shown.map((r) => (
                      <CommentItem key={r.id} comment={r} isReply c={c} busyLike={busyLike} onLike={onToggleLike} onReply={setReplyTarget} onProfile={openProfile} onMention={openMention} onShare={onShare} />
                    ))}
                    {replies.length > 2 && !isOpen ? (
                      <Pressable onPress={() => setExpanded((s) => new Set(s).add(parent.id))} hitSlop={8} style={{ marginLeft: 58, paddingVertical: 6 }}>
                        <Text style={{ color: c.textDim, fontSize: 12.5, fontWeight: "700" }}>
                          — Yana {replies.length - 2} ta javobni ko'rish
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
            <View style={{ height: 12 }} />
          </ScrollView>

          {error ? <Text style={styles.commentError}>{error}</Text> : null}

          {mention.visible ? (
            <View style={{ paddingHorizontal: 14 }}>
              <MentionSuggestionList results={mention.results} loading={mention.loading} onPick={mention.pick} />
            </View>
          ) : null}

          {attachment ? (
            <View style={[styles.attachChip, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              {attachment.cover ? (
                <Image source={{ uri: attachment.cover }} style={{ width: 30, height: 42, borderRadius: 6 }} contentFit="cover" />
              ) : (
                <View style={{ width: 30, height: 42, borderRadius: 6, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}>
                  <BookOpen color={c.primary} size={15} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.primary, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 }}>{TOP_KIND_LABELS[attachment.kind]?.toUpperCase() ?? "ADABIYOT"}</Text>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, fontWeight: "700", marginTop: 1 }}>{attachment.title}</Text>
              </View>
              <Pressable onPress={() => setAttachment(null)} hitSlop={8}><X color={c.textMuted} size={16} /></Pressable>
            </View>
          ) : null}

          {replyTarget ? (
            <View style={styles.replyBar}>
              <Text style={{ flex: 1, color: c.primary, fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>
                @{replyTarget.authorUsername || replyTarget.authorName || "foydalanuvchi"} ga javob
              </Text>
              <Pressable onPress={() => setReplyTarget(null)} hitSlop={10}><X color={c.textMuted} size={14} /></Pressable>
            </View>
          ) : null}

          {/* Emoji quick row */}
          <View style={styles.emojiRow}>
            {COMMENT_EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => setText((t) => t + e)} hitSlop={6}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          {/* Input bar */}
          <View style={[styles.commentInputBar, { borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 6) + 6 }]}>
            <View style={[styles.inputWrap, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                onSelectionChange={mention.onSelectionChange}
                placeholder={
                  !currentUserId
                    ? "Kirish talab qilinadi"
                    : replyTarget
                    ? `@${replyTarget.authorUsername || replyTarget.authorName || "foydalanuvchi"} ga javob yozing…`
                    : "Izoh yozing…"
                }
                placeholderTextColor={c.textMuted}
                style={[styles.commentInputText, { color: c.text }]}
                multiline
                editable={!!currentUserId && !sending}
              />
              <Pressable onPress={() => setAttachOpen(true)} hitSlop={8} style={{ padding: 4 }}>
                <BookOpen color={c.primary} size={20} />
              </Pressable>
            </View>
            <Pressable
              onPress={send}
              disabled={!currentUserId || (text.trim().length < 1 && !attachment) || sending}
              style={[styles.publishBtn, (!currentUserId || (text.trim().length < 1 && !attachment) || sending) && styles.disabledBtn]}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={15} />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ReelAttachSheet visible={attachOpen} onClose={() => setAttachOpen(false)} onSelect={setAttachment} c={c} insets={insets} />
    </View>
  );
}

function CommentItem({
  comment,
  isReply,
  c,
  busyLike,
  onLike,
  onReply,
  onProfile,
  onMention,
  onShare,
}: {
  comment: ReelComment;
  isReply?: boolean;
  c: ReturnType<typeof useTheme>["colors"];
  busyLike: string | null;
  onLike: (c: ReelComment) => void;
  onReply: (c: ReelComment) => void;
  onProfile: (userId?: string | null) => void;
  onMention: (handle: string) => void;
  onShare: (c: ReelComment) => void;
}) {
  const name = comment.authorName?.trim() || "AdabiyotX foydalanuvchisi";
  return (
    <View style={[styles.commentRow, isReply ? { marginLeft: 44 } : null]}>
      <Pressable onPress={() => onProfile(comment.userId)} hitSlop={4}>
        <AvatarSmall uri={comment.authorAvatarUrl} name={name} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Pressable onPress={() => onProfile(comment.userId)} hitSlop={4}>
            <Text style={{ color: c.text, fontSize: 13.5, fontWeight: "800" }}>{name}</Text>
          </Pressable>
          {comment.authorBadge !== "none" ? <VerificationBadge verificationType={comment.authorBadge} size="sm" /> : null}
          <Text style={{ color: c.textMuted, fontSize: 11.5 }}>· {relativeTime(new Date(comment.createdAt).getTime())}</Text>
        </View>
        {comment.authorUsername ? (
          <Text style={{ color: c.textMuted, fontSize: 11.5, marginTop: 1 }}>@{comment.authorUsername}</Text>
        ) : null}
        <MentionText text={comment.content} style={{ color: c.textDim, fontSize: 14, lineHeight: 20, marginTop: 3 }} onPressMention={onMention} />
        {comment.linkedContentId ? <CommentAttachmentCard comment={comment} c={c} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 7 }}>
          <Pressable onPress={() => onReply(comment)} hitSlop={6}>
            <Text style={{ color: c.textDim, fontSize: 12.5, fontWeight: "700" }}>Javob berish</Text>
          </Pressable>
          <Pressable onPress={() => onShare(comment)} hitSlop={6}>
            <Text style={{ color: c.textDim, fontSize: 12.5, fontWeight: "700" }}>Ulash</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={() => onLike(comment)} disabled={busyLike === comment.id} hitSlop={8} style={{ alignItems: "center", width: 34, paddingTop: 2 }}>
        <Heart color={comment.likedByMe ? "#F43F5E" : c.textMuted} size={17} fill={comment.likedByMe ? "#F43F5E" : "transparent"} strokeWidth={2.2} />
        {comment.likeCount > 0 ? <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "700", marginTop: 3 }}>{formatCount(comment.likeCount)}</Text> : null}
      </Pressable>
    </View>
  );
}

function CommentAttachmentCard({ comment, c }: { comment: ReelComment; c: ReturnType<typeof useTheme>["colors"] }) {
  if (!comment.linkedContentId) return null;
  const open = () => openContentPreview(comment.linkedContentType, comment.linkedContentId!, { title: comment.linkedContentTitle ?? undefined });
  const label = comment.linkedContentType ? contentTypeLabel(comment.linkedContentType) : "Adabiyot";
  return (
    <PressableScale onPress={open} style={[styles.commentAttachCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      {comment.linkedContentCover ? (
        <Image source={{ uri: comment.linkedContentCover }} style={{ width: 34, height: 48, borderRadius: 6 }} contentFit="cover" />
      ) : (
        <View style={{ width: 34, height: 48, borderRadius: 6, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}>
          <BookOpen color={c.primary} size={16} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.primary, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 }}>{label.toUpperCase()}</Text>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, fontWeight: "800", marginTop: 2 }}>{comment.linkedContentTitle}</Text>
        {comment.linkedContentAuthor ? <Text numberOfLines={1} style={{ color: c.textDim, fontSize: 11, marginTop: 1 }}>{comment.linkedContentAuthor}</Text> : null}
      </View>
      <BookOpen color={c.primary} size={16} />
    </PressableScale>
  );
}

function ReelAttachSheet({
  visible,
  onClose,
  onSelect,
  c,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: LiteratureSearchItem) => void;
  c: ReturnType<typeof useTheme>["colors"];
  insets: { top: number; bottom: number };
}) {
  const [q, setQ] = useState("");
  const { results, loading } = useReelAttachmentSearch(q);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetKeyboard}>
          <View style={[styles.attachSheet, { backgroundColor: c.bgElevated, paddingBottom: Math.max(insets.bottom, 6) + 10 }]}>
            <View style={[styles.sheetGrabber, { backgroundColor: c.borderStrong }]} />
            <View style={styles.commentHeader}>
              <Text style={[styles.commentTitle, { color: c.text }]}>Adabiyot biriktirish</Text>
              <Pressable onPress={onClose} style={[styles.commentClose, { backgroundColor: c.surface }]} hitSlop={12}>
                <X color={c.textDim} size={16} />
              </Pressable>
            </View>
            <View style={[styles.attachSearch, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Kitob, she'r, maqola, ssenariy qidirish…"
                placeholderTextColor={c.textMuted}
                style={{ flex: 1, color: c.text, fontSize: 14.5 }}
                autoFocus
              />
            </View>
            <ScrollView style={{ maxHeight: 380, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {loading && results.length === 0 ? (
                <ActivityIndicator color={c.primary} style={{ paddingVertical: 24 }} />
              ) : results.length === 0 ? (
                <Text style={{ color: c.textMuted, fontSize: 14, textAlign: "center", paddingVertical: 28 }}>
                  {q.trim() ? "Hech narsa topilmadi" : "Qidirish uchun yozing"}
                </Text>
              ) : (
                results.map((item) => (
                  <Pressable key={`${item.contentType}-${item.id}`} onPress={() => { onSelect(item); onClose(); }} style={styles.attachRow}>
                    {item.cover ? (
                      <Image source={{ uri: item.cover }} style={{ width: 40, height: 56, borderRadius: 7 }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 40, height: 56, borderRadius: 7, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}>
                        <BookOpen color={c.primary} size={18} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.primary, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 }}>{TOP_KIND_LABELS[item.kind]?.toUpperCase() ?? "ADABIYOT"}</Text>
                      <Text numberOfLines={1} style={{ color: c.text, fontSize: 14.5, fontWeight: "700", marginTop: 2 }}>{item.title}</Text>
                      {item.author ? <Text numberOfLines={1} style={{ color: c.textDim, fontSize: 12, marginTop: 1 }}>{item.author}</Text> : null}
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Owner-only edit sheet (from the "..." button). Edits metadata ONLY — title,
 * caption, description, attached adabiyot and thumbnail. The video, status and
 * moderation fields are never touched (updateReelMetadata is scoped to the owner).
 */
function ReelOwnerEditSheet({
  reel,
  currentUserId,
  insets,
  onClose,
  onUpdated,
}: {
  reel: PublicReel;
  currentUserId: string | null;
  insets: { top: number; bottom: number };
  onClose: () => void;
  onUpdated: (patch: Partial<PublicReel>) => void;
}) {
  const { colors: c } = useTheme();
  const [title, setTitle] = useState(reel.title ?? "");
  const [caption, setCaption] = useState(reel.caption ?? "");
  const [description, setDescription] = useState(reel.description ?? "");
  const [attachment, setAttachment] = useState<LiteratureSearchItem | null>(
    reel.linkedContentId
      ? {
          id: reel.linkedContentId,
          title: reel.linkedContentTitle ?? "Adabiyot",
          author: null,
          cover: null,
          kind: normalizeKind(reel.linkedContentType ?? "material"),
          contentType: reel.linkedContentType ?? "material",
        }
      : null
  );
  const [thumbAsset, setThumbAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [attachSearchOpen, setAttachSearchOpen] = useState(false);
  const [attachQuery, setAttachQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results: attachResults, loading: attachLoading } = useReelAttachmentSearch(attachQuery);

  const pickThumb = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Media kutubxonaga ruxsat berilmadi."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.85 });
    if (res.canceled || !res.assets[0]) return;
    setThumbAsset(res.assets[0]);
    setError(null);
  };

  const save = async () => {
    if (!currentUserId || saving) return;
    if (title.trim().length < 2) { setError("Sarlavha juda qisqa."); return; }
    setSaving(true);
    setError(null);
    try {
      let thumbnailUrl: string | undefined;
      if (thumbAsset) {
        thumbnailUrl = await uploadReelThumbnail({ uri: thumbAsset.uri, fileName: thumbAsset.fileName, mimeType: thumbAsset.mimeType }, currentUserId);
      }
      const fields: ReelMetadataUpdate = {
        title: title.trim(),
        caption: caption.trim() || null,
        description: description.trim() || null,
        linkedContentType: attachment?.contentType ?? null,
        linkedContentId: attachment?.id ?? null,
        linkedContentTitle: attachment?.title ?? null,
        ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
      };
      await updateReelMetadata({ reelId: reel.id, userId: currentUserId, fields });
      onUpdated({
        title: fields.title,
        caption: fields.caption ?? null,
        description: fields.description ?? null,
        linkedContentId: attachment?.id ?? null,
        linkedContentType: attachment?.contentType ?? null,
        linkedContentTitle: attachment?.title ?? null,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      });
      onClose();
    } catch (err) {
      setError(formatReelError(err, "Saqlanmadi. Qayta urinib ko'ring."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetKeyboard}>
          <View style={[styles.attachSheet, { backgroundColor: c.bgElevated, paddingBottom: Math.max(insets.bottom, 6) + 10 }]}>
            <View style={[styles.sheetGrabber, { backgroundColor: c.borderStrong }]} />
            <View style={styles.commentHeader}>
              <Text style={[styles.commentTitle, { color: c.text }]}>Reelsni tahrirlash</Text>
              <Pressable onPress={onClose} style={[styles.commentClose, { backgroundColor: c.surface }]} hitSlop={12}>
                <X color={c.textDim} size={16} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: SCREEN_H * 0.58, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.editLabel}>Sarlavha</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder="Reels sarlavhasi" placeholderTextColor={c.textMuted} style={[styles.editInput, { color: c.text, backgroundColor: c.bgCard, borderColor: c.border }]} maxLength={120} />

              <Text style={styles.editLabel}>Izoh (caption)</Text>
              <TextInput value={caption} onChangeText={setCaption} placeholder="Qisqa izoh" placeholderTextColor={c.textMuted} style={[styles.editInput, { color: c.text, backgroundColor: c.bgCard, borderColor: c.border }]} maxLength={240} />

              <Text style={styles.editLabel}>Tavsif</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="Batafsil tavsif" placeholderTextColor={c.textMuted} style={[styles.editInput, { color: c.text, backgroundColor: c.bgCard, borderColor: c.border, minHeight: 84, textAlignVertical: "top" }]} multiline maxLength={800} />

              <Text style={styles.editLabel}>Adabiyot biriktirish — ixtiyoriy</Text>
              {attachment ? (
                <View style={[styles.editAttachRow, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                  <BookOpen color={c.primary} size={18} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: c.text, fontSize: 13.5, fontWeight: "700" }}>{attachment.title}</Text>
                    <Text style={{ color: c.textMuted, fontSize: 11 }}>{TOP_KIND_LABELS[attachment.kind] ?? "Adabiyot"}</Text>
                  </View>
                  <Pressable onPress={() => { setAttachment(null); setAttachSearchOpen(true); }} hitSlop={6}>
                    <Text style={{ color: c.primary, fontSize: 12.5, fontWeight: "700" }}>O'zgartirish</Text>
                  </Pressable>
                  <Pressable onPress={() => setAttachment(null)} hitSlop={6}><X color={c.textMuted} size={16} /></Pressable>
                </View>
              ) : attachSearchOpen ? (
                <>
                  <View style={[styles.attachSearch, { backgroundColor: c.bgCard, borderColor: c.border, marginHorizontal: 0 }]}>
                    <TextInput value={attachQuery} onChangeText={setAttachQuery} placeholder="Kitob, she'r, maqola qidirish…" placeholderTextColor={c.textMuted} style={{ flex: 1, color: c.text, fontSize: 14 }} autoFocus />
                  </View>
                  {attachLoading && attachResults.length === 0 ? (
                    <ActivityIndicator color={c.primary} style={{ paddingVertical: 14 }} />
                  ) : (
                    attachResults.slice(0, 8).map((item) => (
                      <Pressable key={`${item.contentType}-${item.id}`} onPress={() => { setAttachment(item); setAttachSearchOpen(false); }} style={styles.attachRow}>
                        {item.cover ? (
                          <Image source={{ uri: item.cover }} style={{ width: 36, height: 50, borderRadius: 6 }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 36, height: 50, borderRadius: 6, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}>
                            <BookOpen color={c.primary} size={16} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ color: c.text, fontSize: 14, fontWeight: "700" }}>{item.title}</Text>
                          <Text style={{ color: c.textMuted, fontSize: 11.5 }}>{TOP_KIND_LABELS[item.kind] ?? "Adabiyot"}{item.author ? ` · ${item.author}` : ""}</Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </>
              ) : (
                <PressableScale onPress={() => setAttachSearchOpen(true)} style={[styles.editPickBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                  <BookOpen color={c.primary} size={18} />
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>Adabiyot biriktirish</Text>
                </PressableScale>
              )}

              <Text style={styles.editLabel}>Muqova (thumbnail)</Text>
              <PressableScale onPress={pickThumb} style={[styles.editPickBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                {thumbAsset || reel.thumbnailUrl ? (
                  <Image source={{ uri: thumbAsset?.uri ?? reel.thumbnailUrl ?? undefined }} style={{ width: 34, height: 48, borderRadius: 6 }} contentFit="cover" />
                ) : (
                  <Upload color={c.primary} size={18} />
                )}
                <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>{thumbAsset ? "Yangi muqova tanlandi" : "Muqova o'zgartirish"}</Text>
              </PressableScale>

              {error ? <Text style={{ color: "#FCA5A5", fontSize: 12.5, fontWeight: "700", marginTop: 12 }}>{error}</Text> : null}
              <View style={{ height: 10 }} />
            </ScrollView>

            <View style={styles.editActions}>
              <Pressable onPress={onClose} style={[styles.editCancel, { borderColor: c.border }]}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: "800" }}>Bekor qilish</Text>
              </Pressable>
              <Pressable onPress={save} disabled={saving} style={[styles.editSave, saving && styles.disabledBtn]}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>Saqlash</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function AvatarSmall({ uri, name }: { uri: string | null; name: string }) {
  if (uri) return <Image source={{ uri }} style={styles.commentAvatar} contentFit="cover" />;
  return (
    <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
      <Text style={styles.commentAvatarInitial}>{name.trim().charAt(0).toUpperCase() || "A"}</Text>
    </View>
  );
}

function UploadReelSheet({
  visible,
  profileId,
  authorId,
  onClose,
}: {
  visible: boolean;
  profileId: string | null;
  authorId: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnail, setThumbnail] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
  }, [visible]);

  const pickAsset = async (kind: "video" | "thumbnail") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Media kutubxonaga ruxsat berilmadi.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "video" ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: kind === "thumbnail",
      quality: kind === "thumbnail" ? 0.85 : 1,
    });
    if (result.canceled || !result.assets[0]) return;
    if (kind === "video") setVideo(result.assets[0]);
    else setThumbnail(result.assets[0]);
    setError(null);
  };

  const resetForm = () => {
    setVideo(null);
    setThumbnail(null);
    setTitle("");
    setCaption("");
    setDescription("");
    setSubmitting(false);
    setSuccess(false);
    setError(null);
  };

  const close = () => {
    resetForm();
    onClose();
  };

  const submit = async () => {
    if (!profileId) {
      setError("Reels yuborish uchun avval hisobingizga kiring.");
      return;
    }
    if (!video || title.trim().length < 2 || submitting) return;
    setSubmitting(true);
    setError(null);
    const toAsset = (asset: ImagePicker.ImagePickerAsset): ReelUploadAsset => ({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
    try {
      const inserted = await submitReel({
        userId: profileId,
        authorId,
        title: title.trim(),
        caption: caption.trim(),
        description: description.trim(),
        video: toAsset(video),
        thumbnail: thumbnail ? toAsset(thumbnail) : null,
      });
      if (__DEV__) console.log("[reels] upload sheet submitted row id", inserted.id);
      setSuccess(true);
      setTitle("");
      setCaption("");
      setDescription("");
      setVideo(null);
      setThumbnail(null);
    } catch (err) {
      console.error("[reels] upload sheet submit failed:", err);
      setError(formatReelError(err, "Reels yuborilmadi."));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!video && title.trim().length >= 2 && !submitting;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.sheetOverlay} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.uploadKeyboard}>
        <View style={[styles.uploadSheet, { backgroundColor: c.bgElevated, borderColor: c.border, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.sheetGrabber, { backgroundColor: c.borderStrong }]} />
          <View style={styles.commentHeader}>
            <Text style={[styles.commentTitle, { color: c.text }]}>Reels yuborish</Text>
            <Pressable onPress={close} style={[styles.commentClose, { backgroundColor: c.surface }]} hitSlop={12}>
              <X color={c.textDim} size={16} />
            </Pressable>
          </View>
          {success ? (
            <View style={styles.uploadSuccess}>
              <CheckCircle2 color="#52B788" size={42} strokeWidth={2} />
              <Text style={[styles.uploadSuccessTitle, { color: c.text }]}>Reels AdabiyotX tasdig‘iga yuborildi</Text>
              <PressableScale onPress={() => setSuccess(false)} style={styles.uploadAgainBtn}>
                <Text style={styles.uploadAgainText}>Yana yuborish</Text>
              </PressableScale>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <FieldLabel c={c} text="Video file *" />
              <PressableScale onPress={() => pickAsset("video")} style={[styles.filePick, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                <Upload color={video ? "#52B788" : c.textMuted} size={19} />
                <Text style={[styles.filePickText, { color: video ? c.text : c.textMuted }]} numberOfLines={1}>
                  {video?.fileName || (video ? "Video tanlandi" : "Video tanlash")}
                </Text>
              </PressableScale>

              <FieldLabel c={c} text="Title *" />
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Reels sarlavhasi"
                placeholderTextColor={c.textMuted}
                style={[styles.uploadInput, { color: c.text, backgroundColor: c.bgCard, borderColor: c.border }]}
                maxLength={120}
              />

              <FieldLabel c={c} text="Caption" />
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Qisqa caption"
                placeholderTextColor={c.textMuted}
                style={[styles.uploadInput, { color: c.text, backgroundColor: c.bgCard, borderColor: c.border }]}
                maxLength={240}
              />

              <FieldLabel c={c} text="Description" />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Batafsil tavsif"
                placeholderTextColor={c.textMuted}
                style={[styles.uploadInput, styles.uploadMultiline, { color: c.text, backgroundColor: c.bgCard, borderColor: c.border }]}
                multiline
                textAlignVertical="top"
                maxLength={800}
              />

              <FieldLabel c={c} text="Thumbnail optional" />
              <PressableScale onPress={() => pickAsset("thumbnail")} style={[styles.filePick, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                <Upload color={thumbnail ? "#52B788" : c.textMuted} size={19} />
                <Text style={[styles.filePickText, { color: thumbnail ? c.text : c.textMuted }]} numberOfLines={1}>
                  {thumbnail?.fileName || (thumbnail ? "Thumbnail tanlandi" : "Thumbnail tanlash")}
                </Text>
              </PressableScale>

              {error ? <Text style={styles.uploadError}>{error}</Text> : null}

              <PressableScale onPress={canSubmit ? submit : undefined} style={canSubmit ? styles.submitBtn : [styles.submitBtn, styles.submitBtnDisabled]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Upload color="#fff" size={16} strokeWidth={2.4} />
                    <Text style={styles.submitBtnText}>Yuborish</Text>
                  </>
                )}
              </PressableScale>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ text, c }: { text: string; c: ReturnType<typeof useTheme>["colors"] }) {
  return <Text style={[styles.fieldLabel, { color: c.text }]}>{text}</Text>;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
  return String(value);
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / (1000 * 60));
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
    paddingHorizontal: 16,
  },
  topTitle: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  topTabs: { flexDirection: "row", gap: 18, marginTop: 6 },
  topTab: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
  topTabActive: {
    color: "#fff",
    textDecorationLine: "underline",
    textDecorationColor: "#52B788",
  },
  feedStatus: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 28,
  },
  feedStatusText: { color: "#fff", fontSize: 16, fontWeight: "800", textAlign: "center" },
  feedError: {
    position: "absolute",
    left: 18,
    right: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.78)",
    zIndex: 6,
  },
  feedErrorText: { color: "#fff", fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  rightCol: {
    position: "absolute",
    right: 10,
    alignItems: "center",
    gap: 14,
  },
  actionBtn: { alignItems: "center", width: 52 },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  actionText: { color: "#fff", fontSize: 10.5, marginTop: 5, fontWeight: "700" },
  burstWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  holdBadge: {
    position: "absolute",
    top: "8%",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    zIndex: 6,
  },
  holdBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  pausedCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  workCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  workInner: { flexDirection: "row", alignItems: "center", gap: 11, padding: 9 },
  workLabel: { color: "#74C9A4", fontSize: 9.5, fontWeight: "800", letterSpacing: 1.4 },
  workTitle: { color: "#fff", fontSize: 13.5, fontWeight: "800", marginTop: 2 },
  workAuthor: { color: "rgba(255,255,255,0.66)", fontSize: 11.5, fontWeight: "600", marginTop: 1 },
  captionPlain: { color: "rgba(255,255,255,0.9)", fontSize: 12.5, lineHeight: 18, marginTop: 12, fontWeight: "500" },
  leftCol: { position: "absolute", left: 16, right: 90 },
  authorRow: { flexDirection: "row", alignItems: "center" },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: "#52B788",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  authorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  authorAvatarInitial: { color: "#fff", fontSize: 15, fontWeight: "900" },
  creatorNameRow: { flexDirection: "row", alignItems: "center", gap: 7, minWidth: 0 },
  authorName: { color: "#fff", fontSize: 14, fontWeight: "800", maxWidth: "70%" },
  creatorHandle: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "700", marginTop: 2 },
  creatorBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(82,183,136,0.18)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.45)",
  },
  creatorBadgeText: { color: "#8DE0B5", fontSize: 10, fontWeight: "900" },
  reelTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: FONT.serif,
    marginTop: 14,
    letterSpacing: -0.3,
  },
  aboutCard: {
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  aboutInner: { padding: 12 },
  aboutLabel: {
    color: "#74C9A4",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 4,
  },
  aboutDesc: { color: "#fff", fontSize: 12, lineHeight: 18 },
  batafsilBtn: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "rgba(46,125,50,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(102,187,106,0.34)",
  },
  batafsilText: { color: "#74C9A4", fontSize: 12, fontWeight: "700" },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "82%",
    borderTopWidth: 1,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  sheetClose: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  sheetTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: FONT.serif,
    letterSpacing: -0.3,
  },
  sheetAuthor: { fontSize: 14, fontWeight: "700", marginTop: 6 },
  sheetPub: { fontSize: 12, marginTop: 4 },
  sheetDesc: { fontSize: 14, lineHeight: 22, marginTop: 14 },
  sheetStats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  sheetStat: { width: "48%", borderWidth: 1, borderRadius: 12, padding: 12 },
  sheetStatValue: { fontSize: 18, fontWeight: "900" },
  sheetStatLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheetDismiss: { ...StyleSheet.absoluteFillObject },
  sheetKeyboard: { justifyContent: "flex-end", flex: 1 },
  commentSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: "84%",
    overflow: "hidden",
  },
  commentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  commentTitle: { fontSize: 18, fontWeight: "900", fontFamily: FONT.serif },
  commentClose: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  commentPreview: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  commentPreviewTitle: { fontSize: 14, fontWeight: "900" },
  commentPreviewCaption: { fontSize: 12.5, lineHeight: 18, marginTop: 3, fontWeight: "600" },
  commentList: { maxHeight: 340, paddingHorizontal: 16, paddingTop: 12 },
  commentEmpty: { fontSize: 14, textAlign: "center", paddingVertical: 28 },
  commentRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(82,183,136,0.14)" },
  commentAvatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(82,183,136,0.32)" },
  commentAvatarInitial: { color: "#52B788", fontSize: 13, fontWeight: "900" },
  commentBubble: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  commentAuthor: { fontSize: 13, fontWeight: "900" },
  commentText: { fontSize: 14, lineHeight: 20, marginTop: 3, fontWeight: "500" },
  commentTs: { fontSize: 11, marginTop: 5, fontWeight: "600" },
  commentError: { color: "#FCA5A5", fontSize: 12.5, fontWeight: "700", paddingHorizontal: 16, paddingTop: 6 },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  commentInputBar: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 14, paddingTop: 8, borderTopWidth: 1 },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 108,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  publishBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#52B788", alignItems: "center", justifyContent: "center" },
  disabledBtn: { opacity: 0.45 },
  commentModeClose: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  commentPanel: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    overflow: "hidden",
  },
  commentAttachCard: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  attachChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 14,
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  commentInputText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "500",
    padding: 0,
    maxHeight: 96,
  },
  attachSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: "80%",
    overflow: "hidden",
  },
  attachSearch: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  ownerBtn: {
    position: "absolute",
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    zIndex: 6,
  },
  editLabel: { color: "#8a94a0", fontSize: 12.5, fontWeight: "800", marginTop: 14, marginBottom: 7 },
  editInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    fontWeight: "500",
  },
  editAttachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
  },
  editPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  editActions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  editCancel: { flex: 1, height: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  editSave: { flex: 1.4, height: 50, borderRadius: 15, backgroundColor: "#52B788", alignItems: "center", justifyContent: "center" },
  uploadKeyboard: { flex: 1, justifyContent: "flex-end" },
  uploadSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 18,
    maxHeight: "88%",
    borderTopWidth: 1,
  },
  uploadSuccess: { alignItems: "center", paddingVertical: 34, gap: 14 },
  uploadSuccessTitle: { fontSize: 18, lineHeight: 24, textAlign: "center", fontWeight: "900" },
  uploadAgainBtn: { backgroundColor: "#52B788", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4 },
  uploadAgainText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  fieldLabel: { fontSize: 13, fontWeight: "800", marginTop: 14, marginBottom: 8 },
  filePick: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  filePickText: { flex: 1, fontSize: 14, fontWeight: "700" },
  uploadInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    fontWeight: "600",
  },
  uploadMultiline: { height: 96, paddingTop: 12 },
  uploadError: { color: "#FCA5A5", fontSize: 12.5, fontWeight: "700", marginTop: 12 },
  submitBtn: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#52B788",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
