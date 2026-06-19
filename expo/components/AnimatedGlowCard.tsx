import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

const DEFAULT_GREEN = "#2E7D32";
const DEFAULT_LIGHT_GREEN = "#66BB6A";
const DEFAULT_GOLD = "#D6A84F";
const DEFAULT_WARM_GOLD = "#F6D365";

function hexToRgba(hex: string | null | undefined, alpha: number): string {
  const safeHex = hex || DEFAULT_GREEN;
  const value = safeHex.replace("#", "");

  if (value.length !== 6) {
    return `rgba(46,125,50,${alpha})`;
  }

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(46,125,50,${alpha})`;
  }

  return `rgba(${r},${g},${b},${alpha})`;
}

export default function AnimatedGlowCard({
  children,
  width,
  height,
  borderRadius = 20,
  enabled = true,
  primaryColor = DEFAULT_GREEN,
  secondaryColor = DEFAULT_GOLD,
  style,
}: {
  children: React.ReactNode;
  width: number;
  height: number;
  borderRadius?: number;
  enabled?: boolean;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  style?: ViewStyle | ViewStyle[];
}) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      glow.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2800,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [enabled, glow]);

  const primary = primaryColor || DEFAULT_GREEN;
  const secondary = secondaryColor || DEFAULT_GOLD;
  const softGlowColor = primaryColor ? primary : DEFAULT_LIGHT_GREEN;
  const warmGlowColor = secondaryColor ? secondary : DEFAULT_WARM_GOLD;
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.62],
  });
  const goldOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.52],
  });
  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1.015],
  });

  return (
    <View style={[styles.wrap, { width, height }, style]}>
      {enabled ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.softGlow,
              {
                width,
                height,
                borderRadius,
                backgroundColor: hexToRgba(softGlowColor, 0.24),
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.goldGlow,
              {
                width,
                height,
                borderRadius,
                backgroundColor: hexToRgba(warmGlowColor, 0.2),
                opacity: goldOpacity,
              },
            ]}
          />
        </>
      ) : null}

      <View
        style={[
          styles.card,
          {
            width,
            height,
            borderRadius,
            borderWidth: 0,
            borderColor: "transparent",
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  softGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    shadowColor: DEFAULT_GREEN,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  goldGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    shadowColor: DEFAULT_GOLD,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  card: {
    overflow: "hidden",
    backgroundColor: "#E8F5E9",
  },
});
