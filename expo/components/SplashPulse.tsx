import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

/**
 * The ONLY thing allowed on screen while the app boots: a logo-free, text-free
 * pulse.
 *
 * The launch sequence must read as "black screen → animation", never
 * "logo → another logo → animation", so neither the native splash nor this gate
 * carries a brand mark. Colours are deliberately hard-coded (not themed) to the
 * splash background — this renders before the theme is meaningful, and any
 * mismatch would show up as a flash.
 */
export const SPLASH_BG = "#020806";

const DOTS = [0, 1, 2];

export default function SplashPulse({ size = 9 }: { size?: number }) {
  // One driver per dot so they can be staggered without extra state.
  const values = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 520,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((DOTS.length - index - 1) * 160),
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [values]);

  return (
    <View pointerEvents="none" style={styles.row}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.22, 1] }),
              transform: [
                { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { backgroundColor: "#52B788" },
});
