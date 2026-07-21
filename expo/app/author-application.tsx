import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  FileText,
  Send,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
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
import { FONT, PressableScale } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/providers/ThemeProvider";

// ── Option lists ─────────────────────────────────────────────────────────────
interface Option {
  label: string;
  value: string;
}

const CONTENT_TYPES: Option[] = [
  { label: "Kitob", value: "book" },
  { label: "She'riy to'plam", value: "poem_collection" },
  { label: "She'r", value: "poem" },
  { label: "Hikoya", value: "story" },
  { label: "Roman", value: "novel" },
  { label: "Qissa", value: "qissa" },
  { label: "Ertak", value: "fairy_tale" },
  { label: "Maqola", value: "article" },
  { label: "Ssenariy", value: "screenplay" },
  { label: "Qo'llanma", value: "manual" },
  { label: "Darslik", value: "textbook" },
  { label: "Boshqa", value: "other" },
];

const REGIONS: Option[] = [
  "Qoraqalpog'iston Respublikasi",
  "Andijon viloyati",
  "Buxoro viloyati",
  "Farg'ona viloyati",
  "Jizzax viloyati",
  "Xorazm viloyati",
  "Namangan viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Samarqand viloyati",
  "Sirdaryo viloyati",
  "Surxondaryo viloyati",
  "Toshkent viloyati",
  "Toshkent shahri",
].map((r) => ({ label: r, value: r }));

const GENDERS: Option[] = [
  { label: "Erkak", value: "male" },
  { label: "Ayol", value: "female" },
  { label: "Boshqa", value: "other" },
];

interface FormState {
  first_name: string;
  last_name: string;
  phone: string;
  telegram_contact: string;
  content_type: string;
  word_count: string;
  region: string;
  gender: string;
  age: string;
}

const EMPTY: FormState = {
  first_name: "",
  last_name: "",
  phone: "",
  telegram_contact: "",
  content_type: "",
  word_count: "",
  region: "",
  gender: "",
  age: "",
};

const PHONE_RE = /^\+998\d{9}$/;

