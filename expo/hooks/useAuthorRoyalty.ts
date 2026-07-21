import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useEffectiveAuthorId, useIsAuthor } from "@/hooks/useAuthorAccount";
import { useAuth } from "@/providers/AuthProvider";
import {
  mapMyComplaint,
  mapRoyaltyLedgerEntry,
  mapRoyaltySummary,
  type AuthorRoyaltySummary,
  type MyPayoutComplaint,
  type RawRow,
  type RoyaltyLedgerEntry,
} from "@/types/authorRoyalty";

/**
 * Muallif daromadlari — the NEW royalty system, read through auth.uid()-scoped
 * RPCs so the app can never request another author's money data:
 *   get_my_author_royalty_summary() / get_my_author_royalty_ledger()
 *   create_my_author_payout_complaint(ledger_id, message)
 * When the RPCs are missing (SQL not applied on this deployment yet) the hooks
 * degrade to the older author_royalty_ledger / author_earnings reads so the
 * screen still shows real sales instead of erroring.
 */

// "Function/table doesn't exist (with these args)" → try the next fallback.
function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "42883" ||
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find|schema cache|does not exist/i.test(msg)
  );
}

/* ───────────────────────────  SUMMARY  ─────────────────────────────── */

async function fetchRoyaltySummary(
  authorId: string | null
): Promise<AuthorRoyaltySummary> {
  const { data, error } = await (supabase as any).rpc("get_my_author_royalty_summary");
  if (!error) {
    const row = Array.isArray(data) ? ((data[0] ?? null) as RawRow | null) : (data as RawRow | null);
    return mapRoyaltySummary(row);
  }
  if (!isMissingSchemaError(error)) throw error;

  // Old system fallback: aggregate view filtered by the linked author id.
  if (authorId) {
    const legacy = await (supabase as any)
      .from("author_earnings_summary")
      .select("*")
      .eq("author_id", authorId)
      .maybeSingle();
    if (!legacy.error && legacy.data) return mapRoyaltySummary(legacy.data as RawRow);
  }
  return mapRoyaltySummary(null);
}

/* ────────────────────────────  LEDGER  ─────────────────────────────── */

