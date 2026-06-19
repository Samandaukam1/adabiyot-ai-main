import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  ChevronLeft,
  CornerUpLeft,
  Headphones,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Sparkles,
  Sun,
  Type,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale } from "@/components/ui";
import type { Book, ReaderChapter } from "@/mocks/content";
import type { AudioSessionState, ReaderBookmark } from "@/providers/AppProvider";
import {
  buildReaderPages,
  findPageIndexForAnchor,
  findPageIndexForAudioPosition,
  type ReaderPage,
} from "./pagination";
import PageCurlReader from "./PageCurlReader";

const OUTER_GUTTER = 14;
const PAGE_INNER_PADDING = 32;
const BASE_FONT_SIZE = 18;
const CONTROL_HIDE_DELAY = 3200;
const ENABLE_SKIA_PAGE_CURL = true;

const READER_THEMES = {
  cream: {
    appBackground: "#F5F1EA",
    appTint: "#EEE6D8",
    paper: "#FFFDF7",
    paperShade: "#F7F0E4",
    paperEdge: "#E8DECF",
    text: "#111111",
    textSecondary: "#666666",
    textMuted: "#8A8377",
    accent: "#2E7D32",
    accentSoft: "#E8F5E9",
    border: "rgba(17,17,17,0.08)",
    chrome: "rgba(255,253,247,0.94)",
    chromeBorder: "rgba(46,125,50,0.12)",
    shadow: "rgba(40,24,12,0.14)",
    foldShadow: "rgba(22,16,10,0.24)",
    backTint: "rgba(96,74,42,0.11)",
  },
  soft: {
    appBackground: "#F7F5F0",
    appTint: "#F1EEE8",
    paper: "#FFFFFF",
    paperShade: "#F9F8F4",
    paperEdge: "#ECE8E0",
    text: "#121212",
    textSecondary: "#656565",
    textMuted: "#8E8B84",
    accent: "#2E7D32",
    accentSoft: "#EDF6EE",
    border: "rgba(17,17,17,0.08)",
    chrome: "rgba(255,255,255,0.95)",
    chromeBorder: "rgba(46,125,50,0.12)",
    shadow: "rgba(23,20,12,0.13)",
    foldShadow: "rgba(24,20,16,0.2)",
    backTint: "rgba(28,24,18,0.08)",
  },
  amber: {
    appBackground: "#F3EBDD",
    appTint: "#EBDFC9",
    paper: "#FFF7E8",
    paperShade: "#F7E7CB",
    paperEdge: "#E6D2B2",
    text: "#2A1A0F",
    textSecondary: "#7A5E46",
    textMuted: "#9B7E62",
    accent: "#8B5A2B",
    accentSoft: "rgba(139,90,43,0.12)",
    border: "rgba(69,45,24,0.1)",
    chrome: "rgba(255,248,234,0.94)",
    chromeBorder: "rgba(139,90,43,0.16)",
    shadow: "rgba(51,30,10,0.16)",
    foldShadow: "rgba(56,34,12,0.26)",
    backTint: "rgba(97,65,28,0.12)",
  },
} as const;

export type ReaderThemeKey = keyof typeof READER_THEMES;
export type ReaderMode = "curl" | "snap";

interface PremiumBookReaderProps {
  book: Book;
  authorName?: string;
  chapters: ReaderChapter[];
  audioDuration: number;
  fontScale: number;
  lineHeight: number;
  onFontScaleChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  saved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
  audio: AudioSessionState;
  onSaveBookmark: (bookmark: ReaderBookmark | null) => void;
  onStartAudio: (bookId: string, duration: number) => void;
  onToggleAudio: () => void;
  onSetAudioPosition: (position: number) => void;
  onOpenAudio: () => void;
  initialPageIndex?: number;
  readerMode?: ReaderMode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function getPageExcerpt(page: ReaderPage | undefined): string {
  if (!page) return "";
  return page.blocks
    .map((block) => block.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export default function PremiumBookReader({
  book,
  authorName,
  chapters,
  audioDuration,
  fontScale,
  lineHeight,
  onFontScaleChange,
  onLineHeightChange,
  saved,
  onToggleSave,
  onBack,
  audio,
  onSaveBookmark,
  onStartAudio,
  onToggleAudio,
  onSetAudioPosition,
  onOpenAudio,
  initialPageIndex = 0,
  readerMode,
}: PremiumBookReaderProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: windowWidth, height: windowHeight });
  const [pageIndex, setPageIndex] = useState(0);
  const [themeKey, setThemeKey] = useState<ReaderThemeKey>("cream");
  const [showControls, setShowControls] = useState(true);
  const [showTypography, setShowTypography] = useState(false);
  const [showTextTools, setShowTextTools] = useState(false);
  const [textToolExcerpt, setTextToolExcerpt] = useState("");
  const [audioReturnPageIndex, setAudioReturnPageIndex] = useState<number | null>(null);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);
  const paginationKeyRef = useRef("");
  const anchorCharRef = useRef(0);
  const pageIndexRef = useRef(0);
  const fontScaleRef = useRef(fontScale);
  const pagesRef = useRef<ReaderPage[]>([]);
  const animationLockedRef = useRef(false);
  const lastAudioPositionRef = useRef(0);

