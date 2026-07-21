import { Image } from "expo-image";
import { router } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useTokchaBanners } from "@/hooks/useTokchaBanners";
import type { MobileTokchaBanner } from "@/types/banner";
import { isSafeExternalUrl, isSafeInternalRoute, openExternalUrl } from "@/utils/safeLinks";

const PAGE_PADDING = 20;
const AUTO_SLIDE_MS = 4000;
const BANNER_RADIUS = 20;
const DEFAULT_GLOW_PRIMARY = "#2E7D32";

function normalizeTarget(value: string | null | undefined): string | null {
  const target = value?.trim();
  return target ? target : null;
}

function getAnchorLink(banner: MobileTokchaBanner): string | null {
  return normalizeTarget(banner.anchor_link);
}

function canPressBanner(banner: MobileTokchaBanner): boolean {
  const anchor = getAnchorLink(banner);
  return isSafeInternalRoute(anchor) || isSafeExternalUrl(anchor);
}

function handleBannerPress(banner: MobileTokchaBanner) {
  const anchor = getAnchorLink(banner);
  if (!anchor) return;

  // Internal Expo Router path → navigate in-app; external https → open browser.
  // Anything else (javascript:, data:, protocol-relative, bare text) is ignored.
  if (isSafeInternalRoute(anchor)) {
    try {
      router.push(anchor as any);
    } catch {
      // Ignore malformed routes rather than crashing the home screen.
    }
    return;
  }

  if (isSafeExternalUrl(anchor)) {
    void openExternalUrl(anchor);
  }
}

const BannerCard = memo(function BannerCard({
  item,
  width,
  height,
}: {
  item: MobileTokchaBanner;
  width: number;
  height: number;
}) {
  const imageUrl = normalizeTarget(item.image_url);
  if (!imageUrl) return null;

  const isPressable = canPressBanner(item);

  return (
    <Pressable
      accessibilityRole={isPressable ? "button" : undefined}
      disabled={!isPressable}
      onPress={isPressable ? () => handleBannerPress(item) : undefined}
      style={[styles.cardPressable, { width, height }]}
    >
      <Image
        source={{ uri: imageUrl }}
        style={styles.bannerImage}
        contentFit="cover"
        transition={220}
      />
    </Pressable>
  );
});

function BannerSkeleton({ width, height }: { width: number; height: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.82],
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.skeleton, { width, height, opacity }]} />
    </View>
  );
}

function PaginationDot({ active }: { active: boolean }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [7, 22],
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width,
          backgroundColor: active ? DEFAULT_GLOW_PRIMARY : "rgba(46,125,50,0.22)",
        },
      ]}
    />
  );
}

export default function TokchaBannerCarousel({
  onCategoryPress,
}: {
  onCategoryPress?: (category: string) => void;
}) {
  void onCategoryPress;

  const { width: screenWidth } = useWindowDimensions();
  const { banners, loading } = useTokchaBanners();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<MobileTokchaBanner>>(null);
  const activeIndexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cardWidth = Math.max(0, screenWidth - PAGE_PADDING * 2);
  const cardHeight = cardWidth / 4;

  const displayBanners = useMemo(
    () => banners.filter((banner) => !!normalizeTarget(banner.image_url)),
    [banners]
  );

  const displayBannersRef = useRef(displayBanners);
  displayBannersRef.current = displayBanners;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const goToIndex = useCallback((index: number, animated = true) => {
    const count = displayBannersRef.current.length;
    if (count === 0) return;

    const nextIndex = Math.max(0, Math.min(index, count - 1));
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);

    try {
      listRef.current?.scrollToIndex({ index: nextIndex, animated });
    } catch {
      listRef.current?.scrollToOffset({ offset: nextIndex * screenWidth, animated });
    }
  }, [screenWidth]);

  const startTimer = useCallback(() => {
    clearTimer();
    if (displayBannersRef.current.length <= 1) return;

    intervalRef.current = setInterval(() => {
      const count = displayBannersRef.current.length;
      if (count <= 1) return;
      const nextIndex = (activeIndexRef.current + 1) % count;
      goToIndex(nextIndex);
    }, AUTO_SLIDE_MS);
  }, [clearTimer, goToIndex]);

  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    startTimer();

    return clearTimer;
  }, [displayBanners.length, startTimer, clearTimer]);

  const onMomentumScrollEnd = useCallback((event: any) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    const count = displayBannersRef.current.length;
    const clampedIndex = Math.max(0, Math.min(nextIndex, count - 1));

    activeIndexRef.current = clampedIndex;
    setActiveIndex(clampedIndex);
    startTimer();
  }, [screenWidth, startTimer]);

  const renderItem = useCallback(({ item }: { item: MobileTokchaBanner }) => (
    <View style={[styles.page, { width: screenWidth, paddingHorizontal: PAGE_PADDING }]}>
      <BannerCard
        item={item}
        width={cardWidth}
        height={cardHeight}
      />
    </View>
  ), [cardHeight, cardWidth, screenWidth]);

  const keyExtractor = useCallback(
    (item: MobileTokchaBanner, index: number) => item.id || `tokcha-banner-${index}`,
    []
  );

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: screenWidth,
    offset: screenWidth * index,
    index,
  }), [screenWidth]);

  if (loading) {
    return <BannerSkeleton width={cardWidth} height={cardHeight} />;
  }

  if (displayBanners.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={displayBanners}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollBeginDrag={clearTimer}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces={false}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={3}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({ offset: index * screenWidth, animated: true });
        }}
      />

      {displayBanners.length > 1 ? (
        <View style={styles.dotsRow}>
          {displayBanners.map((_, index) => (
            <Pressable
              key={index}
              hitSlop={8}
              onPress={() => {
                goToIndex(index);
                startTimer();
              }}
            >
              <PaginationDot active={activeIndex === index} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  page: {
    alignItems: "center",
  },
  cardPressable: {
    borderRadius: BANNER_RADIUS,
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  skeleton: {
    marginHorizontal: PAGE_PADDING,
    borderRadius: BANNER_RADIUS,
    backgroundColor: "rgba(46,125,50,0.14)",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
});
