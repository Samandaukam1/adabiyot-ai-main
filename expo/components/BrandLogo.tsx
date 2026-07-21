import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useBranding } from "@/providers/BrandingProvider";
import { useTheme } from "@/providers/ThemeProvider";

type BrandLogoVariant = "logo" | "icon" | "splash";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Render the mark on its own, with no coloured badge behind it. */
  plain?: boolean;
  /**
   * Use the bundled asset instead of the admin-configured remote URL. The launch
   * screen needs this: a remote logo isn't cached on a cold start, so it would
   * pop in a frame after the native splash and read as a *second* logo.
   */
  bundledOnly?: boolean;
}

export default function BrandLogo({
  variant = "logo",
  size = 44,
  radius = 12,
  style,
  plain = false,
  bundledOnly = false,
}: BrandLogoProps) {
  const { colors } = useTheme();
  const {
    logoSource,
    appIconSource,
    splashLogoSource,
    defaultLogoSource,
    defaultAppIconSource,
    defaultSplashLogoSource,
  } = useBranding();
  const [failed, setFailed] = useState(false);

  const fallbackSource =
    variant === "icon"
      ? defaultAppIconSource
      : variant === "splash"
      ? defaultSplashLogoSource
      : defaultLogoSource;
  const remoteSource =
    variant === "icon"
      ? appIconSource
      : variant === "splash"
      ? splashLogoSource
      : logoSource;
  const source = bundledOnly ? fallbackSource : remoteSource;

  useEffect(() => {
    setFailed(false);
  }, [source]);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: plain ? 0 : radius,
          backgroundColor: plain ? "transparent" : colors.primary,
        },
        style,
      ]}
    >
      <Image
        source={failed ? fallbackSource : source}
        style={styles.image}
        contentFit="contain"
        transition={120}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
