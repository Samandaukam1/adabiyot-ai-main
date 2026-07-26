/**
 * liderlar-catalog-search
 *
 * Public catalog search for the Liderlar integration.
 *
 *   GET /functions/v1/liderlar-catalog-search?q=Adashgan
 *   header: x-adabiyotx-api-key: <ADABIYOTX_INTEGRATION_API_KEY>
 *
 * Searches the four real AdabiyotX content tables — `books`, `articles`,
 * `poems`, `screenplays` — and returns at most 30 normalised items. Only rows
 * with `status = 'published'` are ever returned: drafts, deleted and
 * not-yet-moderated material stay invisible.
 *
 * The function is deployed with `--no-verify-jwt` (the caller authenticates
 * with a custom integration key, not a Supabase JWT), so the
 * `x-adabiyotx-api-key` check below is the ONLY gate — it must stay mandatory.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-adabiyotx-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PUBLIC_BASE_URL = "https://adabiyotx.uz";
const MAX_ITEMS = 30;
/** Per-table cap; the merged list is ranked and then cut down to MAX_ITEMS. */
const PER_TABLE_LIMIT = 15;
const MIN_QUERY = 2;
const MAX_QUERY = 100;
const DESCRIPTION_LIMIT = 300;

type ContentType = "book" | "article" | "poem" | "scenario" | "other";

interface CatalogItem {
  externalId: string;
  contentType: ContentType;
  title: string;
  authorName: string | null;
  description: string | null;
  coverUrl: string | null;
  externalUrl: string;
  publishedAt: string | null;
}

interface SourceTable {
  /** Real table name in the AdabiyotX Supabase project. */
  table: string;
  contentType: ContentType;
  /** Public web route segment on adabiyotx.uz — see expo/lib/shareLinks.ts. */
  route: string;
  /** Columns selected (must all exist on the table). */
  columns: string[];
  /** Text columns matched with ILIKE. */
  searchColumns: string[];
  /** text[] columns matched with `overlaps` (exact element match). */
  arrayColumns: string[];
  /** Columns holding the author name, in preference order. */
  authorColumns: string[];
  /** Cover columns, in preference order. */
  coverColumns: string[];
}

/**
 * Verified against the live schema (PostgREST introspection) — do not guess:
 * `articles` and `screenplays` have no `tags`/`author` column, `screenplays`
 * carries its cover on both `cover_url` and `poster_url`.
 */
