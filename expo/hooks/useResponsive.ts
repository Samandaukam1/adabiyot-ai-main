import { Platform, useWindowDimensions } from "react-native";

export type Breakpoint = "mobile" | "tablet" | "desktop" | "large";

/**
 * Web-responsive breakpoints. The native mobile app is NEVER affected: on iOS /
 * Android `isWeb` is false, so `isWebLayout` / `isDesktopWeb` stay false and the
 * existing phone UI renders unchanged. The premium web chrome only engages in a
 * browser at tablet width and up.
 *
 *   mobile  <768   → keep the phone UI (also in a narrow browser window)
 *   tablet  768–1023
 *   desktop 1024–1439
 *   large   1440+
 */
export interface Responsive {
  width: number;
  height: number;
  isWeb: boolean;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  /** Web AND width ≥ 768 — the switch that turns on the whole premium web layout. */
  isWebLayout: boolean;
  /** Web AND width ≥ 1024 — full desktop treatments (multi-column, wide hero). */
  isDesktopWeb: boolean;
  /** Centered content ceiling for the current breakpoint. */
  contentMaxWidth: number;
}

const TABLET = 768;
const DESKTOP = 1024;
const LARGE = 1440;

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";

  const isMobile = width < TABLET;
  const isTablet = width >= TABLET && width < DESKTOP;
  const isDesktop = width >= DESKTOP && width < LARGE;
  const isLargeDesktop = width >= LARGE;

  const breakpoint: Breakpoint = isLargeDesktop
    ? "large"
    : isDesktop
    ? "desktop"
    : isTablet
    ? "tablet"
    : "mobile";

  const isWebLayout = isWeb && width >= TABLET;
  const isDesktopWeb = isWeb && width >= DESKTOP;

  const contentMaxWidth = isLargeDesktop ? 1440 : isDesktop ? 1200 : 1024;

  return {
    width,
    height,
    isWeb,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isWebLayout,
    isDesktopWeb,
    contentMaxWidth,
  };
}
