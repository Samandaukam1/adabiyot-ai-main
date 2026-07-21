import { useCallback, useEffect, useState } from "react";
import { articles as legacyArticles, getArticle } from "@/mocks/content";
import { supabase } from "@/lib/supabase";
import {
  fetchArticleBlocks,
  legacyArticleToDisplay,
  mergeArticles,
  mobileArticleToDisplay,
  mobileHomeCardToDisplay,
  mobileReadPageToDisplay,
  type DisplayArticle,
  type HomeArticleCard,
} from "@/lib/articles";
import type {
  MobileArticleReadPage,
  MobileArticleRichContent,
  MobileHomeArticleCard,
} from "@/types/database";

type SupabaseFetchError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLISHED_ARTICLES_LIMIT = 120;
const HOME_ARTICLE_CARDS_LIMIT = 24;

export function useArticleContent(id: string | undefined): {
  article: DisplayArticle | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [article, setArticle] = useState<DisplayArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async (isCancelled: () => boolean = () => false) => {
    const articleId = (id ?? "").trim();
    setLoading(true);
    setError(null);

    if (!articleId || articleId === "undefined") {
      setArticle(null);
      setError("Maqola ID topilmadi.");
      setLoading(false);
      return;
    }

    // Resolve the article shell from the best available source (view → view →
    // base table → legacy mock).
    let resolved: DisplayArticle | null = null;

    const readPageRow = await fetchReadPageRow(articleId);
    if (isCancelled()) return;
    if (readPageRow) resolved = mobileReadPageToDisplay(readPageRow);

    if (!resolved) {
      const row = await fetchRichArticleRow(articleId);
      if (isCancelled()) return;
      if (row) resolved = mobileArticleToDisplay(row);
    }

    if (!resolved) {
      // The authoritative base `articles` table — views can lag/miss rows.
      const baseRow = await fetchBaseArticleRow(articleId);
      if (isCancelled()) return;
      if (baseRow) resolved = mobileReadPageToDisplay(baseRow as unknown as MobileArticleReadPage);
    }

    if (!resolved) {
      const legacyArticle = getArticle(articleId);
      if (legacyArticle) resolved = legacyArticleToDisplay(legacyArticle);
    }

    if (isCancelled()) return;

    if (!resolved) {
      setArticle(null);
      setError("Maqola topilmadi.");
      setLoading(false);
      return;
    }

    // Body: prefer the admin-authored `article_blocks` (the authoritative text).
    // Only when there are none do we keep whatever the views/content produced —
    // so "matn tayyorlanmoqda" appears only when the article truly has no body.
    try {
      const adminBlocks = await fetchArticleBlocks(resolved.id);
      if (isCancelled()) return;
      if (adminBlocks.length > 0) {
        resolved = { ...resolved, blocks: adminBlocks, contentSource: "blocks" };
      }
    } catch {
      // ignore — keep the resolved article's own blocks
    }

    setArticle(resolved);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetchArticle(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchArticle]);

  const refetch = useCallback(() => fetchArticle(), [fetchArticle]);

  return { article, loading, error, refetch };
}

export function usePublishedArticles(): {
  articles: DisplayArticle[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [articles, setArticles] = useState<DisplayArticle[]>(() => legacyArticleDisplays());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(null);

    const { data, error: viewErr } = await (supabase as any)
      .from("mobile_article_rich_content")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(PUBLISHED_ARTICLES_LIMIT) as {
        data: MobileArticleRichContent[] | null;
        error: SupabaseFetchError | null;
      };

    if (isCancelled()) return;

    const fallback = legacyArticleDisplays();

    let liveArticles = viewErr ? [] : (data ?? []).map(mobileArticleToDisplay);

    // If the view errored or returned nothing, read the authoritative base
    // `articles` table directly so newly-published articles still list (and the
    // ids resolve in the detail page).
    if (liveArticles.length === 0) {
      const { data: baseData, error: baseErr } = await (supabase as any)
        .from("articles")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(PUBLISHED_ARTICLES_LIMIT) as {
          data: Record<string, unknown>[] | null;
          error: SupabaseFetchError | null;
        };
      if (isCancelled()) return;
      if (!baseErr && baseData && baseData.length > 0) {
        liveArticles = baseData.map((r) => mobileReadPageToDisplay(r as unknown as MobileArticleReadPage));
      } else if (baseErr) {
        logArticleFetchError("articles list", baseErr);
      }
    }

    if (viewErr && liveArticles.length === 0) {
      logArticleFetchError("mobile_article_rich_content list", viewErr);
      setArticles(fallback);
      setError(viewErr.message);
      setLoading(false);
      return;
    }

    setArticles(mergeArticles(liveArticles, fallback));
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchArticles(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchArticles]);

  const refetch = useCallback(() => fetchArticles(), [fetchArticles]);

  return { articles, loading, error, refetch };
}

