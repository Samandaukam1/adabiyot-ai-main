import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { userScopedKey } from "@/lib/userStorage";

/** Base key for the last-read book id; scoped per account at runtime. */
export const LAST_BOOK_BASE = "last_book_id";

export function useLastRead(): { lastBookId: string | null; loading: boolean } {
  const { userId } = useAuth();
  const [lastBookId, setLastBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    AsyncStorage.getItem(userScopedKey(LAST_BOOK_BASE, userId))
      .then((v) => {
        if (active) setLastBookId(v);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return { lastBookId, loading };
}
