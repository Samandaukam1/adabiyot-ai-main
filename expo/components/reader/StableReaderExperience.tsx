import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  Copy,
  Headphones,
  List,
  Pause,
  Play,
  Search,
  Settings2,
  X,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale } from "@/components/ui";
import { useBranding } from "@/providers/BrandingProvider";
import ReaderTitlePage from "@/components/reader/ReaderTitlePage";
import PageFlipEffect from "@/components/reader/PageFlipEffect";
import WebPageFlipReader from "@/components/reader/WebPageFlipReader";
import { palette } from "@/constants/colors";
import { getAuthor, getBook, sampleBookContent, type ReaderImageBlock } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// On the web a full-window page would sprawl edge-to-edge; cap it to a premium,
// centred "book" column so typography + pagination match what's shown. On native
// this is exactly the screen width, so behaviour is unchanged.
const IS_WEB = Platform.OS === "web";
const PAGE_W = IS_WEB ? Math.min(SCREEN_W, 680) : SCREEN_W;

// Book-like page-flip animation over the existing horizontal pager. Flip this to
// `false` to instantly restore the classic swipe reader (also auto-falls back on
// web or if the flip library errors — see components/reader/PageFlipEffect.tsx).
const ENABLE_PAGE_FLIP = true;

const READER_PREFS_KEY = "adabiyot.reader.prefs.v1";
const AUTO_LINE_HEIGHT = 1.55;

type ReaderFontKey = "serif" | "sans" | "mono" | "classic";
type PageToneKey = "white" | "sepia" | "gray" | "black";
type HighlightTone = "yellow" | "red" | "green" | "blue";

interface ParagraphRef {
  key: string;
  chapterIndex: number;
  paragraphIndex: number;
  globalIndex: number;
  text: string;
  sectionLabel: string;
  imageUri?: string;
  imageCaption?: string;
}

interface Page {
  chapterIndex: number;
  chapterTitle: string;
  paragraphs: ParagraphRef[];
  isChapterStart: boolean;
  startTime: number;
  endTime: number;
  anchorKey: string;
  firstGlobalIndex: number;
  /** Synthetic intro/cover page (logo, title, author, year) — always page 0. */
  isCover?: boolean;
}

interface ReaderPrefs {
  fontKey: ReaderFontKey;
  pageTone: PageToneKey;
}

interface ReaderSelection {
  chapterIndex: number;
  paragraphIndex: number;
  startWordIndex: number;
  endWordIndex: number;
  text: string;
}

interface ReaderAnnotation {
  id: string;
  bookId: string;
  chapterIndex: number;
  paragraphIndex: number;
  startWordIndex: number;
  endWordIndex: number;
  text: string;
  color: HighlightTone;
  note?: string;
  createdAt: number;
}

interface SearchResult {
  id: string;
  chapterIndex: number;
  paragraphIndex: number;
  chapterTitle: string;
  text: string;
  preview: string;
  pageIndex: number;
}

interface WordToken {
  index: number;
  raw: string;
  plain: string;
}

const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontKey: "classic",
  pageTone: "white",
};

const FONT_OPTIONS: { key: ReaderFontKey; label: string; description: string }[] = [
  { key: "serif", label: "Serif", description: "Klassik serif" },
  { key: "sans", label: "Sans", description: "Minimal sans" },
  { key: "mono", label: "Mono", description: "Teng kenglik" },
  { key: "classic", label: "Klassik", description: "Kitob uslubi" },
];

const PAGE_THEME_OPTIONS: { key: PageToneKey; label: string }[] = [
  { key: "white", label: "Oq" },
  { key: "sepia", label: "Sariq" },
  { key: "gray", label: "Kulrang" },
  { key: "black", label: "Qora" },
];

const HIGHLIGHT_OPTIONS: { key: HighlightTone; label: string }[] = [
  { key: "yellow", label: "Sariq" },
  { key: "red", label: "Qizil" },
  { key: "green", label: "Yashil" },
  { key: "blue", label: "Ko'k" },
];

const PAGE_THEMES = {
  white: {
    appBackground: palette.bg,
    appAccent: "#EFE9DF",
    pageStart: "#FFFFFF",
    pageEnd: "#FFFDF7",
    pageBorder: "rgba(17,17,17,0.05)",
    pageShadow: "rgba(42,26,15,0.12)",
    text: "#111111",
    textDim: "#666666",
    textMuted: "#8A8377",
    chrome: "rgba(255,253,247,0.95)",
    chromeBorder: "rgba(17,17,17,0.08)",
    iconBg: "rgba(255,255,255,0.86)",
    progressTrack: "rgba(17,17,17,0.08)",
    bottomSheet: "#FFFFFF",
    bottomSheetSecondary: "#F7F4EE",
    chipBg: "#FFFFFF",
    chipBorder: "rgba(17,17,17,0.08)",
    selection: "rgba(46,125,50,0.18)",
    searchHighlight: "rgba(46,125,50,0.12)",
    toastBg: "rgba(17,17,17,0.88)",
    toastText: "#FFFFFF",
  },
  sepia: {
    appBackground: "#F5F0E4",
    appAccent: "#EDE0CB",
    pageStart: "#F6ECD2",
    pageEnd: "#F1E4C5",
    pageBorder: "rgba(69,45,24,0.06)",
    pageShadow: "rgba(51,30,10,0.14)",
    text: "#2A1A0F",
    textDim: "#6A4D31",
    textMuted: "#8E7259",
    chrome: "rgba(250,243,229,0.95)",
    chromeBorder: "rgba(69,45,24,0.10)",
    iconBg: "rgba(255,248,234,0.86)",
    progressTrack: "rgba(69,45,24,0.12)",
    bottomSheet: "#FFF8EC",
    bottomSheetSecondary: "#F8EDDC",
    chipBg: "#FFF8EC",
    chipBorder: "rgba(69,45,24,0.10)",
    selection: "rgba(139,90,43,0.16)",
    searchHighlight: "rgba(139,90,43,0.10)",
    toastBg: "rgba(42,26,15,0.92)",
    toastText: "#FFF8EC",
  },
  gray: {
    appBackground: "#EEE9E1",
    appAccent: "#E2DDD6",
    pageStart: "#F1F1EE",
    pageEnd: "#E8E8E3",
    pageBorder: "rgba(17,17,17,0.05)",
    pageShadow: "rgba(30,22,16,0.11)",
    text: "#111111",
    textDim: "#626262",
    textMuted: "#8B8B84",
    chrome: "rgba(247,247,244,0.95)",
    chromeBorder: "rgba(17,17,17,0.08)",
    iconBg: "rgba(255,255,255,0.78)",
    progressTrack: "rgba(17,17,17,0.08)",
    bottomSheet: "#FAFAF8",
    bottomSheetSecondary: "#F1F1EE",
    chipBg: "#FAFAF8",
    chipBorder: "rgba(17,17,17,0.08)",
    selection: "rgba(46,125,50,0.16)",
    searchHighlight: "rgba(46,125,50,0.10)",
    toastBg: "rgba(17,17,17,0.88)",
    toastText: "#FFFFFF",
  },
  black: {
    appBackground: "#111111",
    appAccent: "#1B1B1B",
    pageStart: "#111111",
    pageEnd: "#181818",
    pageBorder: "rgba(255,255,255,0.06)",
    pageShadow: "rgba(0,0,0,0.32)",
    text: "#F6F1E8",
    textDim: "#D5CFC4",
    textMuted: "#9C968B",
    chrome: "rgba(20,20,20,0.95)",
    chromeBorder: "rgba(255,255,255,0.08)",
    iconBg: "rgba(28,28,28,0.92)",
    progressTrack: "rgba(255,255,255,0.10)",
    bottomSheet: "#191919",
    bottomSheetSecondary: "#232323",
    chipBg: "#202020",
    chipBorder: "rgba(255,255,255,0.08)",
    selection: "rgba(111,201,124,0.24)",
    searchHighlight: "rgba(111,201,124,0.18)",
    toastBg: "rgba(250,248,242,0.92)",
    toastText: "#111111",
  },
} as const;

