import { requireNativeViewManager } from "expo-modules-core";
import { NativeModules } from "react-native";
import * as React from "react";

import type { TransparentVideoViewProps } from "./TransparentVideoView.types";

// Check if the native TransparentVideo view is truly registered by Expo.
// requireNativeViewManager never throws — when the module is absent it returns
// React Native's UnimplementedView stub (which renders a red error box in DEV).
// The real registration check is via NativeUnimoduleProxy.viewManagersMetadata.
const _meta = (
  (NativeModules.NativeUnimoduleProxy?.viewManagersMetadata) ?? {}
) as Record<string, unknown>;

export const isTransparentVideoAvailable = !!_meta["TransparentVideo"];

const NativeView = isTransparentVideoAvailable
  ? requireNativeViewManager<TransparentVideoViewProps>("TransparentVideo")
  : null;

export default function TransparentVideoView(props: TransparentVideoViewProps) {
  if (!NativeView) return null;
  return <NativeView {...props} />;
}
