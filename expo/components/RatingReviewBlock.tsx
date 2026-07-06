import { Image } from "expo-image";
import { router } from "expo-router";
import { Star } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { AppTheme } from "@/constants/colors";
import { PressableScale } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import {
  useContentReview,
  type ContentReview,
  type ReviewContentType,
} from "@/hooks/useContentReview";
import type { VerificationType } from "@/types/profile";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diff / 86400000);
  if (day < 1) return "bugun";
  if (day < 7) return `${day} kun oldin`;
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });
}

function StarRow({
  value,
  size,
  color,
  dim,
  onSelect,
}: {
  value: number;
  size: number;
  color: string;
  dim: string;
  onSelect?: (v: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = (
          <Star
            size={size}
            color={filled ? "#F59E0B" : dim}
            fill={filled ? "#F59E0B" : "transparent"}
            strokeWidth={2}
          />
        );
        return onSelect ? (
          <Pressable key={i} hitSlop={6} onPress={() => onSelect(i)}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}

export default function RatingReviewBlock({
  contentType,
  contentId,
  title,
  author,
  coverUrl,
}: {
  contentType: ReviewContentType;
  contentId: string | null | undefined;
  title?: string | null;
  author?: string | null;
  coverUrl?: string | null;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isAuthenticated } = useAuth();
  const meta = useMemo(() => ({ title, author, coverUrl }), [title, author, coverUrl]);
  const { avgRating, ratingsCount, myReview, reviews, loading, submitting, submit } = useContentReview(
    contentType,
    contentId,
    meta
  );

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment ?? "");
    }
  }, [myReview]);

  const onSubmit = async () => {
    const res = await submit({ rating, comment });
    if (res.needAuth) {
      router.push("/auth");
      return;
    }
    if (res.ok) setEditing(false);
  };

  const showForm = !myReview || editing;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Baho va fikrlar</Text>

      <View style={styles.summaryRow}>
        <Text style={styles.avg}>{avgRating > 0 ? avgRating.toFixed(1) : "—"}</Text>
        <View style={{ gap: 4 }}>
          <StarRow value={avgRating} size={16} color="#F59E0B" dim={c.border} />
          <Text style={styles.countText}>
            {ratingsCount > 0 ? `${ratingsCount} ta baho` : "Hali baho yo'q"}
          </Text>
        </View>
      </View>

      {!isAuthenticated ? (
        <Pressable onPress={() => router.push("/auth")} style={styles.loginPrompt}>
          <Text style={styles.loginPromptText}>Baho berish uchun hisobingizga kiring</Text>
        </Pressable>
      ) : showForm ? (
        <View style={styles.formWrap}>
          <Text style={styles.formLabel}>Sizning bahoyingiz</Text>
          <StarRow value={rating} size={30} color="#F59E0B" dim={c.border} onSelect={setRating} />
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Fikringizni yozing (ixtiyoriy)…"
            placeholderTextColor={c.textMuted}
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <PressableScale
            onPress={rating >= 1 && !submitting ? onSubmit : undefined}
            style={rating >= 1 && !submitting ? styles.submitBtn : [styles.submitBtn, styles.submitBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>{myReview ? "Bahoni yangilash" : "Baholash"}</Text>
            )}
          </PressableScale>
        </View>
      ) : (
        <View style={styles.myReviewWrap}>
          <View style={styles.myReviewTop}>
            <StarRow value={myReview.rating} size={18} color="#F59E0B" dim={c.border} />
            <Pressable onPress={() => setEditing(true)} hitSlop={8}>
              <Text style={styles.editText}>Tahrirlash</Text>
            </Pressable>
          </View>
          {myReview.comment ? <Text style={styles.myReviewText}>{myReview.comment}</Text> : null}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 16 }} />
      ) : (
        <View style={{ marginTop: 6 }}>
          {reviews
            .filter((r) => !myReview || r.id !== myReview.id)
            .map((r) => (
              <ReviewRow key={r.id} review={r} styles={styles} c={c} />
            ))}
        </View>
      )}
    </View>
  );
}

function ReviewRow({
  review,
  styles,
  c,
}: {
  review: ContentReview;
  styles: ReturnType<typeof createStyles>;
  c: AppTheme;
}) {
  const name = review.reviewerName?.trim() || "Foydalanuvchi";
  const badge = (review.reviewerVerification as VerificationType) ?? "none";
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/u/[id]", params: { id: review.userId } })}
      style={styles.reviewRow}
    >
      {review.reviewerAvatarUrl ? (
        <Image source={{ uri: review.reviewerAvatarUrl }} style={styles.reviewAvatar} contentFit="cover" />
      ) : (
        <View style={[styles.reviewAvatar, styles.reviewAvatarPh]}>
          <Text style={styles.reviewAvatarInitial}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.reviewNameRow}>
          <Text style={styles.reviewName} numberOfLines={1}>{name}</Text>
          {badge !== "none" && <VerificationBadge verificationType={badge} size="sm" />}
          <StarRow value={review.rating} size={12} color="#F59E0B" dim={c.border} />
        </View>
        {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
        <Text style={styles.reviewTime}>{relativeTime(review.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 20,
      marginTop: 20,
      padding: 18,
      borderRadius: 22,
      backgroundColor: c.bgCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    heading: { color: c.text, fontSize: 17, fontWeight: "800", marginBottom: 14 },
    summaryRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
    avg: { color: c.text, fontSize: 40, fontWeight: "800", lineHeight: 44 },
    countText: { color: c.textMuted, fontSize: 12.5 },
    loginPrompt: {
      marginTop: 14,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.07)",
      alignItems: "center",
    },
    loginPromptText: { color: c.primary, fontSize: 14, fontWeight: "700" },
    formWrap: { marginTop: 16, gap: 12 },
    formLabel: { color: c.textDim, fontSize: 13, fontWeight: "700" },
    input: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 14,
      minHeight: 72,
      textAlignVertical: "top",
    },
    submitBtn: {
      height: 50,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    myReviewWrap: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    },
    myReviewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    editText: { color: c.primary, fontSize: 13, fontWeight: "700" },
    myReviewText: { color: c.text, fontSize: 14, lineHeight: 20, marginTop: 8 },
    reviewRow: {
      flexDirection: "row",
      gap: 12,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    reviewAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.bgElevated },
    reviewAvatarPh: { alignItems: "center", justifyContent: "center" },
    reviewAvatarInitial: { color: c.primary, fontSize: 15, fontWeight: "800" },
    reviewNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    reviewName: { color: c.text, fontSize: 14, fontWeight: "700" },
    reviewComment: { color: c.textDim, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
    reviewTime: { color: c.textMuted, fontSize: 11.5, marginTop: 5 },
  });
}
