import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { HomeHeroAd } from "@/types/homeHeroAd";

const COLLAPSED_KEY_PREFIX = "homeHeroAdCollapsed:";

function compareAds(left: HomeHeroAd, right: HomeHeroAd): number {
  const leftOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return (right.created_at ?? "").localeCompare(left.created_at ?? "");
}

async function fetchActiveHomeAds(): Promise<HomeHeroAd[]> {
  const rpcResult = await (supabase as any).rpc("get_active_home_continue_banner");
  if (!rpcResult.error) return (rpcResult.data ?? []) as HomeHeroAd[];

  // Same source-of-truth table fallback for deployments where the RPC has not
  // been applied yet. Public RLS enforces these same active/date conditions.
  const now = new Date().toISOString();
  const tableResult = await (supabase as any)
    .from("home_continue_banners")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1);

  if (tableResult.error) throw tableResult.error;
  return (tableResult.data ?? []) as HomeHeroAd[];
}

export function useHomeHeroAd() {
  const [ad, setAd] = useState<HomeHeroAd | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await fetchActiveHomeAds();
        console.log("[HomeHeroAds] data:", data);
        if (!active) return;

        const activeAd = [...data].sort(compareAds)[0] ?? null;
        console.log("[HomeHeroAds] activeAd:", activeAd);
        setAd(activeAd);
        if (!activeAd) return;

        const saved = await AsyncStorage.getItem(`${COLLAPSED_KEY_PREFIX}${activeAd.id}`).catch(
          () => null
        );
        if (!active) return;
        setCollapsed(saved === null ? activeAd.is_hidden_by_default === true : saved === "1");
      } catch {
        console.log("[HomeHeroAds] data:", []);
        console.log("[HomeHeroAds] activeAd:", null);
        if (active) setAd(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setAdCollapsed = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      if (ad?.id) {
        AsyncStorage.setItem(`${COLLAPSED_KEY_PREFIX}${ad.id}`, next ? "1" : "0").catch(
          () => {}
        );
      }
    },
    [ad?.id]
  );

  return { ad, collapsed, loading, setCollapsed: setAdCollapsed };
}
