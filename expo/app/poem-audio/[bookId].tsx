import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bookmark,
  ChevronDown,
  Eye,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { palette } from "@/constants/colors";
import { getBook } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W } = Dimensions.get("window");
const SPEEDS: Array<1 | 1.25 | 1.5 | 2> = [1, 1.25, 1.5, 2];

function readParam(value: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatCompactMetric(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return value.toString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function PoemAudioPlayer() {
  const params = useLocalSearchParams<{
    bookId: string;
    kind?: string;
    itemId?: string;
    title?: string;
    artist?: string;
    artwork?: string;
    durationSeconds?: string;
    views?: string;
    poemTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { savedBookIds, toggleSaveBook } = useApp();

  const bookId = readParam(params.bookId, "b2");
  const book = getBook(bookId);
  const kind = readParam(params.kind, "monologue");
  const title = readParam(params.title, book?.title ?? "Audio");
  const artist = readParam(params.artist, "Muallif ijrosi");
  const artwork = readParam(params.artwork, book?.cover ?? "");
  const poemTitle = readParam(params.poemTitle, book?.title ?? "She'r");
  const duration = Number.parseInt(readParam(params.durationSeconds, "180"), 10) || 180;
  const views = Number.parseInt(readParam(params.views, "0"), 10) || 0;

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [position, setPosition] = useState(0);

  const saved = book ? savedBookIds.includes(book.id) : false;
  const progress = duration > 0 ? position / duration : 0;
  const roleLabel = kind === "song" ? "QO'SHIQ" : "MONOLOG";

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setPosition((current) => {
        const next = Math.min(duration, current + 0.2 * speed);
        if (next >= duration) {
          setPlaying(false);
        }
        return next;
      });
    }, 200);
    return () => clearInterval(timer);
  }, [playing, speed, duration]);

  const onSeekDelta = useCallback(
    (delta: number) => setPosition((current) => clamp(current + delta, 0, duration)),
    [duration]
  );

  const onScrub = useCallback(
    (ratio: number) => setPosition(clamp(ratio, 0, 1) * duration),
    [duration]
  );

  const onShare = useCallback(() => {
    Share.share({
      message: `${title} — ${artist}\nShe'r: ${poemTitle}`,
      title,
    }).catch(() => {});
  }, [artist, poemTitle, title]);

  const onSave = useCallback(() => {
    if (book) {
      toggleSaveBook(book.id);
    }
  }, [book, toggleSaveBook]);

  return (
    <Screen>
      <LinearGradient
        colors={["#FBF8F2", palette.bg, "#EEE7DA"]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}> 
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronDown color={palette.text} size={22} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.topKicker}>{roleLabel}</Text>
          <Text style={styles.topTitle} numberOfLines={1}>
            {poemTitle}
          </Text>
        </View>
        <View style={styles.iconBtnGhost} />
      </View>

      <View style={styles.heroSection}>
        <View style={styles.artShell}>
          <View style={styles.artGlow} />
          <Image source={{ uri: artwork }} style={styles.artwork} contentFit="cover" />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.artist}>{artist}</Text>
          <Text style={styles.poemName}>She'r: {poemTitle}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillLabel}>Davomiyligi</Text>
            <Text style={styles.metaPillValue}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Eye color={palette.primary} size={14} />
            <Text style={styles.metaPillValue}>{formatCompactMetric(views)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.playerCard}>
        <Seekbar value={progress} position={position} duration={duration} onScrub={onScrub} />

        <View style={styles.controlsRow}>
          <Pressable onPress={() => onSeekDelta(-15)} style={styles.sideButton}>
            <RotateCcw color={palette.text} size={23} />
            <Text style={styles.sideButtonText}>15</Text>
          </Pressable>

          <PressableScale onPress={() => setPlaying((current) => !current)} style={styles.playButton}>
            {playing ? (
              <Pause color="#fff" size={28} fill="#fff" />
            ) : (
              <Play color="#fff" size={28} fill="#fff" style={{ marginLeft: 3 }} />
            )}
          </PressableScale>

          <Pressable onPress={() => onSeekDelta(15)} style={styles.sideButton}>
            <RotateCw color={palette.text} size={23} />
            <Text style={styles.sideButtonText}>15</Text>
          </Pressable>
        </View>

        <View style={styles.speedRow}>
          {SPEEDS.map((itemSpeed) => {
            const active = speed === itemSpeed;
            return (
              <Pressable
                key={itemSpeed}
                onPress={() => setSpeed(itemSpeed)}
                style={active ? [styles.speedChip, styles.speedChipActive] : styles.speedChip}
              >
                <Text style={active ? [styles.speedText, styles.speedTextActive] : styles.speedText}>
                  {itemSpeed}x
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <PressableScale onPress={onShare} style={styles.actionButton}>
          <View style={styles.actionIconWrap}>
            <Share2 color={palette.primary} size={18} />
          </View>
          <Text style={styles.actionLabel}>Ulashish</Text>
        </PressableScale>

        <PressableScale onPress={onSave} style={saved ? [styles.actionButton, styles.actionButtonSaved] : styles.actionButton}>
          <View style={saved ? [styles.actionIconWrap, styles.actionIconWrapSaved] : styles.actionIconWrap}>
            <Bookmark color={saved ? "#fff" : palette.primary} fill={saved ? "#fff" : "transparent"} size={18} />
          </View>
          <Text style={saved ? [styles.actionLabel, styles.actionLabelSaved] : styles.actionLabel}>
            {saved ? "Saqlangan" : "Saqlab qo'yish"}
          </Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

function Seekbar({
  value,
  duration,
  position,
  onScrub,
}: {
  value: number;
  duration: number;
  position: number;
  onScrub: (ratio: number) => void;
}) {
  const [width, setWidth] = useState<number>(SCREEN_W - 72);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const ratio = clamp(event.nativeEvent.locationX / width, 0, 1);
        setDragRatio(ratio);
      },
      onPanResponderMove: (event) => {
        const ratio = clamp(event.nativeEvent.locationX / width, 0, 1);
        setDragRatio(ratio);
      },
      onPanResponderRelease: (event) => {
        const ratio = clamp(event.nativeEvent.locationX / width, 0, 1);
        setDragRatio(null);
        onScrub(ratio);
      },
      onPanResponderTerminate: () => setDragRatio(null),
    })
  ).current;

  const shown = dragRatio ?? value;

  return (
    <View style={seekStyles.wrap}>
      <View
        style={seekStyles.track}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={[seekStyles.fill, { width: `${shown * 100}%` }]} />
        <View style={[seekStyles.thumb, { left: `${shown * 100}%` }]} />
      </View>
      <View style={seekStyles.timeRow}>
        <Text style={seekStyles.time}>{formatDuration(position)}</Text>
        <Text style={seekStyles.time}>{formatDuration(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnGhost: {
    width: 42,
    height: 42,
  },
  topCopy: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginHorizontal: 14,
  },
  topKicker: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  topTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  heroSection: {
    marginTop: 18,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  artShell: {
    width: SCREEN_W * 0.64,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  artGlow: {
    position: "absolute",
    width: "82%",
    height: "82%",
    borderRadius: 999,
    backgroundColor: "rgba(46,125,50,0.14)",
    transform: [{ scale: 1.15 }],
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  titleBlock: {
    alignItems: "center",
    maxWidth: 320,
  },
  title: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: FONT.serif,
    textAlign: "center",
  },
  artist: {
    color: palette.primary,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  poemName: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metaPill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.86)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  metaPillLabel: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: "500",
  },
  metaPillValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  playerCard: {
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  sideButton: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  sideButtonText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  playButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  speedRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  speedChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.bg,
  },
  speedChipActive: {
    backgroundColor: palette.primary,
  },
  speedText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
  },
  speedTextActive: {
    color: "#fff",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  actionButtonSaved: {
    backgroundColor: palette.primary,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,125,50,0.10)",
  },
  actionIconWrapSaved: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  actionLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  actionLabelSaved: {
    color: "#fff",
  },
});

const seekStyles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.08)",
    overflow: "visible",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  thumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: palette.primary,
    marginLeft: -9,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  time: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
});