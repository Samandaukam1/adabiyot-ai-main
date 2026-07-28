import { router } from "expo-router";
import { AlertTriangle, ChevronLeft, ShieldOff, Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT, PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { notify } from "@/utils/dialogs";

const DANGER = "#EF4444";
/** The word the user must type out. Deliberately not localisable-by-accident. */
const CONFIRM_WORD = "O'CHIRISH";

/** Accepts the straight and the typographic apostrophe, and any casing. */
function matchesConfirmWord(value: string): boolean {
  return value.trim().replace(/[‘’`´ʻ]/g, "'").toUpperCase() === CONFIRM_WORD;
}

/**
 * Step 2 + 3 of the deletion flow (Sozlamalar → Hisobni o'chirish → …).
 *
 * A whole screen rather than a stack of alerts: App Review has to see the
 * warning and the confirmation, `Alert` is a no-op on react-native-web, and a
 * typed confirmation needs a real input anyway.
 *
 * The account is only touched from `useAccountDeletion`, which signs the user
 * out solely after the server confirms the deletion.
 */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isAuthenticated, user } = useAuth();
  const { deleteAccount, isDeleting, error, clearError } = useAccountDeletion();

  // "acknowledged" = the user passed the first confirmation ("Davom etish").
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = matchesConfirmWord(confirmText) && !isDeleting;

  // A guest (or a session that ended meanwhile) has nothing to delete.
  useEffect(() => {
    if (isAuthenticated) return;
    notify("Hisobni o'chirish", "Hisobni o'chirish uchun avval akkauntga kiring.");
    router.replace("/auth");
  }, [isAuthenticated]);

  const handleFinalDelete = useCallback(async () => {
    if (!canDelete) return;
    const deleted = await deleteAccount();
    if (!deleted) return; // `error` is rendered below — stay on the screen

    notify(
      "Hisob o'chirildi",
      "Hisobingiz butunlay o'chirildi. Bizni tanlaganingiz uchun rahmat."
    );
    router.replace("/auth");
  }, [canDelete, deleteAccount]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => (isDeleting ? undefined : router.back())}
          disabled={isDeleting}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
        >
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Hisobni o'chirish</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: insets.bottom + 48,
          }}
        >
          <View style={styles.iconBadge}>
            <AlertTriangle color={DANGER} size={30} strokeWidth={2.2} />
          </View>

          <Text style={styles.heading}>Hisobni o'chirmoqchimisiz?</Text>
          <Text style={styles.body}>
            Bu amal qaytarib bo'lmaydi. Hisobingiz, profilingiz va sizga tegishli shaxsiy
            ma'lumotlar butunlay o'chiriladi.
          </Text>

          {user?.email ? (
            <View style={styles.accountCard}>
              <Text style={styles.accountLabel}>O'chiriladigan hisob</Text>
              <Text style={styles.accountValue} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          ) : null}

          <View style={styles.list}>
            {[
              "Profilingiz, taxallusingiz va rasmingiz",
              "So'zLab yozuvlaringiz, izohlar va reytinglaringiz",
              "O'qish tarixi, tokchangiz va obunalaringiz",
              "Xaridlaringiz tarixi va ularga bog'liq ruxsatlar",
            ].map((line) => (
              <View key={line} style={styles.listRow}>
                <View style={styles.listDot} />
                <Text style={styles.listText}>{line}</Text>
              </View>
            ))}
          </View>

          {!acknowledged ? (
            <>
              <PressableScale
                onPress={() => setAcknowledged(true)}
                style={styles.continueBtn}
                testID="delete-account-continue"
              >
                <Text style={styles.continueText}>Davom etish</Text>
              </PressableScale>

              <Pressable onPress={() => router.back()} style={styles.cancelBtn} hitSlop={8}>
                <Text style={styles.cancelText}>Bekor qilish</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.confirmCard}>
                <View style={styles.confirmHeader}>
                  <ShieldOff color={DANGER} size={18} />
                  <Text style={styles.confirmTitle}>Yakuniy tasdiqlash</Text>
                </View>
                <Text style={styles.confirmHint}>
                  {`Tasdiqlash uchun quyidagi maydonga «${CONFIRM_WORD}» so'zini yozing.`}
                </Text>
                <TextInput
                  style={styles.input}
                  value={confirmText}
                  onChangeText={(text) => {
                    setConfirmText(text);
                    if (error) clearError();
                  }}
                  placeholder={CONFIRM_WORD}
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  editable={!isDeleting}
                  returnKeyType="done"
                  onSubmitEditing={handleFinalDelete}
                  testID="delete-account-confirm-input"
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <PressableScale
                onPress={canDelete ? handleFinalDelete : undefined}
                style={[styles.deleteBtn, ...(canDelete ? [] : [styles.deleteBtnDisabled])]}
                testID="delete-account-submit"
              >
                <View style={styles.deleteBtnInner}>
                  {isDeleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Trash2 color="#fff" size={19} />
                  )}
                  <Text style={styles.deleteText}>
                    {isDeleting ? "O'chirilmoqda…" : "Hisobimni butunlay o'chirish"}
                  </Text>
                </View>
              </PressableScale>

              <Pressable
                onPress={() => (isDeleting ? undefined : router.back())}
                disabled={isDeleting}
                style={styles.cancelBtn}
                hitSlop={8}
              >
                <Text style={styles.cancelText}>Bekor qilish</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },

    iconBadge: {
      alignSelf: "center",
      width: 66,
      height: 66,
      borderRadius: 22,
      backgroundColor: isDark ? "#2A1515" : "#FEF2F2",
      alignItems: "center",
      justifyContent: "center",
    },
    heading: {
      marginTop: 18,
      fontSize: 23,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      letterSpacing: -0.4,
      fontFamily: FONT.serif,
    },
    body: {
      marginTop: 10,
      fontSize: 15,
      lineHeight: 22,
      color: c.textDim,
      textAlign: "center",
      fontWeight: "500",
    },

    accountCard: {
      marginTop: 20,
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    accountLabel: { fontSize: 12, color: c.textMuted, fontWeight: "700", letterSpacing: 0.6 },
    accountValue: { marginTop: 4, fontSize: 15, color: c.text, fontWeight: "700" },

    list: { marginTop: 18, gap: 11 },
    listRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    listDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: DANGER,
      marginTop: 7,
    },
    listText: { flex: 1, fontSize: 14.5, lineHeight: 21, color: c.textDim, fontWeight: "500" },

    continueBtn: {
      marginTop: 26,
      height: 56,
      borderRadius: 17,
      backgroundColor: DANGER,
      alignItems: "center",
      justifyContent: "center",
    },
    continueText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },

    confirmCard: {
      marginTop: 24,
      backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "#FEF2F2",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? "rgba(239,68,68,0.28)" : "rgba(239,68,68,0.20)",
      padding: 16,
    },
    confirmHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    confirmTitle: { fontSize: 15, fontWeight: "800", color: DANGER },
    confirmHint: { marginTop: 8, fontSize: 13.5, lineHeight: 20, color: c.textDim, fontWeight: "500" },
    input: {
      marginTop: 12,
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: isDark ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.25)",
      backgroundColor: c.bgCard,
      paddingHorizontal: 14,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 2,
      color: c.text,
    },

    errorText: {
      marginTop: 14,
      fontSize: 13.5,
      lineHeight: 20,
      color: DANGER,
      fontWeight: "600",
      textAlign: "center",
    },

    deleteBtn: {
      marginTop: 20,
      height: 58,
      borderRadius: 17,
      backgroundColor: DANGER,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: DANGER,
      shadowOpacity: isDark ? 0.35 : 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    deleteBtnDisabled: { backgroundColor: c.textMuted, shadowOpacity: 0, elevation: 0 },
    deleteBtnInner: { flexDirection: "row", alignItems: "center", gap: 10 },
    deleteText: { color: "#fff", fontSize: 16.5, fontWeight: "800", letterSpacing: 0.2 },

    cancelBtn: { marginTop: 16, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16 },
    cancelText: { color: c.textDim, fontSize: 15, fontWeight: "700" },
  });
}
