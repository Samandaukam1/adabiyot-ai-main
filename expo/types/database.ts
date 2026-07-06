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
export type SozlabPostType = "thought" | "quote" | "review" | "discussion";
export type SozlabTargetKind = "book" | "poem" | "screenplay" | "other";
export type SozlabPostStatus = "published" | "hidden" | "deleted";

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

export type PoemStatus =
  | BookStatus
  | "pending_review"
  | "needs_revision"
  | "approved";

export interface SupabasePoem {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  cover_url: string | null;
  text?: string | null;
  poem_text?: string | null;
  description: string | null;
  short_description?: string | null;
  price: number | string | null;
  is_free: boolean | null;
  status: PoemStatus | null;
  submission_status?: string | null;
  created_at: string;
  published_at?: string | null;
  audio_url?: string | null;
  file_url?: string | null;
  pdf_url?: string | null;
  content_mode?: string | null;
  cleaned_content?: string | null;
  has_internal_reader?: boolean | null;
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

/**
 * Row from the `mobile_book_audio_files` view/table.
 * One book can have several audio files; the one with `is_primary = true`
 * (or the first available) is used by the player.
 */
export interface MobileBookAudioFile {
  id: string;
  book_id: string;
  title: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  language: string | null;
  narrator_name: string | null;
  audio_type: string | null;
  is_primary: boolean | null;
}

/**
 * Row from the `mobile_book_audio_toc_items` view/table.
 * Each item is a chapter (level 1) or topic (level 2) with manually entered
 * timecodes. `start_time_seconds` is the canonical seek target; the *_text
 * fields hold the human "mm:ss" / "hh:mm:ss" values entered in the admin.
 */
export interface MobileBookAudioTocItem {
  id: string;
  book_id: string;
  audio_file_id?: string | null;
  title: string;
  item_type: string | null;
  level: number | null;
  sort_order: number | null;
  // The mobile_* read view exposes only the *_seconds columns; the base
  // book_audio_toc_items table also has the *_text values. Both are optional
  // so the hook works against either source.
  start_time_text?: string | null;
  start_time_seconds: number | null;
  end_time_text?: string | null;
  end_time_seconds?: number | null;
}

export type SplashIntroHapticType =
  | "selection"
  | "impact_light"
  | "impact_medium"
  | "impact_heavy"
  | "notification_success";
export type SplashIntroHapticsStrength = "soft" | "medium" | "strong" | "max";

export interface SplashIntroHapticCue {
  at_ms: number;
  type: SplashIntroHapticType | string;
}

export interface MobileActiveSplashIntro {
  id: string;
  title: string | null;
  video_url: string | null;
  poster_url: string | null;
  duration_ms: number | string | null;
  show_on_every_open: boolean | string | null;
  show_once_per_session: boolean | string | null;
  show_once_per_day: boolean | string | null;
  skip_enabled: boolean | string | null;
  min_show_ms: number | string | null;
  background_color: string | null;
  audio_enabled: boolean | string | null;
  audio_volume: number | string | null;
  haptics_enabled: boolean | string | null;
  haptics_strength: SplashIntroHapticsStrength | string | null;
  haptics_pattern: SplashIntroHapticCue[] | string | null;
  platform: string | null;
}

export interface MobileArticleBlockRow {
  id: string;
  block_type: string | null;
  sort_order: number | string | null;
  content: string | null;
  content_json: unknown;
  attrs: unknown;
  marks: unknown;
  media_url: string | null;
  media_type: string | null;
  is_paid: boolean | string | null;
}

export interface MobileArticleRichContent {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_url: string | null;
  status: string | null;
  published_at: string | null;
  rich_content: unknown;
  content_html: string | null;
  content_plain: string | null;
  editor_type: string | null;
  editor_version: number | string | null;
  word_count: number | string | null;
  reading_time_minutes: number | string | null;
  blocks: MobileArticleBlockRow[] | unknown[] | null;
}

/**
 * Row from the `mobile_article_read_page` view — the premium A4 longread read
 * page source. Author comes from the admin-assigned `author_user_id` profile
 * (no fake "AdabiyotX muallifi" fallback). Includes cover geometry, optional
 * audio, social counts and the resolved `blocks` array.
 */
export interface MobileArticleReadPage {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_url: string | null;
  cover_width: number | string | null;
  cover_height: number | string | null;
  cover_aspect_ratio: number | string | null;
  cover_format: string | null;
  cover_overlay_enabled: boolean | string | null;
  cover_overlay_opacity: number | string | null;
  audio_url: string | null;
  audio_duration_seconds: number | string | null;
  status: string | null;
  published_at: string | null;
  author_user_id: string | null;
  author_name: string | null;
  author_role: string | null;
  author_avatar_url: string | null;
  author_verification_type: string | null;
  reading_time_minutes: number | string | null;
  word_count: number | string | null;
  comments_count: number | string | null;
  likes_count: number | string | null;
  shares_count: number | string | null;
  rich_content: unknown;
  content_html: string | null;
  content_plain: string | null;
  editor_type: string | null;
  editor_version: number | string | null;
  blocks: MobileArticleBlockRow[] | unknown[] | null;
}

/**
 * Row from the `mobile_home_article_cards` view — A4 article cards that the
 * home screen merges in alongside book cards. `content_type = 'article'` is
 * used for routing so taps always open the article read page.
 */
export interface MobileHomeArticleCard {
  id: string;
  content_type: string;
  card_style: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  cover_width: number | string | null;
  cover_height: number | string | null;
  cover_aspect_ratio: number | string | null;
  cover_format: string | null;
  audio_url: string | null;
  author_user_id: string | null;
  author_name: string | null;
  author_role: string | null;
  author_avatar_url: string | null;
  author_verification_type: string | null;
  published_at: string | null;
  reading_time_minutes: number | string | null;
  comments_count: number | string | null;
  likes_count: number | string | null;
  shares_count: number | string | null;
}

export interface SozlabPostRow {
  id: string;
  created_at: string;
  updated_at?: string | null;
  author_id?: string | null;
  user_id?: string | null;
  display_name?: string | null;
  author_name?: string | null;
  type?: SozlabPostType | string | null;
  post_type?: SozlabPostType | string | null;
  target_kind?: SozlabTargetKind | string | null;
  target_id?: string | null;
  target_title?: string | null;
  target_author?: string | null;
  title?: string | null;
  body?: string | null;
  content?: string | null;
  improved_body?: string | null;
  improved_content?: string | null;
  improvement_model?: string | null;
  image_url?: string | null;
  status?: SozlabPostStatus | string | null;
  likes_count?: number | null;
  comments_count?: number | null;
  metadata?: Record<string, unknown> | null;
  attached_content_id?: string | null;
  attached_content_type?: string | null;
  attached_content_title?: string | null;
  attached_content_cover_url?: string | null;
  attached_content_author?: string | null;
  /** Edit / soft-delete / moderation (mobile_sozlab_posts) */
  full_name?: string | null;
  pen_name?: string | null;
  avatar_url?: string | null;
  provider_full_name?: string | null;
  provider_avatar_url?: string | null;
  verification_type?: string | null;
  /** Author fields exposed by the `mobile_sozlab_posts` view */
  author_pen_name?: string | null;
  author_avatar_url?: string | null;
  author_verification_type?: string | null;
  is_edited?: boolean | null;
  edited_at?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  reports_count?: number | null;
  moderation_status?: string | null;
}

export type SozlabReportReason =
  | "spam"
  | "offensive"
  | "violence"
  | "hate"
  | "adult"
  | "copyright"
  | "false_info"
  | "other";

export const SOZLAB_REPORT_REASONS: { value: SozlabReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "offensive", label: "Haqoratli yoki noo'rin" },
  { value: "violence", label: "Zo'ravonlik yoki xavfli kontent" },
  { value: "hate", label: "Nafrat yoki kamsitish" },
  { value: "adult", label: "Kattalar uchun kontent" },
  { value: "copyright", label: "Mualliflik huquqi" },
  { value: "false_info", label: "Noto'g'ri ma'lumot" },
  { value: "other", label: "Boshqa" },
];

