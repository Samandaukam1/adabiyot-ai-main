import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * PageFlipEffect — a PURELY additive, Reanimated-4-native book page-TURN that
 * wraps the existing reader's pages WITHOUT changing any reader logic.
 *
 * Real page turn (not a slide): the turning leaf pivots around the SPINE (a
 * screen edge) via `transformOrigin` + `rotateY`, with `backfaceVisibility:
 * "hidden"` so once it passes edge-on it simply reveals the page underneath —
 * the leaf always covers cleanly, so two pages' text never overlap.
 *
 *   NEXT  (swipe left):  next page sits static behind; the CURRENT leaf pivots
 *                        at the LEFT spine 0° → -180° and vanishes, revealing it.
 *   PREV  (swipe right): current page sits static behind; the PREVIOUS leaf
 *                        pivots at the LEFT spine -180° → 0°, folding back in.
 *
 * Contract (unchanged): the reader owns pagination/progress/theme/fonts. Driven
 * by `currentPage`, reuses `renderPage`, reports settled turns via `onPageChange`.
 * Web / disabled / crash → the original `fallback` (classic FlatList) renders.
 */

const { width: W } = Dimensions.get("window");
const SWIPE_THRESHOLD = 46; // drag past this (px) -> commit the turn
const VELOCITY_THRESHOLD = 460; // ...or fling faster than this
const FLIP_DURATION = 420; // ms - keeps the turn smooth without feeling stuck
const RETURN_DURATION = 220; // ms - snap back quickly when the swipe is too short
const FLIP_EASING = Easing.out(Easing.cubic);

function logStart() {
  if (__DEV__) console.log("[PageFlip] gesture start");
}
function logEnd(translationX: number) {
  if (__DEV__) console.log("[PageFlip] gesture end:", translationX);
}

export interface PageFlipEffectProps {
  pages: any[];
  currentPage: number;
  onPageChange: (index: number) => void;
  renderPage: (info: { item: any; index: number }) => React.ReactElement | null;
  enabled: boolean;
  fallback: React.ReactNode;
  /** Single, clean tap on the page (not a drag) — toggles the reader chrome. */
  onTap?: () => void;
}

// ── Error boundary → classic reader (only on a real crash) ───────────────────
class FlipErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    if (__DEV__) console.log("[PageFlip] fallback to classic reader", error);
  }
  render() {
    if (this.state.crashed) return <>{this.props.fallback}</>;
    return this.props.children;
  }
}

