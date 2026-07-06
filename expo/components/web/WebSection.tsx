import React from "react";
import { Pressable, Text, View } from "react-native";
import { FONT } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/providers/ThemeProvider";
import { cursorPointer } from "./webStyle";

/**
 * A titled content block for web pages: heading + optional subtitle + optional
 * "Barchasini ko'rish" action, then the section body. Wrapped in a centered,
 * max-width container by default.
 */
export default function WebSection({
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { colors: L } = useTheme();
  const { isTablet } = useResponsive();

  return (
    <View style={{ marginBottom: isTablet ? 56 : 84 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 26,
          gap: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: L.text,
              fontSize: isTablet ? 26 : 30,
              fontWeight: "800",
              fontFamily: FONT.serif,
              letterSpacing: -0.6,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: L.textDim, fontSize: 15, marginTop: 8, lineHeight: 22 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} style={[{ paddingVertical: 6 }, cursorPointer]}>
            <Text style={{ color: L.primary, fontSize: 14, fontWeight: "700" }}>{actionLabel} →</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
