import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Headphones, Loader, Pause, Play } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FONT, PressableScale } from "@/components/ui";

const PRIMARY = "#2F9E6E";

export interface ArticleAudioTheme {
  paper: string;
  text: string;
  sub: string;
  border: string;
  soft: string;
}

/**
 * Inline narration player for an article ("Maqolaning audio varianti").
 * No autoplay — playback only starts on user tap. Streams from a remote URL
 * via expo-av and shows a progress bar with position / duration labels.
 */
export function ArticleAudioPlayer({
  url,
  durationSeconds,
  theme,
}: {
  url: string;
  durationSeconds?: number | null;
  theme: ArticleAudioTheme;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState((durationSeconds ?? 0) * 1000);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!url || loading) return;

    try {
      setLoading(true);

      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, progressUpdateIntervalMillis: 400 }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setPlaying(status.isPlaying);
          setPositionMs(status.positionMillis ?? 0);
          if (status.durationMillis) setDurationMs(status.durationMillis);
          if (status.didJustFinish) {
            setPlaying(false);
            setPositionMs(0);
            soundRef.current?.setPositionAsync(0).catch(() => {});
          }
        });
        setPlaying(true);
        setLoading(false);
        return;
      }

      if (playing) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }, [loading, playing, url]);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const pct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.iconBubble}>
        <Headphones color={PRIMARY} size={22} />
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>AUDIO VARIANT</Text>
        <Text style={styles.title} numberOfLines={1}>
          Maqolaning audio varianti
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(positionMs)}</Text>
          <Text style={styles.time}>{formatTime(durationMs)}</Text>
        </View>
      </View>
      <PressableScale onPress={toggle} style={styles.playButton}>
        {loading ? (
          <Loader color="#fff" size={20} />
        ) : playing ? (
          <Pause color="#fff" size={20} fill="#fff" />
        ) : (
          <Play color="#fff" size={20} fill="#fff" />
        )}
      </PressableScale>
    </View>
  );
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createStyles(theme: ArticleAudioTheme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.paper,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    iconBubble: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1 },
    label: {
      color: PRIMARY,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.1,
    },
    title: {
      color: theme.text,
      fontFamily: FONT.serif,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 2,
    },
    progressRow: { marginTop: 9 },
    track: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.soft,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 2, backgroundColor: PRIMARY },
    timeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    time: { color: theme.sub, fontSize: 10, fontWeight: "700" },
    playButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
