import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { FONT } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/providers/ThemeProvider";
import type { DisplayBook } from "@/types/database";
import { useHover } from "./useHover";
import WebBookCover from "./WebBookCover";
import { cursorPointer, hoverTransition } from "./webStyle";

const GRID_GAP = 26;

/** Columns per breakpoint for a 5:7 book grid. */
function columnsFor(breakpoint: string): number {
  if (breakpoint === "large") return 6;
  if (breakpoint === "desktop") return 5;
  return 3; // tablet
}

/** Deterministic card width from the centered container, matching WebContainer. */
export function useGridMetrics() {
  const { width, contentMaxWidth, isTablet, breakpoint } = useResponsive();
  const pad = isTablet ? 24 : 40;
  const columns = columnsFor(breakpoint);
  const available = Math.min(width, contentMaxWidth) - pad * 2;
  const cardWidth = Math.floor((available - GRID_GAP * (columns - 1)) / columns);
  return { columns, cardWidth, gap: GRID_GAP, available };
}

export function WebBookCard({ book, width }: { book: DisplayBook; width: number }) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/book/[id]", params: { id: book.id } })}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        { width },
        cursorPointer,
        hoverTransition,
        hovered ? { transform: [{ translateY: -6 }] } : null,
      ]}
    >
      {/* Realistic hardback cover — same look as the mobile app. */}
      <WebBookCover uri={book.cover} width={width} size="large" placeholderIcon="book-open-page-variant">
        <View
          style={{
            position: "absolute",
            top: 12,
            left: 14,
            backgroundColor: book.isFree ? L.primary : "rgba(0,0,0,0.6)",
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>
            {book.isFree ? "BEPUL" : `${Math.max(1, Math.floor(book.price / 1000))}k`}
          </Text>
        </View>
      </WebBookCover>
      <Text
        numberOfLines={1}
        style={{ color: L.text, fontSize: 14.5, fontWeight: "700", marginTop: 12, fontFamily: FONT.serif }}
      >
        {book.title}
      </Text>
      <Text numberOfLines={1} style={{ color: L.textDim, fontSize: 12.5, marginTop: 3 }}>
        {book.authorName}
      </Text>
      {book.genre ? (
        <Text style={{ color: L.primary, fontSize: 11, fontWeight: "700", marginTop: 6 }}>
          {book.genre}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * A responsive wrap grid of book cards. Column count follows the breakpoint by
 * default; pass `availableWidth` + `columns` to fit a narrower area (e.g. next
 * to a filter sidebar).
 */
export default function WebBookGrid({
  books,
  availableWidth,
  columns,
}: {
  books: DisplayBook[];
  availableWidth?: number;
  columns?: number;
}) {
  const auto = useGridMetrics();
  const cols = columns ?? auto.columns;
  const avail = availableWidth ?? auto.available;
  const cardWidth = Math.floor((avail - auto.gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: auto.gap }}>
      {books.map((book) => (
        <WebBookCard key={book.id} book={book} width={cardWidth} />
      ))}
    </View>
  );
}

/** Loading placeholder grid matching the real card metrics. */
export function WebBookGridSkeleton({ count = 6 }: { count?: number }) {
  const { colors: L } = useTheme();
  const { cardWidth, gap } = useGridMetrics();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: cardWidth }}>
          <View
            style={{
              width: "100%",
              aspectRatio: 5 / 7,
              borderTopRightRadius: 14,
              borderBottomRightRadius: 14,
              backgroundColor: L.surface,
            }}
          />
          <View style={{ height: 13, borderRadius: 6, backgroundColor: L.surface, marginTop: 12, width: "80%" }} />
          <View style={{ height: 11, borderRadius: 6, backgroundColor: L.surface, marginTop: 8, width: "55%" }} />
        </View>
      ))}
    </View>
  );
}
