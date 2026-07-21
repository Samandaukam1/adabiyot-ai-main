import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  Send,
  Trash2,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
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
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT, PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { useResponsive } from "@/hooks/useResponsive";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/providers/ThemeProvider";

const BUCKET = "adib-encyclopedia";
const SUBMIT_ERROR = "Ma’lumot yuborishda xatolik yuz berdi. Qayta urinib ko‘ring.";
const ANSWER_PLACEHOLDER =
  "Batafsil yozing. Qancha aniq va keng yozsangiz, maqola shuncha sifatli chiqadi.";

const BIOGRAPHY_FIELDS = [
  {
    key: "early_life",
    title: "Erta hayoti va oilasi",
    question:
      "Siz qayerda tug‘ilgansiz? Oilangiz, bolalik davringiz, sizga ta’sir qilgan muhit haqida batafsil yozing.",
  },
  {
    key: "education",
    title: "Ta’limi",
    question:
      "Qayerlarda o‘qigansiz? Qaysi yo‘nalishlarda ta’lim olgansiz? Ta’lim jarayonidagi muhim bosqichlarni yozing.",
  },
  {
    key: "activity",
    title: "Faoliyati",
    question:
      "Qachondan faoliyat boshlagansiz? Qaysi sohalarda ishlagansiz yoki ijod qilgansiz? Asosiy faoliyatingizni batafsil yozing.",
  },
  {
    key: "achievements",
    title: "Yutuqlari",
    question:
      "Qanday yutuqlarga erishgansiz? Tanlov, mukofot, sertifikat, loyiha, maqola, grant yoki boshqa natijalaringizni yozing.",
  },
  {
    key: "creative_works",
    title: "Ijodiy ishlari yoki loyihalari",
    question:
      "Kitob, maqola, loyiha, kontent, ijtimoiy tashabbus yoki boshqa ishlaringiz haqida yozing.",
  },
  {
    key: "values",
    title: "Qarashlari va qadriyatlari",
    question:
      "Siz uchun muhim qadriyatlar nimalar? Hayotiy prinsiplaringiz, shioringiz yoki maqsadlaringiz haqida yozing.",
  },
  {
    key: "future_plans",
    title: "Kelajakdagi rejalari",
    question:
      "Kelajakdagi maqsadlaringiz, amalga oshirmoqchi bo‘lgan loyihalaringiz va orzularingiz haqida yozing.",
  },
  {
    key: "additional",
    title: "Qo‘shimcha ma’lumot",
    question:
      "Ensiklopedik maqolada chiqishini istagan boshqa muhim ma’lumotlaringiz bo‘lsa yozing.",
  },
] as const;

type AnswerKey = (typeof BIOGRAPHY_FIELDS)[number]["key"];
type Answers = Record<AnswerKey, string>;

interface FormState {
  full_name: string;
  pen_name: string;
  adabiyotx_username: string;
  telegram_username: string;
  phone: string;
  roles: string;
  birth_date: string;
  birth_year: string;
  birth_place: string;
  nationality: string;
  profession: string;
  specialty: string;
  party_affiliation: string;
  languages: string;
}

type ValidationKey = "full_name" | "birth_date" | "birth_year";

const EMPTY_FORM: FormState = {
  full_name: "",
  pen_name: "",
  adabiyotx_username: "",
  telegram_username: "",
  phone: "",
  roles: "",
  birth_date: "",
  birth_year: "",
  birth_place: "",
  nationality: "",
  profession: "",
  specialty: "",
  party_affiliation: "",
  languages: "",
};

