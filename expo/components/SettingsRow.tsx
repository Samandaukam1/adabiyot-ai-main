import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { PressableScale } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";

/** A single settings row: icon + label (+ optional description) and a trailing
 * control (switch / chevron). Used by the Settings and Jaxongir AI screens. */
export default function SettingsRow({
  icon,
  iconColor,
  iconBg,
  label,
  description,
  value,
  onValueChange,
  onPress,
  isLast,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const { colors: c } = useTheme();
  const isToggle = typeof value === "boolean" && !!onValueChange;

  const content = (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: c.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon as any} size={19} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.desc, { color: c.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      {isToggle ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: c.primary, false: c.surface }}
          thumbColor="#fff"
        />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
      )}
    </View>
  );

  if (onPress && !isToggle) {
    return <PressableScale onPress={onPress} style={styles.pressWrap}>{content}</PressableScale>;
  }
  return content;
}

const styles = StyleSheet.create({
  pressWrap: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 15, fontWeight: "600" },
  desc: { fontSize: 12, marginTop: 2, lineHeight: 16, fontWeight: "500" },
});