function toLedgerList(data: unknown): RoyaltyLedgerEntry[] {
  const rows = Array.isArray(data) ? (data as RawRow[]) : [];
  const mapped = rows
    .map(mapRoyaltyLedgerEntry)
    .filter(Boolean) as RoyaltyLedgerEntry[];
  return mapped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function fetchRoyaltyLedger(authorId: string | null): Promise<RoyaltyLedgerEntry[]> {
  const { data, error } = await (supabase as any).rpc("get_my_author_royalty_ledger");
  if (!error) return toLedgerList(data);
  if (!isMissingSchemaError(error)) throw error;

  if (!authorId) return [];

  // Fallback 1: the ledger table read directly (RLS lets an author see own rows).
  const direct = await (supabase as any)
    .from("author_royalty_ledger")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (!direct.error && Array.isArray(direct.data) && direct.data.length > 0) {
    return toLedgerList(direct.data);
  }

  // Fallback 2: the legacy per-sale view (rows map as transaction_type "sale").
  const legacy = await (supabase as any)
    .from("author_earnings")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (!legacy.error && Array.isArray(legacy.data)) return toLedgerList(legacy.data);
  return [];
}

/* ─────────────────────────  MY COMPLAINTS  ─────────────────────────── */

async function fetchMyComplaints(userId: string): Promise<MyPayoutComplaint[]> {
  // RLS scopes rows to the signed-in author; the profile filter is only a
  // belt-and-braces guard, dropped when the column name differs.
  let res = await (supabase as any)
    .from("author_payout_complaints")
    .select("*")
    .eq("profile_id", userId)
    .limit(200);
  if (res.error) {
    res = await (supabase as any)
      .from("author_payout_complaints")
      .select("*")
      .limit(200);
  }
  if (res.error || !Array.isArray(res.data)) return [];
  return (res.data as RawRow[])
    .map(mapMyComplaint)
    .filter(Boolean) as MyPayoutComplaint[];
}

/* ──────────────────────────────  HOOK  ─────────────────────────────── */

export interface AuthorRoyaltyData {
  summary: AuthorRoyaltySummary;
  ledger: RoyaltyLedgerEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<unknown>;
  /** True once a complaint exists (server or just-submitted) for the ledger row. */
  hasComplaint: (ledgerId: string) => boolean;
  submitComplaint: (ledgerId: string, message?: string) => Promise<void>;
  /** Ledger id whose complaint is currently being sent, if any. */
  submittingLedgerId: string | null;
}

export function useAuthorRoyalty(): AuthorRoyaltyData {
  const isAuthor = useIsAuthor();
  const { authorId } = useEffectiveAuthorId();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!userId && isAuthor;
  const [localComplaintIds, setLocalComplaintIds] = useState<Set<string>>(new Set());

  const summaryQuery = useQuery({
    queryKey: ["royalty", "summary", userId, authorId],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchRoyaltySummary(authorId),
  });

  const ledgerQuery = useQuery({
    queryKey: ["royalty", "ledger", userId, authorId],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchRoyaltyLedger(authorId),
  });

  const complaintsQuery = useQuery({
    queryKey: ["royalty", "complaints", userId],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchMyComplaints(userId as string),
  });

  const complainedIds = useMemo(() => {
    const ids = new Set(localComplaintIds);
    for (const complaint of complaintsQuery.data ?? []) {
      if (complaint.ledgerId) ids.add(complaint.ledgerId);
    }
    return ids;
  }, [complaintsQuery.data, localComplaintIds]);

  const complaintMutation = useMutation({
    mutationFn: async ({ ledgerId, message }: { ledgerId: string; message: string }) => {
      // Arg names may be plain or p_-prefixed depending on how the SQL was applied.
      const variants: Record<string, unknown>[] = [
        { ledger_id: ledgerId, message },
        { p_ledger_id: ledgerId, p_message: message },
      ];
      let lastError: { code?: string; message?: string } | null = null;
      for (const args of variants) {
        const { error } = await (supabase as any).rpc(
          "create_my_author_payout_complaint",
          args
        );
        if (!error) return;
        lastError = error;
        if (!isMissingSchemaError(error)) break;
      }
      throw new Error(
        lastError?.message ?? "Shikoyat yuborilmadi. Qayta urinib ko'ring."
      );
    },
    onSuccess: (_data, { ledgerId }) => {
      setLocalComplaintIds((prev) => {
        const next = new Set(prev);
        next.add(ledgerId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["royalty", "complaints"] });
      queryClient.invalidateQueries({ queryKey: ["royalty", "ledger"] });
    },
  });

  const submitComplaint = useCallback(
    async (ledgerId: string, message = "Menga hali pul yetib kelmadi") => {
      await complaintMutation.mutateAsync({ ledgerId, message });
    },
    [complaintMutation]
  );

  const hasComplaint = useCallback(
    (ledgerId: string) => complainedIds.has(ledgerId),
    [complainedIds]
  );

  return {
    summary: summaryQuery.data ?? mapRoyaltySummary(null),
    ledger: ledgerQuery.data ?? [],
    loading: summaryQuery.isLoading || ledgerQuery.isLoading,
    error:
      summaryQuery.error || ledgerQuery.error
        ? "Daromadlarni yuklab bo'lmadi"
        : null,
    refetch: async () => {
      await Promise.all([
        summaryQuery.refetch(),
        ledgerQuery.refetch(),
        complaintsQuery.refetch(),
      ]);
    },
    hasComplaint,
    submitComplaint,
    submittingLedgerId: complaintMutation.isPending
      ? complaintMutation.variables?.ledgerId ?? null
      : null,
  };
}
