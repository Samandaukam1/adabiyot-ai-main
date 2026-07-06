import { useFocusEffect } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";

export const ENABLE_APP_ANIMATIONS = true;

type ReplayKey = number | string;

const AnimationReplayContext = createContext<ReplayKey>(0);

const DEFAULT_SPRING = {
  damping: 16,
  stiffness: 190,
  mass: 0.85,
};

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion || !ENABLE_APP_ANIMATIONS;
}

function useFocusReplaySignal() {
  const [signal, setSignal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setSignal((value) => value + 1);
      return undefined;
    }, [])
  );

  return signal;
}

function useAnimationReplaySignal() {
  const focusSignal = useFocusReplaySignal();
  const parentSignal = useContext(AnimationReplayContext);
  return `${parentSignal}:${focusSignal}`;
}

export function AnimatedPressable({
  children,
  onPress,
  style,
  pressedScale = 0.97,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  disabled?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const pressTo = (value: number) => {
    if (reduceMotion || disabled) return;
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      ...DEFAULT_SPRING,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => pressTo(pressedScale)}
      onPressOut={() => pressTo(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function FadeSlideIn({
  children,
  delay = 0,
  duration = 460,
  distance = 20,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const replaySignal = useAnimationReplaySignal();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress, reduceMotion, replaySignal]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function SlideHorizontal({
  children,
  delay = 0,
  distance,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const replaySignal = useAnimationReplaySignal();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduceMotion, replaySignal]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function SlideFromLeft(props: Omit<React.ComponentProps<typeof SlideHorizontal>, "distance">) {
  return <SlideHorizontal {...props} distance={-40} />;
}

export function SlideFromRight(props: Omit<React.ComponentProps<typeof SlideHorizontal>, "distance">) {
  return <SlideHorizontal {...props} distance={40} />;
}

export function StaggeredCard({
  children,
  index,
  style,
  baseDelay = 80,
  maxDelay = 520,
}: {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
  baseDelay?: number;
  maxDelay?: number;
}) {
  const reduceMotion = useReduceMotion();
  const replaySignal = useAnimationReplaySignal();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const delay = Math.min(index * baseDelay, maxDelay);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 430,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduceMotion, replaySignal]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function ScreenTransitionWrapper({
  children,
  type = "up",
  style,
  replayKey = 0,
}: {
  children: React.ReactNode;
  type?: "up" | "right" | "scale";
  style?: StyleProp<ViewStyle>;
  replayKey?: ReplayKey;
}) {
  const reduceMotion = useReduceMotion();
  const animationSignal = useAnimationReplaySignal();
  const replaySignal = `${animationSignal}:${replayKey}`;
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: type === "right" ? 430 : 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion, replaySignal, type]);

  const transform =
    type === "right"
      ? [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [34, 0],
            }),
          },
        ]
      : type === "scale"
      ? [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, 1],
            }),
          },
        ]
      : [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ];

  return (
    <AnimationReplayContext.Provider value={replaySignal}>
      <Animated.View style={[{ flex: 1, opacity: progress, transform }, style]}>
        {children}
      </Animated.View>
    </AnimationReplayContext.Provider>
  );
}

export type TypingTextProps = {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  loop?: boolean;
  active?: boolean;
  style?: StyleProp<TextStyle>;
};

export function TypingText({
  phrases,
  typingSpeed = 48,
  deletingSpeed = 28,
  pauseDuration = 1200,
  loop = true,
  active = true,
  style,
}: TypingTextProps) {
  const reduceMotion = useReduceMotion();
  const replaySignal = useAnimationReplaySignal();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const currentPhrase = phrases[phraseIndex] ?? "";

  useEffect(() => {
    if (!active || reduceMotion || phrases.length === 0) return;
    setPhraseIndex(0);
    setCharIndex(0);
    setDeleting(false);
  }, [active, phrases.length, reduceMotion, replaySignal]);

  useEffect(() => {
    if (!active || reduceMotion || phrases.length === 0) {
      setCharIndex(phrases[0]?.length ?? 0);
      return;
    }

    const doneTyping = !deleting && charIndex >= currentPhrase.length;
    const doneDeleting = deleting && charIndex <= 0;
    const delay = doneTyping ? pauseDuration : deleting ? deletingSpeed : typingSpeed;

    const timer = setTimeout(() => {
      if (doneTyping) {
        if (loop || phraseIndex < phrases.length - 1) setDeleting(true);
        return;
      }

      if (doneDeleting) {
        setDeleting(false);
        setPhraseIndex((idx) => (idx + 1) % phrases.length);
        return;
      }

      setCharIndex((idx) => idx + (deleting ? -1 : 1));
    }, delay);

    return () => clearTimeout(timer);
  }, [
    active,
    charIndex,
    currentPhrase.length,
    deleting,
    deletingSpeed,
    loop,
    pauseDuration,
    phraseIndex,
    phrases,
    reduceMotion,
    typingSpeed,
  ]);

  return <Text style={style}>{currentPhrase.slice(0, charIndex)}</Text>;
}
