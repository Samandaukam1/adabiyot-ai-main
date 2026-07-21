/**
 * "Xaridlarni tiklash" — re-pulls the signed-in user's purchases from the
 * payments backend and drops every cached copy so the whole app re-reads them.
 *
 * IMPORTANT: this does NOT move purchases between accounts. Unlocks belong to the
 * Supabase user id that paid, so a person who bought with Google and later signed
 * in with Apple gets a *different* account and legitimately sees nothing. We tell
 * them that in plain language instead of silently transferring anything.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { fetchMyEntitlements, fetchMyOrders } from "@/lib/paymentsApi";
import { useAuth } from "@/providers/AuthProvider";
import { hasActiveSubscription } from "@/lib/bookAccess";
import { PaymentApiError } from "@/types/payments";

export type RestoreStatus = "idle" | "loading" | "restored" | "empty" | "other_account" | "error";

export interface RestoreResult {
  status: RestoreStatus;
  message: string;
  /** Number of one-time purchases found on this account. */
  count: number;
}

const MSG = {
  restored: "Xaridlaringiz tiklandi",
  empty: "Bu accountda xaridlar topilmadi.",
  otherAccount:
    "Xaridlaringiz boshqa accountga bog‘langan bo‘lishi mumkin. Oldin xarid qilgan " +
    "Google accountingiz bilan kiring yoki yordam xizmatiga murojaat qiling.",
  signedOut: "Avval akkauntingizga kiring.",
  error: "Xarid holatini tekshirishda xatolik yuz berdi.",
};

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  const { userId, isAuthenticated } = useAuth();
  const [result, setResult] = useState<RestoreResult>({ status: "idle", message: "", count: 0 });

  const restore = useCallback(async (): Promise<RestoreResult> => {
    if (!isAuthenticated || !userId) {
      const denied: RestoreResult = { status: "error", message: MSG.signedOut, count: 0 };
      setResult(denied);
      return denied;
    }

    setResult({ status: "loading", message: "", count: 0 });

    try {
      // Drop every cached payments answer first, so nothing stale can satisfy
      // the refetch below.
      await queryClient.invalidateQueries({ queryKey: ["payments"] });

      const [entitlements, orders] = await Promise.all([
        fetchMyEntitlements(),
        fetchMyOrders().catch(() => []),
      ]);

      const unlocks = entitlements.content_unlocks.filter((u) => u.content_id);
      const subscribed = hasActiveSubscription(entitlements);
      const paidOrders = orders.filter((o) => o.status === "paid");

      // Re-seed the cache with the fresh server truth so every screen that reads
      // entitlements (book detail, reader, audio, Tokcham) updates immediately.
      queryClient.setQueryData(["payments", "entitlements", userId], entitlements);
      await queryClient.refetchQueries({ queryKey: ["payments"] });

      if (unlocks.length > 0 || subscribed) {
        const next: RestoreResult = {
          status: "restored",
          message: MSG.restored,
          count: unlocks.length,
        };
        setResult(next);
        return next;
      }

      // Paid orders but no unlocks means the purchase settled against a different
      // account than the one currently signed in.
      const next: RestoreResult = paidOrders.length > 0
        ? { status: "other_account", message: MSG.otherAccount, count: 0 }
        : { status: "empty", message: MSG.empty, count: 0 };
      setResult(next);
      return next;
    } catch (error) {
      const message =
        error instanceof PaymentApiError && error.code === "network"
          ? "Internet aloqasini tekshiring."
          : MSG.error;
      const next: RestoreResult = { status: "error", message, count: 0 };
      setResult(next);
      return next;
    }
  }, [isAuthenticated, userId, queryClient]);

  return {
    restore,
    result,
    isRestoring: result.status === "loading",
  };
}
