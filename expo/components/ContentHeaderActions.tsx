import { Clock, Share2 } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/colors";
import { shareContent } from "@/lib/share";
import { usePlannedRead } from "@/hooks/useShelf";
import type { ShelfContentType } from "@/lib/shelfStore";

/**
 * The two top-right detail-page actions:
 *   • "Tez orada o'qiyman" — toggles a planned read (Tokcham → Rejalashtirilganlar)
 *   • "Ulashish"           — native share sheet
 * Self-contained styling + a lightweight toast so every detail page is consistent
 * and the buttons never collide with the notch (rendered inside the screen's
 * inset-aware top bar).
 */
export default function ContentHeaderActions({
  contentType,
  contentId,
  title,
  author,
  cover,
  description,
  c,
  isDark,
}: {
  contentType: ShelfContentType;
  contentId: string | null | undefined;
  title: string;
  author?: string | null;
  cover?: string | null;
  description?: string | null;
  c: AppTheme;
  isDark: boolean;
}) {
  const { planned, toggle } = usePlannedRead(contentType, contentId);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      toastAnim.setValue(0);
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(
          () => setToast(null)
        );
      }, 1700);
    },
    [toastAnim]
  );

  const onTogglePlanned = useCallback(() => {
    if (!contentId) return;
    const nowPlanned = toggle({ title, cover: cover ?? null, author: author ?? null });
    showToast(nowPlanned ? "Rejalashtirilganlarga qo'shildi" : "Rejalashtirilganlardan olib tashlandi");
  }, [contentId, toggle, title, cover, author, showToast]);

  const onShare = useCallback(() => {
    void shareContent({ title, author, description });
  }, [title, author, description]);

  const btnStyle = [
    styles.iconBtn,
    {
      backgroundColor: isDark ? "rgba(28,33,40,0.92)" : "rgba(255,255,255,0.92)",
      borderColor: c.border,
    },
  ];

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onTogglePlanned}
        style={[
          btnStyle,
          planned && { backgroundColor: c.primary, borderColor: c.primary },
        ]}
        hitSlop={6}
        accessibilityLabel="Tez orada o'qiyman"
      >
        <Clock color={planned ? "#fff" : c.text} size={18} strokeWidth={2.1} />
      </Pressable>
      <Pressable onPress={onShare} style={btnStyle} hitSlop={6} accessibilityLabel="Ulashish">
        <Share2 color={c.text} size={18} />
      </Pressable>

      <Modal visible={!!toast} transparent animationType="none" onRequestClose={() => setToast(null)}>
        <View style={styles.toastHost} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: isDark ? "rgba(28,33,40,0.97)" : "rgba(17,17,17,0.92)",
                opacity: toastAnim,
                transform: [
                  { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                ],
              },
            ]}
          >
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  toastHost: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 90,
  },
  toast: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
