import React, { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";
import { openExternalUrl } from "@/utils/safeLinks";

const LIDERLAR_URL = "https://liderlar.uz";
const LIDERLAR_GREEN = "#2FA66A";

/**
 * Credit line shown under the Adiblar ensiklopediyasi header and at the bottom
 * of each encyclopedia article: the source name is a green, tappable link to
 * liderlar.uz; the rest is muted text.
 */
export default function LiderlarCredit({
  align = "left",
  style,
}: {
  align?: "left" | "center";
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <View style={[styles.wrap, align === "center" && styles.center, style]}>
      <Text style={[styles.text, align === "center" && styles.textCenter]}>
        <Text
          style={styles.link}
          onPress={() => void openExternalUrl(LIDERLAR_URL)}
          suppressHighlighting
        >
          O‘zbekiston lider yoshlari ensiklopediyasi
        </Text>
        <Text> yordamida yaratilgan</Text>
      </Text>
    </View>
  );
}

function createStyles(c: AppTheme) {
  return StyleSheet.create({
    wrap: { width: "100%" },
    center: { alignItems: "center" },
    text: { color: c.textMuted, fontSize: 12, lineHeight: 18, fontWeight: "600" },
    textCenter: { textAlign: "center" },
    link: { color: LIDERLAR_GREEN, fontWeight: "800" },
  });
}
