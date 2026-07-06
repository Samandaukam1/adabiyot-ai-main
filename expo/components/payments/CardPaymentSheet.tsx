import { CheckCircle2, CreditCard, RefreshCw, ShieldCheck, X, XCircle } from "lucide-react-native";
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

import { FONT, PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { formatUzs } from "@/constants/tariffs";
import type { PurchaseFlow } from "@/hooks/usePayments";
import { useTheme } from "@/providers/ThemeProvider";

const FAIL_RED = "#E5484D";
const DEEP_GREEN = "#0B5A3A";

export type SuccessKind = "content" | "audio" | "subscription";

export interface SuccessConfig {
  kind: SuccessKind;
  onPrimary: () => void;
  onSecondary?: () => void;
}

const SUCCESS_COPY: Record<
  SuccessKind,
  { subtitle: string; body: string; primary: string; secondary: string }
> = {
  content: {
    subtitle: "Xaridingiz muvaffaqiyatli amalga oshirildi.",
    body: "Tanlangan kontent endi siz uchun ochiq.",
    primary: "Davom etish",
    secondary: "Kutubxonaga o'tish",
  },
  audio: {
    subtitle: "Audio kitob siz uchun ochildi.",
    body: "Endi asarni tinglashni boshlashingiz mumkin.",
    primary: "Tinglashni boshlash",
    secondary: "Kutubxonaga o'tish",
  },
  subscription: {
    subtitle: "Tarifingiz muvaffaqiyatli faollashtirildi.",
    body: "Endi AdabiyotX imkoniyatlaridan kengroq foydalanishingiz mumkin.",
    primary: "Tarifni ko'rish",
    secondary: "Bosh sahifa",
  },
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

function groupCardNumber(digits: string): string {
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpire(digits: string): string {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function CardPaymentSheet({
  flow,
  title,
  onClose,
  success,
}: {
  flow: PurchaseFlow;
  title?: string;
  onClose: () => void;
  success?: SuccessConfig;
}) {
  const { colors: c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const [cardNumber, setCardNumber] = useState("");
  const [expire, setExpire] = useState("");
  const [code, setCode] = useState("");

  const { state, errorMessage } = flow;
  const visible = state !== "idle";
  const dismissable = !flow.isBusy && state !== "paid";
  const cardValid = cardNumber.length >= 16 && expire.length === 4;
  const codeValid = code.length >= 4;
  const copy = SUCCESS_COPY[success?.kind ?? "content"];

  useEffect(() => {
    if (state === "idle") {
      setCardNumber("");
      setExpire("");
      setCode("");
    }
  }, [state]);

  useEffect(() => {
    if (state === "sms" && errorMessage) setCode("");
  }, [state, errorMessage]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismissable ? onClose : undefined}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={dismissable ? onClose : undefined}>
          <Pressable
            style={[styles.sheet, state === "paid" ? styles.sheetSuccess : null, { paddingBottom: insets.bottom + 18 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />

            {state === "paid" ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.successWrap}>
                <CheckCircle2 color={c.success} size={72} strokeWidth={1.8} />
                <Text style={styles.successTitle}>Tabriklaymiz!</Text>
                <Text style={styles.successSubtitle}>{copy.subtitle}</Text>
                <Text style={styles.successBody}>{copy.body}</Text>

                {flow.discountPercent > 0 || flow.amountUzs != null ? (
                  <View style={styles.summary}>
                    {flow.discountPercent > 0 ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Chegirma</Text>
                        <Text style={styles.summaryValue}>
                          -{flow.discountPercent}%{flow.discountAmountUzs ? ` (${formatUzs(flow.discountAmountUzs)})` : ""}
                        </Text>
                      </View>
                    ) : null}
                    {flow.amountUzs != null ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Yakuniy summa</Text>
                        <Text style={styles.summaryTotal}>{formatUzs(flow.amountUzs)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <PressableScale onPress={success?.onPrimary ?? onClose} style={[styles.cta, styles.successCta]}>
                  <Text style={styles.ctaText}>{copy.primary}</Text>
                </PressableScale>
                {success?.onSecondary ? (
                  <PressableScale onPress={success.onSecondary} style={styles.ghostBtn}>
                    <Text style={styles.ghostText}>{copy.secondary}</Text>
                  </PressableScale>
                ) : null}
              </ScrollView>
            ) : state === "pending" ? (
              <StatusBlock
                styles={styles}
                icon={<RefreshCw color={c.gold} size={54} />}
                title="To'lov hali tasdiqlanmadi"
                subtitle={errorMessage || "Birozdan so'ng holatni yangilang."}
                primaryLabel="Holatni tekshirish"
                onPrimary={flow.recheck}
                secondaryLabel="Yopish"
                onSecondary={onClose}
              />
            ) : state === "failed" ? (
              <StatusBlock
                styles={styles}
                icon={<XCircle color={FAIL_RED} size={60} strokeWidth={1.8} />}
                title="To'lov amalga oshmadi"
                subtitle={errorMessage || "Karta ma'lumotlari yoki SMS tasdiqlashda xatolik bo'lishi mumkin."}
                primaryLabel="Qayta urinish"
                onPrimary={flow.retry}
                secondaryLabel="Yopish"
                onSecondary={onClose}
              />
            ) : (
              <>
                <View style={styles.headerRow}>
                  <Text style={styles.heading}>Karta orqali to'lash</Text>
                  <Pressable onPress={dismissable ? onClose : undefined} hitSlop={10} style={styles.closeBtn}>
                    <X color={c.textDim} size={20} />
                  </Pressable>
                </View>

                {state === "creating" ? (
                  <View style={styles.centerBlock}>
                    <ActivityIndicator color={c.primary} size="large" />
                    <Text style={styles.centerText}>Buyurtma yaratilmoqda...</Text>
                  </View>
                ) : null}

                {state === "card" || state === "tokenizing" ? (
                  <View style={styles.body}>
                    {title ? <Text style={styles.productTitle} numberOfLines={2}>{title}</Text> : null}
                    {flow.amountUzs != null ? <Text style={styles.amount}>{formatUzs(flow.amountUzs)}</Text> : null}
                    <Text style={styles.help}>Karta tokeni faqat ushbu to'lov davomida vaqtincha ishlatiladi.</Text>

                    <Text style={styles.label}>Karta raqami</Text>
                    <View style={styles.inputWrap}>
                      <CreditCard color={c.textMuted} size={18} />
                      <TextInput
                        style={styles.input}
                        value={groupCardNumber(cardNumber)}
                        onChangeText={(text) => setCardNumber(onlyDigits(text).slice(0, 16))}
                        placeholder="0000 0000 0000 0000"
                        placeholderTextColor={c.textMuted}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        maxLength={19}
                        editable={state === "card"}
                        autoComplete="cc-number"
                        textContentType="creditCardNumber"
                      />
                    </View>

                    <Text style={styles.label}>Amal qilish muddati (MMYY)</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        value={formatExpire(expire)}
                        onChangeText={(text) => setExpire(onlyDigits(text).slice(0, 4))}
                        placeholder="MM/YY"
                        placeholderTextColor={c.textMuted}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        maxLength={5}
                        editable={state === "card"}
                      />
                    </View>

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <PressableScale
                      onPress={cardValid && state === "card" ? () => flow.submitCard(cardNumber, expire) : undefined}
                      style={[styles.cta, ...(cardValid && state === "card" ? [] : [styles.ctaDisabled])]}
                    >
                      <View style={styles.ctaInner}>
                        {state === "tokenizing" ? <ActivityIndicator color="#fff" size="small" /> : null}
                        <Text style={styles.ctaText}>{state === "tokenizing" ? "Yuborilmoqda..." : "SMS kod olish"}</Text>
                      </View>
                    </PressableScale>

                    {flow.hasCheckoutFallback ? (
                      <Pressable onPress={state === "card" ? flow.openCheckout : undefined} style={styles.fallbackBtn}>
                        <Text style={styles.fallbackText}>Payme orqali to'lash</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {state === "sms" || state === "verifying" ? (
                  <View style={styles.body}>
                    <Text style={styles.stepTitle}>SMS tasdiqlash</Text>
                    <Text style={styles.help}>
                      {flow.smsPhone
                        ? `Tasdiqlash kodi ${flow.smsPhone} raqamiga yuborildi.`
                        : "Kartangizga yuborilgan tasdiqlash kodini kiriting."}
                    </Text>

                    <Text style={styles.label}>SMS kod</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={[styles.input, styles.codeInput]}
                        value={code}
                        onChangeText={(text) => setCode(onlyDigits(text).slice(0, 6))}
                        placeholder="000000"
                        placeholderTextColor={c.textMuted}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        maxLength={6}
                        editable={state === "sms"}
                        autoComplete="sms-otp"
                        textContentType="oneTimeCode"
                      />
                    </View>

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <PressableScale
                      onPress={codeValid && state === "sms" ? () => flow.submitCode(code) : undefined}
                      style={[styles.cta, ...(codeValid && state === "sms" ? [] : [styles.ctaDisabled])]}
                    >
                      <View style={styles.ctaInner}>
                        {state === "verifying" ? <ActivityIndicator color="#fff" size="small" /> : null}
                        <Text style={styles.ctaText}>{state === "verifying" ? "Tekshirilmoqda..." : "Tasdiqlash"}</Text>
                      </View>
                    </PressableScale>
                  </View>
                ) : null}

                {state === "ready" || state === "paying" ? (
                  <View style={styles.body}>
                    <Text style={styles.stepTitle}>To'lov</Text>
                    {title ? <Text style={styles.productTitle} numberOfLines={2}>{title}</Text> : null}
                    {flow.amountUzs != null ? <Text style={styles.amount}>{formatUzs(flow.amountUzs)}</Text> : null}
                    <View style={styles.secureRow}>
                      <ShieldCheck color={c.primary} size={16} />
                      <Text style={styles.secureText}>Karta tasdiqlandi. To'lov backend orqali xavfsiz amalga oshiriladi.</Text>
                    </View>
                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                    <PressableScale
                      onPress={state === "ready" ? flow.pay : undefined}
                      style={[styles.cta, ...(state === "ready" ? [] : [styles.ctaDisabled])]}
                    >
                      <View style={styles.ctaInner}>
                        {state === "paying" ? <ActivityIndicator color="#fff" size="small" /> : null}
                        <Text style={styles.ctaText}>
                          {state === "paying" ? "To'lov amalga oshirilmoqda..." : "To'lovni amalga oshirish"}
                        </Text>
                      </View>
                    </PressableScale>
                  </View>
                ) : null}

                {state === "awaiting_payment" || state === "checking" ? (
                  <View style={styles.centerBlock}>
                    <ActivityIndicator color={c.primary} size="large" />
                    <Text style={styles.centerText}>
                      {state === "awaiting_payment" ? "Payme oynasi kutilmoqda..." : "To'lov tekshirilmoqda..."}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StatusBlock({
  styles,
  icon,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.statusBlock}>
      {icon}
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusSubtitle}>{subtitle}</Text>
      <PressableScale onPress={onPrimary} style={[styles.cta, styles.statusCta]}>
        <Text style={styles.ctaText}>{primaryLabel}</Text>
      </PressableScale>
      {secondaryLabel && onSecondary ? (
        <Pressable onPress={onSecondary} style={styles.ghostBtn}>
          <Text style={styles.ghostText}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  const accent = isDark ? c.secondary : DEEP_GREEN;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 22,
      paddingTop: 10,
    },
    sheetSuccess: { maxHeight: "92%" },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginBottom: 12,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    heading: { fontSize: 15, fontWeight: "700", color: c.textDim, letterSpacing: 0.2 },
    closeBtn: { padding: 2 },
    body: { marginTop: 14 },
    stepTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: c.text,
      fontFamily: FONT.serif,
    },
    productTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 8 },
    amount: { fontSize: 25, fontWeight: "900", color: accent, marginTop: 8 },
    help: { fontSize: 13.5, color: c.textDim, lineHeight: 19, marginTop: 8 },
    label: { fontSize: 12.5, fontWeight: "700", color: c.textDim, marginTop: 16, marginBottom: 7 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      paddingHorizontal: 14,
    },
    input: { flex: 1, fontSize: 16, color: c.text, fontWeight: "700", letterSpacing: 1 },
    codeInput: { letterSpacing: 8, textAlign: "center" },
    errorText: { color: FAIL_RED, fontSize: 13, fontWeight: "600", marginTop: 12 },
    secureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 },
    secureText: { flex: 1, fontSize: 12.5, color: c.textDim, lineHeight: 17 },
    cta: {
      marginTop: 22,
      height: 54,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    ctaDisabled: { backgroundColor: c.textMuted },
    ctaInner: { flexDirection: "row", alignItems: "center", gap: 10 },
    ctaText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
    fallbackBtn: { alignSelf: "center", marginTop: 14, paddingVertical: 8, paddingHorizontal: 8 },
    fallbackText: { color: c.textDim, fontSize: 13.5, fontWeight: "800", textDecorationLine: "underline" },
    centerBlock: { alignItems: "center", paddingVertical: 38, gap: 12 },
    centerText: { fontSize: 16, fontWeight: "700", color: c.text },
    statusBlock: { alignItems: "center", paddingTop: 10, paddingBottom: 8 },
    statusTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: c.text,
      marginTop: 16,
      textAlign: "center",
    },
    statusSubtitle: { fontSize: 14, color: c.textDim, marginTop: 8, textAlign: "center", lineHeight: 20 },
    statusCta: { width: "100%" },
    ghostBtn: { marginTop: 10, height: 44, alignItems: "center", justifyContent: "center" },
    ghostText: { color: c.textDim, fontSize: 14.5, fontWeight: "700" },
    successWrap: { alignItems: "center", paddingTop: 18, paddingBottom: 8 },
    successTitle: {
      fontSize: 30,
      fontWeight: "900",
      color: accent,
      marginTop: 12,
      fontFamily: FONT.serif,
      textAlign: "center",
    },
    successSubtitle: { fontSize: 15.5, fontWeight: "800", color: c.text, marginTop: 10, textAlign: "center" },
    successBody: { fontSize: 14, color: c.textDim, marginTop: 8, textAlign: "center", lineHeight: 21 },
    summary: {
      width: "100%",
      marginTop: 18,
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
    successCta: { marginTop: 22 },
  });
}
