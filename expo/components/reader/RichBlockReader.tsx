import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  List,
  Lock,
  Search,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react-native";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "@/components/ui";
import { palette } from "@/constants/colors";
import { useBookContent } from "@/hooks/useBookContent";
import { useContentAccess } from "@/hooks/usePayments";
import { useApp } from "@/providers/AppProvider";
import { recordReading } from "@/lib/shelfStore";
import { scopedKey } from "@/lib/userStorage";
import PageFlipEffect from "@/components/reader/PageFlipEffect";
import GitHubPageCurlEffect from "@/components/reader/GitHubPageCurlEffect";
import ReaderTitlePage from "@/components/reader/ReaderTitlePage";
import { useBranding } from "@/providers/BrandingProvider";
import type { BlockType, BookContentBlock, BookTocItem } from "@/types/database";

// Book-like page-flip animation over the existing paged reader. Flip to `false`
// to instantly restore the classic swipe pager (also auto-falls back on web or
// if the effect errors).
const ENABLE_PAGE_FLIP = true;
// Which flip engine: "github" keeps the real book-fold curl; the vendored
// engine below is tuned to stay responsive on long books.
const PAGE_FLIP_ENGINE = "github" as "github" | "smooth";
const FlipEngine = PAGE_FLIP_ENGINE === "github" ? GitHubPageCurlEffect : PageFlipEffect;

// ─── Theme ───────────────────────────────────────────────────────────────────

type ReaderTheme = "white" | "sepia" | "dark";
type FontFamily = "serif" | "sans";

interface ThemeColors {
  bg: string;
  paper: string;
  text: string;
  textMuted: string;
  accent: string;
  chapterLine: string;
  quoteBg: string;
  quoteBar: string;
}

const THEMES: Record<ReaderTheme, ThemeColors> = {
  white: {
    bg: "#F5F1EA",
    paper: "#FFFFFF",
    text: "#111111",
    textMuted: "#666666",
    accent: palette.primary,
    chapterLine: "rgba(46,125,50,0.18)",
    quoteBg: "#F0F8F0",
    quoteBar: palette.primary,
  },
  sepia: {
    bg: "#EDE3D0",
    paper: "#F8F1E4",
    text: "#3B2A1A",
    textMuted: "#7A5C3A",
    accent: "#7A5C3A",
    chapterLine: "rgba(122,92,58,0.22)",
    quoteBg: "#F5EDD8",
    quoteBar: "#9C6D32",
  },
  dark: {
    bg: "#111111",
    paper: "#1C1C1E",
    text: "#E8E2D9",
    textMuted: "#999999",
    accent: "#81C784",
    chapterLine: "rgba(129,199,132,0.20)",
    quoteBg: "#1E2A1E",
    quoteBar: "#81C784",
  },
};

type ReadingMode = "paged" | "scroll";

const FONTS: Record<FontFamily, string> = {
  serif: FONT.serif,
  sans: FONT.sans,
};

const FONT_SIZES = [0.82, 0.9, 1.0, 1.1, 1.2, 1.32] as const;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const STORAGE_THEME_KEY = "richreader.theme";
const STORAGE_FONT_KEY = "richreader.font";
const STORAGE_POS_PREFIX = "richreader.pos.";

// ─── Utilities ───────────────────────────────────────────────────────────────

function sanitizeMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (t.startsWith("%%%")) return t.replace(/^%%%+\s*/, "");
      if (t.startsWith("^^^")) return t.replace(/^\^\^\^+\s*/, "");
      return line;
    })
    .join("\n");
}

/** Normalise a heading/title string for comparison: drop markdown/markers,
 *  punctuation and case so "# Sensiz avgust o'tmadi…" == "Sensiz avgust o'tmadi". */
