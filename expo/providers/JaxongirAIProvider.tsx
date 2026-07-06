import AsyncStorage from "@react-native-async-storage/async-storage";
import { Accelerometer } from "expo-sensors";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { BookContext } from "@/utils/jaxongirContext";

const SHAKE_THRESHOLD = 2.0;
const SHAKE_DEBOUNCE_MS = 2500;
const KEY_SHAKE = "@jaxongir_shake_enabled";
const KEY_ANIM = "@jaxongir_anim_enabled";

interface JaxongirAICtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  shakeEnabled: boolean;
  setShakeEnabled: (v: boolean) => void;
  animEnabled: boolean;
  setAnimEnabled: (v: boolean) => void;
  currentBook: BookContext | null;
  setCurrentBook: (book: BookContext | null) => void;
}

const Ctx = createContext<JaxongirAICtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
  shakeEnabled: true,
  setShakeEnabled: () => {},
  animEnabled: true,
  setAnimEnabled: () => {},
  currentBook: null,
  setCurrentBook: () => {},
});

export function useJaxongirAI() {
  return useContext(Ctx);
}

export function JaxongirAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [shakeEnabled, setShakeState] = useState(true);
  const [animEnabled, setAnimState] = useState(true);
  const [currentBook, setCurrentBook] = useState<BookContext | null>(null);

  const isOpenRef = useRef(false);
  const lastShakeRef = useRef(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Load saved prefs
  useEffect(() => {
    AsyncStorage.multiGet([KEY_SHAKE, KEY_ANIM]).then((pairs) => {
      pairs.forEach(([key, val]) => {
        if (val === null) return;
        if (key === KEY_SHAKE) setShakeState(val !== "false");
        if (key === KEY_ANIM) setAnimState(val !== "false");
      });
    });
  }, []);

  const setShakeEnabled = useCallback(async (v: boolean) => {
    setShakeState(v);
    await AsyncStorage.setItem(KEY_SHAKE, String(v));
  }, []);

  const setAnimEnabled = useCallback(async (v: boolean) => {
    setAnimState(v);
    await AsyncStorage.setItem(KEY_ANIM, String(v));
  }, []);

  const open = useCallback(() => {
    if (!isOpenRef.current) setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  // Accelerometer shake detection
  useEffect(() => {
    if (!shakeEnabled) return;

    let sub: { remove: () => void } | null = null;

    Accelerometer.setUpdateInterval(80);
    sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude < SHAKE_THRESHOLD) return;
      const now = Date.now();
      if (now - lastShakeRef.current < SHAKE_DEBOUNCE_MS) return;
      if (isOpenRef.current) return;
      lastShakeRef.current = now;
      open();
    });

    return () => {
      sub?.remove();
    };
  }, [shakeEnabled, open]);

  return (
    <Ctx.Provider
      value={{ isOpen, open, close, shakeEnabled, setShakeEnabled, animEnabled, setAnimEnabled, currentBook, setCurrentBook }}
    >
      {children}
    </Ctx.Provider>
  );
}
