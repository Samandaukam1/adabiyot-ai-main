import { useCallback, useEffect, useState } from "react";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export type NotificationType =
  | "mention"
  | "comment_reply"
  | "new_follower"
  | "new_content"
  | "rating"
  | "system"
  | "creator_application_submitted"
  | "creator_application_approved";

export interface AppNotification {
  id: string;
  actorUserId: string | null;
  type: NotificationType;
  title: string | null;
  body: string | null;
  targetType: string | null;
  targetPostId: string | null;
  targetCommentId: string | null;
  contentType: string | null;
  contentId: string | null;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  actorVerification: string | null;
}

function mapRow(r: any): AppNotification {
  const metadata = r.metadata ?? r.data ?? null;
  return {
    id: r.id,
    actorUserId: r.actor_user_id ?? r.actor_id ?? null,
    type: (r.notification_type ?? r.type ?? "system") as NotificationType,
    title: r.title ?? null,
    body: r.body ?? r.message ?? null,
    targetType: r.target_type ?? metadata?.target_type ?? null,
    targetPostId: r.target_post_id ?? metadata?.target_post_id ?? null,
    targetCommentId: r.target_comment_id ?? metadata?.target_comment_id ?? null,
    contentType: r.content_type ?? metadata?.content_type ?? null,
    contentId: r.content_id ?? metadata?.content_id ?? null,
    metadata,
    isRead: r.is_read === true,
    createdAt: r.created_at,
    actorName: r.actor_name ?? null,
    actorAvatarUrl: resolveProfileAvatarUrl(r.actor_avatar_url),
    actorVerification: r.actor_verification_type ?? null,
  };
}

async function fetchNotificationRows(userId: string): Promise<any[]> {
  const view = await (supabase as any)
    .from("mobile_my_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!view.error && Array.isArray(view.data)) return view.data;

  // New/base schema requested for this flow:
  // notifications(user_id,type,title,message,is_read,created_at,data)
  const byUserId = await (supabase as any)
    .from("notifications")
    .select("id,user_id,type,title,message,is_read,created_at,data,target_type")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!byUserId.error && Array.isArray(byUserId.data)) return byUserId.data;

  // Existing app schema from the migration:
  // notifications(recipient_id,notification_type,title,body,metadata,...)
  const byRecipientId = await (supabase as any)
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!byRecipientId.error && Array.isArray(byRecipientId.data)) return byRecipientId.data;

  console.error(
    "[notifications] load failed:",
    view.error?.message ?? byUserId.error?.message ?? byRecipientId.error?.message
  );
  return [];
}

async function unreadCountFallback(userId: string): Promise<number> {
  const view = await (supabase as any)
    .from("mobile_my_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (!view.error) return view.count ?? 0;

  const byUserId = await (supabase as any)
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (!byUserId.error) return byUserId.count ?? 0;

  const byRecipientId = await (supabase as any)
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);
  if (!byRecipientId.error) return byRecipientId.count ?? 0;

  console.error(
    "[notifications] unread count failed:",
    view.error?.message ?? byUserId.error?.message ?? byRecipientId.error?.message
  );
  return 0;
}

/**
 * Creates a notification for another user. Standalone (not a hook) so it can be
 * called from comment send, mention parsing and the content-review mirror.
 * Never notifies yourself. RLS requires actor_user_id = auth.uid().
 */
export async function createNotification(params: {
  recipientId: string | null | undefined;
  actorId: string | null | undefined;
  type: NotificationType;
  title?: string | null;
  body?: string | null;
  targetType?: string | null;
  targetPostId?: string | null;
  targetCommentId?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<void> {
  const { recipientId, actorId } = params;
  if (!recipientId || !actorId) return;
  if (recipientId === actorId) return; // never notify yourself
  try {
    await (supabase as any).from("notifications").insert({
      recipient_id: recipientId,
      actor_user_id: actorId,
      notification_type: params.type,
      title: params.title ?? null,
      body: params.body ?? null,
      target_type: params.targetType ?? null,
      target_post_id: params.targetPostId ?? null,
      target_comment_id: params.targetCommentId ?? null,
      content_type: params.contentType ?? null,
      content_id: params.contentId ?? null,
      metadata: params.metadata ?? null,
    });
  } catch {
    // Best-effort: a failed notification must never block the main action.
  }
}

/** Full notifications feed for the current user + unread count + read actions. */
export function useNotifications() {
  const { userId } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchNotificationRows(userId);
      const mapped = rows.map(mapRow);
      setItems(mapped);
      setUnreadCount(mapped.filter((n: AppNotification) => !n.isRead).length);
    } catch (error) {
      console.error("[notifications] load threw:", error);
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    const { error } = await (supabase as any).rpc("mark_notification_read", { p_notification_id: id });
    if (error) {
      const fallback = await (supabase as any).from("notifications").update({ is_read: true }).eq("id", id);
      if (fallback.error) console.error("[notifications] mark read failed:", fallback.error.message);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    const { error } = await (supabase as any).rpc("mark_all_notifications_read");
    if (error) {
      const fallback = await (supabase as any)
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (fallback.error) console.error("[notifications] mark all read failed:", fallback.error.message);
    }
  }, []);

  return { items, unreadCount, loading, refresh: load, markRead, markAllRead };
}

/** Lightweight unread badge for the Home / So'zLab bell icons. */
export function useUnreadNotificationCount() {
  const { userId } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    const { data, error } = await (supabase as any).rpc("unread_notifications_count");
    if (!error && typeof data === "number") {
      setCount(data);
      return;
    }
    setCount(await unreadCountFallback(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, refresh };
}