const HIGHLIGHT_COLORS: Record<HighlightTone, { bg: string; dot: string }> = {
  yellow: { bg: "rgba(247,220,111,0.38)", dot: "#F4C430" },
  red: { bg: "rgba(236,112,99,0.30)", dot: "#E74C3C" },
  green: { bg: "rgba(130,224,170,0.34)", dot: "#2E7D32" },
  blue: { bg: "rgba(133,193,233,0.34)", dot: "#3498DB" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function paragraphKey(chapterIndex: number, paragraphIndex: number): string {
  return `${chapterIndex}:${paragraphIndex}`;
}

function annotationsStorageKey(bookId: string): string {
  return `adabiyot.reader.annotations.${bookId}.v1`;
}

function buildSectionLabel(text: string): string {
  const sentence = text.split(/[.!?]/)[0]?.trim() ?? text.trim();
  return sentence.length > 52 ? `${sentence.slice(0, 52).trim()}...` : sentence;
}

function getCharWidthMultiplier(fontKey: ReaderFontKey): number {
  if (fontKey === "mono") return 0.57;
  if (fontKey === "sans") return 0.5;
  if (fontKey === "classic") return 0.475;
  return 0.48;
}

function buildPages(
  fontScale: number,
  lineHeight: number,
  availableHeight: number,
  fontKey: ReaderFontKey
): Page[] {
  const pages: Page[] = [];
  const fontSize = 17 * fontScale;
  const lineH = fontSize * lineHeight;
  const charsPerLine = Math.floor((PAGE_W - 56) / (fontSize * getCharWidthMultiplier(fontKey)));
  const linesPerPage = Math.max(6, Math.floor(availableHeight / lineH) - 1);

  let globalParagraphIndex = 0;

  sampleBookContent.chapters.forEach((chapter, chapterIndex) => {
    let buffer: ParagraphRef[] = [];
    // Chapter header takes ~7 line-heights (line+kicker+title+line+margins+paddingTop)
    let linesUsed = 7;
    let isStart = true;
    const chapterPages: Page[] = [];

    const flush = () => {
      if (buffer.length === 0 && !isStart) return;
      chapterPages.push({
        chapterIndex,
        chapterTitle: chapter.title,
        paragraphs: [...buffer],
        isChapterStart: isStart,
        startTime: chapter.startTime,
        endTime: chapter.endTime,
        anchorKey: buffer[0]?.key ?? paragraphKey(chapterIndex, 0),
        firstGlobalIndex: buffer[0]?.globalIndex ?? 0,
      });
      buffer = [];
      // Running head on continuation pages takes ~1.5 lines
      linesUsed = 1.5;
      isStart = false;
    };

    // Estimated image height in lines (image fills content width at ~0.6 ratio + caption)
    const imageWidthPx = PAGE_W - 112;
    const imageHeightPx = imageWidthPx * 0.6 + 36;
    const imageLinesEstimate = Math.ceil(imageHeightPx / lineH) + 1;

    chapter.paragraphs.forEach((item, paragraphIndex) => {
      const isImage = typeof item !== "string";
      const paragraphRef: ParagraphRef = {
        key: paragraphKey(chapterIndex, paragraphIndex),
        chapterIndex,
        paragraphIndex,
        globalIndex: globalParagraphIndex,
        text: isImage ? "" : (item as string),
        sectionLabel: isImage ? "" : buildSectionLabel(item as string),
        imageUri: isImage ? (item as ReaderImageBlock).uri : undefined,
        imageCaption: isImage ? (item as ReaderImageBlock).caption : undefined,
      };
      const itemLines = isImage
        ? imageLinesEstimate
        : Math.ceil((item as string).length / Math.max(1, charsPerLine)) + 1.15;
      if (linesUsed + itemLines > linesPerPage) {
        flush();
      }
      buffer.push(paragraphRef);
      linesUsed += itemLines;
      globalParagraphIndex += 1;
    });

    if (buffer.length > 0 || isStart) flush();

    const chapterDuration = Math.max(1, chapter.endTime - chapter.startTime);
    chapterPages.forEach((page, pagePosition) => {
      const startRatio = pagePosition / chapterPages.length;
      const endRatio = (pagePosition + 1) / chapterPages.length;
      page.startTime = chapter.startTime + chapterDuration * startRatio;
      page.endTime = chapter.startTime + chapterDuration * endRatio;
    });

    pages.push(...chapterPages);
  });

  return pages;
}

function tokenizeParagraph(text: string): WordToken[] {
  const matches = text.match(/\S+\s*/g) ?? [text];
  return matches.map((segment, index) => ({
    index,
    raw: segment,
    plain: segment.trim().toLowerCase(),
  }));
}

function buildSelection(
  paragraph: ParagraphRef,
  tokens: WordToken[],
  startWordIndex: number,
  endWordIndex: number
): ReaderSelection {
  const from = Math.min(startWordIndex, endWordIndex);
  const to = Math.max(startWordIndex, endWordIndex);
  return {
    chapterIndex: paragraph.chapterIndex,
    paragraphIndex: paragraph.paragraphIndex,
    startWordIndex: from,
    endWordIndex: to,
    text: tokens
      .slice(from, to + 1)
      .map((token) => token.raw)
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

function getSelectionKey(selection: ReaderSelection | null): string | null {
  if (!selection) return null;
  return [
    selection.chapterIndex,
    selection.paragraphIndex,
    selection.startWordIndex,
    selection.endWordIndex,
  ].join(":");
}

function buildPreview(text: string, query: string): string {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!query) {
    return normalizedText.length > 96 ? `${normalizedText.slice(0, 96).trim()}...` : normalizedText;
  }
  const lower = normalizedText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lower.indexOf(lowerQuery);
  if (matchIndex === -1) {
    return normalizedText.length > 96 ? `${normalizedText.slice(0, 96).trim()}...` : normalizedText;
  }
  const start = Math.max(0, matchIndex - 28);
  const end = Math.min(normalizedText.length, matchIndex + query.length + 42);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";
  return `${prefix}${normalizedText.slice(start, end).trim()}${suffix}`;
}

function findHighlightAtWord(
  annotations: ReaderAnnotation[],
  wordIndex: number
): ReaderAnnotation | null {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (wordIndex >= annotation.startWordIndex && wordIndex <= annotation.endWordIndex) {
      return annotation;
    }
  }
  return null;
}

function upsertAnnotation(
  annotations: ReaderAnnotation[],
  bookId: string,
  selection: ReaderSelection,
  color: HighlightTone,
  note?: string
): ReaderAnnotation[] {
  const next = [...annotations];
  const existingIndex = next.findIndex(
    (annotation) =>
      annotation.chapterIndex === selection.chapterIndex &&
      annotation.paragraphIndex === selection.paragraphIndex &&
      annotation.startWordIndex === selection.startWordIndex &&
      annotation.endWordIndex === selection.endWordIndex
  );

  const payload: ReaderAnnotation = {
    id:
      existingIndex >= 0
        ? next[existingIndex].id
        : `${Date.now()}-${selection.chapterIndex}-${selection.paragraphIndex}-${selection.startWordIndex}`,
    bookId,
    chapterIndex: selection.chapterIndex,
    paragraphIndex: selection.paragraphIndex,
    startWordIndex: selection.startWordIndex,
    endWordIndex: selection.endWordIndex,
    text: selection.text,
    color,
    note: note?.trim() ? note.trim() : existingIndex >= 0 ? next[existingIndex].note : undefined,
    createdAt: existingIndex >= 0 ? next[existingIndex].createdAt : Date.now(),
  };

  if (existingIndex >= 0) {
    next[existingIndex] = payload;
  } else {
    next.push(payload);
  }

  return next;
}

function findPageIndexByAnchor(pages: Page[], anchorKey: string | null, fallbackIndex: number): number {
  if (!pages.length) return 0;
  if (!anchorKey) return clamp(fallbackIndex, 0, pages.length - 1);
  const matchIndex = pages.findIndex((page) => page.paragraphs.some((paragraph) => paragraph.key === anchorKey));
  if (matchIndex >= 0) return matchIndex;
  return clamp(fallbackIndex, 0, pages.length - 1);
}

function getFontFamily(fontKey: ReaderFontKey): string {
  return FONT[fontKey];
}

export default function StableReaderExperience() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const book = useMemo(() => getBook(String(id)), [id]);
  const author = useMemo(() => (book ? getAuthor(book.authorId) : undefined), [book]);
  const { appName, branding } = useBranding();
  // Logo comes ONLY from admin Branding settings — never a bundled/static asset.
  const brandingLogoUrl =
    branding.logo_url || branding.splash_logo_url || branding.app_icon_url || null;
  // Year for the intro page — prefer a real date field, else omit (never current year).
  const bookYear = useMemo(() => {
    const raw = book as unknown as Record<string, unknown> | undefined;
    const candidate =
      (raw?.year as string | number | undefined) ??
      (raw?.publishedAt as string | undefined) ??
      (raw?.published_at as string | undefined) ??
      (raw?.createdAt as string | undefined) ??
      (raw?.created_at as string | undefined);
    const match = candidate != null ? String(candidate).match(/\d{4}/) : null;
    return match ? match[0] : null;
  }, [book]);
  const {
    fontScale,
    setFontScale,
    addHistory,
    audio,
    togglePlay,
    startAudio,
    setAudioPosition,
    saveBookmark,
  } = useApp();

  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showContents, setShowContents] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [availH, setAvailH] = useState(SCREEN_H - 380);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([]);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const listRef = useRef<FlatList<Page>>(null);
  const historyLoggedRef = useRef<string | null>(null);
  const lastSyncedPageRef = useRef(-1);
  const anchorKeyRef = useRef<string | null>(null);
  const pagesRef = useRef<Page[]>([]);
  const layoutSignatureRef = useRef("");
  const hydratedPagesRef = useRef(false);
  const prefsLoadedRef = useRef(false);
  const annotationsLoadedRef = useRef(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageTheme = PAGE_THEMES[prefs.pageTone];
  const fontFamily = getFontFamily(prefs.fontKey);
  const lineHeightValue = AUTO_LINE_HEIGHT;

  const pages = useMemo(() => {
    const built = buildPages(fontScale, lineHeightValue, availH, prefs.fontKey);
    // Intro/cover page (logo · title · author · year) is always page 0. It carries
    // no paragraphs and a negative time range so audio-sync + pageLookup ignore it,
    // while TOC/search page indices (derived from this same array) stay correct.
    const cover: Page = {
      chapterIndex: -1,
      chapterTitle: "",
      paragraphs: [],
      isChapterStart: false,
      startTime: -1,
      endTime: -1,
      anchorKey: "__cover__",
      firstGlobalIndex: -1,
      isCover: true,
    };
    return [cover, ...built];
  }, [availH, fontScale, lineHeightValue, prefs.fontKey]);

  const paragraphCatalog = useMemo(() => {
    return sampleBookContent.chapters.flatMap((chapter, chapterIndex) =>
      chapter.paragraphs
        .filter((item): item is string => typeof item === "string")
        .map((text, paragraphIndex) => ({
          key: paragraphKey(chapterIndex, paragraphIndex),
          chapterIndex,
          paragraphIndex,
          chapterTitle: chapter.title,
          text,
          sectionLabel: buildSectionLabel(text),
        }))
    );
  }, []);

  const pageLookup = useMemo(() => {
    const map = new Map<string, number>();
    pages.forEach((page, pageIdx) => {
      page.paragraphs.forEach((paragraph) => {
        if (!map.has(paragraph.key)) {
          map.set(paragraph.key, pageIdx);
        }
      });
    });
    return map;
  }, [pages]);

  const contents = useMemo(() => {
    return sampleBookContent.chapters.map((chapter, chapterIndex) => ({
      chapterIndex,
      chapterTitle: chapter.title,
      pageIndex: pageLookup.get(paragraphKey(chapterIndex, 0)) ?? 0,
      sections: (chapter.paragraphs.filter((item) => typeof item === "string") as string[])
        .map((text, paragraphIndex) => ({
          id: paragraphKey(chapterIndex, paragraphIndex),
          label: buildSectionLabel(text),
          pageIndex: pageLookup.get(paragraphKey(chapterIndex, paragraphIndex)) ?? 0,
          paragraphIndex,
        })),
    }));
  }, [pageLookup]);

  const currentPage = pages[pageIndex] ?? pages[0];
  const totalPages = pages.length;
  const currentChapterIndex = currentPage?.chapterIndex ?? 0;
  const currentSectionKey = currentPage?.anchorKey ?? null;

  const annotationsByParagraph = useMemo(() => {
    const map = new Map<string, ReaderAnnotation[]>();
    annotations.forEach((annotation) => {
      const key = paragraphKey(annotation.chapterIndex, annotation.paragraphIndex);
      const group = map.get(key) ?? [];
      group.push(annotation);
      map.set(key, group);
    });
    return map;
  }, [annotations]);

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [] as SearchResult[];

    return paragraphCatalog
      .filter((paragraph) => paragraph.text.toLowerCase().includes(normalizedQuery))
      .map((paragraph) => ({
        id: `${paragraph.key}:${normalizedQuery}`,
        chapterIndex: paragraph.chapterIndex,
        paragraphIndex: paragraph.paragraphIndex,
        chapterTitle: paragraph.chapterTitle,
        text: paragraph.text,
        preview: buildPreview(paragraph.text, searchQuery.trim()),
        pageIndex: pageLookup.get(paragraph.key) ?? 0,
      }));
  }, [pageLookup, paragraphCatalog, searchQuery]);

  const noteEntries = useMemo(() => {
    return annotations
      .filter((annotation) => annotation.note?.trim())
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((annotation) => ({
        ...annotation,
        chapterTitle:
          sampleBookContent.chapters[annotation.chapterIndex]?.title ??
          `Bob ${annotation.chapterIndex + 1}`,
        pageIndex:
          pageLookup.get(paragraphKey(annotation.chapterIndex, annotation.paragraphIndex)) ?? 0,
      }));
  }, [annotations, pageLookup]);

  const selectedAnnotation = useMemo(() => {
    const selectionKey = getSelectionKey(selection);
    if (!selectionKey) return null;
    return (
      annotations.find(
        (annotation) =>
          getSelectionKey({
            chapterIndex: annotation.chapterIndex,
            paragraphIndex: annotation.paragraphIndex,
            startWordIndex: annotation.startWordIndex,
            endWordIndex: annotation.endWordIndex,
            text: annotation.text,
          }) === selectionKey
      ) ?? null
    );
  }, [annotations, selection]);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    toastTimerRef.current = setTimeout(() => {
      setToastMessage("");
    }, 1800);
  }, [toastOpacity]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    if (book && historyLoggedRef.current !== book.id) {
      historyLoggedRef.current = book.id;
      addHistory(book.id);
    }
  }, [addHistory, book]);

  useEffect(() => {
    let cancelled = false;
    if (!book) return;

    (async () => {
      try {
        const [prefsRaw, annotationsRaw] = await Promise.all([
          AsyncStorage.getItem(READER_PREFS_KEY),
          AsyncStorage.getItem(annotationsStorageKey(book.id)),
        ]);

        if (cancelled) return;

        if (prefsRaw) {
          try {
            const storedPrefs = JSON.parse(prefsRaw) as Partial<ReaderPrefs>;
            setPrefs({
              fontKey: storedPrefs.fontKey ?? DEFAULT_READER_PREFS.fontKey,
              pageTone: storedPrefs.pageTone ?? DEFAULT_READER_PREFS.pageTone,
            });
          } catch {
            setPrefs(DEFAULT_READER_PREFS);
          }
        } else {
          setPrefs(DEFAULT_READER_PREFS);
        }

        if (annotationsRaw) {
          try {
            setAnnotations(JSON.parse(annotationsRaw) as ReaderAnnotation[]);
          } catch {
            setAnnotations([]);
          }
        } else {
          setAnnotations([]);
        }
      } finally {
        if (!cancelled) {
          prefsLoadedRef.current = true;
          annotationsLoadedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
      prefsLoadedRef.current = false;
      annotationsLoadedRef.current = false;
    };
  }, [book]);

  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    AsyncStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [prefs]);

  useEffect(() => {
    if (!annotationsLoadedRef.current || !book) return;
    AsyncStorage.setItem(annotationsStorageKey(book.id), JSON.stringify(annotations)).catch(() => {});
  }, [annotations, book]);

  const jumpToPage = useCallback(
    (nextIndex: number, animated: boolean) => {
      if (!pages.length) return;
      const safeIndex = clamp(nextIndex, 0, pages.length - 1);
      const anchorKey = pages[safeIndex]?.anchorKey;
      if (anchorKey) {
        anchorKeyRef.current = anchorKey;
      }
      setPageIndex(safeIndex);
      listRef.current?.scrollToIndex({ index: safeIndex, animated });
    },
    [pages]
  );

  useEffect(() => {
    const layoutSignature = `${fontScale}:${lineHeightValue}:${prefs.fontKey}:${availH}`;
    if (!pages.length) return;

    if (!hydratedPagesRef.current) {
      hydratedPagesRef.current = true;
      layoutSignatureRef.current = layoutSignature;
      anchorKeyRef.current = pages[0].anchorKey;
      return;
    }

    if (layoutSignatureRef.current && layoutSignatureRef.current !== layoutSignature) {
      const nextIndex = findPageIndexByAnchor(pages, anchorKeyRef.current, pageIndex);
      requestAnimationFrame(() => {
        jumpToPage(nextIndex, false);
      });
    }

    layoutSignatureRef.current = layoutSignature;
  }, [availH, fontScale, jumpToPage, lineHeightValue, pageIndex, pages, prefs.fontKey]);

  useEffect(() => {
    if (!audio.bookId || audio.bookId !== book?.id) return;
    const t = audio.position;
    const match = pages.findIndex((page) => t >= page.startTime && t < page.endTime);
    if (match >= 0 && match !== lastSyncedPageRef.current) {
      lastSyncedPageRef.current = match;
      jumpToPage(match, true);
    }
  }, [audio.bookId, audio.position, book?.id, jumpToPage, pages]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === "number") {
        const nextIndex = first.index;
        setPageIndex(nextIndex);
        const nextAnchor = pagesRef.current[nextIndex]?.anchorKey;
        if (nextAnchor) {
          anchorKeyRef.current = nextAnchor;
        }
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Page-flip → page change. Same effect as onViewableItemsChanged so pagination,
  // progress and anchor tracking behave identically whichever pager is active.
  const handleFlipPageChange = useCallback((nextIndex: number) => {
    setPageIndex(nextIndex);
    const nextAnchor = pagesRef.current[nextIndex]?.anchorKey;
    if (nextAnchor) {
      anchorKeyRef.current = nextAnchor;
    }
  }, []);

  const openAudio = useCallback(() => {
    if (!book || !currentPage) return;
    saveBookmark({
      bookId: book.id,
      pageIndex,
      chapterIndex: currentPage.chapterIndex,
    });
    if (audio.bookId !== book.id) {
      startAudio(book.id, sampleBookContent.audioDuration);
      setAudioPosition(currentPage.startTime);
    }
    router.push(`/audio/${book.id}`);
  }, [audio.bookId, book, currentPage, pageIndex, saveBookmark, setAudioPosition, startAudio]);

  const resetSelection = useCallback(() => {
    setSelection(null);
    setNoteDraft("");
  }, []);

  const openSettings = useCallback(() => {
    setShowControls(true);
    setShowContents(false);
    setShowSearch(false);
    setShowNotes(false);
    resetSelection();
    setShowSettings(true);
  }, [resetSelection]);

  const openContents = useCallback(() => {
    setShowControls(true);
    setShowSettings(false);
    setShowSearch(false);
    setShowNotes(false);
    resetSelection();
    setShowContents(true);
  }, [resetSelection]);

  const openSearch = useCallback(() => {
    setShowControls(true);
    setShowSettings(false);
    setShowContents(false);
    setShowNotes(false);
    resetSelection();
    setSearchQuery(activeSearchQuery);
    setShowSearch(true);
  }, [activeSearchQuery, resetSelection]);

  const openNotes = useCallback(() => {
    setShowControls(true);
    setShowSettings(false);
    setShowContents(false);
    setShowSearch(false);
    resetSelection();
    setShowNotes(true);
  }, [resetSelection]);

  const handleWordLongPress = useCallback((paragraph: ParagraphRef, tokens: WordToken[], wordIndex: number) => {
    setSelection(buildSelection(paragraph, tokens, wordIndex, wordIndex));
    setShowControls(true);
    setShowSettings(false);
    setShowContents(false);
    setShowSearch(false);
  }, []);

  const handleWordPress = useCallback(
    (paragraph: ParagraphRef, tokens: WordToken[], wordIndex: number) => {
      if (!selection) return;
      if (
        selection.chapterIndex !== paragraph.chapterIndex ||
        selection.paragraphIndex !== paragraph.paragraphIndex
      ) {
        setSelection(buildSelection(paragraph, tokens, wordIndex, wordIndex));
        return;
      }
      setSelection(buildSelection(paragraph, tokens, selection.startWordIndex, wordIndex));
    },
    [selection]
  );

  const applyHighlight = useCallback(
    (color: HighlightTone) => {
      if (!book || !selection) return;
      setAnnotations((currentAnnotations) =>
        upsertAnnotation(currentAnnotations, book.id, selection, color, selectedAnnotation?.note)
      );
      showToast("Belgilandi");
      resetSelection();
    },
    [book, resetSelection, selection, selectedAnnotation?.note, showToast]
  );

  const saveNote = useCallback(() => {
    if (!book || !selection) return;
    const color = selectedAnnotation?.color ?? "yellow";
    setAnnotations((currentAnnotations) =>
      upsertAnnotation(currentAnnotations, book.id, selection, color, noteDraft)
    );
    setShowNoteModal(false);
    showToast("Eslatma saqlandi");
    resetSelection();
  }, [book, noteDraft, resetSelection, selectedAnnotation?.color, selection, showToast]);

  const copySelection = useCallback(async () => {
    if (!selection?.text) return;
    await Clipboard.setStringAsync(selection.text);
    showToast("Nusxalandi");
    resetSelection();
  }, [resetSelection, selection?.text, showToast]);

  const handleDecreaseFont = useCallback(() => {
    setFontScale(clamp(roundToStep(fontScale - 0.06, 0.02), 0.88, 1.42));
  }, [fontScale, setFontScale]);

  const handleIncreaseFont = useCallback(() => {
    setFontScale(clamp(roundToStep(fontScale + 0.06, 0.02), 0.88, 1.42));
  }, [fontScale, setFontScale]);

  const handleFontKeyChange = useCallback((fontKey: ReaderFontKey) => {
    setPrefs((current) => (current.fontKey === fontKey ? current : { ...current, fontKey }));
  }, []);

  const handlePageToneChange = useCallback((pageTone: PageToneKey) => {
    setPrefs((current) => (current.pageTone === pageTone ? current : { ...current, pageTone }));
  }, []);

  const jumpToSection = useCallback(
    (nextPageIndex: number, query?: string) => {
      jumpToPage(nextPageIndex, true);
      if (query) {
        setActiveSearchQuery(query.trim());
      }
      setShowContents(false);
      setShowSearch(false);
      setShowSettings(false);
      setShowNotes(false);
      setShowControls(true);
      resetSelection();
    },
    [jumpToPage, resetSelection]
  );

  // Single source of truth for a page tap: reset an open selection, else toggle
  // the top/bottom chrome. Used by the flip pager (via a composed Tap gesture) AND
  // the fallback FlatList (via the page Pressable) so behaviour is identical.
  const handlePageTap = useCallback(() => {
    if (selection) {
      resetSelection();
      return;
    }
    setShowControls((current) => !current);
  }, [selection, resetSelection]);

  // When the flip pager is active it owns taps through a real Gesture.Tap that is
  // exclusive with the pan — so the page Pressable must NOT also handle onPress
  // (two competing responders is what made controls flaky after a few flips).
  const usingFlip = ENABLE_PAGE_FLIP && Platform.OS !== "web" && pages.length > 0;

  const renderPage = useCallback(
    ({ item, index }: { item: Page; index: number }) => {
      if (item.isCover) {
        return (
          <Pressable
            onPress={usingFlip ? undefined : handlePageTap}
            style={[
              styles.page,
              {
                width: PAGE_W,
                paddingTop: insets.top + 84,
                paddingBottom: insets.bottom + 138,
              },
            ]}
          >
            <View style={styles.pageFrame}>
              <View
                style={[
                  styles.pagePaper,
                  {
                    backgroundColor: pageTheme.pageStart,
                    borderColor: pageTheme.pageBorder,
                    shadowColor: pageTheme.pageShadow,
                  },
                ]}
              >
                <LinearGradient
                  colors={[pageTheme.pageStart, pageTheme.pageEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <ReaderTitlePage
                  logoUrl={brandingLogoUrl}
                  appName={appName}
                  title={book?.title ?? ""}
                  authorName={author?.name ?? null}
                  year={bookYear}
                  category={book?.category ?? null}
                  backgroundColor="transparent"
                  textColor={pageTheme.text}
                  mutedColor={pageTheme.textMuted}
                  accentColor={palette.primary}
                />
              </View>
            </View>
          </Pressable>
        );
      }
      return (
      <Pressable
        onPress={usingFlip ? undefined : handlePageTap}
        style={[
          styles.page,
          {
            width: PAGE_W,
            paddingTop: insets.top + 84,
            paddingBottom: insets.bottom + 138,
          },
        ]}
      >
        <View style={styles.pageFrame}>
          <View
            style={[
              styles.pagePaper,
              {
                backgroundColor: pageTheme.pageStart,
                borderColor: pageTheme.pageBorder,
                shadowColor: pageTheme.pageShadow,
              },
            ]}
          >
            <LinearGradient
              colors={[pageTheme.pageStart, pageTheme.pageEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.pageInner}>
              {item.isChapterStart ? (
                <View style={styles.chapterHeader}>
                  <View style={[styles.chapterLine, { backgroundColor: palette.primary }]} />
                  <Text style={[styles.chapterKicker, { color: palette.primary }]}>{`BOB ${item.chapterIndex + 1}`}</Text>
                  <Text
                    style={[
                      styles.chapterTitle,
                      {
                        color: pageTheme.text,
                        fontSize: 26 * fontScale,
                        fontFamily,
                      },
                    ]}
                  >
                    {item.chapterTitle.replace(/^[IVX]+\.\s*/, "")}
                  </Text>
                  <View style={[styles.chapterLine, { marginTop: 20, width: 40, backgroundColor: palette.primary }]} />
                </View>
              ) : (
                <Text style={[styles.runningHead, { color: pageTheme.textMuted }]}>
                  {item.chapterTitle.toUpperCase()}
                </Text>
              )}

              {item.paragraphs.map((paragraph, paraIdx) => (
                <ReaderParagraph
                  key={paragraph.key}
                  paragraph={paragraph}
                  fontSize={17 * fontScale}
                  lineHeight={lineHeightValue}
                  fontFamily={fontFamily}
                  textColor={pageTheme.text}
                  annotations={annotationsByParagraph.get(paragraph.key) ?? []}
                  selection={selection}
                  searchQuery={activeSearchQuery}
                  selectionColor={pageTheme.selection}
                  searchHighlightColor={pageTheme.searchHighlight}
                  isDropCap={item.isChapterStart && paraIdx === 0 && paragraph.paragraphIndex === 0}
                  onWordLongPress={handleWordLongPress}
                  onWordPress={handleWordPress}
                />
              ))}
            </View>
            <View style={[styles.pageFoot, { borderTopColor: pageTheme.progressTrack }]}>
              <Text style={[styles.pageNumber, { color: pageTheme.text }]}>{index}</Text>
              <View style={[styles.pageDot, { backgroundColor: pageTheme.textMuted }]} />
              <Text style={[styles.pageTotal, { color: pageTheme.textMuted }]}>{Math.max(1, totalPages - 1)}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      );
    },
    [
      appName,
      brandingLogoUrl,
      author?.name,
      book?.title,
      book?.category,
      bookYear,
      activeSearchQuery,
      annotationsByParagraph,
      fontFamily,
      fontScale,
      handleWordLongPress,
      handleWordPress,
      insets.bottom,
      insets.top,
      lineHeightValue,
      pageTheme.pageBorder,
      pageTheme.pageEnd,
      pageTheme.pageShadow,
      pageTheme.pageStart,
      pageTheme.progressTrack,
      pageTheme.searchHighlight,
      pageTheme.selection,
      pageTheme.text,
      pageTheme.textMuted,
      handlePageTap,
      usingFlip,
      selection,
      totalPages,
    ]
  );

  if (!book) return null;

  return (
    <View style={[styles.container, { backgroundColor: pageTheme.appBackground }]}> 
      <LinearGradient
        colors={[pageTheme.appBackground, pageTheme.appAccent, pageTheme.appBackground]}
        style={StyleSheet.absoluteFillObject}
      />

      <View
        style={{ flex: 1 }}
        onLayout={(event) => {
          // Subtract: top padding (insets.top+84) + bottom padding (insets.bottom+138) + pageInner paddingTop(30) + footer(~50)
          const overhead = insets.top + insets.bottom + 302;
          const height = event.nativeEvent.layout.height - overhead;
          setAvailH((previous) => (Math.abs(previous - height) > 2 ? height : previous));
        }}
      >
        {IS_WEB ? (
          // Web: a premium, centred book column with a DOM-friendly page flip.
          <WebPageFlipReader
            pages={pages}
            currentPage={pageIndex}
            onPageChange={handleFlipPageChange}
            onTap={handlePageTap}
            renderPage={renderPage}
            pageWidth={PAGE_W}
          />
        ) : (
          <PageFlipEffect
            enabled={ENABLE_PAGE_FLIP}
            pages={pages}
            currentPage={pageIndex}
            onPageChange={handleFlipPageChange}
            onTap={handlePageTap}
            renderPage={renderPage}
            fallback={
              <FlatList
                ref={listRef}
                data={pages}
                keyExtractor={(_, index) => `reader-page-${index}`}
                renderItem={renderPage}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({ length: PAGE_W, offset: PAGE_W * index, index })}
                initialNumToRender={3}
                windowSize={5}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    listRef.current?.scrollToIndex({ index: info.index, animated: false });
                  }, 50);
                }}
              />
            }
          />
        )}
      </View>

      {showControls ? (
        <LinearGradient
          colors={[pageTheme.chrome, "transparent"]}
          style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.iconBtn, { backgroundColor: pageTheme.iconBg, borderColor: pageTheme.chromeBorder }]}
            >
              <ChevronLeft color={pageTheme.text} size={20} />
            </Pressable>

            <View style={styles.topTitleWrap}>
              <Text style={[styles.topKicker, { color: pageTheme.textMuted }]} numberOfLines={1}>
                {author?.name?.toUpperCase()}
              </Text>
              <Text style={[styles.topTitle, { color: pageTheme.text }]} numberOfLines={1}>
                {book.title}
              </Text>
            </View>

            <View style={styles.toolbarActions}>
              <Pressable
                onPress={openSettings}
                style={[styles.iconBtn, { backgroundColor: pageTheme.iconBg, borderColor: pageTheme.chromeBorder }]}
              >
                <Settings2 color={showSettings ? palette.primary : pageTheme.textDim} size={17} />
              </Pressable>
              <Pressable
                onPress={openContents}
                style={[styles.iconBtn, { backgroundColor: pageTheme.iconBg, borderColor: pageTheme.chromeBorder }]}
              >
                <List color={showContents ? palette.primary : pageTheme.textDim} size={17} />
              </Pressable>
              <Pressable
                onPress={openSearch}
                style={[styles.iconBtn, { backgroundColor: pageTheme.iconBg, borderColor: pageTheme.chromeBorder }]}
              >
                <Search color={showSearch ? palette.primary : pageTheme.textDim} size={17} />
              </Pressable>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: pageTheme.progressTrack }]}> 
            <View
              style={[
                styles.progressFill,
                { width: `${((pageIndex + 1) / Math.max(1, totalPages)) * 100}%`, backgroundColor: palette.primary },
              ]}
            />
          </View>
        </LinearGradient>
      ) : null}

      {book.audioAvailable ? (
        <MiniPlayer
          bookTitle={book.title}
          chapterTitle={pages[pageIndex]?.chapterTitle ?? ""}
          playing={audio.playing && audio.bookId === book.id}
          progress={audio.bookId === book.id && audio.duration > 0 ? audio.position / audio.duration : 0}
          onPlay={() => {
            if (audio.bookId !== book.id) {
              startAudio(book.id, sampleBookContent.audioDuration);
              const page = pages[pageIndex];
              if (page) {
                setAudioPosition(page.startTime);
              }
            } else {
              togglePlay();
            }
          }}
          onExpand={openAudio}
          bottomOffset={insets.bottom}
          pageTheme={pageTheme}
        />
      ) : null}

      {selection ? (
        <TextActionMenu
          selectionText={selection.text}
          bottomOffset={insets.bottom + (book.audioAvailable ? 104 : 24)}
          pageTheme={pageTheme}
          selectedColor={selectedAnnotation?.color}
          onHighlight={applyHighlight}
          onAddNote={() => {
            setNoteDraft(selectedAnnotation?.note ?? "");
            setShowNoteModal(true);
          }}
          onCopy={copySelection}
          onClose={resetSelection}
        />
      ) : null}

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        insetsBottom={insets.bottom}
        pageTheme={pageTheme}
        fontScale={fontScale}
        onDecreaseFont={handleDecreaseFont}
        onIncreaseFont={handleIncreaseFont}
        fontKey={prefs.fontKey}
        onFontKeyChange={handleFontKeyChange}
        pageTone={prefs.pageTone}
        onPageToneChange={handlePageToneChange}
        noteCount={noteEntries.length}
        highlightCount={annotations.length}
        onOpenNotes={openNotes}
      />

      <ContentsSheet
        visible={showContents}
        onClose={() => setShowContents(false)}
        insetsBottom={insets.bottom}
        pageTheme={pageTheme}
        currentChapterIndex={currentChapterIndex}
        currentSectionKey={currentSectionKey}
        contents={contents}
        onJump={jumpToSection}
      />

      <SearchSheet
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        insetsBottom={insets.bottom}
        pageTheme={pageTheme}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        results={searchResults}
        onJump={(result) => jumpToSection(result.pageIndex, searchQuery)}
      />

      <NotesSheet
        visible={showNotes}
        onClose={() => setShowNotes(false)}
        insetsBottom={insets.bottom}
        pageTheme={pageTheme}
        noteEntries={noteEntries}
        onJump={(page) => jumpToSection(page)}
      />

      <NoteModal
        visible={showNoteModal}
        pageTheme={pageTheme}
        selectedText={selection?.text ?? ""}
        noteDraft={noteDraft}
        onChangeNote={setNoteDraft}
        onClose={() => setShowNoteModal(false)}
        onSave={saveNote}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            opacity: toastOpacity,
            backgroundColor: pageTheme.toastBg,
            bottom: insets.bottom + (book.audioAvailable ? 118 : 36),
          },
        ]}
      >
        <Text style={[styles.toastText, { color: pageTheme.toastText }]}>{toastMessage}</Text>
      </Animated.View>
    </View>
  );
}

