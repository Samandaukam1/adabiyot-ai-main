import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import BookCover, { type BookCoverSize } from "@/components/BookCover";

/**
 * Web book cover. Reuses the app-wide realistic {@link BookCover}
 * ("PremiumBookCover") verbatim — hard bound spine on the left, thin page
 * layers, softly rounded page-edge on the right, and a premium drop shadow — so
 * web cards read like real hardbacks exactly like the mobile app, never a flat
 * "A4" image. Web-only; mobile keeps using {@link BookCover} directly, untouched.
 */
export default function WebBookCover({
  uri,
  width,
  size = "large",
  radius,
  placeholderIcon,
  style,
  children,
}: {
  uri?: string | null;
  width: number;
  size?: BookCoverSize;
  radius?: number;
  placeholderIcon?: React.ComponentProps<typeof BookCover>["placeholderIcon"];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <BookCover
      uri={uri}
      width={width}
      size={size}
      radius={radius}
      placeholderIcon={placeholderIcon}
      style={style}
    >
      {children}
    </BookCover>
  );
}
