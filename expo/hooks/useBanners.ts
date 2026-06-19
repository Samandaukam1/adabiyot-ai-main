import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MobileHomeBanner } from "@/types/banner";

export function useBanners(): {
  banners: MobileHomeBanner[];
  loading: boolean;
  error: string | null;
} {
  const [banners, setBanners] = useState<MobileHomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (supabase as any)
      .from("mobile_home_banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(7)
      .then(({ data, error: err }: { data: MobileHomeBanner[] | null; error: unknown }) => {
        if (cancelled) return;
        if (err) {
          setError("Ma'lumot yuklanmadi");
        } else {
          setBanners(data ?? []);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { banners, loading, error };
}
