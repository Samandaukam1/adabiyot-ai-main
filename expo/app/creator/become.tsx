import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import type { CreatorApplicationInput } from "@/lib/creator";
import { useAuth } from "@/providers/AuthProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { isApprovedCreator } from "@/types/profile";

interface FieldDef {
  key: keyof CreatorApplicationInput;
  label: string;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "url";
  required?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "fullName", label: "Ism familiya", placeholder: "To'liq ism familiyangiz", required: true },
  { key: "phone", label: "Telefon", placeholder: "+998 90 123 45 67", keyboardType: "phone-pad" },
  { key: "bio", label: "Qisqacha bio", placeholder: "O'zingiz haqingizda qisqacha", multiline: true },
  {
    key: "reason",
    label: "Nega ijodkor bo'lmoqchisiz?",
    placeholder: "Ijodkor bo'lish sababingiz",
    multiline: true,
    required: true,
  },
  { key: "portfolioUrl", label: "Portfolio link", placeholder: "https://...", keyboardType: "url" },
  { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/...", keyboardType: "url" },
  { key: "telegramUrl", label: "Telegram", placeholder: "https://t.me/...", keyboardType: "url" },
];

export default function BecomeCreatorScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { profile, requestCreatorUpgrade } = useProfile();
  const { refreshProfileRow } = useAuth();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  // Spec #9: always read the fresh creator_status / is_creator on entry so the
  // screen never shows a stale (cached) state.
  useFocusEffect(
    useCallback(() => {
      refreshProfileRow().catch(() => {});
    }, [refreshProfileRow])
  );

  const [form, setForm] = useState<CreatorApplicationInput>({
    fullName: profile.fullName?.trim() || profile.displayName || "",
    phone: "",
    bio: profile.bio ?? "",
    reason: "",
    portfolioUrl: profile.websiteUrl ?? "",
    instagramUrl: profile.instagramUrl ?? "",
    telegramUrl: profile.telegramUrl ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const approved = isApprovedCreator(profile);
  const pending = profile.creatorStatus === "pending" || justSubmitted;
  const rejected = profile.creatorStatus === "rejected" && !justSubmitted;

  const setField = (key: keyof CreatorApplicationInput) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async () => {
    if (!form.fullName.trim()) {
      Alert.alert("Ism familiya kiriting", "Iltimos, to'liq ism familiyangizni yozing.");
      return;
    }
    if (!form.reason.trim()) {
      Alert.alert("Sababni yozing", "Nega ijodkor bo'lmoqchisiz — qisqacha yozib bering.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestCreatorUpgrade(form);
      setJustSubmitted(true);
      if (result.notificationError) {
        Alert.alert(
          "Bildirishnoma yaratilmadi",
          `So‘rovingiz saqlandi, lekin bildirishnoma yaratishda xatolik bo‘ldi: ${result.notificationError}`
        );
      }
    } catch (error) {
      console.error("[creator] application submit failed:", error);
      Alert.alert(
        "So'rov yuborilmadi",
        error instanceof Error
          ? error.message
          : "Internet aloqasini tekshirib, qayta urinib ko'ring."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        >
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft color={c.text} size={22} />
            </Pressable>
          </View>

          <LinearGradient
            colors={isDark
              ? ["rgba(56,189,248,0.08)", "rgba(74,222,128,0.06)", "transparent"]
              : ["rgba(56,189,248,0.06)", "rgba(74,222,128,0.04)", "transparent"]}
            style={styles.heroBg}
          >
            <View style={styles.heroIconWrap}>
              <LinearGradient colors={["#38BDF8", "#0EA5E9"]} style={styles.heroIcon}>
                <Sparkles color="#fff" size={30} strokeWidth={2} />
              </LinearGradient>
              <View style={styles.badgeFloat}>
                <VerificationBadge verificationType="creator_blue" size="md" />
              </View>
            </View>
            <Text style={styles.heroTitle}>Ijodkor bo'lish</Text>
            <Text style={styles.heroSub}>
              So'rovingizni yuboring — admin ko'rib chiqadi. Ma'qullangach ismingiz
              yonida "Ijodkor" nishoni chiqadi va media yuborishingiz mumkin bo'ladi.
            </Text>
          </LinearGradient>

          {/* ── APPROVED ───────────────────────────────────────────── */}
          {approved ? (
            <View style={styles.stateWrap}>
              <View style={styles.successBox}>
                <CheckCircle2 color="#4ADE80" size={28} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Ijodkor sifatida tasdiqlangansiz</Text>
                  <Text style={styles.successDesc}>
                    Media yuborish tugmasi profilingizda mavjud.
                  </Text>
                </View>
              </View>
            </View>
          ) : pending ? (
            /* ── PENDING ─────────────────────────────────────────── */
            <View style={styles.stateWrap}>
              <View style={styles.pendingBox}>
                <Clock3 color="#F4A261" size={26} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>Ijodkor bo'lish so'rovingiz ko'rib chiqilmoqda</Text>
                  <Text style={styles.pendingDesc}>
                    So'rovingiz adminga yuborildi. Javob 1–3 kun ichida keladi —
                    qayta yuborish shart emas.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* ── FORM (none / rejected) ──────────────────────────── */
            <View style={styles.formWrap}>
              {rejected ? (
                <View style={styles.rejectedBanner}>
                  <RefreshCw color="#F87171" size={16} strokeWidth={2.2} />
                  <Text style={styles.rejectedText}>
                    Avvalgi so'rovingiz rad etilgan. Qayta yuborishingiz mumkin.
                  </Text>
                </View>
              ) : null}

              {FIELDS.map((f) => (
                <View key={f.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {f.label}
                    {f.required ? <Text style={{ color: "#F87171" }}> *</Text> : null}
                  </Text>
                  <TextInput
                    value={form[f.key]}
                    onChangeText={setField(f.key)}
                    placeholder={f.placeholder}
                    placeholderTextColor={c.textMuted}
                    keyboardType={f.keyboardType ?? "default"}
                    autoCapitalize={f.keyboardType === "url" ? "none" : "sentences"}
                    autoCorrect={false}
                    multiline={f.multiline}
                    style={f.multiline ? [styles.input, styles.inputMultiline] : styles.input}
                  />
                </View>
              ))}

              <PressableScale
                onPress={submitting ? undefined : onSubmit}
                style={[styles.submitBtn, { opacity: submitting ? 0.7 : 1 }]}
              >
                <LinearGradient
                  colors={["#38BDF8", "#0EA5E9"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitInner}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Send color="#fff" size={17} strokeWidth={2.5} />
                      <Text style={styles.submitText}>So'rovni yuborish</Text>
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
            </View>
          )}

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{approved || pending ? "Yopish" : "Keyinroq"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    topBar: { paddingHorizontal: 16, marginBottom: 8 },
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
    heroBg: {
      marginHorizontal: 20,
      borderRadius: 24,
      padding: 22,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 8,
    },
    heroIconWrap: { marginBottom: 16, position: "relative" },
    heroIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#0EA5E9",
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    badgeFloat: { position: "absolute", bottom: -4, right: -4 },
    heroTitle: {
      color: c.text,
      fontSize: 24,
      fontFamily: FONT.serif,
      fontWeight: "800",
      textAlign: "center",
      letterSpacing: -0.3,
    },
    heroSub: {
      color: c.textDim,
      fontSize: 13.5,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 10,
      fontWeight: "500",
    },

    /* State cards */
    stateWrap: { marginHorizontal: 20, marginTop: 20 },
    successBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      backgroundColor: isDark ? "rgba(74,222,128,0.08)" : "rgba(74,222,128,0.06)",
      borderWidth: 1,
      borderColor: "rgba(74,222,128,0.25)",
      borderRadius: 18,
      padding: 16,
    },
    successTitle: { color: c.text, fontSize: 15, fontWeight: "800" },
    successDesc: { color: c.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 4, fontWeight: "500" },
    pendingBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      backgroundColor: isDark ? "rgba(244,162,97,0.09)" : "rgba(244,162,97,0.07)",
      borderWidth: 1,
      borderColor: "rgba(244,162,97,0.28)",
      borderRadius: 18,
      padding: 16,
    },
    pendingTitle: { color: c.text, fontSize: 15, fontWeight: "800" },
    pendingDesc: { color: c.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 4, fontWeight: "500" },

    /* Form */
    formWrap: { marginHorizontal: 20, marginTop: 18 },
    rejectedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      backgroundColor: isDark ? "rgba(248,113,113,0.10)" : "rgba(248,113,113,0.07)",
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.28)",
      borderRadius: 14,
      padding: 12,
      marginBottom: 16,
    },
    rejectedText: { flex: 1, color: c.text, fontSize: 12.5, fontWeight: "600", lineHeight: 17 },
    field: { marginBottom: 14 },
    fieldLabel: { color: c.textDim, fontSize: 12.5, fontWeight: "700", marginBottom: 7 },
    input: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 13 : 10,
      color: c.text,
      fontSize: 14.5,
      fontWeight: "500",
    },
    inputMultiline: { minHeight: 84, textAlignVertical: "top", paddingTop: 12 },
    submitBtn: { borderRadius: 18, overflow: "hidden", marginTop: 6 },
    submitInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 56,
      borderRadius: 18,
    },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },

    cancelBtn: { alignItems: "center", paddingVertical: 16 },
    cancelText: { color: c.textMuted, fontSize: 14, fontWeight: "600" },
  });
}