const ReaderParagraph = memo(function ReaderParagraph({
  paragraph,
  fontSize,
  lineHeight,
  fontFamily,
  textColor,
  annotations,
  selection,
  searchQuery,
  selectionColor,
  searchHighlightColor,
  isDropCap,
  onWordLongPress,
  onWordPress,
}: {
  paragraph: ParagraphRef;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  textColor: string;
  annotations: ReaderAnnotation[];
  selection: ReaderSelection | null;
  searchQuery: string;
  selectionColor: string;
  searchHighlightColor: string;
  isDropCap?: boolean;
  onWordLongPress: (paragraph: ParagraphRef, tokens: WordToken[], wordIndex: number) => void;
  onWordPress: (paragraph: ParagraphRef, tokens: WordToken[], wordIndex: number) => void;
}) {
  // useMemo must be called unconditionally (hooks rule)
  const tokens = useMemo(() => tokenizeParagraph(paragraph.text), [paragraph.text]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const selectionActive =
    selection &&
    selection.chapterIndex === paragraph.chapterIndex &&
    selection.paragraphIndex === paragraph.paragraphIndex;

  const bodyStyle = {
    color: textColor,
    fontSize,
    lineHeight: fontSize * lineHeight,
    fontFamily,
  };

  // Render image block
  if (paragraph.imageUri) {
    const imgW = SCREEN_W - 112;
    const imgH = Math.round(imgW * 0.6);
    return (
      <View style={{ marginBottom: fontSize * 1.2, alignItems: "center" }}>
        <Image
          source={{ uri: paragraph.imageUri }}
          style={{
            width: imgW,
            height: imgH,
            borderRadius: 12,
            backgroundColor: "rgba(128,128,128,0.12)",
          }}
          resizeMode="cover"
        />
        {paragraph.imageCaption ? (
          <Text
            style={{
              marginTop: 8,
              fontSize: fontSize * 0.82,
              color: textColor,
              opacity: 0.55,
              fontFamily,
              textAlign: "center",
            }}
          >
            {paragraph.imageCaption}
          </Text>
        ) : null}
      </View>
    );
  }

  const renderTokens = (tokenList: WordToken[]) =>
    tokenList.map((token) => {
      const annotation = findHighlightAtWord(annotations, token.index);
      const isSelected =
        selectionActive &&
        token.index >= selection.startWordIndex &&
        token.index <= selection.endWordIndex;
      const isSearchMatch = !!normalizedSearch && token.plain.includes(normalizedSearch);
      const backgroundColor = isSelected
        ? selectionColor
        : annotation
          ? HIGHLIGHT_COLORS[annotation.color].bg
          : isSearchMatch
            ? searchHighlightColor
            : "transparent";

      return (
        <Text
          key={`${paragraph.key}-${token.index}`}
          onLongPress={() => onWordLongPress(paragraph, tokens, token.index)}
          onPress={selection ? () => onWordPress(paragraph, tokens, token.index) : undefined}
          suppressHighlighting
          style={{ backgroundColor, color: textColor }}
        >
          {token.raw}
        </Text>
      );
    });

  if (isDropCap && tokens.length > 0) {
    const dropCapChar = tokens[0].raw[0] ?? "";
    const firstTokenRest = tokens[0].raw.slice(1);
    const dropCapSize = fontSize * 3.4;
    const dropCapLineH = fontSize * 3.0;

    return (
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: fontSize * 1.02 }}>
        <Text
          style={{
            fontSize: dropCapSize,
            lineHeight: dropCapLineH,
            color: palette.primary,
            fontFamily,
            includeFontPadding: false,
          }}
        >
          {dropCapChar}
        </Text>
        <Text
          style={[
            styles.body,
            { ...bodyStyle, flex: 1, marginBottom: 0, marginLeft: 6 },
          ]}
        >
          <Text style={{ color: textColor }}>{firstTokenRest}</Text>
          {renderTokens(tokens.slice(1))}
        </Text>
      </View>
    );
  }

  return (
    <Text
      style={[
        styles.body,
        {
          ...bodyStyle,
          marginBottom: fontSize * 1.02,
        },
      ]}
    >
      {renderTokens(tokens)}
    </Text>
  );
});

