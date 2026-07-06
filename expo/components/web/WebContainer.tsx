import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";

/**
 * Centers content and caps its width so the desktop layout never stretches edge
 * to edge like a blown-up phone. Rendered only inside web pages.
 */
export default function WebContainer({
  children,
  maxWidth,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { contentMaxWidth, isTablet } = useResponsive();
  const mw = maxWidth ?? contentMaxWidth;
  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View
        style={[
          { width: "100%", maxWidth: mw },
          padded ? { paddingHorizontal: isTablet ? 24 : 40 } : null,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
