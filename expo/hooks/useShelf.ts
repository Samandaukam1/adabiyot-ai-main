import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  ensureShelfLoaded,
  getShelfSnapshot,
  recordReading,
  refreshShelf,
  removePlanned,
  subscribeShelf,
  togglePlanned,
  type ShelfContentType,
  type ShelfItem,
} from "@/lib/shelfStore";

export type { ShelfItem, ShelfContentType } from "@/lib/shelfStore";

/**
 * Reactive access to the "Tokcham" shelf (reading progress + planned reads).
 * Backed by a module store so every screen stays in sync. See `lib/shelfStore`.
 */
export function useShelf() {
  const { userId } = useAuth();
  useEffect(() => {
    void ensureShelfLoaded(userId);
  }, [userId]);

  const snap = useSyncExternalStore(subscribeShelf, getShelfSnapshot, getShelfSnapshot);

  const plannedKeys = useMemo(
    () => new Set(snap.planned.map((p) => `${p.contentType}:${p.contentId}`)),
    [snap.planned]
  );

  const isPlanned = useCallback(
    (contentType: ShelfContentType, contentId: string | null | undefined) =>
      !!contentId && plannedKeys.has(`${contentType}:${contentId}`),
    [plannedKeys]
  );

  const reading = useMemo(() => snap.reading.filter((x) => !x.finished), [snap.reading]);
  // Completed reads (finished === true) for the profile "O'qilgan" stat/modal.
  const completed = useMemo(() => snap.reading.filter((x) => x.finished), [snap.reading]);

  return {
    reading,
    completed,
    allReads: snap.reading,
    planned: snap.planned,
    ready: snap.ready,
    isPlanned,
    togglePlanned,
    recordReading,
    removePlanned,
    refresh: refreshShelf,
  };
}

/** Lightweight hook for a single content item's planned-read toggle. */
export function usePlannedRead(
  contentType: ShelfContentType,
  contentId: string | null | undefined
) {
  const { isPlanned, togglePlanned } = useShelf();
  const planned = isPlanned(contentType, contentId);

  const toggle = useCallback(
    (snapshot: { title: string; cover: string | null; author: string | null }) => {
      if (!contentId) return false;
      return togglePlanned({
        contentType,
        contentId,
        title: snapshot.title,
        cover: snapshot.cover,
        author: snapshot.author,
      });
    },
    [contentType, contentId, togglePlanned]
  );

  return { planned, toggle };
}