const SettingsSheet = memo(function SettingsSheet({
  visible,
  onClose,
  insetsBottom,
  pageTheme,
  fontScale,
  onDecreaseFont,
  onIncreaseFont,
  fontKey,
  onFontKeyChange,
  pageTone,
  onPageToneChange,
  noteCount,
  highlightCount,
  onOpenNotes,
}: {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  pageTheme: (typeof PAGE_THEMES)[PageToneKey];
  fontScale: number;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  fontKey: ReaderFontKey;
  onFontKeyChange: (value: ReaderFontKey) => void;
  pageTone: PageToneKey;
  onPageToneChange: (value: PageToneKey) => void;
  noteCount: number;
  highlightCount: number;
  onOpenNotes: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: pageTheme.bottomSheet,
              borderColor: pageTheme.chromeBorder,
              paddingBottom: insetsBottom + 18,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: pageTheme.text }]}>Sozlamalar</Text>
            <Pressable onPress={onClose} style={[styles.sheetClose, { borderColor: pageTheme.chromeBorder }]}>
              <X color={pageTheme.textDim} size={18} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <SettingsSection title="Matn kattaligi" subtitle="O'zgarishlar darhol qo'llanadi" theme={pageTheme}>
              <View style={styles.stepperRow}>
                <Pressable onPress={onDecreaseFont} style={[styles.typeStepButton, { borderColor: pageTheme.chromeBorder, backgroundColor: pageTheme.bottomSheetSecondary }]}> 
                  <Text style={[styles.typeStepLabel, { color: pageTheme.text }]}>A-</Text>
                </Pressable>
                <View style={[styles.valuePill, { backgroundColor: pageTheme.bottomSheetSecondary, borderColor: pageTheme.chromeBorder }]}>
                  <Text style={[styles.valuePillText, { color: pageTheme.text }]}>{Math.round(fontScale * 100)}%</Text>
                </View>
                <Pressable onPress={onIncreaseFont} style={[styles.typeStepButton, { borderColor: pageTheme.chromeBorder, backgroundColor: pageTheme.bottomSheetSecondary }]}> 
                  <Text style={[styles.typeStepLabel, { color: pageTheme.text }]}>A+</Text>
                </Pressable>
              </View>
            </SettingsSection>

            <SettingsSection title="Shrift tanlash" subtitle="O'qish uslubini tanlang" theme={pageTheme}>
              <View style={styles.optionGrid}>
                {FONT_OPTIONS.map((option) => {
                  const active = fontKey === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => onFontKeyChange(option.key)}
                      style={[
                        styles.optionCard,
                        {
                          backgroundColor: pageTheme.chipBg,
                          borderColor: active ? palette.primary : pageTheme.chipBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.optionCardTitle, { color: active ? palette.primary : pageTheme.text, fontFamily: getFontFamily(option.key) }]}> 
                        {option.label}
                      </Text>
                      <Text style={[styles.optionCardSubtitle, { color: pageTheme.textMuted }]}>{option.description}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SettingsSection>

            <SettingsSection title="Sahifa rangi" subtitle="Sahifa kayfiyatiga moslang" theme={pageTheme}>
              <View style={styles.optionGrid}>
                {PAGE_THEME_OPTIONS.map((option) => {
                  const active = pageTone === option.key;
                  const optionTheme = PAGE_THEMES[option.key];
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => onPageToneChange(option.key)}
                      style={[
                        styles.optionCard,
                        {
                          backgroundColor: optionTheme.pageStart,
                          borderColor: active ? palette.primary : optionTheme.pageBorder,
                        },
                      ]}
                    >
                      {active ? <View style={styles.selectedIndicator} /> : null}
                      <View style={[styles.pageTonePreview, { backgroundColor: optionTheme.pageEnd, borderColor: optionTheme.pageBorder }]} />
                      <Text style={[styles.optionCardTitle, { color: optionTheme.text }]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SettingsSection>

            <SettingsSection
              title="Eslatmalar va belgilashlar"
              subtitle="Ushbu qurilmada saqlanadi"
              theme={pageTheme}
            >
              <Pressable
                onPress={onOpenNotes}
                style={[
                  styles.notesLaunch,
                  {
                    backgroundColor: pageTheme.bottomSheetSecondary,
                    borderColor: pageTheme.chromeBorder,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notesLaunchTitle, { color: pageTheme.text }]}>Saqlangan eslatmalar</Text>
                  <Text style={[styles.notesLaunchSubtitle, { color: pageTheme.textMuted }]}>
                    {`${noteCount} ta eslatma • ${highlightCount} ta belgilash`}
                  </Text>
                </View>
                <Text style={[styles.notesLaunchAction, { color: palette.primary }]}>Ochish</Text>
              </Pressable>
            </SettingsSection>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

function ContentsSheet({
  visible,
  onClose,
  insetsBottom,
  pageTheme,
  currentChapterIndex,
  currentSectionKey,
  contents,
  onJump,
}: {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  pageTheme: (typeof PAGE_THEMES)[PageToneKey];
  currentChapterIndex: number;
  currentSectionKey: string | null;
  contents: {
    chapterIndex: number;
    chapterTitle: string;
    pageIndex: number;
    sections: { id: string; label: string; pageIndex: number; paragraphIndex: number }[];
  }[];
  onJump: (pageIndex: number) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: pageTheme.bottomSheet,
              borderColor: pageTheme.chromeBorder,
              paddingBottom: insetsBottom + 18,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: pageTheme.text }]}>Mundarija</Text>
            <Pressable onPress={onClose} style={[styles.sheetClose, { borderColor: pageTheme.chromeBorder }]}>
              <X color={pageTheme.textDim} size={18} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            {contents.map((chapter) => {
              const activeChapter = chapter.chapterIndex === currentChapterIndex;
              return (
                <View key={chapter.chapterTitle} style={styles.contentsBlock}>
                  <Pressable
                    onPress={() => onJump(chapter.pageIndex)}
                    style={[
                      styles.contentsChapter,
                      {
                        backgroundColor: activeChapter ? pageTheme.bottomSheetSecondary : "transparent",
                        borderColor: activeChapter ? palette.primary : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.contentsChapterText, { color: activeChapter ? palette.primary : pageTheme.text }]}>
                      {chapter.chapterTitle}
                    </Text>
                  </Pressable>
                  {chapter.sections.map((section) => {
                    const activeSection = currentSectionKey === section.id;
                    return (
                      <Pressable
                        key={section.id}
                        onPress={() => onJump(section.pageIndex)}
                        style={[
                          styles.contentsSection,
                          { backgroundColor: activeSection ? pageTheme.bottomSheetSecondary : "transparent" },
                        ]}
                      >
                        <Text style={[styles.contentsSectionText, { color: activeSection ? palette.primary : pageTheme.textDim }]}>
                          {section.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SearchSheet({
  visible,
  onClose,
  insetsBottom,
  pageTheme,
  query,
  onQueryChange,
  results,
  onJump,
}: {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  pageTheme: (typeof PAGE_THEMES)[PageToneKey];
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResult[];
  onJump: (result: SearchResult) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetKeyboardWrap}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: pageTheme.bottomSheet,
                borderColor: pageTheme.chromeBorder,
                paddingBottom: insetsBottom + 18,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: pageTheme.text }]}>Kitob ichidan qidirish</Text>
              <Pressable onPress={onClose} style={[styles.sheetClose, { borderColor: pageTheme.chromeBorder }]}>
                <X color={pageTheme.textDim} size={18} />
              </Pressable>
            </View>
            <View style={[styles.searchInputWrap, { backgroundColor: pageTheme.bottomSheetSecondary, borderColor: pageTheme.chromeBorder }]}> 
              <Search color={pageTheme.textMuted} size={16} />
              <TextInput
                value={query}
                onChangeText={onQueryChange}
                placeholder="So'z yoki ibora qidiring"
                placeholderTextColor={pageTheme.textMuted}
                style={[styles.searchInput, { color: pageTheme.text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              {query.trim() ? (
                results.length ? (
                  results.map((result) => (
                    <Pressable
                      key={result.id}
                      onPress={() => onJump(result)}
                      style={[styles.searchResult, { backgroundColor: pageTheme.bottomSheetSecondary, borderColor: pageTheme.chromeBorder }]}
                    >
                      <Text style={[styles.searchResultTitle, { color: pageTheme.text }]}>{result.chapterTitle}</Text>
                      <Text style={[styles.searchResultPreview, { color: pageTheme.textDim }]}>{result.preview}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={[styles.emptyState, { color: pageTheme.textMuted }]}>Natija topilmadi</Text>
                )
              ) : (
                <Text style={[styles.emptyState, { color: pageTheme.textMuted }]}>Qidiruv uchun so'z kiriting</Text>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function NotesSheet({
  visible,
  onClose,
  insetsBottom,
  pageTheme,
  noteEntries,
  onJump,
}: {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  pageTheme: (typeof PAGE_THEMES)[PageToneKey];
  noteEntries: (
    ReaderAnnotation & {
      chapterTitle: string;
      pageIndex: number;
    }
  )[];
  onJump: (pageIndex: number) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: pageTheme.bottomSheet,
              borderColor: pageTheme.chromeBorder,
              paddingBottom: insetsBottom + 18,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: pageTheme.text }]}>Qaydlar</Text>
            <Pressable onPress={onClose} style={[styles.sheetClose, { borderColor: pageTheme.chromeBorder }]}> 
              <X color={pageTheme.textDim} size={18} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            {noteEntries.length ? (
              noteEntries.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() => onJump(entry.pageIndex)}
                  style={[
                    styles.noteListCard,
                    {
                      backgroundColor: pageTheme.bottomSheetSecondary,
                      borderColor: pageTheme.chromeBorder,
                    },
                  ]}
                >
                  <View style={styles.noteListHeader}>
                    <View
                      style={[
                        styles.noteColorDot,
                        { backgroundColor: HIGHLIGHT_COLORS[entry.color].dot },
                      ]}
                    />
                    <Text style={[styles.noteListTitle, { color: pageTheme.text }]} numberOfLines={1}>
                      {entry.chapterTitle}
                    </Text>
                    <Text style={[styles.noteListMeta, { color: pageTheme.textMuted }]}>{`Sahifa ${entry.pageIndex + 1}`}</Text>
                  </View>
                  <Text style={[styles.noteListQuote, { color: pageTheme.textDim }]} numberOfLines={3}>
                    {entry.text}
                  </Text>
                  <Text style={[styles.noteListBody, { color: pageTheme.text }]} numberOfLines={4}>
                    {entry.note}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.emptyState, { color: pageTheme.textMuted }]}>Hozircha eslatmalar yo'q</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NoteModal({
  visible,
  pageTheme,
  selectedText,
  noteDraft,
  onChangeNote,
  onClose,
  onSave,
}: {
  visible: boolean;
  pageTheme: (typeof PAGE_THEMES)[PageToneKey];
  selectedText: string;
  noteDraft: string;
  onChangeNote: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.centerModalWrap}>
          <Pressable
            style={[styles.noteCard, { backgroundColor: pageTheme.bottomSheet, borderColor: pageTheme.chromeBorder }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.noteHeader}>
              <Text style={[styles.noteTitle, { color: pageTheme.text }]}>Qayd qo'shish</Text>
              <Pressable onPress={onClose} style={[styles.sheetClose, { borderColor: pageTheme.chromeBorder }]}> 
                <X color={pageTheme.textDim} size={18} />
              </Pressable>
            </View>
            <View style={[styles.notePreview, { backgroundColor: pageTheme.bottomSheetSecondary, borderColor: pageTheme.chromeBorder }]}> 
              <Text style={[styles.notePreviewText, { color: pageTheme.text }]} numberOfLines={4}>
                {selectedText}
              </Text>
            </View>
            <TextInput
              value={noteDraft}
              onChangeText={onChangeNote}
              placeholder="Qaydni yozing"
              placeholderTextColor={pageTheme.textMuted}
              multiline
              textAlignVertical="top"
              style={[
                styles.noteInput,
                {
                  color: pageTheme.text,
                  borderColor: pageTheme.chromeBorder,
                  backgroundColor: pageTheme.bottomSheetSecondary,
                },
              ]}
            />
            <Pressable onPress={onSave} style={[styles.saveNoteButton, { backgroundColor: palette.primary }]}> 
              <Text style={styles.saveNoteText}>Saqlash</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function SettingsSection({
  title,
  subtitle,
  theme,
  children,
}: {
  title: string;
  subtitle: string;
  theme: (typeof PAGE_THEMES)[PageToneKey];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingsSection}>
      <Text style={[styles.settingsTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.settingsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      {children}
    </View>
  );
}

function TextActionMenu({
  selectionText,
  bottomOffset,
  pageTheme,
  selectedColor,
  onHighlight,
  onAddNote,
  onCopy,
  onClose,
}: {
  selectionText: string;
  bottomOffset: number;
  pageTheme: (typeof PAGE_THEMES)[PageToneKey];
  selectedColor?: HighlightTone;
  onHighlight: (color: HighlightTone) => void;
  onAddNote: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.actionMenuWrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={[styles.actionMenu, { backgroundColor: pageTheme.chrome, borderColor: pageTheme.chromeBorder }]}> 
        <View style={styles.actionMenuHeader}>
          <Text style={[styles.actionMenuPreview, { color: pageTheme.text }]} numberOfLines={2}>
            {selectionText}
          </Text>
          <Pressable onPress={onClose} style={[styles.actionMenuClose, { borderColor: pageTheme.chromeBorder }]}> 
            <X color={pageTheme.textMuted} size={14} />
          </Pressable>
        </View>
        <View style={styles.highlightRow}>
          {HIGHLIGHT_OPTIONS.map((option) => {
            const active = selectedColor === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => onHighlight(option.key)}
                style={[
                  styles.highlightChip,
                  {
                    backgroundColor: active ? HIGHLIGHT_COLORS[option.key].bg : pageTheme.bottomSheetSecondary,
                    borderColor: active ? HIGHLIGHT_COLORS[option.key].dot : pageTheme.chromeBorder,
                  },
                ]}
              >
                <View style={[styles.highlightDot, { backgroundColor: HIGHLIGHT_COLORS[option.key].dot }]} />
                <Text style={[styles.highlightChipText, { color: pageTheme.text }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.secondaryActionRow}>
          <Pressable onPress={onAddNote} style={[styles.secondaryAction, { backgroundColor: pageTheme.bottomSheetSecondary, borderColor: pageTheme.chromeBorder }]}> 
            <Text style={[styles.secondaryActionText, { color: pageTheme.text }]}>Qayd qo'shish</Text>
          </Pressable>
          <Pressable onPress={onCopy} style={[styles.secondaryAction, { backgroundColor: pageTheme.bottomSheetSecondary, borderColor: pageTheme.chromeBorder }]}> 
            <Copy color={pageTheme.textDim} size={14} />
            <Text style={[styles.secondaryActionText, { color: pageTheme.text }]}>Nusxalash</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MiniPlayer({
  bookTitle,
  chapterTitle,
  playing,
  progress,
  onPlay,
  onExpand,
  bottomOffset,
  pageTheme,
}: {
  bookTitle: string;
  chapterTitle: string;
  playing: boolean;
  progress: number;
  onPlay: () => void;
  onExpand: () => void;
  bottomOffset: number;
  pageTheme: (typeof PAGE_THEMES)[PageToneKey];
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing) {
      pulse.stopAnimation();
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [playing, pulse]);

  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });

  return (
    <View style={[miniStyles.wrap, { bottom: bottomOffset + 14 }]} pointerEvents="box-none">
      <Pressable onPress={onExpand} style={[miniStyles.card, { borderColor: pageTheme.chromeBorder, backgroundColor: pageTheme.chrome }]}> 
        <LinearGradient
          colors={[pageTheme.chrome, pageTheme.bottomSheetSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={miniStyles.inner}>
          <Animated.View style={[miniStyles.coverDot, { opacity: glow, backgroundColor: pageTheme.selection, borderColor: pageTheme.chromeBorder }]}> 
            <Headphones color={palette.primary} size={16} />
          </Animated.View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text numberOfLines={1} style={[miniStyles.title, { color: pageTheme.text }]}>
              {bookTitle}
            </Text>
            <Text numberOfLines={1} style={[miniStyles.chapter, { color: pageTheme.textMuted }]}>
              {chapterTitle || "Audio kitob"}
            </Text>
            <View style={[miniStyles.track, { backgroundColor: pageTheme.progressTrack }]}> 
              <View style={[miniStyles.fill, { width: `${Math.max(3, progress * 100)}%`, backgroundColor: palette.primary }]} />
            </View>
          </View>
          <PressableScale onPress={onPlay} style={miniStyles.playBtn}>
            {playing ? (
              <Pause color="#FFFFFF" size={18} fill="#FFFFFF" />
            ) : (
              <Play color="#FFFFFF" size={18} fill="#FFFFFF" style={{ marginLeft: 2 }} />
            )}
          </PressableScale>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: "center",
  },
  pageFrame: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 18,
  },
  pagePaper: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  pageInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 30,
  },
  coverInner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 44,
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverBrand: {
    alignItems: "center",
    gap: 12,
  },
  coverWordmark: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 3,
    fontFamily: FONT.serif,
  },
  coverCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  coverRule: {
    width: 48,
    height: 2,
    borderRadius: 2,
    marginBottom: 26,
    opacity: 0.85,
  },
  coverTitle: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "800",
    textAlign: "center",
  },
  coverAuthor: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  coverYear: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
  chapterHeader: {
    marginBottom: 28,
  },
  chapterLine: {
    width: 60,
    height: 1,
    opacity: 0.6,
    marginBottom: 18,
  },
  chapterKicker: {
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "700",
    marginBottom: 10,
  },
  chapterTitle: {
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  runningHead: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: 20,
  },
  body: {
    textAlign: Platform.OS === "web" ? "left" : "justify",
  },
  pageFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
    borderTopWidth: 1,
  },
  pageNumber: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pageDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  pageTotal: {
    fontSize: 11,
    letterSpacing: 1,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  topTitleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  topKicker: {
    fontSize: 9,
    letterSpacing: 2.4,
    fontWeight: "700",
  },
  topTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  toolbarActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  progressTrack: {
    marginTop: 14,
    marginHorizontal: 20,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.22)",
    justifyContent: "flex-end",
  },
  sheetKeyboardWrap: {
    justifyContent: "flex-end",
  },
  centerModalWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  sheet: {
    maxHeight: SCREEN_H * 0.82,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.14)",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sheetContent: {
    paddingBottom: 20,
    gap: 18,
  },
  settingsSection: {
    gap: 10,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  settingsSubtitle: {
    fontSize: 12,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  typeStepButton: {
    width: 56,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  typeStepLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  valuePill: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  valuePillText: {
    fontSize: 14,
    fontWeight: "700",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    position: "relative",
  },
  optionCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  optionCardSubtitle: {
    fontSize: 11,
  },
  notesLaunch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  notesLaunchTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  notesLaunchSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  notesLaunchAction: {
    fontSize: 12,
    fontWeight: "700",
  },
  pageTonePreview: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  selectedIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.primary,
  },
  contentsBlock: {
    gap: 4,
  },
  contentsChapter: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  contentsChapterText: {
    fontSize: 14,
    fontWeight: "700",
  },
  contentsSection: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 10,
  },
  contentsSectionText: {
    fontSize: 12,
    lineHeight: 18,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchResult: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchResultPreview: {
    fontSize: 12,
    lineHeight: 18,
  },
  emptyState: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 28,
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  notePreview: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  notePreviewText: {
    fontSize: 13,
    lineHeight: 20,
  },
  noteListCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  noteListHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noteColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  noteListTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  noteListMeta: {
    fontSize: 11,
    fontWeight: "600",
  },
  noteListQuote: {
    fontSize: 12,
    lineHeight: 18,
  },
  noteListBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  noteInput: {
    minHeight: 130,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
  },
  saveNoteButton: {
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveNoteText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  actionMenuWrap: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  actionMenu: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  actionMenuHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  actionMenuPreview: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  actionMenuClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  highlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  highlightChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  highlightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  highlightChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: {
    fontSize: 12,
    fontWeight: "700",
  },
});

const miniStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  card: {
    height: 72,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  coverDot: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  chapter: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  track: {
    marginTop: 8,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  fill: {
    height: 2,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
});