  const controlsOpacity = useSharedValue(1);
  const progress = useSharedValue(0);
  const directionValue = useSharedValue<1 | -1 | 0>(0);
  const curlTopFlag = useSharedValue(1);
  const pinchPreview = useSharedValue(1);
  const pageIndexShared = useSharedValue(0);
  const pageCountShared = useSharedValue(0);

  const requestedMode = readerMode ?? "curl";
  const resolvedMode: ReaderMode =
    ENABLE_SKIA_PAGE_CURL && requestedMode === "curl"
      ? "curl"
      : "snap";
  const theme = READER_THEMES[themeKey];
  const paperWidth = Math.max(320, viewport.width - OUTER_GUTTER * 2);
  const paperHeight = Math.max(480, viewport.height - OUTER_GUTTER * 2);
  const pageTopPadding = insets.top + 76;
  const pageBottomPadding = insets.bottom + (book.audioAvailable ? 132 : 88);
  const fontSize = BASE_FONT_SIZE * fontScale;

  const pages = useMemo(
    () =>
      buildReaderPages({
        chapters,
        pageWidth: paperWidth,
        pageHeight: paperHeight,
        fontScale,
        lineHeight,
        contentHorizontalPadding: PAGE_INNER_PADDING,
        contentTopPadding: pageTopPadding,
        contentBottomPadding: pageBottomPadding,
      }),
    [chapters, paperWidth, paperHeight, fontScale, lineHeight, pageTopPadding, pageBottomPadding]
  );

  const totalPages = pages.length;
  const currentPage = pages[pageIndex] ?? pages[0];
  const currentExcerpt = useMemo(() => getPageExcerpt(currentPage), [currentPage]);
  const chapterLabel = currentPage?.chapterTitle.replace(/^[IVX]+\.\s*/, "") ?? "";
  const readingProgress = totalPages > 0 ? (pageIndex + 1) / totalPages : 0;
  const audioActive = audio.bookId === book.id;
  const audioProgress = audioActive && audio.duration > 0 ? audio.position / audio.duration : 0;

  useEffect(() => {
    setViewport({ width: windowWidth, height: windowHeight });
  }, [windowWidth, windowHeight]);

  useEffect(() => {
    fontScaleRef.current = fontScale;
  }, [fontScale]);

  useEffect(() => {
    pagesRef.current = pages;
    pageCountShared.value = pages.length;
  }, [pageCountShared, pages]);

  useEffect(() => {
    pageIndexRef.current = pageIndex;
    pageIndexShared.value = pageIndex;
    if (pages[pageIndex]) {
      anchorCharRef.current = pages[pageIndex].startChar;
    }
  }, [pageIndex, pageIndexShared, pages]);

