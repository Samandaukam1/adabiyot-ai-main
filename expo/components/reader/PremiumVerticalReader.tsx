import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "@/components/ui";
import {
  buildReaderPages,
  findPageIndexForAnchor,
  findPageIndexForAudioPosition,
  type ReaderPage,
} from "./pagination";
import type { ReaderScreenProps } from "./readerTypes";

const OUTER_GUTTER = 16;
const PAGE_GAP = 22;
const PAGE_INNER_PADDING = 34;
const BASE_FONT_SIZE = 18;
const AUTO_LINE_HEIGHT = 1.55;
const RESUME_HINT_DURATION = 2200;

const READER_THEMES = {
  cream: {
    appBackground: "#F5F1EA",
    appTint: "#ECE2D2",
    paper: "#FFFDF7",
    paperShade: "#F7F0E4",
    paperEdge: "#E8DECF",
    text: "#111111",
    textSecondary: "#665F56",
    textMuted: "#8A8377",
    accent: "#2E7D32",
    accentSoft: "rgba(46,125,50,0.12)",
    chrome: "rgba(255,253,247,0.96)",
    chromeBorder: "rgba(46,125,50,0.14)",
    shadow: "rgba(40,24,12,0.14)",
    highlight: "rgba(46,125,50,0.11)",
    highlightBorder: "rgba(46,125,50,0.24)",
    progressTrack: "rgba(53,42,27,0.12)",
    orb: "rgba(224,209,190,0.46)",
  },
  sepia: {
    appBackground: "#F3EBDD",
    appTint: "#E9DDCA",
    paper: "#FFF7E8",
    paperShade: "#F7E7CB",
    paperEdge: "#E6D2B2",
    text: "#2A1A0F",
    textSecondary: "#755944",
    textMuted: "#9A7D63",
    accent: "#8B5A2B",
    accentSoft: "rgba(139,90,43,0.12)",
    chrome: "rgba(255,248,234,0.95)",
    chromeBorder: "rgba(139,90,43,0.16)",
    shadow: "rgba(51,30,10,0.16)",
    highlight: "rgba(139,90,43,0.12)",
    highlightBorder: "rgba(139,90,43,0.24)",
    progressTrack: "rgba(98,71,43,0.14)",
    orb: "rgba(206,169,122,0.36)",
  },
  night: {
    appBackground: "#1B1714",
    appTint: "#241E19",
    paper: "#2B231E",
    paperShade: "#342B24",
    paperEdge: "#4A3D31",
    text: "#F5E8D7",
    textSecondary: "#D4C1AC",
    textMuted: "#B49B81",
    accent: "#D6A25E",
    accentSoft: "rgba(214,162,94,0.14)",
    chrome: "rgba(36,30,25,0.95)",
    chromeBorder: "rgba(214,162,94,0.16)",
    shadow: "rgba(0,0,0,0.35)",
    highlight: "rgba(214,162,94,0.14)",
    highlightBorder: "rgba(214,162,94,0.26)",
    progressTrack: "rgba(245,232,215,0.18)",
    orb: "rgba(102,78,58,0.32)",
  },
} as const;

type ReaderThemeKey = keyof typeof READER_THEMES;
type ReaderFontKey = "serif" | "classic" | "sans";

const READER_FONT_OPTIONS: { key: ReaderFontKey; label: string; family: string }[] = [
  { key: "classic", label: "Klassik", family: FONT.classic },
  { key: "serif", label: "Serif", family: FONT.serif },
  { key: "sans", label: "Sans", family: FONT.sans },
];

const READER_FONT_FAMILY: Record<ReaderFontKey, string> = {
  classic: FONT.classic,
  serif: FONT.serif,
  sans: FONT.sans,
};

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

function getBlockWindows(page: ReaderPage) {
  const duration = Math.max(1, page.endTime - page.startTime);
  const totalCharacters = Math.max(
    1,
    page.blocks.reduce((count, block) => count + Math.max(1, block.text.trim().length), 0)
  );

  let characterCursor = 0;

  return page.blocks.map((block, index) => {
    const blockLength = Math.max(1, block.text.trim().length);
    const startRatio = characterCursor / totalCharacters;
    characterCursor += blockLength;
    const endRatio = index === page.blocks.length - 1 ? 1 : characterCursor / totalCharacters;

    return {
      start: page.startTime + duration * startRatio,
      end: page.startTime + duration * Math.max(endRatio, startRatio + 0.06),
    };
  });
}

