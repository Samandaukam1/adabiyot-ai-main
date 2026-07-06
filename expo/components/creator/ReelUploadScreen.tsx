import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ImageIcon,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useReelAttachmentSearch } from "@/hooks/useReelAttachmentSearch";
import { formatReelError, submitReel, type ReelUploadAsset } from "@/lib/reels";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { LiteratureSearchItem } from "@/hooks/useLiteratureSearch";
import { normalizeKind, TOP_KIND_LABELS } from "@/types/community";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): boolean {
  return UUID_RE.test((value ?? "").trim());
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function attachmentTypeLabel(contentType: string | null | undefined): string {
  switch ((contentType ?? "").trim().toLowerCase()) {
    case "book":
      return "Kitob";
    case "poem":
      return "She'r";
    case "article":
      return "Maqola";
    case "screenplay":
    case "scenario":
      return "Ssenariy";
    case "story":
      return "Hikoya";
    case "novel":
      return "Roman";
    case "tale":
    case "fairy_tale":
      return "Ertak";
    case "guide":
      return "Qo'llanma";
    case "qissa":
      return "Qissa";
    default:
      return clean(contentType) ?? "Material";
  }
}

/** Reels need no separate title — derive one from the note (or a default). */
function deriveReelTitle(note: string): string {
  const t = note.trim();
  if (!t) return "Yangi reels";
  return t.length > 40 ? `${t.slice(0, 40).trim()}…` : t;
}

function initialAttachmentFromParams(params: {
  linkedContentType?: string | null;
  linkedContentId?: string | null;
  linkedContentTitle?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  relatedTitle?: string | null;
}): LiteratureSearchItem | null {
  const contentType = clean(params.linkedContentType) ?? clean(params.relatedType) ?? "poem";
  const id = clean(params.linkedContentId) ?? clean(params.relatedId);
  const title = clean(params.linkedContentTitle) ?? clean(params.relatedTitle);
  if (!title && !id) return null;
  return {
    id: id ?? `draft-${Date.now()}`,
    title: title ?? "Nomsiz adabiyot",
    author: null,
    cover: null,
    kind: normalizeKind(contentType),
    contentType,
  };
}

export default function ReelUploadScreen({
  initialAttachment,
}: {
  initialAttachment: LiteratureSearchItem | null;
}) {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { profileRow } = useAuth();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnail, setThumbnail] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [note, setNote] = useState("");
  const [attachment, setAttachment] = useState<LiteratureSearchItem | null>(initialAttachment);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAttachment(initialAttachment);
  }, [initialAttachment]);

  const pickAsset = async (kind: "video" | "thumbnail") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Media kutubxonaga ruxsat berilmadi.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "video" ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: kind === "thumbnail",
      quality: kind === "thumbnail" ? 0.85 : 1,
    });
    if (result.canceled || !result.assets[0]) return;
    if (kind === "video") setVideo(result.assets[0]);
    else setThumbnail(result.assets[0]);
    setError(null);
  };

  const resetForm = () => {
    setVideo(null);
    setThumbnail(null);
    setNote("");
    setAttachment(null);
    setSubmitting(false);
    setProgress(0);
    setSuccess(false);
    setError(null);
  };

  const submit = async () => {
    const profileId = profileRow?.id ?? null;
    if (!profileId) {
      setError("Reels yuborish uchun avval hisobingizga kiring.");
      return;
    }
    if (!video || submitting) return;
    setSubmitting(true);
    setProgress(0);
    setError(null);
    const noteText = note.trim();
    const toAsset = (asset: ImagePicker.ImagePickerAsset): ReelUploadAsset => ({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
    try {
      await submitReel({
        userId: profileId,
        authorId: profileRow?.author_id ?? null,
        title: deriveReelTitle(noteText),
        caption: noteText,
        description: noteText,
        video: toAsset(video),
        thumbnail: thumbnail ? toAsset(thumbnail) : null,
        linkedContentType: attachment?.contentType ?? null,
        linkedContentId: attachment?.id ?? null,
        linkedContentTitle: attachment?.title ?? null,
        onProgress: setProgress,
      });
      setSuccess(true);
    } catch (err) {
      setError(formatReelError(err, "Yuklashda xatolik yuz berdi. Qayta urinib ko'ring."));
      Alert.alert("Yuborilmadi", formatReelError(err, "Internet aloqasini tekshirib qayta urinib ko'ring."));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!video && !submitting;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}
        >
          {/* Header */}
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft color={c.text} size={22} />
            </Pressable>
            <Text style={styles.topTitle}>Media yuborish</Text>
            <View style={{ width: 40 }} />
          </View>

          {success ? (
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <CheckCircle2 color="#4ADE80" size={42} strokeWidth={2} />
              </View>
              <Text style={styles.successTitle}>Yuborildi</Text>
              <Text style={styles.successDesc}>
                Reels admin tekshiruviga yuborildi. Tasdiqlangach, profilingizdagi Reels bo'limida va
                lentada e'lon qilinadi.
              </Text>
              <PressableScale onPress={resetForm} style={styles.againBtn}>
                <Text style={styles.againText}>Yana yuborish</Text>
              </PressableScale>
            </View>
          ) : (
            <View style={styles.formWrap}>
              {/* Info card */}
              <LinearGradient
                colors={isDark ? ["rgba(82,183,136,0.10)", "transparent"] : ["rgba(82,183,136,0.07)", "transparent"]}
                style={styles.infoCard}
              >
                <Text style={styles.infoTitle}>Ijodingizni yuklang</Text>
                <Text style={styles.infoSub}>Videoingiz admin tekshiruvidan so'ng e'lon qilinadi.</Text>
              </LinearGradient>

              {/* Video */}
              {video ? (
                <View style={styles.videoSelected}>
                  <View style={styles.videoBadge}>
                    <CheckCircle2 color="#fff" size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.videoName} numberOfLines={1}>{video.fileName || "Video tanlandi"}</Text>
                    <Text style={styles.videoMeta}>Video tayyor</Text>
                  </View>
                  <PressableScale onPress={() => pickAsset("video")} style={styles.replaceBtn}>
                    <RefreshCw color={c.primary} size={14} />
                    <Text style={styles.replaceText}>Almashtirish</Text>
                  </PressableScale>
                </View>
              ) : (
                <PressableScale onPress={() => pickAsset("video")} style={styles.videoEmpty}>
                  <View style={styles.videoUploadIcon}>
                    <Upload color={c.primary} size={26} />
                  </View>
                  <Text style={styles.videoEmptyTitle}>Video tanlang</Text>
                  <Text style={styles.videoEmptySub}>MP4 yoki galereyadan video yuklang</Text>
                </PressableScale>
              )}

              {/* Izoh */}
              <View>
                <Text style={styles.label}>Izoh</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Video haqida qisqa yozing…"
                  placeholderTextColor={c.textMuted}
                  style={styles.noteInput}
                  multiline
                  maxLength={400}
                  textAlignVertical="top"
                />
              </View>

              {/* Adabiyot biriktirish — button → modal */}
              {attachment ? (
                <View style={styles.selectedCard}>
                  {attachment.cover ? (
                    <Image source={{ uri: attachment.cover }} style={styles.selectedCover} contentFit="cover" />
                  ) : (
                    <View style={[styles.selectedCover, styles.selectedCoverPh]}>
                      <BookOpen color={c.primary} size={18} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedTitle} numberOfLines={1}>{attachment.title}</Text>
                    <Text style={styles.selectedMeta} numberOfLines={1}>{attachmentTypeLabel(attachment.contentType)}</Text>
                  </View>
                  <Pressable onPress={() => setAttachment(null)} hitSlop={10} style={styles.removeBtn}>
                    <X color={c.textMuted} size={16} />
                  </Pressable>
                </View>
              ) : (
                <PressableScale onPress={() => setAttachModalOpen(true)} style={styles.rowBtn}>
                  <BookOpen color={c.primary} size={19} />
                  <Text style={styles.rowBtnText}>Adabiyot biriktirish — ixtiyoriy</Text>
                </PressableScale>
              )}

              {/* Thumbnail */}
              <PressableScale onPress={() => pickAsset("thumbnail")} style={styles.rowBtn}>
                {thumbnail ? (
                  <Image source={{ uri: thumbnail.uri }} style={styles.thumbPreview} contentFit="cover" />
                ) : (
                  <ImageIcon color={c.primary} size={19} />
                )}
                <Text style={styles.rowBtnText}>{thumbnail ? "Muqova tanlandi" : "Muqova tanlash — ixtiyoriy"}</Text>
                {thumbnail ? (
                  <Pressable onPress={() => setThumbnail(null)} hitSlop={10} style={styles.removeBtn}>
                    <X color={c.textMuted} size={16} />
                  </Pressable>
                ) : null}
              </PressableScale>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {submitting ? (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(6, progress)}%` }]} />
                  </View>
                  <Text style={styles.progressText}>Yuklanmoqda: {progress}%</Text>
                  <Text style={styles.progressHint}>Iltimos, oynani yopmang.</Text>
                </View>
              ) : (
                <Text style={styles.submitNote}>Faqat video majburiy. Videoingiz admin tekshiruviga yuboriladi.</Text>
              )}

              <PressableScale
                onPress={canSubmit ? submit : undefined}
                style={canSubmit ? styles.submitBtn : [styles.submitBtn, styles.submitBtnDisabled]}
              >
                <Text style={styles.submitBtnText}>{submitting ? `Yuborilmoqda… ${progress}%` : "Yuborish"}</Text>
              </PressableScale>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AttachPickerModal
        visible={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        onSelect={(item) => { setAttachment(item); setAttachModalOpen(false); }}
        c={c}
        insets={insets}
        styles={styles}
      />
    </View>
  );
}

function AttachPickerModal({
  visible,
  onClose,
  onSelect,
  c,
  insets,
  styles,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: LiteratureSearchItem) => void;
  c: AppTheme;
  insets: { top: number; bottom: number };
  styles: ReturnType<typeof createStyles>;
}) {
  const [q, setQ] = useState("");
  const { results, loading } = useReelAttachmentSearch(q);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 6) + 10 }]}>
            <View style={styles.grabber} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adabiyot biriktirish</Text>
              <Pressable onPress={onClose} style={styles.modalClose} hitSlop={12}>
                <X color={c.textDim} size={16} />
              </Pressable>
            </View>
            <View style={styles.modalSearch}>
              <Search color={c.textMuted} size={18} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Asar, she'r, kitob yoki maqola qidiring"
                placeholderTextColor={c.textMuted}
                style={styles.modalSearchInput}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {loading && results.length === 0 ? (
                <ActivityIndicator color={c.primary} style={{ paddingVertical: 22 }} />
              ) : results.length === 0 ? (
                <Text style={styles.emptyText}>{q.trim() ? "Hech narsa topilmadi" : "Qidirish uchun yozing"}</Text>
              ) : (
                results.map((item) => (
                  <Pressable key={`${item.contentType}-${item.id}`} onPress={() => onSelect(item)} style={styles.resultRow}>
                    {item.cover ? (
                      <Image source={{ uri: item.cover }} style={styles.resultCover} contentFit="cover" />
                    ) : (
                      <View style={[styles.resultCover, styles.resultCoverPh]}>
                        <ImageIcon color={c.textMuted} size={18} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {TOP_KIND_LABELS[item.kind] ?? attachmentTypeLabel(item.contentType)}
                        {item.author ? ` · ${item.author}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginBottom: 12,
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
    topTitle: { color: c.text, fontSize: 17, fontWeight: "800", fontFamily: FONT.serif },
    formWrap: { paddingHorizontal: 16, gap: 14 },
    infoCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    infoTitle: { color: c.text, fontSize: 18, fontWeight: "900", fontFamily: FONT.serif },
    infoSub: { color: c.textDim, fontSize: 13, lineHeight: 19, marginTop: 4, fontWeight: "500" },
    videoEmpty: {
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 30,
      borderRadius: 20,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.borderStrong,
      backgroundColor: c.bgCard,
    },
    videoUploadIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    videoEmptyTitle: { color: c.text, fontSize: 15.5, fontWeight: "800" },
    videoEmptySub: { color: c.textMuted, fontSize: 12.5, fontWeight: "500" },
    videoSelected: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.28)",
      backgroundColor: isDark ? "rgba(82,183,136,0.08)" : "rgba(82,183,136,0.06)",
    },
    videoBadge: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    videoName: { color: c.text, fontSize: 14.5, fontWeight: "800" },
    videoMeta: { color: c.primary, fontSize: 12, fontWeight: "700", marginTop: 2 },
    replaceBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
    },
    replaceText: { color: c.primary, fontSize: 12.5, fontWeight: "800" },
    label: { color: c.text, fontSize: 13.5, fontWeight: "800", marginBottom: 7 },
    noteInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      color: c.text,
      fontSize: 14.5,
      fontWeight: "500",
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 74,
      maxHeight: 120,
    },
    rowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: c.bgCard,
    },
    rowBtnText: { flex: 1, color: c.text, fontSize: 14.5, fontWeight: "600" },
    thumbPreview: { width: 28, height: 40, borderRadius: 6 },
    selectedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.28)",
      backgroundColor: isDark ? "rgba(82,183,136,0.08)" : "rgba(82,183,136,0.06)",
    },
    selectedCover: { width: 40, height: 54, borderRadius: 8, backgroundColor: c.bgElevated },
    selectedCoverPh: { alignItems: "center", justifyContent: "center" },
    selectedTitle: { color: c.text, fontSize: 14.5, fontWeight: "800" },
    selectedMeta: { color: c.textDim, fontSize: 12, marginTop: 3, fontWeight: "600" },
    removeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    errorText: { color: "#F87171", fontSize: 13, fontWeight: "600", paddingHorizontal: 4 },
    progressWrap: { gap: 6, marginTop: 2 },
    progressTrack: {
      height: 10,
      borderRadius: 6,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(13,27,42,0.06)",
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 6, backgroundColor: c.primary },
    progressText: { color: c.text, fontSize: 13.5, fontWeight: "800" },
    progressHint: { color: c.textMuted, fontSize: 12, fontWeight: "500" },
    submitNote: { color: c.textMuted, fontSize: 12.5, fontWeight: "500", textAlign: "center", marginTop: 2 },
    submitBtn: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      height: 56,
      backgroundColor: c.primary,
      marginTop: 2,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
    successWrap: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24 },
    successIcon: {
      width: 90,
      height: 90,
      borderRadius: 45,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(74,222,128,0.10)" : "rgba(74,222,128,0.08)",
      borderWidth: 1,
      borderColor: "rgba(74,222,128,0.26)",
    },
    successTitle: { color: c.text, fontSize: 24, fontWeight: "900", fontFamily: FONT.serif, marginTop: 18 },
    successDesc: { color: c.textDim, fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 10 },
    againBtn: { marginTop: 18, backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
    againText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    // Attach modal
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
    modalSheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      maxHeight: "82%",
    },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 12 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, marginBottom: 10 },
    modalTitle: { color: c.text, fontSize: 18, fontWeight: "900", fontFamily: FONT.serif },
    modalClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    modalSearch: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 48,
      backgroundColor: c.bgCard,
    },
    modalSearchInput: { flex: 1, color: c.text, fontSize: 14.5, fontWeight: "500", padding: 0 },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    resultCover: { width: 42, height: 56, borderRadius: 8, backgroundColor: c.bgElevated },
    resultCoverPh: { alignItems: "center", justifyContent: "center" },
    resultTitle: { color: c.text, fontSize: 14.5, fontWeight: "800" },
    resultMeta: { color: c.textDim, fontSize: 12, marginTop: 3, fontWeight: "500" },
    emptyText: { color: c.textMuted, fontSize: 13.5, textAlign: "center", paddingVertical: 26 },
  });
}

export { initialAttachmentFromParams, attachmentTypeLabel, isUuid };
