import { Linking } from "react-native";

/**
 * Central link-safety helpers.
 *
 * Admin-controlled banners and user-entered profile links flow into
 * `router.push` / `Linking.openURL`. Those sinks must never receive a
 * `javascript:` / `data:` payload or a surprise external URL where an internal
 * route was expected. Validate here before navigating.
 */

/** Schemes that must never be opened, regardless of source. */
const BLOCKED_SCHEME = /^(javascript|data|vbscript|file|blob|about):/i;

/** Non-http schemes we still allow to open (contact links). */
const ALLOWED_NON_HTTP = /^(mailto:|tel:|sms:)/i;

/** Bare domain like `instagram.com/foo` (no scheme) that we upgrade to https. */
const BARE_DOMAIN = /^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i;

/**
 * True when `link` is an in-app Expo Router path (`/marathons/...`).
 * Rejects protocol-relative (`//evil.com`), any `scheme://`, and blocked schemes.
 */
export function isSafeInternalRoute(link: unknown): link is string {
  if (typeof link !== "string") return false;
  const s = link.trim();
  if (s.length === 0) return false;
  if (!s.startsWith("/")) return false;
  if (s.startsWith("//")) return false; // protocol-relative → treated as external
  if (s.includes("://")) return false;
  if (BLOCKED_SCHEME.test(s)) return false;
  return true;
}

/** True when `link` is a plain `https://` URL that is safe to open externally. */
export function isSafeExternalUrl(link: unknown): link is string {
  if (typeof link !== "string") return false;
  return /^https:\/\//i.test(link.trim());
}

/**
 * Coerce a user/admin-entered link into a safe URL to open, or `null` when it
 * cannot be made safe. Upgrades `http://` and bare domains to `https://`,
 * passes through `mailto:`/`tel:`/`sms:`, and blocks dangerous schemes.
 */
export function normalizeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length === 0) return null;
  if (BLOCKED_SCHEME.test(s)) return null;
  if (ALLOWED_NON_HTTP.test(s)) return s;
  if (/^https:\/\//i.test(s)) return s;
  if (/^http:\/\//i.test(s)) return `https://${s.slice("http://".length)}`;
  if (BARE_DOMAIN.test(s)) return `https://${s}`;
  return null;
}

/**
 * Safely open an external URL. Returns `false` (never throws) when the link is
 * unsafe or the platform refuses to open it, so callers can no-op gracefully.
 */
export async function openExternalUrl(raw: unknown): Promise<boolean> {
  const url = normalizeExternalUrl(raw);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
