import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  type DisplayBook,
  type MobileBook,
  type SupabasePoem,
  type SupabaseBook,
  mobileBookToDisplay,
  poemToDisplay,
} from "@/types/database";

interface UsePublishedBooksResult {
  books: DisplayBook[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const PUBLISHED_CONTENT_LIMIT = 240;
const PUBLISHED_POEMS_LIMIT = 120;
const PUBLISHED_BOOKS_CACHE_TTL_MS = 60_000;

type PublishedBooksPayload = {
  rows: DisplayBook[];
  error: string | null;
};

let publishedBooksCache: { payload: PublishedBooksPayload; timestamp: number } | null = null;
let publishedBooksInflight: Promise<PublishedBooksPayload> | null = null;

function getFreshPublishedBooksCache(force?: boolean): PublishedBooksPayload | null {
  if (force || !publishedBooksCache) return null;
  if (Date.now() - publishedBooksCache.timestamp > PUBLISHED_BOOKS_CACHE_TTL_MS) return null;
  return {
    rows: publishedBooksCache.payload.rows.slice(),
    error: publishedBooksCache.payload.error,
  };
}

async function getPublishedBooksPayload(force?: boolean): Promise<PublishedBooksPayload> {
  const fresh = getFreshPublishedBooksCache(force);
  if (fresh) return fresh;

  if (!publishedBooksInflight) {
    publishedBooksInflight = loadPublishedBooks().then((payload) => {
      publishedBooksCache = {
        payload: { rows: payload.rows.slice(), error: payload.error },
        timestamp: Date.now(),
      };
      return payload;
    }).finally(() => {
      publishedBooksInflight = null;
    });
  }

  return publishedBooksInflight;
}

/**
 * Fetches published books using a two-step strategy:
 * 1. Try `mobile_books` view (rich data, strict status filter)
 * 2. If empty, fall back to `books` table with status='published' (catches
 *    books where submission_status hasn't been set yet by the admin)
 */
export function usePublishedBooks(): UsePublishedBooksResult {
  const cached = getFreshPublishedBooksCache();
  const [books, setBooks] = useState<DisplayBook[]>(() => cached?.rows ?? []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(() => cached?.error ?? null);

  const fetchBooks = useCallback(async (
    isCancelled: () => boolean = () => false,
    opts?: { force?: boolean }
  ) => {
    const fresh = getFreshPublishedBooksCache(opts?.force);
    if (fresh) {
      setBooks(fresh.rows);
      setError(fresh.error);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await getPublishedBooksPayload(opts?.force);
      if (isCancelled()) return;
      setBooks(payload.rows);
      setError(payload.error);
    } catch (err) {
      if (isCancelled()) return;
      setBooks([]);
      setError(err instanceof Error ? err.message : "Materiallarni yuklashda xatolik yuz berdi.");
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBooks(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [fetchBooks]);

  const refetch = useCallback(() => fetchBooks(undefined, { force: true }), [fetchBooks]);

  return {
    books,
    loading,
    error,
    refetch,
  };
}

async function loadPublishedBooks(): Promise<PublishedBooksPayload> {
  // ── Step 1: try the mobile_books view ─────────────────────────────────
  const { data: viewData, error: viewErr } = await (supabase as any)
    .from("mobile_books")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(PUBLISHED_CONTENT_LIMIT) as {
      data: MobileBook[] | null;
      error: { message: string; code: string; details: string; hint: string } | null;
    };

  if (viewErr && __DEV__) {
    console.warn("[Supabase] mobile_books unavailable; falling back to books table:", {
      message: viewErr.message,
      code: viewErr.code,
      details: viewErr.details,
      hint: viewErr.hint,
    });
  }

  let bookRows: DisplayBook[] = !viewErr && viewData && viewData.length > 0
    ? viewData.map(mobileBookToDisplay)
    : [];
  let bookFetchError: string | null = null;

  // ── Step 2: fall back to books table with status='published' ──────────
  if (bookRows.length === 0 && __DEV__) {
    console.warn("[Supabase] mobile_books empty or unavailable — trying books table directly");
  }

  if (bookRows.length === 0) {
    const { data: tableData, error: tableErr } = await (supabase as any)
      .from("books")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(PUBLISHED_CONTENT_LIMIT) as {
        data: SupabaseBook[] | null;
        error: { message: string; code: string; details: string; hint: string } | null;
      };

    if (tableErr) {
      console.error("[Supabase] books table fetch error:", {
        message: tableErr.message,
        code: tableErr.code,
        details: tableErr.details,
        hint: tableErr.hint,
      });
      bookFetchError = tableErr.message;
    } else if (tableData && tableData.length > 0) {
      bookRows = tableData.map(rawBookToDisplay);
    }
  }

  const { rows: poemRows, error: poemFetchError } = await fetchPublishedPoems();
  const mergedRows = sortByCreatedAt([...bookRows, ...poemRows]).slice(0, PUBLISHED_CONTENT_LIMIT);

  if (mergedRows.length === 0) {
    if (__DEV__) console.log("[Supabase] No published books or poems found, showing empty state.");
    return {
      rows: [],
      error: bookFetchError && poemFetchError ? "Materiallarni yuklashda xatolik yuz berdi." : null,
    };
  }

  return { rows: mergedRows, error: null };
}

export function usePublishedBook(id: string): {
  book: DisplayBook | null;
  loading: boolean;
  error: string | null;
} {
  const [book, setBook] = useState<DisplayBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function fetch() {
      // Try mobile_books view first for rich data
      const { data: viewData, error: viewErr } = await (supabase as any)
        .from("mobile_books")
        .select("*")
        .eq("id", id)
        .single() as { data: MobileBook | null; error: unknown };

      if (cancelled) return;

      if (!viewErr && viewData) {
        setBook(mobileBookToDisplay(viewData));
        setLoading(false);
        return;
      }

      // Fall back to books table
      const { data: tableData, error: tableErr } = await (supabase as any)
        .from("books")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .single() as { data: SupabaseBook | null; error: unknown };

      if (cancelled) return;

      if (!tableErr && tableData) {
        setBook(rawBookToDisplay(tableData));
        setLoading(false);
        return;
      }

      // Fall back to published poems. Admin stores poems in a separate table.
      const { data: poemData, error: poemErr } = await (supabase as any)
        .from("poems")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .single() as { data: SupabasePoem | null; error: unknown };

      if (cancelled) return;

      if (!poemErr && poemData) {
        setBook(poemToDisplay(poemData));
        setLoading(false);
        return;
      }

      setError("Bu material hali AdabiyotX tomonidan tasdiqlanmagan.");
      setLoading(false);
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { book, loading, error };
}

type SupabaseFetchError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

async function fetchPublishedPoems(): Promise<{
  rows: DisplayBook[];
  error: string | null;
}> {
  const { data, error } = await (supabase as any)
    .from("poems")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(PUBLISHED_POEMS_LIMIT) as {
      data: SupabasePoem[] | null;
      error: SupabaseFetchError | null;
    };

  if (error) {
    console.error("[Supabase] poems table fetch error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []).map(poemToDisplay), error: null };
}

function sortByCreatedAt(rows: DisplayBook[]): DisplayBook[] {
  return [...rows].sort((a, b) => {
    const right = new Date(b.createdAt).getTime();
    const left = new Date(a.createdAt).getTime();
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
}

/** Normalize a raw books-table row to DisplayBook, safe for missing fields. */
function rawBookToDisplay(sb: SupabaseBook): DisplayBook {
  return {
    id: sb.id,
    title: sb.title || "Nomsiz kitob",
    authorName: sb.author || "Noma'lum muallif",
    authorId: sb.author_id ?? null,
    authorProfileId: sb.author_profile_id ?? null,
    publisherName: sb.publisher || "Noma'lum nashriyot",
    publisherType: sb.publisher_type ?? null,
    cover: sb.cover_url || "",
    genre: sb.genre || "Kitob",
    genreId: sb.genre_id ?? null,
    category: sb.category ?? null,
    categoryId: sb.category_id ?? null,
    description: sb.description || "",
    audioUrl: sb.audio_url ?? null,
    fileUrl: sb.file_url ?? null,
    pdfUrl: sb.pdf_url ?? null,
    price: sb.price ?? 0,
    isFree: sb.is_free ?? false,
    status: sb.status,
    submissionStatus: sb.submission_status ?? null,
    createdAt: sb.created_at,
    source: "supabase",
    hasInternalReader: sb.has_internal_reader ?? false,
    contentMode: sb.content_mode ?? null,
    cleanedContent: sb.cleaned_content ?? null,
  };
}
