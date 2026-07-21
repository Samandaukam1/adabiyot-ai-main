import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Award, CalendarClock, Check, Clock, Coins, ScrollText, Send } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { formatUzs } from "@/constants/tariffs";
import { FONT, PressableScale, Screen } from "@/components/ui";
import {
  fetchMarathonBySlug,
  fetchMarathonTariffs,
  fetchMyParticipation,
  fetchMySubmissions,
  joinMarathon,
  submitMarathonProverb,
  type Marathon,
  type MarathonSubmission,
  type MarathonTariff,
  type ParticipationStatus,
  type SubmissionStatus,
} from "@/lib/marathons";
import { validateProverbLatin } from "@/lib/uzbekLatin";
import { useAuth } from "@/providers/AuthProvider";
import { useAuthGate } from "@/providers/AuthGateProvider";
import { useTheme } from "@/providers/ThemeProvider";

const STATUS_META: Record<SubmissionStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Tekshiruvda", color: "#B7791F", bg: "rgba(214,158,46,0.15)" },
  accepted: { label: "Qabul qilindi", color: "#2F855A", bg: "rgba(56,161,105,0.15)" },
  rejected: { label: "Rad etildi", color: "#C53030", bg: "rgba(229,62,62,0.14)" },
  duplicate: { label: "Takroriy", color: "#718096", bg: "rgba(113,128,150,0.15)" },
  removed: { label: "Admin o'chirdi", color: "#9B2C2C", bg: "rgba(155,44,44,0.14)" },
  unknown: { label: "Noma'lum", color: "#718096", bg: "rgba(113,128,150,0.15)" },
};

