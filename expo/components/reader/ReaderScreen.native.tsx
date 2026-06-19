import React from "react";
import StablePremiumReader from "./StablePremiumReader";
import type { ReaderScreenProps } from "./readerTypes";

export default function ReaderScreen(props: ReaderScreenProps) {
  return <StablePremiumReader {...props} />;
}