async function fetchReadPageRow(idOrSlug: string): Promise<MobileArticleReadPage | null> {
  const byIdFirst = UUID_RE.test(idOrSlug);
  const queries = byIdFirst ? ["id", "slug"] : ["slug"];

  for (const field of queries) {
    const { data, error } = await (supabase as any)
      .from("mobile_article_read_page")
      .select("*")
      .eq(field, idOrSlug)
      .maybeSingle() as {
        data: MobileArticleReadPage | null;
        error: SupabaseFetchError | null;
      };

    if (!error && data) return data;
    if (error && error.code !== "PGRST116") {
      logArticleFetchError(`mobile_article_read_page ${field}`, error);
    }
  }

  return null;
}

/** Authoritative base-table lookup (by id then slug) — never misses a row. */
async function fetchBaseArticleRow(idOrSlug: string): Promise<Record<string, unknown> | null> {
  const byIdFirst = UUID_RE.test(idOrSlug);
  const fields = byIdFirst ? ["id", "slug"] : ["slug", "id"];

  for (const field of fields) {
    const { data, error } = await (supabase as any)
      .from("articles")
      .select("*")
      .eq(field, idOrSlug)
      .maybeSingle() as { data: Record<string, unknown> | null; error: SupabaseFetchError | null };

    if (!error && data) return data;
    if (error && error.code !== "PGRST116") {
      logArticleFetchError(`articles ${field}`, error);
    }
  }
  return null;
}

async function fetchRichArticleRow(idOrSlug: string): Promise<MobileArticleRichContent | null> {
  const byIdFirst = UUID_RE.test(idOrSlug);
  const queries = byIdFirst ? ["id", "slug"] : ["slug"];

  for (const field of queries) {
    const { data, error } = await (supabase as any)
      .from("mobile_article_rich_content")
      .select("*")
      .eq(field, idOrSlug)
      .maybeSingle() as {
        data: MobileArticleRichContent | null;
        error: SupabaseFetchError | null;
      };

    if (!error && data) return data;
    if (error && error.code !== "PGRST116") {
      logArticleFetchError(`mobile_article_rich_content ${field}`, error);
    }
  }

  return null;
}

export function useHomeArticleCards(): {
  cards: HomeArticleCard[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [cards, setCards] = useState<HomeArticleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(null);

    const { data, error: viewErr } = await (supabase as any)
      .from("mobile_home_article_cards")
      .select("*")
      .limit(HOME_ARTICLE_CARDS_LIMIT) as {
        data: MobileHomeArticleCard[] | null;
        error: SupabaseFetchError | null;
      };

    if (isCancelled()) return;

    if (viewErr) {
      logArticleFetchError("mobile_home_article_cards list", viewErr);
      setCards([]);
      setError(viewErr.message);
      setLoading(false);
      return;
    }

    setCards((data ?? []).map(mobileHomeCardToDisplay));
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCards(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchCards]);

  const refetch = useCallback(() => fetchCards(), [fetchCards]);

  return { cards, loading, error, refetch };
}

function legacyArticleDisplays(): DisplayArticle[] {
  return legacyArticles.map(legacyArticleToDisplay);
}

function logArticleFetchError(scope: string, error: SupabaseFetchError) {
  if (!__DEV__) return;
  console.warn(`[Supabase] ${scope} fetch error:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}