  useEffect(() => {
    const paginationKey = `${Math.round(paperWidth)}:${Math.round(paperHeight)}:${fontScale}:${lineHeight}`;

    if (!pages.length) return;

    if (!hasHydratedRef.current) {
      const safeInitialPage = clamp(initialPageIndex, 0, pages.length - 1);
      setPageIndex(safeInitialPage);
      anchorCharRef.current = pages[safeInitialPage]?.startChar ?? 0;
      paginationKeyRef.current = paginationKey;
      hasHydratedRef.current = true;
      return;
    }

    if (paginationKeyRef.current !== paginationKey) {
      const nextPageIndex = findPageIndexForAnchor(pages, anchorCharRef.current);
      if (nextPageIndex !== pageIndexRef.current) {
        setPageIndex(nextPageIndex);
      }
      paginationKeyRef.current = paginationKey;
      return;
    }

    if (pageIndexRef.current > pages.length - 1) {
      setPageIndex(Math.max(0, pages.length - 1));
    }
  }, [fontScale, initialPageIndex, lineHeight, pages, paperHeight, paperWidth]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const revealControls = useCallback(() => {
    clearHideTimer();
    setShowControls(true);
    controlsOpacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [clearHideTimer, controlsOpacity]);

  const hideControls = useCallback(() => {
    clearHideTimer();
    setShowControls(false);
    controlsOpacity.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [clearHideTimer, controlsOpacity]);

  const scheduleControlsHide = useCallback(() => {
    clearHideTimer();
    if (!showControls || showTypography || showTextTools) return;

    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      controlsOpacity.value = withTiming(0, {
        duration: 180,
        easing: Easing.out(Easing.quad),
      });
    }, CONTROL_HIDE_DELAY);
  }, [clearHideTimer, controlsOpacity, showControls, showTextTools, showTypography]);

  useEffect(() => {
    if (showTypography || showTextTools) {
      revealControls();
      return;
    }

    if (showControls) {
      scheduleControlsHide();
    }

    return clearHideTimer;
  }, [clearHideTimer, revealControls, scheduleControlsHide, showControls, showTextTools, showTypography]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const finishTurn = useCallback(
    (completedDirection: 1 | -1 | 0) => {
      animationLockedRef.current = false;
      directionValue.value = 0;
      progress.value = 0;
      curlTopFlag.value = 1;

      if (completedDirection !== 0) {
        setPageIndex((previousIndex) => {
          const nextIndex = clamp(
            previousIndex + completedDirection,
            0,
            Math.max(0, pagesRef.current.length - 1)
          );
          const nextPage = pagesRef.current[nextIndex];
          if (nextPage) {
            anchorCharRef.current = nextPage.startChar;
          }
          return nextIndex;
        });

        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }

      if (showControls) {
        scheduleControlsHide();
      }
    },
    [curlTopFlag, directionValue, progress, scheduleControlsHide, showControls]
  );

  const animateTurn = useCallback(
    (direction: 1 | -1, shouldComplete: boolean, velocity = 0) => {
      if (animationLockedRef.current) return;
      animationLockedRef.current = true;
      directionValue.value = direction;

      progress.value = withSpring(shouldComplete ? 1 : 0, {
        stiffness: shouldComplete ? 280 : 240,
        damping: shouldComplete ? 26 : 24,
        mass: 0.92,
        overshootClamping: true,
        velocity: Math.abs(velocity) / 1400,
      }, (finished) => {
        if (finished) {
          runOnJS(finishTurn)(shouldComplete ? direction : 0);
        }
      });
    },
    [directionValue, finishTurn, progress]
  );

  const turnPage = useCallback(
    (direction: 1 | -1, velocity = 1200) => {
      const canTurn = direction === 1 ? pageIndexRef.current < pages.length - 1 : pageIndexRef.current > 0;
      if (!canTurn || animationLockedRef.current) return;

      setShowTypography(false);
      setShowTextTools(false);
      clearHideTimer();
      revealControls();
      directionValue.value = direction;
      curlTopFlag.value = 1;
      progress.value = 0.02;
      animateTurn(direction, true, velocity);
    },
    [animateTurn, clearHideTimer, curlTopFlag, directionValue, pages.length, progress, revealControls]
  );

  const toggleReaderControls = useCallback(() => {
    if (showControls) {
      hideControls();
      setShowTypography(false);
      setShowTextTools(false);
      return;
    }

    revealControls();
  }, [hideControls, revealControls, showControls]);

  const handleTapZone = useCallback(
    (x: number) => {
      if (animationLockedRef.current) return;

      if (showTypography || showTextTools) {
        setShowTypography(false);
        setShowTextTools(false);
        revealControls();
        return;
      }

      const leftZone = paperWidth * 0.28;
      const rightZone = paperWidth * 0.72;
      if (x < leftZone) {
        turnPage(-1);
        return;
      }
      if (x > rightZone) {
        turnPage(1);
        return;
      }
      toggleReaderControls();
    },
    [paperWidth, revealControls, showTextTools, showTypography, toggleReaderControls, turnPage]
  );

  const applyPinchScale = useCallback(
    (nextScale: number) => {
      const snapped = roundStep(clamp(nextScale, 0.9, 1.45), 0.02);
      onFontScaleChange(snapped);
      setShowTypography(true);
      revealControls();
    },
    [onFontScaleChange, revealControls]
  );

  const openTextTools = useCallback(() => {
    if (!currentExcerpt) return;
    setTextToolExcerpt(currentExcerpt);
    setShowTextTools(true);
    setShowTypography(false);
    revealControls();
  }, [currentExcerpt, revealControls]);

  const saveCurrentPage = useCallback(() => {
    if (!currentPage) return;
    onSaveBookmark({
      bookId: book.id,
      pageIndex,
      chapterIndex: currentPage.chapterIndex,
    });
    setShowTextTools(false);
    revealControls();
  }, [book.id, currentPage, onSaveBookmark, pageIndex, revealControls]);

  const shareCurrentPage = useCallback(async () => {
    if (!textToolExcerpt) return;
    try {
      await Share.share({
        message: `${textToolExcerpt}\n\n${book.title} — ${authorName ?? "Adabiyot AI"}`,
      });
    } catch {
      // Ignore user-cancelled share actions.
    }
  }, [authorName, book.title, textToolExcerpt]);

  const openAudio = useCallback(() => {
    if (!currentPage) return;

    onSaveBookmark({
      bookId: book.id,
      pageIndex,
      chapterIndex: currentPage.chapterIndex,
    });

    if (!audioActive) {
      onStartAudio(book.id, audioDuration);
    }

    onSetAudioPosition(currentPage.startTime);
    onOpenAudio();
  }, [audioActive, audioDuration, book.id, currentPage, onOpenAudio, onSaveBookmark, onSetAudioPosition, onStartAudio, pageIndex]);

  const toggleAudioPlayback = useCallback(() => {
    if (!currentPage) return;

    if (!audioActive) {
      onStartAudio(book.id, audioDuration);
      onSetAudioPosition(currentPage.startTime);
      return;
    }

    onToggleAudio();
  }, [audioActive, audioDuration, book.id, currentPage, onSetAudioPosition, onStartAudio, onToggleAudio]);

  const returnToReadingPage = useCallback(() => {
    if (audioReturnPageIndex == null) return;
    const target = pages[audioReturnPageIndex];
    if (!target) {
      setAudioReturnPageIndex(null);
      return;
    }

    setPageIndex(audioReturnPageIndex);
    anchorCharRef.current = target.startChar;
    setAudioReturnPageIndex(null);
    if (audio.bookId === book.id) {
      onSetAudioPosition(target.startTime);
    }
    revealControls();
  }, [audio.bookId, audioReturnPageIndex, book.id, onSetAudioPosition, pages, revealControls]);

  useEffect(() => {
    if (!audioActive || !pages.length || animationLockedRef.current) {
      if (!audioActive) {
        lastAudioPositionRef.current = 0;
      }
      return;
    }

    const nextPageIndex = findPageIndexForAudioPosition(pages, audio.position);
    const previousPageIndex = pageIndexRef.current;
    if (nextPageIndex !== previousPageIndex) {
      const jumped =
        Math.abs(nextPageIndex - previousPageIndex) > 1 ||
        Math.abs(audio.position - lastAudioPositionRef.current) > 9;

      if (jumped) {
        setAudioReturnPageIndex(previousPageIndex);
      }

      setPageIndex(nextPageIndex);
      anchorCharRef.current = pages[nextPageIndex]?.startChar ?? anchorCharRef.current;
    }

    lastAudioPositionRef.current = audio.position;
  }, [audio.position, audioActive, pages]);

  const controlsAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: interpolate(controlsOpacity.value, [0, 1], [-8, 0]) }],
  }));

  const bottomControlsAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: interpolate(controlsOpacity.value, [0, 1], [14, 0]) }],
  }));

  const pageStackStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ scale: pinchPreview.value }],
  }));

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(220)
        .onEnd((event, success) => {
          if (!success || directionValue.value !== 0) return;
          runOnJS(handleTapZone)(event.x);
        }),
    [directionValue, handleTapZone]
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(380)
        .maxDistance(12)
        .onStart(() => {
          if (directionValue.value !== 0) return;
          runOnJS(openTextTools)();
        }),
    [directionValue, openTextTools]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(!showTextTools)
        .onBegin(() => {
          runOnJS(clearHideTimer)();
        })
        .onUpdate((event) => {
          pinchPreview.value = clamp(event.scale, 0.94, 1.12);
        })
        .onEnd((event) => {
          pinchPreview.value = withTiming(1, { duration: 180 });
          runOnJS(applyPinchScale)(fontScaleRef.current * event.scale);
        })
        .onFinalize(() => {
          pinchPreview.value = withTiming(1, { duration: 180 });
        }),
    [applyPinchScale, clearHideTimer, pinchPreview, showTextTools]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!showTypography && !showTextTools)
        .activeOffsetX([-10, 10])
        .failOffsetY([-32, 32])
        .onBegin((event) => {
          runOnJS(clearHideTimer)();
          curlTopFlag.value = event.y < paperHeight / 2 ? 0 : 1;
        })
        .onUpdate((event) => {
          const nextDirection: 1 | -1 = event.translationX < 0 ? 1 : -1;
          const canTurn = nextDirection === 1
            ? pageIndexShared.value < pageCountShared.value - 1
            : pageIndexShared.value > 0;

          if (!canTurn) {
            progress.value = 0;
            if (directionValue.value !== 0) {
              directionValue.value = 0;
            }
            return;
          }

          if (directionValue.value !== nextDirection) {
            directionValue.value = nextDirection;
          }

          curlTopFlag.value = event.y < paperHeight / 2 ? 0 : 1;

          progress.value = clamp(Math.abs(event.translationX) / (paperWidth * 0.9), 0, 1);
        })
        .onEnd((event) => {
          const nextDirection: 1 | -1 = event.translationX < 0 ? 1 : -1;
          const canTurn = nextDirection === 1
            ? pageIndexShared.value < pageCountShared.value - 1
            : pageIndexShared.value > 0;

          if (!canTurn || directionValue.value === 0) {
            progress.value = withTiming(0, { duration: 160 });
            directionValue.value = 0;
            return;
          }

          const shouldComplete = progress.value > 0.26 || Math.abs(event.velocityX) > 780;
          runOnJS(animateTurn)(nextDirection, shouldComplete, event.velocityX);
        }),
    [
      animateTurn,
      clearHideTimer,
      curlTopFlag,
      directionValue,
      pageCountShared,
      pageIndexShared,
      paperHeight,
      paperWidth,
      progress,
      showTextTools,
      showTypography,
    ]
  );

  const readerGesture = useMemo(
    () => Gesture.Race(pinchGesture, longPressGesture, tapGesture, panGesture),
    [longPressGesture, panGesture, pinchGesture, tapGesture]
  );

  if (!currentPage) {
    return (
      <View style={[styles.emptyState, { backgroundColor: theme.appBackground }]}> 
        <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>Kitob sahifalari tayyorlanmoqda</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.appBackground }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setViewport((previous) => {
          if (Math.abs(previous.width - width) < 2 && Math.abs(previous.height - height) < 2) {
            return previous;
          }
          return { width, height };
        });
      }}
    >
      <LinearGradient
        colors={[theme.appBackground, theme.appTint, theme.appBackground]}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 0.96, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.backgroundOrb, { backgroundColor: theme.accentSoft }]} />

      <View style={styles.readerStage}>
        <GestureDetector gesture={readerGesture}>
          <Animated.View style={[styles.bookShell, { width: paperWidth, height: paperHeight }, pageStackStyle]}>
            <PageCurlReader
              pages={pages}
              currentIndex={pageIndex}
              width={paperWidth}
              height={paperHeight}
              fontSize={fontSize}
              lineHeight={lineHeight}
              topPadding={pageTopPadding}
              bottomPadding={pageBottomPadding}
              mode={resolvedMode}
              theme={theme}
              progress={progress}
              direction={directionValue}
              topFlag={curlTopFlag}
            />
          </Animated.View>
        </GestureDetector>
      </View>

      <View
        style={StyleSheet.absoluteFillObject}
        pointerEvents={showControls ? "box-none" : "none"}
      >
        <ReaderControls
          animatedStyle={controlsAnimatedStyle}
          bottomAnimatedStyle={bottomControlsAnimatedStyle}
          topInset={insets.top}
          bottomInset={insets.bottom + (book.audioAvailable ? 90 : 16)}
          title={book.title}
          authorName={authorName}
          pageIndex={pageIndex}
          totalPages={totalPages}
          chapterLabel={chapterLabel}
          progress={readingProgress}
          theme={theme}
          saved={saved}
          onBack={onBack}
          onToggleSave={onToggleSave}
          onTypography={() => {
            setShowTypography((previous) => !previous);
            setShowTextTools(false);
            revealControls();
          }}
        />
      </View>

      {showTypography ? (
        <TypographyControls
          theme={theme}
          fontScale={fontScale}
          lineHeight={lineHeight}
          bottomOffset={insets.bottom + (book.audioAvailable ? 110 : 28)}
          onClose={() => setShowTypography(false)}
          onDecreaseFont={() => onFontScaleChange(clamp(roundStep(fontScale - 0.06, 0.02), 0.9, 1.45))}
          onIncreaseFont={() => onFontScaleChange(clamp(roundStep(fontScale + 0.06, 0.02), 0.9, 1.45))}
          onDecreaseLineHeight={() => onLineHeightChange(clamp(roundStep(lineHeight - 0.06, 0.02), 1.35, 2.05))}
          onIncreaseLineHeight={() => onLineHeightChange(clamp(roundStep(lineHeight + 0.06, 0.02), 1.35, 2.05))}
          themeKey={themeKey}
          onThemeChange={setThemeKey}
        />
      ) : null}

      {showTextTools ? (
        <TextToolsPopover
          theme={theme}
          excerpt={textToolExcerpt}
          onShare={shareCurrentPage}
          onSave={saveCurrentPage}
          onClose={() => setShowTextTools(false)}
        />
      ) : null}

      {book.audioAvailable ? (
        <ReaderAudioMiniPlayer
          theme={theme}
          title={book.title}
          chapterTitle={chapterLabel}
          playing={audioActive && audio.playing}
          progress={audioProgress}
          position={audioActive ? audio.position : 0}
          duration={audioActive ? audio.duration : audioDuration}
          bottomOffset={insets.bottom}
          showReturnToPage={audioReturnPageIndex != null}
          onReturnToPage={returnToReadingPage}
          onOpenAudio={openAudio}
          onTogglePlay={toggleAudioPlayback}
        />
      ) : null}
    </View>
  );
}

