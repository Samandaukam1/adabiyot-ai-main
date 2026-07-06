import { createContext, useContext } from "react";

/**
 * Lets a tab screen hide the floating bottom tab bar temporarily (e.g. while the
 * Reels comment panel is open). The provider lives in the tabs layout so both
 * the tab bar and the screens can share it.
 */
export const TabBarVisibilityContext = createContext<(hidden: boolean) => void>(() => {});

export function useHideTabBar() {
  return useContext(TabBarVisibilityContext);
}