const SOURCES: SourceTable[] = [
  {
    table: "books",
    contentType: "book",
    route: "book",
    columns: [
      "id",
      "title",
      "slug",
      "description",
      "short_description",
      "cover_url",
      "author",
      "author_display_name",
      "author_id",
      "published_at",
    ],
    searchColumns: [
      "title",
      "slug",
      "description",
      "short_description",
      "author",
      "author_display_name",
    ],
    arrayColumns: ["tags", "categories"],
    authorColumns: ["author", "author_display_name"],
    coverColumns: ["cover_url"],
  },
  {
    table: "articles",
    contentType: "article",
    route: "article",
    columns: [
      "id",
      "title",
      "slug",
      "description",
      "short_description",
      "cover_url",
      "author_name",
      "author_display_name",
      "author_id",
      "published_at",
    ],
    searchColumns: [
      "title",
      "slug",
      "description",
      "short_description",
      "author_name",
      "author_display_name",
    ],
    arrayColumns: [],
    authorColumns: ["author_name", "author_display_name"],
    coverColumns: ["cover_url"],
  },
  {
    table: "poems",
    contentType: "poem",
    route: "poem",
    columns: [
      "id",
      "title",
      "slug",
      "description",
      "short_description",
      "cover_url",
      "author",
      "author_display_name",
      "author_id",
      "published_at",
    ],
    searchColumns: [
      "title",
      "slug",
      "description",
      "short_description",
      "author",
      "author_display_name",
    ],
    arrayColumns: ["tags", "categories"],
    authorColumns: ["author", "author_display_name"],
    coverColumns: ["cover_url"],
  },
  {
    table: "screenplays",
    contentType: "scenario",
    route: "screenplay",
    columns: [
      "id",
      "title",
      "slug",
      "description",
      "short_description",
      "cover_url",
      "poster_url",
      "author_display_name",
      "author_id",
      "published_at",
    ],
    searchColumns: [
      "title",
      "slug",
      "description",
      "short_description",
      "author_display_name",
    ],
    arrayColumns: [],
    authorColumns: ["author_display_name"],
    coverColumns: ["cover_url", "poster_url"],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json(
      { ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET so‘rov qo‘llab-quvvatlanadi." },
      405,
    );
  }

  // ---- 1. API key -------------------------------------------------------
  const expectedKey = Deno.env.get("ADABIYOTX_INTEGRATION_API_KEY") ?? "";
  const providedKey = req.headers.get("x-adabiyotx-api-key") ?? "";
  if (!expectedKey || !timingSafeEqual(providedKey, expectedKey)) {
    // The key itself is never logged or echoed back.
    console.warn(JSON.stringify({ code: "UNAUTHORIZED", message: "API key mismatch" }));
    return json({ ok: false, code: "UNAUTHORIZED", error: "API kaliti noto‘g‘ri." }, 401);
  }

  // ---- 2. Query ---------------------------------------------------------
  const raw = new URL(req.url).searchParams.get("q") ?? "";
  // Control characters would corrupt the PostgREST filter; treat them as spaces.
  const q = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return json(
      {
        ok: false,
        code: "INVALID_QUERY",
        error: `"q" parametri ${MIN_QUERY}–${MAX_QUERY} belgidan iborat bo‘lishi kerak.`,
      },
      400,
    );
  }

  // ---- 3. Search --------------------------------------------------------
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) {
    console.error(JSON.stringify({ code: "CATALOG_SEARCH_FAILED", message: "Supabase env missing" }));
    return json(
      {
        ok: false,
        code: "CATALOG_SEARCH_FAILED",
        error: "Katalog bo‘yicha qidiruvni bajarib bo‘lmadi.",
      },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Authors are matched separately so material whose author name only lives
    // in the `authors` table (screenplays, most books) is still findable.
    const authorIds = await searchAuthorIds(supabase, q);

    const perTable = await Promise.all(
      SOURCES.map((source) => searchTable(supabase, source, q, authorIds)),
    );

    // Articles and screenplays keep the author only as a foreign key, so every
    // author_id that appears in the results is resolved to a display name.
    const missing = new Set<string>();
    for (let i = 0; i < SOURCES.length; i++) {
      const source = SOURCES[i];
      for (const row of perTable[i]) {
        const hasName = source.authorColumns.some((col) => str(row[col]));
        const authorId = str(row.author_id);
        if (!hasName && authorId) missing.add(authorId);
      }
    }
    const authorNames = await loadAuthorNames(supabase, [...missing]);

    const items: CatalogItem[] = [];
    const seen = new Set<string>();
    const ranked: { item: CatalogItem; score: number; time: number }[] = [];

    for (let i = 0; i < SOURCES.length; i++) {
      const source = SOURCES[i];
      for (const row of perTable[i]) {
        const item = toItem(row, source, authorNames);
        if (!item) continue;
        const key = `${item.contentType}:${item.externalId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ranked.push({
          item,
          score: relevance(item, q),
          time: item.publishedAt ? Date.parse(item.publishedAt) || 0 : 0,
        });
      }
    }

    ranked.sort((a, b) => (b.score - a.score) || (b.time - a.time));
    for (const entry of ranked.slice(0, MAX_ITEMS)) items.push(entry.item);

    return json({ ok: true, items }, 200);
  } catch (error) {
    // Only the code, the message and the material type reach the logs.
    const message = error instanceof Error ? error.message : String(error);
    const materialType = (error as { materialType?: string })?.materialType ?? "unknown";
    console.error(
      JSON.stringify({ code: "CATALOG_SEARCH_FAILED", message, materialType }),
    );
    return json(
      {
        ok: false,
        code: "CATALOG_SEARCH_FAILED",
        error: "Katalog bo‘yicha qidiruvni bajarib bo‘lmadi.",
      },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

/** Rows of one content table matching `q` (published only). */
async function searchTable(
  supabase: SupabaseClient,
  source: SourceTable,
  q: string,
  authorIds: string[],
): Promise<Record<string, unknown>[]> {
  const value = ilikeValue(q);
  const clauses = source.searchColumns.map((col) => `${col}.ilike.${value}`);
  if (authorIds.length > 0) clauses.push(`author_id.in.(${authorIds.join(",")})`);

  const requests: PromiseLike<{ data: unknown; error: { message: string } | null }>[] = [
    supabase
      .from(source.table)
      .select(source.columns.join(","))
      .eq("status", "published")
      .or(clauses.join(","))
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(PER_TABLE_LIMIT),
  ];

  // text[] columns (tags, categories) can't be matched with ILIKE — a separate
  // exact-element `overlaps` query covers tag search.
  const tags = tagTerms(q);
  if (tags.length > 0) {
    for (const col of source.arrayColumns) {
      requests.push(
        supabase
          .from(source.table)
          .select(source.columns.join(","))
          .eq("status", "published")
          .overlaps(col, tags)
          .limit(PER_TABLE_LIMIT),
      );
    }
  }

  const results = await Promise.all(requests);
  const rows: Record<string, unknown>[] = [];
  for (const res of results) {
    if (res.error) {
      const err = new Error(res.error.message) as Error & { materialType?: string };
      err.materialType = source.contentType;
      throw err;
    }
    if (Array.isArray(res.data)) rows.push(...(res.data as Record<string, unknown>[]));
  }
  return rows;
}

/** Ids of published authors whose name/slug matches the query. */
async function searchAuthorIds(supabase: SupabaseClient, q: string): Promise<string[]> {
  const value = ilikeValue(q);
  const { data, error } = await supabase
    .from("authors")
    .select("id")
    .or(`full_name.ilike.${value},display_name.ilike.${value},slug.ilike.${value}`)
    .limit(50);
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => String((row as { id?: unknown }).id ?? ""))
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
}

/** author_id → display name, used when the row carries no denormalised name. */
async function loadAuthorNames(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  const { data, error } = await supabase
    .from("authors")
    .select("id, full_name, display_name")
    .in("id", ids);
  if (error || !Array.isArray(data)) return names;
  for (const row of data as Record<string, unknown>[]) {
    const id = str(row.id);
    const name = str(row.display_name) ?? str(row.full_name);
    if (id && name) names.set(id, name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function toItem(
  row: Record<string, unknown>,
  source: SourceTable,
  authorNames: Map<string, string>,
): CatalogItem | null {
  const id = str(row.id);
  const title = str(row.title);
  if (!id || !title) return null;

  let authorName: string | null = null;
  for (const col of source.authorColumns) {
    authorName = str(row[col]);
    if (authorName) break;
  }
  if (!authorName) {
    const authorId = str(row.author_id);
    if (authorId) authorName = authorNames.get(authorId) ?? null;
  }

  let coverUrl: string | null = null;
  for (const col of source.coverColumns) {
    coverUrl = str(row[col]);
    if (coverUrl) break;
  }

  const description = truncate(str(row.short_description) ?? str(row.description));

  return {
    // The canonical UUID — it is what the public routes resolve by.
    externalId: id,
    contentType: source.contentType,
    title,
    authorName,
    description,
    coverUrl,
    externalUrl: `${PUBLIC_BASE_URL}/${source.route}/${encodeURIComponent(id)}`,
    publishedAt: str(row.published_at),
  };
}

/** Title hits outrank author hits, which outrank body-text hits. */
function relevance(item: CatalogItem, q: string): number {
  const needle = q.toLowerCase();
  const title = item.title.toLowerCase();
  if (title === needle) return 100;
  if (title.startsWith(needle)) return 80;
  if (title.includes(needle)) return 60;
  if ((item.authorName ?? "").toLowerCase().includes(needle)) return 40;
  return 20;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Quoted ILIKE value for a PostgREST `or=` filter. Quoting keeps commas and
 * parentheses inside the query from breaking out of the filter list; `%`, `*`
 * and `\` are dropped so a caller can't widen the pattern or escape the quotes.
 */
function ilikeValue(q: string): string {
  const safe = q.replace(/[\\"%*]/g, " ").replace(/\s+/g, " ").trim();
  return `"%${safe}%"`;
}

/**
 * Terms used for the `tags`/`categories` overlap query. PostgREST renders an
 * array filter as an unquoted `{a,b}` literal, so anything but a plain word
 * would produce a malformed array literal — those queries are skipped instead.
 */
function tagTerms(q: string): string[] {
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’-]*$/u.test(q)) return [];
  return Array.from(new Set([q, q.toLowerCase()]));
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncate(value: string | null): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > DESCRIPTION_LIMIT
    ? `${clean.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : clean;
}

/** Length-independent, constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const len = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
