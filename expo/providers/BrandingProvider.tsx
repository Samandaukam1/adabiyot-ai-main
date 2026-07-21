import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Image as RNImage, Platform, type ImageSourcePropType } from "react-native";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "app_branding";
const DEFAULT_APP_NAME = "AdabiyotX";
const DEFAULT_PRIMARY_COLOR = "#16A34A";

const DEFAULT_LOGO = require("../assets/images/icon.png");
const DEFAULT_ICON = require("../assets/images/icon.png");
const DEFAULT_SPLASH_LOGO = require("../assets/images/splash-icon.png");
const DEFAULT_FAVICON = require("../assets/images/favicon.png");

export interface BrandingSettings {
  app_name: string;
  app_icon_url: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  splash_logo_url: string | null;
  primary_color: string;
  updated_at: string | null;
}

interface BrandingContextValue {
  branding: BrandingSettings;
  appName: string;
  primaryColor: string;
  logoSource: ImageSourcePropType;
  appIconSource: ImageSourcePropType;
  splashLogoSource: ImageSourcePropType;
  defaultLogoSource: ImageSourcePropType;
  defaultAppIconSource: ImageSourcePropType;
  defaultSplashLogoSource: ImageSourcePropType;
  faviconHref: string | null;
  loading: boolean;
  refreshBranding: () => Promise<void>;
}

// `resolveAssetSource` can be missing/throw on web (Vercel) — guard it so the
// whole app never white-screens just to resolve a favicon.
const defaultFaviconHref = (() => {
  try {
    const resolver = (RNImage as any)?.resolveAssetSource;
    if (typeof resolver !== "function") return Platform.OS === "web" ? "/favicon.png" : null;
    return resolver(DEFAULT_FAVICON)?.uri ?? (Platform.OS === "web" ? "/favicon.png" : null);
  } catch {
    return Platform.OS === "web" ? "/favicon.png" : null;
  }
})();

const DEFAULT_BRANDING: BrandingSettings = {
  app_name: DEFAULT_APP_NAME,
  app_icon_url: null,
  logo_url: null,
  favicon_url: null,
  splash_logo_url: null,
  primary_color: DEFAULT_PRIMARY_COLOR,
  updated_at: null,
};

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  appName: DEFAULT_BRANDING.app_name,
  primaryColor: DEFAULT_BRANDING.primary_color,
  logoSource: DEFAULT_LOGO,
  appIconSource: DEFAULT_ICON,
  splashLogoSource: DEFAULT_SPLASH_LOGO,
  defaultLogoSource: DEFAULT_LOGO,
  defaultAppIconSource: DEFAULT_ICON,
  defaultSplashLogoSource: DEFAULT_SPLASH_LOGO,
  faviconHref: defaultFaviconHref,
  loading: false,
  refreshBranding: async () => {},
});

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanRemoteUrl(value: unknown): string | null {
  const text = cleanString(value);
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : null;
}

function cleanColor(value: unknown): string | null {
  const text = cleanString(value);
  if (!text) return null;
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : null;
}

function parseBrandingValue(value: unknown): Partial<BrandingSettings> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? (value as Partial<BrandingSettings>) : null;
}

function normalizeBranding(input: unknown): BrandingSettings {
  const value = parseBrandingValue(input) ?? {};
  return {
    app_name: cleanString(value.app_name) ?? DEFAULT_BRANDING.app_name,
    app_icon_url: cleanRemoteUrl(value.app_icon_url),
    logo_url: cleanRemoteUrl(value.logo_url),
    favicon_url: cleanRemoteUrl(value.favicon_url),
    splash_logo_url: cleanRemoteUrl(value.splash_logo_url),
    primary_color: cleanColor(value.primary_color) ?? DEFAULT_BRANDING.primary_color,
    updated_at: cleanString(value.updated_at),
  };
}

function imageSource(remoteUrl: string | null, fallback: ImageSourcePropType): ImageSourcePropType {
  return remoteUrl ? { uri: remoteUrl } : fallback;
}

function updateWebBrandingHead(appName: string, faviconHref: string | null) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  document.title = appName;

  if (!faviconHref) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = faviconHref;

  const appleTouchIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (appleTouchIcon) appleTouchIcon.href = faviconHref;
  // TODO: PWA manifest icons need a build-time or generated manifest path.
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const applyBranding = useCallback((next: BrandingSettings) => {
    setBranding(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("value")
        .eq("key", "branding")
        .eq("is_public", true)
        .single();

      if (error) {
        console.warn("[branding] fetch failed:", error.message ?? error);
        return;
      }

      applyBranding(normalizeBranding(data?.value));
    } catch (error) {
      console.warn("[branding] fetch failed:", error);
    }
  }, [applyBranding]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((cached) => {
        if (!active || !cached) return;
        setBranding(normalizeBranding(cached));
      })
      .catch((error) => {
        console.warn("[branding] cache read failed:", error);
      })
      .finally(() => {
        refreshBranding()
          .catch(() => {})
          .finally(() => {
            if (active) setLoading(false);
          });
      });

    return () => {
      active = false;
    };
  }, [refreshBranding]);

  const value = useMemo<BrandingContextValue>(() => {
    const faviconHref = branding.favicon_url ?? defaultFaviconHref;
    return {
      branding,
      appName: branding.app_name,
      primaryColor: branding.primary_color,
      logoSource: imageSource(branding.logo_url, DEFAULT_LOGO),
      appIconSource: imageSource(branding.app_icon_url, DEFAULT_ICON),
      splashLogoSource: imageSource(branding.splash_logo_url ?? branding.logo_url, DEFAULT_SPLASH_LOGO),
      defaultLogoSource: DEFAULT_LOGO,
      defaultAppIconSource: DEFAULT_ICON,
      defaultSplashLogoSource: DEFAULT_SPLASH_LOGO,
      faviconHref,
      loading,
      refreshBranding,
    };
  }, [branding, loading, refreshBranding]);

  useEffect(() => {
    updateWebBrandingHead(value.appName, value.faviconHref);
  }, [value.appName, value.faviconHref]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
