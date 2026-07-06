import { resolveDeepLinkPath } from "@/lib/deepLink";

/**
 * Maps incoming deep links (custom `adabiyotx://` / `rork-app://` schemes and
 * universal links) to app routes. QR-code links arrive as
 * `adabiyotx://open?type=screenplay&id=..` or `adabiyotx://screenplay/..`.
 *
 * Anything we don't explicitly recognise falls back to home so an unknown or
 * auth-callback link never crashes the router.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    return resolveDeepLinkPath(path) ?? "/";
  } catch {
    return "/";
  }
}
