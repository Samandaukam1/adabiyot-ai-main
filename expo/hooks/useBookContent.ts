import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  BookContentBlock,
  BookTocItem,
  MobileBook,
  SupabasePoem,
  SupabaseBook,
} from "@/types/database";
import {
  mobileBookToDisplay,
  poemToDisplay,
  type DisplayBook,
} from "@/types/database";

interface UseBookContentResult {
  book: DisplayBook | null;
  blocks: BookContentBlock[];
  tocItems: BookTocItem[];
  loading: boolean;
  /** Human-readable error for book fetch failure only. Empty blocks is NOT an error. */
  error: string | null;
  debugInfo: { bookId: string; bookSource: string; bookError: string | null } | null;
}

/**
 * Fetches a book's metadata + content blocks + TOC for the rich reader.
 *
 * Book fetch strategy (mirrors usePublishedBooks):
 *   1. Try mobile_books view (richer data).
 *   2. If no row returned, fall back to books table with status='published'.
 *   3. If still no result, fall back to books table WITHOUT status filter
 *      (so dev books in any status can still be previewed in dev mode).
 *
 * Blocks and TOC fetch errors are logged but do NOT set the error state —
 * the reader handles the empty-blocks case separately with its own fallback.
 */
export function useBookContent(bookId: string): UseBookContentResult {
  const [book, setBook] = useState<DisplayBook | null>(null);
  const [blocks, setBlocks] = useState<BookContentBlock[]>([]);
  const [tocItems, setTocItems] = useState<BookTocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<UseBookContentResult["debugInfo"]>(null);

  useEffect(() => {
    if (!bookId || bookId === "undefined" || bookId === "") {
      console.error("❌ useBookContent: bookId is missing or invalid", { bookId });
      setError("Kitob ID topilmadi.");
      setDebugInfo({ bookId: bookId ?? "(bo'sh)", bookSource: "none", bookError: "bookId missing" });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDebugInfo(null);

    console.log("📖 useBookContent: starting fetch for bookId =", bookId);
    if (__DEV__) {
      console.log("🔌 SUPABASE URL EXISTS:", !!process.env.EXPO_PUBLIC_SUPABASE_URL);
      console.log("🔌 SUPABASE KEY EXISTS:", !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    }

    async function run() {
      // ── 1. Fetch book metadata ────────────────────────────────────────────

      let resolvedBook: DisplayBook | null = null;
      let bookSource = "none";

      // 1a. Try mobile_books view
      const { data: viewData, error: viewErr } = await (supabase as any)
        .from("mobile_books")
        .select("*")
        .eq("id", bookId)
        .single() as { data: MobileBook | null; error: { message: string; code: string; details: string; hint: string } | null };

      if (cancelled) return;

      if (!viewErr && viewData) {
        console.log("✅ useBookContent: book found in mobile_books view");
        resolvedBook = mobileBookToDisplay(viewData);
        bookSource = "mobile_books";
      } else {
        if (viewErr) {
          console.warn("⚠️ useBookContent: mobile_books fetch failed (will try books table):", {
            code: viewErr.code,
            message: viewErr.message,
          });
        } else {
          console.warn("⚠️ useBookContent: mobile_books returned no data for id:", bookId);
        }

        // 1b. Fall back to books table with status='published'
        const { data: pubData, error: pubErr } = await (supabase as any)
          .from("books")
          .select("*")
          .eq("id", bookId)
          .eq("status", "published")
          .single() as { data: SupabaseBook | null; error: { message: string; code: string; details: string; hint: string } | null };

        if (cancelled) return;

        if (!pubErr && pubData) {
          console.log("✅ useBookContent: book found in books table (status=published)");
          resolvedBook = rawBookToDisplay(pubData);
          bookSource = "books_published";
        } else {
          if (pubErr) {
            console.warn("⚠️ useBookContent: books(published) fetch failed:", {
              code: pubErr.code,
              message: pubErr.message,
            });
          }

          // 1c. Admin stores poems in a separate table.
          const { data: poemData, error: poemErr } = await (supabase as any)
            .from("poems")
            .select("*")
            .eq("id", bookId)
            .eq("status", "published")
            .single() as {
              data: SupabasePoem | null;
              error: { message: string; code: string; details: string; hint: string } | null;
            };

          if (cancelled) return;

          if (!poemErr && poemData) {
            console.log("✅ useBookContent: poem found in poems table (status=published)");
            resolvedBook = poemToDisplay(poemData);
            bookSource = "poems_published";
          } else {
            if (poemErr) {
              console.warn("⚠️ useBookContent: poems(published) fetch failed:", {
                code: poemErr.code,
                message: poemErr.message,
              });
            }
          }

          // 1d. Dev fallback — any status (lets you preview drafts in development)
          if (!resolvedBook && __DEV__) {
            console.log("🔍 useBookContent: trying books table without status filter (dev only)…");
            const { data: anyData, error: anyErr } = await (supabase as any)
              .from("books")
              .select("*")
              .eq("id", bookId)
              .single() as { data: SupabaseBook | null; error: { message: string; code: string; details: string; hint: string } | null };

            if (cancelled) return;

            if (!anyErr && anyData) {
              console.log("✅ useBookContent: book found in books table (any status). status =", anyData.status);
              resolvedBook = rawBookToDisplay(anyData);
              bookSource = `books_any(status=${anyData.status})`;
            } else if (anyErr) {
              console.error("❌ BOOK FETCH ERROR (books table, any status):", {
                bookId,
                message: anyErr.message,
                code: anyErr.code,
                details: anyErr.details,
                hint: anyErr.hint,
                fullError: anyErr,
              });
            }
          }
        }
      }

      if (!resolvedBook) {
        const dbg = { bookId, bookSource: "none", bookError: "not found in any source" };
        console.error("❌ useBookContent: book not found anywhere for id:", bookId);
        if (!cancelled) {
          setDebugInfo(dbg);
          setError("Kitob ma'lumotlari yuklanmadi.");
          setLoading(false);
        }
        return;
      }

      console.log("📘 LOADED BOOK:", {
        id: resolvedBook.id,
        title: resolvedBook.title,
        status: resolvedBook.status,
        has_internal_reader: resolvedBook.hasInternalReader,
        content_mode: resolvedBook.contentMode,
        raw_content_exists: !!resolvedBook.cleanedContent,
        cleaned_content_exists: !!resolvedBook.cleanedContent,
        source: bookSource,
      });

      // ── 2. Fetch blocks ───────────────────────────────────────────────────

      const { data: blocksData, error: blocksErr } = await (supabase as any)
        .from("book_content_blocks")
        .select("*")
        .eq("book_id", bookId)
        .order("sort_order", { ascending: true }) as {
          data: BookContentBlock[] | null;
          error: { message: string; code: string; details: string; hint: string } | null;
        };

      if (cancelled) return;

      console.log("📚 BOOK BLOCKS RESULT:", {
        count: blocksData?.length ?? 0,
        sample: blocksData?.slice(0, 3),
        blocksError: blocksErr ?? null,
      });

      if (blocksErr) {
        console.error("❌ BOOK BLOCKS FETCH ERROR:", {
          bookId,
          message: blocksErr.message,
          code: blocksErr.code,
          details: blocksErr.details,
          hint: blocksErr.hint,
          fullError: blocksErr,
        });
      }

      if (!blocksData || blocksData.length === 0) {
        console.warn("⚠️ BOOK HAS NO BLOCKS:", {
          bookId,
          cleaned_content_exists: !!resolvedBook.cleanedContent,
          raw_content_exists: !!resolvedBook.cleanedContent,
        });
      }

      // ── 3. Fetch TOC ──────────────────────────────────────────────────────

      const { data: tocData, error: tocErr } = await (supabase as any)
        .from("book_toc_items")
        .select("*")
        .eq("book_id", bookId)
        .order("sort_order", { ascending: true }) as {
          data: BookTocItem[] | null;
          error: { message: string; code: string; details: string; hint: string } | null;
        };

      if (cancelled) return;

      console.log("📑 BOOK TOC RESULT:", {
        count: tocData?.length ?? 0,
        sample: tocData?.slice(0, 5),
        tocError: tocErr ?? null,
      });

      if (tocErr) {
        console.error("❌ BOOK TOC FETCH ERROR:", {
          bookId,
          message: tocErr.message,
          code: tocErr.code,
          details: tocErr.details,
          hint: tocErr.hint,
          fullError: tocErr,
        });
      }

      // ── 4. Commit state ───────────────────────────────────────────────────

      setBook(resolvedBook);
      setBlocks(blocksData ?? []);
      setTocItems(tocData ?? []);
      setDebugInfo({ bookId, bookSource, bookError: null });
      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  return { book, blocks, tocItems, loading, error, debugInfo };
}

/** Normalize a raw books-table row to DisplayBook, safe for missing fields. */
function rawBookToDisplay(sb: SupabaseBook): DisplayBook {
  return {
    id: sb.id,
    title: sb.title || "Nomsiz kitob",
    authorName: sb.author || "Noma'lum muallif",
    publisherName: sb.publisher || "",
    publisherType: sb.publisher_type ?? null,
    cover: sb.cover_url || "",
    genre: sb.genre || "Kitob",
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
