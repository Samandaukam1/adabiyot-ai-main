import { supabase } from "@/lib/supabase";
import { parseBuild } from "@/utils/version";

/**
 * Data layer for the "update available" modal.
 *
 * The user panel only READS version settings (via the `get_app_version_settings`
 * RPC, with a direct-table fallback). The admin panel manages the rows. Every
 * path is defensive: a missing RPC / table / network error resolves to `null`
 * so the app open is never blocked.
 */

export type VersionPlatform = "ios" | "android";

export interface AppVersionSettings {
  latestVersion: string | null;
  minimumSupportedVersion: string | null;
  buildNumber: number | null;
  minimumBuildNumber: number | null;
  forceUpdate: boolean;
  updateTitle: string | null;
  updateMessage: string | null;
  appStoreUrl: string | null;
  playMarketUrl: string | null;
}

function normalizeText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}

function mapRow(row: any): AppVersionSettings {
  return {
    latestVersion: normalizeText(row?.latest_version),
    minimumSupportedVersion: normalizeText(row?.minimum_supported_version),
    buildNumber: parseBuild(row?.build_number),
    minimumBuildNumber: parseBuild(row?.minimum_build_number),
    forceUpdate: row?.force_update === true,
    updateTitle: normalizeText(row?.update_title),
    updateMessage: normalizeText(row?.update_message),
    appStoreUrl: normalizeText(row?.app_store_url),
    playMarketUrl: normalizeText(row?.play_market_url),
  };
}

export async function fetchAppVersionSettings(
  platform: VersionPlatform
): Promise<AppVersionSettings | null> {
  const db = supabase as any;

  // Preferred: the read-only RPC.
  try {
    const { data, error } = await db.rpc("get_app_version_settings", {
      p_platform: platform,
    });
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return mapRow(row);
    }
  } catch {
    // fall through to the table read
  }

  // Fallback: read the table directly (RPC may not be deployed yet).
  try {
    const { data } = await db
      .from("app_version_settings")
      .select("*")
      .eq("platform", platform)
      .limit(1)
      .maybeSingle();
    return data ? mapRow(data) : null;
  } catch {
    return null;
  }
}
