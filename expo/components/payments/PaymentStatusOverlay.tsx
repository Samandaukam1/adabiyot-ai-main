import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react-native";
import React, { useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { formatUzs } from "@/constants/tariffs";
import type { PurchaseState } from "@/hooks/usePayments";
import { useTheme } from "@/providers/ThemeProvider";

const BUSY_LABEL: Partial<Record<PurchaseState, string>> = {
  creating: "Buyurtma yaratilmoqda...",
  awaiting_payment: "To'lov kutilmoqda...",
  checking: "To'lov tekshirilmoqda...",
};

export default function PaymentStatusOverlay({
  state,
  errorMessage,
  amountUzs,
  discountPercent = 0,
  discountAmountUzs,
  onRetry,
  onRecheck,
  onClose,
  onSuccess,
}: {
  state: PurchaseState;
  errorMessage?: string | null;
  amountUzs?: number | null;
  discountPercent?: number;
  discountAmountUzs?: number | null;
  onRetry: () => void;
  onRecheck?: () => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);

  const visible = state !== "idle";
  const busy = state === "creating" || state === "awaiting_payment" || state === "checking";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {busy ? (
            <>
              <ActivityIndicator color={c.primary} size="large" />
              <Text style={styles.title}>{BUSY_LABEL[state] ?? "Yuklanmoqda..."}</Text>
              <Text style={styles.subtitle}>Iltimos, oynani yopmang.</Text>
            </>
          ) : null}

          {state === "paid" ? (
            <>
              <CheckCircle2 color={c.success} size={64} strokeWidth={1.8} />
              <Text style={styles.title}>To'lov muvaffaqiyatli!</Text>
              <Text style={styles.subtitle}>Endi kontent siz uchun ochiq.</Text>
              {discountPercent > 0 || amountUzs != null ? (
                <View style={styles.summary}>
                  {discountPercent > 0 ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Chegirma</Text>
                      <Text style={styles.summaryValue}>
                        -{discountPercent}%{discountAmountUzs ? ` (${formatUzs(discountAmountUzs)})` : ""}
                      </Text>
                    </View>
                  ) : null}
                  {amountUzs != null ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Yakuniy summa</Text>
                      <Text style={styles.summaryTotal}>{formatUzs(amountUzs)}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <PressableScale onPress={onSuccess} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>Davom etish</Text>
              </PressableScale>
            </>
          ) : null}

          {state === "pending" ? (
            <>
              <Clock3 color={c.gold} size={58} strokeWidth={1.8} />
              <Text style={styles.title}>To'lov hali tasdiqlanmadi</Text>
              <Text style={styles.subtitle}>
                {errorMessage || "Bank yoki Payme tasdig'i kechikmoqda. Birozdan so'ng holatni yangilang."}
              </Text>
              <PressableScale onPress={onRecheck ?? onRetry} style={[styles.btn, styles.btnPrimary]}>
                <View style={styles.btnInner}>
                  <RefreshCw color="#fff" size={16} />
                  <Text style={styles.btnPrimaryText}>Holatni tekshirish</Text>
                </View>
              </PressableScale>
              <PressableScale onPress={onClose} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>Yopish</Text>
              </PressableScale>
            </>
          ) : null}

          {state === "failed" ? (
            <>
              <XCircle color="#E5484D" size={60} strokeWidth={1.8} />
              <Text style={styles.title}>To'lov amalga oshmadi</Text>
              <Text style={styles.subtitle}>{errorMessage || "Qayta urinib ko'ring."}</Text>
              <PressableScale onPress={onRetry} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>Qayta urinish</Text>
              </PressableScale>
              <PressableScale onPress={onClose} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>Yopish</Text>
              </PressableScale>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(c: AppTheme) {
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
      maxWidth: 360,
      backgroundColor: c.bgElevated,
      borderRadius: 24,
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: c.text,
      marginTop: 16,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: c.textDim,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 20,
    },
    summary: {
      width: "100%",
      marginTop: 16,
      borderRadius: 14,
      backgroundColor: c.soft,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    summaryLabel: { color: c.textDim, fontSize: 13, fontWeight: "700" },
    summaryValue: { color: c.success, fontSize: 13.5, fontWeight: "800" },
    summaryTotal: { color: c.text, fontSize: 15, fontWeight: "900" },
    btn: {
      marginTop: 18,
      height: 50,
      width: "100%",
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimary: { backgroundColor: c.primary },
    btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    btnPrimaryText: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
    btnGhost: { marginTop: 8, backgroundColor: "transparent", height: 44 },
    btnGhostText: { color: c.textDim, fontSize: 14.5, fontWeight: "700" },
  });
}
