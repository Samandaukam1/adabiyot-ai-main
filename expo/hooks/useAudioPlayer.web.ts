import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioPlayer(audioUrl: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isScrubbingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new (window as any).Audio(audioUrl) as HTMLAudioElement;
    audioRef.current = audio;
    setLoading(true);
    setError(null);

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };
    audio.ontimeupdate = () => {
      if (!isScrubbingRef.current) setPosition(audio.currentTime);
    };
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => {
      setError("Audioni yuklashda xatolik yuz berdi.");
      setLoading(false);
    };

    audio.play().catch(() => setLoading(false));

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      if (duration > 0 && audio.currentTime >= duration) {
        audio.currentTime = 0;
      }
      await audio.play().catch(() => {});
    }
  }, [playing, duration]);

  const startScrub = useCallback(() => {
    isScrubbingRef.current = true;
  }, []);

  const endScrub = useCallback((ratio: number) => {
    isScrubbingRef.current = false;
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    const newPos = ratio * duration;
    audio.currentTime = newPos;
    setPosition(newPos);
  }, [duration]);

  const seekDelta = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newPos = Math.max(0, Math.min(duration, audio.currentTime + delta));
    audio.currentTime = newPos;
    setPosition(newPos);
  }, [duration]);

  /** Seek to an absolute position (seconds) and start playing from there. */
  const seekTo = useCallback((seconds: number, autoPlay = true) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const target = Math.max(0, duration > 0 ? Math.min(duration, seconds) : seconds);
    audio.currentTime = target;
    setPosition(target);
    if (autoPlay) audio.play().catch(() => {});
  }, [duration]);

  const changeSpeed = useCallback((s: 1 | 1.25 | 1.5 | 2) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }, []);

  return { playing, position, duration, speed, loading, error, togglePlay, startScrub, endScrub, seekDelta, seekTo, changeSpeed };
}
