import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { articles, books, getAuthor } from "@/mocks/content";
import { mapTopMaterial, normalizeKind, type TopMaterial } from "@/types/community";

export type TopListTab = "read" | "liked" | "commented" | "today";

export const TOP_LIST_TABS: { key: TopListTab; label: string; view: string }[] = [
  { key: "read", label: "Eng ko'p o'qilayotgan", view: "mobile_top_most_read_materials" },
  { key: "liked", label: "Eng ko'p yoqtirilgan", view: "mobile_top_most_liked_materials" },
  { key: "commented", label: "Eng ko'p izohlangan", view: "mobile_top_most_commented_materials" },
  { key: "today", label: "Bugun e'lon qilingan", view: "mobile_today_published_materials" },
];

/** Builds demo materials from local mock content so tabs are never empty. */
function fallbackMaterials(tab: TopListTab): TopMaterial[] {
  const bookMaterials: TopMaterial[] = books.map((b, i) => ({
    id: b.id,
    title: b.title,
    authorName: getAuthor(b.authorId)?.name ?? "Noma'lum muallif",
    cover: b.cover,
    kind: normalizeKind(b.category),
    readsCount: Math.round(b.rating * 320) + (books.length - i) * 40,
    likesCount: Math.round(b.rating * 90) + i * 7,
    commentsCount: Math.round(b.rating * 18) + (i % 5) * 3,
    publishedAt: null,
  }));
  const articleMaterials: TopMaterial[] = articles.map((a) => ({
    id: a.id,
    title: a.title,
    authorName: a.author,
    cover: a.cover,
    kind: "article",
    readsCount: a.popularity * 12,
    likesCount: Math.round(a.popularity * 2.4),
    commentsCount: Math.round(a.popularity * 0.6),
    publishedAt: null,
  }));
  const all = [...bookMaterials, ...articleMaterials];
  switch (tab) {
    case "read":
      return [...all].sort((a, b) => b.readsCount - a.readsCount);
    case "liked":
      return [...all].sort((a, b) => b.likesCount - a.likesCount);
    case "commented":
      return [...all].sort((a, b) => b.commentsCount - a.commentsCount);
    case "today":
      return all.slice(0, 6);
    default:
      return all;
  }
}

interface Result {
  materials: TopMaterial[];
  loading: boolean;
  usingFallback: boolean;
  refetch: () => Promise<void>;
}

export function useTopList(tab: TopListTab): Result {
  const [materials, setMaterials] = useState<TopMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const config = TOP_LIST_TABS.find((t) => t.key === tab)!;

  const fetchList = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true);
      const { data, error } = await (supabase as any).from(config.view).select("*");

      if (isCancelled()) return;

      if (!error && Array.isArray(data) && data.length > 0) {
        setMaterials(data.map(mapTopMaterial));
        setUsingFallback(false);
        setLoading(false);
        return;
      }

      setMaterials(fallbackMaterials(tab));
      setUsingFallback(true);
      setLoading(false);
    },
    [config.view, tab]
  );

  useEffect(() => {
    let cancelled = false;
    fetchList(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchList]);

  const refetch = useCallback(() => fetchList(), [fetchList]);

  return { materials, loading, usingFallback, refetch };
}
