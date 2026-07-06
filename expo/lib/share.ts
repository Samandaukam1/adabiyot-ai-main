import { Share } from "react-native";

/**
 * Shares a piece of content via the native share sheet. Always safe — never
 * throws (a cancelled sheet or platform error is swallowed).
 */
export async function shareContent(opts: {
  title: string;
  author?: string | null;
  description?: string | null;
  url?: string | null;
}): Promise<void> {
  try {
    const lines: string[] = [];
    if (opts.title) lines.push(opts.title);
    if (opts.author) lines.push(opts.author);
    if (opts.description) lines.push(opts.description);
    if (opts.url) lines.push(opts.url);
    lines.push("AdabiyotX'da o'qing");
    await Share.share({
      title: opts.title || "AdabiyotX",
      message: lines.filter(Boolean).join("\n"),
      ...(opts.url ? { url: opts.url } : {}),
    });
  } catch {
    // user cancelled or platform error — ignore
  }
}
