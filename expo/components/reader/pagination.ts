import type { ReaderChapter, ReaderParagraphItem } from "@/mocks/content";

export interface ReaderBlock {
  id: string;
  text: string;
  paragraphIndex: number;
  startsParagraph: boolean;
  endsParagraph: boolean;
}

export interface ReaderPage {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  blocks: ReaderBlock[];
  isChapterStart: boolean;
  startTime: number;
  endTime: number;
  startChar: number;
  endChar: number;
  chapterStartChar: number;
  chapterEndChar: number;
}

export interface BuildReaderPagesOptions {
  chapters: ReaderChapter[];
  pageWidth: number;
  pageHeight: number;
  fontScale: number;
  lineHeight: number;
  contentHorizontalPadding?: number;
  contentTopPadding?: number;
  contentBottomPadding?: number;
}

const BASE_FONT_SIZE = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function estimateLines(text: string, charsPerLine: number): number {
  const normalized = text.trim();
  if (!normalized) return 1;
  return Math.max(1, Math.ceil(normalized.length / charsPerLine));
}

function takeWordsSlice(
  words: string[],
  startWordIndex: number,
  maxChars: number
): { text: string; nextWordIndex: number } {
  let cursor = startWordIndex;
  let slice = "";

  while (cursor < words.length) {
    const candidate = slice ? `${slice} ${words[cursor]}` : words[cursor];
    if (candidate.length > maxChars && slice) break;
    slice = candidate;
    cursor += 1;
    if (slice.length >= maxChars) break;
  }

  if (!slice) {
    return {
      text: words[startWordIndex] ?? "",
      nextWordIndex: Math.min(words.length, startWordIndex + 1),
    };
  }

  return { text: slice, nextWordIndex: cursor };
}

function isTextItem(item: ReaderParagraphItem): item is string {
  return typeof item === "string";
}

function getChapterLength(chapter: ReaderChapter): number {
  return chapter.paragraphs.reduce((count, item) => count + (isTextItem(item) ? item.length + 2 : 0), 0);
}

