import { useCallback, useEffect, useRef, useState } from "react";

type RefreshTask = () => Promise<void> | void;

export function usePullToRefresh(task?: RefreshTask, minDuration = 650) {
  const [refreshing, setRefreshing] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);

    const startedAt = Date.now();
    try {
      await task?.();
    } catch (error) {
      if (__DEV__) {
        console.warn("[Refresh] Pull-to-refresh task failed:", error);
      }
    } finally {
      const wait = Math.max(0, minDuration - (Date.now() - startedAt));
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }

      if (mountedRef.current) {
        setRefreshing(false);
        setReplayKey((key) => key + 1);
      }
      refreshingRef.current = false;
    }
  }, [minDuration, task]);

  return { refreshing, replayKey, onRefresh };
}
