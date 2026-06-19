import type { Book, ReaderChapter } from "@/mocks/content";
import type { AudioSessionState, ReaderBookmark } from "@/providers/AppProvider";

export type ReaderMode = "curl" | "snap";

export interface ReaderScreenProps {
  book: Book;
  authorName?: string;
  chapters: ReaderChapter[];
  audioDuration: number;
  fontScale: number;
  lineHeight: number;
  onFontScaleChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  saved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
  audio: AudioSessionState;
  onSaveBookmark: (bookmark: ReaderBookmark | null) => void;
  onStartAudio: (bookId: string, duration: number) => void;
  onToggleAudio: () => void;
  onSetAudioPosition: (position: number) => void;
  onOpenAudio: () => void;
  initialPageIndex?: number;
  readerMode?: ReaderMode;
}