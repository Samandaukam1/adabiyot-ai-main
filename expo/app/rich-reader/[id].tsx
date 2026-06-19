import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import RichBlockReader from "@/components/reader/RichBlockReader";

export default function RichReaderScreen() {
  const params = useLocalSearchParams<{ id: string }>();

  const rawId = params.id;
  const bookId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    console.log("📖 READER SCREEN OPENED");
    console.log("📖 READER PARAMS:", params);
    console.log("📖 READER BOOK ID:", bookId);

    if (!bookId || bookId === "undefined") {
      console.error("❌ READER ERROR: bookId is missing or invalid", params);
    }
  }, [bookId]);

  return <RichBlockReader bookId={String(bookId ?? "")} />;
}
