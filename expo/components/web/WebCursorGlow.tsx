import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { IS_WEB } from "./webStyle";

const SIZE = 480;

/**
 * A large, soft green light that trails the mouse cursor across the whole site —
 * a subtle premium ambient glow. Web-only; `pointerEvents="none"` so it never
 * intercepts clicks, and it smoothly eases toward the cursor (not instant).
 */
export default function WebCursorGlow() {
  const x = useSharedValue(-9999);
  const y = useSharedValue(-9999);

  useEffect(() => {
    if (!IS_WEB || typeof window === "undefined") return;
    const onMove = (e: MouseEvent) => {
      x.value = withTiming(e.clientX, { duration: 520, easing: Easing.out(Easing.quad) });
      y.value = withTiming(e.clientY, { duration: 520, easing: Easing.out(Easing.quad) });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [x, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - SIZE / 2 }, { translateY: y.value - SIZE / 2 }],
  }));

  if (!IS_WEB) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { position: "fixed" as any, zIndex: 30, overflow: "hidden" }]}
    >
      <Reanimated.View
        style={[
          {
            position: "absolute",
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: "rgba(82,183,136,0.14)",
            shadowColor: "#52B788",
            shadowOpacity: 0.55,
            shadowRadius: 190,
            shadowOffset: { width: 0, height: 0 },
          },
          // Web-only softeners; harmlessly ignored if unsupported.
          { filter: "blur(70px)" as any, mixBlendMode: "screen" as any },
          style,
        ]}
      />
    </View>
  );
}
