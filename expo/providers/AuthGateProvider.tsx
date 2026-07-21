import createContextHook from "@nkzw/create-context-hook";
import { LogIn } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, PressableScale } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * A single, app-wide "login required" gate for protected actions in guest mode.
 *
 * Guests can browse every public surface; the moment they reach into a protected
 * action (buy, save, comment, react, edit profile, notifications, marathons…) the
 * caller wraps it with `requireAuth(action)`. If the user is authenticated the
 * action runs immediately; otherwise a friendly modal invites them to register.
 *
 * Leaving guest mode is done by signing out — the root redirect gate treats a
 * guest as "can enter", so it must be cleared before /auth becomes reachable.
 */
export const [AuthGateProvider, useAuthGate] = createContextHook(() => {
  const { isAuthenticated, signOut } = useAuth();
  const { colors: c, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const hide = useCallback(() => {
    setVisible(false);
    setMessage(null);
  }, []);

  /** Ask the user to register. Optionally pass a context-specific message. */
  const promptLogin = useCallback((customMessage?: string) => {
    setMessage(customMessage ?? null);
    setVisible(true);
  }, []);

  /**
   * Run `action` when authenticated; otherwise open the register modal.
   * Returns `true` if the action ran, `false` if it was gated.
   */
  const requireAuth = useCallback(
    (action?: () => void, customMessage?: string): boolean => {
      if (isAuthenticated) {
        action?.();
        return true;
      }
      promptLogin(customMessage);
      return false;
    },
    [isAuthenticated, promptLogin]
  );

  const goToAuth = useCallback(async () => {
    hide();
    // Clearing the guest/session flag lets the root gate redirect to /auth.
    await signOut();
  }, [hide, signOut]);

  const modal = (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <Pressable style={styles.backdrop} onPress={hide}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <LogIn color={c.primary} size={26} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>Davom etish uchun ro'yxatdan o'ting</Text>
          <Text style={styles.body}>
            {message ??
              "Bu imkoniyatdan foydalanish uchun hisobingizga kiring yoki bepul ro'yxatdan o'ting."}
          </Text>
          <PressableScale onPress={goToAuth} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Ro'yxatdan o'tish / Kirish</Text>
          </PressableScale>
          <Pressable onPress={hide} style={styles.secondaryBtn} hitSlop={8}>
            <Text style={styles.secondaryText}>Hozircha kerak emas</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return useMemo(
    () => ({ requireAuth, promptLogin, modal }),
    [requireAuth, promptLogin, modal]
  );
});

function createStyles(c: ReturnType<typeof useTheme>["colors"], isDark: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      borderRadius: 24,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      paddingHorizontal: 24,
      paddingTop: 26,
      paddingBottom: 20,
      alignItems: "center",
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    title: {
      color: c.text,
      fontSize: 19,
      fontWeight: "800",
      fontFamily: FONT.serif,
      textAlign: "center",
      marginBottom: 8,
    },
    body: {
      color: c.textDim,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      marginBottom: 22,
    },
    primaryBtn: {
      width: "100%",
      height: 52,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    secondaryBtn: { paddingVertical: 14, alignItems: "center" },
    secondaryText: { color: c.textMuted, fontSize: 14, fontWeight: "700" },
  });
}
