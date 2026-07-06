import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

type IconType = React.ComponentType<{ color: string; size: number; strokeWidth?: number }>;

/**
 * Professional, minimal, premium creator CTA — a clean green pill with a slow
 * breathing glow, a softly moving border light and a very subtle scale.
 * Deliberately calm (no neon / blinking), distinct from the So'zLab write FAB.
 *
 * Floats centered above the bottom navigation; only rendered when `visible`.
 */
export default function PremiumCreatorActionButton({
  label,
  Icon = Feather,
  onPress,
  visible = true,
  bottom,
}: {
  label: string;
  Icon?: IconType;
  onPress: () => void;
  visible?: boolean;
  bottom: number;
}) {
  const breath = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(shimmer, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    breathing.start();
    sweep.start();
    return () => {
      breathing.stop();
      sweep.stop();
    };
  }, [visible, breath, shimmer]);

  if (!visible) return null;

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });
  const glowOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.46] });
  const borderOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-90, 230] });

  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Pressable
        onPressIn={() => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
        onPress={handlePress}
      >
        <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, press) }] }}>
          {/* soft breathing glow */}
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOpacity }]} />

          <LinearGradient
            colors={["#2FA56F", "#2D9B6F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}
          >
            <Icon color="#fff" size={19} strokeWidth={2.2} />
            <Text style={styles.label}>{label}</Text>

            {/* softly moving border light */}
            <Animated.View pointerEvents="none" style={[styles.borderLight, { opacity: borderOpacity }]} />
            <Animated.View
              pointerEvents="none"
              style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { rotate: "18deg" }] }]}
            >
              <LinearGradient
                colors={["transparent", "rgba(255,255,255,0.22)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  glow: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.22)",
    shadowColor: "#52B788",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    paddingHorizontal: 26,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#2D9B6F",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  borderLight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: "rgba(246,211,101,0.6)",
  },
  shimmer: { position: "absolute", top: -14, bottom: -14, width: 44 },
  label: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
});
