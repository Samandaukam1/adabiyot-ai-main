import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { resolveBadgeType, type VerificationType } from "@/types/profile";

export interface FollowUser {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  badge: VerificationType;
  bio: string | null;
}

const PROFILE_COLS =
  "id,display_name,full_name,pen_name,username,avatar_url,provider_avatar_url,bio,account_type,is_creator,is_adib,verification_type,is_vip,author_id";
const BASIC_COLS = "id,display_name,full_name,pen_name,username,avatar_url,provider_avatar_url,bio";

async function fetchProfilesByIds(ids: string[]): Promise<FollowUser[]> {
  if (ids.length === 0) return [];
  let res = await (supabase as any).from("mobile_public_profiles").select(PROFILE_COLS).in("id", ids);
  if (res.error) res = await (supabase as any).from("profiles").select(PROFILE_COLS).in("id", ids);
  if (res.error) res = await (supabase as any).from("profiles").select(BASIC_COLS).in("id", ids);
  const rows: any[] = Array.isArray(res.data) ? res.data : [];
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows
    .map((p) => ({
      id: p.id as string,
      name: (p.pen_name || p.display_name || p.full_name || "Foydalanuvchi").toString().trim() || "Foydalanuvchi",
      username: p.username ?? null,
      avatarUrl: resolveProfileAvatarUrl(p.avatar_url, p.provider_avatar_url),
      badge: resolveBadgeType({
        account_type: p.account_type,
        is_creator: p.is_creator === true,
        is_adib: p.is_adib === true,
        verification_type: p.verification_type,
        is_vip: p.is_vip === true,
        author_id: p.author_id,
      }),
      bio: p.bio ?? null,
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Users who follow `userId` (Obunachilar). */
export async function fetchFollowers(userId: string): Promise<FollowUser[]> {
  const { data } = await (supabase as any).from("user_follows").select("follower_id").eq("following_id", userId);
  const ids = Array.from(new Set((data ?? []).map((r: any) => r.follower_id).filter(Boolean))) as string[];
  return fetchProfilesByIds(ids);
}

/** Accounts `userId` follows (Obunalar). */
export async function fetchFollowing(userId: string): Promise<FollowUser[]> {
  const { data } = await (supabase as any).from("user_follows").select("following_id").eq("follower_id", userId);
  const ids = Array.from(new Set((data ?? []).map((r: any) => r.following_id).filter(Boolean))) as string[];
  return fetchProfilesByIds(ids);
}

/** Real follower / following counts for a profile from `user_follows`. */
export function useProfileFollowCounts(userId: string | null | undefined) {
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFollowers(0);
      setFollowing(0);
      return;
    }
    const [a, b] = await Promise.all([
      (supabase as any).from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
      (supabase as any).from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    setFollowers(a.count ?? 0);
    setFollowing(b.count ?? 0);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { followers, following, refresh };
}
