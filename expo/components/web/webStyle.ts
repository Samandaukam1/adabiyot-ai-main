import { Platform } from "react-native";

/** True inside a browser (react-native-web). */
export const IS_WEB = Platform.OS === "web";

/**
 * CSS-only style props that react-native-web understands but the RN types don't
 * expose. They are cast to `any` and returned as `null` on native so they are
 * simply ignored off the web.
 */
export const cursorPointer = IS_WEB ? ({ cursor: "pointer" } as any) : null;

export const hoverTransition = IS_WEB
  ? ({
      transitionProperty: "transform, box-shadow, background-color, border-color, color, opacity",
      transitionDuration: "180ms",
      transitionTimingFunction: "cubic-bezier(0.2, 0.7, 0.2, 1)",
    } as any)
  : null;

/** Frosted-glass backdrop for sticky surfaces (header). No-op on native. */
export const glassBlur = IS_WEB
  ? ({
      backdropFilter: "saturate(180%) blur(20px)",
      WebkitBackdropFilter: "saturate(180%) blur(20px)",
    } as any)
  : null;

/** Soft card shadow that lifts on hover. */
export function softShadow(hovered = false) {
  return {
    shadowColor: "#000",
    shadowOpacity: hovered ? 0.2 : 0.1,
    shadowRadius: hovered ? 24 : 14,
    shadowOffset: { width: 0, height: hovered ? 14 : 8 },
    elevation: hovered ? 12 : 5,
  };
}
