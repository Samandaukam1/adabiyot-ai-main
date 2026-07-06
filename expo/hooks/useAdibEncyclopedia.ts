import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapAdibEntry, type AdibEntry } from "@/types/community";

/** Offline/demo fallback so the encyclopedia is never blank during development. */
const FALLBACK_ADIBS: AdibEntry[] = [
  {
    id: "demo-navoiy",
    fullName: "Alisher Navoiy",
    penName: "Navoiy",
    avatarUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/AlisherNavoi.jpg/440px-AlisherNavoi.jpg",
    shortDescription: "O'zbek mumtoz adabiyoti asoschisi, shoir va davlat arbobi.",
    biography:
      "Nizomiddin Mir Alisher Navoiy 1441-yilda Hirotda tug'ilgan. U turkiy tilda yozilgan g'azal, doston va ilmiy asarlari bilan o'zbek adabiy tilining shakllanishiga ulkan hissa qo'shgan.",
    education: "Hirot va Mashhad madrasalarida ta'lim olgan.",
    activity: "Shoir, mutafakkir, tilshunos va Temuriylar davlatining vaziri.",
    worksSummary: "«Xamsa», «Chor devon», «Mahbub ul-qulub», «Muhokamat ul-lug'atayn».",
    achievements: "Turkiy tilda «Xamsa» yaratgan birinchi shoir.",
    quotes: [
      "Odami ersang demagil odami, Onikim yo'q xalq g'amidin g'ami.",
      "Kishi bilmas ishin so'rmoqdin uyalma.",
    ],
    sources: ["O'zbekiston Milliy ensiklopediyasi"],
    featured: true,
    birthYear: "1441",
  },
  {
    id: "demo-cholpon",
    fullName: "Abdulhamid Cho'lpon",
    penName: "Cho'lpon",
    avatarUrl: null,
    shortDescription: "XX asr o'zbek she'riyatining yorqin namoyandasi.",
    biography:
      "Abdulhamid Sulaymon o'g'li Cho'lpon 1897-yilda Andijonda tug'ilgan. Jadidchilik harakatining faol vakili, shoir, dramaturg va tarjimon.",
    education: "Andijon madrasasida o'qigan.",
    activity: "Shoir, yozuvchi, dramaturg, tarjimon.",
    worksSummary: "«Kecha va kunduz» romani, «Buloqlar» she'riy to'plami.",
    achievements: "O'zbek modern she'riyatining asoschilaridan biri.",
    quotes: ["Yana oldim sozimni, Kuylayin ozod yurtni."],
    sources: [],
    featured: true,
    birthYear: "1897",
  },
  {
    id: "demo-qodiriy",
    fullName: "Abdulla Qodiriy",
    penName: "Julqunboy",
    avatarUrl: null,
    shortDescription: "O'zbek romanchiligi asoschisi.",
    biography:
      "Abdulla Qodiriy 1894-yilda Toshkentda tug'ilgan. O'zbek nasrining yetuk namoyandasi, «O'tkan kunlar» romani muallifi.",
    education: "Rus-tuzem maktabi va madrasada tahsil olgan.",
    activity: "Yozuvchi, jurnalist, satira ustasi.",
    worksSummary: "«O'tkan kunlar», «Mehrobdan chayon».",
    achievements: "O'zbek tarixiy romaniga asos solgan.",
    quotes: ["Tarix — millatning hofizasi."],
    sources: [],
    featured: false,
    birthYear: "1894",
  },
];

interface Result {
  adibs: AdibEntry[];
  loading: boolean;
  error: string | null;
  usingFallback: boolean;
  refetch: () => Promise<void>;
}

export function useAdibEncyclopedia(): Result {
  const [adibs, setAdibs] = useState<AdibEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchAdibs = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(null);

    const { data, error: viewErr } = await (supabase as any)
      .from("mobile_adib_encyclopedia")
      .select("*");

    if (isCancelled()) return;

    if (!viewErr && Array.isArray(data) && data.length > 0) {
      setAdibs(data.map(mapAdibEntry));
      setUsingFallback(false);
      setLoading(false);
      return;
    }

    // View missing or empty → graceful demo fallback
    setAdibs(FALLBACK_ADIBS);
    setUsingFallback(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdibs(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchAdibs]);

  const refetch = useCallback(() => fetchAdibs(), [fetchAdibs]);

  return { adibs, loading, error, usingFallback, refetch };
}

export function useAdibEntry(id: string | undefined) {
  const { adibs, loading } = useAdibEncyclopedia();
  const adib = useMemo(
    () => (id ? adibs.find((a) => a.id === id) ?? null : null),
    [adibs, id]
  );
  return { adib, loading };
}