export interface SozlabPostReportRow {
  id: string;
  post_id: string;
  reporter_user_id: string | null;
  reported_user_id: string | null;
  reason: SozlabReportReason | string;
  description: string | null;
  status: string;
  created_at: string;
}

export type SozlabPostInsert =
  | ({
      title: string;
      content: string;
      post_type?: SozlabPostType;
      status?: SozlabPostStatus;
      improved_content?: string | null;
      image_url?: string | null;
    } & Partial<Pick<SozlabPostRow,
      | "id" | "created_at" | "updated_at" | "user_id" | "likes_count" | "comments_count"
      | "attached_content_id" | "attached_content_type" | "attached_content_title"
      | "attached_content_cover_url" | "attached_content_author">>)
  | ({
      target_kind: SozlabTargetKind;
      target_title: string;
      body: string;
      type?: SozlabPostType;
      status?: SozlabPostStatus;
      improved_body?: string | null;
      metadata?: Record<string, unknown>;
    } & Partial<
      Pick<
        SozlabPostRow,
        | "id"
        | "created_at"
        | "updated_at"
        | "author_id"
        | "display_name"
        | "target_id"
        | "target_author"
        | "improvement_model"
        | "likes_count"
        | "comments_count"
      >
    >);

export interface SozlabCommentRow {
  id: string;
  created_at: string;
  post_id: string;
  author_id: string | null;
  display_name: string;
  body: string;
  status: SozlabPostStatus;
}

