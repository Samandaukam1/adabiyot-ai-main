/**
 * In-app "Akkauntni o'chirish" request — required by both App Store and Google
 * Play for any app with accounts.
 *
 * Nothing is deleted on device: the RPC files a row the team reviews. The user's
 * open request is read back so Settings can show "so'rov yuborilgan" instead of
 * offering the same action again.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export type AccountDeletionStatus = "pending" | "approved" | "rejected" | "completed";

export interface AccountDeletionRequest {
  id: string;
  status: AccountDeletionStatus;
  reason: string | null;
  requestedAt: string | null;
}

const QUERY_KEY = ["account-deletion-request"] as const;

function normalize(row: unknown): AccountDeletionRequest | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const status = typeof r.status === "string" ? r.status : "pending";
  return {
    id: r.id,
    status: status as AccountDeletionStatus,
    reason: typeof r.reason === "string" ? r.reason : null,
    requestedAt: typeof r.requested_at === "string" ? r.requested_at : null,
  };
}

export function useAccountDeletion() {
  const queryClient = useQueryClient();
  const { userId, isAuthenticated } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const query = useQuery({
    queryKey: [...QUERY_KEY, userId],
    queryFn: async (): Promise<AccountDeletionRequest | null> => {
      const { data, error } = await (supabase as any).rpc("get_my_account_deletion_request");
      // The migration may not be applied yet — an absent function must not blow
      // up the Settings screen, it just means "no request on file".
      if (error) return null;
      return normalize(Array.isArray(data) ? data[0] : data);
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: 0,
  });

  /** Files the request. Throws with a user-readable message on failure. */
  const requestDeletion = useCallback(
    async (reason?: string | null): Promise<AccountDeletionRequest | null> => {
      setSubmitting(true);
      try {
        const { data, error } = await (supabase as any).rpc("request_my_account_deletion", {
          reason: reason?.trim() ? reason.trim() : null,
        });
        if (error) throw new Error(error.message || "So'rovni yuborib bo'lmadi.");
        const row = normalize(Array.isArray(data) ? data[0] : data);
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        return row;
      } finally {
        setSubmitting(false);
      }
    },
    [queryClient]
  );

  const request = query.data ?? null;
  return {
    request,
    hasPendingRequest: request?.status === "pending",
    loading: query.isLoading,
    submitting,
    requestDeletion,
  };
}
