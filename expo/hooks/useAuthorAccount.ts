import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { isAuthorAccount } from "@/types/profile";
import {
  mapAuthorWork,
  mapLinkedAuthor,
  type AuthorRow,
  type AuthorWork,
  type AuthorWorkRow,
  type LinkedAuthor,
} from "@/types/author";
import { pickNum, pickStr, type RawRow } from "@/types/authorRoyalty";

/**
 * A missing view/table (e.g. the migration hasn't been applied yet) should
 * degrade gracefully to empty data rather than surfacing a hard error.
 */
function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("does not exist") &&
      (message.includes("relation") || message.includes("table"))) ||
    message.includes("could not find the table")
  );
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("could not find the")
  );
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42883" ||
    error.code === "PGRST202" ||
    /could not find|schema cache|does not exist/i.test(error.message ?? "")
  );
}

/* ────────────────────  EFFECTIVE AUTHOR ID  ────────────────────────── */

/**
 * The author id this account is linked to, from EITHER direction:
 *   1. `profiles.author_id` (the admin wrote the link onto the profile), or
 *   2. a reverse lookup in `public.authors` where the admin only set the
 *      account link on the author row (`linked_account_id` / `profile_id`).
 * Old accounts linked before the profile sync existed still surface as
 * Muallif akkaunti thanks to path 2.
 */
export function useEffectiveAuthorId(): {
  authorId: string | null;
  royaltyLinked: boolean;
  loading: boolean;
} {
  const { profile } = useProfile();
  const { userId } = useAuth();
  const linkedId = profile.authorId ?? null;

  const query = useQuery({
    queryKey: ["author", "reverse-link", userId],
    enabled: !linkedId && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ authorId: string | null; royaltyLinked: boolean }> => {
      const royaltyRequest = (supabase as any).rpc("get_my_author_royalty_summary");
      let reverseAuthorId: string | null = null;
      // The link column name differs between deployments — try both. A column
      // that exists but holds no row falls through to the next alias; any
      // unexpected error resolves to "not an author" instead of crashing.
      for (const column of ["linked_account_id", "profile_id"]) {
        const { data, error } = await (supabase as any)
          .from("authors")
          .select("id")
          .eq(column, userId)
          .limit(1)
          .maybeSingle();
        if (!error) {
          if (data?.id) {
            reverseAuthorId = String(data.id);
            break;
          }
          continue;
        }
        if (!isMissingColumn(error) && !isMissingRelation(error)) break;
      }
      const royalty = await royaltyRequest;
      const royaltyData = royalty.error ? null : royalty.data;
      const royaltyLinked = Array.isArray(royaltyData)
        ? royaltyData.length > 0
        : royaltyData != null;
      return { authorId: reverseAuthorId, royaltyLinked };
    },
  });

  return {
    authorId: linkedId ?? query.data?.authorId ?? null,
    royaltyLinked: query.data?.royaltyLinked === true,
    loading: !linkedId && !!userId && query.isLoading,
  };
}

/* ─────────────────────────  LINKED AUTHOR  ─────────────────────────── */

/**
 * The `authors` record linked to the signed-in account, or null for a plain
 * reader. Read straight from `public.authors` by the effective linked id, so
 * it is always the user's OWN author record.
 */
export function useLinkedAuthor() {
  const { authorId } = useEffectiveAuthorId();

  const query = useQuery({
    queryKey: ["author", "linked", authorId],
    enabled: !!authorId,
    staleTime: 60_000,
    queryFn: async (): Promise<LinkedAuthor | null> => {
      const { data, error } = await (supabase as any)
        .from("authors")
        .select("*")
        .eq("id", authorId)
        .maybeSingle();
      if (error) {
        if (isMissingRelation(error)) return null;
        throw error;
      }
      return data ? mapLinkedAuthor(data as AuthorRow) : null;
    },
  });

  return {
    author: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? "Muallif ma'lumotini yuklab bo'lmadi" : null,
    refetch: query.refetch,
  };
}

/**
 * Whether the current account is a "Muallif akkaunti":
 * `profiles.account_type = 'author'` / linked `author_id` (instant, from the
 * fresh profile row) OR an author row pointing back at this account
 * (reverse lookup — covers admins that only linked from the authors side).
 */
export function useIsAuthor(): boolean {
  const { profile } = useProfile();
  const { authorId, royaltyLinked } = useEffectiveAuthorId();
  return useMemo(
    () => isAuthorAccount(profile) || !!authorId || royaltyLinked,
    [profile, authorId, royaltyLinked]
  );
}

/* ─────────────────────────  AUTHOR WORKS  ──────────────────────────── */

