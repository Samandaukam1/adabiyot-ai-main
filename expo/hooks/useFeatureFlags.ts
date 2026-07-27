/**
 * Admin-controlled runtime switches (`app_feature_flags`).
 *
 * The app only ever READS these — the admin panel owns the values. Two flags
 * exist today, both introduced for the App Store / Play Market review pass:
 *
 *   tariffs_visible        — false hides the Settings "Tariflar / Mening tarifim /
 *                            Mening xaridlarim" entries. It does NOT disable the
 *                            payment system; buying a single book still works.
 *   review_mode_free_books — true opens every book for free (no "Sotib olish",
 *                            reader opens straight away), for a reviewer who has
 *                            no way to pay with a real Uzbek card.
 *
 * A failed/absent read falls back to the defaults below rather than blocking the
 * UI, so a network hiccup can never hide the tariffs from a paying user or make
 * paid content free.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { supabase } from "@/lib/supabase";

export type FeatureFlagKey = "tariffs_visible" | "review_mode_free_books";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const FEATURE_FLAG_DEFAULTS: FeatureFlags = {
  tariffs_visible: true,
  review_mode_free_books: false,
};

interface FeatureFlagRow {
  key?: unknown;
  enabled?: unknown;
}

function toFlags(rows: unknown): FeatureFlags {
  const flags: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS };
  if (!Array.isArray(rows)) return flags;

  rows.forEach((row: FeatureFlagRow) => {
    if (typeof row?.key !== "string") return;
    if (row.key in flags) {
      flags[row.key as FeatureFlagKey] = row.enabled === true;
    }
  });
  return flags;
}

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  // Prefer the RPC (one round trip, works regardless of table grants); fall back
  // to the table when the migration's function isn't deployed yet.
  const rpc = await (supabase as any).rpc("get_app_feature_flags");
  if (!rpc.error) return toFlags(rpc.data);

  const { data, error } = await (supabase as any)
    .from("app_feature_flags")
    .select("key,enabled");
  if (error) throw error;
  return toFlags(data);
}

export function useFeatureFlags(): { flags: FeatureFlags; isLoading: boolean } {
  const query = useQuery({
    queryKey: ["app-feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const flags = useMemo(() => query.data ?? FEATURE_FLAG_DEFAULTS, [query.data]);
  return { flags, isLoading: query.isLoading };
}

/** False hides every subscription/tariff entry in Settings. */
export function useTariffsVisible(): boolean {
  return useFeatureFlags().flags.tariffs_visible;
}

/**
 * True while the store-review mode is on: all content behaves as `is_free`, so
 * "Sotib olish" disappears and the reader opens without a purchase.
 */
export function useReviewFreeBooks(): boolean {
  return useFeatureFlags().flags.review_mode_free_books;
}