export default function MarathonDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { userId, isAuthenticated } = useAuth();
  const { promptLogin } = useAuthGate();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const [marathon, setMarathon] = useState<Marathon | null>(null);
  const [tariffs, setTariffs] = useState<MarathonTariff[]>([]);
  const [participation, setParticipation] = useState<ParticipationStatus>("none");
  const [submissions, setSubmissions] = useState<MarathonSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const m = await fetchMarathonBySlug(String(slug));
    setMarathon(m);
    if (m) {
      const [t, p, s] = await Promise.all([
        fetchMarathonTariffs(m.id),
        userId ? fetchMyParticipation(m.id, userId) : Promise.resolve<ParticipationStatus>("none"),
        userId ? fetchMySubmissions(m.id, userId) : Promise.resolve<MarathonSubmission[]>([]),
      ]);
      setTariffs(t);
      setParticipation(p);
      setSubmissions(s);
    }
    setLoading(false);
  }, [slug, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshSubmissions = useCallback(async () => {
    if (marathon && userId) setSubmissions(await fetchMySubmissions(marathon.id, userId));
  }, [marathon, userId]);

  const handleJoin = async (tariff: MarathonTariff) => {
    if (!isAuthenticated || !userId) {
      promptLogin();
      return;
    }
    if (!marathon) return;
    const next = await joinMarathon(marathon.id, userId, tariff);
    setParticipation(next);
  };

  if (loading) {
    return (
      <Screen>
        <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
          <ActivityIndicator color={c.primary} />
        </View>
      </Screen>
    );
  }

  if (!marathon) {
    return (
      <Screen>
        <View style={[styles.center, { paddingTop: insets.top + 60, gap: 16 }]}>
          <Text style={styles.notFound}>Marafon topilmadi</Text>
          <PressableScale onPress={() => router.back()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Orqaga</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  const canSubmit = participation === "paid" || participation === "free";

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {/* Cover */}
        <View style={styles.hero}>
          {marathon.coverUrl ? (
            <Image source={{ uri: marathon.coverUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.heroFallback]}>
              <ScrollText color="rgba(255,255,255,0.9)" size={40} strokeWidth={1.4} />
            </View>
          )}
          <LinearGradient colors={["rgba(6,20,10,0.28)", "rgba(6,20,10,0.85)"]} style={StyleSheet.absoluteFillObject} />
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 10 }]}>
            <ArrowLeft color="#fff" size={20} />
          </Pressable>
          <View style={styles.heroCopy}>
            <View style={styles.badge}>
              <Award color="#fff" size={12} />
              <Text style={styles.badgeText}>MARAFON</Text>
            </View>
            <Text style={styles.heroTitle}>{marathon.title}</Text>
            {marathon.subtitle ? <Text style={styles.heroSubtitle}>{marathon.subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.body}>
          {/* Meta chips */}
          <View style={styles.metaRow}>
            <MetaChip icon={<Coins color={c.primary} size={15} />} text={`Har maqol uchun ${formatUzs(marathon.rewardPerAccepted)}`} styles={styles} />
            {marathon.startsAt || marathon.endsAt ? (
              <MetaChip icon={<CalendarClock color={c.primary} size={15} />} text={`${fmtDate(marathon.startsAt)} — ${fmtDate(marathon.endsAt)}`} styles={styles} />
            ) : null}
          </View>

          {marathon.description ? <Text style={styles.desc}>{marathon.description}</Text> : null}

          {marathon.rules ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Qoidalar</Text>
              <Text style={styles.cardBody}>{marathon.rules}</Text>
            </View>
          ) : null}

          {/* Participation gate */}
          {!canSubmit ? (
            participation === "pending" ? (
              <View style={[styles.card, styles.pendingCard]}>
                <Clock color={c.primary} size={22} />
                <Text style={styles.pendingText}>Admin tasdiqlashi kutilmoqda</Text>
                <Text style={styles.pendingSub}>To'lovingiz tekshirilgach maqol yuborish ochiladi.</Text>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Qatnashish uchun tarifni tanlang</Text>
                <View style={styles.tariffs}>
                  {tariffs.map((t) => (
                    <TariffCard key={t.id} tariff={t} onSelect={() => handleJoin(t)} styles={styles} c={c} />
                  ))}
                </View>
              </View>
            )
          ) : (
            <ProverbForm
              marathonId={marathon.id}
              userId={userId}
              styles={styles}
              c={c}
              onSubmitted={refreshSubmissions}
            />
          )}

          {/* My submissions */}
          {submissions.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Yuborgan maqollarim</Text>
              {submissions.map((s) => (
                <SubmissionCard key={s.id} sub={s} styles={styles} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

type StylesType = ReturnType<typeof createStyles>;

function MetaChip({ icon, text, styles }: { icon: React.ReactNode; text: string; styles: StylesType }) {
  return (
    <View style={styles.metaChip}>
      {icon}
      <Text style={styles.metaChipText}>{text}</Text>
    </View>
  );
}

function TariffCard({ tariff, onSelect, styles, c }: { tariff: MarathonTariff; onSelect: () => void; styles: StylesType; c: AppTheme }) {
  return (
    <View style={styles.tariffCard}>
      <Text style={styles.tariffTitle}>{tariff.title}</Text>
      <Text style={styles.tariffPrice}>{tariff.isFree ? "Bepul" : formatUzs(tariff.price)}</Text>
      {tariff.description ? <Text style={styles.tariffDesc}>{tariff.description}</Text> : null}
      {tariff.perks.map((p, i) => (
        <View key={i} style={styles.perkRow}>
          <Check color={c.primary} size={14} />
          <Text style={styles.perkText}>{p}</Text>
        </View>
      ))}
      <PressableScale onPress={onSelect} style={styles.tariffBtn}>
        <Text style={styles.tariffBtnText}>Tanlash</Text>
      </PressableScale>
    </View>
  );
}

function ProverbForm({
  marathonId,
  userId,
  styles,
  c,
  onSubmitted,
}: {
  marathonId: string;
  userId: string | null;
  styles: StylesType;
  c: AppTheme;
  onSubmitted: () => void;
}) {
  const [proverb, setProverb] = useState("");
  const [meaning, setMeaning] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSent, setLastSent] = useState("");
  const { promptLogin } = useAuthGate();

  const submit = async () => {
    if (submitting) return;
    setError(null);
    setOk(null);
    const latinError = validateProverbLatin(proverb);
    if (latinError) return setError(latinError);
    if (!meaning.trim()) return setError("Ma'nosini yozing");
    if (!source.trim()) return setError("Manba yozilmagan");
    if (proverb.trim() === lastSent.trim()) return setError("Bu maqolni hozirgina yubordingiz.");
    if (!userId) {
      promptLogin();
      return;
    }

    setSubmitting(true);
    const res = await submitMarathonProverb({
      marathonId,
      userId,
      proverbText: proverb.trim(),
      meaningText: meaning.trim(),
      sourceText: source.trim(),
    });
    setSubmitting(false);

    if (!res.ok) return setError(res.error ?? "Yuborishda xatolik");
    setLastSent(proverb);
    setProverb("");
    setMeaning("");
    setSource("");
    setOk("Yuborildi. Admin tekshiruvidan so'ng natija hisobotda ko'rinadi.");
    onSubmitted();
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.cardTitle}>Maqol yuborish</Text>

      <Text style={styles.label}>Maqol matni</Text>
      <TextInput
        value={proverb}
        onChangeText={setProverb}
        placeholder="Maqolni bexato yozing..."
        placeholderTextColor={c.textMuted}
        style={[styles.input, styles.inputProverb]}
        multiline
      />

      <Text style={styles.label}>Ma'nosi</Text>
      <TextInput
        value={meaning}
        onChangeText={setMeaning}
        placeholder="Maqolning ma'nosini yozing..."
        placeholderTextColor={c.textMuted}
        style={[styles.input, styles.inputArea]}
        multiline
      />

      <Text style={styles.label}>Manba</Text>
      <TextInput
        value={source}
        onChangeText={setSource}
        placeholder="Manbani yozing: link, kitob nomi, nashriyot, yil, bob, sahifa yoki boshqa ma'lumot..."
        placeholderTextColor={c.textMuted}
        style={[styles.input, styles.inputArea]}
        multiline
      />

      <Text style={styles.hint}>
        Maqol faqat o'zbek lotin alifbosida yozilishi kerak. Kirill yoki boshqa tildagi matn qabul qilinmaydi.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {ok ? <Text style={styles.okText}>{ok}</Text> : null}

      <PressableScale onPress={submit} style={StyleSheet.flatten([styles.submitBtn, submitting ? { opacity: 0.7 } : null])}>
        {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={17} />}
        <Text style={styles.submitBtnText}>Maqolni yuborish</Text>
      </PressableScale>
    </View>
  );
}

function SubmissionCard({ sub, styles }: { sub: MarathonSubmission; styles: StylesType }) {
  const meta = STATUS_META[sub.status];
  return (
    <View style={styles.subCard}>
      <View style={styles.subTopRow}>
        <View style={[styles.subBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.subBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.subTime}>{fmtDate(sub.createdAt)}</Text>
      </View>
      <Text style={styles.subProverb}>{sub.proverbText}</Text>
      {sub.status === "accepted" ? (
        <Text style={styles.subReward}>+{formatUzs(sub.reward > 0 ? sub.reward : 1000)}</Text>
      ) : null}
      {sub.status === "rejected" && sub.adminReason ? (
        <Text style={styles.subReason}>Sabab: {sub.adminReason}</Text>
      ) : null}
    </View>
  );
}

function fmtDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center" },
    notFound: { color: c.text, fontSize: 20, fontWeight: "800", fontFamily: FONT.serif },
    primaryBtn: { height: 46, borderRadius: 14, backgroundColor: c.primary, paddingHorizontal: 22, justifyContent: "center" },
    primaryBtnText: { color: "#fff", fontWeight: "800" },

    hero: { height: 250, backgroundColor: "#12281B", overflow: "hidden" },
    heroFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#16351F" },
    backBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.34)", alignItems: "center", justifyContent: "center" },
    heroCopy: { marginTop: "auto", padding: 22 },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", height: 26, paddingHorizontal: 10, borderRadius: 7, backgroundColor: "rgba(47,158,110,0.95)" },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
    heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800", fontFamily: FONT.serif, marginTop: 12, lineHeight: 33 },
    heroSubtitle: { color: "rgba(255,255,255,0.86)", fontSize: 14, fontWeight: "600", marginTop: 6 },

    body: { paddingHorizontal: 18, paddingTop: 18 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.soft },
    metaChipText: { color: c.textDim, fontSize: 12.5, fontWeight: "700" },
    desc: { color: c.textDim, fontSize: 15, lineHeight: 23, marginTop: 16, fontWeight: "500" },

    card: { marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, padding: 16 },
    cardTitle: { color: c.text, fontSize: 16, fontWeight: "800", fontFamily: FONT.serif, marginBottom: 8 },
    cardBody: { color: c.textDim, fontSize: 14, lineHeight: 21, fontWeight: "500" },

    pendingCard: { alignItems: "center", gap: 8, paddingVertical: 24 },
    pendingText: { color: c.text, fontSize: 16, fontWeight: "800" },
    pendingSub: { color: c.textDim, fontSize: 13, textAlign: "center", fontWeight: "500" },

    section: { marginTop: 26 },
    sectionTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif, marginBottom: 14 },

    tariffs: { gap: 12 },
    tariffCard: { borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, padding: 18 },
    tariffTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
    tariffPrice: { color: c.primary, fontSize: 22, fontWeight: "900", marginTop: 4 },
    tariffDesc: { color: c.textDim, fontSize: 13, marginTop: 6, fontWeight: "500" },
    perkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    perkText: { color: c.textDim, fontSize: 13.5, fontWeight: "600" },
    tariffBtn: { height: 46, borderRadius: 13, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", marginTop: 16 },
    tariffBtnText: { color: "#fff", fontSize: 14.5, fontWeight: "800" },

    formCard: { marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, padding: 18 },
    label: { color: c.textDim, fontSize: 12.5, fontWeight: "800", marginTop: 14, marginBottom: 6, letterSpacing: 0.2 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: isDark ? c.bg : "#FFFFFF", color: c.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
    inputProverb: { minHeight: 60, textAlignVertical: "top" },
    inputArea: { minHeight: 88, textAlignVertical: "top" },
    hint: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 12, fontWeight: "500" },
    errorText: { color: "#E53E3E", fontSize: 13, fontWeight: "700", marginTop: 12 },
    okText: { color: c.primary, fontSize: 13, fontWeight: "700", marginTop: 12, lineHeight: 19 },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, height: 50, borderRadius: 14, backgroundColor: c.primary, marginTop: 16 },
    submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

    subCard: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, padding: 14, marginBottom: 10 },
    subTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    subBadge: { height: 24, paddingHorizontal: 10, borderRadius: 7, justifyContent: "center" },
    subBadgeText: { fontSize: 11, fontWeight: "800" },
    subTime: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    subProverb: { color: c.text, fontSize: 14.5, fontWeight: "600", lineHeight: 20 },
    subReward: { color: c.primary, fontSize: 13, fontWeight: "800", marginTop: 6 },
    subReason: { color: "#C53030", fontSize: 12.5, fontWeight: "600", marginTop: 6 },
  });
}
