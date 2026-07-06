import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  RefreshCw,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ReelUploadScreen, {
  initialAttachmentFromParams,
} from "@/components/creator/ReelUploadScreen";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { ProfileRow } from "@/types/database";

type SubmitRouteParams = {
  linkedContentType?: string;
  linkedContentId?: string;
  linkedContentTitle?: string;
  relatedType?: string;
  relatedId?: string;
  relatedTitle?: string;
};

function readParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }
  return null;
}

function resolveCreatorState(row: ProfileRow | null | undefined) {
  const status = (row?.creator_status ?? "none").toLowerCase();
  const approved = row?.is_creator === true && status === "approved";
  const pending = status === "pending" || status === "requested";
  const rejected = status === "rejected";
  return { approved, pending, rejected };
}

export default function SubmitMediaScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const { profileRow, refreshProfileRow } = useAuth();
  const params = useLocalSearchParams<SubmitRouteParams>();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const [checking, setChecking] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setChecking(true);
      refreshProfileRow()
        .catch(() => {})
        .finally(() => {
          if (active) setChecking(false);
        });
      return () => {
        active = false;
      };
    }, [refreshProfileRow])
  );

  const initialAttachment = useMemo(
    () =>
      initialAttachmentFromParams({
        linkedContentType: readParam(params.linkedContentType),
        linkedContentId: readParam(params.linkedContentId),
        linkedContentTitle: readParam(params.linkedContentTitle),
        relatedType: readParam(params.relatedType),
        relatedId: readParam(params.relatedId),
        relatedTitle: readParam(params.relatedTitle),
      }),
    [
      params.linkedContentId,
      params.linkedContentTitle,
      params.linkedContentType,
      params.relatedId,
      params.relatedTitle,
      params.relatedType,
    ]
  );

  const creatorState = resolveCreatorState(profileRow);

  if (checking) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={c.primary} size="large" />
        <Text style={styles.loadingText}>Profil yangilanmoqda...</Text>
      </View>
    );
  }

  if (creatorState.approved) {
    return <ReelUploadScreen initialAttachment={initialAttachment} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={c.text} size={22} />
          </Pressable>
        </View>

        <LinearGradient
          colors={
            isDark
              ? ["rgba(82,183,136,0.10)", "rgba(56,189,248,0.05)", "transparent"]
              : ["rgba(82,183,136,0.06)", "rgba(56,189,248,0.04)", "transparent"]
          }
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Sparkles color="#fff" size={28} strokeWidth={2.2} />
          </View>
          <Text style={styles.heroTitle}>Faqat ijodkorlar uchun</Text>
          <Text style={styles.heroSub}>
            Media yuborish uchun avval Ijodkor bo'lishingiz kerak.
          </Text>
        </LinearGradient>

        <View style={styles.stateWrap}>
          {creatorState.pending ? (
            <View style={styles.pendingBox}>
              <Clock3 color="#F4A261" size={24} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stateTitle}>Ijodkor bo'lish so'rovingiz ko'rib chiqilmoqda</Text>
                <Text style={styles.stateDesc}>
                  So'rovingiz yuborilgan. Qayta yuborish tugmasi ko'rsatilmaydi.
                </Text>
              </View>
            </View>
          ) : creatorState.rejected ? (
            <View style={styles.rejectedBox}>
              <RefreshCw color="#F87171" size={24} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stateTitle}>
                  Avvalgi so'rovingiz rad etilgan. Qayta yuborishingiz mumkin
                </Text>
                <Text style={styles.stateDesc}>
                  Ijodkor bo'lish so'rovini yangidan topshirishingiz mumkin.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <CheckCircle2 color="#52B788" size={24} strokeWidth={2.2} />
              <Text style={styles.infoText}>
                Media yuborish uchun avval Ijodkor bo'lishingiz kerak.
              </Text>
            </View>
          )}

          {!creatorState.pending ? (
            <PressableScale onPress={() => router.push("/creator/become")} style={styles.actionBtn}>
              <LinearGradient
                colors={["#52B788", "#2D9B6F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionInner}
              >
                <Sparkles color="#fff" size={16} />
                <Text style={styles.actionText}>Ijodkor bo'lish</Text>
              </LinearGradient>
            </PressableScale>
          ) : null}

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Yopish</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      backgroundColor: c.bg,
    },
    loadingText: { color: c.textDim, fontSize: 14, fontWeight: "600" },
    topBar: {
      paddingHorizontal: 16,
      marginBottom: 8,
      alignItems: "flex-start",
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
    hero: {
      marginHorizontal: 20,
      borderRadius: 24,
      padding: 22,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 12,
    },
    heroIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#52B788",
      shadowColor: "#52B788",
      shadowOpacity: 0.25,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    heroTitle: {
      color: c.text,
      fontSize: 24,
      fontFamily: FONT.serif,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 16,
    },
    heroSub: {
      color: c.textDim,
      fontSize: 13.5,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 10,
      fontWeight: "500",
    },
    stateWrap: {
      marginHorizontal: 20,
      marginTop: 8,
      gap: 12,
    },
    pendingBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: isDark ? "rgba(244,162,97,0.09)" : "rgba(244,162,97,0.07)",
      borderWidth: 1,
      borderColor: "rgba(244,162,97,0.28)",
      borderRadius: 18,
      padding: 16,
    },
    rejectedBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: isDark ? "rgba(248,113,113,0.10)" : "rgba(248,113,113,0.07)",
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.28)",
      borderRadius: 18,
      padding: 16,
    },
    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: isDark ? "rgba(82,183,136,0.08)" : "rgba(82,183,136,0.06)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.22)",
      borderRadius: 18,
      padding: 16,
    },
    stateTitle: { color: c.text, fontSize: 15, fontWeight: "800", lineHeight: 20 },
    stateDesc: { color: c.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 4, fontWeight: "500" },
    infoText: { flex: 1, color: c.text, fontSize: 13.5, fontWeight: "700", lineHeight: 19 },
    actionBtn: { borderRadius: 18, overflow: "hidden" },
    actionInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 56,
      borderRadius: 18,
    },
    actionText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    cancelBtn: { alignItems: "center", paddingVertical: 14 },
    cancelText: { color: c.textMuted, fontSize: 14, fontWeight: "600" },
  });
}
