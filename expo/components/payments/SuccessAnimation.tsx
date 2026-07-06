import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DEEP_GREEN = "#0B5A3A";
const EMERALD = "#52B788";
const GOLD = "#E8BF52";
const CHECK_LEN = 80; // a touch longer than the checkmark path so it fully hides

/**
 * Premium success animation built purely with React Native `Animated` +
 * `react-native-svg` — no native Lottie module, so it runs in any runtime
 * (Rork preview, Expo Go, dev client) right after a JS reload and can never
 * crash for a missing native view.
 *
 * Sequence: the deep-green disc springs in with a soft emerald glow, the white
 * checkmark draws itself, then three gold sparkles twinkle in. The glow keeps a
 * gentle breathing loop so the screen feels alive.
 */
export default function SuccessAnimation({ size = 172 }: { size?: number }) {
  const circleScale = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const draw = useRef(new Animated.Value(CHECK_LEN)).current; // SVG strokeDashoffset
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const intro = Animated.sequence([
      Animated.parallel([
        Animated.spring(circleScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(draw, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(sparkle, { toValue: 1, duration: 360, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
    ]);

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.72, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );

    intro.start(({ finished }) => {
      if (finished) breathe.start();
    });
    return () => {
      intro.stop();
      breathe.stop();
    };
  }, [circleScale, glow, draw, sparkle]);

  const circleSize = Math.round(size * 0.62);
  const glowSize = Math.round(size * 0.96);
  const sparkSize = Math.max(7, Math.round(size * 0.05));

  const glowStyle = {
    position: "absolute" as const,
    width: glowSize,
    height: glowSize,
    borderRadius: glowSize / 2,
    backgroundColor: EMERALD,
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.06] }) }],
  };

  const sparkleBase = (left: number, top: number, scaleTo: number) => ({
    position: "absolute" as const,
    left,
    top,
    width: sparkSize,
    height: sparkSize,
    borderRadius: Math.round(sparkSize * 0.3),
    backgroundColor: GOLD,
    opacity: sparkle,
    transform: [
      { rotate: "45deg" },
      { scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, scaleTo] }) },
    ],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={glowStyle} />

      <Animated.View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: DEEP_GREEN,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: circleScale }],
        }}
      >
        <Svg width={circleSize * 0.92} height={circleSize * 0.92} viewBox="0 0 100 100">
          <AnimatedPath
            d="M28 52 L44 68 L74 34"
            stroke="#FFFFFF"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LEN}
            strokeDashoffset={draw}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={sparkleBase(Math.round(size * 0.5 - sparkSize / 2), Math.round(size * 0.05), 1.1)} />
      <Animated.View style={sparkleBase(Math.round(size * 0.76), Math.round(size * 0.2), 0.85)} />
      <Animated.View style={sparkleBase(Math.round(size * 0.15), Math.round(size * 0.24), 0.95)} />
    </View>
  );
}
