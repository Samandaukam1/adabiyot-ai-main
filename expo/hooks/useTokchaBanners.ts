import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MobileTokchaBanner } from "@/types/banner";

type TokchaBannerError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function logTokchaBannerError(error: TokchaBannerError) {
  console.error("TOKCHA BANNERS FETCH ERROR:", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

async function fetchTokchaBannerRows(): Promise<{
  banners: MobileTokchaBanner[];
  error: string | null;
}> {
  try {
    const { data, error } = await (supabase as any)
      .from("mobile_tokcha_banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(7);

    if (error) {
      logTokchaBannerError(error as TokchaBannerError);
      return { banners: [], error: "Bannerlar yuklanmadi" };
    }

    return { banners: (data ?? []).slice(0, 7), error: null };
  } catch (error) {
    const typedError = error as TokchaBannerError;
    logTokchaBannerError({
      message: typedError.message ?? "Noma'lum xatolik",
      code: typedError.code,
      details: typedError.details,
      hint: typedError.hint,
    });
    return { banners: [], error: "Bannerlar yuklanmadi" };
  }
}

export function useTokchaBanners(): {
  banners: MobileTokchaBanner[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [banners, setBanners] = useState<MobileTokchaBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchTokchaBannerRows();
    setBanners(result.banners);
    setError(result.error);

    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const result = await fetchTokchaBannerRows();

      if (!active) return;

      setBanners(result.banners);
      setError(result.error);

      setLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  return { banners, loading, error, refetch: fetchBanners };
}
