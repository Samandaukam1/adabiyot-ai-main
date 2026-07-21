import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapAdibEntry, type AdibEntry } from "@/types/community";

type RawRow = Record<string, unknown>;
const LOAD_ERROR = "Ma’lumotlarni yuklashda xatolik yuz berdi.";

function rpcRows(data: unknown): RawRow[] {
  if (Array.isArray(data)) return data.filter((row): row is RawRow => !!row && typeof row === "object");
  if (!data || typeof data !== "object") return [];
  const object = data as Record<string, unknown>;
  for (const key of ["entries", "items", "rows", "data"]) {
    const value = object[key];
    if (Array.isArray(value)) {
      return value.filter((row): row is RawRow => !!row && typeof row === "object");
    }
  }
  return [object];
}

function mapRows(data: unknown): AdibEntry[] {
  return rpcRows(data)
    .map(mapAdibEntry)
    .filter((entry) => !!entry.id && !!entry.fullName);
}

interface ListResult {
  adibs: AdibEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Published entries only. Search is performed server-side by the public RPC. */
export function useAdibEncyclopedia(searchQuery = ""): ListResult {
  const query = searchQuery.trim();
  const [adibs, setAdibs] = useState<AdibEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchAdibs = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "get_published_adib_encyclopedia_entries",
        { p_query: query }
      );
      if (currentRequest !== requestId.current) return;

      if (rpcError) {
        if (__DEV__) console.warn("[AdibEncyclopedia] list RPC error:", rpcError);
        setAdibs([]);
        setError(LOAD_ERROR);
        setLoading(false);
        return;
      }

      setAdibs(mapRows(data));
      setLoading(false);
    } catch (rpcError) {
      if (currentRequest !== requestId.current) return;
      if (__DEV__) console.warn("[AdibEncyclopedia] list request failed:", rpcError);
      setAdibs([]);
      setError(LOAD_ERROR);
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAdibs();
    }, query ? 250 : 0);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [fetchAdibs, query]);

  return { adibs, loading, error, refetch: fetchAdibs };
}

interface DetailResult {
  adib: AdibEntry | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** One published entry, fetched directly rather than searched in the list. */
export function useAdibEntry(id: string | undefined): DetailResult {
  const [adib, setAdib] = useState<AdibEntry | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchEntry = useCallback(async () => {
    if (!id) {
      setAdib(null);
      setLoading(false);
      setError(null);
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "get_public_adib_encyclopedia_entry",
        { p_id: id }
      );
      if (currentRequest !== requestId.current) return;

      if (rpcError) {
        if (__DEV__) console.warn("[AdibEncyclopedia] detail RPC error:", rpcError);
        setAdib(null);
        setError(LOAD_ERROR);
        setLoading(false);
        return;
      }

      setAdib(mapRows(data)[0] ?? null);
      setLoading(false);
    } catch (rpcError) {
      if (currentRequest !== requestId.current) return;
      if (__DEV__) console.warn("[AdibEncyclopedia] detail request failed:", rpcError);
      setAdib(null);
      setError(LOAD_ERROR);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchEntry();
    return () => {
      requestId.current += 1;
    };
  }, [fetchEntry]);

  return { adib, loading, error, refetch: fetchEntry };
}