const WORK_TABLES: { table: string; contentType: string }[] = [
  { table: "books", contentType: "book" },
  { table: "articles", contentType: "article" },
  { table: "screenplays", contentType: "screenplay" },
  { table: "poems", contentType: "poem" },
];

/** Maps a raw content-table row (books/articles/…) into an AuthorWork. */
function mapDirectWork(contentType: string, row: RawRow): AuthorWork | null {
  const id = pickStr(row, ["id", "content_id", "work_id"]);
  if (!id) return null;
  const rawContentType = pickStr(row, ["content_type", "type", "work_type"]);
  const resolvedContentType = normalizeContentType(rawContentType ?? contentType);
  const status = pickStr(row, ["status", "moderation_status"])?.toLowerCase() ?? null;
  const publishedFlag = row.is_published;
  const hasPublicStatus =
    status === "published" ||
    status === "approved" ||
    status === "active" ||
    status === "public";
  const isPublished =
    hasPublicStatus ||
    (status == null && publishedFlag !== false);
  const price = pickNum(row, ["price", "price_uzs", "sale_price"]);
  return {
    contentType: resolvedContentType,
    id,
    title: (pickStr(row, ["title", "name"]) ?? "").trim() || "Nomsiz asar",
    coverUrl: pickStr(row, [
      "cover_url",
      "cover_image_url",
      "cover_image",
      "image_url",
      "thumbnail_url",
    ]),
    mediaUrl: pickStr(row, ["media_url", "video_url", "audio_url"]),
    price,
    isFree: row.is_free === true,
    status: status ?? (isPublished ? "published" : "draft"),
    isPublished,
    createdAt: pickStr(row, ["created_at"]),
    publishedAt: pickStr(row, ["published_at", "created_at"]),
    salesCount: pickNum(row, ["sales_count", "sold_count"]),
    earnedUzs: pickNum(row, ["earned_uzs", "author_amount_uzs"]),
  };
}

function normalizeContentType(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "books") return "book";
  if (normalized === "articles") return "article";
  if (normalized === "screenplays" || normalized === "scenario") return "screenplay";
  if (normalized === "poems") return "poem";
  return normalized;
}

async function fetchWorksRpc(): Promise<AuthorWork[] | null> {
  const { data, error } = await (supabase as any).rpc("get_my_author_works");
  if (error) {
    if (isMissingRpc(error)) return null;
    throw error;
  }
  if (!Array.isArray(data)) return [];
  return (data as RawRow[])
    .map((row) => mapDirectWork(pickStr(row, ["content_type", "type"]) ?? "book", row))
    .filter(Boolean) as AuthorWork[];
}

async function fetchOwnerMonologues(userId: string): Promise<AuthorWork[]> {
  const { data, error } = await (supabase as any)
    .from("creator_content_submissions")
    .select("*")
    .eq("user_id", userId)
    .eq("media_type", "monologue")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error) || isMissingColumn(error)) return [];
    throw error;
  }
  return Array.isArray(data)
    ? (data as RawRow[])
        .map((row) => mapDirectWork("monologue", row))
        .filter((work): work is AuthorWork => !!work)
    : [];
}

/**
 * One content table filtered by one link column. Any error (missing column,
 * missing table, RLS hiding drafts) quietly yields no rows from this path —
 * the other paths still contribute.
 */
async function fetchWorksFromTable(
  table: string,
  contentType: string,
  column: string,
  value: string
): Promise<AuthorWork[]> {
  const { data, error } = await (supabase as any)
    .from(table)
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  return (data as RawRow[])
    .map((row) => mapDirectWork(contentType, row))
    .filter(Boolean) as AuthorWork[];
}

async function fetchWorksView(authorId: string): Promise<AuthorWork[]> {
  const { data, error } = await (supabase as any)
    .from("author_works")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return Array.isArray(data) ? (data as AuthorWorkRow[]).map(mapAuthorWork) : [];
}

/**
 * All works (books/poems/articles/screenplays) of the signed-in author.
 * Three sources are merged so old and new linking styles both work:
 *   • content tables by `author_profile_id = auth user` (new sync),
 *   • content tables by `author_id = linked author` (old rows never synced),
 *   • the `author_works` view (covers deployments without the new columns).
 * Direct rows win the dedupe because they carry real status/price.
 */
