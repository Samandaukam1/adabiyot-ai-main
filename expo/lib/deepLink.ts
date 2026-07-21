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
  // Share targets — a shared `https://adabiyotx.uz/<segment>/<id>` link must
  // resolve to the SAME route inside the app.
  reels: "reels",
  reel: "reels",
  sozlab: "sozlab",
  post: "sozlab",
  profile: "profile",
  u: "u",
  author: "author",
  "adib-encyclopedia": "adib-encyclopedia",
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

  // The fragment comes off FIRST: an implicit-flow OAuth callback keeps its
  // tokens there (`…/auth/callback#access_token=…`), and they have to be read
  // as params — never as part of the path.
  const hashIdx = s.indexOf("#");
  const fragment = hashIdx >= 0 ? s.slice(hashIdx + 1) : "";
  if (hashIdx >= 0) s = s.slice(0, hashIdx);

  const [pathPart = "", queryPart = ""] = s.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query: Record<string, string> = {};
  for (const pair of `${queryPart}&${fragment}`.split("&")) {
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
  // `auth` is not always segment 0 — a universal link keeps the host in front
  // (`https://adabiyotx.uz/auth/callback?code=…`).
  const { segments } = parseDeepLink(raw);
  const authIdx = segments.indexOf("auth");
  return authIdx >= 0 && segments[authIdx + 1] === "callback";
}

/** In-app route for the auth callback screen. */
export const AUTH_CALLBACK_ROUTE = "/auth/callback";

/**
 * Normalise an incoming OAuth callback link into a router path the app can
 * actually navigate to — `adabiyotx://auth/callback#access_token=…` becomes
 * `/auth/callback?access_token=…`, so the screen reads everything through the
 * usual search params no matter whether the provider used the query or the
 * fragment.
 */
export function authCallbackRoutePath(rawUrl: string): string {
  const { query } = parseDeepLink(rawUrl);
  const search = Object.entries(query)
    .filter(([key, value]) => key && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return search ? `${AUTH_CALLBACK_ROUTE}?${search}` : AUTH_CALLBACK_ROUTE;
}

/** `adabiyotx.uz`, `www.adabiyotx.uz`, `192.168.1.5:8081`, `localhost:8081`… */
function isHostSegment(segment: string): boolean {
  if (/^localhost(:\d+)?$/i.test(segment)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(segment);
}

/**
 * Drop everything in front of the real path: the host of a universal link
 * (`https://adabiyotx.uz/book/1` → `book/1`) and the Expo Go `--` marker
 * (`exp://192.168.1.5:8081/--/book/1`).
 */
function stripLinkPrefix(segments: string[]): string[] {
  let out = segments;
  if (out.length > 0 && isHostSegment(out[0]!)) out = out.slice(1);
  if (out.length > 0 && out[0] === "--") out = out.slice(1);
  return out;
}

/**
 * Resolve any incoming deep-link path to an in-app route, or null to fall back.
 * Handles `adabiyotx://open?type=..&id=..`, `adabiyotx://<type>/<id>` and the
 * public universal links (`https://[www.]adabiyotx.uz/<type>/<id>`).
 */
export function resolveDeepLinkPath(rawPath: string): string | null {
  const { segments: raw, query } = parseDeepLink(rawPath);
  const segments = stripLinkPrefix(raw);
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
