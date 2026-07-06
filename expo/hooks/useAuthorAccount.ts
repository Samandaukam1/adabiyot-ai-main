import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/providers/ProfileProvider";
import { isAuthorAccount } from "@/types/profile";
import {
  mapAuthorEarning,
  mapAuthorWork,
  mapEarningsSummary,
  mapLinkedAuthor,
  type AuthorEarning,
  type AuthorEarningRow,
  type AuthorEarningsSummary,
  type AuthorEarningsSummaryRow,
  type AuthorRow,
  type AuthorWork,
  type AuthorWorkRow,
  type LinkedAuthor,
} from "@/types/author";

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

/* ─────────────────────────  LINKED AUTHOR  ─────────────────────────── */

/**
 * The `authors` record linked to the signed-in account (via profiles.author_id),
 * or null for a plain reader. Read straight from `public.authors` by the linked
 * id, so it is always the user's OWN author record.
 */
export function useLinkedAuthor() {
  const { profile } = useProfile();
  const authorId = profile.authorId ?? null;

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
 * Whether the current account is a "Muallif akkaunti". Derives purely from the
 * fresh `profiles` row — `account_type = 'author'` OR a linked `author_id` — so
 * the badge / earnings / works surfaces appear as soon as the profile loads,
 * without waiting on any secondary query.
 */
export function useIsAuthor(): boolean {
  const { profile } = useProfile();
  return useMemo(() => isAuthorAccount(profile), [profile]);
}

/* ─────────────────────────  AUTHOR WORKS  ──────────────────────────── */

/** All works (books/poems/articles/screenplays) of the linked author. */
export function useAuthorWorks() {
  const { profile } = useProfile();
  const authorId = profile.authorId ?? null;

  const query = useQuery({
    queryKey: ["author", "works", authorId],
    enabled: !!authorId,
    staleTime: 60_000,
    queryFn: async (): Promise<AuthorWork[]> => {
      const { data, error } = await (supabase as any)
        .from("author_works")
        .select("*")
        .eq("author_id", authorId)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingRelation(error)) return [];
        throw error;
      }
      return Array.isArray(data)
        ? (data as AuthorWorkRow[]).map(mapAuthorWork)
        : [];
    },
  });

  return {
    works: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? "Asarlarni yuklab bo'lmadi" : null,
    refetch: query.refetch,
  };
}

/* ────────────────────────  AUTHOR EARNINGS  ────────────────────────── */

export interface AuthorEarningsData {
  summary: AuthorEarningsSummary;
  rows: AuthorEarning[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<unknown>;
}

/** The earnings dashboard data (aggregate summary + sales history rows). */
export function useAuthorEarnings(): AuthorEarningsData {
  const { profile } = useProfile();
  const authorId = profile.authorId ?? null;

  const summaryQuery = useQuery({
    queryKey: ["author", "earnings", "summary", authorId],
    enabled: !!authorId,
    staleTime: 30_000,
    queryFn: async (): Promise<AuthorEarningsSummary> => {
      const { data, error } = await (supabase as any)
        .from("author_earnings_summary")
        .select("*")
        .eq("author_id", authorId)
        .maybeSingle();
      if (error) {
        if (isMissingRelation(error)) return mapEarningsSummary(null);
        throw error;
      }
      return mapEarningsSummary(data as AuthorEarningsSummaryRow | null);
    },
  });

  const rowsQuery = useQuery({
    queryKey: ["author", "earnings", "rows", authorId],
    enabled: !!authorId,
    staleTime: 30_000,
    queryFn: async (): Promise<AuthorEarning[]> => {
      const { data, error } = await (supabase as any)
        .from("author_earnings")
        .select("*")
        .eq("author_id", authorId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        if (isMissingRelation(error)) return [];
        throw error;
      }
      return Array.isArray(data)
        ? (data as AuthorEarningRow[]).map(mapAuthorEarning)
        : [];
    },
  });

  return {
    summary: summaryQuery.data ?? mapEarningsSummary(null),
    rows: rowsQuery.data ?? [],
    loading: summaryQuery.isLoading || rowsQuery.isLoading,
    error:
      summaryQuery.error || rowsQuery.error
        ? "Daromadlarni yuklab bo'lmadi"
        : null,
    refetch: async () => {
      await Promise.all([summaryQuery.refetch(), rowsQuery.refetch()]);
    },
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
    error: query.error ? "Muallif topilmadi" : null,
    refetch: query.refetch,
  };
}

/** Works of any author (public), read by author id from `public.author_works`. */
export function useAuthorPublicWorks(authorId: string | undefined) {
  const query = useQuery({
    queryKey: ["author", "public-works", authorId],
    enabled: !!authorId,
    staleTime: 60_000,
    queryFn: async (): Promise<AuthorWork[]> => {
      const { data, error } = await (supabase as any)
        .from("author_works")
        .select("*")
        .eq("author_id", authorId)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingRelation(error)) return [];
        throw error;
      }
      return Array.isArray(data)
        ? (data as AuthorWorkRow[]).map(mapAuthorWork)
        : [];
    },
  });

  return {
    works: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? "Asarlarni yuklab bo'lmadi" : null,
    refetch: query.refetch,
  };
}
