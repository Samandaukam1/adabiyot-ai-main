/**
 * Janr (genre) + Kategoriya (category) taxonomy — the SAME source of truth the
 * admin panel writes to, so whatever an admin tags a book with is exactly what
 * the user app filters by.
 *
 *   Janr        → public.content_genres      (global: Hayotiy, Fantastik, …)
 *   Kategoriya  → public.content_categories  (scoped by content_group: Roman, …)
 *
 * Both tables allow anonymous SELECT (see the admin repo's
 * genre-category-taxonomy-migration.sql), so no RPC or backend hop is needed.
 *
 * There is NO mock fallback here on purpose: if the tables are unreachable the
 * screens show an error/empty state rather than inventing categories that no
 * book could ever match.
 */
import { supabase } from "@/lib/supabase";
import type { DisplayBook } from "@/types/database";

export type ContentGroup = "book" | "article" | "screenplay" | "poem";

export interface ContentGenre {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface ContentCategory {
  id: string;
  name: string;
  slug: string;
  content_group: ContentGroup;
  sort_order: number;
}

/**
 * Quote/case/whitespace tolerant comparison key. Legacy rows were saved with
 * straight quotes ("She'riy to'plam") while the seeded taxonomy uses curly ones
 * ("She’riy to‘plam"), so both must resolve to the same book.
 * Mirrors `normalizeName` in the admin repo's lib/supabase/taxonomy.ts.
 */
export function normalizeTaxonomyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ");
}

/* ────────────────────────────  Fetchers  ───────────────────────────── */

export async function fetchContentGenres(): Promise<ContentGenre[]> {
  const { data, error } = await (supabase as any)
    .from("content_genres")
    .select("id,name,slug,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContentGenre[];
}

export async function fetchContentCategories(
  group: ContentGroup = "book"
): Promise<ContentCategory[]> {
  const { data, error } = await (supabase as any)
    .from("content_categories")
    .select("id,name,slug,content_group,sort_order")
    .eq("content_group", group)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContentCategory[];
}

/* ───────────────────────────  Book matching  ───────────────────────── */

/**
 * Does this book belong to that genre?
 *
 * Matches on the FK first, then falls back to the text column. The fallback is
 * not optional: `books.genre_id` is still null on most rows (the admin panel
 * writes the name and only fills the id when the FK migration has run), so an
 * id-only filter would show empty shelves for real, correctly tagged books.
 */
export function bookMatchesGenre(book: DisplayBook, genre: ContentGenre): boolean {
  if (genre.id && book.genreId && book.genreId === genre.id) return true;
  if (!book.genre) return false;
  return normalizeTaxonomyName(book.genre) === normalizeTaxonomyName(genre.name);
}

/**
 * Does this book belong to that category? Same FK-then-name strategy, plus one
 * legacy reconciliation.
 *
 * Before the Janr/Kategoriya split, the old admin form wrote CATEGORY names
 * ("Roman", "Qissa") into the `genre` text column, and those rows still have a
 * null `category`. Without the fallback below, books like "Girdob"
 * (genre="Roman", category=null) would belong to no genre AND no category, and
 * would be unreachable from either browser. The book really is tagged "Roman",
 * so we honour that — but only when `category` is empty, so a properly tagged
 * row is never overridden.
 */
export function bookMatchesCategory(book: DisplayBook, category: ContentCategory): boolean {
  if (category.id && book.categoryId && book.categoryId === category.id) return true;

  const target = normalizeTaxonomyName(category.name);
  if (book.category) return normalizeTaxonomyName(book.category) === target;
  if (book.genre) return normalizeTaxonomyName(book.genre) === target;
  return false;
}

export function booksInGenre(books: DisplayBook[], genre: ContentGenre): DisplayBook[] {
  return books.filter((b) => bookMatchesGenre(b, genre));
}

export function booksInCategory(books: DisplayBook[], category: ContentCategory): DisplayBook[] {
  return books.filter((b) => bookMatchesCategory(b, category));
}

/**
 * Genres that actually have at least one published book, plus their counts.
 * Empty genres are dropped so nobody taps into a guaranteed-empty shelf.
 */
export function withGenreCounts(
  genres: ContentGenre[],
  books: DisplayBook[]
): { item: ContentGenre; count: number }[] {
  return genres
    .map((item) => ({ item, count: booksInGenre(books, item).length }))
    .filter((entry) => entry.count > 0);
}

export function withCategoryCounts(
  categories: ContentCategory[],
  books: DisplayBook[]
): { item: ContentCategory; count: number }[] {
  return categories
    .map((item) => ({ item, count: booksInCategory(books, item).length }))
    .filter((entry) => entry.count > 0);
}
