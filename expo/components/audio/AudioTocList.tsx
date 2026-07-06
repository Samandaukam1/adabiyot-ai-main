import { Play } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { formatTimecode } from "@/lib/media";
import type { AudioTocItem } from "@/hooks/useBookAudio";

interface AudioTocListProps {
  items: AudioTocItem[];
  /** Currently playing item id, or null. */
  activeId: string | null;
  onSelect: (item: AudioTocItem) => void;
  c: AppTheme;
  isDark?: boolean;
}

/**
 * Audio table of contents — chapters (level 1) and topics (level 2, indented).
 * Tapping an item asks the player to seek to its timecode. The active item is
 * highlighted and labelled "Eshitilmoqda". Raw %%% / ^^^ markers never appear
 * (titles are sanitized upstream in useBookAudio).
 */
export default function AudioTocList({ items, activeId, onSelect, c, isDark }: AudioTocListProps) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const active = item.id === activeId;
        const isTopic = item.level >= 2;
        const seekable = item.startSeconds != null;
        const timeLabel = item.startLabel ?? (seekable ? formatTimecode(item.startSeconds) : null);

        return (
          <PressableScale
            key={item.id}
            onPress={seekable ? () => onSelect(item) : undefined}
            style={[
              styles.row,
              ...(isTopic ? [styles.rowTopic] : []),
              {
                backgroundColor: active
                  ? (isDark ? "rgba(82,183,136,0.16)" : "rgba(46,125,50,0.10)")
                  : "transparent",
                borderColor: active ? c.primary : c.border,
              },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: active ? c.primary : c.soft,
                  borderColor: active ? c.primary : c.border,
                },
              ]}
            >
              <Play
                color={active ? "#FFFFFF" : c.primary}
                fill={active ? "#FFFFFF" : "transparent"}
                size={isTopic ? 12 : 14}
              />
            </View>

            <View style={styles.textWrap}>
              <Text
                style={[
                  isTopic ? styles.topicTitle : styles.chapterTitle,
                  { color: active ? c.primary : isTopic ? c.textDim : c.text },
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {active ? (
                <Text style={[styles.nowPlaying, { color: c.primary }]}>Eshitilmoqda</Text>
              ) : null}
            </View>

            <Text style={[styles.time, { color: active ? c.primary : c.textMuted }]}>
              {timeLabel ?? "—"}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowTopic: {
    marginLeft: 22,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  textWrap: { flex: 1 },
  chapterTitle: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  topicTitle: { fontSize: 13, fontWeight: "500" },
  nowPlaying: { fontSize: 11, fontWeight: "700", marginTop: 2, letterSpacing: 0.2 },
  time: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
