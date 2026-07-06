/**
 * Per-account local storage isolation.
 *
 * Every piece of PRIVATE local data (profile, library, reading progress,
 * drafts, …) must be namespaced by the Supabase auth user id so that Google,
 * Apple and guest sessions never read or overwrite each other's data on the
 * same device.
 *
 *   logged in → adabiyotx:user:<auth-user-id>:<base>
 *   guest     → adabiyotx:guest:<base>
 *
 * Shared, non-private preferences (theme, app settings) keep their old keys.
 */

const USER_PREFIX = "adabiyotx:user:";
const GUEST_PREFIX = "adabiyotx:guest:";

/** Build a storage key scoped to the given user (or the guest namespace). */
export function userScopedKey(base: string, userId: string | null | undefined): string {
  return userId ? `${USER_PREFIX}${userId}:${base}` : `${GUEST_PREFIX}${base}`;
}

// Module-level mirror of the current auth user id, kept in sync by AuthProvider.
// Lets imperative, non-React call sites (e.g. a reader saving progress) scope
// their keys without prop-drilling the session.
let _currentUserId: string | null = null;

export function setCurrentUserId(userId: string | null): void {
  _currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return _currentUserId;
}

/** Scope a key against the current auth user (imperative call sites). */
export function scopedKey(base: string): string {
  return userScopedKey(base, _currentUserId);
}
