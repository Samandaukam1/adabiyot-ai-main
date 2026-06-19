import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  ChevronLeft,
  Headphones,
  Pause,
  Play,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
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
const PAGE_GAP = 18;
const PAGE_INNER_PADDING = 32;
const BASE_FONT_SIZE = 18;

const THEME = {
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
  chrome: "rgba(255,253,247,0.96)",
  chromeBorder: "rgba(46,125,50,0.12)",
  shadow: "rgba(40,24,12,0.14)",
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

function WebPageCard({
  page,
  pageNumber,
  totalPages,
  fontSize,
  lineHeight,
  topPadding,
  bottomPadding,
}: {
  page: ReaderPage;
  pageNumber: number;
  totalPages: number;
  fontSize: number;
  lineHeight: number;
  topPadding: number;
  bottomPadding: number;
}) {
  return (
    <View
      style={[
        styles.pageCard,
        {
          backgroundColor: THEME.paper,
          borderColor: THEME.paperEdge,
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <LinearGradient
        colors={[THEME.paperShade, THEME.paper, THEME.paperShade]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.32)", "transparent", "rgba(17,17,17,0.03)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.pageSpine, { backgroundColor: THEME.shadow }]} />
      <View style={[styles.pageEdge, { backgroundColor: THEME.paperEdge }]} />

      <View style={[styles.pageContent, { paddingHorizontal: PAGE_INNER_PADDING }]}> 
        {page.isChapterStart ? (
          <View style={styles.chapterHeader}>
            <View style={[styles.chapterRule, { backgroundColor: THEME.accent }]} />
            <Text style={[styles.chapterKicker, { color: THEME.accent }]}>BOB {page.chapterIndex + 1}</Text>
            <Text style={[styles.chapterTitle, { color: THEME.text, fontSize: fontSize * 1.44 }]}>
              {page.chapterTitle.replace(/^[IVX]+\.\s*/, "")}
            </Text>
          </View>
        ) : (
          <Text style={[styles.runningHead, { color: THEME.textMuted }]}>
            {page.chapterTitle.toUpperCase()}
          </Text>
        )}

        {page.blocks.map((block, index) => {
          const useDropCap = page.isChapterStart && index === 0 && block.startsParagraph;
          const blockText = block.text.trim();

          return (
            <Text
              key={block.id}
              style={[
                styles.bodyText,
                {
                  color: THEME.text,
                  fontSize,
                  lineHeight: fontSize * lineHeight,
                  marginBottom: block.endsParagraph ? fontSize * 0.88 : fontSize * 0.48,
                },
              ]}
            >
              {useDropCap ? (
                <>
                  <Text
                    style={[
                      styles.dropCap,
                      {
                        color: THEME.accent,
                        fontSize: fontSize * 3.2,
                        lineHeight: fontSize * 2.9,
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
          );
        })}

        <View style={styles.pageFooter}>
          <View style={[styles.footerRule, { backgroundColor: THEME.paperEdge }]} />
          <Text style={[styles.footerText, { color: THEME.textMuted }]}>
            {pageNumber} / {totalPages}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ControlButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.controlButton}>
      <Text style={styles.controlButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export default function WebSimpleReader({
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
}: ReaderScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: windowWidth, height: windowHeight });
  const [pageIndex, setPageIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const hasHydratedRef = useRef(false);
  const paginationKeyRef = useRef("");
  const anchorCharRef = useRef(0);
  const pageIndexRef = useRef(0);
  const scrollLockRef = useRef(false);
  const scrollReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerHeight = 120;
  const fontSize = BASE_FONT_SIZE * fontScale;
  const paperWidth = Math.min(820, Math.max(320, viewport.width - OUTER_GUTTER * 2));
  const paperHeight = Math.max(
    520,
    Math.min(860, viewport.height - insets.top - insets.bottom - (book.audioAvailable ? 210 : 160))
  );
  const pageTopPadding = 68;
  const pageBottomPadding = book.audioAvailable ? 114 : 82;

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
        y: safeIndex * (paperHeight + PAGE_GAP),
        animated,
      });

      scrollReleaseTimerRef.current = setTimeout(() => {
        scrollLockRef.current = false;
      }, animated ? 260 : 0);
    },
    [pages, paperHeight]
  );

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
    const paginationKey = `${Math.round(paperWidth)}:${Math.round(paperHeight)}:${fontScale}:${lineHeight}`;

    if (!pages.length) {
      return;
    }

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      paginationKeyRef.current = paginationKey;
      const safeInitialPage = clamp(initialPageIndex, 0, pages.length - 1);
      requestAnimationFrame(() => {
        scrollToPage(safeInitialPage, false);
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
  }, [fontScale, initialPageIndex, lineHeight, pages, paperHeight, paperWidth, scrollToPage]);

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
    return () => {
      if (scrollReleaseTimerRef.current) {
        clearTimeout(scrollReleaseTimerRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollLockRef.current || !pages.length) {
        return;
      }

      const offsetY = event.nativeEvent.contentOffset.y;
      const nextPageIndex = clamp(
        Math.round(offsetY / (paperHeight + PAGE_GAP)),
        0,
        Math.max(0, pages.length - 1)
      );

      if (nextPageIndex !== pageIndexRef.current) {
        pageIndexRef.current = nextPageIndex;
        anchorCharRef.current = pages[nextPageIndex]?.startChar ?? anchorCharRef.current;
        setPageIndex(nextPageIndex);
      }
    },
    [pages, paperHeight]
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
      <View style={[styles.container, { backgroundColor: THEME.appBackground }]}>
        <Text style={[styles.emptyStateText, { color: THEME.textSecondary }]}>Kitob sahifalari tayyorlanmoqda</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: THEME.appBackground }]}
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
        colors={[THEME.appBackground, THEME.appTint, THEME.appBackground]}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 0.96, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + headerHeight + 18,
            paddingBottom: insets.bottom + (book.audioAvailable ? 132 : 28),
            paddingHorizontal: OUTER_GUTTER,
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {pages.map((page, index) => (
          <View
            key={page.id}
            style={{
              width: paperWidth,
              height: paperHeight,
              marginBottom: index === pages.length - 1 ? 0 : PAGE_GAP,
            }}
          >
            <WebPageCard
              page={page}
              pageNumber={index + 1}
              totalPages={totalPages}
              fontSize={fontSize}
              lineHeight={lineHeight}
              topPadding={pageTopPadding}
              bottomPadding={pageBottomPadding}
            />
          </View>
        ))}
      </ScrollView>

      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}> 
        <View style={styles.headerCard}>
          <Pressable onPress={onBack} style={styles.iconButton}>
            <ChevronLeft color={THEME.text} size={20} />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={[styles.headerKicker, { color: THEME.textMuted }]} numberOfLines={1}>
              {(authorName ?? "Adabiyot AI").toUpperCase()}
            </Text>
            <Text style={[styles.headerTitle, { color: THEME.text }]} numberOfLines={1}>
              {book.title}
            </Text>
          </View>

          <Pressable onPress={onToggleSave} style={[styles.saveChip, saved && styles.saveChipActive]}>
            <Text style={[styles.saveChipLabel, { color: saved ? "#FFFFFF" : THEME.accent }]}>
              {saved ? "Saqlangan" : "Tokchaga"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.controlGroup}>
            <Text style={[styles.controlLabel, { color: THEME.textSecondary }]}>Matn</Text>
            <ControlButton
              label="A−"
              onPress={() => onFontScaleChange(clamp(roundStep(fontScale - 0.06, 0.02), 0.9, 1.45))}
            />
            <ControlButton
              label="A+"
              onPress={() => onFontScaleChange(clamp(roundStep(fontScale + 0.06, 0.02), 0.9, 1.45))}
            />
          </View>

          <View style={styles.controlGroup}>
            <Text style={[styles.controlLabel, { color: THEME.textSecondary }]}>Qator</Text>
            <ControlButton
              label="−"
              onPress={() => onLineHeightChange(clamp(roundStep(lineHeight - 0.06, 0.02), 1.35, 2.05))}
            />
            <Text style={[styles.controlValue, { color: THEME.text }]}>{lineHeight.toFixed(2)}</Text>
            <ControlButton
              label="+"
              onPress={() => onLineHeightChange(clamp(roundStep(lineHeight + 0.06, 0.02), 1.35, 2.05))}
            />
          </View>

          <Pressable onPress={saveCurrentPage} style={styles.bookmarkButton}>
            <Bookmark color={THEME.accent} size={18} />
            <Text style={[styles.bookmarkButtonLabel, { color: THEME.accent }]}>Joyni saqlash</Text>
          </Pressable>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={[styles.progressLabel, { color: THEME.textSecondary }]}>Sahifa {pageIndex + 1}</Text>
            <Text style={[styles.progressLabel, { color: THEME.textMuted }]}>{totalPages}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: THEME.paperEdge }]}> 
            <View style={[styles.progressFill, { width: `${readingProgress * 100}%`, backgroundColor: THEME.accent }]} />
          </View>
          <View style={styles.progressBottomRow}>
            <Text style={[styles.progressMeta, { color: THEME.textMuted }]} numberOfLines={1}>
              {currentChapterLabel}
            </Text>
            <Text style={[styles.progressMeta, { color: THEME.textSecondary }]}>
              {pageIndex + 1} / {totalPages}
            </Text>
          </View>
        </View>
      </View>

      {book.audioAvailable ? (
        <View style={[styles.audioWrap, { bottom: insets.bottom + 12, left: OUTER_GUTTER, right: OUTER_GUTTER }]}> 
          <View style={styles.audioCard}>
            <Pressable onPress={openAudio} style={styles.audioMetaArea}>
              <View style={[styles.audioIconWrap, { backgroundColor: THEME.accentSoft }]}> 
                <Headphones color={THEME.accent} size={18} />
              </View>
              <View style={styles.audioCopy}>
                <Text style={[styles.audioTitle, { color: THEME.text }]} numberOfLines={1}>
                  {book.title}
                </Text>
                <Text style={[styles.audioChapter, { color: THEME.textSecondary }]} numberOfLines={1}>
                  {currentChapterLabel || "Audio bob"}
                </Text>
                <View style={[styles.audioTrack, { backgroundColor: THEME.paperEdge }]}> 
                  <View style={[styles.audioFill, { width: `${audioProgress * 100}%`, backgroundColor: THEME.accent }]} />
                </View>
                <View style={styles.audioTimeRow}>
                  <Text style={[styles.audioTime, { color: THEME.textMuted }]}>{formatTime(audioActive ? audio.position : 0)}</Text>
                  <Text style={[styles.audioTime, { color: THEME.textMuted }]}>{formatTime(audioActive ? audio.duration : audioDuration)}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable onPress={toggleAudioPlayback} style={[styles.audioPlayButton, { backgroundColor: THEME.accent }]}> 
              {audioActive && audio.playing ? (
                <Pause color="#FFFFFF" size={18} fill="#FFFFFF" />
              ) : (
                <Play color="#FFFFFF" size={18} fill="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
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
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: OUTER_GUTTER,
    gap: 10,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: THEME.chrome,
    borderWidth: 1,
    borderColor: THEME.chromeBorder,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerKicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.chromeBorder,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  saveChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  saveChipActive: {
    backgroundColor: THEME.accent,
  },
  saveChipLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  controlsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: THEME.chrome,
    borderWidth: 1,
    borderColor: THEME.chromeBorder,
  },
  controlGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  controlValue: {
    minWidth: 34,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  controlButton: {
    minWidth: 42,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.52)",
    borderWidth: 1,
    borderColor: THEME.chromeBorder,
  },
  controlButtonLabel: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: "700",
  },
  bookmarkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: THEME.chromeBorder,
  },
  bookmarkButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: THEME.chrome,
    borderWidth: 1,
    borderColor: THEME.chromeBorder,
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  progressMeta: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
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
    color: THEME.textMuted,
  },
  bodyText: {
    fontFamily: FONT.serif,
    textAlign: "left",
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
  audioWrap: {
    position: "absolute",
  },
  audioCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 22,
    backgroundColor: THEME.chrome,
    borderWidth: 1,
    borderColor: THEME.chromeBorder,
  },
  audioMetaArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audioIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
  audioChapter: {
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
  audioPlayButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
});