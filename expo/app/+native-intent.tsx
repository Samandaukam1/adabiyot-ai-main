import { authCallbackRoutePath, isAuthCallbackLink, resolveDeepLinkPath } from "@/lib/deepLink";

/**
 * Maps incoming `adabiyotx://` / universal deep links to app routes. QR-code
 * links arrive as `adabiyotx://open?type=screenplay&id=..` or
 * `adabiyotx://screenplay/..`.
 *
 * Anything we don't explicitly recognise falls back to home so an unknown link
 * never crashes the router — EXCEPT an OAuth callback, which is routed to the
 * callback screen with its tokens intact (query AND `#fragment` alike), so the
 * user lands back INSIDE the app after signing in with Google/Apple.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (isAuthCallbackLink(path)) return authCallbackRoutePath(path);
    return resolveDeepLinkPath(path) ?? "/";
  } catch {
    return "/";
  }
}