const EMPTY_ANSWERS: Answers = {
  early_life: "",
  education: "",
  activity: "",
  achievements: "",
  creative_works: "",
  values: "",
  future_plans: "",
  additional: "",
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function pipeList(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extensionFor(asset: ImagePicker.ImagePickerAsset): string {
  const mimeExtension = asset.mimeType?.split("/")[1]?.toLowerCase();
  if (mimeExtension === "jpeg") return "jpg";
  if (mimeExtension && /^[a-z0-9]+$/.test(mimeExtension)) return mimeExtension;

  const uriFile = asset.uri.split("/").pop()?.split("?")[0] ?? "";
  const uriExtension = uriFile.includes(".") ? uriFile.split(".").pop()?.toLowerCase() : null;
  return uriExtension && /^[a-z0-9]{1,8}$/.test(uriExtension) ? uriExtension : "jpg";
}

function uploadFileName(asset: ImagePicker.ImagePickerAsset): string {
  const uriFile = asset.uri.split("/").pop()?.split("?")[0];
  let decodedUriFile = uriFile;
  if (uriFile) {
    try {
      decodedUriFile = decodeURIComponent(uriFile);
    } catch {
      decodedUriFile = uriFile;
    }
  }

  const fallback = `photo.${extensionFor(asset)}`;
  return (asset.fileName || decodedUriFile || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

async function uploadPhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const response = await fetch(asset.uri);
  if (!response.ok && response.status !== 0) throw new Error("Image could not be read");

  const body = await response.arrayBuffer();
  if (!body.byteLength) throw new Error("Image is empty");

  const fileName = uploadFileName(asset);
  const path = `submissions/${Date.now()}-${fileName}`;
  const contentType = asset.mimeType || response.headers.get("content-type") || "image/jpeg";
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  if (!publicUrl) throw new Error("Public image URL was not created");
  return publicUrl;
}

export default function AdibEncyclopediaApplyScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { isWebLayout } = useResponsive();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ValidationKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitError(null);
    if (key in errors) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const setAnswer = (key: AnswerKey) => (value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setSubmitError(null);
  };

  const validate = (): boolean => {
    const next: Partial<Record<ValidationKey, string>> = {};
    if (form.full_name.trim().length < 2) {
      next.full_name = "Ism-familiyangizni kiriting.";
    }

    if (form.birth_date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.birth_date.trim())) {
      next.birth_date = "Sanani YYYY-MM-DD formatida kiriting.";
    }

    if (form.birth_year.trim()) {
      const year = Number(form.birth_year);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(year) || year < 1000 || year > currentYear) {
        next.birth_year = "Tug‘ilgan yilni to‘g‘ri kiriting.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const pickPhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setPhoto(result.assets[0]);
      setSubmitError(null);
    } catch {
      // The image is optional; a picker cancellation/failure must not block the form.
    }
  };

  const submit = async () => {
    if (submitting || !validate()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const photoUrl = photo ? await uploadPhoto(photo) : null;
      const { error } = await (supabase as any).rpc(
        "submit_adib_encyclopedia_application",
        {
          p_full_name: form.full_name.trim(),
          p_pen_name: optionalText(form.pen_name),
          p_adabiyotx_username: optionalText(form.adabiyotx_username),
          p_telegram_username: optionalText(form.telegram_username),
          p_phone: optionalText(form.phone),
          p_photo_url: photoUrl,
          p_roles: pipeList(form.roles),
          p_birth_date: optionalText(form.birth_date),
          p_birth_year: form.birth_year.trim() ? Number(form.birth_year) : null,
          p_birth_place: optionalText(form.birth_place),
          p_nationality: optionalText(form.nationality),
          p_profession: optionalText(form.profession),
          p_specialty: optionalText(form.specialty),
          p_party_affiliation: optionalText(form.party_affiliation),
          p_languages: pipeList(form.languages),
          p_answers: {
            early_life: answers.early_life.trim(),
            education: answers.education.trim(),
            activity: answers.activity.trim(),
            achievements: answers.achievements.trim(),
            creative_works: answers.creative_works.trim(),
            values: answers.values.trim(),
            future_plans: answers.future_plans.trim(),
            additional: answers.additional.trim(),
          },
        }
      );
      if (error) throw error;

      setSubmitted(true);
    } catch {
      setSubmitError(SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldWidth = isWebLayout ? styles.halfField : styles.fullField;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.topBarInner, isWebLayout && styles.webTopBarInner]}>
          <Pressable
            accessibilityLabel="Orqaga"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronLeft color={c.text} size={23} />
          </Pressable>
          <Text numberOfLines={1} style={styles.topTitle}>
            Ensiklopediyaga ariza
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 48 },
            isWebLayout && styles.webContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(82,183,136,0.20)", "rgba(82,183,136,0.07)"]
                : ["rgba(82,183,136,0.19)", "rgba(82,183,136,0.05)"]
            }
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.hero}
          >
            <View style={styles.heroIcon}>
              <BookOpen color="#FFFFFF" size={27} strokeWidth={2.1} />
            </View>
            <Text style={styles.heroTitle}>O‘zingiz haqingizda hikoya qiling</Text>
            <Text style={styles.heroText}>
              Ma’lumotlaringiz asosida AdabiyotX tahririyati professional ensiklopedik maqola
              tayyorlaydi. Formani imkon qadar aniq va batafsil to‘ldiring.
            </Text>
          </LinearGradient>

          {submitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <CheckCircle2 color={c.primary} size={42} strokeWidth={1.8} />
              </View>
              <Text style={styles.successTitle}>Arizangiz qabul qilindi</Text>
              <Text style={styles.successText}>
                Ma’lumotlaringiz yuborildi. Adminlar ko‘rib chiqib, ensiklopedik maqola shakliga
                keltiradi.
              </Text>
              <PressableScale onPress={() => router.back()} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>Yopish</Text>
              </PressableScale>
            </View>
          ) : (
            <>
              <FormSection
                description="Bog‘lanish va ensiklopediyada ko‘rinadigan asosiy ma’lumotlar."
                number="1"
                styles={styles}
                title="Asosiy ma’lumotlar"
              >
                <View style={styles.fieldGrid}>
                  <FormField
                    error={errors.full_name}
                    label="Ism-familiya"
                    required
                    style={fieldWidth}
                    styles={styles}
                  >
                    <TextInput
                      autoCapitalize="words"
                      onChangeText={setField("full_name")}
                      placeholder="Ism va familiyangiz"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.full_name}
                    />
                  </FormField>

                  <FormField label="Taxallusi bo‘lsa" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="words"
                      onChangeText={setField("pen_name")}
                      placeholder="Ijodiy taxallusingiz"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.pen_name}
                    />
                  </FormField>

                  <FormField label="AdabiyotXdagi taxallusi" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setField("adabiyotx_username")}
                      placeholder="@username"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.adabiyotx_username}
                    />
                  </FormField>

                  <FormField
                    hint="Profil ochiq bo‘lishi kerak."
                    label="Telegram ochiq username"
                    style={fieldWidth}
                    styles={styles}
                  >
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setField("telegram_username")}
                      placeholder="@username"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.telegram_username}
                    />
                  </FormField>

                  <FormField label="Telefon raqam" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="phone-pad"
                      onChangeText={setField("phone")}
                      placeholder="+998 90 123 45 67"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.phone}
                    />
                  </FormField>

                  <FormField
                    hint="Rasm ixtiyoriy. Tavsiya etilgan format: JPG yoki PNG."
                    label="Rasm yuklash"
                    style={fieldWidth}
                    styles={styles}
                  >
                    {photo ? (
                      <View style={styles.photoPreview}>
                        <Image contentFit="cover" source={{ uri: photo.uri }} style={styles.photo} />
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.72)"]}
                          style={styles.photoActions}
                        >
                          <Pressable onPress={() => void pickPhoto()} style={styles.photoAction}>
                            <Camera color="#FFFFFF" size={16} />
                            <Text style={styles.photoActionText}>Almashtirish</Text>
                          </Pressable>
                          <Pressable onPress={() => setPhoto(null)} style={styles.photoAction}>
                            <Trash2 color="#FFFFFF" size={16} />
                            <Text style={styles.photoActionText}>Olib tashlash</Text>
                          </Pressable>
                        </LinearGradient>
                      </View>
                    ) : (
                      <Pressable onPress={() => void pickPhoto()} style={styles.photoPicker}>
                        <View style={styles.photoPickerIcon}>
                          <ImagePlus color={c.primary} size={23} />
                        </View>
                        <View style={styles.photoPickerCopy}>
                          <Text style={styles.photoPickerTitle}>Rasm tanlash</Text>
                          <Text style={styles.photoPickerText}>Galereyadan rasm yuklang</Text>
                        </View>
                      </Pressable>
                    )}
                  </FormField>
                </View>

                <FormField
                  hint="Ta’riflarni | belgisi bilan ajrating."
                  label="Rasm tagida chiqadigan qisqa ta’riflaringiz"
                  styles={styles}
                >
                  <TextInput
                    autoCapitalize="sentences"
                    multiline
                    onChangeText={setField("roles")}
                    placeholder="Tadbirkor | Kontent maker | Jurnalist | Ijtimoiy-siyosiy sharhlovchi | Inson huquqlari faoli"
                    placeholderTextColor={c.textMuted}
                    style={[styles.input, styles.shortMultilineInput]}
                    textAlignVertical="top"
                    value={form.roles}
                  />
                </FormField>
              </FormSection>

              <FormSection
                description="Ensiklopedik maqoladagi qisqa faktlar kartasi uchun."
                number="2"
                styles={styles}
                title="Qisqa ma’lumotlar"
              >
                <View style={styles.fieldGrid}>
                  <FormField
                    error={errors.birth_date}
                    label="Tug‘ilgan sana"
                    style={fieldWidth}
                    styles={styles}
                  >
                    <TextInput
                      autoCapitalize="none"
                      maxLength={10}
                      onChangeText={setField("birth_date")}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.birth_date}
                    />
                  </FormField>

                  <FormField
                    error={errors.birth_year}
                    label="Tug‘ilgan yili"
                    style={fieldWidth}
                    styles={styles}
                  >
                    <TextInput
                      keyboardType="number-pad"
                      maxLength={4}
                      onChangeText={setField("birth_year")}
                      placeholder="1990"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.birth_year}
                    />
                  </FormField>

                  <FormField label="Tug‘ilgan joyi" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="words"
                      onChangeText={setField("birth_place")}
                      placeholder="Viloyat, tuman yoki shahar"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.birth_place}
                    />
                  </FormField>

                  <FormField label="Millati" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="words"
                      onChangeText={setField("nationality")}
                      placeholder="Millatingiz"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.nationality}
                    />
                  </FormField>

                  <FormField label="Mutaxassisligi" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="sentences"
                      onChangeText={setField("specialty")}
                      placeholder="Ta’lim bo‘yicha mutaxassisligingiz"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.specialty}
                    />
                  </FormField>

                  <FormField label="Kasbi" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="sentences"
                      onChangeText={setField("profession")}
                      placeholder="Hozirgi kasbingiz"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.profession}
                    />
                  </FormField>

                  <FormField label="Partiyaviyligi" style={fieldWidth} styles={styles}>
                    <TextInput
                      autoCapitalize="sentences"
                      onChangeText={setField("party_affiliation")}
                      placeholder="Partiyaviyligi yoki partiyasiz"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.party_affiliation}
                    />
                  </FormField>

                  <FormField
                    hint="Tillarni | belgisi bilan ajrating."
                    label="Tillar bilishi"
                    style={fieldWidth}
                    styles={styles}
                  >
                    <TextInput
                      autoCapitalize="sentences"
                      onChangeText={setField("languages")}
                      placeholder="O‘zbek tili | Ingliz tili | Rus tili"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                      value={form.languages}
                    />
                  </FormField>
                </View>
              </FormSection>

              <FormSection
                description="Bu javoblar tahririyatga to‘liq va sifatli biografiya tayyorlashga yordam beradi."
                number="3"
                styles={styles}
                title="Biografik savollar"
              >
                {BIOGRAPHY_FIELDS.map((item, index) => (
                  <View
                    key={item.key}
                    style={[styles.answerBlock, index === BIOGRAPHY_FIELDS.length - 1 && styles.lastAnswer]}
                  >
                    <Text style={styles.answerTitle}>
                      {index + 1}. {item.title}
                    </Text>
                    <Text style={styles.answerQuestion}>{item.question}</Text>
                    <TextInput
                      autoCapitalize="sentences"
                      multiline
                      onChangeText={setAnswer(item.key)}
                      placeholder={ANSWER_PLACEHOLDER}
                      placeholderTextColor={c.textMuted}
                      style={[styles.input, styles.answerInput]}
                      textAlignVertical="top"
                      value={answers[item.key]}
                    />
                  </View>
                ))}
              </FormSection>

              {submitError ? (
                <View accessibilityLiveRegion="polite" style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{submitError}</Text>
                </View>
              ) : null}

              <PressableScale
                onPress={submitting ? undefined : () => void submit()}
                style={[styles.submitButton, submitting ? styles.disabledButton : styles.enabledButton]}
              >
                <LinearGradient
                  colors={[c.primary, c.primaryDim]}
                  end={{ x: 1, y: 0 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.submitButtonInner}
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.submitButtonText}>Yuborilmoqda…</Text>
                    </>
                  ) : (
                    <>
                      <Send color="#FFFFFF" size={18} strokeWidth={2.4} />
                      <Text style={styles.submitButtonText}>Yuborish</Text>
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type ScreenStyles = ReturnType<typeof createStyles>;

function FormSection({
  number,
  title,
  description,
  styles,
  children,
}: {
  number: string;
  title: string;
  description: string;
  styles: ScreenStyles;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberText}>{number}</Text>
        </View>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function FormField({
  label,
  required,
  hint,
  error,
  style,
  styles,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
  styles: ScreenStyles;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: {
      backgroundColor: c.bg,
      flex: 1,
    },
    topBar: {
      backgroundColor: c.bgGlass,
      borderBottomColor: c.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingBottom: 10,
      paddingHorizontal: 14,
    },
    topBarInner: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
    },
    webTopBarInner: {
      alignSelf: "center",
      maxWidth: 920,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 12,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    headerSpacer: { width: 40 },
    topTitle: {
      color: c.text,
      fontFamily: FONT.sans,
      fontSize: 16,
      fontWeight: "800",
      marginHorizontal: 10,
    },
    scrollContent: {
      paddingHorizontal: 14,
      paddingTop: 16,
      width: "100%",
    },
    webContent: {
      alignSelf: "center",
      maxWidth: 920,
      paddingHorizontal: 20,
    },
    hero: {
      borderColor: c.borderStrong,
      borderRadius: 22,
      borderWidth: 1,
      marginBottom: 16,
      overflow: "hidden",
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: c.primary,
      borderRadius: 16,
      height: 52,
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      width: 52,
    },
    heroTitle: {
      color: c.text,
      fontFamily: FONT.serif,
      fontSize: 25,
      fontWeight: "700",
      letterSpacing: -0.35,
      lineHeight: 31,
      marginBottom: 9,
    },
    heroText: {
      color: c.textDim,
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 21,
      maxWidth: 720,
    },
    sectionCard: {
      backgroundColor: c.bgCard,
      borderColor: c.border,
      borderRadius: 20,
      borderWidth: 1,
      elevation: 2,
      marginBottom: 16,
      padding: 17,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 12,
    },
    sectionHeader: {
      alignItems: "flex-start",
      borderBottomColor: c.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      marginBottom: 18,
      paddingBottom: 15,
    },
    sectionNumber: {
      alignItems: "center",
      backgroundColor: c.soft,
      borderRadius: 11,
      height: 34,
      justifyContent: "center",
      marginRight: 11,
      width: 34,
    },
    sectionNumberText: {
      color: c.primaryDim,
      fontFamily: FONT.sans,
      fontSize: 14,
      fontWeight: "900",
    },
    sectionHeaderCopy: {
      flex: 1,
      paddingTop: 1,
    },
    sectionTitle: {
      color: c.text,
      fontFamily: FONT.sans,
      fontSize: 17,
      fontWeight: "800",
      marginBottom: 4,
    },
    sectionDescription: {
      color: c.textDim,
      fontFamily: FONT.sans,
      fontSize: 12.5,
      lineHeight: 18,
    },
    fieldGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    field: {
      marginBottom: 17,
      width: "100%",
    },
    fullField: { width: "100%" },
    halfField: { width: "48.7%" },
    label: {
      color: c.textDim,
      fontFamily: FONT.sans,
      fontSize: 12.5,
      fontWeight: "700",
      marginBottom: 7,
    },
    required: { color: "#EF4444" },
    input: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 13,
      borderWidth: 1,
      color: c.text,
      fontFamily: FONT.sans,
      fontSize: 14,
      minHeight: 50,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "web" ? 13 : 11,
      width: "100%",
    },
    shortMultilineInput: {
      lineHeight: 20,
      minHeight: 84,
      paddingTop: 13,
    },
    hint: {
      color: c.textMuted,
      fontFamily: FONT.sans,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 6,
    },
    fieldError: {
      color: "#EF4444",
      fontFamily: FONT.sans,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 6,
    },
    photoPicker: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderColor: c.borderStrong,
      borderRadius: 14,
      borderStyle: "dashed",
      borderWidth: 1,
      flexDirection: "row",
      minHeight: 84,
      padding: 14,
    },
    photoPickerIcon: {
      alignItems: "center",
      backgroundColor: c.soft,
      borderRadius: 12,
      height: 48,
      justifyContent: "center",
      marginRight: 12,
      width: 48,
    },
    photoPickerCopy: { flex: 1 },
    photoPickerTitle: {
      color: c.text,
      fontFamily: FONT.sans,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 3,
    },
    photoPickerText: {
      color: c.textDim,
      fontFamily: FONT.sans,
      fontSize: 12,
    },
    photoPreview: {
      backgroundColor: c.surface,
      borderRadius: 14,
      height: 190,
      overflow: "hidden",
      position: "relative",
      width: "100%",
    },
    photo: { height: "100%", width: "100%" },
    photoActions: {
      alignItems: "flex-end",
      bottom: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      left: 0,
      padding: 12,
      position: "absolute",
      right: 0,
      top: 70,
    },
    photoAction: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.48)",
      borderRadius: 10,
      flexDirection: "row",
      gap: 6,
      minHeight: 35,
      paddingHorizontal: 10,
    },
    photoActionText: {
      color: "#FFFFFF",
      fontFamily: FONT.sans,
      fontSize: 11.5,
      fontWeight: "700",
    },
    answerBlock: {
      borderBottomColor: c.border,
      borderBottomWidth: 1,
      marginBottom: 19,
      paddingBottom: 19,
    },
    lastAnswer: {
      borderBottomWidth: 0,
      marginBottom: 0,
      paddingBottom: 0,
    },
    answerTitle: {
      color: c.text,
      fontFamily: FONT.sans,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 6,
    },
    answerQuestion: {
      color: c.textDim,
      fontFamily: FONT.sans,
      fontSize: 12.5,
      lineHeight: 19,
      marginBottom: 10,
    },
    answerInput: {
      lineHeight: 21,
      minHeight: 126,
      paddingTop: 13,
    },
    errorBanner: {
      backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2",
      borderColor: "rgba(239,68,68,0.24)",
      borderRadius: 13,
      borderWidth: 1,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    errorBannerText: {
      color: isDark ? "#FCA5A5" : "#B91C1C",
      fontFamily: FONT.sans,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
      textAlign: "center",
    },
    submitButton: {
      borderRadius: 15,
      overflow: "hidden",
    },
    enabledButton: { opacity: 1 },
    disabledButton: { opacity: 0.72 },
    submitButtonInner: {
      alignItems: "center",
      flexDirection: "row",
      gap: 9,
      justifyContent: "center",
      minHeight: 55,
      paddingHorizontal: 20,
    },
    submitButtonText: {
      color: "#FFFFFF",
      fontFamily: FONT.sans,
      fontSize: 15,
      fontWeight: "800",
    },
    successCard: {
      alignItems: "center",
      backgroundColor: c.bgCard,
      borderColor: c.border,
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 22,
      paddingVertical: 34,
    },
    successIcon: {
      alignItems: "center",
      backgroundColor: c.soft,
      borderRadius: 32,
      height: 64,
      justifyContent: "center",
      marginBottom: 16,
      width: 64,
    },
    successTitle: {
      color: c.text,
      fontFamily: FONT.serif,
      fontSize: 23,
      fontWeight: "700",
      marginBottom: 9,
      textAlign: "center",
    },
    successText: {
      color: c.textDim,
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 21,
      maxWidth: 570,
      textAlign: "center",
    },
    doneButton: {
      alignItems: "center",
      backgroundColor: c.primary,
      borderRadius: 13,
      justifyContent: "center",
      marginTop: 24,
      minHeight: 48,
      paddingHorizontal: 34,
    },
    doneButtonText: {
      color: "#FFFFFF",
      fontFamily: FONT.sans,
      fontSize: 14,
      fontWeight: "800",
    },
  });
}
