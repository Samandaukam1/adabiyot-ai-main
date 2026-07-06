import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeKind, type TopMaterialKind } from "@/types/community";

export interface LiteratureSearchItem {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  kind: TopMaterialKind;
  /** Raw content-type string to persist in attached_content_type */
  contentType: string;
}

function str(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function mapRow(row: Record<string, unknown>): LiteratureSearchItem {
  const rawType = str(row, "content_type", "type", "material_type", "kind") ?? "material";
  return {
    // Prefer canonical content id so attachment taps open the real detail page.
    id: str(row, "content_id", "material_id", "id") ?? Math.random().toString(36).slice(2),
    title: str(row, "title", "name") ?? "Nomsiz",
    author: str(row, "author", "author_name", "writer"),
    cover: str(row, "cover_url", "cover", "image_url", "thumbnail_url"),
    kind: normalizeKind(rawType),
    contentType: rawType,
  };
}

/** Query published books + poems directly from base tables (always correct UUIDs). */
async function dbSearch(query: string): Promise<LiteratureSearchItem[]> {
  const q = query.trim();
  const results: LiteratureSearchItem[] = [];

  const [booksRes, poemsRes] = await Promise.all([
    (supabase as any)
      .from("books")
      .select("id, title, author, cover_url, genre, is_free")
      .eq("status", "published")
      .ilike("title", q ? `%${q}%` : "%")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(20),
    (supabase as any)
      .from("poems")
      .select("id, title, author, cover_url, is_free")
      .eq("status", "published")
      .ilike("title", q ? `%${q}%` : "%")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  if (!booksRes.error && Array.isArray(booksRes.data)) {
    for (const b of booksRes.data) {
      results.push({
        id: b.id,
        title: b.title ?? "Nomsiz",
        author: b.author ?? null,
        cover: b.cover_url ?? null,
        kind: normalizeKind(b.genre ?? "book"),
        contentType: b.genre ?? "book",
      });
    }
  }

  if (!poemsRes.error && Array.isArray(poemsRes.data)) {
    for (const p of poemsRes.data) {
      results.push({
        id: p.id,
        title: p.title ?? "Nomsiz",
        author: p.author ?? null,
        cover: p.cover_url ?? null,
        kind: "poem",
        contentType: "poem",
      });
    }
  }

  return results;
}

/** Debounced literature search.
 *  Strategy:
 *  1. Try search-index views for richer metadata / multi-table coverage.
 *  2. Fall back to querying books + poems base tables directly (always returns
 *     real canonical UUIDs so attachment navigation always works).
 */
export function useLiteratureSearch(query: string) {
  const [results, setResults] = useState<LiteratureSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 220);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      // 1. Try search-index views (may not be deployed).
      for (const view of ["mobile_literature_search_index", "public_material_index"]) {
        let q = (supabase as any).from(view).select("*").limit(25);
        if (debounced.trim()) q = q.ilike("title", `%${debounced.trim()}%`);
        const { data, error } = await q;
        if (cancelled) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          setResults(data.map(mapRow));
          setLoading(false);
          return;
        }
      }

      // 2. Fall back to querying books + poems tables directly.
      // This guarantees real canonical UUIDs — attachment taps always work.
      const direct = await dbSearch(debounced);
      if (cancelled) return;
      if (direct.length > 0) {
        setResults(direct);
        setLoading(false);
        return;
      }

      if (cancelled) return;
      setResults([]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return { results, loading };
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return useMemo(() => v, [v]);
}
