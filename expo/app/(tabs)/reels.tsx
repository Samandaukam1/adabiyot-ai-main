import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Play,
  Send,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import {
  getAuthor,
  getBook,
  getBookRoute,
  getPublisher,
  Reel,
  reels,
} from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const itemHeight = SCREEN_H;
  const { reelId } = useLocalSearchParams<{ reelId?: string }>();
  const initialReelIndex = useMemo(
    () => (reelId ? reels.findIndex((item) => item.id === reelId) : 0),
    [reelId]
  );
  const [activeIndex, setActiveIndex] = useState<number>(initialReelIndex >= 0 ? initialReelIndex : 0);
  const [detailReel, setDetailReel] = useState<Reel | null>(null);
  const listRef = useRef<FlatList<Reel>>(null);

  useEffect(() => {
    if (initialReelIndex >= 0) {
      listRef.current?.scrollToIndex({ index: initialReelIndex, animated: false });
      setActiveIndex(initialReelIndex);
    }
  }, [initialReelIndex]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(item) => item.id}
        initialScrollIndex={initialReelIndex >= 0 ? initialReelIndex : 0}
        pagingEnabled
        snapToInterval={itemHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            active={index === activeIndex}
            height={itemHeight}
            onOpenDetails={() => setDetailReel(item)}
          />
        )}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
      />

      <View style={[styles.topBar, { top: insets.top + 6 }]}>
        <Text style={styles.topTitle}>REELS</Text>
        <View style={styles.topTabs}>
          <Text style={[styles.topTab, styles.topTabActive]}>Siz uchun</Text>
          <Text style={styles.topTab}>Premium</Text>
        </View>
      </View>

      <DetailSheet reel={detailReel} onClose={() => setDetailReel(null)} />
    </View>
  );
}

function ReelItem({
  reel,
  active,
  height,
  onOpenDetails,
}: {
  reel: Reel;
  active: boolean;
  height: number;
  onOpenDetails: () => void;
}) {
  const insets = useSafeAreaInsets();
  const author = getAuthor(reel.authorId);
  const publisher = getPublisher(reel.publisherId);
  const {
    likedReelIds,
    savedReelIds,
    followedAuthorIds,
    toggleLikeReel,
    toggleSaveReel,
    toggleFollowAuthor,
  } = useApp();

  const liked = likedReelIds.includes(reel.id);
  const saved = savedReelIds.includes(reel.id);
  const followed = followedAuthorIds.includes(reel.authorId);

  const heartScale = useRef(new Animated.Value(1)).current;

  const player = useVideoPlayer(reel.video, (p) => {
    p.loop = true;
    p.muted = false;
  });

  React.useEffect(() => {
    if (active) {
      try {
        player.play();
      } catch (e) {
        console.log("[reels] play err", e);
      }
    } else {
      try {
        player.pause();
      } catch (e) {
        console.log("[reels] pause err", e);
      }
    }
  }, [active, player]);

  const onLike = useCallback(() => {
    toggleLikeReel(reel.id);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
  }, [reel.id, toggleLikeReel, heartScale]);

  return (
    <View style={{ height, width: SCREEN_W, backgroundColor: "#000" }}>
      <Image source={{ uri: reel.poster }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <VideoView
        style={StyleSheet.absoluteFillObject}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Right actions */}
      <View style={[styles.rightCol, { bottom: insets.bottom + 120 }]}>
        <PressableScale onPress={onLike} style={styles.actionBtn}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Heart
              color={liked ? palette.primary : "#fff"}
              size={30}
              fill={liked ? palette.primary : "transparent"}
              strokeWidth={2}
            />
          </Animated.View>
          <Text style={styles.actionText}>
            {((reel.likes + (liked ? 1 : 0)) / 1000).toFixed(1)}k
          </Text>
        </PressableScale>
        <PressableScale style={styles.actionBtn}>
          <MessageCircle color="#fff" size={28} strokeWidth={2} />
          <Text style={styles.actionText}>{reel.comments}</Text>
        </PressableScale>
        <PressableScale onPress={() => toggleSaveReel(reel.id)} style={styles.actionBtn}>
          <Bookmark
            color={saved ? palette.gold : "#fff"}
            fill={saved ? palette.gold : "transparent"}
            size={28}
            strokeWidth={2}
          />
          <Text style={styles.actionText}>Saqla</Text>
        </PressableScale>
        <PressableScale style={styles.actionBtn}>
          <Send color="#fff" size={28} strokeWidth={2} />
          <Text style={styles.actionText}>Ulash</Text>
        </PressableScale>
      </View>

      {/* Left info */}
      <View style={[styles.leftCol, { bottom: insets.bottom + 110 }]}>
        {/* Publisher badge */}
        {publisher && (
          <Pressable
            onPress={() => router.push(`/publisher/${reel.publisherId}`)}
            style={styles.publisherRow}
          >
            <Image source={{ uri: publisher.logo }} style={styles.publisherLogo} contentFit="cover" />
            <Text style={styles.publisherName}>{publisher.name}</Text>
          </Pressable>
        )}

        <View style={styles.authorRow}>
          <Pressable onPress={() => router.push(`/author/${reel.authorId}`)}>
            <Image source={{ uri: author?.photo }} style={styles.authorAvatar} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.authorName}>{author?.name}</Text>
          </View>
          <PressableScale
            onPress={() => toggleFollowAuthor(reel.authorId)}
            style={[
              styles.followBtn,
              followed ? { backgroundColor: "transparent", borderColor: palette.borderStrong } : {},
            ]}
          >
            <Text style={[styles.followText, followed ? { color: palette.text } : {}]}>
              {followed ? "Obuna" : "Obuna bo'l"}
            </Text>
          </PressableScale>
        </View>

        <Text style={styles.reelTitle}>{reel.title}</Text>

        <GlassAbout reel={reel} onOpen={onOpenDetails} />
      </View>
    </View>
  );
}

