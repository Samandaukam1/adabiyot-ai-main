import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export const LAST_BOOK_KEY = "adabiyot.last_book_id";

export function useLastRead(): { lastBookId: string | null; loading: boolean } {
  const [lastBookId, setLastBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(LAST_BOOK_KEY)
      .then((v) => setLastBookId(v))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { lastBookId, loading };
}
