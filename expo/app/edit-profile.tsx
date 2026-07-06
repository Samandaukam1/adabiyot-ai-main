import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  Globe,
  Instagram,
  Link2,
  Plus,
  Send,
  Trash2,
  XCircle,
  Youtube,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { isLocalMediaUri, uploadUserImage } from "@/lib/media";
import { useAuth } from "@/providers/AuthProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getInitials, type ProfileLink } from "@/types/profile";
import {
  USERNAME_MAX,
  checkUsernameAvailable,
  normalizeUsername,
  validateUsername,
} from "@/lib/username";

type SaveState =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "upload_error"
  | "username_error";

type UsernameStatus = "idle" | "invalid" | "checking" | "available" | "taken";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { profile, updateProfile, setUsername: persistUsername } = useProfile();
  const { userId } = useAuth();

  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatarUrl);
  const [coverUri, setCoverUri] = useState<string | null>(profile.coverUrl);
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const savedUsername = profile.username ?? "";
  const [username, setUsername] = useState(savedUsername);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMsg, setUsernameMsg] = useState<string | null>(null);
  const [penName, setPenName] = useState(profile.penName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.websiteUrl ?? "");
  const [instagram, setInstagram] = useState(profile.instagramUrl ?? "");
  const [telegram, setTelegram] = useState(profile.telegramUrl ?? "");
  const [youtube, setYoutube] = useState(profile.youtubeUrl ?? "");
  const [links, setLinks] = useState<ProfileLink[]>(profile.links ?? []);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Keep the field clean while typing (auto-lowercase, drop invalid chars).
  const onChangeUsername = (raw: string) => {
    setUsername(normalizeUsername(raw));
    if (saveState === "username_error") setSaveState("idle");
  };

  // Live format + availability feedback (debounced), so the user knows before
  // saving whether the handle is free. The DB stays the source of truth.
  useEffect(() => {
    if (username === savedUsername) {
      setUsernameStatus("idle");
      setUsernameMsg(null);
      return;
    }
    if (username.length === 0) {
      // Empty = clear the username on save.
      setUsernameStatus("idle");
      setUsernameMsg("Saqlansa, username o'chiriladi");
      return;
    }
    const formatError = validateUsername(username);
    if (formatError) {
      setUsernameStatus("invalid");
      setUsernameMsg(formatError);
      return;
    }
    setUsernameStatus("checking");
    setUsernameMsg(null);
    let active = true;
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      if (!active) return;
      setUsernameStatus(available ? "available" : "taken");
      setUsernameMsg(available ? "Bo'sh — tanlash mumkin" : "Bu username band");
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username, savedUsername]);

  const pickImage = async (kind: "avatar" | "cover") => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: kind === "avatar" ? [1, 1] : [16, 9],
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const uri = res.assets[0].uri;
      if (kind === "avatar") setAvatarUri(uri);
      else setCoverUri(uri);
    } catch {
      // ignore picker failures silently
    }
  };

  const addLink = () => setLinks((prev) => [...prev, { id: `lnk-${Date.now()}`, title: "", url: "" }]);
  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));
  const updateLink = (id: string, patch: Partial<ProfileLink>) =>
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const clean = (v: string) => {
    const t = v.trim();
    return t.length ? t : null;
  };

  const handleSave = async () => {
    if (saveState === "saving") return;

    // Persist the username first (validated + unique server-side). If it is
    // knowingly bad, or the DB rejects it (e.g. taken in a race), stop here so
    // the rest of the profile isn't saved under a wrong impression.
    const usernameChanged = username !== savedUsername;
    if (usernameChanged && (usernameStatus === "invalid" || usernameStatus === "taken")) {
      setSaveState("username_error");
      return;
    }

    setSaveState("saving");
    try {
      if (usernameChanged) {
        try {
          await persistUsername(username);
        } catch (usernameError) {
          setUsernameStatus("taken");
          setUsernameMsg(
            usernameError instanceof Error ? usernameError.message : "Username saqlanmadi"
          );
          setSaveState("username_error");
          return;
        }
      }

      const uid = userId ?? profile.id;
      let finalAvatar = avatarUri;
      let finalCover = coverUri;
      let uploadFailed = false;

      // Freshly-picked local files (file:// / content:// / blob://) must be
      // uploaded to Supabase Storage first — a local URI is NEVER persisted to
      // the database (it would break after relaunch / on other devices). Remote
      // URLs are kept as-is.
      if (avatarUri && isLocalMediaUri(avatarUri)) {
        const uploaded = await uploadUserImage(avatarUri, uid, "profile");
        if (uploaded) finalAvatar = uploaded;
        else {
          finalAvatar = profile.avatarUrl; // keep the previous remote avatar
          uploadFailed = true;
        }
      }
      if (coverUri && isLocalMediaUri(coverUri)) {
        const uploaded = await uploadUserImage(coverUri, uid, "cover");
        if (uploaded) finalCover = uploaded;
        else {
          finalCover = profile.coverUrl;
          uploadFailed = true;
        }
      }

      await updateProfile({
        avatarUrl: finalAvatar,
        coverUrl: finalCover,
        fullName: clean(fullName),
        displayName: displayName.trim() || profile.displayName,
        penName: clean(penName),
        bio: clean(bio),
        websiteUrl: clean(website),
        instagramUrl: clean(instagram),
        telegramUrl: clean(telegram),
        youtubeUrl: clean(youtube),
        links: links.filter((l) => l.title.trim() && l.url.trim()),
      });

      if (uploadFailed) {
        // Text changes are saved; the image just couldn't be uploaded.
        setSaveState("upload_error");
        return;
      }
      setSaveState("saved");
      setTimeout(() => router.back(), 700);
    } catch {
      setSaveState("error");
    }
  };

  const initials = getInitials(displayName || fullName);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Profilni tahrirlash</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Cover + avatar */}
        <Pressable onPress={() => pickImage("cover")} style={styles.coverWrap}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={isDark ? ["#1F2A24", "#14201A"] : ["#EAF6EF", "#DBEFE3"]}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.coverEditPill}>
            <Camera color="#fff" size={14} strokeWidth={2.2} />
            <Text style={styles.coverEditText}>Muqovani o'zgartirish</Text>
          </View>
        </Pressable>

        <View style={styles.avatarRow}>
          <Pressable onPress={() => pickImage("avatar")} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarCamera}>
              <Camera color="#fff" size={15} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>

        {/* Text fields */}
        <View style={styles.form}>
          <Field label="Ism familiya" value={fullName} onChangeText={setFullName} placeholder="Ism familiyangiz" styles={styles} c={c} />
          <Field label="Ko'rsatiladigan ism" value={displayName} onChangeText={setDisplayName} placeholder="Profilda ko'rinadigan ism" styles={styles} c={c} />

          {/* Username (@handle) — unique, shown as @username on the profile */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Username</Text>
            <View
              style={[
                styles.inputWrap,
                usernameStatus === "available" && styles.inputWrapOk,
                (usernameStatus === "taken" || usernameStatus === "invalid") && styles.inputWrapBad,
              ]}
            >
              <Text style={styles.atPrefix}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor={c.textMuted}
                value={username}
                onChangeText={onChangeUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={USERNAME_MAX}
              />
              {usernameStatus === "checking" ? (
                <ActivityIndicator size="small" color={c.textMuted} />
              ) : usernameStatus === "available" ? (
                <CheckCircle2 color="#16A34A" size={18} />
              ) : usernameStatus === "taken" || usernameStatus === "invalid" ? (
                <XCircle color="#EF4444" size={18} />
              ) : null}
            </View>
            <Text
              style={[
                styles.usernameHint,
                usernameStatus === "available" && { color: "#16A34A" },
                (usernameStatus === "taken" || usernameStatus === "invalid") && { color: "#EF4444" },
              ]}
            >
              {usernameMsg ??
                "Profilingizda @username ko'rinadi. Faqat harf, raqam, _, - va ."}
            </Text>
          </View>

          <Field label="Taxallus" value={penName} onChangeText={setPenName} placeholder="Ijodiy taxallusingiz" styles={styles} c={c} />
          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="O'zingiz haqingizda qisqacha…"
            multiline
            styles={styles}
            c={c}
          />

          <Text style={styles.groupLabel}>HAVOLALAR</Text>
          <Field label="Veb-sayt" value={website} onChangeText={setWebsite} placeholder="https://" icon={<Globe color={c.primary} size={16} />} styles={styles} c={c} autoCapitalize="none" keyboardType="url" />
          <Field label="Instagram" value={instagram} onChangeText={setInstagram} placeholder="instagram.com/…" icon={<Instagram color="#E1306C" size={16} />} styles={styles} c={c} autoCapitalize="none" />
          <Field label="Telegram" value={telegram} onChangeText={setTelegram} placeholder="t.me/…" icon={<Send color="#229ED9" size={16} />} styles={styles} c={c} autoCapitalize="none" />
          <Field label="YouTube" value={youtube} onChangeText={setYoutube} placeholder="youtube.com/…" icon={<Youtube color="#FF0000" size={16} />} styles={styles} c={c} autoCapitalize="none" />

          {/* Custom links */}
          <Text style={styles.groupLabel}>QO'SHIMCHA HAVOLALAR</Text>
          {links.map((l) => (
            <View key={l.id} style={styles.linkRow}>
              <Link2 color={c.textMuted} size={16} />
              <View style={{ flex: 1, gap: 8 }}>
                <TextInput
                  style={styles.linkInput}
                  placeholder="Sarlavha"
                  placeholderTextColor={c.textMuted}
                  value={l.title}
                  onChangeText={(t) => updateLink(l.id, { title: t })}
                />
                <TextInput
                  style={styles.linkInput}
                  placeholder="https://"
                  placeholderTextColor={c.textMuted}
                  value={l.url}
                  onChangeText={(t) => updateLink(l.id, { url: t })}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <Pressable onPress={() => removeLink(l.id)} hitSlop={8} style={styles.linkDelete}>
                <Trash2 color="#F87171" size={16} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addLink} style={styles.addLinkBtn}>
            <Plus color={c.primary} size={16} />
            <Text style={styles.addLinkText}>Havola qo'shish</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        {saveState === "saved" ? (
          <View style={[styles.statusRow, { backgroundColor: "rgba(74,222,128,0.12)" }]}>
            <CheckCircle2 color="#4ADE80" size={18} />
            <Text style={[styles.statusText, { color: "#16A34A" }]}>Profil saqlandi</Text>
          </View>
        ) : saveState === "upload_error" ? (
          <View style={[styles.statusRow, { backgroundColor: "rgba(248,113,113,0.12)" }]}>
            <Text style={[styles.statusText, { color: "#EF4444" }]}>
              Rasm yuklanmadi. Internetni tekshirib, qayta urinib ko'ring.
            </Text>
          </View>
        ) : saveState === "error" ? (
          <View style={[styles.statusRow, { backgroundColor: "rgba(248,113,113,0.12)" }]}>
            <Text style={[styles.statusText, { color: "#EF4444" }]}>
              Profilni saqlashda xatolik yuz berdi
            </Text>
          </View>
        ) : saveState === "username_error" ? (
          <View style={[styles.statusRow, { backgroundColor: "rgba(248,113,113,0.12)" }]}>
            <Text style={[styles.statusText, { color: "#EF4444" }]}>
              {usernameMsg ?? "Username saqlanmadi"}
            </Text>
          </View>
        ) : null}
        <PressableScale
          onPress={saveState === "saving" ? undefined : handleSave}
          style={styles.saveBtn}
        >
          <LinearGradient
            colors={["#52B788", "#2D9B6F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnInner}
          >
            {saveState === "saving" ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.saveBtnText}>Saqlanmoqda…</Text>
              </>
            ) : (
              <Text style={styles.saveBtnText}>Saqlash</Text>
            )}
          </LinearGradient>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  icon,
  styles,
  c,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  icon?: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "url";
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && { alignItems: "flex-start" }]}>
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
        />
      </View>
    </View>
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
    coverWrap: {
      height: 150,
      backgroundColor: c.surface,
      overflow: "hidden",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    coverEditPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginBottom: 12,
    },
    coverEditText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    avatarRow: { paddingHorizontal: 20, marginTop: -48 },
    avatarWrap: { width: 100, height: 100 },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      borderColor: c.bg,
      backgroundColor: c.surface,
    },
    avatarPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: c.primary },
    avatarInitials: { color: "#fff", fontSize: 34, fontWeight: "900", fontFamily: FONT.serif },
    avatarCamera: {
      position: "absolute",
      right: 0,
      bottom: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.primary,
      borderWidth: 2.5,
      borderColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    form: { paddingHorizontal: 20, paddingTop: 20 },
    fieldLabel: { color: c.textDim, fontSize: 13, fontWeight: "700", marginBottom: 8 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 13 : 6,
    },
    input: { flex: 1, color: c.text, fontSize: 15, fontWeight: "500" },
    inputMultiline: { height: 92, paddingTop: Platform.OS === "ios" ? 0 : 6 },
    inputWrapOk: { borderColor: "#4ADE80" },
    inputWrapBad: { borderColor: "#F87171" },
    atPrefix: { color: c.textMuted, fontSize: 15, fontWeight: "700", marginRight: 2 },
    usernameHint: { color: c.textMuted, fontSize: 12, fontWeight: "500", marginTop: 7 },
    groupLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      marginTop: 12,
      marginBottom: 14,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
    },
    linkInput: {
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 10 : 7,
      color: c.text,
      fontSize: 14,
      fontWeight: "500",
    },
    linkDelete: { paddingTop: 4 },
    addLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.borderStrong,
      borderRadius: 14,
      paddingVertical: 14,
      marginTop: 2,
    },
    addLinkText: { color: c.primary, fontSize: 14, fontWeight: "700" },
    saveBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bgGlass,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 10,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 12,
      paddingVertical: 10,
    },
    statusText: { fontSize: 13, fontWeight: "700" },
    saveBtn: { borderRadius: 16, overflow: "hidden" },
    saveBtnInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 54,
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  });
}
