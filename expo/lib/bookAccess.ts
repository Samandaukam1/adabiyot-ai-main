/**
 * Single source of truth for "can this user open this content?".
 *
 * Access is ALWAYS derived from the server, never from AsyncStorage or any other
 * on-device cache — a device that reinstalls the app, or a user who signs in on a
 * fresh TestFlight build, must see everything they already paid for.
 *
 * Resolution order (first match wins):
 *   1. free      — the content itself is free (is_free, or price <= 0)
 *   2. purchased — a `user_content_unlocks` row (the real one-time purchase)
 *   3. access    — an active subscription entitlement covers it
 *   4. library   — a `user_library` row (legacy / manually granted access)
 *   5. not_purchased
 *
 * Purchases + entitlements come from the payments backend
 * (`GET /api/payments/my-entitlements`, service-role) rather than a direct table
 * read, so RLS on `user_content_unlocks` can never hide a real purchase.
 */
import { supabase } from "@/lib/supabase";
import { fetchMyEntitlements } from "@/lib/paymentsApi";
import {
  isSubscriptionEntitlement,
  toApiContentType,
  type MyEntitlementsResponse,
  type PaymentContentType,
} from "@/types/payments";

export type BookAccessReason =
  | "free"
  | "purchased"
  | "access"
  | "library"
  | "not_purchased";

export interface BookAccessResult {
  hasAccess: boolean;
  reason: BookAccessReason;
  loading: false;
}

const DENIED: BookAccessResult = {
  hasAccess: false,
  reason: "not_purchased",
  loading: false,
};

function granted(reason: Exclude<BookAccessReason, "not_purchased">): BookAccessResult {
  return { hasAccess: true, reason, loading: false };
}

/** True when the entitlements payload contains a one-time unlock for this item. */
export function isUnlocked(
  entitlements: MyEntitlementsResponse | null | undefined,
  contentType: PaymentContentType,
  contentId: string
): boolean {
  return (
    entitlements?.content_unlocks.some(
      (u) => u.content_type === contentType && u.content_id === contentId
    ) ?? false
  );
}

/** True when the user holds an active subscription tariff. */
export function hasActiveSubscription(
  entitlements: MyEntitlementsResponse | null | undefined
): boolean {
  return entitlements?.entitlements.some(isSubscriptionEntitlement) ?? false;
}

/** Reads the free flag straight off the catalog row. Unknown ids are NOT free. */
async function isContentFree(
  contentType: PaymentContentType,
  contentId: string
): Promise<boolean> {
  const table =
    contentType === "book"
      ? "books"
      : contentType === "poem"
      ? "poems"
      : contentType === "article"
      ? "articles"
      : "screenplays";

  const { data, error } = await (supabase as any)
    .from(table)
    .select("is_free,price")
    .eq("id", contentId)
    .maybeSingle();

  if (error || !data) return false;
  if (data.is_free === true) return true;
  const price = Number(data.price ?? 0);
  return Number.isFinite(price) && price <= 0;
}

/** Legacy / manually granted access rows. Absent table or RLS block → false. */
async function isInUserLibrary(userId: string, contentId: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from("user_library")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", contentId)
    .limit(1);

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

/**
 * Resolve access for one content item. `contentType` accepts the app-side names
 * ("book" | "audio" | "poem" | "article" | "screenplay") and is normalised to the
 * backend's ("book" | "poem" | "article" | "scenario").
 *
 * Pass `entitlements` when you already have them (list screens, the restore flow)
 * to avoid one network round-trip per item.
 */
export async function hasContentAccess(
  userId: string | null | undefined,
  contentId: string | null | undefined,
  contentType: string = "book",
  opts?: { entitlements?: MyEntitlementsResponse | null; isFree?: boolean }
): Promise<BookAccessResult> {
  if (!contentId) return DENIED;
  const apiType = toApiContentType(contentType);

  // 1. Free content needs no account at all.
  const free = opts?.isFree ?? (await isContentFree(apiType, contentId));
  if (free) return granted("free");

  // Everything below is per-user.
  if (!userId) return DENIED;

  let entitlements = opts?.entitlements ?? null;
  if (entitlements === null && opts?.entitlements === undefined) {
    try {
      entitlements = await fetchMyEntitlements();
    } catch {
      entitlements = null; // offline / signed out — fall through to the library check
    }
  }

  // 2. A real one-time purchase.
  if (isUnlocked(entitlements, apiType, contentId)) return granted("purchased");

  // 3. An active subscription tariff.
  if (hasActiveSubscription(entitlements)) return granted("access");

  // 4. Legacy library grant.
  if (await isInUserLibrary(userId, contentId)) return granted("library");

  return DENIED;
}

/** Spec-named convenience wrapper for books. */
export function hasBookAccess(
  userId: string | null | undefined,
  bookId: string | null | undefined,
  opts?: { entitlements?: MyEntitlementsResponse | null; isFree?: boolean }
): Promise<BookAccessResult> {
  return hasContentAccess(userId, bookId, "book", opts);
}
