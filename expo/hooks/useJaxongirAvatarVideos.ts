import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { preloadJaxongirVideo } from "@/lib/jaxongirPreload";

export type AvatarVideoState =
  | "idle"
  | "greeting"
  | "thinking"
  | "talking"
  | "explaining"
  | "success"
  | "error"
  | "writing"
  | "listening";

export interface JaxongirAvatarVideo {
  id: string;
  video_state: AvatarVideoState;
  video_url: string;
  poster_url: string | null;
  is_transparent: boolean;
}

export type AvatarVideoMap = Partial<Record<AvatarVideoState, JaxongirAvatarVideo>>;

let _cache: AvatarVideoMap | null = null;
let _cacheTimestamp = 0;
let _fetchPromise: Promise<AvatarVideoMap> | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isCacheStale() {
  return !_cache || Date.now() - _cacheTimestamp > CACHE_TTL_MS;
}

function isWebm(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.webm($|\?)/i.test(url) || url.toLowerCase().includes("webm");
}

// HEVC-with-alpha (the only transparent iOS format) is always written as .mov by
// the admin pipeline; a non-transparent composite fallback is always .mp4.
function isMov(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.mov($|\?)/i.test(url);
}

/**
 * Per-platform URL resolution.
 *
 * Android: VP9/WebM with alpha  → use processed_video_url
 * iOS:     HEVC-alpha MOV (hvc1) → use fallback_video_url
 *
 * The admin produces:
 *   processed_video_url = WebM (Android transparent)
 *   fallback_video_url  = HEVC .mov (iOS transparent)
 *
 * We must never send a WebM to iOS — AVPlayer cannot decode it and
 * renders nothing (or shows a play-button overlay).
 */
function resolveVideoUrl(row: any): { url: string; isTransparent: boolean } {
  const processed = row.processed_video_url?.trim() || "";
  const fallback  = row.fallback_video_url?.trim()  || "";
  const original  = row.video_url?.trim()            || "";
  const raw       = row.raw_video_url?.trim()        || "";
  const rowTransparent = Boolean(row.is_transparent);

  if (Platform.OS === "ios") {
    // 1. fallback_video_url is the iOS pick. Only a .mov is HEVC-with-alpha
    //    (transparent); a .mp4 is a normal composite video and should still
    //    animate, just without transparent compositing.
    if (fallback && !isWebm(fallback)) {
      const transparent = isMov(fallback) && rowTransparent;
      if (__DEV__) console.log(
        `[JaxongirAI] iOS → fallback_video_url (${isMov(fallback) ? "HEVC alpha" : "composite mp4"}): ${fallback.slice(-40)}`,
      );
      return { url: fallback, isTransparent: transparent };
    }
    // 2. processed_video_url only if it happens NOT to be WebM
    if (processed && !isWebm(processed)) {
      if (__DEV__) console.log(`[JaxongirAI] iOS → processed_video_url (non-webm): ${processed.slice(-40)}`);
      return { url: processed, isTransparent: rowTransparent };
    }
    // 3. Original upload (likely has background, but at least plays)
    if (original && !isWebm(original)) {
      if (__DEV__) console.log(`[JaxongirAI] iOS → video_url (original): ${original.slice(-40)}`);
      return { url: original, isTransparent: false };
    }
    if (raw && !isWebm(raw)) {
      if (__DEV__) console.log(`[JaxongirAI] iOS → raw_video_url: ${raw.slice(-40)}`);
      return { url: raw, isTransparent: false };
    }
    // Last resort — return something even if WebM
    const lastResort = original || fallback || processed || raw;
    console.warn(`[JaxongirAI] iOS → last-resort (may be WebM): ${lastResort.slice(-40)}`);
    return { url: lastResort, isTransparent: false };
  }

  // Android: VP9/WebM alpha is the transparent format
  if (processed) {
    if (__DEV__) console.log(`[JaxongirAI] Android → processed_video_url (WebM): ${processed.slice(-40)}`);
    return { url: processed, isTransparent: rowTransparent };
  }
  if (original) {
    if (__DEV__) console.log(`[JaxongirAI] Android → video_url: ${original.slice(-40)}`);
    return { url: original, isTransparent: false };
  }
  const fallback2 = fallback || raw;
  if (__DEV__) console.log(`[JaxongirAI] Android → fallback: ${fallback2.slice(-40)}`);
  return { url: fallback2, isTransparent: false };
}

