import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import RichBlockReader from "@/components/reader/RichBlockReader";

export default function RichReaderScreen() {
  const params = useLocalSearchParams<{ id: string }>();

  const rawId = params.id;
  const bookId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (__DEV__) console.log("📖 READER SCREEN OPENED");
    if (__DEV__) console.log("📖 READER PARAMS:", params);
    if (__DEV__) console.log("📖 READER BOOK ID:", bookId);

    if (!bookId || bookId === "undefined") {
      console.error("❌ READER ERROR: bookId is missing or invalid", params);
    }
  }, [bookId]);

  return <RichBlockReader bookId={String(bookId ?? "")} />;
}
