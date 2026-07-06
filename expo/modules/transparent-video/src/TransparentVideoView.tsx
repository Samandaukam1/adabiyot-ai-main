import type { TransparentVideoViewProps } from "./TransparentVideoView.types";

// Non-iOS fallback. The native transparent renderer only exists on iOS; other
// platforms keep using expo-video (Android WebM alpha) or the poster, so this
// component renders nothing and is never mounted off-iOS.
export const isTransparentVideoAvailable = false;

export default function TransparentVideoView(_props: TransparentVideoViewProps) {
  return null;
}
