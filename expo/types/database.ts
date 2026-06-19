export type BookStatus =
  | "draft"
  | "submitted_to_giant"
  | "returned_by_giant"
  | "approved_by_giant"
  | "submitted_to_company"
  | "returned_by_company"
  | "approved_by_company"
  | "published"
  | "rejected"
  | "archived";

export type SubmissionStatus =
  | "draft"
  | "submitted_to_giant"
  | "returned_by_giant"
  | "approved_by_giant"
  | "submitted_to_company"
  | "returned_by_company"
  | "approved_by_company"
  | "published"
  | "rejected"
  | "archived";

export type PublisherType = "adabiyot_ai" | "gigant" | "independent" | null;

/** Raw row from the `books` table — used as primary mobile query source */
export interface SupabaseBook {
  id: string;
  title: string;
  author: string;
  publisher: string | null;
  publisher_type: PublisherType;
  genre: string | null;
  description: string | null;
  cover_url: string | null;
  file_url: string | null;
  pdf_url: string | null;
  audio_url: string | null;
  price: number;
  is_free: boolean;
  status: BookStatus;
  submission_status: SubmissionStatus | null;
  created_at: string;
  published_at: string | null;
  has_internal_reader: boolean | null;
  content_mode: string | null;
  raw_content: string | null;
  cleaned_content: string | null;
  content_version: number | null;
  toc_generated: boolean | null;
}

/**
 * Row from the `mobile_books` view.
 * Only contains status='published' AND submission_status IN ('approved_by_company','published').
 * Includes publisher_type for the publisher badge.
 */
export interface MobileBook {
  id: string;
  title: string;
  author: string;
  publisher: string | null;
  publisher_type: PublisherType;
  genre: string | null;
  description: string | null;
  cover_url: string | null;
  file_url: string | null;
  pdf_url: string | null;
  audio_url: string | null;
  price: number;
  is_free: boolean;
  status: BookStatus;
  submission_status: SubmissionStatus | null;
  created_at: string;
  published_at: string | null;
  has_internal_reader: boolean | null;
  content_mode: string | null;
  raw_content: string | null;
  cleaned_content: string | null;
  content_version: number | null;
  toc_generated: boolean | null;
}

export type BlockType = "chapter" | "topic" | "paragraph" | "image" | "quote" | "note";

export interface BookContentBlock {
  id: string;
  book_id: string;
  block_type: BlockType;
  sort_order: number;
  anchor_id: string | null;
  title: string | null;
  content: string | null;
  media_url: string | null;
  media_caption: string | null;
  media_alt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BookTocItem {
  id: string;
  book_id: string;
  level: number;
  title: string;
  anchor_id: string;
  block_id: string | null;
  sort_order: number;
}

export interface Database {
  public: {
    Tables: {
      books: {
        Row: SupabaseBook;
        Insert: Omit<SupabaseBook, "id" | "created_at">;
        Update: Partial<Omit<SupabaseBook, "id" | "created_at">>;
      };
      book_content_blocks: {
        Row: BookContentBlock;
        Insert: Omit<BookContentBlock, "id">;
        Update: Partial<Omit<BookContentBlock, "id">>;
      };
      book_toc_items: {
        Row: BookTocItem;
        Insert: Omit<BookTocItem, "id">;
        Update: Partial<Omit<BookTocItem, "id">>;
      };
    };
    Views: {
      mobile_books: {
        Row: MobileBook;
      };
    };
  };
}

export interface DisplayBook {
  id: string;
  title: string;
  authorName: string;
  publisherName: string;
  publisherType: PublisherType;
  cover: string;
  genre: string;
  description: string;
  audioUrl: string | null;
  fileUrl: string | null;
  pdfUrl: string | null;
  price: number;
  isFree: boolean;
  status: BookStatus;
  submissionStatus: SubmissionStatus | null;
  createdAt: string;
  source: "supabase" | "mock";
  hasInternalReader: boolean;
  contentMode: string | null;
  cleanedContent: string | null;
}

export function mobileBookToDisplay(mb: MobileBook): DisplayBook {
  return {
    id: mb.id,
    title: mb.title,
    authorName: mb.author,
    publisherName: mb.publisher ?? "",
    publisherType: mb.publisher_type ?? null,
    cover: mb.cover_url ?? "",
    genre: mb.genre ?? "Roman",
    description: mb.description ?? "",
    audioUrl: mb.audio_url,
    fileUrl: mb.file_url,
    pdfUrl: mb.pdf_url ?? null,
    price: mb.price,
    isFree: mb.is_free,
    status: mb.status,
    submissionStatus: mb.submission_status ?? null,
    createdAt: mb.created_at,
    source: "supabase",
    hasInternalReader: mb.has_internal_reader ?? false,
    contentMode: mb.content_mode ?? null,
    cleanedContent: mb.cleaned_content ?? null,
  };
}

/** @deprecated Use mobileBookToDisplay with mobile_books view instead */
export function supabaseBookToDisplay(sb: SupabaseBook): DisplayBook {
  return {
    id: sb.id,
    title: sb.title,
    authorName: sb.author,
    publisherName: sb.publisher ?? "",
    publisherType: null,
    cover: sb.cover_url ?? "",
    genre: sb.genre ?? "Roman",
    description: sb.description ?? "",
    audioUrl: sb.audio_url,
    fileUrl: sb.file_url,
    pdfUrl: null,
    price: sb.price,
    hasInternalReader: false,
    contentMode: null,
    cleanedContent: null,
    isFree: sb.is_free,
    status: sb.status,
    submissionStatus: sb.submission_status,
    createdAt: sb.created_at,
    source: "supabase",
  };
}

export function publisherTypeLabel(
  type: PublisherType
): { label: string; color: string; bg: string } | null {
  switch (type) {
    case "adabiyot_ai":
      return { label: "Adabiyot AI Kompaniyasi", color: "#2E7D32", bg: "#E8F5E9" };
    case "gigant":
      return { label: "Gigant nashriyot", color: "#1565C0", bg: "#E3F2FD" };
    case "independent":
      return { label: "Mustaqil nashriyot", color: "#6D4C41", bg: "#EFEBE9" };
    default:
      return null;
  }
}
