/**
 * Irreversible in-app account deletion (Apple App Review guideline 5.1.1 (v)).
 *
 * Order matters and is not negotiable:
 *   1. the Edge Function confirms the account is really gone,
 *   2. only then the local caches / session are wiped and the user signed out.
 *
 * A failed request leaves the user signed in with an intact account and a clear
 * message — the app never claims a deletion it did not get confirmation for.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import {
  AccountDeletionError,
  accountDeletionMessage,
  deleteOwnAccount,
  purgeLocalAccountData,
} from "@/lib/accountDeletion";
import { useAuth } from "@/providers/AuthProvider";

export type AccountDeletionState = "idle" | "deleting" | "done";

export function useAccountDeletion() {
  const queryClient = useQueryClient();
  const { userId, isAuthenticated, signOut } = useAuth();
  const [state, setState] = useState<AccountDeletionState>("idle");
  const [error, setError] = useState<string | null>(null);
  // Guards against a double tap firing two deletions before `state` re-renders.
  const busy = useRef(false);

  /**
   * Runs the whole flow. Returns true only when the server confirmed the
   * deletion; on false, `error` holds the message to show.
   */
  const deleteAccount = useCallback(async (): Promise<boolean> => {
    if (busy.current) return false;
    if (!isAuthenticated) {
      setError("Hisobni o'chirish uchun avval akkauntga kiring.");
      return false;
    }

    busy.current = true;
    setError(null);
    setState("deleting");

    const deletedUserId = userId;

    try {
      await deleteOwnAccount();
    } catch (err) {
      setError(accountDeletionMessage(err));
      setState("idle");
      busy.current = false;
      if (!(err instanceof AccountDeletionError)) console.error("[accountDeletion]", err);
      return false;
    }

    // Server confirmed. Everything below is local cleanup and must not be able
    // to fail the flow — the account no longer exists either way.
    try {
      queryClient.clear();
      await purgeLocalAccountData(deletedUserId);
      await signOut();
    } catch (err) {
      console.warn("[accountDeletion] local sign-out after deletion failed", err);
    }

    setState("done");
    busy.current = false;
    return true;
  }, [isAuthenticated, queryClient, signOut, userId]);

  return {
    deleteAccount,
    state,
    isDeleting: state === "deleting",
    isDone: state === "done",
    error,
    clearError: useCallback(() => setError(null), []),
  };
}
