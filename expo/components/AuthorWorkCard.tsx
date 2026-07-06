import { router } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/colors";
import BookCover, { type BookCoverSize } from "@/components/BookCover";
import { PressableScale } from "@/components/ui";
import { formatUzs } from "@/constants/tariffs";
import { useTheme } from "@/providers/ThemeProvider";
import {
  contentRoute,
  contentTypeLabel,
  type AuthorWork,
} from "@/types/author";

const COVER_ICON: Record<string, React.ComponentProps<typeof BookCover>["placeholderIcon"]> = {
  book: "book-open-variant",
  poem: "feather",
  article: "text-box-outline",
  screenplay: "movie-open-outline",
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
  onPress,
}: {
  work: AuthorWork;
  width?: number;
  showStats?: boolean;
  coverSize?: BookCoverSize;
  onPress?: () => void;
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  // `author_works` carries no price, so only show it when it is actually known
  // (a real price or an explicit free flag) — never a misleading "0 so'm".
  const showPrice = work.isFree || work.price > 0;
  const priceLabel = work.isFree ? "Bepul" : formatUzs(work.price);
  const handlePress =
    onPress ??
    (() => router.push(contentRoute(work.contentType, work.id) as never));

  return (
    <PressableScale onPress={handlePress} style={{ width }}>
      <BookCover
        uri={work.coverUrl}
        width={width}
        size={coverSize}
        placeholderIcon={COVER_ICON[work.contentType] ?? "book-open-variant"}
      >
        {!work.isPublished ? (
          <View style={[styles.statusBadge, styles.draftBadge]}>
            <Text style={styles.statusText}>Qoralama</Text>
          </View>
        ) : work.isFree ? (
          <View style={[styles.statusBadge, styles.freeBadge]}>
            <Text style={styles.statusText}>BEPUL</Text>
          </View>
        ) : null}
      </BookCover>

      <Text numberOfLines={2} style={styles.title}>
        {work.title}
      </Text>

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
    freeBadge: { backgroundColor: c.primary },
    draftBadge: { backgroundColor: "rgba(17,24,39,0.72)" },
    statusText: { color: "#fff", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6 },
    title: { color: c.text, fontSize: 13, fontWeight: "800", marginTop: 8, lineHeight: 17 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    type: { color: c.primary, fontSize: 11, fontWeight: "700" },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.textMuted },
    price: { color: c.textDim, fontSize: 11, fontWeight: "700", flexShrink: 1 },
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
