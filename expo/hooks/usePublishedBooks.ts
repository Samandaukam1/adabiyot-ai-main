import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  type DisplayBook,
  type MobileBook,
  type SupabaseBook,
  mobileBookToDisplay,
  supabaseBookToDisplay,
} from "@/types/database";

interface UsePublishedBooksResult {
  books: DisplayBook[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches published books using a two-step strategy:
 * 1. Try `mobile_books` view (rich data, strict status filter)
 * 2. If empty, fall back to `books` table with status='published' (catches
 *    books where submission_status hasn't been set yet by the admin)
 */
export function usePublishedBooks(): UsePublishedBooksResult {
  const [books, setBooks] = useState<DisplayBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function fetch() {
      // ── Step 1: try the mobile_books view ─────────────────────────────────
      const { data: viewData, error: viewErr } = await (supabase as any)
        .from("mobile_books")
        .select("*") as {
          data: MobileBook[] | null;
          error: { message: string; code: string; details: string; hint: string } | null;
        };

      if (cancelled) return;

      if (viewErr) {
        console.error("[Supabase] mobile_books fetch error:", {
          message: viewErr.message,
          code: viewErr.code,
          details: viewErr.details,
          hint: viewErr.hint,
        });
      }

      if (!viewErr && viewData && viewData.length > 0) {
        setBooks(viewData.map(mobileBookToDisplay));
        setLoading(false);
        return;
      }

      // ── Step 2: fall back to books table with status='published' ──────────
      if (__DEV__) {
        console.log(
          "[Supabase] mobile_books empty or errored — trying books table directly"
        );
      }

      const { data: tableData, error: tableErr } = await (supabase as any)
        .from("books")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }) as {
          data: SupabaseBook[] | null;
          error: { message: string; code: string; details: string; hint: string } | null;
        };

      if (cancelled) return;

      if (tableErr) {
        console.error("[Supabase] books table fetch error:", {
          message: tableErr.message,
          code: tableErr.code,
          details: tableErr.details,
          hint: tableErr.hint,
        });
        setError("Kitoblarni yuklashda xatolik yuz berdi.");
        setLoading(false);
        return;
      }

      if (!tableData || tableData.length === 0) {
        if (__DEV__) {
          console.log(
            "[Supabase] No published books found, showing fallback demo data."
          );
        }
        setBooks([]);
        setLoading(false);
        return;
      }

      setBooks(tableData.map(rawBookToDisplay));
      setLoading(false);
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    books,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
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

      if (tableErr || !tableData) {
        setError("Bu material hali Adabiyot AI Kompaniyasi tomonidan tasdiqlanmagan.");
        setLoading(false);
        return;
      }

      setBook(rawBookToDisplay(tableData));
      setLoading(false);
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { book, loading, error };
}

/** Normalize a raw books-table row to DisplayBook, safe for missing fields. */
function rawBookToDisplay(sb: SupabaseBook): DisplayBook {
  return {
    id: sb.id,
    title: sb.title || "Nomsiz kitob",
    authorName: sb.author || "Noma'lum muallif",
    publisherName: sb.publisher || "Noma'lum nashriyot",
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
