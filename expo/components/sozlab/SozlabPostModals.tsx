import {
  AlertTriangle,
  Check,
  Copy,
  Flag,
  Pencil,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";
import { SOZLAB_REPORT_REASONS, type SozlabReportReason } from "@/types/database";

/* ─── Action menu (long-press / ⋯) ───────────────────────────────── */

export function PostActionMenu({
  visible,
  isOwn,
  onClose,
  onEdit,
  onDelete,
  onReport,
  onCopy,
}: {
  visible: boolean;
  isOwn: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onCopy: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          {isOwn ? (
            <>
              <ActionRow icon={<Pencil color={c.text} size={19} />} label="Tahrirlash" onPress={onEdit} styles={styles} />
              <ActionRow icon={<Copy color={c.text} size={19} />} label="Nusxa olish" onPress={onCopy} styles={styles} />
              <ActionRow icon={<Flag color={c.text} size={19} />} label="Shikoyat qilish" onPress={onReport} styles={styles} />
              <ActionRow icon={<Trash2 color="#EF4444" size={19} />} label="O'chirish" danger onPress={onDelete} styles={styles} />
            </>
          ) : (
            <>
              <ActionRow icon={<Copy color={c.text} size={19} />} label="Nusxa olish" onPress={onCopy} styles={styles} />
              <ActionRow icon={<Flag color={c.text} size={19} />} label="Shikoyat qilish" onPress={onReport} styles={styles} />
            </>
          )}
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Bekor qilish</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  danger,
  onPress,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionRow} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={[styles.actionLabel, danger && { color: "#EF4444" }]}>{label}</Text>
    </Pressable>
  );
}

/* ─── Delete confirmation ─────────────────────────────────────────── */

export function DeleteConfirmModal({
  visible,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.centerBackdrop} onPress={busy ? undefined : onCancel}>
        <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.confirmIcon}>
            <Trash2 color="#EF4444" size={24} />
          </View>
          <Text style={styles.confirmTitle}>Bu postni o'chirmoqchimisiz?</Text>
          <Text style={styles.confirmDesc}>Post So'zLab tasmasidan olib tashlanadi.</Text>
          <View style={styles.confirmBtns}>
            <Pressable onPress={busy ? undefined : onCancel} style={[styles.confirmBtn, styles.confirmCancel]}>
              <Text style={styles.confirmCancelText}>Bekor qilish</Text>
            </Pressable>
            <Pressable onPress={busy ? undefined : onConfirm} style={[styles.confirmBtn, styles.confirmDelete]}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmDeleteText}>O'chirish</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Report sheet ────────────────────────────────────────────────── */

export function ReportSheet({
  visible,
  busy,
  alreadyReported,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  busy: boolean;
  alreadyReported: boolean;
  onClose: () => void;
  onSubmit: (reason: SozlabReportReason, description: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [reason, setReason] = useState<SozlabReportReason | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setDescription("");
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 14, maxHeight: "82%" }]}>
            <View style={styles.handle} />
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Shikoyat qilish</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <X color={c.textDim} size={16} />
              </Pressable>
            </View>

            {alreadyReported ? (
              <View style={styles.alreadyWrap}>
                <AlertTriangle color={c.primary} size={28} />
                <Text style={styles.alreadyText}>
                  Siz bu post ustidan allaqachon shikoyat yuborgansiz.
                </Text>
                <Pressable onPress={onClose} style={styles.alreadyBtn}>
                  <Text style={styles.alreadyBtnText}>Yopish</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.reportLabel}>Sabab</Text>
                  {SOZLAB_REPORT_REASONS.map((r) => {
                    const active = reason === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        onPress={() => setReason(r.value)}
                        style={[styles.reasonRow, active && styles.reasonRowActive]}
                      >
                        <Text style={[styles.reasonText, active && { color: c.primary, fontWeight: "700" }]}>{r.label}</Text>
                        <View style={[styles.radio, active && styles.radioActive]}>
                          {active ? <Check color="#fff" size={12} strokeWidth={3} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}

                  <Text style={[styles.reportLabel, { marginTop: 14 }]}>Izoh (ixtiyoriy)</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Qo'shimcha ma'lumot..."
                    placeholderTextColor={c.textMuted}
                    style={styles.reportInput}
                    multiline
                    maxLength={400}
                  />
                </ScrollView>

                <Pressable
                  onPress={reason && !busy ? () => onSubmit(reason, description.trim()) : undefined}
                  style={[styles.submitBtn, (!reason || busy) && styles.submitBtnDisabled]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitText}>Yuborish</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ─── Edit sheet ──────────────────────────────────────────────────── */

export function EditPostSheet({
  visible,
  busy,
  initialText,
  onClose,
  onSave,
}: {
  visible: boolean;
  busy: boolean;
  initialText: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  const canSave = text.trim().length >= 3;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.handle} />
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Postni tahrirlash</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <X color={c.textDim} size={16} />
              </Pressable>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Fikringizni yozing..."
              placeholderTextColor={c.textMuted}
              style={styles.editInput}
              multiline
              autoFocus
              maxLength={4000}
            />
            <Pressable
              onPress={canSave && !busy ? () => onSave(text.trim()) : undefined}
              style={[styles.submitBtn, (!canSave || busy) && styles.submitBtnDisabled]}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Saqlash</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(13,27,42,0.3)" },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 10 },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 15,
      paddingHorizontal: 8,
      borderRadius: 14,
    },
    actionIcon: { width: 26, alignItems: "center" },
    actionLabel: { color: c.text, fontSize: 16, fontWeight: "600" },
    cancelBtn: {
      marginTop: 8,
      height: 52,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: { color: c.textDim, fontSize: 15, fontWeight: "700" },

    centerBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(13,27,42,0.45)", paddingHorizontal: 36 },
    confirmCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: c.bg,
      borderRadius: 22,
      padding: 22,
      alignItems: "center",
    },
    confirmIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: "rgba(239,68,68,0.10)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    confirmTitle: { color: c.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
    confirmDesc: { color: c.textDim, fontSize: 13, marginTop: 6, textAlign: "center", lineHeight: 18 },
    confirmBtns: { flexDirection: "row", gap: 10, marginTop: 20, width: "100%" },
    confirmBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    confirmCancel: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border },
    confirmCancelText: { color: c.textDim, fontSize: 14, fontWeight: "700" },
    confirmDelete: { backgroundColor: "#EF4444" },
    confirmDeleteText: { color: "#fff", fontSize: 14, fontWeight: "800" },

    reportHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    reportTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },
    closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.bgElevated },
    reportLabel: { color: c.textDim, fontSize: 13, fontWeight: "700", marginBottom: 8 },
    reasonRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      marginBottom: 8,
    },
    reasonRowActive: { borderColor: c.primary, backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.06)" },
    reasonText: { color: c.text, fontSize: 14, fontWeight: "500", flex: 1 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: { backgroundColor: c.primary, borderColor: c.primary },
    reportInput: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: "top",
    },
    submitBtn: {
      height: 52,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 14,
    },
    submitBtnDisabled: { opacity: 0.45 },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    alreadyWrap: { alignItems: "center", paddingVertical: 24, gap: 14 },
    alreadyText: { color: c.textDim, fontSize: 14, fontWeight: "600", textAlign: "center", paddingHorizontal: 20, lineHeight: 20 },
    alreadyBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, backgroundColor: c.primary },
    alreadyBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    editInput: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: c.text,
      fontSize: 15,
      minHeight: 130,
      maxHeight: 260,
      textAlignVertical: "top",
    },
  });
}
