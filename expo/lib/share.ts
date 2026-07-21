import { Platform, Share } from "react-native";

import { getPublicShareUrl } from "@/lib/shareLinks";

/**
 * Shares a piece of content via the native share sheet. Always safe — never
 * throws (a cancelled sheet or platform error is swallowed).
 *
 * When `type` + `id` are given the public `https://adabiyotx.uz/...` link is
 * built automatically, so the receiver opens the exact page — inside the app if
 * AdabiyotX is installed, in the browser otherwise.
 */
export async function shareContent(opts: {
  title: string;
  author?: string | null;
  description?: string | null;
  url?: string | null;
  type?: string | null;
  id?: string | null;
}): Promise<void> {
  try {
    const url = opts.url ?? getPublicShareUrl(opts.type, opts.id);
    const lines: string[] = [];
    if (opts.title) lines.push(opts.title);
    if (opts.author) lines.push(opts.author);
    if (opts.description) lines.push(opts.description);
    if (url) lines.push(url);
    lines.push("AdabiyotX'da o'qing");
    await Share.share({
      title: opts.title || "AdabiyotX",
      message: lines.filter(Boolean).join("\n"),
      // Android drops the message when a url is also set — there the link only
      // travels inside the text.
      ...(url && Platform.OS === "ios" ? { url } : {}),
    });
  } catch {
    // user cancelled or platform error — ignore
  }
}