export function buildReaderPages(options: BuildReaderPagesOptions): ReaderPage[] {
  const horizontalPadding = options.contentHorizontalPadding ?? 34;
  const topPadding = options.contentTopPadding ?? 92;
  const bottomPadding = options.contentBottomPadding ?? 116;
  const fontSize = BASE_FONT_SIZE * options.fontScale;
  const usableWidth = Math.max(240, options.pageWidth - horizontalPadding * 2);
  const usableHeight = Math.max(280, options.pageHeight - topPadding - bottomPadding);
  const charsPerLine = Math.max(24, Math.floor(usableWidth / (fontSize * 0.53)));
  const linesPerPage = Math.max(10, Math.floor(usableHeight / (fontSize * options.lineHeight)));
  const pages: ReaderPage[] = [];

  let globalCharCursor = 0;

  options.chapters.forEach((chapter, chapterIndex) => {
    const chapterLength = getChapterLength(chapter);
    const chapterPages: ReaderPage[] = [];

    let pageBlocks: ReaderBlock[] = [];
    let pageUsedLines = 0;
    let pageStartChar = globalCharCursor;
    let pageEndChar = globalCharCursor;
    let pageStartChapterChar = 0;
    let pageEndChapterChar = 0;
    let chapterCursor = 0;
    let chapterStartPage = true;

    const resetPage = () => {
      pageBlocks = [];
      pageUsedLines = 0;
      pageStartChar = globalCharCursor + chapterCursor;
      pageEndChar = pageStartChar;
      pageStartChapterChar = chapterCursor;
      pageEndChapterChar = chapterCursor;
    };

    const flushPage = () => {
      if (!pageBlocks.length && !chapterStartPage) return;

      chapterPages.push({
        id: `page-${chapterIndex}-${chapterPages.length}`,
        chapterIndex,
        chapterTitle: chapter.title,
        blocks: pageBlocks.length
          ? [...pageBlocks]
          : [
              {
                id: `empty-${chapterIndex}-${chapterPages.length}`,
                text: "",
                paragraphIndex: 0,
                startsParagraph: true,
                endsParagraph: true,
              },
            ],
        isChapterStart: chapterStartPage,
        startTime: chapter.startTime,
        endTime: chapter.endTime,
        startChar: pageStartChar,
        endChar: Math.max(pageStartChar + 1, pageEndChar),
        chapterStartChar: pageStartChapterChar,
        chapterEndChar: Math.max(pageStartChapterChar + 1, pageEndChapterChar),
      });

      chapterStartPage = false;
      resetPage();
    };

    resetPage();

    chapter.paragraphs.forEach((item, paragraphIndex) => {
      // Skip image blocks — they don't contribute text to pagination
      if (!isTextItem(item)) {
        return;
      }
      const paragraph = item;
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      let wordIndex = 0;
      let paragraphConsumed = 0;

      while (wordIndex < words.length) {
        const reservedLines = chapterStartPage && pageBlocks.length === 0 ? 7.4 : pageBlocks.length === 0 ? 0.8 : 0;
        let remainingLines = linesPerPage - pageUsedLines - reservedLines;

        if (remainingLines <= 2 && pageBlocks.length > 0) {
          flushPage();
          continue;
        }

        remainingLines = Math.max(3, remainingLines);
        const maxChars = Math.max(charsPerLine * 2, Math.floor(remainingLines * charsPerLine));
        const slice = takeWordsSlice(words, wordIndex, maxChars);
        const blockText = slice.text;
        const blockLines = estimateLines(blockText, charsPerLine);
        const blockCost = blockLines + (wordIndex === 0 ? 1.05 : 0.65);

        if (pageUsedLines + reservedLines + blockCost > linesPerPage && pageBlocks.length > 0) {
          flushPage();
          continue;
        }

        const blockStartChapterChar = chapterCursor + paragraphConsumed;
        const blockStartGlobalChar = globalCharCursor + blockStartChapterChar;
        paragraphConsumed += blockText.length + (slice.nextWordIndex < words.length ? 1 : 0);
        const blockEndChapterChar = Math.min(chapterLength, chapterCursor + paragraphConsumed);
        const blockEndGlobalChar = globalCharCursor + blockEndChapterChar;

        if (!pageBlocks.length) {
          pageStartChar = blockStartGlobalChar;
          pageStartChapterChar = blockStartChapterChar;
        }

        pageEndChar = blockEndGlobalChar;
        pageEndChapterChar = blockEndChapterChar;
        pageBlocks.push({
          id: `block-${chapterIndex}-${paragraphIndex}-${wordIndex}`,
          text: blockText,
          paragraphIndex,
          startsParagraph: wordIndex === 0,
          endsParagraph: slice.nextWordIndex >= words.length,
        });

        pageUsedLines += blockCost;
        wordIndex = slice.nextWordIndex;

        if (wordIndex < words.length) {
          flushPage();
        }
      }

      chapterCursor += paragraph.length + 2;

    });

    flushPage();

    const chapterDuration = Math.max(1, chapter.endTime - chapter.startTime);
    chapterPages.forEach((page) => {
      const startRatio = chapterLength > 0 ? page.chapterStartChar / chapterLength : 0;
      const endRatio = chapterLength > 0 ? page.chapterEndChar / chapterLength : 1;
      page.startTime = chapter.startTime + chapterDuration * startRatio;
      page.endTime = chapter.startTime + chapterDuration * clamp(Math.max(endRatio, startRatio + 0.04), 0, 1);
    });

    if (chapterPages.length > 0) {
      chapterPages[chapterPages.length - 1].endTime = chapter.endTime;
    }

    pages.push(...chapterPages);
    globalCharCursor += chapterLength + 2;
  });

  return pages;
}

export function findPageIndexForAnchor(pages: ReaderPage[], anchorChar: number): number {
  if (!pages.length) return 0;

  let low = 0;
  let high = pages.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const page = pages[middle];
    if (anchorChar < page.startChar) {
      high = middle - 1;
    } else if (anchorChar >= page.endChar) {
      low = middle + 1;
    } else {
      return middle;
    }
  }

  return clamp(low, 0, pages.length - 1);
}

export function findPageIndexForAudioPosition(pages: ReaderPage[], position: number): number {
  if (!pages.length) return 0;

  let low = 0;
  let high = pages.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const page = pages[middle];
    if (position < page.startTime) {
      high = middle - 1;
    } else if (position >= page.endTime) {
      low = middle + 1;
    } else {
      return middle;
    }
  }

  return clamp(low, 0, pages.length - 1);
}