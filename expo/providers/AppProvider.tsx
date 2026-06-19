import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "adabiyot.state.v1";

interface PersistedState {
  savedBookIds: string[];
  purchasedBookIds: string[];
  purchasedArticleIds: string[];
  savedReelIds: string[];
  likedReelIds: string[];
  followedAuthorIds: string[];
  followedPublisherIds: string[];
  history: { bookId: string; at: number }[];
  fontScale: number;
  lineHeight: number;
}

export interface AudioSessionState {
  bookId: string | null;
  position: number;
  duration: number;
  playing: boolean;
  speed: 1 | 1.25 | 1.5 | 2;
}

export interface ReaderBookmark {
  bookId: string;
  pageIndex: number;
  chapterIndex: number;
}

const defaultState: PersistedState = {
  savedBookIds: ["b4", "b6"],
  purchasedBookIds: ["b1", "b5"],
  purchasedArticleIds: ["ma1"],
  savedReelIds: ["r2"],
  likedReelIds: ["r1", "r2"],
  followedAuthorIds: ["a2", "a5"],
  followedPublisherIds: ["p1"],
  history: [
    { bookId: "b1", at: Date.now() - 1000 * 60 * 60 * 2 },
    { bookId: "b2", at: Date.now() - 1000 * 60 * 60 * 24 },
    { bookId: "b8", at: Date.now() - 1000 * 60 * 60 * 72 },
  ],
  fontScale: 1,
  lineHeight: 1.72,
};

export const [AppProvider, useApp] = createContextHook(() => {
  const qc = useQueryClient();
  const [state, setState] = useState<PersistedState>(defaultState);

  const loadQuery = useQuery({
    queryKey: ["appState"],
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultState;
        return { ...defaultState, ...JSON.parse(raw) } as PersistedState;
      } catch (e) {
        console.log("[AppProvider] load error", e);
        return defaultState;
      }
    },
  });

  useEffect(() => {
    if (loadQuery.data) setState(loadQuery.data);
  }, [loadQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (next: PersistedState) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    },
  });

  const update = useCallback(
    (updater: (s: PersistedState) => PersistedState) => {
      setState((prev) => {
        const next = updater(prev);
        saveMutation.mutate(next);
        qc.setQueryData(["appState"], next);
        return next;
      });
    },
    [saveMutation, qc]
  );

  const toggle = useCallback(
    (key: keyof PersistedState, id: string) => {
      update((s) => {
        const arr = s[key] as string[];
        const exists = arr.includes(id);
        return {
          ...s,
          [key]: exists ? arr.filter((x) => x !== id) : [...arr, id],
        };
      });
    },
    [update]
  );

  const toggleSaveBook = useCallback((id: string) => toggle("savedBookIds", id), [toggle]);
  const toggleSaveReel = useCallback((id: string) => toggle("savedReelIds", id), [toggle]);
  const toggleLikeReel = useCallback((id: string) => toggle("likedReelIds", id), [toggle]);
  const toggleFollowAuthor = useCallback(
    (id: string) => toggle("followedAuthorIds", id),
    [toggle]
  );
  const toggleFollowPublisher = useCallback(
    (id: string) => toggle("followedPublisherIds", id),
    [toggle]
  );
  const buyBook = useCallback(
    (id: string) =>
      update((s) => ({
        ...s,
        purchasedBookIds: s.purchasedBookIds.includes(id)
          ? s.purchasedBookIds
          : [...s.purchasedBookIds, id],
      })),
    [update]
  );
  const buyArticle = useCallback(
    (id: string) =>
      update((s) => ({
        ...s,
        purchasedArticleIds: s.purchasedArticleIds.includes(id)
          ? s.purchasedArticleIds
          : [...s.purchasedArticleIds, id],
      })),
    [update]
  );
  const addHistory = useCallback(
    (bookId: string) =>
      update((s) => ({
        ...s,
        history: [
          { bookId, at: Date.now() },
          ...s.history.filter((h) => h.bookId !== bookId),
        ].slice(0, 30),
      })),
    [update]
  );
  const setFontScale = useCallback(
    (v: number) => update((s) => ({ ...s, fontScale: v })),
    [update]
  );
  const setLineHeight = useCallback(
    (v: number) => update((s) => ({ ...s, lineHeight: v })),
    [update]
  );

  const [audio, setAudio] = useState<AudioSessionState>({
    bookId: null,
    position: 0,
    duration: 0,
    playing: false,
    speed: 1,
  });
  const [bookmark, setBookmark] = useState<ReaderBookmark | null>(null);

  const startAudio = useCallback(
    (bookId: string, duration: number) => {
      setAudio((a) => ({
        ...a,
        bookId,
        duration,
        playing: true,
        position: a.bookId === bookId ? a.position : 0,
      }));
    },
    []
  );
  const togglePlay = useCallback(() => {
    setAudio((a) => {
      const restartFromBeginning = a.duration > 0 && a.position >= a.duration;
      return {
        ...a,
        position: restartFromBeginning ? 0 : a.position,
        playing: restartFromBeginning ? true : !a.playing,
      };
    });
  }, []);
  const seekAudio = useCallback((pos: number) => {
    setAudio((a) => ({ ...a, position: Math.max(0, Math.min(a.duration, pos)) }));
  }, []);
  const setSpeed = useCallback((s: 1 | 1.25 | 1.5 | 2) => {
    setAudio((a) => ({ ...a, speed: s }));
  }, []);
  const setAudioPosition = useCallback((pos: number) => {
    setAudio((a) => ({ ...a, position: Math.max(0, Math.min(a.duration, pos)) }));
  }, []);
  const stopAudio = useCallback(() => {
    setAudio({ bookId: null, position: 0, duration: 0, playing: false, speed: 1 });
  }, []);
  const saveBookmark = useCallback((b: ReaderBookmark | null) => {
    setBookmark(b);
  }, []);

  useEffect(() => {
    if (!audio.playing || !audio.bookId) return;

    const intervalId = setInterval(() => {
      setAudio((currentAudio) => {
        if (!currentAudio.playing || !currentAudio.bookId) {
          return currentAudio;
        }

        const nextPosition = Math.min(
          currentAudio.duration,
          currentAudio.position + 0.25 * currentAudio.speed
        );
        const reachedEnd = nextPosition >= currentAudio.duration;

        return {
          ...currentAudio,
          position: nextPosition,
          playing: reachedEnd ? false : currentAudio.playing,
        };
      });
    }, 250);

    return () => clearInterval(intervalId);
  }, [audio.bookId, audio.duration, audio.playing, audio.speed]);

  return useMemo(
    () => ({
      ...state,
      isReady: !loadQuery.isLoading,
      toggleSaveBook,
      toggleSaveReel,
      toggleLikeReel,
      toggleFollowAuthor,
      toggleFollowPublisher,
      buyBook,
      buyArticle,
      addHistory,
      setFontScale,
      setLineHeight,
      audio,
      bookmark,
      startAudio,
      togglePlay,
      seekAudio,
      setSpeed,
      setAudioPosition,
      stopAudio,
      saveBookmark,
    }),
    [
      state,
      loadQuery.isLoading,
      toggleSaveBook,
      toggleSaveReel,
      toggleLikeReel,
      toggleFollowAuthor,
      toggleFollowPublisher,
      buyBook,
      buyArticle,
      addHistory,
      setFontScale,
      setLineHeight,
      audio,
      bookmark,
      startAudio,
      togglePlay,
      seekAudio,
      setSpeed,
      setAudioPosition,
      stopAudio,
      saveBookmark,
    ]
  );
});