export type AuthProvider = "google" | "apple" | null;
export type PhoneVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed";

/**
 * Row from the `profiles` table — one per Supabase auth user.
 * Created/updated on first Google or Apple login (see `lib/auth.ts`).
 */
export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  publisher_id: string | null;
  is_active: boolean | null;
  is_banned: boolean | null;
  account_type: string;
  /** Set by the admin panel when a login account is linked to an author. */
  author_id: string | null;
  /** Unique public @handle chosen by the user (stored lowercase, no "@"). */
  username: string | null;
  display_name: string | null;
  pen_name: string | null;
  bio: string | null;
  cover_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  telegram_url: string | null;
  youtube_url: string | null;
  is_creator: boolean;
  /** Optional custom creator badge label, set by the admin on approval. */
  creator_badge: string | null;
  is_adib: boolean;
  is_vip: boolean;
  has_published_work: boolean | null;
  verification_type: string;
  verification_label: string | null;
  creator_status: string;
  adib_status: string | null;
  /** Provider / auth metadata */
  auth_provider: AuthProvider;
  last_login_provider?: AuthProvider;
  last_login_at?: string | null;
  provider_email?: string | null;
  provider_full_name?: string | null;
  google_email: string | null;
  apple_email: string | null;
  provider_avatar_url: string | null;
  /** User-edit guards: provider login must never clobber edited profile UI */
  profile_edited_by_user?: boolean | null;
  display_name_edited?: boolean | null;
  full_name_edited?: boolean | null;
  pen_name_edited?: boolean | null;
  avatar_edited?: boolean | null;
  bio_edited?: boolean | null;
  cover_edited?: boolean | null;
  /** Phone verification (prepared, not active yet) */
  phone: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
  phone_verification_status: PhoneVerificationStatus | string;
  created_at: string;
  updated_at: string | null;
}

/** Fields written when a profile is first created on Google/Apple login. */
export type ProfileInsert = Partial<ProfileRow> & Pick<ProfileRow, "id">;
export type ProfileUpdate = Partial<Omit<ProfileRow, "id" | "created_at">>;

export interface PaymentProductRow {
  id: string;
  product_type?: string | null;
  plan_key?: string | null;
  content_type: string | null;
  content_id: string | null;
  title: string | null;
  amount_uzs: number | string | null;
  is_active: boolean | null;
  allow_single_purchase: boolean | null;
}