// ── The animated page turn (native only) ─────────────────────────────────────
function SmoothCurl({
  pages,
  currentPage,
  onPageChange,
  renderPage,
  onTap,
}: Omit<PageFlipEffectProps, "enabled" | "fallback">) {
  const tx = useSharedValue(0);

  // Keep the latest onTap in a ref so the (memoised) gesture always calls the
  // current handler without being rebuilt when `selection` etc. changes upstream.
  const onTapRef = React.useRef(onTap);
  onTapRef.current = onTap;
  const fireTap = React.useCallback(() => onTapRef.current?.(), []);

  const total = pages.length;
  const index = Math.max(0, Math.min(currentPage, total - 1));
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  // Mirror the live paging state into shared values so the gesture worklets read
  // the CURRENT page WITHOUT the gesture object being rebuilt on every turn.
  // Rebuilding pan/composed each flip re-attached the GestureDetector, which is
  // exactly what made the tap-to-toggle chrome miss the first tap after a flip.
  const indexSV = useSharedValue(index);
  const hasPrevSV = useSharedValue(hasPrev);
  const hasNextSV = useSharedValue(hasNext);
  indexSV.value = index;
  hasPrevSV.value = hasPrev;
  hasNextSV.value = hasNext;

  // Reader-driven changes (turn commit + TOC / search / resume jumps) → snap the
  // moving leaf back to rest DURING RENDER, so the new page paints flat in the
  // SAME frame the index changes. Doing this in useEffect ran a frame late and
  // caused the "blink" (one frame of the wrong page) when advancing.
  const lastIndexRef = React.useRef(index);
  if (lastIndexRef.current !== index) {
    lastIndexRef.current = index;
    tx.value = 0;
  }

  React.useEffect(() => {
    if (__DEV__) console.log("[PageFlip] using: smooth-curl-wrapper");
    if (__DEV__) console.log("[PageFlip] pages count:", total);
    if (__DEV__) console.log("[PageFlip] current page:", index);
  }, [total, index]);

  const commit = React.useCallback((newIndex: number) => onPageChange(newIndex), [onPageChange]);

  // Built ONCE — every input the worklets need is read from a shared value, so the
  // gesture object keeps a stable identity across page turns (see the SV mirrors
  // above). A stable gesture keeps the composed Tap reliable flip after flip.
  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-24, 24])
        .onStart(() => {
          "worklet";
          runOnJS(logStart)();
        })
        .onUpdate((event) => {
          "worklet";
          let x = event.translationX;
          if ((!hasPrevSV.value && x > 0) || (!hasNextSV.value && x < 0)) x *= 0.16; // resist at ends
          tx.value = x;
        })
        .onEnd((event) => {
          "worklet";
          runOnJS(logEnd)(event.translationX);
          const goNext = tx.value < 0;
          const passed = Math.abs(tx.value) > SWIPE_THRESHOLD || Math.abs(event.velocityX) > VELOCITY_THRESHOLD;
          const canGo = goNext ? hasNextSV.value : hasPrevSV.value;

          if (passed && canGo) {
            const target = goNext ? -W : W;
            const newIndex = goNext ? indexSV.value + 1 : indexSV.value - 1;
            tx.value = withTiming(target, { duration: FLIP_DURATION, easing: FLIP_EASING }, (finished) => {
              if (finished) runOnJS(commit)(newIndex);
            });
          } else {
            tx.value = withTiming(0, { duration: RETURN_DURATION, easing: FLIP_EASING });
          }
        }),
    [hasPrevSV, hasNextSV, indexSV, commit, tx]
  );

  // A real tap (quick, no meaningful drag) toggles the reader chrome. Making this
  // a gesture — rather than an inner <Pressable> — means it lives in the SAME
  // gesture system as the pan, so a page turn never accidentally fires it and a
  // clean tap is always recognised, even after many flips.
  const tap = React.useMemo(
    () =>
      Gesture.Tap()
        // Forgiving on purpose: a "reveal the controls" tap while holding a phone
        // one-handed is often slower and looser than a strict 260ms·12px, and a
        // missed toggle feels broken. The pan still wins any real drag (it
        // activates at 8px and is Exclusive), so this can never eat a swipe.
        .maxDuration(600)
        .maxDistance(24)
        // The finger drifting off the leaf mid-tap must not silently cancel it.
        .shouldCancelWhenOutside(false)
        .onEnd((_event, success) => {
          "worklet";
          if (success) runOnJS(fireTap)();
        }),
    [fireTap]
  );

  // Exclusive → the pan wins when the finger drags (a page turn); the tap only
  // fires when the pan never activated. They can never both run for one touch.
  const composed = React.useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  // CURRENT leaf — pivots at the LEFT spine 0° → -180° while swiping to NEXT.
  // Hidden (opacity 0) while swiping to PREV so the prev leaf owns the screen.
  const currentLeafStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(tx.value, [-W, 0], [-180, 0], Extrapolation.CLAMP);
    return {
      opacity: tx.value > 0 ? 0 : 1,
      transform: [{ perspective: 1600 }, { rotateY: `${rotateY}deg` }],
    };
  });
  // Shading on the current leaf — darkens toward the outer edge as it lifts.
  const currentShadeStyle = useAnimatedStyle(() => ({
    opacity: tx.value < 0 ? interpolate(-tx.value, [0, W], [0, 0.55], Extrapolation.CLAMP) : 0,
  }));

  // PREVIOUS leaf — folds in from the LEFT spine -180° → 0° while swiping to PREV.
  const prevLeafStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(tx.value, [0, W], [-180, 0], Extrapolation.CLAMP);
    return {
      opacity: tx.value > 0 ? 1 : 0,
      transform: [{ perspective: 1600 }, { rotateY: `${rotateY}deg` }],
    };
  });
  const prevShadeStyle = useAnimatedStyle(() => ({
    opacity: tx.value > 0 ? interpolate(tx.value, [0, W], [0.55, 0], Extrapolation.CLAMP) : 0,
  }));

  // Static under-pages (fully opaque so nothing bleeds through).
  const nextUnderStyle = useAnimatedStyle(() => ({ opacity: tx.value < -0.5 ? 1 : 0 }));
  const currentUnderStyle = useAnimatedStyle(() => ({ opacity: tx.value > 0.5 ? 1 : 0 }));

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.root} collapsable={false}>
        {/* Under-pages — revealed by the turning leaf */}
        {hasNext ? (
          <Animated.View style={[styles.layer, nextUnderStyle]} pointerEvents="none">
            {renderPage({ item: pages[index + 1], index: index + 1 })}
          </Animated.View>
        ) : null}
        {hasPrev ? (
          <Animated.View style={[styles.layer, currentUnderStyle]} pointerEvents="none">
            {renderPage({ item: pages[index], index })}
          </Animated.View>
        ) : null}

        {/* PREVIOUS leaf folding in (swipe right) */}
        {hasPrev ? (
          <Animated.View style={[styles.leaf, prevLeafStyle]}>
            {renderPage({ item: pages[index - 1], index: index - 1 })}
            <Animated.View style={[styles.shade, prevShadeStyle]} pointerEvents="none">
              <LinearGradient
                colors={["rgba(20,15,8,0.6)", "rgba(20,15,8,0.05)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
        ) : null}

        {/* CURRENT leaf turning away (swipe left) — also the resting page */}
        <Animated.View style={[styles.leaf, currentLeafStyle]}>
          {renderPage({ item: pages[index], index })}
          <Animated.View style={[styles.shade, currentShadeStyle]} pointerEvents="none">
            <LinearGradient
              colors={["rgba(20,15,8,0.05)", "rgba(20,15,8,0.6)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default function PageFlipEffect(props: PageFlipEffectProps) {
  const { enabled, fallback } = props;

  if (__DEV__) console.log("[PageFlip] enabled:", enabled, "| platform:", Platform.OS, "| pages count:", props.pages.length);

  if (!enabled || Platform.OS === "web" || props.pages.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <FlipErrorBoundary fallback={fallback}>
      <SmoothCurl
        pages={props.pages}
        currentPage={props.currentPage}
        onPageChange={props.onPageChange}
        renderPage={props.renderPage}
        onTap={props.onTap}
      />
    </FlipErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  layer: { ...StyleSheet.absoluteFillObject },
  // Turning leaves pivot at the left spine; backface hidden → clean reveal.
  leaf: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "0% 50%",
    backfaceVisibility: "hidden",
  },
  shade: { ...StyleSheet.absoluteFillObject },
});
