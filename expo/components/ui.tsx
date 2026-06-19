import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import React, { useCallback, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { palette } from "@/constants/colors";

export const FONT = {
  serif: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Georgia, 'Times New Roman', serif",
  }) as string,
  classic: Platform.select({
    ios: "Palatino",
    android: "serif",
    default: "Palatino Linotype, Book Antiqua, Georgia, serif",
  }) as string,
  sans: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  }) as string,
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  }) as string,
};

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[{ flex: 1, backgroundColor: palette.bg }, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} testID={`section-${title}`}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PressableScale({
  children,
  onPress,
  style,
  haptic = true,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  haptic?: boolean;
  testID?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }, [scale]);
  const onOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }, [scale]);
  const handlePress = useCallback(() => {
    if (haptic && Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress?.();
  }, [haptic, onPress]);
  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={handlePress}
      testID={testID}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function GlassCard({
  children,
  style,
  intensity = 40,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
}) {
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          {
            backgroundColor: palette.bgGlass,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: palette.border,
            overflow: "hidden",
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <BlurView
      intensity={intensity}
      tint="light"
      style={[
        {
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <View style={{ backgroundColor: "rgba(255,255,255,0.72)" }}>{children}</View>
    </BlurView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = "primary",
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  variant?: "primary" | "ghost" | "outline";
  style?: ViewStyle;
  testID?: string;
}) {
  const bg = variant === "primary" ? palette.primary : "transparent";
  const border =
    variant === "outline" ? palette.primary : variant === "ghost" ? "transparent" : palette.primary;
  const color = variant === "primary" ? "#fff" : palette.primary;
  return (
    <PressableScale onPress={onPress} testID={testID} style={[styles.btn, { backgroundColor: bg, borderColor: border }, style ?? {}]}>
      <View style={styles.btnInner}>
        {icon}
        <Text style={[styles.btnLabel, { color, marginLeft: icon ? 8 : 0 }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function Pill({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <PressableScale onPress={onPress} testID={testID}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: active ? palette.primary : palette.bgCard,
            borderColor: active ? palette.primary : palette.borderStrong,
          },
        ]}
      >
        <Text
          style={{
            color: active ? "#fff" : palette.primary,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

export function CoverImage({
  source,
  style,
  radius = 14,
}: {
  source: string;
  style?: ViewStyle;
  radius?: number;
}) {
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden", backgroundColor: palette.bgCard }, style]}>
      <Image
        source={{ uri: source }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={250}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.5)"]}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  } as TextStyle,
  sectionAction: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  btn: {
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  btnInner: { flexDirection: "row", alignItems: "center" },
  btnLabel: { fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
  pill: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
