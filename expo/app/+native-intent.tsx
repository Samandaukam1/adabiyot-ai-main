import { isAuthCallbackLink, resolveDeepLinkPath } from "@/lib/deepLink";

/**
 * Maps incoming `adabiyotx://` / universal deep links to app routes. QR-code
 * links arrive as `adabiyotx://open?type=screenplay&id=..` or
 * `adabiyotx://screenplay/..`.
 *
 * Anything we don't explicitly recognise falls back to home so an unknown link
 * never crashes the router — EXCEPT an OAuth callback, which is handed back
 * untouched so the access/refresh tokens in it survive.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (isAuthCallbackLink(path)) return path;
    return resolveDeepLinkPath(path) ?? "/";
  } catch {
    return "/";
  }
}
