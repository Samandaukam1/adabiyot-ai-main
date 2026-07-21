import React from "react";
import { LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import VendorPageFlipper from "@/components/reader/vendor/react-native-page-flipper";

/**
 * GitHubPageCurlEffect — adapter around the vendored, Reanimated-4-patched
 * `chris24elias/react-native-page-flipper` (see components/reader/vendor/…).
 *
 * Same contract as PageFlipEffect (drop-in): the reader owns pagination/progress;
 * we're driven by `currentPage`, reuse `renderPage`, and report settled turns via
 * `onPageChange`. On web / disabled / any crash → the original `fallback` renders.
 */

const PageFlipper = VendorPageFlipper as unknown as React.ComponentType<any>;

export interface GitHubPageCurlEffectProps {
  pages: any[];
  currentPage: number;
  onPageChange: (index: number) => void;
  renderPage: (info: { item: any; index: number }) => React.ReactElement | null;
  enabled: boolean;
  fallback: React.ReactNode;
  /** Single page tap (not a drag) — toggles reader top/bottom chrome. */
  onTap?: () => void;
}

// ── Error boundary → classic reader (only on a real crash) ───────────────────
class CurlErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    if (__DEV__) console.log("[PageFlip] react-native-page-flipper patch failed", error);
  }
  render() {
    if (this.state.crashed) return <>{this.props.fallback}</>;
    return this.props.children;
  }
}

type FlipperInstance = { goToPage: (index: number) => void } | null;

function CurlInner({
  pages,
  currentPage,
  onPageChange,
  renderPage,
  onTap,
}: Omit<GitHubPageCurlEffectProps, "enabled" | "fallback">) {
  const flipperRef = React.useRef<FlipperInstance>(null);
  const reportedIndexRef = React.useRef<number>(currentPage);
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    if (__DEV__) console.log("[PageFlip] using: chris24elias-page-flipper-reanimated4-patch");
    if (__DEV__) console.log("[PageFlip] pages count:", pages.length);
    if (__DEV__) console.log("[PageFlip] current page:", currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  // The flipper wants string `data`; we hand it stable index strings and map
  // back to the reader's own renderPage.
  const data = React.useMemo(() => pages.map((_, index) => String(index)), [pages]);

  const handleRenderPage = React.useCallback(
    (idxString: string) => {
      const index = Number(idxString);
      const item = pages[index];
      if (item === undefined) return <View style={{ flex: 1 }} />;
      return renderPage({ item, index }) ?? <View style={{ flex: 1 }} />;
    },
    [pages, renderPage]
  );

  const handleFlipped = React.useCallback(
    (index: number) => {
      reportedIndexRef.current = index;
      onPageChange(index);
    },
    [onPageChange]
  );

  // Keep the flipper in sync when the reader jumps (TOC / search / resume).
  React.useEffect(() => {
    if (currentPage !== reportedIndexRef.current) {
      reportedIndexRef.current = currentPage;
      flipperRef.current?.goToPage(currentPage);
    }
  }, [currentPage]);

  const onLayout = React.useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height }
    );
  }, []);

  return (
    <View style={{ flex: 1 }} onLayout={onLayout} collapsable={false}>
      {size && data.length > 0 ? (
        <PageFlipper
          ref={flipperRef}
          data={data}
          renderPage={handleRenderPage}
          portrait
          singleImageMode={true}
          pressable={false}
          pageSize={{ width: size.width, height: size.height }}
          contentContainerStyle={styles.container}
          onFlippedEnd={handleFlipped}
          onPageTap={onTap}
          onInitialized={() => {
            if (currentPage > 0) flipperRef.current?.goToPage(currentPage);
          }}
        />
      ) : null}
    </View>
  );
}

export default function GitHubPageCurlEffect(props: GitHubPageCurlEffectProps) {
  const { enabled, fallback } = props;

  if (__DEV__) console.log("[PageFlip] enabled:", enabled, "| platform:", Platform.OS, "| pages count:", props.pages.length);

  if (!enabled || Platform.OS === "web" || props.pages.length === 0 || !PageFlipper) {
    return <>{fallback}</>;
  }

  return (
    <CurlErrorBoundary fallback={fallback}>
      <CurlInner
        pages={props.pages}
        currentPage={props.currentPage}
        onPageChange={props.onPageChange}
        renderPage={props.renderPage}
        onTap={props.onTap}
      />
    </CurlErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "transparent" },
});
