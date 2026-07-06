import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import type {
  MobileActiveSplashIntro,
  SplashIntroHapticCue,
  SplashIntroHapticsStrength,
  SplashIntroHapticType,
} from "@/types/database";

export const SPLASH_CONFIG_CACHE_KEY = "adabiyotx:splash:config";

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const MAX_SPLASH_DURATION_MS = 5000;
const DEFAULT_SPLASH_DURATION_MS = 5000;
const SESSION_SHOWN_IDS = new Set<string>();

const SOFT_SPLASH_HAPTICS_PATTERN: SplashIntroHapticCue[] = [
  { at_ms: 100, type: "selection" },
  { at_ms: 300, type: "impact_light" },
  { at_ms: 600, type: "selection" },
  { at_ms: 1000, type: "impact_light" },
  { at_ms: 1500, type: "selection" },
  { at_ms: 2000, type: "impact_light" },
  { at_ms: 2600, type: "impact_light" },
  { at_ms: 3400, type: "selection" },
  { at_ms: 4500, type: "selection" },
];

const MEDIUM_SPLASH_HAPTICS_PATTERN: SplashIntroHapticCue[] = [
  { at_ms: 100, type: "impact_medium" },
  { at_ms: 300, type: "impact_light" },
  { at_ms: 550, type: "impact_medium" },
  { at_ms: 850, type: "impact_light" },
  { at_ms: 1200, type: "impact_medium" },
  { at_ms: 1600, type: "impact_light" },
  { at_ms: 2000, type: "impact_medium" },
  { at_ms: 2400, type: "impact_medium" },
  { at_ms: 3000, type: "impact_medium" },
  { at_ms: 3700, type: "impact_light" },
  { at_ms: 4500, type: "selection" },
];

const STRONG_SPLASH_HAPTICS_PATTERN: SplashIntroHapticCue[] = [
  { at_ms: 100, type: "impact_medium" },
  { at_ms: 250, type: "impact_medium" },
  { at_ms: 450, type: "impact_light" },
  { at_ms: 700, type: "impact_medium" },
  { at_ms: 1000, type: "impact_medium" },
  { at_ms: 1350, type: "impact_light" },
  { at_ms: 1700, type: "impact_medium" },
  { at_ms: 2000, type: "impact_heavy" },
  { at_ms: 2100, type: "impact_heavy" },
  { at_ms: 2400, type: "impact_medium" },
  { at_ms: 2800, type: "impact_medium" },
  { at_ms: 3300, type: "impact_medium" },
  { at_ms: 3900, type: "impact_light" },
  { at_ms: 4500, type: "selection" },
];

export const DEFAULT_SPLASH_HAPTICS_PATTERN: SplashIntroHapticCue[] = [
  { at_ms: 100, type: "impact_medium" },
  { at_ms: 250, type: "impact_medium" },
  { at_ms: 400, type: "impact_light" },
  { at_ms: 600, type: "impact_medium" },
  { at_ms: 850, type: "impact_light" },
  { at_ms: 1100, type: "impact_medium" },
  { at_ms: 1400, type: "impact_light" },
  { at_ms: 1700, type: "impact_medium" },
  { at_ms: 2000, type: "impact_heavy" },
  { at_ms: 2100, type: "impact_heavy" },
  { at_ms: 2300, type: "impact_heavy" },
  { at_ms: 2600, type: "impact_medium" },
  { at_ms: 2900, type: "impact_medium" },
  { at_ms: 3200, type: "impact_medium" },
  { at_ms: 3600, type: "impact_light" },
  { at_ms: 4000, type: "impact_light" },
  { at_ms: 4500, type: "selection" },
];

export interface SplashIntroConfig {
  id: string;
  title: string | null;
  video_url: string;
  poster_url: string | null;
  duration_ms: number;
  show_on_every_open: boolean;
  show_once_per_session: boolean;
  show_once_per_day: boolean;
  skip_enabled: boolean;
  min_show_ms: number;
  background_color: string;
  audio_enabled: boolean;
  audio_volume: number;
  haptics_enabled: boolean;
  haptics_strength: SplashIntroHapticsStrength;
  haptics_pattern: SplashIntroHapticCue[];
  platform: string | null;
}

interface CachedSplashIntroConfig {
  cached_at: string;
  config: SplashIntroConfig;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Splash intro fetch timed out")), timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function parseNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.round(numberValue), min), max);
}

function parseFloatNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(numberValue, min), max);
}

function normalizeHapticsStrength(value: unknown): SplashIntroHapticsStrength {
  if (typeof value !== "string") return "max";

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "soft" ||
    normalized === "medium" ||
    normalized === "strong" ||
    normalized === "max"
  ) {
    return normalized;
  }

  return "max";
}

function defaultPatternForStrength(strength: SplashIntroHapticsStrength): SplashIntroHapticCue[] {
  switch (strength) {
    case "soft":
      return SOFT_SPLASH_HAPTICS_PATTERN;
    case "medium":
      return MEDIUM_SPLASH_HAPTICS_PATTERN;
    case "strong":
      return STRONG_SPLASH_HAPTICS_PATTERN;
    case "max":
    default:
      return DEFAULT_SPLASH_HAPTICS_PATTERN;
  }
}

