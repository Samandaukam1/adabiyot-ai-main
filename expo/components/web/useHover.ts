import { useCallback, useState } from "react";

/**
 * Tracks hover on web. `onHoverIn` / `onHoverOut` map to react-native-web's
 * Pressable hover events; on native they simply never fire, so `hovered` stays
 * false and nothing changes.
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);
  return { hovered, onHoverIn, onHoverOut };
}
