import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AccountType, PublisherSubType } from "@/types/profile";
import { accountTypeLabel, publisherSubTypeLabel } from "@/types/profile";
import { useTheme } from "@/providers/ThemeProvider";

interface Props {
  accountType: AccountType;
  publisherSubType?: PublisherSubType | null;
  size?: "sm" | "md" | "lg";
  /** Override the label colour (e.g. brand green for a prominent profile chip) */
  color?: string;
  weight?: "600" | "700" | "800";
}

export default function AccountTypeLabel({
  accountType,
  publisherSubType,
  size = "md",
  color,
  weight = "600",
}: Props) {
  const { colors: c } = useTheme();
  const isPublisher = accountType === "publisher" || accountType === "company";
  const label = accountTypeLabel(accountType, publisherSubType);
  const subLabel = isPublisher ? publisherSubTypeLabel(publisherSubType) : null;

  const fontSize = size === "sm" ? 11 : size === "lg" ? 15 : 13;
  const subFontSize = size === "sm" ? 10 : size === "lg" ? 12 : 11;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: color ?? c.textDim, fontSize, fontWeight: weight }]}>{label}</Text>
      {subLabel && isPublisher ? (
        <Text style={[styles.subLabel, { fontSize: subFontSize }]}>{subLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontWeight: "600" },
  subLabel: { color: "#16A34A", fontWeight: "700" },
});
