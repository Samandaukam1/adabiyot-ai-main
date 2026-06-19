import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bookmark,
  ChevronDown,
  CornerUpLeft,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { getAuthor, getBook, sampleBookContent } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W } = Dimensions.get("window");
const BAR_COUNT = 56;
const SPEEDS: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];

export default function AudioPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const book = useMemo(() => getBook(String(id)) ?? getBook("b2"), [id]);
  const author = getAuthor(book?.authorId ?? "a2");

  const {
    audio,
    startAudio,
    togglePlay,
    seekAudio,
    setSpeed,
    bookmark,
    saveBookmark,
    savedBookIds,
    toggleSaveBook,
  } = useApp();

  const duration = sampleBookContent.audioDuration;
  const bookId = book?.id ?? "b2";

  useEffect(() => {
    if (audio.bookId !== bookId) {
      startAudio(bookId, duration);
    }
  }, [audio.bookId, bookId, duration, startAudio]);

  const progress = audio.duration > 0 ? audio.position / audio.duration : 0;
  const saved = savedBookIds.includes(bookId);

  const currentChapter = useMemo(() => {
    const t = audio.position;
    return (
      sampleBookContent.chapters.find((c) => t >= c.startTime && t < c.endTime) ??
      sampleBookContent.chapters[0]
    );
  }, [audio.position]);

  const [showRestore, setShowRestore] = useState<boolean>(false);
  const lastAutoBookmark = useRef<typeof bookmark>(bookmark);

  const onSeekDelta = useCallback(
    (delta: number) => {
      seekAudio(audio.position + delta);
    },
    [audio.position, seekAudio]
  );

  const onScrub = useCallback(
    (ratio: number) => {
      if (!showRestore && bookmark) {
        lastAutoBookmark.current = bookmark;
        setShowRestore(true);
      }
      seekAudio(ratio * duration);
    },
    [seekAudio, duration, bookmark, showRestore]
  );

  const onRestore = useCallback(() => {
    const saved = lastAutoBookmark.current;
    if (!saved) {
      router.back();
      return;
    }
    const ch = sampleBookContent.chapters[saved.chapterIndex];
    if (ch) seekAudio(ch.startTime);
    setShowRestore(false);
    saveBookmark(saved);
    router.back();
  }, [seekAudio, saveBookmark]);

  const onShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${book?.title ?? "Adabiyot AI"} — ${author?.name ?? "Adabiyot AI"}`,
      });
    } catch {
      // Ignore share cancellations.
    }
  }, [author?.name, book?.title]);

  // waveform
  const bars = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }).map((_, i) => {
        const h = 6 + Math.abs(Math.sin(i * 0.65)) * 30 + (i % 4) * 2;
        return h;
      }),
    []
  );
  const animatedBars = useRef(bars.map((h) => new Animated.Value(h))).current;

  useEffect(() => {
    if (!audio.playing) return;
    const loops = animatedBars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: bars[i] * (0.35 + Math.random() * 0.65),
            duration: 380 + (i % 5) * 80,
            useNativeDriver: false,
          }),
          Animated.timing(v, {
            toValue: bars[i],
            duration: 380 + (i % 7) * 60,
            useNativeDriver: false,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [audio.playing, animatedBars, bars]);

  if (!book) return null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Image
        source={{ uri: book.cover }}
        style={StyleSheet.absoluteFillObject}
        blurRadius={Platform.OS === "web" ? 25 : 80}
      />
      <LinearGradient
        colors={["rgba(245,241,234,0.78)", "rgba(245,241,234,0.94)", "rgba(238,230,216,0.96)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.glowOrb} />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronDown color={palette.text} size={22} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.topLabel}>HOZIR TINGLANMOQDA</Text>
          <Text style={styles.topTitle} numberOfLines={1}>
            {book.title}
          </Text>
        </View>
        <Pressable onPress={onShare} style={styles.iconBtn}>
          <Share2 color={palette.text} size={18} />
        </Pressable>
      </View>

      <View style={styles.coverWrap}>
        <View style={styles.coverHalo} />
        <Image source={{ uri: book.cover }} style={styles.cover} contentFit="contain" />
      </View>

      <View style={styles.meta}>
        <Text style={styles.chapterKicker}>HOZIR \u2014 {currentChapter.title}</Text>
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>{author?.name}</Text>
      </View>

      <View style={styles.waveWrap}>
        {animatedBars.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: v,
                backgroundColor:
                  i / BAR_COUNT < progress ? palette.primary : "rgba(17,17,17,0.10)",
              },
            ]}
          />
        ))}
      </View>

      <Seekbar
        value={progress}
        duration={duration}
        position={audio.position}
        onScrub={onScrub}
      />

      <View style={styles.controls}>
        <Pressable onPress={() => onSeekDelta(-15)} style={styles.sideBtn}>
          <View style={styles.skipInner}>
            <RotateCcw color={palette.text} size={26} />
            <Text style={styles.skipLabel}>15</Text>
          </View>
        </Pressable>
        <PressableScale onPress={togglePlay} style={styles.playBtn}>
          {audio.playing ? (
            <Pause color="#fff" size={30} fill="#fff" />
          ) : (
            <Play color="#fff" size={30} fill="#fff" style={{ marginLeft: 3 }} />
          )}
        </PressableScale>
        <Pressable onPress={() => onSeekDelta(15)} style={styles.sideBtn}>
          <View style={styles.skipInner}>
            <RotateCw color={palette.text} size={26} />
            <Text style={styles.skipLabel}>15</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.speedRow}>
        {SPEEDS.map((s) => {
          const active = audio.speed === s;
          return (
            <Pressable key={s} onPress={() => setSpeed(s)} style={[styles.speedChip, active && styles.speedChipActive]}>
              <Text style={[styles.speedText, active && styles.speedTextActive]}>{s}x</Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => toggleSaveBook(bookId)} style={styles.likeBtn}>
          <Bookmark
            color={saved ? palette.primary : palette.textDim}
            fill={saved ? palette.primary : "transparent"}
            size={18}
          />
        </Pressable>
      </View>

      <View style={[styles.bottomWrap, { paddingBottom: insets.bottom + 18 }]}>
        {showRestore && bookmark ? (
          <PressableScale onPress={onRestore} style={styles.restoreBtn}>
            <CornerUpLeft color={palette.text} size={16} />
            <Text style={styles.restoreText}>Oldingi sahifaga qaytish</Text>
          </PressableScale>
        ) : (
          <Pressable onPress={() => router.back()} style={styles.readBtn}>
            <Text style={styles.readText}>Kitobga qaytish</Text>
          </Pressable>
        )}
      </View>
    </View>
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
  const [width, setWidth] = useState<number>(SCREEN_W - 56);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const r = Math.max(0, Math.min(1, x / width));
        setDragRatio(r);
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const r = Math.max(0, Math.min(1, x / width));
        setDragRatio(r);
      },
      onPanResponderRelease: (e) => {
        const x = e.nativeEvent.locationX;
        const r = Math.max(0, Math.min(1, x / width));
        setDragRatio(null);
        onScrub(r);
      },
      onPanResponderTerminate: () => setDragRatio(null),
    })
  ).current;

  const shown = dragRatio ?? value;

  return (
    <View style={seekStyles.wrap}>
      <View
        style={seekStyles.track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={[seekStyles.fill, { width: `${shown * 100}%` }]} />
        <View style={[seekStyles.thumb, { left: `${shown * 100}%` }]} />
      </View>
      <View style={seekStyles.timeRow}>
        <Text style={seekStyles.time}>{fmt(shown * duration)}</Text>
        <Text style={[seekStyles.time, { color: palette.textMuted }]}>-{fmt(duration - shown * duration)}</Text>
      </View>
    </View>
  );
}

function fmt(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const sec = (total % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

const styles = StyleSheet.create({
  glowOrb: {
    position: "absolute",
    top: -40,
    right: -10,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(46,125,50,0.10)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  topLabel: {
    color: palette.primary,
    fontSize: 9,
    letterSpacing: 2.5,
    fontWeight: "800",
  },
  topTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: SCREEN_W * 0.55,
  },
  coverWrap: { alignItems: "center", marginTop: 18 },
  coverHalo: {
    position: "absolute",
    top: -10,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(46,125,50,0.14)",
    opacity: 0.7,
  },
  cover: {
    width: 200,
    height: 280,
    borderRadius: 16,
    backgroundColor: palette.bgCard,
    shadowColor: "#1A1208",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  meta: {
    alignItems: "center",
    paddingHorizontal: 30,
    marginTop: 20,
  },
  chapterKicker: {
    color: palette.gold,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "700",
  },
  title: {
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  author: {
    color: palette.secondary,
    fontSize: 13,
    marginTop: 4,
  },
  waveWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    height: 52,
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.44)",
    marginHorizontal: 18,
    borderRadius: 22,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    marginTop: 20,
    gap: 34,
  },
  sideBtn: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  skipInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: {
    position: "absolute",
    color: palette.text,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 1,
  },
  playBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOpacity: 0.6,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    marginTop: 24,
    gap: 8,
  },
  speedChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  speedChipActive: {
    backgroundColor: "rgba(46,125,50,0.16)",
    borderColor: palette.primary,
  },
  speedText: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
  speedTextActive: {
    color: palette.primary,
  },
  likeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
  },
  bottomWrap: {
    marginTop: "auto",
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(102,187,106,0.34)",
  },
  restoreText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  readBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  readText: {
    color: palette.textDim,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

const seekStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 28,
    marginTop: 10,
  },
  track: {
    height: 26,
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.primary,
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.bgCard,
    marginLeft: -7,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  time: {
    color: palette.text,
    fontSize: 11,
    fontWeight: "600",
  },
});
