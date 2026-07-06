import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Follow state for a single target user. The followed user receives a
 * notification via the DB trigger `notify_new_follower`, and any new content
 * they publish notifies followers via `notify_followers_new_post`.
 */
export function useFollow(targetUserId: string | null | undefined) {
  const { userId } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isSelf = !!userId && !!targetUserId && userId === targetUserId;

  const refresh = useCallback(async () => {
    if (!targetUserId) return;
    const followers = await (supabase as any)
      .from("user_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", targetUserId);
    setFollowersCount(followers.count ?? 0);

    if (userId && !isSelf) {
      const { data } = await (supabase as any)
        .from("user_follows")
        .select("follower_id")
        .eq("follower_id", userId)
        .eq("following_id", targetUserId)
        .maybeSingle();
      setIsFollowing(!!data);
    } else {
      setIsFollowing(false);
    }
  }, [targetUserId, userId, isSelf]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Returns false when the action requires login (caller should route to auth). */
  const toggleFollow = useCallback(async (): Promise<boolean> => {
    if (!userId) return false; // not logged in → caller handles
    if (!targetUserId || isSelf || busy) return true;
    setBusy(true);
    const next = !isFollowing;
    // Optimistic
    setIsFollowing(next);
    setFollowersCount((c) => (c == null ? c : Math.max(0, c + (next ? 1 : -1))));
    try {
      if (next) {
        await (supabase as any)
          .from("user_follows")
          .upsert({ follower_id: userId, following_id: targetUserId }, { onConflict: "follower_id,following_id" });
      } else {
        await (supabase as any)
          .from("user_follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", targetUserId);
      }
    } catch {
      // Revert on failure
      setIsFollowing(!next);
      setFollowersCount((c) => (c == null ? c : Math.max(0, c + (next ? -1 : 1))));
    } finally {
      setBusy(false);
    }
    return true;
  }, [userId, targetUserId, isSelf, isFollowing, busy]);

  return { isFollowing, followersCount, busy, isSelf, canFollow: !!userId, toggleFollow, refresh };
}
