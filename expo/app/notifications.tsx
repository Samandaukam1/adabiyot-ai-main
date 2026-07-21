import { Image } from "expo-image";
import { router } from "expo-router";
import {
  AtSign,
  Award,
  Bell,
  ChevronLeft,
  MessageCircle,
  Sparkles,
  Star,
  UserPlus,
  Wallet,
} from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { PressableScale } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import { openContentPreview } from "@/lib/contentNavigation";
import { openExternalUrl } from "@/utils/safeLinks";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
} from "@/hooks/useNotifications";
import type { VerificationType } from "@/types/profile";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daqiqa oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} kun oldin`;
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });
}

/** Creator/payout notifications render as a "AdabiyotX" system message. */
function isCreatorNotification(type: NotificationType): boolean {
  return (
    type === "creator_application_submitted" ||
    type === "creator_application_approved" ||
    type === "author_payout_paid"
  );
}

function iconFor(type: NotificationType, c: AppTheme) {
  switch (type) {
    case "mention":
      return <AtSign color={c.primary} size={15} />;
    case "comment_reply":
      return <MessageCircle color={c.primary} size={15} />;
    case "new_follower":
      return <UserPlus color={c.primary} size={15} />;
    case "rating":
      return <Star color="#F59E0B" size={15} />;
    case "new_content":
      return <Sparkles color={c.primary} size={15} />;
    case "marathon_report":
      return <Award color={c.primary} size={15} />;
    case "creator_application_submitted":
      return <Sparkles color="#38BDF8" size={15} />;
    case "creator_application_approved":
      return <Award color="#F59E0B" size={15} />;
    case "author_payout_paid":
      return <Wallet color="#F59E0B" size={15} />;
    default:
      return <Bell color={c.primary} size={15} />;
  }
}

/** A marathon report (or any notification) may carry a PDF link in metadata. */
function reportPdfUrl(n: AppNotification): string | null {
  const meta = n.metadata;
  if (!meta) return null;
  const candidate = meta.pdf_url ?? meta.report_url ?? meta.report_pdf_url ?? meta.url;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function navigateTo(n: AppNotification) {
  // Marathon report PDFs (delivered via metadata) open in the browser safely;
  // a bad/malicious link is ignored by openExternalUrl rather than crashing.
  const pdf = reportPdfUrl(n);
  if (pdf) {
    void openExternalUrl(pdf);
    return;
  }

  switch (n.type) {
    case "author_payout_paid":
      router.push("/muallif/daromadlar");
      return;
    case "creator_application_submitted":
      router.push("/creator/become");
      return;
    case "creator_application_approved":
      router.push("/(tabs)/profile");
      return;
    case "mention":
    case "comment_reply":
      if (n.targetPostId) {
        router.push({
          pathname: "/(tabs)/sozlab",
          params: { openPostId: n.targetPostId, focusCommentId: n.targetCommentId ?? "" },
        });
      } else {
        router.push("/(tabs)/sozlab");
      }
      return;
    case "new_content":
      if (n.targetPostId) {
        router.push({ pathname: "/(tabs)/sozlab", params: { openPostId: n.targetPostId } });
      } else if (n.contentId) {
        openContentPreview(n.contentType, n.contentId, { title: n.body });
      } else {
        router.push("/(tabs)/sozlab");
      }
      return;
    case "new_follower":
      if (n.actorUserId) router.push({ pathname: "/u/[id]", params: { id: n.actorUserId } });
      return;
    default:
      return; // system → no-op
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isAuthenticated } = useAuth();
  const { items, loading, unreadCount, markRead, markAllRead } = useNotifications();

  const onPressItem = (n: AppNotification) => {
    if (!n.isRead) markRead(n.id);
    navigateTo(n);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.title}>Bildirishnomalar</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={styles.markAll}>Hammasini o'qilgan qilish</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {!isAuthenticated ? (
        <View style={styles.empty}>
          <Bell color={c.textMuted} size={34} />
          <Text style={styles.emptyText}>
            Bildirishnomalarni ko'rish uchun hisobingizga kiring.
          </Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Bell color={c.textMuted} size={34} />
          <Text style={styles.emptyText}>Hozircha bildirishnomalar yo‘q</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {items.map((n) => {
            const system = isCreatorNotification(n.type);
            const name = system ? "AdabiyotX" : n.actorName?.trim() || "AdabiyotX";
            // Payout notifications keep a readable title even when the server
            // wrote none — tapping them opens Muallif daromadlari.
            const title =
              n.title ??
              (n.type === "author_payout_paid" ? "Muallif daromadi to'landi" : null);
            const avatarUrl = system ? null : n.actorAvatarUrl;
            const badge = system
              ? ("none" as VerificationType)
              : ((n.actorVerification as VerificationType) ?? "none");
            return (
              <PressableScale
                key={n.id}
                onPress={() => onPressItem(n)}
                style={n.isRead ? styles.row : [styles.row, styles.rowUnread]}
              >
                <View style={styles.avatarWrap}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPh]}>
                      <Text style={styles.avatarInitial}>{name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.badgeDot}>{iconFor(n.type, c)}</View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    {badge !== "none" && <VerificationBadge verificationType={badge} size="sm" />}
                  </View>
                  {title ? <Text style={styles.notifTitle}>{title}</Text> : null}
                  {n.body ? (
                    <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
                  ) : null}
                  <Text style={styles.time}>{relativeTime(n.createdAt)}</Text>
                </View>
                {!n.isRead ? <View style={styles.unreadDot} /> : null}
              </PressableScale>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    title: { flex: 1, color: c.text, fontSize: 18, fontWeight: "800" },
    markAll: { color: c.primary, fontSize: 12.5, fontWeight: "700" },
    empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40, gap: 14 },
    emptyText: { color: c.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 },
    row: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowUnread: { backgroundColor: isDark ? "rgba(82,183,136,0.07)" : "rgba(82,183,136,0.06)" },
    avatarWrap: { width: 46, height: 46 },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.bgElevated },
    avatarPh: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: c.primary, fontSize: 18, fontWeight: "800" },
    badgeDot: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.bgCard,
      borderWidth: 1.5,
      borderColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    name: { color: c.text, fontSize: 14.5, fontWeight: "700", flexShrink: 1 },
    notifTitle: { color: c.text, fontSize: 13.5, fontWeight: "600", marginTop: 2 },
    body: { color: c.textDim, fontSize: 13, lineHeight: 18, marginTop: 2 },
    time: { color: c.textMuted, fontSize: 11.5, marginTop: 5 },
    unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary, marginTop: 6 },
  });
}
