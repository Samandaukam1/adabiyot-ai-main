import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { FONT } from "@/components/ui";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { useTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/constants/colors";
import type { DisplayBook } from "@/types/database";
import { useHover } from "./useHover";
import WebBookCover from "./WebBookCover";
import { cursorPointer, glassBlur, hoverTransition, softShadow } from "./webStyle";

/**
 * Site-wide search overlay opened from the web header. Filters the already
 * loaded published catalog (title / author) for instant, keyboard-friendly
 * results. ESC or a backdrop tap closes it. Web-only.
 */
export default function WebSearchOverlay({ onClose }: { onClose: () => void }) {
  const { colors: L, isDark } = useTheme();
  const { books } = usePublishedBooks();
  const [query, setQuery] = useState("");

  // ESC closes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return books
      .filter((b) => b.title.toLowerCase().includes(q) || b.authorName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [books, query]);

  return (
    <View
      style={[
        {
          position: "fixed" as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          alignItems: "center",
          paddingTop: 96,
          zIndex: 9999,
        },
        glassBlur,
      ]}
    >
      {/* Backdrop closes */}
      <Pressable style={{ position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

      <View
        style={[
          {
            width: "100%",
            maxWidth: 640,
            marginHorizontal: 24,
            borderRadius: 20,
            backgroundColor: L.bgCard,
            borderWidth: 1,
            borderColor: L.border,
            overflow: "hidden",
          },
          softShadow(true),
        ]}
      >
        {/* Input */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, height: 60, borderBottomWidth: 1, borderBottomColor: L.border }}>
          <Ionicons name="search" size={20} color={L.textDim} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Kitob yoki muallif qidiring…"
            placeholderTextColor={L.textMuted}
            style={[{ flex: 1, color: L.text, fontSize: 16, fontWeight: "600" }, { outlineStyle: "none" } as any]}
            returnKeyType="search"
          />
          <Pressable onPress={onClose} style={[{ padding: 6 }, cursorPointer]}>
            <Text style={{ color: L.textMuted, fontSize: 12, fontWeight: "800", borderWidth: 1, borderColor: L.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              ESC
            </Text>
          </Pressable>
        </View>

        {/* Results */}
        <View style={{ maxHeight: 420 }}>
          {query.trim().length === 0 ? (
            <Hint L={L} icon="book-search-outline" text="Sarlavha yoki muallif nomini yozing" />
          ) : results.length === 0 ? (
            <Hint L={L} icon="magnify-close" text="Hech narsa topilmadi" />
          ) : (
            results.map((book) => (
              <ResultRow
                key={book.id}
                book={book}
                L={L}
                onPress={() => {
                  onClose();
                  router.push({ pathname: "/book/[id]", params: { id: book.id } });
                }}
              />
            ))
          )}
        </View>
        {results.length > 0 ? (
          <Pressable
            onPress={() => {
              onClose();
              router.push("/kitoblar");
            }}
            style={[{ height: 46, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: L.border }, cursorPointer]}
          >
            <Text style={{ color: L.primary, fontSize: 13, fontWeight: "800" }}>Barcha kitoblarni ko'rish →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ResultRow({ book, L, onPress }: { book: DisplayBook; L: AppTheme; onPress: () => void }) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingHorizontal: 18,
          paddingVertical: 11,
          backgroundColor: hovered ? L.soft : "transparent",
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <WebBookCover uri={book.cover} width={42} size="small" placeholderIcon="book" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: L.text, fontSize: 14.5, fontWeight: "700", fontFamily: FONT.serif }}>
          {book.title}
        </Text>
        <Text numberOfLines={1} style={{ color: L.textDim, fontSize: 12.5, marginTop: 2 }}>
          {book.authorName}
        </Text>
      </View>
      <Text style={{ color: book.isFree ? L.primary : L.textMuted, fontSize: 12, fontWeight: "700" }}>
        {book.isFree ? "Bepul" : book.genre}
      </Text>
    </Pressable>
  );
}

function Hint({ L, icon, text }: { L: AppTheme; icon: string; text: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 }}>
      <MaterialCommunityIcons name={icon as any} size={30} color={L.textMuted} />
      <Text style={{ color: L.textMuted, fontSize: 14 }}>{text}</Text>
    </View>
  );
}
