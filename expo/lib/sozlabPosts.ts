import { supabase } from "@/lib/supabase";

/** Result shape shared by every So'zLab insert helper. */
export interface SozlabInsertResult {
  data: any | null;
  error: { message?: string; code?: string } | null;
}

/** The real `sozlab_posts` table carries a moderation_status CHECK column.
 *  Posts stay visible because the feed reads the base table directly, so a
 *  'pending' status is fine — we try the known-good values in order. */
const MODERATION_STATUS_CANDIDATES = ["pending", "approved"] as const;

export function isMissingColumnError(
  error: { message?: string } | null,
  columns: string[]
): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  if (!message) return false;
  return columns.some((column) => {
    const name = column.toLowerCase();
    return (
      message.includes(`'${name}'`) ||
      message.includes(`.${name}`) ||
      message.includes(`${name} column`) ||
      message.includes(`column ${name}`)
    );
  });
}

export function isModerationStatusConstraintError(
  error: { message?: string } | null
): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("sozlab_posts_moderation_status_check") ||
    (message.includes("moderation_status") && message.includes("check constraint"))
  );
}

function isPostTypeConstraintError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    (message.includes("post_type") || message.includes("type")) &&
    message.includes("check constraint")
  );
}

/** Insert a payload, trying each moderation_status value and gracefully
 *  handling deployments where the moderation_status column doesn't exist. */
async function insertWithModeration(payload: Record<string, unknown>): Promise<SozlabInsertResult> {
  let lastResult: SozlabInsertResult | null = null;

  for (const moderation_status of MODERATION_STATUS_CANDIDATES) {
    const result = (await (supabase as any)
      .from("sozlab_posts")
      .insert({ ...payload, moderation_status })
      .select("*")
      .single()) as SozlabInsertResult;

    if (isMissingColumnError(result.error, ["moderation_status"])) {
      return (await (supabase as any)
        .from("sozlab_posts")
        .insert(payload)
        .select("*")
        .single()) as SozlabInsertResult;
    }

    if (!isModerationStatusConstraintError(result.error)) return result;
    lastResult = result;
  }

  return (
    lastResult ?? {
      data: null,
      error: { message: "So'zLab moderation status qiymati bazaga mos kelmadi" },
    }
  );
}

export interface CreateSozlabPostInput {
  userId: string;
  content: string;
  title?: string | null;
  /** Tried in order; falls back to the next when a CHECK constraint rejects it. */
  postTypeCandidates?: string[];
  improvedContent?: string | null;
  /** Legacy schema needs a display_name; pass the author's pen/display name. */
  profileName?: string | null;
  attachment?: {
    id?: string | null;
    contentType?: string | null;
    title?: string | null;
    cover?: string | null;
    author?: string | null;
  } | null;
}

/**
 * Creates a So'zLab post using the exact battle-tested fallbacks the composer
 * relies on (moderation_status loop, modern `content`/`attached_content_*`
 * schema → legacy `body`/`target_*` schema, post_type candidates). Shared so
 * the content-review mirror posts through the same proven path.
 */
export async function createSozlabPost(input: CreateSozlabPostInput): Promise<SozlabInsertResult> {
  const att = input.attachment ?? null;
  const title = input.title ?? deriveTitle(input.content);
  const candidates = input.postTypeCandidates?.length ? input.postTypeCandidates : ["thought"];

  // ── Modern schema (content + post_type + attached_content_*) ──────────────
  let lastModern: SozlabInsertResult | null = null;
  for (const postType of candidates) {
    const modern = await insertWithModeration({
      user_id: input.userId,
      title,
      content: input.content,
      post_type: postType,
      status: "published",
      improved_content: input.improvedContent ?? null,
      image_url: att?.cover ?? null,
      attached_content_id: att?.id ?? null,
      attached_content_type: att?.contentType ?? null,
      attached_content_title: att?.title ?? null,
      attached_content_cover_url: att?.cover ?? null,
      attached_content_author: att?.author ?? null,
    });
    lastModern = modern;
    if (!modern.error) return modern;
    if (isPostTypeConstraintError(modern.error)) continue; // try next post_type
    break; // other errors → fall through to legacy
  }

  // Only attempt the legacy fallback when the modern columns are missing.
  const missingModern = isMissingColumnError(lastModern?.error ?? null, [
    "content",
    "post_type",
    "improved_content",
    "image_url",
    "attached_content_id",
    "attached_content_type",
    "attached_content_title",
    "attached_content_cover_url",
    "attached_content_author",
  ]);
  if (!missingModern) return lastModern ?? { data: null, error: { message: "Insert failed" } };

  // ── Legacy schema (body + type + target_*) ────────────────────────────────
  let lastLegacy: SozlabInsertResult | null = null;
  for (const postType of candidates) {
    const legacy = await insertWithModeration({
      user_id: input.userId,
      display_name: input.profileName ?? null,
      type: postType,
      target_kind: att?.contentType ?? "other",
      target_title: att?.title ?? title,
      target_author: att?.author ?? null,
      body: input.content,
      improved_body: input.improvedContent ?? null,
      metadata: { client: "expo", attached_cover: att?.cover ?? null },
    });
    lastLegacy = legacy;
    if (!legacy.error) return legacy;
    if (isPostTypeConstraintError(legacy.error)) continue;
    break;
  }
  return lastLegacy ?? { data: null, error: { message: "Insert failed" } };
}

/** Update an existing So'zLab post's text, handling content vs body columns. */
export async function updateSozlabPostText(
  id: string,
  title: string,
  content: string
): Promise<SozlabInsertResult> {
  const modern = (await (supabase as any)
    .from("sozlab_posts")
    .update({ title, content })
    .eq("id", id)) as SozlabInsertResult;
  if (!modern.error) return modern;
  return (await (supabase as any)
    .from("sozlab_posts")
    .update({ title, body: content })
    .eq("id", id)) as SozlabInsertResult;
}

function deriveTitle(body: string): string {
  const firstLine = body.split("\n").map((l) => l.trim()).find(Boolean) ?? "Fikr";
  return firstLine.slice(0, 80);
}
