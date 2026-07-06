import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioPlayer(audioUrl: string | null) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const isScrubbingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    let sound: Audio.Sound | null = null;

    async function loadAudio() {
      try {
        setLoading(true);
        setError(null);

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound: s } = await Audio.Sound.createAsync(
          { uri: audioUrl! },
          { shouldPlay: true, rate: speed, progressUpdateIntervalMillis: 250 }
        );

        sound = s;
        soundRef.current = s;

        s.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (!isScrubbingRef.current) {
            setPosition(status.positionMillis / 1000);
          }
          if (status.durationMillis) setDuration(status.durationMillis / 1000);
          setPlaying(status.isPlaying);
          if (status.didJustFinish) setPlaying(false);
        });

        setPlaying(true);
        setLoading(false);
      } catch {
        setError("Audioni yuklashda xatolik yuz berdi.");
        setLoading(false);
      }
    }

    loadAudio();

    return () => {
      sound?.unloadAsync();
      soundRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    if (playing) {
      await s.pauseAsync();
    } else {
      if (duration > 0 && position >= duration) {
        await s.setPositionAsync(0);
      }
      await s.playAsync();
    }
  }, [playing, position, duration]);

  const startScrub = useCallback(() => {
    isScrubbingRef.current = true;
  }, []);

  const endScrub = useCallback(async (ratio: number) => {
    isScrubbingRef.current = false;
    const s = soundRef.current;
    if (!s || duration === 0) return;
    const newPos = ratio * duration;
    setPosition(newPos);
    await s.setPositionAsync(newPos * 1000);
  }, [duration]);

  const seekDelta = useCallback(async (delta: number) => {
    const s = soundRef.current;
    if (!s) return;
    const newPos = Math.max(0, Math.min(duration, position + delta));
    setPosition(newPos);
    await s.setPositionAsync(newPos * 1000);
  }, [position, duration]);

  /** Seek to an absolute position (seconds) and start playing from there. */
  const seekTo = useCallback(async (seconds: number, autoPlay = true) => {
    const s = soundRef.current;
    if (!s || !Number.isFinite(seconds)) return;
    const target = Math.max(0, duration > 0 ? Math.min(duration, seconds) : seconds);
    setPosition(target);
    try {
      await s.setPositionAsync(target * 1000);
      if (autoPlay) await s.playAsync();
    } catch {
      // Ignore transient seek errors (e.g. not fully loaded yet)
    }
  }, [duration]);

  const changeSpeed = useCallback(async (s: 1 | 1.25 | 1.5 | 2) => {
    setSpeed(s);
    await soundRef.current?.setRateAsync(s, true);
  }, []);

  return { playing, position, duration, speed, loading, error, togglePlay, startScrub, endScrub, seekDelta, seekTo, changeSpeed };
}