function normalizeHapticsPattern(
  value: unknown,
  strength: SplashIntroHapticsStrength
): SplashIntroHapticCue[] {
  let pattern = value;
  const defaultPattern = defaultPatternForStrength(strength);

  if (typeof pattern === "string" && pattern.trim()) {
    try {
      pattern = JSON.parse(pattern) as unknown;
    } catch {
      return defaultPattern;
    }
  }

  if (!Array.isArray(pattern)) {
    return defaultPattern;
  }

  const cues = pattern
    .map((item): SplashIntroHapticCue | null => {
      if (!item || typeof item !== "object") return null;

      const candidate = item as Partial<SplashIntroHapticCue>;
      const atMs = parseNumber(candidate.at_ms, Number.NaN, 0, MAX_SPLASH_DURATION_MS);
      if (!Number.isFinite(atMs) || typeof candidate.type !== "string") return null;

      return {
        at_ms: atMs,
        type: candidate.type as SplashIntroHapticType,
      };
    })
    .filter((item): item is SplashIntroHapticCue => !!item)
    .sort((a, b) => a.at_ms - b.at_ms);

  return cues.length > 0 ? cues : defaultPattern;
}

function normalizeSplashIntro(row: MobileActiveSplashIntro): SplashIntroConfig | null {
  if (!row?.id || !row.video_url) return null;

  const durationMs = parseNumber(
    row.duration_ms,
    DEFAULT_SPLASH_DURATION_MS,
    0,
    MAX_SPLASH_DURATION_MS
  );
  const hapticsStrength = normalizeHapticsStrength(row.haptics_strength);

  return {
    id: row.id,
    title: row.title ?? null,
    video_url: row.video_url,
    poster_url: row.poster_url ?? null,
    duration_ms: durationMs,
    show_on_every_open: parseBoolean(row.show_on_every_open, true),
    show_once_per_session: parseBoolean(row.show_once_per_session, false),
    show_once_per_day: parseBoolean(row.show_once_per_day, false),
    skip_enabled: parseBoolean(row.skip_enabled, false),
    min_show_ms: parseNumber(row.min_show_ms, 0, 0, durationMs),
    background_color: row.background_color || "#020806",
    audio_enabled: parseBoolean(row.audio_enabled, false),
    audio_volume: parseFloatNumber(row.audio_volume, 1, 0, 1),
    haptics_enabled: parseBoolean(row.haptics_enabled, true),
    haptics_strength: hapticsStrength,
    haptics_pattern: normalizeHapticsPattern(row.haptics_pattern, hapticsStrength),
    platform: row.platform ?? null,
  };
}

function matchesCurrentPlatform(platform: string | null): boolean {
  if (!platform) return true;

  const normalized = platform.toLowerCase();
  if (["all", "any", "mobile"].includes(normalized)) return true;

  const targets = normalized
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return targets.includes(Platform.OS);
}

async function queryActiveSplashIntro(): Promise<SplashIntroConfig | null> {
  const { data, error } = await (supabase as any)
    .from("mobile_active_splash_intro")
    .select(
      "id,title,video_url,poster_url,duration_ms,show_on_every_open,show_once_per_session,show_once_per_day,skip_enabled,min_show_ms,background_color,audio_enabled,audio_volume,haptics_enabled,haptics_strength,haptics_pattern,platform"
    )
    .limit(10);

  if (error) throw error;

  const rows = Array.isArray(data) ? (data as MobileActiveSplashIntro[]) : [];
  const normalized = rows
    .map(normalizeSplashIntro)
    .find((intro): intro is SplashIntroConfig => !!intro && matchesCurrentPlatform(intro.platform));

  return normalized ?? null;
}

async function cacheSplashIntro(config: SplashIntroConfig): Promise<void> {
  const cached: CachedSplashIntroConfig = {
    cached_at: new Date().toISOString(),
    config,
  };

  await AsyncStorage.setItem(SPLASH_CONFIG_CACHE_KEY, JSON.stringify(cached));
}

async function getCachedSplashIntro(): Promise<SplashIntroConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(SPLASH_CONFIG_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedSplashIntroConfig>;
    if (!parsed?.cached_at || !parsed.config?.video_url) return null;

    const cachedAt = new Date(parsed.cached_at).getTime();
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > CACHE_MAX_AGE_MS) {
      return null;
    }

    return normalizeSplashIntro(parsed.config as MobileActiveSplashIntro);
  } catch {
    return null;
  }
}

function localDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastShownStorageKey(splashId: string): string {
  return `adabiyotx:splash:last-shown:${splashId}`;
}

export async function fetchActiveSplashIntro(): Promise<SplashIntroConfig | null> {
  try {
    const config = await withTimeout(queryActiveSplashIntro(), FETCH_TIMEOUT_MS);

    if (config) {
      await cacheSplashIntro(config).catch(() => {});
    } else {
      await AsyncStorage.removeItem(SPLASH_CONFIG_CACHE_KEY).catch(() => {});
    }

    return config;
  } catch (error) {
    if (__DEV__) {
      console.warn("[SplashIntro] Active splash fetch failed, checking cache:", error);
    }
    return getCachedSplashIntro();
  }
}

export async function shouldShowSplashIntro(config: SplashIntroConfig): Promise<boolean> {
  if (!config.video_url) return false;

  if (config.show_once_per_session && SESSION_SHOWN_IDS.has(config.id)) {
    return false;
  }

  if (config.show_once_per_day) {
    const lastShown = await AsyncStorage.getItem(lastShownStorageKey(config.id)).catch(() => null);
    if (lastShown === localDateKey()) return false;
  }

  if (!config.show_on_every_open && !config.show_once_per_session && !config.show_once_per_day) {
    return false;
  }

  return true;
}

export async function markSplashIntroShown(config: SplashIntroConfig): Promise<void> {
  if (config.show_once_per_session) {
    SESSION_SHOWN_IDS.add(config.id);
  }

  if (config.show_once_per_day) {
    await AsyncStorage.setItem(lastShownStorageKey(config.id), localDateKey()).catch(() => {});
  }
}
