import { router } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/colors";
import BookCover, { type BookCoverSize } from "@/components/BookCover";
import { PressableScale } from "@/components/ui";
import { formatUzs } from "@/constants/tariffs";
import { useTheme } from "@/providers/ThemeProvider";
import { openExternalUrl } from "@/utils/safeLinks";
import {
  contentRoute,
  contentTypeLabel,
  formatSaleDateTime,
  type AuthorWork,
} from "@/types/author";

const COVER_ICON: Record<string, React.ComponentProps<typeof BookCover>["placeholderIcon"]> = {
  book: "book-open-variant",
  poem: "feather",
  article: "text-box-outline",
  screenplay: "movie-open-outline",
  monologue: "microphone-outline",
};

/**
 * A card for one of the author's own works (book / poem / article / screenplay).
 * Shows cover, title, content type + price, published state and — when the
 * earnings view provides them — the sold count and total earned so far.
 */
export default function AuthorWorkCard({
  work,
  width = 150,
  showStats = true,
  coverSize = "medium",
  authorName,
  onPress,
}: {
  work: AuthorWork;
  width?: number;
  showStats?: boolean;
  coverSize?: BookCoverSize;
  authorName?: string | null;
  onPress?: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  // `author_works` carries no price, so only show it when it is actually known
  // (a real price or an explicit free flag) — never a misleading "0 so'm".
  const showPrice = work.isFree || work.price > 0;
  const priceLabel = work.isFree ? "Bepul" : formatUzs(work.price);
  const status = work.status.toLowerCase();
  const statusMeta =
    status === "published" || status === "approved" || status === "active"
      ? { label: "Nashr etilgan", bg: c.primary }
      : status === "pending" || status === "review"
        ? { label: "Kutilmoqda", bg: "#D97706" }
        : status === "rejected"
          ? { label: "Rad etilgan", bg: "#DC2626" }
          : { label: "Qoralama", bg: "rgba(17,24,39,0.78)" };
  const createdLabel = formatSaleDateTime(work.publishedAt ?? work.createdAt).split(",")[0];
  const handlePress =
    onPress ??
    (() => {
      if (work.contentType === "monologue") {
        if (work.mediaUrl) {
          void openExternalUrl(work.mediaUrl);
        } else {
          router.push("/(tabs)/reels" as never);
        }
        return;
      }
      router.push(contentRoute(work.contentType, work.id) as never);
    });

  return (
    <PressableScale onPress={handlePress} style={{ width }}>
      <BookCover
        uri={work.coverUrl}
        width={width}
        size={coverSize}
        placeholderIcon={COVER_ICON[work.contentType] ?? "book-open-variant"}
      >
        <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
          <Text style={styles.statusText}>{statusMeta.label}</Text>
        </View>
      </BookCover>

      <Text numberOfLines={2} style={styles.title}>
        {work.title}
      </Text>

      {authorName ? <Text numberOfLines={1} style={styles.authorName}>{authorName}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.type}>{contentTypeLabel(work.contentType)}</Text>
        {showPrice ? (
          <>
            <View style={styles.dot} />
            <Text style={styles.price} numberOfLines={1}>
              {priceLabel}
            </Text>
          </>
        ) : null}
      </View>

      {createdLabel ? <Text style={styles.createdAt}>{createdLabel}</Text> : null}

      {showStats && (work.salesCount > 0 || work.earnedUzs > 0) ? (
        <View style={styles.statsRow}>
          <Text style={styles.statsText} numberOfLines={1}>
            {work.salesCount} sotuv · {formatUzs(work.earnedUzs)}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    statusBadge: {
      position: "absolute",
      top: 8,
      left: 8 + 12,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    statusText: { color: "#fff", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6 },
    title: { color: c.text, fontSize: 13, fontWeight: "800", marginTop: 8, lineHeight: 17 },
    authorName: { color: c.textDim, fontSize: 11, fontWeight: "600", marginTop: 3 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    type: { color: c.primary, fontSize: 11, fontWeight: "700" },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.textMuted },
    price: { color: c.textDim, fontSize: 11, fontWeight: "700", flexShrink: 1 },
    createdAt: { color: c.textMuted, fontSize: 10.5, fontWeight: "600", marginTop: 4 },
    statsRow: {
      marginTop: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(82,183,136,0.08)",
    },
    statsText: { color: c.primary, fontSize: 10.5, fontWeight: "700" },
  });
}
