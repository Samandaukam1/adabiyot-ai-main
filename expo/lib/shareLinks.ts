import { Platform, Share } from "react-native";

import { appDeepLink, contentRoutePath } from "@/lib/deepLink";

/**
 * Universal share links.
 *
 * Everything the user shares carries the PUBLIC web URL (`https://adabiyotx.uz/...`)
 * — never the `adabiyotx://` scheme. On an iPhone with the app installed the
 * associated-domain (`app.json` → `ios.associatedDomains`) makes iOS open that
 * exact link inside AdabiyotX; everyone else lands on the same page on the web.
 * The custom scheme stays for in-app / QR routing only ({@link appDeepLink}).
 */
export const SHARE_BASE_URL = "https://adabiyotx.uz";

/** Share targets → the public web path segment (kept in sync with the routes). */
export const SHARE_ROUTE: Record<string, string> = {
  book: "book",
  poem: "poem",
  article: "article",
  screenplay: "screenplay",
  scenario: "screenplay",
  reel: "reels",
  reels: "reels",
  sozlab: "sozlab",
  post: "sozlab",
  profile: "profile",
  author: "author",
  adib: "adib-encyclopedia",
};

export type ShareLinkType = keyof typeof SHARE_ROUTE;

/**
 * Public, shareable URL for a piece of content, e.g.
 * `("book", "b1")` → `https://adabiyotx.uz/book/b1`.
 * Returns null when the type is unknown or the id is empty, so a caller can
 * fall back to a plain text share instead of sharing a broken link.
 */
export function getPublicShareUrl(
  type: string | null | undefined,
  idOrSlug: string | null | undefined
): string | null {
  const segment = SHARE_ROUTE[(type ?? "").toLowerCase()];
  const key = String(idOrSlug ?? "").trim().replace(/^@/, "");
  if (!segment || !key) return null;
  return `${SHARE_BASE_URL}/${segment}/${encodeURIComponent(key)}`;
}

/** The in-app route a share link points at, e.g. "/reels/123". */
export function shareRoutePath(
  type: string | null | undefined,
  idOrSlug: string | null | undefined
): string | null {
  const segment = SHARE_ROUTE[(type ?? "").toLowerCase()];
  const key = String(idOrSlug ?? "").trim().replace(/^@/, "");
  if (!segment || !key) return null;
  return `/${segment}/${key}`;
}

/**
 * Profile links prefer the @username (nice to read, stable across devices) and
 * fall back to the raw profile id when the user hasn't claimed one.
 */
export function getProfileShareUrl(profile: {
  username?: string | null;
  id?: string | null;
}): string | null {
  const username = profile.username?.trim().replace(/^@/, "");
  return getPublicShareUrl("profile", username || profile.id || null);
}

function shareMessage(type: string, title: string | null | undefined, url: string | null): string {
  const clean = title?.trim();
  const lines: string[] = [];
  switch (SHARE_ROUTE[type.toLowerCase()]) {
    case "reels":
      lines.push("AdabiyotX Reels" + (clean ? `: ${clean}` : ""));
      break;
    case "sozlab":
      lines.push("AdabiyotX So'zLab posti");
      if (clean) lines.push(clean);
      break;
    case "profile":
    case "author":
      lines.push("AdabiyotX profili" + (clean ? `: ${clean}` : ""));
      break;
    default:
      lines.push(clean ? `“${clean}” asarini AdabiyotX'da o'qing:` : "AdabiyotX'da o'qing:");
  }
  if (url) lines.push(url);
  return lines.filter(Boolean).join("\n");
}

/**
 * Opens the native share sheet with a public AdabiyotX link. Never throws — a
 * cancelled sheet or an unavailable platform API resolves to `false`.
 *
 * `message` overrides the generated text; the URL is always appended so the
 * receiver gets a tappable link even in apps that ignore the `url` field.
 */
export async function sharePublicLink(opts: {
  type: ShareLinkType | string;
  id: string | null | undefined;
  title?: string | null;
  message?: string | null;
}): Promise<boolean> {
  const url = getPublicShareUrl(opts.type, opts.id);
  const body = opts.message?.trim()
    ? [opts.message.trim(), url].filter(Boolean).join("\n")
    : shareMessage(String(opts.type), opts.title, url);
  try {
    const result = await Share.share({
      title: opts.title?.trim() || "AdabiyotX",
      message: body,
      // iOS shows `url` as a rich preview; Android would drop the message when
      // both are set, so the link only rides along inside the text there.
      ...(url && Platform.OS === "ios" ? { url } : {}),
    });
    return Platform.OS === "android" || result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/** Native deep link for the same target — used by the web `/open` bridge page. */
export function getAppDeepLink(
  type: string | null | undefined,
  idOrSlug: string | null | undefined
): string | null {
  return appDeepLink(String(type ?? ""), String(idOrSlug ?? "")) ?? null;
}

/** In-app router path for a content link (re-exported for share call sites). */
export { contentRoutePath };
