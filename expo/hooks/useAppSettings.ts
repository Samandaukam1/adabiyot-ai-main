import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * Lightweight AsyncStorage-backed settings that are not already owned by a
 * dedicated provider (theme → ThemeProvider, shake/glow → JaxongirAIProvider).
 * If a `user_settings` table is wired up later these can be synced server-side;
 * for now they persist locally so the Settings screen is fully functional.
 */
export interface AppSettings {
  notifications: boolean;
  jaxongirEnabled: boolean;
  jaxongirVoice: boolean;
  voiceReplies: boolean;
}

const STORAGE_KEY = "adabiyot.settings.v1";

const DEFAULTS: AppSettings = {
  notifications: true,
  jaxongirEnabled: true,
  jaxongirVoice: true,
  voiceReplies: true,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppSettings>;
          setSettings({ ...DEFAULTS, ...parsed });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  return { settings, setSetting, loaded };
}
