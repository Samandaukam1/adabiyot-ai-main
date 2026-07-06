import { supabase } from "@/lib/supabase";
import { createNotification } from "@/hooks/useNotifications";

export interface MentionPick {
  id: string;
  name: string;
  /** The despaced/lowercased handle actually inserted into the text as @handle. */
  handle: string;
}

/**
 * Persists @mentions for a freshly created post/comment and notifies each
 * mentioned user. Only mentions whose "@name" token is still present in the
 * final text are kept; never notifies the author. Best-effort — failures here
 * must never block the post/comment itself.
 */
export async function recordMentions(params: {
  mentions: MentionPick[];
  actorId: string;
  text: string;
  postId: string | null;
  commentId: string | null;
  /** Users who already got a notification for this action (e.g. reply target). */
  excludeUserIds?: string[];
}): Promise<void> {
  const { mentions, actorId, text, postId, commentId } = params;
  const exclude = new Set(params.excludeUserIds ?? []);
  const unique = new Map<string, MentionPick>();
  for (const m of mentions) {
    if (!m.id || m.id === actorId || exclude.has(m.id)) continue;
    // Keep only mentions whose @handle is still present in the final text.
    const tokenPresent = (m.handle && text.includes(`@${m.handle}`)) || text.includes(`@${m.name}`);
    if (!tokenPresent) continue;
    unique.set(m.id, m);
  }
  for (const m of unique.values()) {
    try {
      await (supabase as any).from("sozlab_mentions").insert({
        mentioned_user_id: m.id,
        mentioner_user_id: actorId,
        post_id: postId,
        comment_id: commentId,
        mention_text: text.slice(0, 200),
      });
    } catch {
      // ignore — notification below is the user-facing part
    }
    await createNotification({
      recipientId: m.id,
      actorId,
      type: "mention",
      title: "Sizni So'zLabda eslashdi",
      body: text.slice(0, 140),
      targetType: commentId ? "sozlab_comment" : "sozlab_post",
      targetPostId: postId,
      targetCommentId: commentId,
    });
  }
}