export function useAuthorWorks() {
  const { userId } = useAuth();
  const { authorId } = useEffectiveAuthorId();

  const query = useQuery({
    queryKey: ["author", "works", userId, authorId],
    // The owner RPC also returns creator monologues. Plain readers normally get
    // an empty result, while creator-only accounts still receive their media.
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<AuthorWork[]> => {
      const [rpcWorks, ownerMonologues] = await Promise.all([
        fetchWorksRpc(),
        fetchOwnerMonologues(userId as string),
      ]);
      if (rpcWorks !== null) {
        const merged = new Map<string, AuthorWork>();
        for (const work of [...rpcWorks, ...ownerMonologues]) {
          merged.set(`${work.contentType}:${work.id}`, work);
        }
        return Array.from(merged.values()).sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
        );
      }

      const [viewWorks, ...directLists] = await Promise.all([
        authorId ? fetchWorksView(authorId).catch(() => []) : Promise.resolve([]),
        ...WORK_TABLES.map((t) =>
          userId
            ? fetchWorksFromTable(t.table, t.contentType, "author_profile_id", userId)
            : Promise.resolve([])
        ),
        ...WORK_TABLES.map((t) =>
          authorId
            ? fetchWorksFromTable(t.table, t.contentType, "author_id", authorId)
            : Promise.resolve([])
        ),
      ]);

      const merged = new Map<string, AuthorWork>();
      for (const work of viewWorks) {
        merged.set(`${work.contentType}:${work.id}`, work);
      }
      for (const list of directLists) {
        for (const work of list) {
          merged.set(`${work.contentType}:${work.id}`, work);
        }
      }
      for (const work of ownerMonologues) {
        merged.set(`${work.contentType}:${work.id}`, work);
      }
      return Array.from(merged.values()).sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );
    },
  });

  return {
    works: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? "Asarlarni yuklab bo'lmadi" : null,
    refetch: query.refetch,
  };
}

/* ──────────────────────  PUBLIC AUTHOR PROFILE  ────────────────────── */

/** Public author record (any reader) — read by author id from `public.authors`. */
export function useAuthorPublicProfile(authorId: string | undefined) {
  const query = useQuery({
    queryKey: ["author", "public", authorId],
    enabled: !!authorId,
    staleTime: 60_000,
    queryFn: async (): Promise<LinkedAuthor | null> => {
      const target = authorId as string;
      const targetIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target);
      let authorRow: AuthorRow | null = null;
      const authorColumns = targetIsUuid
        ? ["id", "linked_account_id", "profile_id"]
        : ["full_name", "pen_name"];
      for (const column of authorColumns) {
        const { data, error } = await (supabase as any)
          .from("authors")
          .select("*")
          .eq(column, target)
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          authorRow = data as AuthorRow;
          break;
        }
        if (error && !isMissingColumn(error) && !isMissingRelation(error)) throw error;
      }
      if (!authorRow) {
        const profileColumn = targetIsUuid ? "id" : "username";
        const profileTarget = targetIsUuid ? target : target.replace(/^@/, "");
        const { data: linkedProfile } = await (supabase as any)
          .from("profiles")
          .select("id,author_id")
          .eq(profileColumn, profileTarget)
          .limit(1)
          .maybeSingle();
        let resolvedProfileId = pickStr(linkedProfile ?? {}, ["id"]);
        let resolvedAuthorId = pickStr(linkedProfile ?? {}, ["author_id"]);

        // Some public profiles policies expose the safe view but not the base
        // profile row. Resolve the username to an id there, then retry only the
        // canonical author link from profiles.
        if (!resolvedProfileId && !targetIsUuid) {
          const { data: publicProfile } = await (supabase as any)
            .from("mobile_public_profiles")
            .select("id")
            .eq("username", profileTarget)
            .limit(1)
            .maybeSingle();
          resolvedProfileId = pickStr(publicProfile ?? {}, ["id"]);
          if (resolvedProfileId) {
            const { data: canonicalProfile } = await (supabase as any)
              .from("profiles")
              .select("author_id")
              .eq("id", resolvedProfileId)
              .maybeSingle();
            resolvedAuthorId = pickStr(canonicalProfile ?? {}, ["author_id"]);
          }
        }

        if (resolvedAuthorId) {
          const { data } = await (supabase as any)
            .from("authors")
            .select("*")
            .eq("id", resolvedAuthorId)
            .limit(1)
            .maybeSingle();
          authorRow = (data as AuthorRow | null) ?? null;
        } else if (resolvedProfileId) {
          for (const column of ["linked_account_id", "profile_id"]) {
            const { data, error } = await (supabase as any)
              .from("authors")
              .select("*")
              .eq(column, resolvedProfileId)
              .limit(1)
              .maybeSingle();
            if (!error && data) {
              authorRow = data as AuthorRow;
              break;
            }
            if (error && !isMissingColumn(error) && !isMissingRelation(error)) throw error;
          }
        }
      }
      if (!authorRow) return null;

      const author = mapLinkedAuthor(authorRow);
      let linkedProfileId = author.linkedProfileId;
      if (!linkedProfileId) {
        const { data: linkedProfile } = await (supabase as any)
          .from("profiles")
          .select("id")
          .eq("author_id", author.id)
          .limit(1)
          .maybeSingle();
        linkedProfileId = pickStr(linkedProfile ?? {}, ["id"]);
      }
      if (!linkedProfileId) return author;
      const { data: profileRow } = await (supabase as any)
        .from("mobile_public_profiles")
        .select("username,avatar_url,provider_avatar_url,bio,display_name,pen_name")
        .eq("id", linkedProfileId)
        .maybeSingle();
      return {
        ...author,
        linkedProfileId,
        linkedAccountId: author.linkedAccountId ?? linkedProfileId,
        username: pickStr(profileRow ?? {}, ["username"]),
        avatarUrl: author.avatarUrl ?? pickStr(profileRow ?? {}, ["avatar_url", "provider_avatar_url"]),
        bio: author.bio ?? pickStr(profileRow ?? {}, ["bio"]),
        fullName: author.fullName === "Muallif"
          ? pickStr(profileRow ?? {}, ["pen_name", "display_name"]) ?? author.fullName
          : author.fullName,
        isVerified: true,
      };
    },
  });

  return {
    author: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? "Muallif topilmadi" : null,
    refetch: query.refetch,
  };
}

