import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import type { SplashIntroConfig } from "@/lib/splashIntro";
import type {
  SplashIntroHapticCue,
  SplashIntroHapticsStrength,
  SplashIntroHapticType,
} from "@/types/database";
import BrandLogo from "@/components/BrandLogo";

const VIDEO_LOAD_TIMEOUT_MS = 3000;

interface SplashIntroProps {
  config: SplashIntroConfig;
  onFinish: () => void;
  onShown?: () => void;
}

function androidFallbackVibration(
  type: SplashIntroHapticType | string,
  strength: SplashIntroHapticsStrength
): void {
  if (Platform.OS !== "android") return;

  if (strength === "max") {
    switch (type) {
      case "impact_heavy":
        Vibration.vibrate([0, 90, 35, 80]);
        return;
      case "impact_medium":
        Vibration.vibrate(55);
        return;
      case "impact_light":
        Vibration.vibrate(32);
        return;
      case "notification_success":
        Vibration.vibrate([0, 45, 35, 65]);
        return;
      case "selection":
      default:
        Vibration.vibrate(18);
        return;
    }
  }

  if (strength === "strong") {
    switch (type) {
      case "impact_heavy":
        Vibration.vibrate(85);
        return;
      case "impact_medium":
        Vibration.vibrate(50);
        return;
      case "impact_light":
        Vibration.vibrate(28);
        return;
      case "notification_success":
        Vibration.vibrate([0, 35, 35, 50]);
        return;
      case "selection":
      default:
        Vibration.vibrate(16);
        return;
    }
  }

  switch (type) {
    case "impact_heavy":
      Vibration.vibrate(strength === "medium" ? 60 : 30);
      break;
    case "impact_medium":
      Vibration.vibrate(strength === "medium" ? 42 : 24);
      break;
    case "impact_light":
      Vibration.vibrate(strength === "medium" ? 24 : 14);
      break;
    case "notification_success":
      Vibration.vibrate(strength === "medium" ? [0, 30, 35, 40] : [0, 20, 40, 20]);
      break;
    case "selection":
    default:
      Vibration.vibrate(strength === "medium" ? 14 : 8);
      break;
  }
}

async function fireHaptic(
  type: SplashIntroHapticType | string,
  strength: SplashIntroHapticsStrength
): Promise<void> {
  try {
    switch (type) {
      case "impact_light":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "impact_medium":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "impact_heavy":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "notification_success":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "selection":
      default:
        await Haptics.selectionAsync();
        break;
    }
  } catch {
    androidFallbackVibration(type, strength);
    return;
  }

  if (Platform.OS === "android" && strength === "max") {
    androidFallbackVibration(type, strength);
  }
}

export default function SplashIntro({ config, onFinish, onShown }: SplashIntroProps) {
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);
  const [posterVisible, setPosterVisible] = useState(!!config.poster_url);
  const finishedRef = useRef(false);
  const shownRef = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const posterOpacity = useRef(new Animated.Value(config.poster_url ? 1 : 0)).current;

  const player = useVideoPlayer(config.video_url, (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.muted = !config.audio_enabled;
    nextPlayer.volume = config.audio_enabled ? config.audio_volume : 0;
    nextPlayer.allowsExternalPlayback = false;
    nextPlayer.showNowPlayingNotification = false;
    nextPlayer.staysActiveInBackground = false;
    nextPlayer.timeUpdateEventInterval = 0.25;
  });

  const hapticPattern = useMemo(
    () =>
      config.haptics_pattern.filter(
        (cue): cue is SplashIntroHapticCue =>
          Number.isFinite(cue.at_ms) && cue.at_ms <= config.duration_ms
      ),
    [config.duration_ms, config.haptics_pattern]
  );

  const requestFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    try {
      player.pause();
    } catch {
      // no-op: the app should continue even if the native player is already gone.
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [onFinish, opacity, player]);

  const markShown = useCallback(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    onShown?.();
  }, [onShown]);

  const beginPlayback = useCallback(() => {
    if (started || finishedRef.current) return;
    setReady(true);
    setStarted(true);
    markShown();

    try {
      player.muted = !config.audio_enabled;
      player.volume = config.audio_enabled ? config.audio_volume : 0;
      player.currentTime = 0;
      player.play();
    } catch {
      requestFinish();
    }
  }, [config.audio_enabled, config.audio_volume, markShown, player, requestFinish, started]);

  useEffect(() => {
    player.muted = !config.audio_enabled;
    player.volume = config.audio_enabled ? config.audio_volume : 0;
  }, [config.audio_enabled, config.audio_volume, player]);

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "readyToPlay") {
      beginPlayback();
    } else if (status === "error") {
      requestFinish();
    }
  });

  useEventListener(player, "sourceLoad", () => {
    beginPlayback();
  });

  useEventListener(player, "playToEnd", () => {
    requestFinish();
  });

  useEffect(() => {
    if (player.status === "readyToPlay") {
      beginPlayback();
    } else if (player.status === "error") {
      requestFinish();
    }
  }, [beginPlayback, player, requestFinish]);

  useEffect(() => {
    const loadTimeout = setTimeout(() => {
      if (!ready) requestFinish();
    }, VIDEO_LOAD_TIMEOUT_MS);

    return () => clearTimeout(loadTimeout);
  }, [ready, requestFinish]);

  useEffect(() => {
    if (!started) return undefined;

    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(requestFinish, config.duration_ms),
    ];

    if (config.skip_enabled) {
      timers.push(setTimeout(() => setSkipVisible(true), config.min_show_ms));
    }

    if (config.haptics_enabled) {
      hapticPattern.forEach((cue) => {
        timers.push(
          setTimeout(() => {
            fireHaptic(cue.type, config.haptics_strength).catch(() =>
              androidFallbackVibration(cue.type, config.haptics_strength)
            );
          }, cue.at_ms)
        );
      });
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [
    config.duration_ms,
    config.haptics_enabled,
    config.haptics_strength,
    config.min_show_ms,
    config.skip_enabled,
    hapticPattern,
    requestFinish,
    started,
  ]);

  const hidePoster = useCallback(() => {
    if (!posterVisible) return;

    Animated.timing(posterOpacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setPosterVisible(false));
  }, [posterOpacity, posterVisible]);

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.root, { backgroundColor: config.background_color, opacity }]}
    >
      <StatusBar hidden />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        startsPictureInPictureAutomatically={false}
        requiresLinearPlayback
        useExoShutter={false}
        onFirstFrameRender={hidePoster}
      />
      {posterVisible && config.poster_url ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: posterOpacity }]}>
          <Image
            source={{ uri: config.poster_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={160}
          />
        </Animated.View>
      ) : null}
      {!ready ? (
        <View pointerEvents="none" style={styles.brandLoading}>
          <BrandLogo variant="splash" size={92} radius={26} />
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.vignette} />
      {config.skip_enabled && skipVisible ? (
        <Pressable onPress={requestFinish} style={styles.skipButton} hitSlop={12}>
          <Text style={styles.skipText}>O‘tkazib yuborish</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
  brandLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    position: "absolute",
    right: 18,
    bottom: 38,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.46)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.24)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skipText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
