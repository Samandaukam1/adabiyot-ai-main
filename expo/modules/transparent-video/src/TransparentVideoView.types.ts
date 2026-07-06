import type { ViewProps } from "react-native";

export type TransparentVideoViewProps = {
  /**
   * Remote URL of a video whose alpha channel should be composited
   * transparently. iOS expects HEVC-with-alpha (.mov). Transparent pixels
   * reveal whatever is rendered behind this view.
   */
  source?: string;
} & ViewProps;