/** Published works of any author/profile, scoped by the public RPC. */
function publicWorksRows(data: unknown): RawRow[] {
  if (Array.isArray(data)) return data as RawRow[];
  if (!data || typeof data !== "object") return [];
  const object = data as Record<string, unknown>;
  for (const key of ["works", "data", "items", "rows"]) {
    if (Array.isArray(object[key])) return object[key] as RawRow[];
  }
  const grouped: { keys: string[]; contentType: string }[] = [
    { keys: ["books", "book"], contentType: "book" },
    { keys: ["articles", "article"], contentType: "article" },
    { keys: ["screenplays", "screenplay", "scenarios"], contentType: "screenplay" },
    { keys: ["poems", "poem"], contentType: "poem" },
    { keys: ["monologues", "monologue"], contentType: "monologue" },
  ];
  return grouped.flatMap(({ keys, contentType }) => {
    const rows = keys.map((key) => object[key]).find(Array.isArray);
    return Array.isArray(rows)
      ? (rows as RawRow[]).map((row) => ({ content_type: contentType, ...row }))
      : [];
  });
}

export function useAuthorPublicWorks(
  authorId: string | undefined,
  options?: { enabled?: boolean }
) {
  const query = useQuery({
    queryKey: ["author", "public-works", authorId],
    enabled: !!authorId && options?.enabled !== false,
    staleTime: 60_000,
    queryFn: async (): Promise<AuthorWork[]> => {
      const [worksResult, monologuesResult] = await Promise.all([
        (supabase as any).rpc("get_public_author_works", {
          p_author_id: authorId,
        }),
        (supabase as any).rpc("get_public_profile_monologues", {
          p_profile_or_author_id: authorId,
        }),
      ]);
      const { data, error } = worksResult;
      if (__DEV__) {
        console.log("[PublicAuthorWorks] route id:", authorId);
        console.log("[PublicAuthorWorks] data:", data);
        console.log("[PublicAuthorWorks] error:", error);
      }
      if (error) {
        throw error;
      }
      if (monologuesResult.error && !isMissingRpc(monologuesResult.error)) {
        throw monologuesResult.error;
      }
      const rows = [
        ...publicWorksRows(data),
        ...publicWorksRows(monologuesResult.error ? null : monologuesResult.data),
      ];
      const mappedWorks = rows
        .filter((row) => {
          const status = pickStr(row, ["status", "moderation_status"])?.toLowerCase();
          // Defence in depth: the RPC already applies this rule, but never let
          // an accidentally broadened response expose a private moderation row.
          // Status intentionally wins over the legacy is_published flag: live
          // rows can be status=published while that stale flag is still false.
          if (status != null) {
            return ["published", "approved", "active", "public"].includes(status);
          }
          return row.is_published === true;
        })
        .map((row) => mapDirectWork(pickStr(row, ["content_type", "type"]) ?? "book", row))
        .filter((work): work is AuthorWork => !!work);
      const works = Array.from(
        new Map(mappedWorks.map((work) => [`${work.contentType}:${work.id}`, work])).values()
      )
        .sort((a, b) => (b.publishedAt ?? b.createdAt ?? "").localeCompare(a.publishedAt ?? a.createdAt ?? ""));
      return works;
    },
  });

  return {
    works: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? "Asarlarni yuklab bo'lmadi" : null,
    refetch: query.refetch,
  };
}
