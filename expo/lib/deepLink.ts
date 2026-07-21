/**
 * Shared deep-link + QR routing helpers.
 *
 * Certificates encode a web open URL — `https://adabiyotx.uz/open?type=..&id=..`
 * — rather than a raw custom scheme, so people WITHOUT the app still land on the
 * web detail page. The `/open` page then tries the native app via
 * `adabiyotx://<type>/<id>` and falls back to the web route.
 */

/** Content types the QR / deep links can target → their Expo Router segment. */
export const CONTENT_ROUTE: Record<string, string> = {
  book: "book",
  article: "article",
  screenplay: "screenplay",
  poem: "poem",
};

export type ContentType = keyof typeof CONTENT_ROUTE;

export function isContentType(value: string): value is ContentType {
  return Object.prototype.hasOwnProperty.call(CONTENT_ROUTE, value);
}

/** In-app / web route for a content item, e.g. ("screenplay","123") → "/screenplay/123". */
export function contentRoutePath(type: string, id: string): string | null {
  const segment = CONTENT_ROUTE[type];
  if (!segment || !id) return null;
  return `/${segment}/${id}`;
}

/** Native custom-scheme deep link, e.g. ("screenplay","123") → "adabiyotx://screenplay/123". */
export function appDeepLink(type: string, id: string): string | null {
  const segment = CONTENT_ROUTE[type];
  if (!segment || !id) return null;
  return `adabiyotx://${segment}/${id}`;
}

/**
 * Parse an incoming deep-link string (with or without a `scheme://` prefix) into
 * its path segments and query params — without relying on the `URL`/`URLSearchParams`
 * globals, which aren't fully reliable under Hermes.
 */
export function parseDeepLink(raw: string): { segments: string[]; query: Record<string, string> } {
  let s = raw ?? "";
  const schemeIdx = s.indexOf("://");
  if (schemeIdx >= 0) s = s.slice(schemeIdx + 3);
  const [pathPart = "", queryPart = ""] = s.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query: Record<string, string> = {};
  for (const pair of queryPart.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const val = eq >= 0 ? pair.slice(eq + 1) : "";
    try {
      query[decodeURIComponent(key)] = decodeURIComponent(val);
    } catch {
      query[key] = val;
    }
  }
  return { segments, query };
}

/**
 * True for an OAuth redirect coming back from Google/Apple, e.g.
 * `adabiyotx://auth/callback#access_token=…`. These must NEVER be rewritten to a
 * route — the tokens live in the URL and Supabase needs to read them, so the
 * caller has to hand the link back untouched.
 */
export function isAuthCallbackLink(rawPath: string): boolean {
  const raw = rawPath ?? "";
  if (/[#&?](access_token|refresh_token|error_code)=/.test(raw)) return true;
  const { segments } = parseDeepLink(raw);
  return segments[0] === "auth" && segments[1] === "callback";
}

/**
 * Resolve any incoming deep-link path to an in-app route, or null to fall back.
 * Handles both `adabiyotx://open?type=..&id=..` and `adabiyotx://<type>/<id>`.
 */
export function resolveDeepLinkPath(rawPath: string): string | null {
  const { segments, query } = parseDeepLink(rawPath);
  if (segments.length === 0) return null;

  // /open?type=screenplay&id=123  → /screenplay/123
  if (segments[0] === "open") {
    return contentRoutePath(query.type ?? "", query.id ?? "");
  }
  // /screenplay/123  → /screenplay/123 (only for known content types)
  if (segments.length >= 2 && isContentType(segments[0])) {
    return contentRoutePath(segments[0], segments[1]);
  }
  return null;
}