export default function AuthorApplicationScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { isWebLayout } = useResponsive();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  // A detail-page CTA ("Menda ham kitob bor") can pass the already-mapped
  // content_type so the dropdown starts pre-selected.
  const params = useLocalSearchParams<{ content_type?: string }>();
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    content_type:
      typeof params.content_type === "string" &&
      CONTENT_TYPES.some((o) => o.value === params.content_type)
        ? params.content_type
        : "",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.first_name.trim().length < 2) next.first_name = "Ismingizni kiriting";
    if (form.last_name.trim().length < 2) next.last_name = "Familiyangizni kiriting";
    if (!PHONE_RE.test(form.phone.replace(/\s/g, "")))
      next.phone = "Telefon raqam +998 formatida bo'lishi kerak";
    if (!form.telegram_contact.trim()) next.telegram_contact = "Telegram profilingizni yozing";
    if (!form.content_type) next.content_type = "Chop etmoqchi bo'lgan material turini tanlang";
    if (!form.region) next.region = "Viloyatingizni tanlang";
    if (!form.gender) next.gender = "Jinsingizni tanlang";
    const age = Number(form.age);
    if (!form.age.trim() || !Number.isFinite(age) || age < 7 || age > 100)
      next.age = "Yoshingizni to'g'ri kiriting";
    if (form.word_count.trim()) {
      const wc = Number(form.word_count);
      if (!Number.isFinite(wc) || wc <= 0) next.word_count = "So'z soni 0 dan katta raqam bo'lishi kerak";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("submit_author_application_crm", {
        p_first_name: form.first_name.trim(),
        p_last_name: form.last_name.trim(),
        p_phone: form.phone.replace(/\s/g, ""),
        p_telegram_contact: form.telegram_contact.trim(),
        p_content_type: form.content_type,
        p_word_count: form.word_count.trim() ? Number(form.word_count) : null,
        p_region: form.region,
        p_gender: form.gender,
        p_age: Number(form.age),
      });
      if (error) throw error;
      setForm(EMPTY);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Ariza yuborilmadi. Internet aloqasini tekshirib, qayta urinib ko'ring."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const contentTypeLabel = CONTENT_TYPES.find((o) => o.value === form.content_type)?.label;
  const genderLabel = GENDERS.find((o) => o.value === form.gender)?.label;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Ariza qoldirish</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 40,
            ...(isWebLayout ? { maxWidth: 640, width: "100%", alignSelf: "center" } : null),
          }}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(82,183,136,0.12)", "rgba(82,183,136,0.05)", "transparent"]
                : ["rgba(82,183,136,0.14)", "rgba(82,183,136,0.05)", "transparent"]
            }
            style={styles.heroBg}
          >
            <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.heroIcon}>
              <FileText color="#fff" size={28} strokeWidth={2.2} />
            </LinearGradient>
            <Text style={styles.heroTitle}>Adib bo'lish uchun ariza</Text>
            <Text style={styles.heroSub}>
              Asaringizni AdabiyotX platformasida chop ettirish yoki adib sifatida ro'yxatdan
              o'tish uchun quyidagi ma'lumotlarni to'ldiring.
            </Text>
          </LinearGradient>

          {submitted ? (
            <View style={styles.card}>
              <View style={styles.successBox}>
                <CheckCircle2 color={c.primary} size={30} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Arizangiz qabul qilindi</Text>
                  <Text style={styles.successDesc}>
                    Tez orada AdabiyotX jamoasi siz bilan bog'lanadi.
                  </Text>
                </View>
              </View>
              <PressableScale onPress={() => router.back()} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Yopish</Text>
              </PressableScale>
            </View>
          ) : (
            <View style={styles.card}>
              <Field label="Ism" error={errors.first_name}>
                <TextInput
                  value={form.first_name}
                  onChangeText={set("first_name")}
                  placeholder="Ismingizni kiriting"
                  placeholderTextColor={c.textMuted}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Familiya" error={errors.last_name}>
                <TextInput
                  value={form.last_name}
                  onChangeText={set("last_name")}
                  placeholder="Familiyangizni kiriting"
                  placeholderTextColor={c.textMuted}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Telefon raqami" error={errors.phone}>
                <TextInput
                  value={form.phone}
                  onChangeText={set("phone")}
                  placeholder="+998901234567"
                  placeholderTextColor={c.textMuted}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </Field>

              <Field
                label="Telegram profili"
                error={errors.telegram_contact}
                hint="Telegram profilingiz ochiq bo'lishi yoki username yozilishi kerak."
              >
                <TextInput
                  value={form.telegram_contact}
                  onChangeText={set("telegram_contact")}
                  placeholder="@username yoki ochiq telefon raqamingiz"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </Field>

              <Field label="Nima chop etmoqchisiz?" error={errors.content_type}>
                <SelectField
                  value={contentTypeLabel}
                  placeholder="Material turini tanlang"
                  title="Nima chop etmoqchisiz?"
                  options={CONTENT_TYPES}
                  selected={form.content_type}
                  onSelect={set("content_type")}
                  styles={styles}
                  c={c}
                />
              </Field>

              <Field label="Nechta so'z?" error={errors.word_count}>
                <TextInput
                  value={form.word_count}
                  onChangeText={set("word_count")}
                  placeholder="Taxminiy so'z soni"
                  placeholderTextColor={c.textMuted}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>

              <Field label="Qayerdan turib murojaat qilyapsiz?" error={errors.region}>
                <SelectField
                  value={form.region || undefined}
                  placeholder="Viloyatingizni tanlang"
                  title="Viloyat"
                  options={REGIONS}
                  selected={form.region}
                  onSelect={set("region")}
                  styles={styles}
                  c={c}
                />
              </Field>

              <Field label="Jinsi" error={errors.gender}>
                <SelectField
                  value={genderLabel}
                  placeholder="Jinsingizni tanlang"
                  title="Jinsi"
                  options={GENDERS}
                  selected={form.gender}
                  onSelect={set("gender")}
                  styles={styles}
                  c={c}
                />
              </Field>

              <Field label="Yoshi" error={errors.age} last>
                <TextInput
                  value={form.age}
                  onChangeText={set("age")}
                  placeholder="Yoshingizni kiriting"
                  placeholderTextColor={c.textMuted}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
            </View>
          )}

          {!submitted ? (
            <View style={styles.submitWrap}>
              {submitError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{submitError}</Text>
                </View>
              ) : null}
              <PressableScale
                onPress={submitting ? undefined : onSubmit}
                style={[styles.submitBtn, { opacity: submitting ? 0.7 : 1 }]}
              >
                <LinearGradient
                  colors={["#52B788", "#2D9B6F"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitInner}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Send color="#fff" size={17} strokeWidth={2.5} />
                      <Text style={styles.submitText}>Arizani yuborish</Text>
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type StylesType = ReturnType<typeof createStyles>;

function Field({
  label,
  hint,
  error,
  last,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  // Field doesn't have access to theme colors via hook order here, so it reads
  // them through the parent styles passed implicitly by StyleSheet — but labels
  // need colors; simplest is to re-read theme.
  const { colors: c } = useTheme();
  return (
    <View style={{ marginBottom: last ? 0 : 16 }}>
      <Text style={{ color: c.textDim, fontSize: 12.5, fontWeight: "700", marginBottom: 7 }}>
        {label}
      </Text>
      {children}
      {hint ? (
        <Text style={{ color: c.textMuted, fontSize: 11.5, marginTop: 6, lineHeight: 16 }}>{hint}</Text>
      ) : null}
      {error ? (
        <Text style={{ color: "#F87171", fontSize: 12, fontWeight: "600", marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function SelectField({
  value,
  placeholder,
  title,
  options,
  selected,
  onSelect,
  styles,
  c,
}: {
  value?: string;
  placeholder: string;
  title: string;
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
  styles: StylesType;
  c: AppTheme;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={[styles.input, styles.selectRow]} onPress={() => setOpen(true)}>
        <Text style={[styles.selectValue, !value && { color: c.textMuted }]} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <ChevronDown color={c.textMuted} size={18} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{title}</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const active = opt.value === selected;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, active && { color: c.primary, fontWeight: "700" }]}>
                      {opt.label}
                    </Text>
                    {active ? <Check color={c.primary} size={18} strokeWidth={2.5} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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

    heroBg: {
      marginHorizontal: 20,
      marginTop: 16,
      borderRadius: 24,
      padding: 22,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    heroIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
      shadowColor: "#2D9B6F",
      shadowOpacity: 0.32,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 9,
    },
    heroTitle: {
      color: c.text,
      fontSize: 23,
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

    card: {
      marginHorizontal: 20,
      marginTop: 18,
      backgroundColor: c.bgCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    input: {
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#FBFBF9",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 13 : 11,
      color: c.text,
      fontSize: 14.5,
      fontWeight: "500",
    },
    selectRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    selectValue: { flex: 1, color: c.text, fontSize: 14.5, fontWeight: "500" },

    submitWrap: { marginHorizontal: 20, marginTop: 18 },
    errorBanner: {
      backgroundColor: isDark ? "rgba(248,113,113,0.10)" : "rgba(248,113,113,0.07)",
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.30)",
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
    },
    errorBannerText: { color: "#F87171", fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
    submitBtn: { borderRadius: 18, overflow: "hidden" },
    submitInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 56,
      borderRadius: 18,
    },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },

    successBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      backgroundColor: isDark ? "rgba(82,183,136,0.08)" : "rgba(82,183,136,0.06)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.28)",
      borderRadius: 16,
      padding: 16,
    },
    successTitle: { color: c.text, fontSize: 16, fontWeight: "800" },
    successDesc: { color: c.textDim, fontSize: 13, lineHeight: 19, marginTop: 4, fontWeight: "500" },
    secondaryBtn: {
      marginTop: 16,
      height: 50,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.4,
      borderColor: c.borderStrong,
    },
    secondaryText: { color: c.primary, fontSize: 15, fontWeight: "800" },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 28,
      borderTopWidth: 1,
      borderColor: c.border,
      ...(Platform.OS === "web" ? { maxWidth: 560, width: "100%", alignSelf: "center" } : null),
    },
    modalTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: "800",
      fontFamily: FONT.serif,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    optionRowActive: { backgroundColor: c.soft },
    optionText: { color: c.text, fontSize: 15, fontWeight: "500" },
  });
}
