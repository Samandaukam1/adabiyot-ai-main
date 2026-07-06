import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";

type PullRefreshIndicatorProps = {
  refreshing: boolean;
  color: string;
  top?: number;
  surfaceColor?: string;
  borderColor?: string;
};

export function PullRefreshIndicator({
  refreshing,
  color,
  top = 12,
  surfaceColor = "#fff",
  borderColor = "rgba(82, 183, 136, 0.2)",
}: PullRefreshIndicatorProps) {
  const progress = useRef(new Animated.Value(refreshing ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: refreshing ? 1 : 0,
      duration: refreshing ? 180 : 140,
      useNativeDriver: true,
    }).start();
  }, [progress, refreshing]);

  if (!refreshing) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top,
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.86, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.bubble, { backgroundColor: surfaceColor, borderColor }]}>
        <ActivityIndicator color={color} size="small" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 40,
    alignItems: "center",
  },
  bubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
});
