import { useCallback, useEffect, useState } from "react";
import {
  fetchPublicReels,
  fetchReelsByUser,
  fetchSavedReels,
  type PublicReel,
} from "@/lib/reels";

/**
 * Reels published by `profileUserId`, for a profile "Reels" tab. When `own` is
 * true the profile owner also sees their pending/rejected uploads; otherwise
 * only approved + published reels are returned.
 */
export function useUserReels(
  profileUserId?: string | null,
  own?: boolean,
  currentUserId?: string | null
) {
  const [reels, setReels] = useState<PublicReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profileUserId) {
      setReels([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReelsByUser(profileUserId, { includeUnpublished: !!own, currentUserId });
      setReels(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reels yuklanmadi");
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [profileUserId, own, currentUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reels, loading, error, refresh };
}

export function usePublicReels(userId?: string | null) {
  const [reels, setReels] = useState<PublicReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPublicReels(userId);
      setReels(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reels yuklanmadi");
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reels, setReels, loading, error, refresh };
}

export function useSavedReels(userId?: string | null) {
  const [reels, setReels] = useState<PublicReel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setReels([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSavedReels(userId);
      setReels(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlangan reels yuklanmadi");
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reels, loading, error, refresh };
}
