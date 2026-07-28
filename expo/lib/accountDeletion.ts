/**
 * Client side of the irreversible account deletion (Apple guideline 5.1.1 (v)).
 *
 * The app never deletes anything itself: it posts its OWN bearer token to the
 * `delete-own-account` Edge Function, which identifies the account from that
 * token and does the work with the service role. No user id is sent — the
 * server would ignore it anyway — and no privileged key exists on the device.
 *
 * `supabase.functions.invoke` is deliberately not used: the caller has to tell
 * 401 / 409 / 429 / 500 apart, and invoke() hides the HTTP status.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/delete-own-account`;
const REQUEST_TIMEOUT_MS = 30_000;

export type AccountDeletionErrorCode =
  | "no_session"
  | "unauthorized"
  | "in_progress"
  | "rate_limited"
  | "network"
  | "server_error";

export class AccountDeletionError extends Error {
  code: AccountDeletionErrorCode;
  status?: number;

  constructor(message: string, code: AccountDeletionErrorCode, status?: number) {
    super(message);
    this.name = "AccountDeletionError";
    this.code = code;
    this.status = status;
  }
}

/** User-facing Uzbek copy. The server's own technical text is never shown. */
export const ACCOUNT_DELETION_MESSAGES: Record<AccountDeletionErrorCode, string> = {
  no_session: "Sessiya topilmadi. Iltimos, qaytadan tizimga kiring.",
  unauthorized: "Sessiya muddati tugagan. Iltimos, qaytadan tizimga kiring.",
  in_progress: "Hisobni o'chirish jarayoni allaqachon boshlangan. Biroz kuting.",
  rate_limited: "Juda ko'p urinish bo'ldi. Bir daqiqadan so'ng qayta urining.",
  network: "Internet aloqasini tekshiring.",
  server_error: "Hisobni o'chirib bo'lmadi. Keyinroq qayta urinib ko'ring.",
};

export function accountDeletionMessage(error: unknown): string {
  if (error instanceof AccountDeletionError) return ACCOUNT_DELETION_MESSAGES[error.code];
  return ACCOUNT_DELETION_MESSAGES.server_error;
}

/** Dev-only. Never logs the token or any other secret. */
function debugLog(step: string, detail?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log("[accountDeletion]", step, detail ?? {});
}

async function postDelete(accessToken: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        // The user's own session token — this is what identifies the account.
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      // Deliberately empty: the server must not accept a user id from us.
      body: "{}",
      signal: controller.signal,
    });
  } catch (error) {
    throw new AccountDeletionError(
      error instanceof Error ? error.message : "network error",
      "network"
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Permanently delete the signed-in account.
 *
 * Resolves only when the server confirmed the deletion; every other outcome
 * throws an `AccountDeletionError`, so the caller can never sign the user out
 * on the strength of a failed request.
 */
export async function deleteOwnAccount(): Promise<{ tablesCleared: unknown }> {
  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token ?? null;
  if (!accessToken) throw new AccountDeletionError("no session", "no_session");

  debugLog("requesting deletion");
  let response = await postDelete(accessToken);

  // 401 → the token may simply have expired. Refresh once and retry before
  // asking the user to sign in again.
  if (response.status === 401) {
    debugLog("401 — refreshing session once");
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    accessToken = refreshed?.session?.access_token ?? null;
    if (refreshError || !accessToken) {
      throw new AccountDeletionError("session expired", "unauthorized", 401);
    }
    response = await postDelete(accessToken);
  }

  if (response.ok) {
    const payload = await response.json().catch(() => ({}));
    debugLog("deleted", { ok: true });
    return { tablesCleared: (payload as { deleted?: unknown }).deleted ?? null };
  }

  // Read the body only for the machine-readable code — its text stays internal.
  const payload = (await response.json().catch(() => ({}))) as { code?: string };
  debugLog("failed", { status: response.status, code: payload.code });

  switch (response.status) {
    case 401:
      throw new AccountDeletionError("unauthorized", "unauthorized", 401);
    case 409:
      throw new AccountDeletionError("already in progress", "in_progress", 409);
    case 429:
      throw new AccountDeletionError("rate limited", "rate_limited", 429);
    default:
      throw new AccountDeletionError(
        `server error ${response.status}`,
        "server_error",
        response.status
      );
  }
}

/**
 * Wipe everything this device holds for the deleted account: the per-account
 * namespace from `userStorage`, the persisted Supabase session and the guest
 * flag. Shared preferences (theme, app settings) survive — they are not
 * personal data and the device may be handed to a new account.
 */
export async function purgeLocalAccountData(userId: string | null): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter(
      (key) =>
        /^sb-.+-auth-token/.test(key) ||
        key.startsWith("adabiyotx:guest:") ||
        (!!userId && key.startsWith(`adabiyotx:user:${userId}:`))
    );
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
    debugLog("local data purged", { removed: doomed.length });
  } catch (error) {
    // The account is already gone server-side; a storage hiccup must not turn
    // that into an error the user sees.
    console.warn("[accountDeletion] local purge failed", error);
  }
}
