import { BadgePercent, Check, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";

const DEEP_GREEN = "#0B5A3A";
const WARN = "#C77700"; // soft amber — avoids a harsh red

/**
 * Promo-code entry for the checkout sheet. Collapses to an "applied" chip with a
 * remove action once a code is in effect; otherwise shows an input + "Qo'llash"
 * button with inline validation feedback.
 */
export default function PromoCodeInput({
  appliedCode,
  validating,
  error,
  success,
  onApply,
  onRemove,
}: {
  appliedCode: string | null;
  validating: boolean;
  error: string | null;
  success: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [code, setCode] = useState("");

  // Clear the field once a code is successfully applied.
  useEffect(() => {
    if (appliedCode) setCode("");
  }, [appliedCode]);

  if (appliedCode) {
    return (
      <View style={styles.appliedRow}>
        <View style={styles.appliedChip}>
          <View style={styles.checkDot}>
            <Check color="#fff" size={11} strokeWidth={3} />
          </View>
          <Text style={styles.appliedText} numberOfLines={1}>
            {success ? "Promo kod qo'llandi" : `${appliedCode} qo'llandi`}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
          <X color={c.textDim} size={14} />
          <Text style={styles.removeText}>Bekor qilish</Text>
        </Pressable>
      </View>
    );
  }

  const canApply = code.trim().length > 0 && !validating;

  return (
    <View>
      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <BadgePercent color={c.textMuted} size={18} />
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Promo kod"
            placeholderTextColor={c.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => canApply && onApply(code)}
            editable={!validating}
          />
        </View>
        <PressableScale
          onPress={canApply ? () => onApply(code) : undefined}
          style={[styles.applyBtn, ...(canApply ? [] : [styles.applyBtnDisabled])]}
        >
          {validating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.applyText}>Qo'llash</Text>
          )}
        </PressableScale>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  const accent = isDark ? c.secondary : DEEP_GREEN;
  return StyleSheet.create({
    inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    inputWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 48,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      paddingHorizontal: 12,
    },
    input: { flex: 1, fontSize: 15, color: c.text, fontWeight: "700", letterSpacing: 1 },
    applyBtn: {
      height: 48,
      paddingHorizontal: 18,
      borderRadius: 13,
      backgroundColor: accent,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 92,
    },
    applyBtnDisabled: { backgroundColor: c.textMuted },
    applyText: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
    errorText: { color: WARN, fontSize: 12.5, fontWeight: "600", marginTop: 8 },

    appliedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    appliedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.16)" : "rgba(11,90,58,0.08)",
    },
    checkDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: accent,
      alignItems: "center",
      justifyContent: "center",
    },
    appliedText: { color: accent, fontSize: 13.5, fontWeight: "800", flexShrink: 1 },
    removeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 4 },
    removeText: { color: c.textDim, fontSize: 13, fontWeight: "700" },
  });
}