function rowToVideo(row: any): { state: AvatarVideoState; video: JaxongirAvatarVideo } | null {
  const { url, isTransparent } = resolveVideoUrl(row);
  if (!url) return null;
  return {
    state: row.video_state as AvatarVideoState,
    video: {
      id: String(row.id),
      video_state: row.video_state as AvatarVideoState,
      video_url: url,
      poster_url: row.poster_url ?? null,
      is_transparent: isTransparent,
    },
  };
}

const COLUMNS =
  "id, video_state, video_url, processed_video_url, fallback_video_url, raw_video_url, poster_url, is_transparent";

async function doFetch(): Promise<AvatarVideoMap> {
  // 1. Try the mobile view (published + is_active rows only)
  const viewRes = await supabase
    .from("mobile_jaxongir_ai_avatar_videos" as any)
    .select(COLUMNS);

  if (!viewRes.error && viewRes.data && viewRes.data.length > 0) {
    const map: AvatarVideoMap = {};
    for (const row of viewRes.data) {
      const r = rowToVideo(row);
      if (r) map[r.state] = r.video;
    }
    if (__DEV__) console.log("[JaxongirAI] loaded from view:", Object.keys(map));
    return map;
  }

  if (viewRes.error) {
    console.warn("[JaxongirAI] view error:", viewRes.error.message);
  } else {
    console.warn("[JaxongirAI] view: 0 rows — videos may not be published in admin panel");
  }

  // 2. Fallback: query base table directly (any is_active video, any status)
  const tableRes = await supabase
    .from("jaxongir_ai_avatar_videos" as any)
    .select(COLUMNS + ", status")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (tableRes.error) {
    console.warn("[JaxongirAI] base table error:", tableRes.error.message);
    return {};
  }

  const rows = tableRes.data ?? [];
  if (__DEV__) console.log(
    "[JaxongirAI] base table rows:",
    rows.length,
    rows.map((r: any) => `${r.video_state}(${r.status})`),
  );

  const map: AvatarVideoMap = {};
  for (const row of rows) {
    const r = rowToVideo(row);
    if (r) map[r.state] = r.video;
  }
  if (__DEV__) console.log("[JaxongirAI] loaded from base table:", Object.keys(map));
  return map;
}

function fetchVideos(): Promise<AvatarVideoMap> {
  if (_cache && !isCacheStale()) return Promise.resolve(_cache);
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = doFetch()
    .then((map) => {
      _cache = map;
      _cacheTimestamp = Date.now();
      _fetchPromise = null;
      // Warm the first clip shown on open (greeting → idle fallback) into the
      // video cache so shaking the phone plays it instantly.
      preloadJaxongirVideo(map.greeting?.video_url ?? map.idle?.video_url);
      return map;
    })
    .catch((err) => {
      console.warn("[JaxongirAI] fetch failed:", err);
      _fetchPromise = null;
      return _cache ?? ({} as AvatarVideoMap);
    });

  return _fetchPromise;
}

// Start background fetch immediately when the module loads
fetchVideos();

export function useJaxongirAvatarVideos() {
  const [videos, setVideos] = useState<AvatarVideoMap>(_cache ?? {});
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache && !isCacheStale()) {
      setVideos(_cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchVideos().then((map) => {
      setVideos(map);
      setLoading(false);
    });
  }, []);

  const getVideo = useCallback((state: AvatarVideoState): JaxongirAvatarVideo | null => {
    return videos[state] ?? videos["idle"] ?? null;
  }, [videos]);

  /** Force-invalidate and re-fetch (e.g. after admin re-processes a video). */
  const invalidateCache = useCallback(() => {
    _cache = null;
    _cacheTimestamp = 0;
    _fetchPromise = null;
    setLoading(true);
    fetchVideos().then((map) => {
      setVideos(map);
      setLoading(false);
    });
  }, []);

  /** Re-fetch only if the TTL has expired — safe to call on every open. */
  const refetchIfStale = useCallback(() => {
    if (!isCacheStale()) return;
    fetchVideos().then((map) => setVideos(map));
  }, []);

  return { videos, loading, getVideo, invalidateCache, refetchIfStale };
}