function ReaderControls({
  animatedStyle,
  bottomAnimatedStyle,
  topInset,
  bottomInset,
  title,
  authorName,
  pageIndex,
  totalPages,
  chapterLabel,
  progress,
  theme,
  saved,
  onBack,
  onToggleSave,
  onTypography,
}: {
  animatedStyle: ViewStyle;
  bottomAnimatedStyle: ViewStyle;
  topInset: number;
  bottomInset: number;
  title: string;
  authorName?: string;
  pageIndex: number;
  totalPages: number;
  chapterLabel: string;
  progress: number;
  theme: (typeof READER_THEMES)[ReaderThemeKey];
  saved: boolean;
  onBack: () => void;
  onToggleSave: () => void;
  onTypography: () => void;
}) {
  return (
    <>
      <Animated.View style={[styles.controlsTopWrap, { paddingTop: topInset + 8 }, animatedStyle]}>
        <View style={[styles.controlsCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
          <Pressable onPress={onBack} style={[styles.roundIconButton, { borderColor: theme.chromeBorder }]}> 
            <ChevronLeft color={theme.text} size={20} />
          </Pressable>
          <View style={styles.controlsTitleWrap}>
            <Text style={[styles.controlsKicker, { color: theme.textMuted }]} numberOfLines={1}>
              {(authorName ?? "Adabiyot AI").toUpperCase()}
            </Text>
            <Text style={[styles.controlsTitle, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <View style={styles.controlsActions}>
            <Pressable onPress={onTypography} style={[styles.roundIconButton, { borderColor: theme.chromeBorder }]}>
              <Type color={theme.text} size={18} />
            </Pressable>
            <Pressable onPress={onToggleSave} style={[styles.roundIconButton, { borderColor: theme.chromeBorder }]}>
              <Bookmark color={saved ? theme.accent : theme.text} fill={saved ? theme.accent : "transparent"} size={18} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.controlsBottomWrap, { bottom: bottomInset }, bottomAnimatedStyle]}>
        <View style={[styles.controlsCard, styles.bottomControlsCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
          <View style={styles.progressTopRow}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Sahifa {pageIndex + 1}</Text>
            <Text style={[styles.progressLabel, { color: theme.textMuted }]}>{totalPages}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.paperEdge }]}> 
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.accent }]} />
          </View>
          <View style={styles.progressBottomRow}>
            <Text style={[styles.chapterIndicator, { color: theme.textMuted }]} numberOfLines={1}>
              {chapterLabel}
            </Text>
            <Text style={[styles.progressMeta, { color: theme.textSecondary }]}>
              {pageIndex + 1} / {totalPages}
            </Text>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

