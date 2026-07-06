// Web version — no accelerometer (browser doesn't support shake)
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { BookContext } from "@/utils/jaxongirContext";

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
  shakeEnabled: false,
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
  const [shakeEnabled, setShakeState] = useState(false);
  const [animEnabled, setAnimState] = useState(true);
  const [currentBook, setCurrentBook] = useState<BookContext | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY_ANIM).then((val) => {
      if (val !== null) setAnimState(val !== "false");
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

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <Ctx.Provider value={{ isOpen, open, close, shakeEnabled, setShakeEnabled, animEnabled, setAnimEnabled, currentBook, setCurrentBook }}>
      {children}
    </Ctx.Provider>
  );
}