function RevealBlock({
  scrollY,
  viewportHeight,
  baseOffsetY,
  lift = 22,
  style,
  children,
}: {
  scrollY: Animated.Value;
  viewportHeight: number;
  baseOffsetY: number;
  lift?: number;
  style?: object;
  children: React.ReactNode;
}) {
  const [localOffsetY, setLocalOffsetY] = useState(0);
  const resolvedOffsetY = baseOffsetY + localOffsetY;
  const revealStart = Math.max(0, resolvedOffsetY - viewportHeight * 0.92);
  const revealReady = Math.max(revealStart + 1, resolvedOffsetY - viewportHeight * 0.48);

  const opacity = scrollY.interpolate({
    inputRange: [revealStart, revealReady, resolvedOffsetY + 40],
    outputRange: [0.12, 1, 1],
    extrapolate: "clamp",
  });

  const translateY = scrollY.interpolate({
    inputRange: [revealStart, revealReady],
    outputRange: [lift, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      onLayout={(event) => {
        setLocalOffsetY(event.nativeEvent.layout.y);
      }}
      style={[style, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

function VerticalPageCard({
  page,
  pageNumber,
  totalPages,
  fontSize,
  lineHeight,
  fontFamily,
  topPadding,
  bottomPadding,
  theme,
  scrollY,
  viewportHeight,
  pageOffsetY,
  audioActive,
  audioPlaying,
  audioPosition,
}: {
  page: ReaderPage;
  pageNumber: number;
  totalPages: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  topPadding: number;
  bottomPadding: number;
  theme: (typeof READER_THEMES)[ReaderThemeKey];
  scrollY: Animated.Value;
  viewportHeight: number;
  pageOffsetY: number;
  audioActive: boolean;
  audioPlaying: boolean;
  audioPosition: number;
}) {
  const blockWindows = useMemo(() => getBlockWindows(page), [page]);

  const paperParallax = scrollY.interpolate({
    inputRange: [Math.max(0, pageOffsetY - viewportHeight), pageOffsetY + viewportHeight],
    outputRange: [18, -18],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[
        styles.pageCard,
        {
          backgroundColor: theme.paper,
          borderColor: theme.paperEdge,
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={[styles.pageBase, { backgroundColor: theme.paper }]} />
      <Animated.View
        style={[
          styles.pageWash,
          {
            backgroundColor: theme.paperShade,
            opacity: theme === READER_THEMES.night ? 0.28 : 0.52,
            transform: [{ translateY: paperParallax }],
          },
        ]}
      />
      <View style={[styles.pageSpine, { backgroundColor: theme.shadow }]} />
      <View style={[styles.pageEdge, { backgroundColor: theme.paperEdge }]} />
      <View style={[styles.pageGlow, { backgroundColor: theme.orb }]} />

      <View style={[styles.pageContent, { paddingHorizontal: PAGE_INNER_PADDING }]}> 
        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          baseOffsetY={pageOffsetY}
          lift={34}
          style={styles.chapterReveal}
        >
          {page.isChapterStart ? (
            <View style={styles.chapterHeader}>
              <View style={[styles.chapterRule, { backgroundColor: theme.accent }]} />
              <Text style={[styles.chapterKicker, { color: theme.accent }]}>BOB {page.chapterIndex + 1}</Text>
              <Text style={[styles.chapterTitle, { color: theme.text, fontSize: fontSize * 1.5 }]}> 
                {page.chapterTitle.replace(/^[IVX]+\.\s*/, "")}
              </Text>
            </View>
          ) : (
            <Text style={[styles.runningHead, { color: theme.textMuted }]}> 
              {page.chapterTitle.toUpperCase()}
            </Text>
          )}
        </RevealBlock>

        {page.blocks.map((block, index) => {
          const timing = blockWindows[index];
          const blockText = block.text.trim();
          const useDropCap = page.isChapterStart && index === 0 && block.startsParagraph;
          const isAudioHighlighted =
            audioActive &&
            audioPlaying &&
            audioPosition >= timing.start &&
            audioPosition < timing.end;

          return (
            <RevealBlock
              key={block.id}
              scrollY={scrollY}
              viewportHeight={viewportHeight}
              baseOffsetY={pageOffsetY}
              style={[
                styles.paragraphWrap,
                {
                  marginBottom: block.endsParagraph ? fontSize * 0.92 : fontSize * 0.52,
                },
                isAudioHighlighted
                  ? {
                      marginHorizontal: -14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 18,
                      backgroundColor: theme.highlight,
                      borderWidth: 1,
                      borderColor: theme.highlightBorder,
                    }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.bodyText,
                  {
                    color: theme.text,
                    fontSize,
                    lineHeight: fontSize * lineHeight,
                    fontFamily,
                    textAlign: Platform.OS === "web" ? "left" : "justify",
                  },
                ]}
              >
                {useDropCap ? (
                  <>
                    <Text
                      style={[
                        styles.dropCap,
                        {
                          color: theme.accent,
                          fontSize: fontSize * 3.2,
                          lineHeight: fontSize * 2.8,
                        },
                      ]}
                    >
                      {blockText.charAt(0)}
                    </Text>
                    {blockText.slice(1)}
                  </>
                ) : (
                  blockText
                )}
              </Text>
            </RevealBlock>
          );
        })}

        <View style={styles.pageFooter}>
          <View style={[styles.footerRule, { backgroundColor: theme.paperEdge }]} />
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            {pageNumber} / {totalPages}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ThemeChip({
  label,
  active,
  color,
  textColor,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  textColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.themeChip,
        active ? { backgroundColor: color, borderColor: color } : { borderColor: color, backgroundColor: "transparent" },
      ]}
    >
      <Text style={[styles.themeChipLabel, { color: active ? textColor : color }]}>{label}</Text>
    </Pressable>
  );
}

function StatButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.statButton}>
      <Text style={styles.statButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export default function PremiumVerticalReader({
  book,
  authorName,
  chapters,
  audioDuration,
  fontScale,
  onFontScaleChange,
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
}: ReaderScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: windowWidth, height: windowHeight });
  const [pageIndex, setPageIndex] = useState(0);
  const [themeKey, setThemeKey] = useState<ReaderThemeKey>("cream");
  const [fontKey, setFontKey] = useState<ReaderFontKey>("classic");
  const [showControls, setShowControls] = useState(true);
  const [bookmarkPulse, setBookmarkPulse] = useState(false);
  const [resumeHintVisible, setResumeHintVisible] = useState(initialPageIndex > 0);

  const theme = READER_THEMES[themeKey];
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hasHydratedRef = useRef(false);
  const persistenceReadyRef = useRef(false);
  const paginationKeyRef = useRef("");
  const anchorCharRef = useRef(0);
  const pageIndexRef = useRef(0);
  const scrollLockRef = useRef(false);
  const scrollReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookmarkPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topContentPadding = insets.top + 176;
  const bottomContentPadding = insets.bottom + (book.audioAvailable ? 176 : 76);
  const fontSize = BASE_FONT_SIZE * fontScale;
  const lineHeight = AUTO_LINE_HEIGHT;
  const fontFamily = READER_FONT_FAMILY[fontKey];
  const paperWidth = Math.min(760, Math.max(320, viewport.width - OUTER_GUTTER * 2));
  const paperHeight = Math.max(
    520,
    Math.min(780, viewport.height - insets.top - insets.bottom - (book.audioAvailable ? 186 : 136))
  );
  const pageTopPadding = 74;
  const pageBottomPadding = book.audioAvailable ? 126 : 94;
  const sectionHeight = paperHeight + PAGE_GAP;

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
    [chapters, fontScale, lineHeight, pageBottomPadding, pageTopPadding, paperHeight, paperWidth]
  );

  const totalPages = pages.length;
  const currentPage = pages[pageIndex] ?? pages[0];
  const currentChapterLabel = currentPage?.chapterTitle.replace(/^[IVX]+\.\s*/, "") ?? "";
  const readingProgress = totalPages > 0 ? (pageIndex + 1) / totalPages : 0;
  const audioActive = audio.bookId === book.id;
  const audioProgress = audioActive && audio.duration > 0 ? audio.position / audio.duration : 0;

  const headerFade = scrollY.interpolate({
    inputRange: [0, 36, 140],
    outputRange: [1, 0.88, 0],
    extrapolate: "clamp",
  });
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [0, -18],
    extrapolate: "clamp",
  });
  const controlsTranslateY = controlsOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 0],
  });
  const headerOpacity = Animated.multiply(controlsOpacity, headerFade);
  const orbParallax = scrollY.interpolate({
    inputRange: [0, 1600],
    outputRange: [0, -120],
    extrapolate: "clamp",
  });
  const sheetParallax = scrollY.interpolate({
    inputRange: [0, 1600],
    outputRange: [0, -72],
    extrapolate: "clamp",
  });

  const toggleControls = useCallback(() => {
    setShowControls((previous) => !previous);
  }, []);

  const scrollToPage = useCallback(
    (nextIndex: number, animated: boolean) => {
      const safeIndex = clamp(nextIndex, 0, Math.max(0, pages.length - 1));
      const nextPage = pages[safeIndex];

      if (!nextPage) {
        return;
      }

      if (scrollReleaseTimerRef.current) {
        clearTimeout(scrollReleaseTimerRef.current);
      }

      scrollLockRef.current = true;
      pageIndexRef.current = safeIndex;
      anchorCharRef.current = nextPage.startChar;
      setPageIndex(safeIndex);
      scrollViewRef.current?.scrollTo({
        x: 0,
        y: safeIndex * sectionHeight,
        animated,
      });

      scrollReleaseTimerRef.current = setTimeout(() => {
        scrollLockRef.current = false;
      }, animated ? 260 : 0);
    },
    [pages, sectionHeight]
  );

  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: showControls ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [controlsOpacity, showControls]);

  useEffect(() => {
    if (!resumeHintVisible) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setResumeHintVisible(false);
    }, RESUME_HINT_DURATION);

    return () => clearTimeout(timeoutId);
  }, [resumeHintVisible]);

  useEffect(() => {
    setViewport({ width: windowWidth, height: windowHeight });
  }, [windowHeight, windowWidth]);

  useEffect(() => {
    pageIndexRef.current = pageIndex;
    if (pages[pageIndex]) {
      anchorCharRef.current = pages[pageIndex].startChar;
    }
  }, [pageIndex, pages]);

  useEffect(() => {
    const paginationKey = `${Math.round(paperWidth)}:${Math.round(paperHeight)}:${fontScale}:${fontKey}`;

    if (!pages.length) {
      return;
    }

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      paginationKeyRef.current = paginationKey;
      const safeInitialPage = clamp(initialPageIndex, 0, pages.length - 1);
      requestAnimationFrame(() => {
        scrollToPage(safeInitialPage, false);
        persistenceReadyRef.current = true;
      });
      return;
    }

    if (paginationKeyRef.current !== paginationKey) {
      paginationKeyRef.current = paginationKey;
      const nextPageIndex = findPageIndexForAnchor(pages, anchorCharRef.current);
      requestAnimationFrame(() => {
        scrollToPage(nextPageIndex, false);
      });
      return;
    }

    if (pageIndexRef.current > pages.length - 1) {
      requestAnimationFrame(() => {
        scrollToPage(Math.max(0, pages.length - 1), false);
      });
    }
  }, [fontKey, fontScale, initialPageIndex, pages, paperHeight, paperWidth, scrollToPage]);

  useEffect(() => {
    if (!audioActive || !pages.length) {
      return;
    }

    const nextPageIndex = findPageIndexForAudioPosition(pages, audio.position);
    if (nextPageIndex !== pageIndexRef.current) {
      scrollToPage(nextPageIndex, true);
    }
  }, [audio.position, audioActive, pages, scrollToPage]);

  useEffect(() => {
    if (!persistenceReadyRef.current || !currentPage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      onSaveBookmark({
        bookId: book.id,
        pageIndex,
        chapterIndex: currentPage.chapterIndex,
      });
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [book.id, currentPage, onSaveBookmark, pageIndex]);

  useEffect(() => {
    return () => {
      if (scrollReleaseTimerRef.current) {
        clearTimeout(scrollReleaseTimerRef.current);
      }
      if (bookmarkPulseTimerRef.current) {
        clearTimeout(bookmarkPulseTimerRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollY.setValue(offsetY);

      if (scrollLockRef.current || !pages.length) {
        return;
      }

      const nextPageIndex = clamp(
        Math.round(offsetY / sectionHeight),
        0,
        Math.max(0, pages.length - 1)
      );

      if (nextPageIndex !== pageIndexRef.current) {
        pageIndexRef.current = nextPageIndex;
        anchorCharRef.current = pages[nextPageIndex]?.startChar ?? anchorCharRef.current;
        setPageIndex(nextPageIndex);
      }
    },
    [pages, scrollY, sectionHeight]
  );

  const saveCurrentPage = useCallback(() => {
    if (!currentPage) {
      return;
    }

    onSaveBookmark({
      bookId: book.id,
      pageIndex,
      chapterIndex: currentPage.chapterIndex,
    });

    setBookmarkPulse(true);
    if (bookmarkPulseTimerRef.current) {
      clearTimeout(bookmarkPulseTimerRef.current);
    }

    bookmarkPulseTimerRef.current = setTimeout(() => {
      setBookmarkPulse(false);
    }, 1400);
  }, [book.id, currentPage, onSaveBookmark, pageIndex]);

  const openAudio = useCallback(() => {
    if (!currentPage) {
      return;
    }

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
    if (!currentPage) {
      return;
    }

    if (!audioActive) {
      onStartAudio(book.id, audioDuration);
      onSetAudioPosition(currentPage.startTime);
      return;
    }

    onToggleAudio();
  }, [audioActive, audioDuration, book.id, currentPage, onSetAudioPosition, onStartAudio, onToggleAudio]);

  if (!currentPage) {
    return (
      <View style={[styles.container, { backgroundColor: theme.appBackground }]}>
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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backgroundOrb,
          {
            backgroundColor: theme.orb,
            transform: [{ translateY: orbParallax }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backgroundSheet,
          {
            backgroundColor: theme.paperShade,
            borderColor: theme.paperEdge,
            transform: [{ translateY: sheetParallax }],
          },
        ]}
      />

      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topContentPadding,
            paddingBottom: bottomContentPadding,
            paddingHorizontal: OUTER_GUTTER,
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {pages.map((page, index) => {
          const pageOffsetY = topContentPadding + index * sectionHeight;

          return (
            <Pressable
              key={page.id}
              style={{
                width: paperWidth,
                height: paperHeight,
                marginBottom: index === pages.length - 1 ? 0 : PAGE_GAP,
              }}
              onPress={toggleControls}
              android_disableSound
            >
              <VerticalPageCard
                page={page}
                pageNumber={index + 1}
                totalPages={totalPages}
                fontSize={fontSize}
                lineHeight={lineHeight}
                fontFamily={fontFamily}
                topPadding={pageTopPadding}
                bottomPadding={pageBottomPadding}
                theme={theme}
                scrollY={scrollY}
                viewportHeight={viewport.height}
                pageOffsetY={pageOffsetY}
                audioActive={audioActive}
                audioPlaying={audio.playing}
                audioPosition={audio.position}
              />
            </Pressable>
          );
        })}
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={showControls ? "auto" : "none"}
        style={[
          styles.headerWrap,
          {
            paddingTop: insets.top + 10,
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
          <Pressable onPress={onBack} style={[styles.backButton, { borderColor: theme.chromeBorder }]}> 
            <Text style={[styles.backButtonLabel, { color: theme.text }]}>‹</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={[styles.headerEyebrow, { color: theme.textMuted }]} numberOfLines={1}>
              {(authorName ?? "AdabiyotX").toUpperCase()}
            </Text>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {book.title}
            </Text>
          </View>

          <Pressable
            onPress={onToggleSave}
            style={[
              styles.libraryChip,
              saved
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { backgroundColor: theme.accentSoft, borderColor: theme.chromeBorder },
            ]}
          >
            <Text style={[styles.libraryChipLabel, { color: saved ? theme.paper : theme.accent }]}>
              {saved ? "Saqlangan" : "Tokchaga"}
            </Text>
          </Pressable>
        </View>

        {resumeHintVisible ? (
          <View style={[styles.resumeCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
            <Text style={[styles.resumeLabel, { color: theme.textSecondary }]}>Davom etish</Text>
            <Text style={[styles.resumeValue, { color: theme.text }]}>Sahifa {initialPageIndex + 1}</Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View
        pointerEvents={showControls ? "auto" : "none"}
        style={[
          styles.controlsWrap,
          {
            top: insets.top + 86,
            opacity: controlsOpacity,
            transform: [{ translateY: controlsTranslateY }],
          },
        ]}
      >
        <View style={[styles.controlsCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
          <View style={styles.controlsRow}>
            <Text style={[styles.controlsLabel, { color: theme.textSecondary }]}>Matn kattaligi</Text>
            <View style={styles.inlineControls}>
              <StatButton
                label="A−"
                onPress={() => onFontScaleChange(clamp(roundStep(fontScale - 0.06, 0.02), 0.9, 1.45))}
              />
              <StatButton
                label="A+"
                onPress={() => onFontScaleChange(clamp(roundStep(fontScale + 0.06, 0.02), 0.9, 1.45))}
              />
            </View>
          </View>

          <View style={styles.controlsRow}>
            <Text style={[styles.controlsLabel, { color: theme.textSecondary }]}>Shrift tanlash</Text>
            <View style={styles.themeRow}>
              {READER_FONT_OPTIONS.map((option) => (
                <ThemeChip
                  key={option.key}
                  label={option.label}
                  active={fontKey === option.key}
                  color={theme.accent}
                  textColor={theme.paper}
                  onPress={() => setFontKey(option.key)}
                />
              ))}
            </View>
          </View>

          <View style={styles.controlsRow}>
            <Text style={[styles.controlsLabel, { color: theme.textSecondary }]}>Sahifa rangi</Text>
            <View style={styles.themeRow}>
              <ThemeChip
                label="Krem"
                active={themeKey === "cream"}
                color={READER_THEMES.cream.accent}
                textColor={READER_THEMES.cream.paper}
                onPress={() => setThemeKey("cream")}
              />
              <ThemeChip
                label="Sepiya"
                active={themeKey === "sepia"}
                color={READER_THEMES.sepia.accent}
                textColor={READER_THEMES.sepia.paper}
                onPress={() => setThemeKey("sepia")}
              />
              <ThemeChip
                label="Tungi"
                active={themeKey === "night"}
                color={READER_THEMES.night.accent}
                textColor={READER_THEMES.night.paper}
                onPress={() => setThemeKey("night")}
              />
            </View>
          </View>

          <View style={styles.bottomControlsRow}>
            <Pressable
              onPress={saveCurrentPage}
              style={[styles.bookmarkButton, { backgroundColor: theme.accentSoft, borderColor: theme.chromeBorder }]}
            >
              <Text style={[styles.bookmarkLabel, { color: theme.accent }]}>
                {bookmarkPulse ? "Joy saqlandi" : "Joyni saqlash"}
              </Text>
            </Pressable>

            <View style={styles.progressSummary}>
              <Text style={[styles.progressSummaryTitle, { color: theme.textSecondary }]}>Sahifa {pageIndex + 1}</Text>
              <Text style={[styles.progressSummaryMeta, { color: theme.textMuted }]} numberOfLines={1}>
                {currentChapterLabel || "AdabiyotX"}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {book.audioAvailable ? (
        <View style={[styles.audioWrap, { bottom: insets.bottom + 18, left: OUTER_GUTTER, right: OUTER_GUTTER }]}> 
          <View style={[styles.audioCard, { backgroundColor: theme.chrome, borderColor: theme.chromeBorder }]}> 
            <Pressable onPress={openAudio} style={styles.audioMetaArea}>
              <View style={[styles.audioBadge, { backgroundColor: theme.accentSoft }]}> 
                <Text style={[styles.audioBadgeLabel, { color: theme.accent }]}>Audio</Text>
              </View>

              <View style={styles.audioCopy}>
                <Text style={[styles.audioTitle, { color: theme.text }]} numberOfLines={1}>
                  {book.title}
                </Text>
                <Text style={[styles.audioSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {currentChapterLabel || "Audio bob"}
                </Text>
                <View style={[styles.audioTrack, { backgroundColor: theme.progressTrack }]}> 
                  <View style={[styles.audioFill, { width: `${audioProgress * 100}%`, backgroundColor: theme.accent }]} />
                </View>
                <View style={styles.audioTimeRow}>
                  <Text style={[styles.audioTime, { color: theme.textMuted }]}> 
                    {formatTime(audioActive ? audio.position : 0)}
                  </Text>
                  <Text style={[styles.audioTime, { color: theme.textMuted }]}> 
                    {formatTime(audioActive ? audio.duration : audioDuration)}
                  </Text>
                </View>
              </View>
            </Pressable>

            <Pressable onPress={toggleAudioPlayback} style={[styles.audioAction, { backgroundColor: theme.accent }]}> 
              <Text style={[styles.audioActionLabel, { color: theme.paper }]}> 
                {audioActive && audio.playing ? "❚❚" : "▶"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        pointerEvents="none"
        style={[
          styles.progressRail,
          {
            bottom: insets.bottom + (book.audioAvailable ? 110 : 18),
            left: OUTER_GUTTER,
            right: OUTER_GUTTER,
            backgroundColor: theme.progressTrack,
          },
        ]}
      >
        <View style={[styles.progressFill, { width: `${readingProgress * 100}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
  },
  emptyStateText: {
    margin: "auto",
    fontSize: 16,
    fontFamily: FONT.sans,
  },
  backgroundOrb: {
    position: "absolute",
    top: -60,
    left: -20,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.9,
  },
  backgroundSheet: {
    position: "absolute",
    top: 120,
    left: 28,
    right: 28,
    height: 360,
    borderRadius: 48,
    borderWidth: 1,
    opacity: 0.34,
  },
  headerWrap: {
    position: "absolute",
    left: OUTER_GUTTER,
    right: OUTER_GUTTER,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backButtonLabel: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "500",
    marginTop: -3,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.8,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  libraryChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  libraryChipLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  resumeCard: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  resumeLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  resumeValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  controlsWrap: {
    position: "absolute",
    left: OUTER_GUTTER,
    right: OUTER_GUTTER,
  },
  controlsCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  controlsRow: {
    gap: 10,
  },
  controlsLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  inlineControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  controlsValue: {
    minWidth: 38,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  statButton: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.52)",
    borderWidth: 1,
    borderColor: "rgba(133,110,79,0.14)",
  },
  statButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
  },
  themeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  themeChipLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  bottomControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bookmarkButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    justifyContent: "center",
    borderWidth: 1,
  },
  bookmarkLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressSummary: {
    flex: 1,
    minWidth: 0,
  },
  progressSummaryTitle: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  progressSummaryMeta: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  pageCard: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  pageBase: {
    ...StyleSheet.absoluteFillObject,
  },
  pageWash: {
    position: "absolute",
    top: -12,
    left: 0,
    right: 0,
    height: 220,
    borderRadius: 140,
  },
  pageGlow: {
    position: "absolute",
    top: 44,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.35,
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
  chapterReveal: {
    marginBottom: 10,
  },
  chapterHeader: {
    marginBottom: 18,
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
    letterSpacing: -0.5,
  },
  runningHead: {
    fontSize: 10,
    letterSpacing: 3.4,
    fontWeight: "700",
    marginBottom: 18,
  },
  paragraphWrap: {
    overflow: "visible",
  },
  bodyText: {
    fontFamily: FONT.serif,
  },
  dropCap: {
    fontFamily: FONT.serif,
    fontWeight: "700",
  },
  pageFooter: {
    marginTop: "auto",
    paddingTop: 18,
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
  audioWrap: {
    position: "absolute",
  },
  audioCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  audioMetaArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audioBadge: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  audioBadgeLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  audioCopy: {
    flex: 1,
    minWidth: 0,
  },
  audioTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  audioSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  audioTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 6,
  },
  audioFill: {
    height: "100%",
    borderRadius: 999,
  },
  audioTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  audioTime: {
    fontSize: 11,
    fontWeight: "600",
  },
  audioAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  audioActionLabel: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 1,
  },
  progressRail: {
    position: "absolute",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
