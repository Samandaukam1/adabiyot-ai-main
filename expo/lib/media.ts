import { supabase } from "@/lib/supabase";

/**
 * Resolves a stored media reference to a playable/displayable URL.
 * - Empty → null (caller decides on a fallback)
 * - Already absolute (http/https) → returned as-is
 * - Otherwise treated as a storage path inside `bucketName` and resolved
 *   to its public URL.
 */
export function resolveMediaUrl(
  url: string | null | undefined,
  bucketName: string
): string | null {
  const clean = normalizeMediaRef(url);
  if (!clean) return null;
  if (isAbsoluteMediaUrl(clean)) return clean;
  try {
    return supabase.storage.from(bucketName).getPublicUrl(stripBucketPrefix(clean, bucketName)).data.publicUrl ?? null;
  } catch {
    return null;
  }
}

export function resolveProfileAvatarUrl(
  ...values: (string | null | undefined)[]
): string | null {
  // Pick the first value that is a real, persistable reference. A locally
  // picked URI (file:// / content:// / blob:// …) is never a valid stored
  // avatar — skip it so the fallback (provider photo / placeholder) is used
  // instead of a broken image after relaunch.
  for (const value of values) {
    const clean = normalizeMediaRef(value);
    if (!clean || isLocalMediaUri(clean)) continue;
    if (isRemoteMediaUrl(clean)) return clean;

    const bucket = clean.startsWith("profile-avatars/") ? "profile-avatars" : "avatars";
    try {
      return supabase.storage.from(bucket).getPublicUrl(stripBucketPrefix(clean, bucket)).data.publicUrl ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export function firstUsableMediaRef(
  ...values: (string | null | undefined)[]
): string | null {
  for (const value of values) {
    const clean = normalizeMediaRef(value);
    if (clean) return clean;
  }
  return null;
}

function normalizeMediaRef(value: string | null | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "none") return null;
  return clean.replace(/^public\//, "").replace(/^\/+/, "");
}

function isAbsoluteMediaUrl(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("file://") ||
    value.startsWith("data:")
  );
}

/** A remote, persistable URL (http/https/data) — safe to store and display. */
export function isRemoteMediaUrl(value: string | null | undefined): boolean {
  const v = value?.trim().toLowerCase() ?? "";
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:");
}

/**
 * A locally-picked / device-only URI that must NEVER be written to the database
 * (it only exists on this device and breaks after relaunch / on other devices).
 */
export function isLocalMediaUri(value: string | null | undefined): boolean {
  const v = value?.trim().toLowerCase() ?? "";
  return (
    v.startsWith("file://") ||
    v.startsWith("content://") ||
    v.startsWith("blob:") ||
    v.startsWith("ph://") ||
    v.startsWith("assets-library://") ||
    v.startsWith("/")
  );
}

function stripBucketPrefix(value: string, bucketName: string): string {
  const prefix = `${bucketName}/`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/**
 * Uploads a locally-picked image to the public `avatars` Storage bucket and
 * returns its PUBLIC URL. The object path is always scoped to the user's own
 * folder so it survives logout/login and never collides with other accounts:
 *
 *   avatars/{userId}/{kind}-{Date.now()}.{ext}
 *
 * Unlike the previous best-effort version, this NEVER returns the local URI on
 * failure — it returns `null` so the caller can surface an error and avoid
 * persisting a `file://` reference into the database. It never throws.
 *
 * @param kind  e.g. "profile" | "cover" | "jaxongir-ai-avatar"
 */
export async function uploadUserImage(
  localUri: string,
  userId: string,
  kind: string,
  bucket: string = "avatars"
): Promise<string | null> {
  if (!localUri || !userId) return null;
  try {
    const rawExt = (localUri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
    const safeExt = /^[a-z0-9]{1,4}$/.test(rawExt) ? rawExt : "jpg";
    const path = `${userId}/${kind}-${Date.now()}.${safeExt}`;

    const res = await fetch(localUri);
    const arrayBuffer = await res.arrayBuffer();
    if (!arrayBuffer || (arrayBuffer as ArrayBuffer).byteLength === 0) return null;
    const contentType =
      res.headers.get("content-type") ||
      (safeExt === "png" ? "image/png" : safeExt === "webp" ? "image/webp" : "image/jpeg");

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, { contentType, upsert: true });
    if (error) {
      if (__DEV__) console.warn(`[media] upload to ${bucket}/${path} failed:`, error.message);
      return null;
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return publicUrl && isRemoteMediaUrl(publicUrl) ? publicUrl : null;
  } catch (e) {
    if (__DEV__) console.warn("[media] upload threw:", e);
    return null;
  }
}

/**
 * Back-compat wrapper. The old API uploaded into per-feature buckets and fell
 * back to the local URI; the avatar/cover flow now lives in the single public
 * `avatars` bucket and returns `null` on failure (no `file://` ever persisted).
 */
export async function uploadProfileImage(
  localUri: string,
  bucket: string,
  prefix: string
): Promise<string | null> {
  const kind = bucket.includes("cover") ? "cover" : "profile";
  return uploadUserImage(localUri, prefix, kind, "avatars");
}

/**
 * Parses a "mm:ss" or "hh:mm:ss" timecode into seconds.
 * Returns null when the value is missing or not parseable — never throws.
 */
export function parseTimecodeText(text: string | null | undefined): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;

  let seconds = 0;
  for (const part of parts) {
    seconds = seconds * 60 + Number(part);
  }
  return Number.isFinite(seconds) ? seconds : null;
}

/** Formats seconds as "m:ss" or "h:mm:ss" for display. */
export function formatTimecode(totalSeconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(totalSeconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}
