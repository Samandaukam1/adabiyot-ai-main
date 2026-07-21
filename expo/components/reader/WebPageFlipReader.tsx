import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

/**
 * WebPageFlipReader — a dependency-free, DOM-friendly page TURN for the web
 * reader. It reuses the reader's own `pages` + `renderPage` (so pagination,
 * theme, fonts and the intro/cover page are identical to native) and adds a
 * realistic single-leaf flip driven by clicks / arrow keys instead of a pan.
 *
 * The leaf pivots at the LEFT spine via `transformOrigin` + `rotateY` with
 * `backfaceVisibility: "hidden"`, exactly like the native PageFlipEffect, so no
 * two pages' text ever overlap. Built on the RN `Animated` API (works on web),
 * no external library — keeping `expo export --platform web` clean.
 */

const FLIP_DURATION = 520;

export interface WebPageFlipReaderProps {
  pages: any[];
  currentPage: number;
  onPageChange: (index: number) => void;
  renderPage: (info: { item: any; index: number }) => React.ReactElement | null;
  /** Centre tap (not a nav click) — toggles the reader chrome. */
  onTap?: () => void;
  /** Page column width so the leaves match the paginated text width. */
  pageWidth: number;
}

export default function WebPageFlipReader({
  pages,
  currentPage,
  onPageChange,
  renderPage,
  onTap,
  pageWidth,
}: WebPageFlipReaderProps) {
  const total = pages.length;
  const index = Math.max(0, Math.min(currentPage, total - 1));
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  // anim: 0 = rest · → -1 while turning to NEXT · → +1 while folding in PREV.
  const anim = useRef(new Animated.Value(0)).current;
  const [animating, setAnimating] = useState(false);
  const animatingRef = useRef(false);

  const flip = useCallback(
    (dir: 1 | -1) => {
      if (animatingRef.current) return;
      if (dir === 1 && !hasNext) return;
      if (dir === -1 && !hasPrev) return;
      animatingRef.current = true;
      setAnimating(true);
      Animated.timing(anim, {
        toValue: dir === 1 ? -1 : 1,
        duration: FLIP_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) onPageChange(index + dir);
        anim.setValue(0);
        animatingRef.current = false;
        setAnimating(false);
      });
    },
    [anim, hasNext, hasPrev, index, onPageChange]
  );

  // Keyboard: ← / → turn the page (desktop reading).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") flip(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") flip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  // ── Leaf transforms (mirror the native flip) ──────────────────────────────
  const currentRotate = anim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-180deg", "0deg", "0deg"], // turns away on NEXT, flat on PREV
    extrapolate: "clamp",
  });
  const prevRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-180deg", "0deg"], // folds in from the spine on PREV
    extrapolate: "clamp",
  });
  const prevOpacity = anim.interpolate({
    inputRange: [-1, 0, 0.0001, 1],
    outputRange: [0, 0, 1, 1],
  });
  const currentShade = anim.interpolate({
    inputRange: [-1, 0],
    outputRange: [0.55, 0],
    extrapolate: "clamp",
  });
  const prevShade = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0],
    extrapolate: "clamp",
  });

  const renderLeafContent = (i: number) =>
    i >= 0 && i < total ? renderPage({ item: pages[i], index: i }) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.stage, { width: pageWidth }]} collapsable={false}>
        {/* Under-page revealed when the current leaf turns away (NEXT). */}
        {hasNext ? (
          <View style={styles.layer} pointerEvents="none">
            {renderLeafContent(index + 1)}
          </View>
        ) : null}

        {/* CURRENT leaf — the resting page; turns away toward NEXT. */}
        <Animated.View
          style={[
            styles.leaf,
            { transform: [{ perspective: 1800 }, { rotateY: currentRotate }] },
          ]}
        >
          {renderLeafContent(index)}
          <Animated.View style={[styles.shade, { opacity: currentShade }]} pointerEvents="none">
            <LinearGradient
              colors={["rgba(20,15,8,0.05)", "rgba(20,15,8,0.6)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>

        {/* PREVIOUS leaf — folds in over the current page (PREV). */}
        {hasPrev ? (
          <Animated.View
            style={[
              styles.leaf,
              {
                opacity: prevOpacity,
                transform: [{ perspective: 1800 }, { rotateY: prevRotate }],
              },
            ]}
          >
            {renderLeafContent(index - 1)}
            <Animated.View style={[styles.shade, { opacity: prevShade }]} pointerEvents="none">
              <LinearGradient
                colors={["rgba(20,15,8,0.6)", "rgba(20,15,8,0.05)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
        ) : null}

        {/* Edge tap zones flip; the wide centre passes through so the page's own
            handler (chrome toggle + word selection) stays interactive. */}
        <View style={styles.tapRow} pointerEvents="box-none">
          <Pressable style={styles.tapZone} disabled={animating} onPress={() => flip(-1)} />
          <View style={styles.tapZoneCenter} pointerEvents="none" />
          <Pressable style={styles.tapZone} disabled={animating} onPress={() => flip(1)} />
        </View>
      </View>

      {/* Desktop side buttons. */}
      {hasPrev ? (
        <Pressable
          style={[styles.navBtn, styles.navLeft]}
          disabled={animating}
          onPress={() => flip(-1)}
        >
          <ChevronLeft color="#fff" size={26} />
        </Pressable>
      ) : null}
      {hasNext ? (
        <Pressable
          style={[styles.navBtn, styles.navRight]}
          disabled={animating}
          onPress={() => flip(1)}
        >
          <ChevronRight color="#fff" size={26} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  stage: { flex: 1, alignSelf: "center", overflow: "hidden" },
  layer: { ...StyleSheet.absoluteFillObject },
  leaf: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "0% 50%",
    backfaceVisibility: "hidden",
  },
  shade: { ...StyleSheet.absoluteFillObject },
  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  tapZone: { flex: 1 },
  tapZoneCenter: { flex: 3 },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(20,20,20,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  navLeft: { left: 18 },
  navRight: { right: 18 },
});