function TypographyControls({
  theme,
  fontScale,
  lineHeight,
  bottomOffset,
  onClose,
  onDecreaseFont,
  onIncreaseFont,
  onDecreaseLineHeight,
  onIncreaseLineHeight,
  themeKey,
  onThemeChange,
}: {
  theme: (typeof READER_THEMES)[ReaderThemeKey];
  fontScale: number;
  lineHeight: number;
  bottomOffset: number;
  onClose: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  onDecreaseLineHeight: () => void;
  onIncreaseLineHeight: () => void;
  themeKey: ReaderThemeKey;
  onThemeChange: (value: ReaderThemeKey) => void;
}) {
  return (
    <View style={[styles.panelWrap, { bottom: bottomOffset }]}> 
      <View style={[styles.panel, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
        <View style={styles.panelHeader}>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Tipografiya</Text>
          <Pressable onPress={onClose} style={[styles.roundIconButton, { borderColor: theme.chromeBorder }]}> 
            <Type color={theme.textSecondary} size={16} />
          </Pressable>
        </View>

        <PanelRow
          label="Matn hajmi"
          value={`${Math.round(fontScale * 100)}%`}
          theme={theme}
          onDecrease={onDecreaseFont}
          onIncrease={onIncreaseFont}
        />
        <PanelRow
          label="Qator oralig'i"
          value={lineHeight.toFixed(2)}
          theme={theme}
          onDecrease={onDecreaseLineHeight}
          onIncrease={onIncreaseLineHeight}
        />

        <View style={styles.themeChooser}>
          {([
            ["cream", "Cream", Sun],
            ["soft", "Soft White", Sun],
            ["amber", "Warm Night", Moon],
          ] as const).map(([key, label, Icon]) => {
            const active = themeKey === key;
            const itemTheme = READER_THEMES[key];
            return (
              <Pressable
                key={key}
                onPress={() => onThemeChange(key)}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: itemTheme.paper,
                    borderColor: active ? itemTheme.accent : itemTheme.paperEdge,
                  },
                ]}
              >
                <Icon color={active ? itemTheme.accent : itemTheme.textMuted} size={15} />
                <Text style={[styles.themeChipLabel, { color: itemTheme.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function PanelRow({
  label,
  value,
  theme,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  theme: (typeof READER_THEMES)[ReaderThemeKey];
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.panelRow}>
      <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.panelStepper}>
        <Pressable onPress={onDecrease} style={[styles.stepButton, { borderColor: theme.chromeBorder }]}>
          <Minus color={theme.text} size={16} />
        </Pressable>
        <Text style={[styles.panelValue, { color: theme.text }]}>{value}</Text>
        <Pressable onPress={onIncrease} style={[styles.stepButton, { borderColor: theme.chromeBorder }]}>
          <Plus color={theme.text} size={16} />
        </Pressable>
      </View>
    </View>
  );
}

function ReaderAudioMiniPlayer({
  theme,
  title,
  chapterTitle,
  playing,
  progress,
  position,
  duration,
  bottomOffset,
  showReturnToPage,
  onReturnToPage,
  onOpenAudio,
  onTogglePlay,
}: {
  theme: (typeof READER_THEMES)[ReaderThemeKey];
  title: string;
  chapterTitle: string;
  playing: boolean;
  progress: number;
  position: number;
  duration: number;
  bottomOffset: number;
  showReturnToPage: boolean;
  onReturnToPage: () => void;
  onOpenAudio: () => void;
  onTogglePlay: () => void;
}) {
  return (
    <View style={[styles.audioWrap, { bottom: bottomOffset + 12 }]}> 
      {showReturnToPage ? (
        <PressableScale onPress={onReturnToPage} style={[styles.returnChip, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
          <View style={styles.returnChipInner}>
            <CornerUpLeft color={theme.accent} size={14} />
            <Text style={[styles.returnChipText, { color: theme.text }]}>Oldingi sahifaga qaytish</Text>
          </View>
        </PressableScale>
      ) : null}

      <View style={[styles.audioCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
        <Pressable onPress={onOpenAudio} style={styles.audioMetaArea}>
          <View style={[styles.audioIconWrap, { backgroundColor: theme.accentSoft }]}> 
            <Headphones color={theme.accent} size={18} />
          </View>
          <View style={styles.audioMetaCopy}>
            <Text style={[styles.audioMetaTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.audioMetaChapter, { color: theme.textSecondary }]} numberOfLines={1}>{chapterTitle || "Audio bob"}</Text>
            <View style={[styles.audioProgressTrack, { backgroundColor: theme.paperEdge }]}> 
              <View style={[styles.audioProgressFill, { width: `${progress * 100}%`, backgroundColor: theme.accent }]} />
            </View>
            <View style={styles.audioTimeRow}>
              <Text style={[styles.audioTime, { color: theme.textMuted }]}>{formatTime(position)}</Text>
              <Text style={[styles.audioTime, { color: theme.textMuted }]}>{formatTime(duration)}</Text>
            </View>
          </View>
        </Pressable>

        <Pressable onPress={onTogglePlay} style={[styles.audioPlayButton, { backgroundColor: theme.accent }]}> 
          {playing ? (
            <Pause color="#FFFFFF" size={18} fill="#FFFFFF" />
          ) : (
            <Play color="#FFFFFF" size={18} fill="#FFFFFF" style={{ marginLeft: 2 }} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function TextToolsPopover({
  theme,
  excerpt,
  onShare,
  onSave,
  onClose,
}: {
  theme: (typeof READER_THEMES)[ReaderThemeKey];
  excerpt: string;
  onShare: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.textToolsWrap} pointerEvents="box-none">
      <View style={[styles.textToolsCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
        <View style={styles.textToolsHeader}>
          <View style={[styles.sparkBadge, { backgroundColor: theme.accentSoft }]}> 
            <Sparkles color={theme.accent} size={16} />
          </View>
          <Text style={[styles.textToolsTitle, { color: theme.text }]}>Matn asboblari</Text>
        </View>
        <Text style={[styles.textToolsExcerpt, { color: theme.textSecondary }]} numberOfLines={4}>
          {excerpt}
        </Text>
        <View style={styles.textToolsActions}>
          <PressableScale onPress={onShare} style={[styles.textToolButton, { backgroundColor: theme.accentSoft, borderColor: theme.chromeBorder }]}> 
            <Text style={[styles.textToolButtonLabel, { color: theme.accent }]}>Ulashish</Text>
          </PressableScale>
          <PressableScale onPress={onSave} style={[styles.textToolButton, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
            <Text style={[styles.textToolButtonLabel, { color: theme.text }]}>Belgilash</Text>
          </PressableScale>
          <PressableScale onPress={onClose} style={[styles.textToolButton, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
            <Text style={[styles.textToolButtonLabel, { color: theme.textSecondary }]}>Yopish</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundOrb: {
    position: "absolute",
    top: -90,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.7,
  },
  readerStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: OUTER_GUTTER,
  },
  bookShell: {
    borderRadius: 30,
    overflow: "visible",
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  pageCard: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#1E1610",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  pageSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 18,
    opacity: 0.08,
  },
  pageEdge: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    opacity: 0.6,
  },
  pageContent: {
    flex: 1,
  },
  chapterHeader: {
    marginBottom: 26,
  },
  chapterRule: {
    width: 54,
    height: 2,
    borderRadius: 2,
    marginBottom: 16,
  },
  chapterKicker: {
    fontSize: 11,
    letterSpacing: 4.2,
    fontWeight: "700",
    marginBottom: 8,
  },
  chapterTitle: {
    fontFamily: FONT.serif,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  runningHead: {
    fontSize: 10,
    letterSpacing: 3.4,
    fontWeight: "700",
    marginBottom: 18,
  },
  bodyText: {
    fontFamily: FONT.serif,
    textAlign: Platform.OS === "web" ? "left" : "justify",
  },
  dropCap: {
    fontFamily: FONT.serif,
    fontWeight: "700",
  },
  pageFooter: {
    marginTop: "auto",
    paddingTop: 16,
  },
  footerRule: {
    height: 1,
    borderRadius: 1,
    marginBottom: 10,
    opacity: 0.9,
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 2.2,
    fontWeight: "700",
  },
  turningGradient: {
    borderRadius: 30,
    overflow: "hidden",
  },
  turnShadow: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  edgeHighlight: {
    position: "absolute",
    top: 18,
    bottom: 18,
    borderRadius: 18,
    overflow: "hidden",
  },
  controlsTopWrap: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
  },
  controlsBottomWrap: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  controlsCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#1A1208",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bottomControlsCard: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  roundIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  controlsTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  controlsKicker: {
    fontSize: 9,
    letterSpacing: 2.8,
    fontWeight: "700",
  },
  controlsTitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "700",
  },
  controlsActions: {
    flexDirection: "row",
    gap: 8,
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  chapterIndicator: {
    flex: 1,
    marginRight: 16,
    fontSize: 12,
    fontWeight: "600",
  },
  progressMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  panelWrap: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#1A1208",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  panelLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  panelStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  panelValue: {
    minWidth: 58,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
  },
  themeChooser: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  themeChip: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  themeChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  audioWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    gap: 10,
  },
  returnChip: {
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  returnChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  returnChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  audioCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#1A1208",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  audioMetaArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  audioIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  audioMetaCopy: {
    flex: 1,
  },
  audioMetaTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  audioMetaChapter: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
  },
  audioProgressTrack: {
    height: 3,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 10,
  },
  audioProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  audioTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  audioTime: {
    fontSize: 11,
    fontWeight: "600",
  },
  audioPlayButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  textToolsWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "34%",
  },
  textToolsCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#1A1208",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  textToolsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sparkBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  textToolsTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  textToolsExcerpt: {
    fontSize: 14,
    lineHeight: 22,
  },
  textToolsActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  textToolButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  textToolButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
