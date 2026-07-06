import { useCallback, useEffect, useState } from "react";
import {
  fetchPublishedScreenplays,
  fetchScreenplayById,
  type DisplayScreenplay,
  type ScreenplayCard,
} from "@/lib/screenplays";

interface UsePublishedScreenplaysResult {
  screenplays: ScreenplayCard[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Real published screenplays for the Ssenariylar list screen. */
export function usePublishedScreenplays(): UsePublishedScreenplaysResult {
  const [screenplays, setScreenplays] = useState<ScreenplayCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(null);
    try {
      console.log("[usePublishedScreenplays] load start");
      const rows = await fetchPublishedScreenplays();
      console.log("[usePublishedScreenplays] rows:", rows);
      console.log("[usePublishedScreenplays] count:", rows.length);
      if (isCancelled()) return;
      setScreenplays(rows);
    } catch (e) {
      if (isCancelled()) return;
      setError(e instanceof Error ? e.message : "Ssenariylar yuklanmadi");
      setScreenplays([]);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refetch = useCallback(() => load(), [load]);

  return { screenplays, loading, error, refetch };
}

interface UseScreenplayResult {
  screenplay: DisplayScreenplay | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Full screenplay (with scenes/characters/music) for the detail + reader. */
export function useScreenplay(id: string | undefined): UseScreenplayResult {
  const [screenplay, setScreenplay] = useState<DisplayScreenplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      if (!id) {
        setScreenplay(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const row = await fetchScreenplayById(id);
        if (isCancelled()) return;
        setScreenplay(row);
        if (!row) setError("Ssenariy topilmadi");
      } catch (e) {
        if (isCancelled()) return;
        setError(e instanceof Error ? e.message : "Ssenariy yuklanmadi");
        setScreenplay(null);
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refetch = useCallback(() => load(), [load]);

  return { screenplay, loading, error, refetch };
}