function GlassAbout({ reel, onOpen }: { reel: Reel; onOpen: () => void }) {
  const Wrap = Platform.OS === "web" ? View : BlurView;
  const wrapProps =
    Platform.OS === "web"
      ? { style: [styles.aboutCard, { backgroundColor: "rgba(20,20,22,0.75)" }] as any }
      : ({ intensity: 40, tint: "dark", style: styles.aboutCard } as any);
  return (
    <Wrap {...wrapProps}>
      <View style={styles.aboutInner}>
        <Text style={styles.aboutLabel}>HAQIDA</Text>
        <Text numberOfLines={2} style={styles.aboutDesc}>
          {reel.description}
        </Text>
        <PressableScale onPress={onOpen} style={styles.batafsilBtn}>
          <Text style={styles.batafsilText}>Batafsil</Text>
        </PressableScale>
      </View>
    </Wrap>
  );
}

function DetailSheet({ reel, onClose }: { reel: Reel | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!reel) return null;
  const author = getAuthor(reel.authorId);
  const publisher = getPublisher(reel.publisherId);
  const book = reel.relatedBookId ? getBook(reel.relatedBookId) : undefined;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.sheetGrabber} />
        <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={10}>
          <X color={palette.text} size={20} />
        </Pressable>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetTitle}>{reel.title}</Text>
          <Pressable onPress={() => { onClose(); router.push(`/author/${reel.authorId}`); }}>
            <Text style={styles.sheetAuthor}>{author?.name}</Text>
          </Pressable>
          <Text style={styles.sheetPub}>Nashriyot: {publisher?.name}</Text>

          <Text style={styles.sheetDesc}>{reel.fullDescription}</Text>

          {book ? (
            <Pressable
              onPress={() => { onClose(); router.push(getBookRoute(book)); }}
              style={styles.relBook}
            >
              <Image source={{ uri: book.cover }} style={styles.relBookCover} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.relBookLabel}>BOG'LIQ KITOB</Text>
                <Text style={styles.relBookTitle}>{book.title}</Text>
                <Text style={styles.relBookAuthor}>{author?.name}</Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.sheetCTAs}>
            <PressableScale
              onPress={() => {
                if (book) {
                  onClose();
                  router.push(
                    book.category === "She'r"
                      ? `/poem/${book.id}`
                      : book.category === "Ssenariy"
                      ? `/screenplay/${book.id}`
                      : `/reader/${book.id}`
                  );
                }
              }}
              style={[styles.cta, { backgroundColor: palette.primary }]}
            >
              <Text style={styles.ctaText}>O'qish</Text>
            </PressableScale>
            <PressableScale
              onPress={() => { if (book) { onClose(); router.push(getBookRoute(book)); } }}
              style={[styles.cta, { backgroundColor: palette.surface }]}
            >
              <Text style={[styles.ctaText, { color: palette.text }]}>Kitobni sotib olish</Text>
            </PressableScale>
            <PressableScale
              onPress={() => { onClose(); router.push(`/author/${reel.authorId}`); }}
              style={[styles.cta, { backgroundColor: "transparent", borderWidth: 1, borderColor: palette.borderStrong }]}
            >
              <Text style={[styles.ctaText, { color: palette.text }]}>Muallif sahifasi</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
  },
  topTitle: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  topTabs: { flexDirection: "row", gap: 18, marginTop: 6 },
  topTab: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
  topTabActive: {
    color: "#fff",
    textDecorationLine: "underline",
    textDecorationColor: palette.primary,
  },
  rightCol: {
    position: "absolute",
    right: 12,
    alignItems: "center",
    gap: 22,
  },
  actionBtn: { alignItems: "center", width: 54 },
  actionText: { color: "#fff", fontSize: 11, marginTop: 5, fontWeight: "600" },
  leftCol: { position: "absolute", left: 16, right: 90 },
  publisherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  publisherLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  publisherName: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  authorRow: { flexDirection: "row", alignItems: "center" },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: palette.primary,
  },
  authorName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pubName: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 },
  followBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  followText: { color: "#fff", fontSize: 12, fontWeight: "700" },
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
    color: palette.secondary,
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
  batafsilText: { color: palette.secondary, fontSize: 12, fontWeight: "700" },

  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "82%",
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
    marginBottom: 14,
  },
  sheetClose: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  sheetTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: "700",
    fontFamily: FONT.serif,
    letterSpacing: -0.3,
  },
  sheetAuthor: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  sheetPub: { color: palette.textDim, fontSize: 12, marginTop: 4 },
  sheetDesc: { color: palette.textDim, fontSize: 14, lineHeight: 22, marginTop: 14 },
  relBook: {
    flexDirection: "row",
    backgroundColor: palette.bgCard,
    padding: 12,
    borderRadius: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  relBookCover: { width: 56, height: 80, borderRadius: 8 },
  relBookLabel: { color: palette.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  relBookTitle: { color: palette.text, fontSize: 15, fontWeight: "700", marginTop: 4 },
  relBookAuthor: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
  sheetCTAs: { marginTop: 18, gap: 10 },
  cta: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
