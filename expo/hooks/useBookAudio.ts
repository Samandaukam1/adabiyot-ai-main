import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseTimecodeText, resolveMediaUrl } from "@/lib/media";
import type { MobileBookAudioFile, MobileBookAudioTocItem } from "@/types/database";

const AUDIO_BUCKET = "book-audios";

export interface AudioTocItem {
  id: string;
  /** Clean Uzbek title — raw %%% / ^^^ markers stripped. */
  title: string;
  itemType: "chapter" | "topic";
  /** 1 = chapter, 2 = topic. */
  level: number;
  sortOrder: number;
  /** Seek target in seconds, or null when no timecode was entered. */
  startSeconds: number | null;
  endSeconds: number | null;
  /** Human label for the right-hand timecode, or null. */
  startLabel: string | null;
}

export interface BookAudioData {
  /** Resolved, playable audio URL (primary file → fallback), or null. */
  audioUrl: string | null;
  audioFileId: string | null;
  title: string | null;
  narratorName: string | null;
  durationSeconds: number | null;
  tocItems: AudioTocItem[];
  hasToc: boolean;
  loading: boolean;
}

/** Removes leading chapter/topic markers so users never see %%% or ^^^. */
function sanitizeTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^%%%+\s*/, "")
    .replace(/^\^\^\^+\s*/, "")
    .trim();
}

function pickPrimaryFile(files: MobileBookAudioFile[]): MobileBookAudioFile | null {
  if (files.length === 0) return null;
  return files.find((f) => f.is_primary) ?? files[0];
}

/**
 * Reads audio files for a book, trying the anon-facing `mobile_book_audio_files`
 * view first and falling back to the base `book_audio_files` table — mirroring
 * the established `mobile_books → books` pattern. Only falls back when the view
 * itself is unavailable (e.g. the views weren't created), never on empty data.
 */
async function fetchAudioFiles(bookId: string): Promise<MobileBookAudioFile[]> {
  const view = await (supabase as any)
    .from("mobile_book_audio_files")
    .select("*")
    .eq("book_id", bookId);
  if (!view.error) return (view.data as MobileBookAudioFile[]) ?? [];

  const base = await (supabase as any)
    .from("book_audio_files")
    .select("*")
    .eq("book_id", bookId);
  if (!base.error) {
    return ((base.data as MobileBookAudioFile[] | null) ?? []).filter(
      (r) => (r as { is_active?: boolean }).is_active !== false
    );
  }

  if (__DEV__) {
    console.warn(
      "[useBookAudio] audio files unavailable:",
      view.error?.message ?? base.error?.message
    );
  }
  return [];
}

async function fetchAudioToc(bookId: string): Promise<MobileBookAudioTocItem[]> {
  const view = await (supabase as any)
    .from("mobile_book_audio_toc_items")
    .select("*")
    .eq("book_id", bookId)
    .order("sort_order", { ascending: true });
  if (!view.error) return (view.data as MobileBookAudioTocItem[]) ?? [];

  const base = await (supabase as any)
    .from("book_audio_toc_items")
    .select("*")
    .eq("book_id", bookId)
    .order("sort_order", { ascending: true });
  if (!base.error) {
    return ((base.data as MobileBookAudioTocItem[] | null) ?? []).filter(
      (r) => (r as { is_active?: boolean }).is_active !== false
    );
  }

  if (__DEV__) {
    console.warn(
      "[useBookAudio] audio TOC unavailable:",
      view.error?.message ?? base.error?.message
    );
  }
  return [];
}

function normalizeTocItem(row: MobileBookAudioTocItem): AudioTocItem {
  const level = row.level ?? (row.item_type === "topic" ? 2 : 1);
  const itemType: "chapter" | "topic" =
    row.item_type === "topic" || level >= 2 ? "topic" : "chapter";

  // start_time_seconds is canonical; fall back to parsing the text value.
  const startSeconds =
    row.start_time_seconds != null && Number.isFinite(row.start_time_seconds)
      ? row.start_time_seconds
      : parseTimecodeText(row.start_time_text);
  const endSeconds =
    row.end_time_seconds != null && Number.isFinite(row.end_time_seconds)
      ? row.end_time_seconds
      : parseTimecodeText(row.end_time_text);

  // Prefer the admin-entered text; otherwise the UI formats from startSeconds.
  const startLabel = row.start_time_text?.trim() || null;

  return {
    id: row.id,
    title: sanitizeTitle(row.title),
    itemType,
    level,
    sortOrder: row.sort_order ?? 0,
    startSeconds,
    endSeconds,
    startLabel,
  };
}

/**
 * Loads a book's audio file + audio table of contents.
 *
 * Resolution order for the playable URL:
 *   1. primary `mobile_book_audio_files` row (is_primary), else first row
 *   2. `fallbackAudioUrl` (existing book.audio_url) for legacy audio-only books
 *
 * Never throws — missing tables, rows, URLs or timecodes degrade gracefully
 * to an empty/partial result so old audio books keep working.
 */
export function useBookAudio(
  bookId: string | null | undefined,
  fallbackAudioUrl: string | null | undefined
): BookAudioData {
  const [data, setData] = useState<BookAudioData>({
    audioUrl: null,
    audioFileId: null,
    title: null,
    narratorName: null,
    durationSeconds: null,
    tocItems: [],
    hasToc: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const fallbackUrl = resolveMediaUrl(fallbackAudioUrl, AUDIO_BUCKET);

    if (!bookId) {
      setData({
        audioUrl: fallbackUrl,
        audioFileId: null,
        title: null,
        narratorName: null,
        durationSeconds: null,
        tocItems: [],
        hasToc: false,
        loading: false,
      });
      return;
    }

    setData((prev) => ({ ...prev, loading: true }));
    const safeId = bookId;

    async function run() {
      let file: MobileBookAudioFile | null = null;
      let tocRows: MobileBookAudioTocItem[] = [];

      try {
        const [files, toc] = await Promise.all([
          fetchAudioFiles(safeId),
          fetchAudioToc(safeId),
        ]);
        file = pickPrimaryFile(files);
        tocRows = toc;
      } catch (err) {
        if (__DEV__) console.warn("[useBookAudio] audio fetch failed:", err);
      }

      if (cancelled) return;

      // Prefer TOC items tied to the chosen file; otherwise show all book items.
      let scopedToc = tocRows;
      if (file) {
        const matching = tocRows.filter(
          (r) => r.audio_file_id == null || r.audio_file_id === file!.id
        );
        if (matching.length > 0) scopedToc = matching;
      }

      const tocItems = scopedToc
        .map(normalizeTocItem)
        .filter((item) => item.title.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const resolvedFileUrl = resolveMediaUrl(file?.audio_url, AUDIO_BUCKET);

      setData({
        audioUrl: resolvedFileUrl ?? fallbackUrl,
        audioFileId: file?.id ?? null,
        title: file?.title ?? null,
        narratorName: file?.narrator_name ?? null,
        durationSeconds: file?.duration_seconds ?? null,
        tocItems,
        hasToc: tocItems.length > 0,
        loading: false,
      });
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [bookId, fallbackAudioUrl]);

  return data;
}
