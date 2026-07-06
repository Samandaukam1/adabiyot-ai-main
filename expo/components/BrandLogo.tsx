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
}

export default function BrandLogo({
  variant = "logo",
  size = 44,
  radius = 12,
  style,
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

  const source =
    variant === "icon"
      ? appIconSource
      : variant === "splash"
      ? splashLogoSource
      : logoSource;
  const fallbackSource =
    variant === "icon"
      ? defaultAppIconSource
      : variant === "splash"
      ? defaultSplashLogoSource
      : defaultLogoSource;

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
          borderRadius: radius,
          backgroundColor: colors.primary,
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
