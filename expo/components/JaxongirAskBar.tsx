import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { ChevronRight } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { AppTheme } from "@/constants/colors";
import { useJaxongirAvatarPoster } from "@/hooks/useJaxongirAvatarPoster";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * A clean, premium "Jaxongir AI" call-to-action card shown under the
 * read/listen buttons on the book detail screen. Shows the official Jaxongir
 * avatar, with a soft animated green glow.
 */
export default function JaxongirAskBar({ onPress }: { onPress: () => void }) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const poster = useJaxongirAvatarPoster();
  const glow = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(shimmer, { toValue: 1, duration: 1150, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-180, 460] });

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1.012] });

  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={() => Animated.spring(press, { toValue: 0.985, useNativeDriver: true, speed: 40, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }).start()}
        onPress={handlePress}
      >
        <Animated.View style={{ transform: [{ scale: press }] }}>
          {/* soft pulsing green glow */}
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />

          <View style={styles.card}>
            <View style={styles.avatarWrap}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.avatar} contentFit="cover" />
              ) : (
                <LinearGradient colors={["#52B788", "#2D9B6F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                  <MaterialCommunityIcons name="robot-happy-outline" size={26} color="#fff" />
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tag}>Jaxongir AI</Text>
              <Text style={styles.title} numberOfLines={1}>Kitob haqida savol bering</Text>
              <Text style={styles.hint} numberOfLines={1}>Jaxongir AI ni chaqirish uchun silkiting</Text>
            </View>
            <View style={styles.arrow}>
              <ChevronRight color={c.primary} size={18} strokeWidth={2.4} />
            </View>

            {/* glossy shimmer sweep */}
            <Animated.View
              pointerEvents="none"
              style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { rotate: "20deg" }] }]}
            >
              <LinearGradient
                colors={["transparent", isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.6)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    wrap: { marginHorizontal: 20, marginTop: 12 },
    glow: {
      position: "absolute",
      top: 4,
      left: 8,
      right: 8,
      bottom: -2,
      borderRadius: 20,
      backgroundColor: "transparent",
      shadowColor: "#52B788",
      shadowOpacity: 0.9,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.28)" : "rgba(82,183,136,0.22)",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    shimmer: { position: "absolute", top: -16, bottom: -16, width: 56 },
    avatarWrap: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 2,
      borderColor: c.primary,
      padding: 2,
    },
    avatar: { width: "100%", height: "100%", borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: c.soft },
    tag: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
    title: { color: c.text, fontSize: 15, fontWeight: "800", marginTop: 1 },
    hint: { color: c.textMuted, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
    arrow: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
    },
  });
}
