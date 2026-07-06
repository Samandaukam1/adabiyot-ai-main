import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { userScopedKey } from "@/lib/userStorage";

const STATE_BASE = "state.v1";

interface PersistedState {
  savedBookIds: string[];
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

/** A brand-new (or signed-in) account starts with NO private content. */
const EMPTY_STATE: PersistedState = {
  savedBookIds: [],
  savedReelIds: [],
  likedReelIds: [],
  followedAuthorIds: [],
  followedPublisherIds: [],
  history: [],
  fontScale: 1,
  lineHeight: 1.72,
};

/** Guest mode keeps a little demo content so the app showcases nicely. */
const DEMO_STATE: PersistedState = {
  savedBookIds: ["b4", "b6"],
  savedReelIds: [],
  likedReelIds: [],
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
  const { userId, isAuthenticated, loading: authLoading } = useAuth();

  // Private app state is namespaced per account so Google / Apple / guest
  // never share saved books, purchases, history, etc.
  const storageKey = userScopedKey(STATE_BASE, userId);
  const defaultsForScope = isAuthenticated ? EMPTY_STATE : DEMO_STATE;

  const [state, setState] = useState<PersistedState>(defaultsForScope);
  const [isReady, setIsReady] = useState(false);
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  // (Re)load whenever the account scope changes — this resets in-memory state
  // immediately on account switch, then hydrates the new account's data.
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setIsReady(false);
    setState(defaultsForScope);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          setState({ ...defaultsForScope, ...(JSON.parse(raw) as PersistedState) });
        }
      })
      .catch((e) => console.log("[AppProvider] load error", e))
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => {
      active = false;
    };
    // defaultsForScope is derived from isAuthenticated; storageKey from userId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, authLoading, isAuthenticated]);

  const update = useCallback(
    (updater: (s: PersistedState) => PersistedState) => {
      setState((prev) => {
        const next = updater(prev);
        AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
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
      isReady,
      toggleSaveBook,
      toggleSaveReel,
      toggleLikeReel,
      toggleFollowAuthor,
      toggleFollowPublisher,
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
      isReady,
      toggleSaveBook,
      toggleSaveReel,
      toggleLikeReel,
      toggleFollowAuthor,
      toggleFollowPublisher,
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
