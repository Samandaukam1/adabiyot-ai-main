import { supabase } from "@/lib/supabase";

/**
 * Client-side helpers for the unique public @username. The rules here mirror the
 * DB constraints (`profiles_username_format_chk`) and RPCs in
 * `supabase/migrations/20260702000000_profiles_username.sql`, which remain the
 * source of truth — the app validates only to give instant feedback.
 */

// These MUST mirror the DB constraint `profiles_username_format_check` and the
// admin repo's `lib/username.ts` (start alphanumeric, 2–40 chars).
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 40;

/** Allowed: a-z 0-9 _ - . ; must start with a letter or digit; 2–40 chars. */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{1,39}$/;

/**
 * Normalize raw user input the same way the DB `normalize_username()` does:
 * drop a leading "@", remove spaces, trim, and lowercase. Also strips characters
 * that are never valid so the visible field stays clean while typing (the
 * leading-alphanumeric rule is enforced by {@link validateUsername}).
 */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

/**
 * Returns a human-readable Uzbek error for an invalid (already normalized)
 * username, or null when it is well-formed. Empty string is treated as "clear
 * the username" and is considered valid.
 */
export function validateUsername(normalized: string): string | null {
  if (normalized.length === 0) return null;
  if (normalized.length < USERNAME_MIN) {
    return `Kamida ${USERNAME_MIN} ta belgi bo'lishi kerak`;
  }
  if (normalized.length > USERNAME_MAX) {
    return `Ko'pi bilan ${USERNAME_MAX} ta belgi`;
  }
  if (/^[._-]/.test(normalized)) {
    return "Harf yoki raqam bilan boshlanishi kerak";
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return "Faqat harf, raqam, _, - va . belgilari ruxsat etiladi";
  }
  return null;
}

/**
 * Ask the DB whether a username is free for the current user. Returns false on
 * any error (network / not-signed-in) so the UI stays conservative.
 */
export async function checkUsernameAvailable(raw: string): Promise<boolean> {
  const normalized = normalizeUsername(raw);
  if (validateUsername(normalized) !== null || normalized.length === 0) return false;
  const { data, error } = await (supabase as any).rpc("is_username_available", {
    p_username: normalized,
  });
  if (error) return false;
  return data === true;
}

/**
 * Claim / change / clear the caller's username via the `set_username` RPC.
 * Returns the saved (normalized) username or null when cleared. Throws an Error
 * whose message is the friendly Uzbek text from the DB (e.g. "Bu username band").
 */
export async function saveUsername(raw: string): Promise<string | null> {
  const normalized = normalizeUsername(raw);
  const localError = validateUsername(normalized);
  if (localError) throw new Error(localError);

  const { data, error } = await (supabase as any).rpc("set_username", {
    p_username: normalized,
  });
  if (error) throw new Error(error.message || "Username saqlanmadi");
  return (data as string | null) ?? null;
}