function normalizeTitleForMatch(text: string): string {
  return text
    .replace(/^[#>*\s]+/, "")
    .replace(/^%%%+\s*/, "")
    .replace(/^\^\^\^+\s*/, "")
    .replace(/[.…·:;!?"'“”‘’]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when the reader's FIRST content block is just the book title repeated —
 *  so we hide it (the branding title page already shows the title). */
function firstBlockDuplicatesTitle(block: BookContentBlock | undefined, bookTitle: string): boolean {
  if (!block || !bookTitle) return false;
  const raw = block.title ?? block.content ?? "";
  if (!raw.trim()) return false;
  const a = normalizeTitleForMatch(raw);
  const b = normalizeTitleForMatch(bookTitle);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function parseCleanedContent(content: string): BookContentBlock[] {
  const lines = content.split("\n");
  const blocks: BookContentBlock[] = [];
  let order = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("%%%")) {
      const title = trimmed.replace(/^%%%+\s*/, "").trim();
      if (!title) continue;
      blocks.push({
        id: `_fallback_${order}`,
        book_id: "",
        block_type: "chapter",
        sort_order: order++,
        anchor_id: `_ch_${order}`,
        title,
        content: null,
        media_url: null,
        media_caption: null,
        media_alt: null,
        metadata: null,
      });
    } else if (trimmed.startsWith("^^^")) {
      const title = trimmed.replace(/^\^\^\^+\s*/, "").trim();
      if (!title) continue;
      blocks.push({
        id: `_fallback_${order}`,
        book_id: "",
        block_type: "topic",
        sort_order: order++,
        anchor_id: `_tp_${order}`,
        title,
        content: null,
        media_url: null,
        media_caption: null,
        media_alt: null,
        metadata: null,
      });
    } else {
      blocks.push({
        id: `_fallback_${order}`,
        book_id: "",
        block_type: "paragraph",
        sort_order: order++,
        anchor_id: null,
        title: null,
        content: trimmed,
        media_url: null,
        media_caption: null,
        media_alt: null,
        metadata: null,
      });
    }
  }

  return blocks;
}

// ─── Page grouping ────────────────────────────────────────────────────────────

interface ReaderPage {
  id: string;
  blocks: BookContentBlock[];
  pageIndex: number;
  isCover?: boolean;
  /** Synthetic branding/title page shown as the very first page (page 0). */
  isTitle?: boolean;
}

/** Ekran o'lchamiga asoslangan sahifalash konfiguratsiyasi */
interface PaginationConfig {
  availableH: number;  // kontent uchun mavjud piksel balandlik
  lineH: number;       // bir qatorning balandligi (fontSize * 1.55)
  charsPerLine: number; // bir qatordagi taxminiy belgilar soni
}

/**
 * Matn nechta vizual qatorni egallashini taxminlaydi.
 * MUHIM: matn ichidagi qator uzilishlari (\n) ham alohida qator sifatida
 * hisoblanadi — aks holda ko'p paragrafli blok balandligi keskin
 * kam baholanadi va matn sahifadan tashqariga chiqib ketadi (qirqiladi).
 * So'z chegarasida o'ralishini hisobga olib biroz konservativ (0.92).
 */
function estimateTextLines(text: string, charsPerLine: number): number {
  if (!text) return 1;
  const cpl = Math.max(8, charsPerLine * 0.92);
  let lines = 0;
  for (const seg of text.split("\n")) {
    const s = seg.trim();
    if (!s) {
      lines += 1; // paragraflar orasidagi bo'sh qator
      continue;
    }
    lines += Math.max(1, Math.ceil(s.length / cpl));
  }
  return Math.max(1, lines);
}

/**
 * Bir blokni pikselda balandligini taxminlaydi.
 * Har bir blok turi o'zining ichki padding/margin'lariga ega.
 */
function estimateBlockHeight(block: BookContentBlock, cfg: PaginationConfig): number {
  const { lineH, charsPerLine } = cfg;
  switch (block.block_type as string) {
    case "chapter": {
      const title = block.title ?? block.content ?? "";
      // Bob sarlavhasi: fontSize*1.38, lineHeight*1.35, paddingTop:36, paddingBottom:8, 2x gap:10, 2x line:1, paddingVertical:8*2
      const chCpl = Math.max(12, Math.floor(charsPerLine / 1.38));
      const lines = estimateTextLines(title, chCpl);
      return 36 + 8 + 20 + 2 + 16 + lines * lineH * 1.38 * 1.35;
    }
    case "topic": {
      const title = block.title ?? block.content ?? "";
      // Mavzu sarlavhasi: fontSize*1.12, lineHeight*1.45, paddingTop:22, paddingBottom:4
      const tCpl = Math.max(15, Math.floor(charsPerLine / 1.12));
      const lines = estimateTextLines(title, tCpl);
      return 22 + 4 + Math.max(lines * lineH * 1.12 * 1.45, 20);
    }
    case "image":
      // imageWrap paddingVertical:14*2=28, max rasm balandligi SCREEN_H*0.55
      return SCREEN_H * 0.55 + 28;
    case "quote":
    case "note": {
      const text = block.content ?? "";
      const lines = estimateTextLines(text, charsPerLine);
      // marginVertical:10*2=20, paddingVertical:14*2=28
      return 20 + 28 + lines * lineH;
    }
    default: { // paragraph
      const text = block.content ?? "";
      const lines = estimateTextLines(text, charsPerLine);
      // paddingVertical:5*2=10
      return lines * lineH + 10;
    }
  }
}

/**
 * Uzun paragrafni so'z chegarasida kesadi.
 * Qolgan qism keyingi sahifaga o'tadi.
 */
function splitParagraph(
  block: BookContentBlock,
  remainingH: number,
  cfg: PaginationConfig,
): { head: BookContentBlock; tail: BookContentBlock } | null {
  const text = block.content;
  if (!text) return null;
  const availLines = Math.floor((remainingH - 10) / cfg.lineH);
  if (availLines < 2) return null;
  // Matn shu joyga to'liq sig'sa — bo'lish shart emas (qator uzilishlarini ham hisoblaymiz)
  if (estimateTextLines(text, cfg.charsPerLine) <= availLines) return null;

  // So'z o'ralishini hisobga olib konservativ belgilar soni
  const maxChars = Math.max(cfg.charsPerLine, Math.floor(availLines * cfg.charsPerLine * 0.9));

  let cut = Math.min(maxChars, text.length - 1);
  const minCut = Math.floor(maxChars * 0.6);
  // So'z yoki qator chegarasida kesamiz — birorta so'z bo'linib qolmasin
  while (cut > minCut && text[cut] !== " " && text[cut] !== "\n") cut--;
  if (cut <= minCut) cut = Math.min(maxChars, text.length - 1);

  const fitText = text.slice(0, cut).trimEnd();
  const restText = text.slice(cut).trimStart();
  if (!fitText || !restText) return null;

  return {
    head: { ...block, content: fitText },
    tail: { ...block, id: block.id + "_c", content: restText },
  };
}

/**
 * Bloklarni ekran o'lchamiga mos sahifalarga guruhlaydi.
 * - Ekran balandligi va shrift o'lchamiga asoslanadi
 * - "chapter" bloki — har doim yangi sahifani boshlaydi
 * - Uzun paragraflar keyingi sahifaga so'z chegarasida o'tkaziladi
 * - Sarlavhalar sahifa oxirida yolg'iz qolmaydi
 */
function groupBlocksIntoPages(
  inputBlocks: BookContentBlock[],
  cfg: PaginationConfig,
): ReaderPage[] {
  if (inputBlocks.length === 0) return [];

  const pages: ReaderPage[] = [];
  let current: BookContentBlock[] = [];
  let usedH = 0;

  const flush = () => {
    if (current.length === 0) return;
    // Sarlavha yolg'iz qolsa — keyingi sahifaga o'tkazamiz
    let carry: BookContentBlock | null = null;
    if (current.length > 1) {
      const last = current[current.length - 1];
      if (last.block_type === "topic" || last.block_type === "chapter") {
        carry = current.pop()!;
      }
    }
    pages.push({ id: `page_${pages.length}`, blocks: [...current], pageIndex: pages.length });
    current = carry ? [carry] : [];
    usedH = carry ? estimateBlockHeight(carry, cfg) : 0;
  };

  const queue = [...inputBlocks];
  while (queue.length > 0) {
    const block = queue.shift()!;

    // Bob har doim yangi sahifadan boshlanadi
    if (block.block_type === "chapter" && current.length > 0) flush();

    const bH = estimateBlockHeight(block, cfg);
    const remaining = cfg.availableH - usedH;

    if (bH > remaining) {
      const isPara = block.block_type === "paragraph" || !block.block_type;
      // Paragrafni — joriy sahifaga (yoki bo'sh sahifa bo'lsa to'liq sahifaga) —
      // sig'adigan qismga bo'lamiz. Bu uzun paragraf bir betga ham sig'masa,
      // uni bir necha betga cho'zib, BIRORTA so'z yo'qolmasligini kafolatlaydi.
      if (isPara) {
        const room = current.length > 0 ? remaining : cfg.availableH;
        const split = splitParagraph(block, room, cfg);
        if (split) {
          current.push(split.head);
          flush();
          queue.unshift(split.tail);
          continue;
        }
      }
      // Bo'lib bo'lmadi: sahifada allaqachon kontent bo'lsa — keyingi sahifaga o'tkazamiz
      if (current.length > 0) {
        flush();
        queue.unshift(block);
        continue;
      }
      // Aks holda (bo'sh sahifa + bo'linmaydigan blok, masalan rasm) — shu sahifaga joylashtiramiz
    }

    current.push(block);
    usedH += bH;

    if (usedH >= cfg.availableH * 0.96) flush();
  }

  flush();
  return pages;
}

/**
 * Admin paneldan kelgan "paragraph" bloklari ko'pincha butun bir bobning
 * matnini (paragraflar orasidagi bo'sh qatorlar bilan birga) BITTA blokda
 * saqlaydi. Bunday yirik bloklarni bo'sh qatorlar bo'yicha alohida paragraf
 * bloklariga ajratamiz — shunda sahifalash aniqroq bo'ladi va matn betlarga
 * tekis taqsimlanadi.
 */
function normalizeParagraphBlocks(input: BookContentBlock[]): BookContentBlock[] {
  const out: BookContentBlock[] = [];
  for (const b of input) {
    const isPara = b.block_type === "paragraph" || !b.block_type;
    if (isPara && b.content && /\n[ \t]*\n/.test(b.content)) {
      const parts = b.content
        .split(/\n[ \t]*\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      parts.forEach((part, i) => {
        out.push({
          ...b,
          id: i === 0 ? b.id : `${b.id}_p${i}`,
          content: part,
          // Faqat birinchi qismda anchor saqlanadi (TOC/qidiruv mosligi uchun)
          anchor_id: i === 0 ? b.anchor_id : null,
        });
      });
    } else {
      out.push(b);
    }
  }
  return out;
}

// ─── Block renderers ──────────────────────────────────────────────────────────

interface BlockProps {
  block: BookContentBlock;
  fontSize: number;
  fontFamily: FontFamily;
  theme: ThemeColors;
  highlighted: boolean;
}

const ChapterBlock = memo(function ChapterBlock({ block, fontSize, fontFamily, theme, highlighted }: BlockProps) {
  const title = block.title
    ? sanitizeMarkers(block.title)
    : block.content
    ? sanitizeMarkers(block.content)
    : "";
  return (
    <View
      style={[
        bStyles.chapterWrap,
        highlighted && { backgroundColor: "rgba(46,125,50,0.07)" },
      ]}
    >
      <View style={[bStyles.chapterLine, { backgroundColor: theme.chapterLine }]} />
      <Text
        style={[
          bStyles.chapterTitle,
          {
            fontSize: fontSize * 1.38,
            lineHeight: fontSize * 1.38 * 1.35,
            fontFamily: FONTS[fontFamily],
            color: theme.text,
          },
        ]}
      >
        {title}
      </Text>
      <View style={[bStyles.chapterLine, { backgroundColor: theme.chapterLine }]} />
    </View>
  );
});

const TopicBlock = memo(function TopicBlock({ block, fontSize, fontFamily, theme, highlighted }: BlockProps) {
  const title = block.title
    ? sanitizeMarkers(block.title)
    : block.content
    ? sanitizeMarkers(block.content)
    : "";
  return (
    <View
      style={[
        bStyles.topicWrap,
        highlighted && { backgroundColor: "rgba(46,125,50,0.06)" },
      ]}
    >
      <View style={[bStyles.topicBar, { backgroundColor: theme.accent }]} />
      <Text
        style={[
          bStyles.topicTitle,
          {
            fontSize: fontSize * 1.12,
            lineHeight: fontSize * 1.12 * 1.45,
            fontFamily: FONTS[fontFamily],
            color: theme.accent,
          },
        ]}
      >
        {title}
      </Text>
    </View>
  );
});

const ParagraphBlock = memo(function ParagraphBlock({ block, fontSize, fontFamily, theme }: BlockProps) {
  const text = block.content ? sanitizeMarkers(block.content) : "";
  if (!text) return null;
  return (
    <Text
      style={[
        bStyles.paragraph,
        {
          fontSize,
          lineHeight: fontSize * 1.55,
          fontFamily: FONTS[fontFamily],
          color: theme.text,
        },
      ]}
    >
      {text}
    </Text>
  );
});

const QuoteBlock = memo(function QuoteBlock({ block, fontSize, fontFamily, theme }: BlockProps) {
  const text = block.content ? sanitizeMarkers(block.content) : "";
  const title = block.title ? sanitizeMarkers(block.title) : null;
  return (
    <View style={[bStyles.quoteWrap, { backgroundColor: theme.quoteBg, borderLeftColor: theme.quoteBar }]}>
      {title ? (
        <Text
          style={[
            bStyles.quoteTitle,
            { fontSize: fontSize * 0.9, fontFamily: FONTS[fontFamily], color: theme.accent },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <Text
        style={[
          bStyles.quoteText,
          {
            fontSize,
            lineHeight: fontSize * 1.55,
            fontFamily: FONTS[fontFamily],
            color: theme.text,
            fontStyle: "italic",
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
});

function ImageBlock({ block, theme }: { block: BookContentBlock; theme: ThemeColors }) {
  const [error, setError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  if (!block.media_url || error) {
    return (
      <View style={[bStyles.imagePlaceholder, { backgroundColor: theme.paper }]}>
        <Text style={[bStyles.imagePlaceholderText, { color: theme.textMuted }]}>
          Rasm yuklanmadi
        </Text>
      </View>
    );
  }

  return (
    <View style={bStyles.imageWrap}>
      <Image
        source={{ uri: block.media_url }}
        style={[bStyles.image, { width: SCREEN_W - 40, aspectRatio, maxHeight: SCREEN_H * 0.55 }]}
        contentFit="contain"
        transition={300}
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (w && h) setAspectRatio(w / h);
        }}
        onError={() => setError(true)}
        accessibilityLabel={block.media_alt ?? undefined}
      />
      {block.media_caption ? (
        <Text style={[bStyles.imageCaption, { color: theme.textMuted }]}>
          {block.media_caption}
        </Text>
      ) : null}
    </View>
  );
}

function renderBlock(
  block: BookContentBlock,
  fontSize: number,
  fontFamily: FontFamily,
  theme: ThemeColors,
  highlighted: boolean
) {
  const props: BlockProps = { block, fontSize, fontFamily, theme, highlighted };
  switch (block.block_type as BlockType) {
    case "chapter":
      return <ChapterBlock {...props} />;
    case "topic":
      return <TopicBlock {...props} />;
    case "image":
      return <ImageBlock block={block} theme={theme} />;
    case "quote":
    case "note":
      return <QuoteBlock {...props} />;
    case "paragraph":
    default:
      return <ParagraphBlock {...props} />;
  }
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  fontScale: number;
  onFontScale: (v: number) => void;
  fontFamily: FontFamily;
  onFontFamily: (v: FontFamily) => void;
  readerTheme: ReaderTheme;
  onTheme: (v: ReaderTheme) => void;
  readingMode: ReadingMode;
  onReadingMode: (m: ReadingMode) => void;
  theme: ThemeColors;
}

function SettingsPanel({
  visible,
  onClose,
  fontScale,
  onFontScale,
  fontFamily,
  onFontFamily,
  readerTheme,
  onTheme,
  readingMode,
  onReadingMode,
  theme,
}: SettingsPanelProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [280, 0],
  });

  if (!visible) return null;

  const scaleIndex = FONT_SIZES.indexOf(
    FONT_SIZES.reduce((prev, curr) =>
      Math.abs(curr - fontScale) < Math.abs(prev - fontScale) ? curr : prev
    )
  );

  return (
    <Pressable style={sStyles.overlay} onPress={onClose}>
      <Animated.View
        style={[sStyles.panel, { backgroundColor: theme.paper, transform: [{ translateY }] }]}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={sStyles.handle} />
          <Text style={[sStyles.panelTitle, { color: theme.text }]}>O'quvchi sozlamalari</Text>

          <Text style={[sStyles.label, { color: theme.textMuted }]}>Matn kattaligi</Text>
          <View style={sStyles.fontSizeRow}>
            <Pressable
              style={[sStyles.fontSizeBtn, { borderColor: theme.chapterLine }]}
              onPress={() => {
                const i = Math.max(0, scaleIndex - 1);
                onFontScale(FONT_SIZES[i]);
              }}
            >
              <Text style={[sStyles.fontSizeBtnText, { color: theme.text, fontSize: 14 }]}>A–</Text>
            </Pressable>
            <Text style={[sStyles.fontSizeValue, { color: theme.text }]}>
              {Math.round(fontScale * 100)}%
            </Text>
            <Pressable
              style={[sStyles.fontSizeBtn, { borderColor: theme.chapterLine }]}
              onPress={() => {
                const i = Math.min(FONT_SIZES.length - 1, scaleIndex + 1);
                onFontScale(FONT_SIZES[i]);
              }}
            >
              <Text style={[sStyles.fontSizeBtnText, { color: theme.text, fontSize: 18 }]}>A+</Text>
            </Pressable>
          </View>

          <Text style={[sStyles.label, { color: theme.textMuted }]}>Shrift</Text>
          <View style={sStyles.fontRow}>
            {(["serif", "sans"] as FontFamily[]).map((f) => (
              <Pressable
                key={f}
                style={[
                  sStyles.fontChip,
                  { borderColor: fontFamily === f ? theme.accent : theme.chapterLine },
                  fontFamily === f && { backgroundColor: theme.quoteBg },
                ]}
                onPress={() => onFontFamily(f)}
              >
                <Text
                  style={[
                    sStyles.fontChipText,
                    {
                      color: fontFamily === f ? theme.accent : theme.textMuted,
                      fontFamily: FONTS[f],
                    },
                  ]}
                >
                  {f === "serif" ? "Serif" : "Sans"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[sStyles.label, { color: theme.textMuted }]}>Sahifa rangi</Text>
          <View style={sStyles.themeRow}>
            {(["white", "sepia", "dark"] as ReaderTheme[]).map((t) => (
              <Pressable
                key={t}
                style={[
                  sStyles.themeChip,
                  { backgroundColor: THEMES[t].paper, borderColor: readerTheme === t ? theme.accent : "transparent" },
                ]}
                onPress={() => onTheme(t)}
              >
                <Text style={[sStyles.themeChipText, { color: THEMES[t].text }]}>
                  {t === "white" ? "Oq" : t === "sepia" ? "Sarғish" : "Qoʻngʻir"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[sStyles.label, { color: theme.textMuted }]}>O'qish rejimi</Text>
          <View style={sStyles.fontRow}>
            {(["paged", "scroll"] as ReadingMode[]).map((m) => (
              <Pressable
                key={m}
                style={[
                  sStyles.fontChip,
                  { borderColor: readingMode === m ? theme.accent : theme.chapterLine },
                  readingMode === m && { backgroundColor: theme.quoteBg },
                ]}
                onPress={() => onReadingMode(m)}
              >
                <Text
                  style={[sStyles.fontChipText, { color: readingMode === m ? theme.accent : theme.textMuted }]}
                >
                  {m === "paged" ? "📄 Sahifa" : "📜 Uzluksiz"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Mundarija (TOC) Sheet ────────────────────────────────────────────────────

interface TocSheetProps {
  visible: boolean;
  onClose: () => void;
  tocItems: BookTocItem[];
  onSelectAnchor: (anchorId: string) => void;
  theme: ThemeColors;
}

function TocSheet({ visible, onClose, tocItems, onSelectAnchor, theme }: TocSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={tocStyles.backdrop} onPress={onClose}>
        <Pressable
          style={[tocStyles.sheet, { backgroundColor: theme.paper }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={tocStyles.handleBar} />
          <View style={tocStyles.header}>
            <Text style={[tocStyles.headerTitle, { color: theme.text }]}>Mundarija</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X color={theme.textMuted} size={22} />
            </Pressable>
          </View>

          {tocItems.length === 0 ? (
            <View style={tocStyles.emptyWrap}>
              <Text style={[tocStyles.emptyText, { color: theme.textMuted }]}>
                Mundarija mavjud emas
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={tocStyles.list}
            >
              {tocItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    tocStyles.tocItem,
                    item.level === 2 && tocStyles.tocItemIndented,
                  ]}
                  onPress={() => {
                    onSelectAnchor(item.anchor_id);
                    onClose();
                  }}
                >
                  {item.level === 1 ? (
                    <Text style={[tocStyles.tocItemBob, { color: theme.text }]}>
                      {item.title}
                    </Text>
                  ) : (
                    <Text style={[tocStyles.tocItemMavzu, { color: theme.textMuted }]}>
                      {item.title}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Search Overlay ───────────────────────────────────────────────────────────

interface SearchResult {
  index: number;
  blockType: BlockType;
  preview: string;
}

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  onSelectResult: (index: number) => void;
  theme: ThemeColors;
}

function SearchOverlay({
  visible,
  onClose,
  query,
  onQueryChange,
  results,
  onSelectResult,
  theme,
}: SearchOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={[srStyles.overlay, { backgroundColor: theme.bg }]}>
      <View style={[srStyles.inputRow, { backgroundColor: theme.paper, marginTop: insets.top + 8 }]}>
        <Search color={theme.textMuted} size={18} />
        <TextInput
          style={[srStyles.input, { color: theme.text }]}
          placeholder="Kitob ichida qidirish..."
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={onQueryChange}
          autoFocus
          returnKeyType="search"
        />
        <Pressable onPress={onClose} hitSlop={10}>
          <X color={theme.textMuted} size={20} />
        </Pressable>
      </View>

      {query.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.index)}
          contentContainerStyle={srStyles.resultsList}
          ListEmptyComponent={
            <Text style={[srStyles.noResults, { color: theme.textMuted }]}>
              Natija topilmadi
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[srStyles.resultItem, { backgroundColor: theme.paper }]}
              onPress={() => {
                onSelectResult(item.index);
                onClose();
              }}
            >
              <Text style={[srStyles.resultType, { color: theme.accent }]}>
                {item.blockType === "chapter"
                  ? "Bob"
                  : item.blockType === "topic"
                  ? "Mavzu"
                  : item.blockType === "image"
                  ? "Rasm"
                  : "Matn"}
              </Text>
              <Text style={[srStyles.resultPreview, { color: theme.text }]} numberOfLines={2}>
                {item.preview}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

// ─── Resume Banner ────────────────────────────────────────────────────────────

interface ResumeBannerProps {
  onResume: () => void;
  onDismiss: () => void;
  theme: ThemeColors;
}

// Gradient renglari (CSS animatsiyasiga mos: ko'k → binafsha → pushti → ko'k)
const GLOW_COLORS = ["#16a34a", "#22c55e", "#84cc16", "#facc15", "#84cc16", "#22c55e", "#16a34a"] as const;
const BANNER_W = SCREEN_W - 32; // 16px margin har tomonda
const GRAD_W = BANNER_W * 3;    // CSS background-size: 300% ni takrorlash

function ResumeBanner({ onResume, onDismiss, theme }: ResumeBannerProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    // Notification slide-in from top
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 12,
      useNativeDriver: true,
    }).start();

    // Gradient border scroll loop
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: -BANNER_W,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    return () => {
      scrollAnim.stopAnimation();
      slideAnim.stopAnimation();
    };
  }, [scrollAnim, slideAnim]);

  const innerBg = theme.paper + "CC"; // 80% opacity — semi-transparent

  return (
    <Animated.View style={[resumeStyles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      {/* Gradient border: transparent outer, animated gradient line, semi-transparent inner */}
      <View style={resumeStyles.outerClip}>
        <Animated.View style={{ width: GRAD_W, height: "100%", transform: [{ translateX: scrollAnim }] }}>
          <LinearGradient
            colors={GLOW_COLORS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ width: GRAD_W, height: "100%" }}
          />
        </Animated.View>

        <View style={[resumeStyles.inner, { backgroundColor: innerBg }]}>
          <Text style={[resumeStyles.text, { color: theme.text }]} numberOfLines={1}>
            Oxirgi o'qilgan joydan davom etish
          </Text>
          <Pressable onPress={onResume} style={[resumeStyles.btn, { backgroundColor: theme.accent }]}>
            <Text style={resumeStyles.btnText}>Davom</Text>
          </Pressable>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <X color={theme.textMuted} size={15} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RichBlockReaderProps {
  bookId: string;
}

export default function RichBlockReader({ bookId }: RichBlockReaderProps) {
  const insets = useSafeAreaInsets();
  const { fontScale, setFontScale } = useApp();
  const { book, blocks: rawBlocks, tocItems, loading, error, debugInfo } = useBookContent(bookId);
  const access = useContentAccess("book", bookId);

  const [readerTheme, setReaderTheme] = useState<ReaderTheme>("white");
  const [fontFamily, setFontFamily] = useState<FontFamily>("serif");
  const [readingMode, setReadingMode] = useState<ReadingMode>("paged");
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedAnchorId, setHighlightedAnchorId] = useState<string | null>(null);
  const [savedPosition, setSavedPosition] = useState<number | null>(null);
  const [showResume, setShowResume] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  // Ref — toggleUI ichida stale closure bo'lmasligi uchun
  const uiVisibleRef = useRef(true);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const flatListRef = useRef<FlatList<ReaderPage>>(null);
  const scrollVertRef = useRef<FlatList<BookContentBlock>>(null);
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // useNativeDriver:false — paddingTop/paddingBottom animate qilish uchun
  const uiAnim = useRef(new Animated.Value(1)).current;
  const theme = THEMES[readerTheme];
  const fontSize = 16 * fontScale;

  // Real (active) reader file — helps confirm which reader is on screen.
  useEffect(() => {
    if (__DEV__) console.log("[Reader] ACTIVE FILE:", "components/reader/RichBlockReader.tsx");
  }, []);

  // Branding logo comes ONLY from the admin Branding settings (never a bundled
  // "mutolaa"/static asset). Priority: logo → splash → app icon → text fallback.
  const { branding, appName } = useBranding();
  const brandingLogoUrl =
    branding.logo_url || branding.splash_logo_url || branding.app_icon_url || null;

  // Publication year: prefer a real date field, else omit (never "current year").
  const bookYear = useMemo(() => {
    const raw = book as unknown as Record<string, unknown> | null;
    const candidate =
      (raw?.publicationYear as string | number | undefined) ??
      (raw?.publication_year as string | number | undefined) ??
      (raw?.year as string | number | undefined) ??
      (raw?.publishedAt as string | undefined) ??
      (raw?.published_at as string | undefined) ??
      (book?.createdAt as string | undefined);
    const match = candidate != null ? String(candidate).match(/\d{4}/) : null;
    return match ? match[0] : null;
  }, [book]);

  // Determine effective blocks (DB blocks → cleaned_content fallback → empty).
  // Yirik ko'p-paragrafli bloklarni ham normalizatsiya qilamiz.
  const blocks = useMemo<BookContentBlock[]>(() => {
    const source =
      rawBlocks.length > 0
        ? rawBlocks
        : book?.cleanedContent
        ? parseCleanedContent(book.cleanedContent)
        : [];
    const normalized = normalizeParagraphBlocks(source);
    // The branding title page already shows the title, so drop a leading block
    // that is just the book title repeated (e.g. "# Sensiz avgust o'tmadi…").
    if (book?.title && firstBlockDuplicatesTitle(normalized[0], book.title)) {
      return normalized.slice(1);
    }
    return normalized;
  }, [rawBlocks, book?.cleanedContent, book?.title]);

  // Paid-content gating: a paid book the user doesn't own shows only a ~1/4
  // preview ("parcha") then a paywall. Free/owned books read in full.
  const accessResolving = !!book && !book.isFree && access.isLoading;
  const isPaidLocked = !!book && !book.isFree && !accessResolving && !access.hasAccess;
  const previewBlocks = useMemo<BookContentBlock[]>(() => {
    if (!isPaidLocked) return blocks;
    const count = Math.max(6, Math.ceil(blocks.length * 0.25));
    return blocks.slice(0, count);
  }, [isPaidLocked, blocks]);

  // Record this book on the "O'qilayotganlar" shelf once it's fully readable.
  useEffect(() => {
    if (book && !isPaidLocked && !accessResolving) {
      recordReading({
        contentType: "book",
        contentId: bookId,
        title: book.title,
        cover: book.cover || null,
        author: book.authorName || null,
      });
    }
  }, [book, isPaidLocked, accessResolving, bookId]);

  // ── Sahifa maydoni chegaralari (top/bottom barlar DOIM shu joyda)
  // Top bar: insets.top + 8 paddingTop + 38 ikon + 10 paddingBottom = insets.top + 56
  // Footer:  insets.bottom + 8 paddingBottom + 6 paddingTop + ~24 kontent = insets.bottom + 38
  // Sahifa raqami matni sahifa ichida: ~28px
  const PAGE_TOP = insets.top + 56;
  const PAGE_BOT = insets.bottom + 44; // sal katta, xavfsizlik uchun

  const paginationConfig = useMemo<PaginationConfig>(() => {
    const lineH = fontSize * 1.55;
    // 28 = sahifa raqami; bir qator xavfsizlik chegarasi — matn top/bottom
    // barlar zonasiga (chiqib-kiradigan joyga) hech qachon tushmasligi uchun.
    const availableH = Math.max(200, SCREEN_H - PAGE_TOP - PAGE_BOT - 28 - lineH);
    const charW = fontSize * 0.52; // O'zbek matni uchun taxminiy belgi kengligi (konservativ)
    const contentW = SCREEN_W - 40; // paddingHorizontal:20 har tomonda
    const charsPerLine = Math.max(18, Math.floor(contentW / charW));
    return { availableH, lineH, charsPerLine };
  }, [fontSize, PAGE_TOP, PAGE_BOT]);

  // Bloklarni sahifalarga guruhlash. Eng birinchi sahifa — branding title page
  // (logo · nom · muallif · yil). pageIndex === massiv indeksi bo'lib qoladi, shu
  // sabab scroll/TOC/anchor/progress hammasi to'g'ri ishlaydi.
  const pages = useMemo<ReaderPage[]>(() => {
    const content = groupBlocksIntoPages(blocks, paginationConfig);
    if (content.length === 0) return content;
    const titlePage: ReaderPage = {
      id: "reader-title-page",
      blocks: [],
      pageIndex: 0,
      isTitle: true,
    };
    return [titlePage, ...content].map((page, index) => ({ ...page, pageIndex: index }));
  }, [blocks, paginationConfig]);

  // Diagnostics: which reader branch wins + whether the page-flip pager renders.
  useEffect(() => {
    const willRenderPager = !accessResolving && !isPaidLocked && blocks.length > 0;
    if (__DEV__) console.log("[RichReader] gate:", {
      readingMode,
      pagesLen: pages.length,
      blocksLen: blocks.length,
      accessResolving,
      isPaidLocked,
      willRenderPager,
    });
    if (willRenderPager && readingMode === "paged") {
      if (__DEV__) console.log("[RichReader] rendering PageFlipEffect");
      if (__DEV__) console.log("[RichReader] ENABLE_PAGE_FLIP:", ENABLE_PAGE_FLIP);
      if (__DEV__) console.log("[RichReader] platform:", Platform.OS);
      if (__DEV__) console.log("[RichReader] pages length:", pages.length);
    }
  }, [readingMode, pages.length, blocks.length, accessResolving, isPaidLocked]);

  // anchor_id → blok indeksi (uzluksiz scroll rejimi uchun)
  const anchorIndexMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    blocks.forEach((b, i) => { if (b.anchor_id) map[b.anchor_id] = i; });
    return map;
  }, [blocks]);

  // anchor_id → sahifa indeksi (sahifalash rejimi uchun)
  const anchorPageMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    pages.forEach((page) => {
      page.blocks.forEach((b) => {
        if (b.anchor_id) map[b.anchor_id] = page.pageIndex;
      });
    });
    return map;
  }, [pages]);

  // blok indeksi → sahifa indeksi (qidirish natijasini sahifaga aylantirish)
  const blockToPageMap = useMemo<number[]>(() => {
    const map: number[] = [];
    pages.forEach((page) => {
      page.blocks.forEach(() => map.push(page.pageIndex));
    });
    return map;
  }, [pages]);

  // Search results
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: SearchResult[] = [];
    blocks.forEach((b, i) => {
      const titleMatch = b.title?.toLowerCase().includes(q);
      const contentMatch = b.content?.toLowerCase().includes(q);
      const captionMatch = b.media_caption?.toLowerCase().includes(q);
      if (titleMatch || contentMatch || captionMatch) {
        const preview =
          b.title ?? b.content?.slice(0, 120) ?? b.media_caption ?? "";
        results.push({ index: i, blockType: b.block_type, preview });
      }
    });
    return results;
  }, [blocks, searchQuery]);

  // Oxirgi o'qilgan kitobni saqlash (bosh sahifadagi "davom etish" kartasi uchun)
  useEffect(() => {
    if (bookId) {
      AsyncStorage.setItem(scopedKey("last_book_id"), bookId).catch(() => {});
    }
  }, [bookId]);

  // Load persisted settings and reading position
  useEffect(() => {
    async function load() {
      try {
        const [themeVal, fontVal, posVal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_THEME_KEY),
          AsyncStorage.getItem(STORAGE_FONT_KEY),
          AsyncStorage.getItem(STORAGE_POS_PREFIX + bookId),
        ]);
        if (themeVal) setReaderTheme(themeVal as ReaderTheme);
        if (fontVal) setFontFamily(fontVal as FontFamily);
        if (posVal) {
          const idx = Number(posVal);
          if (idx > 2) {
            setSavedPosition(idx);
            setShowResume(true);
          }
        }
      } catch {}
    }
    load();
  }, [bookId]);

  // Persist settings when changed
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_THEME_KEY, readerTheme).catch(() => {});
  }, [readerTheme]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_FONT_KEY, fontFamily).catch(() => {});
  }, [fontFamily]);

  // Stable toggleUI — ref orqali o'qiladi, deps'da uiVisible yo'q (stale closure yo'q)
  const toggleUI = useCallback(() => {
    const next = !uiVisibleRef.current;
    uiVisibleRef.current = next;
    setUiVisible(next);
    Animated.timing(uiAnim, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [uiAnim]);

  // Scroll mode has no flip engine, so one Tap gesture over the whole list owns
  // the chrome toggle. Scrolling moves the finger far past maxDistance, so this
  // can never fire on a scroll — and unlike per-block Pressables it also covers
  // the title page, inter-block gaps and the space below the last block.
  const scrollTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(600)
        .maxDistance(24)
        .shouldCancelWhenOutside(false)
        .onEnd((_event, success) => {
          "worklet";
          if (success) runOnJS(toggleUI)();
        }),
    [toggleUI]
  );

  // Page-flip owns clean taps while active. Keeping page Pressables passive in
  // this mode prevents a swipe from also toggling the top/bottom chrome.
  const usingFlip = ENABLE_PAGE_FLIP && Platform.OS !== "web" && pages.length > 0;

  const scrollToPage = useCallback(
    (pageIndex: number, animated = true) => {
      if (pageIndex < 0 || pageIndex >= pages.length) return;
      // Drive the controlled index too so jumps (TOC / resume / search) also work
      // when the page-flip wrapper is active (it has no FlatList ref to scroll).
      // Harmless in classic mode: the FlatList scroll + viewability set the same index.
      setCurrentPageIndex(pageIndex);
      try {
        flatListRef.current?.scrollToIndex({ index: pageIndex, animated, viewPosition: 0 });
      } catch {
        flatListRef.current?.scrollToOffset({ offset: pageIndex * SCREEN_W, animated });
      }
    },
    [pages.length]
  );

  const scrollToAnchor = useCallback(
    (anchorId: string) => {
      if (readingMode === "scroll") {
        const blockIdx = anchorIndexMap[anchorId];
        if (blockIdx != null) {
          scrollVertRef.current?.scrollToIndex({ index: blockIdx, animated: true, viewPosition: 0 });
        }
      } else {
        const pageIdx = anchorPageMap[anchorId];
        if (pageIdx != null) scrollToPage(pageIdx);
      }
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
      setHighlightedAnchorId(anchorId);
      highlightTimeout.current = setTimeout(() => setHighlightedAnchorId(null), 1600);
    },
    [anchorIndexMap, anchorPageMap, readingMode, scrollToPage]
  );

  const onPagedViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        setCurrentPageIndex(idx);
        if (idx > 0) {
          AsyncStorage.setItem(STORAGE_POS_PREFIX + bookId, String(idx)).catch(() => {});
        }
      }
    },
    [bookId]
  );

  // Page-flip → page change. Same effect as onPagedViewableItemsChanged so the
  // current page + saved reading position behave identically to the classic pager.
  const handleFlipPageChange = useCallback(
    (idx: number) => {
      setCurrentPageIndex(idx);
      if (idx > 0) {
        AsyncStorage.setItem(STORAGE_POS_PREFIX + bookId, String(idx)).catch(() => {});
      }
    },
    [bookId]
  );

  const onScrollViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        if (idx > 2) {
          AsyncStorage.setItem(STORAGE_POS_PREFIX + bookId + ".v", String(idx)).catch(() => {});
        }
      }
    },
    [bookId]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const handleResume = useCallback(() => {
    setShowResume(false);
    if (savedPosition != null) scrollToPage(savedPosition, false);
  }, [savedPosition, scrollToPage]);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      flatListRef.current?.scrollToOffset({ offset: info.index * SCREEN_W, animated: false });
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
      }, 120);
    },
    []
  );

  const keyExtractor = useCallback((item: ReaderPage) => item.id, []);

  const renderItem = useCallback(
    ({ item: page }: { item: ReaderPage }) => {
      // Branding title page (logo · nom · muallif · yil). Same Pressable wrapper
      // as content pages, so tap-to-toggle controls behaves identically.
      if (page.isTitle) {
        // While the flip engine is active it owns taps via its own RNGH gesture.
        // A Pressable here — even with `onPress` undefined — still claims the RN
        // responder and swallows that gesture, which is what stopped the chrome
        // from toggling. Render a plain View in that mode.
        const PageBox: any = usingFlip ? View : Pressable;
        return (
          <PageBox
            style={[pgStyles.page, { width: SCREEN_W, backgroundColor: theme.paper, paddingTop: 0, paddingBottom: 0 }]}
            onPress={usingFlip ? undefined : toggleUI}
          >
            <ReaderTitlePage
              logoUrl={brandingLogoUrl}
              appName={appName}
              title={book?.title ?? ""}
              authorName={book?.authorName ?? null}
              year={bookYear}
              category={book?.genre ?? null}
              backgroundColor={theme.paper}
              textColor={theme.text}
              mutedColor={theme.textMuted}
              accentColor={theme.accent}
            />
          </PageBox>
        );
      }
      // Bob boshlanayotgan sahifada birinchi paragraph indeksini topamiz (drop cap uchun)
      const startsWithChapter = page.blocks[0]?.block_type === "chapter";
      const firstParaIdx = startsWithChapter
        ? page.blocks.findIndex((b) => b.block_type === "paragraph")
        : -1;

      // Same rule as the title page: View under the flip engine, Pressable in the
      // classic (web / fallback) list where nothing else handles the tap.
      const PageBox: any = usingFlip ? View : Pressable;
      return (
        // tap → UI yashirish/ko'rsatish | swipe → flip/FlatList ushlab qoladi
        // paddingTop/Bottom: barlar ko'rinsin-ko'rinmasin, matn har doim shu oraliqda
        <PageBox
          style={[pgStyles.page, { width: SCREEN_W, backgroundColor: theme.paper, paddingTop: PAGE_TOP, paddingBottom: PAGE_BOT }]}
          onPress={usingFlip ? undefined : toggleUI}
        >
          <View style={pgStyles.content}>
            {page.blocks.map((block, idx) => {
              if (idx === firstParaIdx && block.content) {
                const text = sanitizeMarkers(block.content);
                const firstChar = text.charAt(0);
                const fullRest = text.slice(1);
                const bodyLineH = fontSize * 1.55;

                // Drop cap o'lchami va G egallagan balandlik
                const dcSize = fontSize * 3.2;
                const dcLineH = dcSize * 1.05; // G ning haqiqiy balandligi (px)

                // G yonida nechta satr sig'adi (floor → G ni to'ldiradi, tag bo'sh qolmaydi)
                const gLines = Math.max(1, Math.floor(dcLineH / bodyLineH));
                // G yonidagi ustun kengligi: G belgisi kengligi ≈ dcSize * 0.62
                const dcCharW = dcSize * 0.62;
                const sideW = Math.max(60, SCREEN_W - 40 - dcCharW - 6);
                const sideCharsPerLine = Math.max(10, Math.floor(sideW / (fontSize * 0.50)));
                const maxSideChars = gLines * sideCharsPerLine;

                // Bo'lish nuqtasini so'z chegarasida topamiz
                let splitAt = Math.min(maxSideChars, fullRest.length);
                while (splitAt < fullRest.length && fullRest[splitAt] !== " " && fullRest[splitAt] !== "\n") {
                  splitAt++;
                }
                const sideText = fullRest.slice(0, splitAt).trimEnd();
                const belowText = fullRest.slice(splitAt).trimStart();

                return (
                  <View key={block.id} style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 }}>
                    {/* G yonida: G + sideText (G balandligiga teng satrlar) */}
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <Text
                        style={{
                          fontSize: dcSize,
                          lineHeight: dcLineH,
                          fontWeight: "800",
                          fontFamily: FONTS[fontFamily],
                          color: theme.accent,
                          marginRight: 6,
                        }}
                      >
                        {firstChar}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          fontSize,
                          lineHeight: bodyLineH,
                          fontFamily: FONTS[fontFamily],
                          color: theme.text,
                          textAlign: "justify",
                        }}
                      >
                        {sideText}
                      </Text>
                    </View>
                    {/* G ostida: to'liq kenglikda davom etadi */}
                    {belowText ? (
                      <Text
                        style={{
                          fontSize,
                          lineHeight: bodyLineH,
                          fontFamily: FONTS[fontFamily],
                          color: theme.text,
                          textAlign: "justify",
                        }}
                      >
                        {belowText}
                      </Text>
                    ) : null}
                  </View>
                );
              }
              return (
                <View key={block.id}>
                  {renderBlock(block, fontSize, fontFamily, theme, highlightedAnchorId === block.anchor_id && !!block.anchor_id)}
                </View>
              );
            })}
          </View>
          <Text style={[pgStyles.pageNum, { color: theme.textMuted }]}>
            {page.pageIndex + 1}
          </Text>
        </PageBox>
      );
    },
    [book, fontSize, fontFamily, theme, highlightedAnchorId, PAGE_TOP, PAGE_BOT, brandingLogoUrl, appName, bookYear, toggleUI, usingFlip]
  );

  // Uzluksiz scroll rejimi uchun renderItem (blok bazali)
  // Plain View: the tap is owned by the GestureDetector wrapping the whole
  // scroll list, so a tap on the title page, on a gap between blocks or below
  // the last block toggles the chrome exactly like a tap on a paragraph does.
  const renderVertItem = useCallback(
    ({ item }: { item: BookContentBlock }) => (
      <View style={{ backgroundColor: theme.paper }}>
        {renderBlock(item, fontSize, fontFamily, theme, highlightedAnchorId === item.anchor_id && !!item.anchor_id)}
      </View>
    ),
    [fontSize, fontFamily, theme, highlightedAnchorId]
  );

  const keyExtractorVert = useCallback((item: BookContentBlock) => item.id, []);

  // ── Loading ──
  if (loading) {
    return (
      <View style={[rStyles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.primary} size="large" />
        <Text style={rStyles.loadingText}>Kitob yuklanmoqda…</Text>
      </View>
    );
  }

  // ── Error (book not found) ──
  if (error || !book) {
    return (
      <View style={[rStyles.fill, { backgroundColor: palette.bg }]}>
        <View style={[rStyles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={rStyles.iconBtn}>
            <ArrowLeft color={palette.text} size={20} />
          </Pressable>
        </View>
        <View style={rStyles.centered}>
          <Text style={rStyles.errorText}>{error ?? "Kitob topilmadi."}</Text>
          {__DEV__ && debugInfo && (
            <View style={rStyles.debugBox}>
              <Text style={rStyles.debugText}>Book ID: {debugInfo.bookId || "yo'q"}</Text>
              <Text style={rStyles.debugText}>Source: {debugInfo.bookSource}</Text>
              <Text style={rStyles.debugText}>Error: {debugInfo.bookError || "noma'lum"}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Resolving paid access ──
  if (accessResolving) {
    return (
      <View style={[rStyles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  // ── Paid + not owned → 1/4 preview ("parcha") + paywall ──
  if (isPaidLocked) {
    return (
      <View style={[rStyles.fill, { backgroundColor: theme.paper }]}>
        <View style={[rStyles.topBar, { paddingTop: insets.top + 8, backgroundColor: theme.bg }]}>
          <Pressable onPress={() => router.back()} style={rStyles.iconBtn}>
            <ArrowLeft color={theme.text} size={20} />
          </Pressable>
          <Text style={[rStyles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {book.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 64, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[pwStyles.badge, { backgroundColor: theme.quoteBg }]}>
            <Text style={[pwStyles.badgeText, { color: theme.accent }]}>PARCHA · BEPUL O'QISH</Text>
          </View>
          {previewBlocks.map((block) => (
            <View key={block.id}>
              {renderBlock(block, fontSize, fontFamily, theme, false)}
            </View>
          ))}
          <LinearGradient
            colors={[theme.paper + "00", theme.paper]}
            style={pwStyles.fade}
            pointerEvents="none"
          />
          <View style={[pwStyles.card, { backgroundColor: theme.paper, borderColor: theme.chapterLine }]}>
            <View style={[pwStyles.lockCircle, { backgroundColor: theme.quoteBg }]}>
              <Lock color={theme.accent} size={22} />
            </View>
            <Text style={[pwStyles.title, { color: theme.text }]}>
              Bu asarning davomini o'qish uchun xarid qiling.
            </Text>
            <Pressable
              onPress={() => router.replace(`/book/${bookId}`)}
              style={[pwStyles.buyBtn, { backgroundColor: theme.accent }]}
            >
              <ShoppingBag color="#fff" size={17} />
              <Text style={pwStyles.buyBtnText}>To'liq o'qish uchun sotib olish</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/payments/tariflar")} hitSlop={8} style={{ marginTop: 14 }}>
              <Text style={[pwStyles.tariffText, { color: theme.accent }]}>Tarif orqali ochish</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── No content ──
  if (blocks.length === 0) {
    return (
      <View style={[rStyles.fill, { backgroundColor: theme.bg }]}>
        <View style={[rStyles.topBar, { paddingTop: insets.top + 8, backgroundColor: theme.bg }]}>
          <Pressable onPress={() => router.back()} style={rStyles.iconBtn}>
            <ArrowLeft color={theme.text} size={20} />
          </Pressable>
          <Text style={[rStyles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {book.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={rStyles.centered}>
          <BookOpen color={theme.textMuted} size={42} />
          <Text style={[rStyles.emptyText, { color: theme.textMuted }]}>
            Kitob matni hozircha mavjud emas.
          </Text>
        </View>
      </View>
    );
  }

  // ── Full reader ──
  // Barlar position:absolute overlay — FlatList har doim to'liq balandlikda, layout o'zgarmaydi
  const topBarTransY = uiAnim.interpolate({ inputRange: [0, 1], outputRange: [-(insets.top + 64), 0] });
  const footerTransY = uiAnim.interpolate({ inputRange: [0, 1], outputRange: [insets.bottom + 48, 0] });

  return (
    <View style={[rStyles.fill, { backgroundColor: theme.paper }]}>
      {/* Kontent — to'liq balandlik, barlar ustidan overlay qilinadi */}
      {readingMode === "paged" ? (
        <FlipEngine
          enabled={ENABLE_PAGE_FLIP}
          pages={pages}
          currentPage={currentPageIndex}
          onPageChange={handleFlipPageChange}
          onTap={toggleUI}
          renderPage={renderItem}
          fallback={
            <FlatList
              ref={flatListRef}
              data={pages}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialNumToRender={3}
              windowSize={3}
              maxToRenderPerBatch={2}
              removeClippedSubviews={Platform.OS !== "web"}
              onViewableItemsChanged={onPagedViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onScrollToIndexFailed={handleScrollToIndexFailed}
              getItemLayout={(_data, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
              style={{ flex: 1 }}
            />
          }
        />
      ) : (
        // GestureDetector takes exactly ONE child, and it attaches its own ref to
        // it — so the child must be a plain host View, not the FlatList (which
        // already carries scrollVertRef). collapsable={false} guarantees a real
        // native view exists on Android.
        <GestureDetector gesture={scrollTapGesture}>
        <View style={rStyles.fill} collapsable={false}>
        <FlatList
          ref={scrollVertRef}
          data={blocks}
          keyExtractor={keyExtractorVert}
          renderItem={renderVertItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 48, backgroundColor: theme.paper }}
          ListHeaderComponent={
            <View style={{ height: SCREEN_H - (insets.top + insets.bottom), paddingTop: insets.top + 64 }}>
              <ReaderTitlePage
                logoUrl={brandingLogoUrl}
                appName={appName}
                title={book.title}
                authorName={book.authorName ?? null}
                year={bookYear}
                category={book.genre ?? null}
                backgroundColor={theme.paper}
                textColor={theme.text}
                mutedColor={theme.textMuted}
                accentColor={theme.accent}
              />
            </View>
          }
          initialNumToRender={20}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={Platform.OS !== "web"}
          onViewableItemsChanged={onScrollViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          showsVerticalScrollIndicator={false}
        />
        </View>
        </GestureDetector>
      )}

      {/* Top bar — position:absolute, FlatList balandligiga ta'sir qilmaydi */}
      <Animated.View
        style={[
          rStyles.topBar,
          {
            position: "absolute", top: 0, left: 0, right: 0,
            paddingTop: insets.top + 8, backgroundColor: theme.bg,
            opacity: uiAnim, transform: [{ translateY: topBarTransY }],
          },
        ]}
        pointerEvents={uiVisible ? "auto" : "none"}
      >
        <Pressable onPress={() => router.back()} style={rStyles.iconBtn}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text style={[rStyles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {book.title}
        </Text>
        <View style={rStyles.headerActions}>
          <Pressable onPress={() => { setShowSearch(true); setSearchQuery(""); }} style={rStyles.iconBtn}>
            <Search color={theme.text} size={18} />
          </Pressable>
          <Pressable onPress={() => setShowToc(true)} style={rStyles.iconBtn}>
            <List color={theme.text} size={18} />
          </Pressable>
          <Pressable onPress={() => setShowSettings(true)} style={rStyles.iconBtn}>
            <Settings color={theme.text} size={18} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Resume banner — top bar ostida */}
      {showResume && (
        <View style={{ position: "absolute", top: insets.top + 56, left: 0, right: 0 }}>
          <ResumeBanner onResume={handleResume} onDismiss={() => setShowResume(false)} theme={theme} />
        </View>
      )}

      {/* Footer: progress bar + sahifa raqami — position:absolute */}
      {readingMode === "paged" && (
        <Animated.View
          style={[
            pgStyles.footer,
            {
              position: "absolute", bottom: 0, left: 0, right: 0,
              paddingBottom: insets.bottom + 8, backgroundColor: theme.paper,
              opacity: uiAnim, transform: [{ translateY: footerTransY }],
            },
          ]}
          pointerEvents={uiVisible ? "auto" : "none"}
        >
          <View style={[pgStyles.progressTrack, { backgroundColor: theme.chapterLine }]}>
            <View
              style={[
                pgStyles.progressFill,
                {
                  backgroundColor: theme.accent,
                  width: pages.length > 1 ? `${((currentPageIndex + 1) / pages.length) * 100}%` : "100%",
                },
              ]}
            />
          </View>
          <Text style={[pgStyles.footerText, { color: theme.textMuted }]}>
            {currentPageIndex + 1} / {pages.length}
          </Text>
        </Animated.View>
      )}

      {/* Overlays */}
      <SearchOverlay
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        results={searchResults}
        onSelectResult={(blockIdx) =>
          readingMode === "scroll"
            ? scrollVertRef.current?.scrollToIndex({ index: blockIdx, animated: true })
            : scrollToPage(blockToPageMap[blockIdx] ?? 0)
        }
        theme={theme}
      />

      <SettingsPanel
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        fontScale={fontScale}
        onFontScale={setFontScale}
        fontFamily={fontFamily}
        onFontFamily={setFontFamily}
        readerTheme={readerTheme}
        onTheme={setReaderTheme}
        readingMode={readingMode}
        onReadingMode={setReadingMode}
        theme={theme}
      />

      <TocSheet
        visible={showToc}
        onClose={() => setShowToc(false)}
        tocItems={tocItems}
        onSelectAnchor={scrollToAnchor}
        theme={theme}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pwStyles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  fade: { height: 70, marginTop: -70 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    marginTop: 4,
  },
  lockCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: FONT.serif,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },
  buyBtn: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 22,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buyBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  tariffText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
});

const bStyles = StyleSheet.create({
  chapterWrap: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 8,
    gap: 10,
  },
  chapterLine: { height: 1, marginHorizontal: 4 },
  chapterTitle: {
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
    paddingVertical: 8,
  },
  topicWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 4,
    gap: 10,
  },
  topicBar: { width: 3, height: 20, borderRadius: 2 },
  topicTitle: { fontWeight: "700", flex: 1 },
  paragraph: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    textAlign: "justify",
  },
  quoteWrap: {
    marginHorizontal: 20,
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  quoteTitle: { fontWeight: "700", marginBottom: 6 },
  quoteText: {},
  imageWrap: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  image: { borderRadius: 12 },
  imagePlaceholder: {
    marginHorizontal: 20,
    marginVertical: 14,
    height: 120,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  imagePlaceholderText: { fontSize: 13 },
  imageCaption: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 4,
  },
});

const rStyles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
    zIndex: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  headerActions: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  contentContainer: { paddingTop: 0 },
  blockWrap: {},
  bookHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
    marginBottom: 4,
  },
  bookTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  bookAuthor: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  bookDivider: { height: 1, width: 60, marginTop: 18 },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 32,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 22,
    marginTop: 12,
  },
  debugBox: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    gap: 4,
  },
  debugText: {
    fontSize: 11,
    color: "#666",
    fontFamily: "monospace" as const,
  },
});

// Sahifa va muqova stillari
const pgStyles = StyleSheet.create({
  page: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 6,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    // Matn xavfsiz zonada qoladi — top/bottom barlar joyiga hech qachon chiqmaydi
    overflow: "hidden",
  },
  pageNum: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  // Drop cap — row layout (har komponentning o'z lineHeight'i)
  dropCapRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  coverTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  coverAuthor: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  // Footer (progress bar)
  footer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 4,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
  footerText: {
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});

const sStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
    zIndex: 20,
  },
  panel: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf: "center",
    marginBottom: 16,
  },
  panelTitle: { fontSize: 16, fontWeight: "800", marginBottom: 18, letterSpacing: -0.2 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 10, marginTop: 14 },
  fontSizeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  fontSizeBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
  },
  fontSizeBtnText: { fontWeight: "700" },
  fontSizeValue: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "600" },
  fontRow: { flexDirection: "row", gap: 10 },
  fontChip: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  fontChipText: { fontSize: 15, fontWeight: "600" },
  themeRow: { flexDirection: "row", gap: 10 },
  themeChip: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  themeChipText: { fontSize: 13, fontWeight: "700" },
});

const tocStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf: "center",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  tocItem: { paddingVertical: 11 },
  tocItemIndented: { paddingLeft: 18 },
  tocItemBob: { fontSize: 15, fontWeight: "700", lineHeight: 22 },
  tocItemMavzu: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  emptyWrap: { padding: 32, alignItems: "center" },
  emptyText: { fontSize: 14 },
});

const srStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    paddingTop: 0,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
  input: { flex: 1, fontSize: 15 },
  resultsList: { paddingHorizontal: 16, gap: 8 },
  resultItem: {
    padding: 14,
    borderRadius: 14,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  resultType: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  resultPreview: { fontSize: 14, lineHeight: 20 },
  noResults: { textAlign: "center", paddingTop: 32, fontSize: 14 },
});

const resumeStyles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  outerClip: {
    borderRadius: 20,
    overflow: "hidden",
    height: 48,
  },
  inner: {
    ...StyleSheet.absoluteFillObject,
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  text: { flex: 1, fontSize: 13, fontWeight: "500" },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
