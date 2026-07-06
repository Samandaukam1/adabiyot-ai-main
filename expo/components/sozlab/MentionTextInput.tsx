import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
  type TextInputSelectionChangeEventData,
  type ViewStyle,
} from "react-native";
import type { AppTheme } from "@/constants/colors";
import { useTheme } from "@/providers/ThemeProvider";
import {
  getActiveMentionToken,
  useMentionSearch,
  type MentionCandidate,
} from "@/hooks/useMentionSearch";
import type { MentionPick } from "@/lib/mentions";

// Single-token handle (no spaces) — matches @handle exactly, never trailing words.
const MENTION_REGEX = /@[\p{L}\p{N}_.'’-]+/gu;

/** Renders body text with @mentions highlighted in the primary colour and,
 *  when onPressMention is provided, tappable (opens the mentioned profile). */
export function MentionText({
  text,
  style,
  linkStyle,
  onPressMention,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  onPressMention?: (handle: string) => void;
}) {
  const { colors: c } = useTheme();
  const parts = useMemo(() => {
    const out: { t: string; mention: boolean }[] = [];
    let last = 0;
    for (const m of text.matchAll(MENTION_REGEX)) {
      const idx = m.index ?? 0;
      if (idx > last) out.push({ t: text.slice(last, idx), mention: false });
      out.push({ t: m[0], mention: true });
      last = idx + m[0].length;
    }
    if (last < text.length) out.push({ t: text.slice(last), mention: false });
    return out;
  }, [text]);

  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.mention ? (
          <Text
            key={i}
            style={[{ color: c.primary, fontWeight: "700" }, linkStyle]}
            onPress={onPressMention ? () => onPressMention(p.t.replace(/^@/, "")) : undefined}
            suppressHighlighting
          >
            {p.t}
          </Text>
        ) : (
          <Text key={i}>{p.t}</Text>
        )
      )}
    </Text>
  );
}

/**
 * Logic for an @mention autocomplete. The parent owns the TextInput and renders
 * <MentionSuggestionList> wherever it wants (in normal flow, above the input) —
 * this avoids the suggestion list being clipped by `overflow:hidden` ancestors
 * and keeps the input layout intact.
 */
export function useMentionAutocomplete(
  value: string,
  onChangeText: (t: string) => void,
  onMentionPicked: (m: MentionPick) => void
) {
  const [caret, setCaret] = useState(0);
  const active = getActiveMentionToken(value, caret);
  const { results, loading } = useMentionSearch(active ? active.token : "");

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setCaret(e.nativeEvent.selection.end ?? 0);
    },
    []
  );

  const pick = useCallback(
    (cand: MentionCandidate) => {
      const start = active ? active.start : value.length;
      const before = value.slice(0, start);
      const after = value.slice(active ? caret : value.length);
      // Insert the space-less handle so it parses + taps reliably (Instagram-style).
      const insert = `@${cand.handle} `;
      onChangeText(`${before}${insert}${after}`);
      onMentionPicked({ id: cand.id, name: cand.name, handle: cand.handle });
      setCaret(start + insert.length);
    },
    [active, value, caret, onChangeText, onMentionPicked]
  );

  return {
    onSelectionChange,
    results,
    loading,
    pick,
    visible: !!active && (loading || results.length > 0),
  };
}

/** Instagram-style mention suggestion list. Rendered in flow above the input. */
export function MentionSuggestionList({
  results,
  loading,
  onPick,
  style,
}: {
  results: MentionCandidate[];
  loading: boolean;
  onPick: (m: MentionCandidate) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <View style={[styles.dropdown, style]}>
      {loading && results.length === 0 ? (
        <ActivityIndicator color={c.primary} style={{ paddingVertical: 14 }} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {results.map((r) => (
            <Pressable key={r.id} onPress={() => onPick(r)} style={styles.row}>
              {r.avatarUrl ? (
                <Image source={{ uri: r.avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]}>
                  <Text style={styles.avatarInitial}>{r.name.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.name}>{r.name}</Text>
                <Text numberOfLines={1} style={styles.handle}>@{r.handle}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(c: AppTheme) {
  return StyleSheet.create({
    dropdown: {
      maxHeight: 200,
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 6,
      marginBottom: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.bgElevated },
    avatarPh: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: c.primary, fontSize: 14, fontWeight: "800" },
    name: { color: c.text, fontSize: 14, fontWeight: "700" },
    handle: { color: c.textMuted, fontSize: 12, marginTop: 1 },
  });
}
