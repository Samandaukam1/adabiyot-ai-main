import { useEffect, useMemo, useState } from "react";
import { usePublishedArticles } from "@/hooks/useArticleContent";
import { useLiteratureSearch, type LiteratureSearchItem } from "@/hooks/useLiteratureSearch";
import { supabase } from "@/lib/supabase";
import { normalizeKind } from "@/types/community";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OPTIONAL_ATTACHABLE_TABLES = [
  { table: "screenplays", contentType: "screenplay" },
  { table: "stories", contentType: "story" },
  { table: "novels", contentType: "novel" },
  { table: "fairy_tales", contentType: "fairy_tale" },
  { table: "qissas", contentType: "qissa" },
] as const;

function isUuid(value: string | null | undefined): boolean {
  return UUID_RE.test((value ?? "").trim());
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function matchesTitle(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

function toAttachmentItem(row: Record<string, unknown>, contentType: string): LiteratureSearchItem | null {
  const id = clean(row.id);
  const title = clean(row.title) ?? clean(row.name);
  if (!id || !title || !isUuid(id)) return null;
  return {
    id,
    title,
    author: clean(row.author) ?? clean(row.author_name) ?? clean(row.writer) ?? null,
    cover: clean(row.cover_url) ?? clean(row.thumbnail_url) ?? clean(row.cover) ?? null,
    kind: normalizeKind(contentType),
    contentType,
  };
}

async function fetchOptionalTableRows(table: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await (supabase as any).from(table).select("*").limit(40);
  if (error || !Array.isArray(data)) return [];
  return data as Record<string, unknown>[];
}

export function useReelAttachmentSearch(query: string) {
  const literature = useLiteratureSearch(query);
  const { articles, loading: articlesLoading } = usePublishedArticles();
  const [optionalItems, setOptionalItems] = useState<LiteratureSearchItem[]>([]);
  const [optionalLoading, setOptionalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOptionalLoading(true);

    Promise.all(
      OPTIONAL_ATTACHABLE_TABLES.map(async ({ table, contentType }) => {
        const rows = await fetchOptionalTableRows(table);
        return rows
          .map((row) => toAttachmentItem(row, contentType))
          .filter((item): item is LiteratureSearchItem => item !== null);
      })
    )
      .then((groups) => {
        if (cancelled) return;
        setOptionalItems(groups.flat());
      })
      .finally(() => {
        if (!cancelled) setOptionalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const articleResults = useMemo(() => {
    const q = query.trim();
    return articles
      .filter((article) => matchesTitle(article.title, q))
      .slice(0, 20)
      .map<LiteratureSearchItem>((article) => ({
        id: article.id,
        title: article.title,
        author: article.author?.trim() || null,
        cover: article.cover || null,
        kind: "article",
        contentType: "article",
      }));
  }, [articles, query]);

  const optionalResults = useMemo(() => {
    const q = query.trim();
    return optionalItems.filter((item) => matchesTitle(item.title, q)).slice(0, 20);
  }, [optionalItems, query]);

  const results = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...literature.results, ...articleResults, ...optionalResults].filter((item) => {
      if (!isUuid(item.id)) return false;
      const key = `${item.contentType}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return merged.slice(0, 30);
  }, [articleResults, literature.results, optionalResults]);

  return {
    results,
    loading: literature.loading || articlesLoading || optionalLoading,
  };
}