export interface Database {
  public: {
    Tables: {
      books: {
        Row: SupabaseBook;
        Insert: Omit<SupabaseBook, "id" | "created_at">;
        Update: Partial<Omit<SupabaseBook, "id" | "created_at">>;
      };
      poems: {
        Row: SupabasePoem;
        Insert: Partial<Omit<SupabasePoem, "id" | "created_at">>;
        Update: Partial<Omit<SupabasePoem, "id" | "created_at">>;
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
      sozlab_posts: {
        Row: SozlabPostRow;
        Insert: SozlabPostInsert;
        Update: Partial<Omit<SozlabPostRow, "id" | "created_at">>;
      };
      sozlab_comments: {
        Row: SozlabCommentRow;
        Insert: Partial<Pick<SozlabCommentRow, "id" | "created_at" | "author_id" | "display_name" | "status">> &
          Pick<SozlabCommentRow, "post_id" | "body">;
        Update: Partial<Omit<SozlabCommentRow, "id" | "created_at" | "post_id">>;
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      payment_products: {
        Row: PaymentProductRow;
        Insert: Partial<Omit<PaymentProductRow, "id">> & Pick<PaymentProductRow, "id">;
        Update: Partial<Omit<PaymentProductRow, "id">>;
      };
    };
    Views: {
      mobile_books: {
        Row: MobileBook;
      };
      mobile_book_audio_files: {
        Row: MobileBookAudioFile;
      };
      mobile_book_audio_toc_items: {
        Row: MobileBookAudioTocItem;
      };
      mobile_active_splash_intro: {
        Row: MobileActiveSplashIntro;
      };
      mobile_article_rich_content: {
        Row: MobileArticleRichContent;
      };
      mobile_article_read_page: {
        Row: MobileArticleReadPage;
      };
      mobile_home_article_cards: {
        Row: MobileHomeArticleCard;
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

function normalizeNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function isSubmissionStatus(value: string | null | undefined): value is SubmissionStatus {
  return (
    value === "draft" ||
    value === "submitted_to_giant" ||
    value === "returned_by_giant" ||
    value === "approved_by_giant" ||
    value === "submitted_to_company" ||
    value === "returned_by_company" ||
    value === "approved_by_company" ||
    value === "published" ||
    value === "rejected" ||
    value === "archived"
  );
}

export function poemToDisplay(poem: SupabasePoem): DisplayBook {
  const price = normalizeNumber(poem.price);
  const content = poem.cleaned_content ?? poem.text ?? poem.poem_text ?? null;

  return {
    id: poem.id,
    title: poem.title || "Nomsiz she'r",
    authorName: poem.author || "Noma'lum muallif",
    publisherName: poem.publisher || "",
    publisherType: null,
    cover: poem.cover_url ?? "",
    genre: "She'r",
    description: poem.short_description ?? poem.description ?? "",
    audioUrl: poem.audio_url ?? null,
    fileUrl: poem.file_url ?? null,
    pdfUrl: poem.pdf_url ?? null,
    price,
    isFree: poem.is_free ?? price === 0,
    status: poem.status === "published" ? "published" : "draft",
    submissionStatus: isSubmissionStatus(poem.submission_status) ? poem.submission_status : null,
    createdAt: poem.published_at ?? poem.created_at,
    source: "supabase",
    hasInternalReader: poem.has_internal_reader ?? !!content,
    contentMode: poem.content_mode ?? "poem",
    cleanedContent: content,
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
      return { label: "AdabiyotX", color: "#2E7D32", bg: "#E8F5E9" };
    case "gigant":
      return { label: "Gigant nashriyot", color: "#1565C0", bg: "#E3F2FD" };
    case "independent":
      return { label: "Mustaqil nashriyot", color: "#6D4C41", bg: "#EFEBE9" };
    default:
      return null;
  }
}
