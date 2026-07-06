import { useEffect, useMemo, useState } from "react";
import { useMyEntitlements } from "@/hooks/usePayments";
import { supabase } from "@/lib/supabase";
import { getBook, getScreenplay } from "@/mocks/content";
import type { ShelfItem } from "@/lib/shelfStore";

/**
 * Resolves the user's owned content (Supabase `content_unlocks`) into display
 * cards for the Tokcham → "Sotib olinganlar" shelf. Looks each id up in its real
 * table (books / poems / articles) in batched `.in()` queries, with a mock
 * fallback for bundled demo content + screenplays.
 */
export function usePurchasedContent(): { items: ShelfItem[]; loading: boolean } {
  const { data, isLoading } = useMyEntitlements();
  const unlocks = useMemo(
    () => (data?.content_unlocks ?? []).filter((u) => u.content_id),
    [data]
  );
  const key = useMemo(
    () => unlocks.map((u) => `${u.content_type}:${u.content_id}`).sort().join(","),
    [unlocks]
  );
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (unlocks.length === 0) {
      setItems([]);
      return;
    }

    const ids = (type: string) =>
      unlocks.filter((u) => u.content_type === type).map((u) => String(u.content_id));
    const bookIds = ids("book");
    const poemIds = ids("poem");
    const articleIds = ids("article");
    const scenarioIds = ids("scenario");

    async function run() {
      setLoading(true);
      const out: ShelfItem[] = [];
      const seen = new Set<string>();
      const push = (it: ShelfItem) => {
        const k = `${it.contentType}:${it.contentId}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push(it);
      };

      try {
        const jobs: Promise<void>[] = [];

        if (bookIds.length) {
          jobs.push(
            (async () => {
              const { data } = await (supabase as any)
                .from("books")
                .select("id,title,author,cover_url")
                .in("id", bookIds);
              (data ?? []).forEach((r: any) =>
                push({
                  contentType: "book",
                  contentId: String(r.id),
                  title: r.title ?? "Kitob",
                  cover: r.cover_url ?? null,
                  author: r.author ?? null,
                  updatedAt: 0,
                })
              );
            })()
          );
        }
        if (poemIds.length) {
          jobs.push(
            (async () => {
              const { data } = await (supabase as any)
                .from("poems")
                .select("id,title,cover_url")
                .in("id", poemIds);
              (data ?? []).forEach((r: any) =>
                push({
                  contentType: "poem",
                  contentId: String(r.id),
                  title: r.title ?? "She'r",
                  cover: r.cover_url ?? null,
                  author: null,
                  updatedAt: 0,
                })
              );
            })()
          );
        }
        if (articleIds.length) {
          jobs.push(
            (async () => {
              const { data } = await (supabase as any)
                .from("articles")
                .select("id,title,cover_url,author_name")
                .in("id", articleIds);
              (data ?? []).forEach((r: any) =>
                push({
                  contentType: "article",
                  contentId: String(r.id),
                  title: r.title ?? "Maqola",
                  cover: r.cover_url ?? null,
                  author: r.author_name ?? null,
                  updatedAt: 0,
                })
              );
            })()
          );
        }

        await Promise.all(jobs);
      } catch {
        /* offline — show whatever resolved */
      }

      // Mock fallbacks (bundled demo books + screenplays).
      bookIds.forEach((id) => {
        if (seen.has(`book:${id}`)) return;
        const b = getBook(id);
        if (b) push({ contentType: "book", contentId: id, title: b.title, cover: b.cover, author: null, updatedAt: 0 });
      });
      scenarioIds.forEach((id) => {
        const s = getScreenplay(id);
        if (s) push({ contentType: "scenario", contentId: id, title: s.title, cover: null, author: null, updatedAt: 0 });
      });

      if (!cancelled) {
        setItems(out);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items, loading: loading || isLoading };
}
