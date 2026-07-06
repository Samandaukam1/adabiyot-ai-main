import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useJaxongirAI } from "@/providers/JaxongirAIProvider";
import { useHover } from "./useHover";
import { cursorPointer } from "./webStyle";

const ORB = 62;

/**
 * Floating Jaxongir AI launcher for the web (there's no shake gesture in a
 * browser). A green orb with an animated glowing aura pulsing out from behind
 * it; clicking opens the Jaxongir AI chat. Mounted globally, web-only.
 */
export default function WebJaxongirOrb() {
  const { open } = useJaxongirAI();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const s = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })
    );
    p.start();
    s.start();
    return () => {
      p.stop();
      s.stop();
    };
  }, [pulse, spin]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const halo2Scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "fixed" as any, right: 30, bottom: 30, zIndex: 120, alignItems: "center", justifyContent: "center" }}
    >
      {/* Expanding green light pulses radiating from behind the orb */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: ORB,
          height: ORB,
          borderRadius: ORB / 2,
          backgroundColor: "#52B788",
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: ORB,
          height: ORB,
          borderRadius: ORB / 2,
          backgroundColor: "#74C9A4",
          transform: [{ scale: halo2Scale }],
          opacity: Animated.multiply(haloOpacity, 0.8),
        }}
      />
      {/* Rotating aura ring */}
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", width: ORB + 16, height: ORB + 16, borderRadius: (ORB + 16) / 2, overflow: "hidden", opacity: 0.7, transform: [{ rotate }] }}
      >
        <LinearGradient
          colors={["#52B788", "transparent", "#2D9B6F", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* Hover label */}
      {hovered ? (
        <View style={{ position: "absolute", right: ORB + 14, backgroundColor: "#0D1B2A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
          <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "800" }}>Jaxongir AI</Text>
        </View>
      ) : null}

      {/* Orb button */}
      <Pressable
        onPress={open}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        style={[
          {
            width: ORB,
            height: ORB,
            borderRadius: ORB / 2,
            overflow: "hidden",
            shadowColor: "#52B788",
            shadowOpacity: 0.6,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            transform: [{ scale: hovered ? 1.07 : 1 }],
          },
          cursorPointer,
        ]}
      >
        <LinearGradient colors={["#52B788", "#2D9B6F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="robot-happy-outline" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
