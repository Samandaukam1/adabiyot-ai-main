import type {
  Article,
  ArticleBlock as LegacyArticleBlock,
  ArticleCategory,
} from "@/mocks/content";
import { supabase } from "@/lib/supabase";
import { resolveProfileAvatarUrl } from "@/lib/media";
import type {
  MobileArticleReadPage,
  MobileArticleRichContent,
  MobileHomeArticleCard,
} from "@/types/database";
import type { VerificationType } from "@/types/profile";

export type ArticleRenderSource = "blocks" | "rich_content" | "html" | "legacy" | "empty";
export type ArticleSource = "supabase" | "mock";

export type RichArticleBlockType =
  | "paragraph"
  | "heading"
  | "subheading"
  | "image"
  | "gallery"
  | "video"
  | "quote"
  | "audio"
  | "file"
  | "important_note"
  | "list"
  | "ordered_list"
  | "unordered_list"
  | "table"
  | "callout"
  | "divider"
  | "link"
  | "paid_content"
  | "spacer"
  | "unknown";

export type ArticleInlineMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "color"; value: string }
  | { type: "highlight"; value: string }
  | { type: "link"; href: string }
  | { type: "fontSize"; value: number }
  | { type: "fontFamily"; value: string };

export interface RichTextSegment {
  text: string;
  marks?: ArticleInlineMark[];
}

export interface RichArticleMedia {
  url: string;
  caption?: string;
  alt?: string;
  thumbnailUrl?: string;
}

export interface RichArticleBlock {
  id: string;
  type: RichArticleBlockType;
  originalType?: string;
  text?: string;
  title?: string;
  caption?: string;
  alt?: string;
  level?: number;
  segments?: RichTextSegment[];
  items?: RichTextSegment[][];
  headers?: RichTextSegment[][];
  rows?: RichTextSegment[][][];
  mediaUrl?: string;
  mediaType?: string;
  /** "youtube" | "vimeo" | "url" for external video embeds. */
  provider?: string;
  thumbnailUrl?: string;
  url?: string;
  images?: RichArticleMedia[];
  fileName?: string;
  fileSize?: string;
  fileFormat?: string;
  duration?: string;
  isPaid?: boolean;
  tone?: string;
  height?: number;
}

export interface DisplayArticle {
  id: string;
  slug?: string | null;
  title: string;
  author: string;
  authorRole: string;
  category: ArticleCategory;
  cover: string;
  description: string;
  previewSnippet: string;
  readingTime: string;
  publishedAt: string;
  price: number;
  reads: number;
  popularity: number;
  usefulness: number;
  usageTerms: { label: string; value: string }[];
  blocks: RichArticleBlock[];
  contentSource: ArticleRenderSource;
  source: ArticleSource;
  requiresPurchase: boolean;
  /** Admin-assigned author presentation. `hasAuthor` gates the author row so
   *  no fake "AdabiyotX muallifi" text is ever shown. */
  hasAuthor: boolean;
  authorAvatarUrl: string | null;
  authorVerification: VerificationType;
  /** Optional narration of the article ("Maqolaning audio varianti"). */
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  /** A4 cover geometry + overlay tuning from the admin. */
  coverAspectRatio: number;
  coverFormat: string;
  coverOverlayEnabled: boolean;
  coverOverlayOpacity: number;
  /** Social counts surfaced in the action row. */
  readingMinutes: number;
  commentsCount: number;
  likesCount: number;
  sharesCount: number;
}

/** Maps the raw DB verification value (either app-style `creator_blue` or the
 *  shorter profile values `creator`/`adib`/`vip`/`publisher`) to a badge type. */
export function mapAuthorVerification(raw: string | null | undefined): VerificationType {
  switch ((raw ?? "").toLowerCase()) {
    case "creator_blue":
    case "creator":
      return "creator_blue";
    case "adib_green":
    case "adib":
      return "adib_green";
    case "creator_adib_gold":
    case "creator_adib":
      return "creator_adib_gold";
    case "vip_yellow":
    case "vip":
      return "vip_yellow";
    case "publisher_black":
    case "publisher":
      return "publisher_black";
    case "company_black":
    case "company":
      return "company_black";
    default:
      return "none";
  }
}

const DEFAULT_A4_ASPECT = 0.707;

const DEFAULT_ARTICLE_COVER =
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1400";

const DEFAULT_USAGE_TERMS = [
  { label: "Shaxsiy foydalanish", value: "Ruxsat etiladi" },
  { label: "Iqtibos bilan foydalanish", value: "Manba ko'rsatilsa mumkin" },
  { label: "Qayta nashr", value: "Muallif yoki tahririyat roziligi bilan" },
];

const ARTICLE_CATEGORIES: ArticleCategory[] = [
  "Tarix",
  "Texnologiya",
  "Huquq",
  "Amaliy qo'llanma",
  "Tahlil",
  "Jamiyat",
  "Media",
  "Boshqa",
];

export function mobileArticleToDisplay(row: MobileArticleRichContent): DisplayArticle {
  const resolved = resolveMobileArticleBlocks(row);
  const plainPreview = firstNonEmptyString(
    row.description,
    row.content_plain,
    textFromBlocks(resolved.blocks)
  );
  const readingMinutes = normalizeNumber(row.reading_time_minutes);
  const estimatedMinutes = readingMinutes > 0 ? readingMinutes : estimateReadingMinutes(row.word_count, plainPreview);

  return {
    id: row.id,
    slug: row.slug,
    title: safeText(row.title, "Nomsiz maqola"),
    // This legacy view has no admin-assigned author, so the author row is
    // hidden on the read page (never show "AdabiyotX muallifi").
    author: "",
    authorRole: "",
    category: inferCategory(row),
    cover: firstNonEmptyString(row.cover_url, DEFAULT_ARTICLE_COVER),
    description: truncateText(plainPreview, 260),
    previewSnippet: truncateText(plainPreview, 220),
    readingTime: `${estimatedMinutes} daqiqa`,
    publishedAt: row.published_at ?? "",
    price: 0,
    reads: 0,
    popularity: 0,
    usefulness: 0,
    usageTerms: DEFAULT_USAGE_TERMS,
    blocks: resolved.blocks,
    contentSource: resolved.source,
    source: "supabase",
    requiresPurchase: false,
    hasAuthor: false,
    authorAvatarUrl: null,
    authorVerification: "none",
    audioUrl: null,
    audioDurationSeconds: null,
    coverAspectRatio: DEFAULT_A4_ASPECT,
    coverFormat: "a4_portrait",
    coverOverlayEnabled: true,
    coverOverlayOpacity: 0.42,
    readingMinutes: estimatedMinutes,
    commentsCount: 0,
    likesCount: 0,
    sharesCount: 0,
  };
}

export function mobileReadPageToDisplay(row: MobileArticleReadPage): DisplayArticle {
  const resolved = resolveMobileArticleBlocks(row as unknown as MobileArticleRichContent);
  const plainPreview = firstNonEmptyString(
    row.description,
    row.content_plain,
    textFromBlocks(resolved.blocks)
  );
  const readingMinutes = normalizeNumber(row.reading_time_minutes);
  const estimatedMinutes = readingMinutes > 0 ? readingMinutes : estimateReadingMinutes(row.word_count, plainPreview);
  const authorName = firstNonEmptyString(row.author_name);
  const aspect = normalizeNumber(row.cover_aspect_ratio);
  const audioUrl = firstNonEmptyString(row.audio_url) || null;
  const audioDuration = normalizeNumber(row.audio_duration_seconds);
  const overlayOpacity = normalizeNumber(row.cover_overlay_opacity);

  return {
    id: row.id,
    slug: row.slug,
    title: safeText(row.title, "Nomsiz maqola"),
    author: authorName,
    authorRole: firstNonEmptyString(row.author_role),
    category: inferCategory(row as unknown as MobileArticleRichContent),
    cover: firstNonEmptyString(row.cover_url, DEFAULT_ARTICLE_COVER),
    description: truncateText(plainPreview, 280),
    previewSnippet: truncateText(plainPreview, 220),
    readingTime: `${estimatedMinutes} daqiqa`,
    publishedAt: row.published_at ?? "",
    price: 0,
    reads: 0,
    popularity: 0,
    usefulness: 0,
    usageTerms: DEFAULT_USAGE_TERMS,
    blocks: resolved.blocks,
    contentSource: resolved.source,
    source: "supabase",
    requiresPurchase: false,
    hasAuthor: !!authorName,
    authorAvatarUrl: resolveProfileAvatarUrl(row.author_avatar_url),
    authorVerification: mapAuthorVerification(row.author_verification_type),
    audioUrl,
    audioDurationSeconds: audioDuration > 0 ? audioDuration : null,
    coverAspectRatio: aspect > 0 ? aspect : DEFAULT_A4_ASPECT,
    coverFormat: firstNonEmptyString(row.cover_format) || "a4_portrait",
    coverOverlayEnabled: row.cover_overlay_enabled !== false && row.cover_overlay_enabled !== "false",
    coverOverlayOpacity: overlayOpacity > 0 ? clampNumber(overlayOpacity, 0, 1, 0.42) : 0.42,
    readingMinutes: estimatedMinutes,
    commentsCount: normalizeNumber(row.comments_count),
    likesCount: normalizeNumber(row.likes_count),
    sharesCount: normalizeNumber(row.shares_count),
  };
}

export interface HomeArticleCard {
  id: string;
  title: string;
  description: string;
  cover: string;
  coverAspectRatio: number;
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string | null;
  authorVerification: VerificationType;
  readingTime: string;
  hasAudio: boolean;
  publishedAt: string;
}

export function mobileHomeCardToDisplay(row: MobileHomeArticleCard): HomeArticleCard {
  const readingMinutes = normalizeNumber(row.reading_time_minutes);
  const aspect = normalizeNumber(row.cover_aspect_ratio);
  return {
    id: row.id,
    title: safeText(row.title, "Nomsiz maqola"),
    description: truncateText(firstNonEmptyString(row.description), 140),
    cover: firstNonEmptyString(row.cover_url, DEFAULT_ARTICLE_COVER),
    coverAspectRatio: aspect > 0 ? aspect : DEFAULT_A4_ASPECT,
    authorName: firstNonEmptyString(row.author_name),
    authorRole: firstNonEmptyString(row.author_role),
    authorAvatarUrl: resolveProfileAvatarUrl(row.author_avatar_url),
    authorVerification: mapAuthorVerification(row.author_verification_type),
    readingTime: `${readingMinutes > 0 ? readingMinutes : 1} daqiqa`,
    hasAudio: !!firstNonEmptyString(row.audio_url),
    publishedAt: row.published_at ?? "",
  };
}

export function legacyArticleToDisplay(article: Article): DisplayArticle {
  return {
    ...article,
    slug: null,
    blocks: article.blocks.map(normalizeLegacyBlock),
    contentSource: "legacy",
    source: "mock",
    requiresPurchase: true,
    hasAuthor: !!article.author,
    authorAvatarUrl: null,
    authorVerification: "none",
    audioUrl: null,
    audioDurationSeconds: null,
    coverAspectRatio: DEFAULT_A4_ASPECT,
    coverFormat: "a4_portrait",
    coverOverlayEnabled: true,
    coverOverlayOpacity: 0.42,
    readingMinutes: readingMinutesFromLabel(article.readingTime),
    commentsCount: 0,
    likesCount: 0,
    sharesCount: 0,
  };
}

export function mergeArticles(primary: DisplayArticle[], fallback: DisplayArticle[]): DisplayArticle[] {
  const seen = new Set(primary.map((article) => article.id));
  return [...primary, ...fallback.filter((article) => !seen.has(article.id))];
}

function resolveMobileArticleBlocks(row: MobileArticleRichContent): {
  blocks: RichArticleBlock[];
  source: ArticleRenderSource;
} {
  if (Array.isArray(row.blocks) && row.blocks.length > 0) {
    return {
      blocks: row.blocks.map((block, index) => normalizeRawBlock(block, index)).filter(Boolean),
      source: "blocks",
    };
  }

  const richBlocks = normalizeRichContent(row.rich_content);
  if (richBlocks.length > 0) {
    return { blocks: richBlocks, source: "rich_content" };
  }

  const htmlBlocks = htmlToRichBlocks(row.content_html);
  if (htmlBlocks.length > 0) {
    return { blocks: htmlBlocks, source: "html" };
  }

  const plainBlocks = plainTextToBlocks(row.content_plain);
  if (plainBlocks.length > 0) {
    return { blocks: plainBlocks, source: "legacy" };
  }

  return { blocks: [], source: "empty" };
}

/**
 * Reshapes one `article_blocks` row into the loose shape {@link normalizeRawBlock}
 * understands (it reads `content_json`/`data` for block data and `text`/`media_url`
 * for inline content), so admin blocks stored in a `content` json/text column and
 * `image_url` map through correctly. Backward compatible: content as a string,
 * `content.text`, `content.body`, or a nested doc all resolve.
 */
function shapeArticleBlockRow(row: Record<string, unknown>): Record<string, unknown> {
  const shaped: Record<string, unknown> = { ...row };
  const content = row.content;
  if (!shaped.type) shaped.type = row.block_type ?? row.kind;

  if (typeof content === "string") {
    shaped.text = content;
    shaped.content_json = { text: content };
  } else if (content && typeof content === "object") {
    shaped.content_json = content;
  }

  const c = content && typeof content === "object" ? (content as Record<string, unknown>) : {};
  const img =
    row.image_url ??
    row.media_url ??
    row.url ??
    c.url ??
    c.image_url ??
    c.src ??
    c.file_url;
  if (img && !shaped.media_url) shaped.media_url = img;
  return shaped;
}

/**
 * Fetches an article's admin-authored blocks directly from the `article_blocks`
 * table (the authoritative body source). Ordered by `sort_order`, falling back to
 * `order_index`, then unordered. Returns [] when there are none.
 */
export async function fetchArticleBlocks(articleId: string): Promise<RichArticleBlock[]> {
  const trimmed = (articleId ?? "").trim();
  if (!trimmed) return [];

  const run = (orderCol: string | null) => {
    let q = (supabase as any).from("article_blocks").select("*").eq("article_id", trimmed);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    return q as Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  };

  let { data, error } = await run("sort_order");
  if (error) {
    const r = await run("order_index");
    if (!r.error) { data = r.data; error = null; }
  }
  if (error) {
    const r = await run(null);
    if (!r.error) { data = r.data; error = null; }
  }
  if (error || !Array.isArray(data) || data.length === 0) return [];

  return data
    .map((row, i) => normalizeRawBlock(shapeArticleBlockRow(row), i))
    .filter(
      (b) => !!b && (!!b.text || !!b.mediaUrl || (b.images?.length ?? 0) > 0 || b.type === "divider" || b.type === "spacer")
    );
}

function normalizeRichContent(value: unknown): RichArticleBlock[] {
  const parsed = parseMaybeJson(value);
  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    return parsed.flatMap((block, index) => normalizePossiblyNestedBlock(block, index));
  }

  const record = asRecord(parsed);
  if (!record || Object.keys(record).length === 0) return [];

  if (Array.isArray(record.blocks)) {
    return record.blocks.flatMap((block, index) => normalizePossiblyNestedBlock(block, index));
  }

  if (record.type === "doc" && Array.isArray(record.content)) {
    return record.content.flatMap((block, index) => normalizeTiptapNode(block, index));
  }

  if (Array.isArray(record.content)) {
    const inline = extractInlineSegments(record.content);
    if (inline.length > 0) {
      return [makeTextBlock("paragraph", inline, "rich-content-root")];
    }
    return record.content.flatMap((block, index) => normalizePossiblyNestedBlock(block, index));
  }

  const html = firstNonEmptyString(record.html, record.content_html);
  if (html) return htmlToRichBlocks(html);

  const text = firstNonEmptyString(record.text, record.content, record.plain_text);
  return plainTextToBlocks(text);
}

function normalizePossiblyNestedBlock(value: unknown, index: number): RichArticleBlock[] {
  const record = asRecord(value);
  if (record?.type === "doc" && Array.isArray(record.content)) {
    return record.content.flatMap((node, nodeIndex) => normalizeTiptapNode(node, nodeIndex));
  }
  return [normalizeRawBlock(value, index)].filter(Boolean);
}

function normalizeRawBlock(value: unknown, index: number): RichArticleBlock {
  const record = asRecord(value);
  if (!record) {
    return fallbackUnknownBlock(`raw-${index}`, typeof value, "");
  }

  const data = firstRecord(record.content_json, record.data, record.payload, record.value);
  const attrs = mergeRecords(data, record.attrs, record.attributes, record.meta, record.metadata);
  const originalType = safeString(record.block_type ?? record.type ?? record.kind ?? attrs.type);
  let type = normalizeBlockType(originalType, record, attrs);

  // A generic "list" whose style is numbered renders as an ordered list.
  if (type === "list") {
    const listStyle = firstNonEmptyString(
      data.style, attrs.style, record.list_style, data.list_style, attrs.list_style
    ).toLowerCase();
    type = /number|order|^ol$|decimal/.test(listStyle) ? "ordered_list" : "unordered_list";
  }

  const id = safeString(record.id) || `article-block-${index}`;
  const blockMarks = normalizeMarks(record.marks);
  const segments = inlineSegmentsForBlock(record, data, attrs, blockMarks);
  const text = segmentsToText(segments);
  const title = firstNonEmptyString(record.title, data.title, attrs.title, record.name, attrs.name);
  const alt = firstNonEmptyString(record.alt_text, data.alt_text, attrs.alt_text, record.alt, data.alt, attrs.alt);
  const caption = firstNonEmptyString(record.caption, data.caption, attrs.caption, alt);
  const mediaUrl = firstNonEmptyString(
    record.media_url,
    record.url,
    record.src,
    data.url,
    data.src,
    data.media_url,
    data.file_url,
    record.file_url,
    attrs.url,
    attrs.src,
    attrs.href,
    attrs.media_url,
    attrs.file_url,
    nestedString(data.file, "url"),
    nestedString(attrs.file, "url")
  );
  const thumbnailUrl = firstNonEmptyString(
    record.thumbnail,
    record.thumbnail_url,
    data.thumbnail,
    data.thumbnail_url,
    data.poster,
    attrs.thumbnail,
    attrs.thumbnail_url,
    attrs.poster,
    attrs.cover,
    attrs.cover_url
  );

  if (type === "unknown") {
    return fallbackUnknownBlock(id, originalType, text);
  }

  const base: RichArticleBlock = {
    id,
    type,
    originalType,
    text,
    title,
    caption,
    alt,
    segments,
    mediaUrl,
    mediaType: firstNonEmptyString(record.media_type, data.media_type, attrs.media_type),
    provider: firstNonEmptyString(record.provider, data.provider, attrs.provider),
    thumbnailUrl,
    url: firstNonEmptyString(record.link, record.href, data.link, data.href, attrs.link, attrs.href, mediaUrl),
    fileName: firstNonEmptyString(record.fileName, record.file_name, data.fileName, data.file_name, attrs.fileName, attrs.file_name),
    fileSize: firstNonEmptyString(record.size, record.file_size, data.size, data.file_size, attrs.size, attrs.file_size),
    fileFormat: firstNonEmptyString(record.format, record.file_format, data.format, data.file_format, attrs.format, attrs.file_format),
    duration: firstNonEmptyString(record.duration, data.duration, attrs.duration),
    isPaid: normalizeBoolean(record.is_paid) || normalizeBoolean(data.is_paid) || normalizeBoolean(attrs.is_paid),
    tone: firstNonEmptyString(record.tone, data.tone, attrs.tone, data.variant, attrs.variant),
  };

  if (type === "heading" || type === "subheading") {
    base.level = normalizeHeadingLevel(firstNonEmptyString(record.level, data.level, attrs.level), type);
  }

  if (type === "gallery") {
    base.images = normalizeImages(
      firstArray(
        record.gallery_items, data.gallery_items, attrs.gallery_items,
        record.images, data.images, data.gallery, attrs.images, attrs.gallery
      )
    );
    if (base.images.length === 0 && mediaUrl) {
      base.images = [{ url: mediaUrl, caption, alt }];
    }
  }

  if (type === "ordered_list" || type === "unordered_list") {
    base.items = normalizeListItems(firstArray(record.items, data.items, attrs.items, data.list, attrs.list));
  }

  if (type === "table") {
    const table = normalizeTable(record, data, attrs);
    base.headers = table.headers;
    base.rows = table.rows;
  }

  if (type === "audio" || type === "video") {
    if (!base.duration) {
      const seconds = normalizeNumber(
        firstNonEmptyString(
          attrs.duration_seconds, data.duration_seconds, record.duration_seconds,
          attrs.audio_duration_seconds, data.audio_duration_seconds
        )
      );
      if (seconds > 0) base.duration = formatDurationSeconds(seconds);
    }
  }

  if (type === "file") {
    if (!base.fileSize) {
      const bytes = normalizeNumber(firstNonEmptyString(record.file_size_bytes, data.file_size_bytes, attrs.file_size_bytes));
      if (bytes > 0) base.fileSize = formatFileSize(bytes);
    }
    if (!base.fileFormat) {
      base.fileFormat =
        fileExtension(base.fileName) ||
        cleanMimeType(firstNonEmptyString(record.file_mime_type, data.file_mime_type, attrs.file_mime_type));
    }
  }

  if (type === "spacer") {
    base.height = clampNumber(normalizeNumber(firstNonEmptyString(record.height, data.height, attrs.height)), 18, 96, 32);
  }

  return base;
}

function formatDurationSeconds(total: number): string {
  const seconds = Math.round(total);
  if (seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string | undefined): string {
  if (!name) return "";
  const match = /\.([a-z0-9]{1,6})$/i.exec(name.trim());
  return match ? match[1].toUpperCase() : "";
}

function cleanMimeType(mime: string): string {
  if (!mime) return "";
  const subtype = (mime.split("/").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    "vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    msword: "DOC",
    "vnd.ms-excel": "XLS",
    "vnd.ms-powerpoint": "PPT",
    pdf: "PDF",
    plain: "TXT",
    zip: "ZIP",
    "x-zip-compressed": "ZIP",
  };
  if (map[subtype]) return map[subtype];
  return subtype ? subtype.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 5) : "";
}

function normalizeTiptapNode(value: unknown, index: number): RichArticleBlock[] {
  const record = asRecord(value);
  if (!record) return [];

  const type = safeString(record.type);
  const attrs = firstRecord(record.attrs);
  const content = Array.isArray(record.content) ? record.content : [];
  const segments = extractInlineSegments(content);
  const text = segmentsToText(segments);
  const id = safeString(record.id) || `rich-node-${index}`;

  switch (type) {
    case "heading":
      return [{
        id,
        type: normalizeHeadingLevel(attrs.level, "heading") >= 3 ? "subheading" : "heading",
        originalType: type,
        level: normalizeHeadingLevel(attrs.level, "heading"),
        text,
        segments,
      }];
    case "paragraph":
      return [makeTextBlock("paragraph", segments, id)];
    case "blockquote":
      return [{ id, type: "quote", originalType: type, text, segments }];
    case "bulletList":
      return [{ id, type: "unordered_list", originalType: type, items: content.flatMap(listItemSegments) }];
    case "orderedList":
      return [{ id, type: "ordered_list", originalType: type, items: content.flatMap(listItemSegments) }];
    case "horizontalRule":
      return [{ id, type: "divider", originalType: type }];
    case "image":
      return [{
        id,
        type: "image",
        originalType: type,
        mediaUrl: firstNonEmptyString(attrs.src, attrs.url),
        caption: firstNonEmptyString(attrs.caption, attrs.alt),
      }];
    default:
      return [normalizeRawBlock(value, index)];
  }
}

function normalizeLegacyBlock(block: LegacyArticleBlock): RichArticleBlock {
  switch (block.type) {
    case "title":
      return {
        id: block.id,
        type: block.level === 3 ? "subheading" : "heading",
        level: block.level ?? 2,
        text: block.text,
        segments: plainSegments(block.text),
      };
    case "paragraph":
      return { id: block.id, type: "paragraph", text: block.text, segments: plainSegments(block.text) };
    case "image":
      return { id: block.id, type: "image", mediaUrl: block.image, caption: block.caption };
    case "imagePair":
      return {
        id: block.id,
        type: "gallery",
        images: block.images.map((image) => ({ url: image.image, caption: image.caption })),
      };
    case "video":
      return {
        id: block.id,
        type: "video",
        title: block.title,
        text: block.description,
        segments: plainSegments(block.description ?? ""),
        thumbnailUrl: block.thumbnail,
        duration: block.duration,
        url: block.url,
        mediaUrl: block.url,
      };
    case "quote":
      return {
        id: block.id,
        type: "quote",
        text: block.text,
        title: block.author,
        segments: plainSegments(block.text),
      };
    case "audio":
      return {
        id: block.id,
        type: "audio",
        title: block.title,
        text: block.description,
        segments: plainSegments(block.description ?? ""),
        duration: block.duration,
        thumbnailUrl: block.cover,
        url: block.url,
        mediaUrl: block.url,
      };
    case "file":
      return {
        id: block.id,
        type: "file",
        title: block.title,
        text: block.description,
        segments: plainSegments(block.description ?? ""),
        fileName: block.fileName,
        fileSize: block.size,
        fileFormat: block.format,
        url: block.url,
        mediaUrl: block.url,
      };
    case "highlight":
      return {
        id: block.id,
        type: "important_note",
        title: block.title,
        text: block.text,
        segments: plainSegments(block.text),
      };
    case "divider":
      return { id: block.id, type: "divider" };
    case "numberedList":
      return { id: block.id, type: "ordered_list", items: block.items.map(plainSegments) };
    case "bulletList":
      return { id: block.id, type: "unordered_list", items: block.items.map(plainSegments) };
    case "table":
      return {
        id: block.id,
        type: "table",
        headers: block.headers.map(plainSegments),
        rows: block.rows.map((row) => row.map(plainSegments)),
      };
    default:
      return fallbackUnknownBlock(
        (block as unknown as { id?: string }).id ?? "legacy-unknown",
        (block as unknown as { type?: string }).type,
        ""
      );
  }
}

function htmlToRichBlocks(htmlValue: unknown): RichArticleBlock[] {
  const html = sanitizeHtml(firstNonEmptyString(htmlValue));
  if (!html) return [];

  const blocks: RichArticleBlock[] = [];
  const blockRegex =
    /<(h[1-6]|p|blockquote|figure|ul|ol|table|div)\b([^>]*)>([\s\S]*?)<\/\1>|<(img|hr|video|audio)\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = blockRegex.exec(html))) {
    const pairedTag = match[1]?.toLowerCase();
    const attrs = match[2] ?? match[5] ?? "";
    const inner = match[3] ?? "";
    const selfTag = match[4]?.toLowerCase();
    const tag = pairedTag || selfTag;
    if (!tag) continue;

    const id = `html-${index++}`;

    if (tag === "div" && /<(h[1-6]|p|blockquote|figure|ul|ol|table|img|hr|video|audio)\b/i.test(inner)) {
      blocks.push(...htmlToRichBlocks(inner));
      continue;
    }

    if (tag.startsWith("h")) {
      const level = Number(tag.slice(1));
      const segments = parseHtmlInline(inner);
      blocks.push({
        id,
        type: level >= 3 ? "subheading" : "heading",
        level,
        text: segmentsToText(segments),
        segments,
      });
      continue;
    }

    if (tag === "p" || tag === "div") {
      const segments = parseHtmlInline(inner);
      if (segmentsToText(segments)) {
        blocks.push(makeTextBlock("paragraph", segments, id));
      }
      continue;
    }

    if (tag === "blockquote") {
      const segments = parseHtmlInline(inner);
      blocks.push({ id, type: "quote", text: segmentsToText(segments), segments });
      continue;
    }

    if (tag === "figure") {
      const image = firstHtmlImage(inner);
      if (image) {
        blocks.push({
          id,
          type: "image",
          mediaUrl: image.url,
          caption: firstNonEmptyString(image.caption, stripHtmlToText(extractTagInner(inner, "figcaption"))),
        });
      }
      continue;
    }

    if (tag === "img") {
      blocks.push({
        id,
        type: "image",
        mediaUrl: extractHtmlAttr(attrs, "src"),
        caption: extractHtmlAttr(attrs, "alt"),
      });
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      blocks.push({
        id,
        type: tag === "ol" ? "ordered_list" : "unordered_list",
        items: parseHtmlListItems(inner),
      });
      continue;
    }

    if (tag === "table") {
      const table = parseHtmlTable(inner);
      blocks.push({ id, type: "table", headers: table.headers, rows: table.rows });
      continue;
    }

    if (tag === "video" || tag === "audio") {
      const mediaUrl = firstNonEmptyString(extractHtmlAttr(attrs, "src"), firstHtmlSource(inner));
      blocks.push({
        id,
        type: tag,
        mediaUrl,
        url: mediaUrl,
        thumbnailUrl: extractHtmlAttr(attrs, "poster"),
        title: tag === "video" ? "Video" : "Audio",
      });
      continue;
    }

    if (tag === "hr") {
      blocks.push({ id, type: "divider" });
    }
  }

  if (blocks.length > 0) return blocks;
  return plainTextToBlocks(stripHtmlToText(html));
}

function plainTextToBlocks(value: unknown): RichArticleBlock[] {
  const text = safeText(value, "");
  if (!text.trim()) return [];
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => ({
      id: `plain-${index}`,
      type: "paragraph" as const,
      text: part,
      segments: plainSegments(part),
    }));
}

function inlineSegmentsForBlock(
  record: Record<string, unknown>,
  data: Record<string, unknown>,
  attrs: Record<string, unknown>,
  inheritedMarks: ArticleInlineMark[]
): RichTextSegment[] {
  const inlineSource = firstDefined(
    record.children,
    data.children,
    attrs.children,
    record.spans,
    data.spans,
    attrs.spans,
    Array.isArray(record.content) ? record.content : undefined,
    Array.isArray(data.content) ? data.content : undefined
  );
  const extracted = extractInlineSegments(inlineSource, inheritedMarks);
  if (extracted.length > 0) return extracted;

  const text = firstNonEmptyString(
    record.content,
    record.text,
    data.text,
    data.content,
    data.html,
    attrs.text,
    attrs.content,
    attrs.html,
    record.description,
    data.description,
    attrs.description
  );

  if (!text) return [];
  if (looksLikeHtml(text)) return parseHtmlInline(text, inheritedMarks);
  return [{ text: decodeHtml(text), marks: inheritedMarks }];
}

function extractInlineSegments(value: unknown, inheritedMarks: ArticleInlineMark[] = [], depth = 0): RichTextSegment[] {
  if (depth > 8 || value == null) return [];

  if (typeof value === "string" || typeof value === "number") {
    const text = decodeHtml(String(value));
    return text ? [{ text, marks: inheritedMarks }] : [];
  }

  if (Array.isArray(value)) {
    return compactSegments(value.flatMap((item) => extractInlineSegments(item, inheritedMarks, depth + 1)));
  }

  const record = asRecord(value);
  if (!record) return [];

  const nextMarks = mergeMarks(inheritedMarks, normalizeMarks(record.marks), nodeBooleanMarks(record));

  if (typeof record.text === "string" || typeof record.value === "string") {
    return [{ text: decodeHtml(String(record.text ?? record.value)), marks: nextMarks }];
  }

  if (Array.isArray(record.children)) {
    return extractInlineSegments(record.children, nextMarks, depth + 1);
  }

  if (Array.isArray(record.content)) {
    return extractInlineSegments(record.content, nextMarks, depth + 1);
  }

  if (typeof record.content === "string") {
    return looksLikeHtml(record.content)
      ? parseHtmlInline(record.content, nextMarks)
      : [{ text: decodeHtml(record.content), marks: nextMarks }];
  }

  return [];
}

function parseHtmlInline(htmlValue: unknown, inheritedMarks: ArticleInlineMark[] = []): RichTextSegment[] {
  const html = sanitizeHtml(firstNonEmptyString(htmlValue));
  if (!html) return [];

  const stack: { tag: string; marks: ArticleInlineMark[] }[] = [];
  const segments: RichTextSegment[] = [];
  const tokenRegex = /<[^>]+>|[^<]+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(html))) {
    const token = match[0];

    if (!token.startsWith("<")) {
      const text = decodeHtml(token);
      if (text) {
        segments.push({
          text,
          marks: mergeMarks(inheritedMarks, stack.flatMap((entry) => entry.marks)),
        });
      }
      continue;
    }

    const tagMatch = token.match(/^<\/?\s*([a-z0-9]+)\b([^>]*)>/i);
    if (!tagMatch) continue;

    const tag = tagMatch[1].toLowerCase();
    const attrs = tagMatch[2] ?? "";
    const isClosing = /^<\//.test(token);
    const isSelfClosing = /\/>$/.test(token);

    if (isClosing) {
      const stackIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (stackIndex >= 0) stack.splice(stackIndex, 1);
      continue;
    }

    if (tag === "br") {
      segments.push({ text: "\n", marks: mergeMarks(inheritedMarks, stack.flatMap((entry) => entry.marks)) });
      continue;
    }

    const marks = htmlTagMarks(tag, attrs);
    if (marks.length > 0 && !isSelfClosing) {
      stack.push({ tag, marks });
    }
  }

  return compactSegments(segments);
}

function htmlTagMarks(tag: string, attrs: string): ArticleInlineMark[] {
  const marks: ArticleInlineMark[] = [];

  if (tag === "strong" || tag === "b") marks.push({ type: "bold" });
  if (tag === "em" || tag === "i") marks.push({ type: "italic" });
  if (tag === "u") marks.push({ type: "underline" });
  if (tag === "s" || tag === "strike" || tag === "del") marks.push({ type: "strike" });

  if (tag === "a") {
    const href = extractHtmlAttr(attrs, "href");
    if (href) marks.push({ type: "link", href });
  }

  const style = extractHtmlAttr(attrs, "style");
  if (style) marks.push(...marksFromStyle(style));

  if (tag === "mark") {
    marks.push({ type: "highlight", value: "#FFF4B8" });
  }

  if (tag === "font") {
    const color = extractHtmlAttr(attrs, "color");
    const face = extractHtmlAttr(attrs, "face");
    const size = normalizeNumber(extractHtmlAttr(attrs, "size"));
    if (color) marks.push({ type: "color", value: color });
    if (face) marks.push({ type: "fontFamily", value: face });
    if (size > 0) marks.push({ type: "fontSize", value: clampNumber(size + 12, 12, 30, 16) });
  }

  return marks;
}

function normalizeMarks(value: unknown): ArticleInlineMark[] {
  const parsed = parseMaybeJson(value);
  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    return parsed.flatMap(normalizeOneMark).filter(Boolean);
  }

  const record = asRecord(parsed);
  if (!record) return normalizeOneMark(parsed);

  const marks: ArticleInlineMark[] = [];
  marks.push(...nodeBooleanMarks(record));
  if (record.style) marks.push(...marksFromStyle(String(record.style)));
  if (record.color) marks.push({ type: "color", value: String(record.color) });
  if (record.highlight || record.backgroundColor || record.background_color) {
    marks.push({ type: "highlight", value: String(record.highlight ?? record.backgroundColor ?? record.background_color) });
  }
  if (record.href || record.url) marks.push({ type: "link", href: String(record.href ?? record.url) });
  if (record.fontSize || record.font_size) {
    const fontSize = normalizeNumber(record.fontSize ?? record.font_size);
    if (fontSize > 0) marks.push({ type: "fontSize", value: clampNumber(fontSize, 12, 34, 16) });
  }
  if (record.fontFamily || record.font_family) {
    marks.push({ type: "fontFamily", value: String(record.fontFamily ?? record.font_family) });
  }

  return marks;
}

function normalizeOneMark(value: unknown): ArticleInlineMark[] {
  if (typeof value === "string") {
    return markFromType(value, {});
  }

  const record = asRecord(value);
  if (!record) return [];
  const type = safeString(record.type ?? record.name ?? record.mark ?? record.kind);
  return markFromType(type, record);
}

function markFromType(typeValue: string, record: Record<string, unknown>): ArticleInlineMark[] {
  const type = typeValue.toLowerCase().replace(/[-_\s]/g, "");

  if (type === "bold" || type === "strong") return [{ type: "bold" }];
  if (type === "italic" || type === "em") return [{ type: "italic" }];
  if (type === "underline") return [{ type: "underline" }];
  if (type === "strike" || type === "strikethrough" || type === "del") return [{ type: "strike" }];

  const attrs = firstRecord(record.attrs, record.attributes);
  if (type === "link") {
    const href = firstNonEmptyString(record.href, record.url, attrs.href, attrs.url);
    return href ? [{ type: "link", href }] : [];
  }

  if (type === "textstyle" || type === "color" || type === "textcolor") {
    const color = firstNonEmptyString(record.color, attrs.color, record.value);
    return color ? [{ type: "color", value: color }] : [];
  }

  if (type === "highlight" || type === "background" || type === "backgroundcolor") {
    const color = firstNonEmptyString(record.color, record.backgroundColor, record.value, attrs.color);
    return color ? [{ type: "highlight", value: color }] : [];
  }

  if (type === "fontsize") {
    const fontSize = normalizeNumber(firstNonEmptyString(record.value, record.size, attrs.size));
    return fontSize > 0 ? [{ type: "fontSize", value: clampNumber(fontSize, 12, 34, 16) }] : [];
  }

  if (type === "fontfamily") {
    const family = firstNonEmptyString(record.value, record.family, attrs.family);
    return family ? [{ type: "fontFamily", value: family }] : [];
  }

  return [];
}

function marksFromStyle(style: string): ArticleInlineMark[] {
  const marks: ArticleInlineMark[] = [];
  const color = styleValue(style, "color");
  const background = styleValue(style, "background-color") || styleValue(style, "background");
  const fontSize = styleValue(style, "font-size");
  const fontFamily = styleValue(style, "font-family");
  const fontWeight = styleValue(style, "font-weight");
  const fontStyle = styleValue(style, "font-style");
  const textDecoration = styleValue(style, "text-decoration");

  if (color) marks.push({ type: "color", value: color });
  if (background) marks.push({ type: "highlight", value: background });
  if (fontSize) {
    const parsed = normalizeNumber(fontSize.replace("px", ""));
    if (parsed > 0) marks.push({ type: "fontSize", value: clampNumber(parsed, 12, 34, 16) });
  }
  if (fontFamily) marks.push({ type: "fontFamily", value: fontFamily.replace(/["']/g, "") });
  if (fontWeight === "bold" || normalizeNumber(fontWeight) >= 600) marks.push({ type: "bold" });
  if (fontStyle === "italic") marks.push({ type: "italic" });
  if (textDecoration.includes("underline")) marks.push({ type: "underline" });
  if (textDecoration.includes("line-through")) marks.push({ type: "strike" });

  return marks;
}

function nodeBooleanMarks(record: Record<string, unknown>): ArticleInlineMark[] {
  const marks: ArticleInlineMark[] = [];
  if (record.bold === true) marks.push({ type: "bold" });
  if (record.italic === true) marks.push({ type: "italic" });
  if (record.underline === true) marks.push({ type: "underline" });
  if (record.strike === true || record.strikethrough === true) marks.push({ type: "strike" });
  if (typeof record.color === "string") marks.push({ type: "color", value: record.color });
  if (typeof record.highlight === "string") marks.push({ type: "highlight", value: record.highlight });
  if (typeof record.href === "string") marks.push({ type: "link", href: record.href });
  if (typeof record.fontSize === "number") marks.push({ type: "fontSize", value: clampNumber(record.fontSize, 12, 34, 16) });
  if (typeof record.fontFamily === "string") marks.push({ type: "fontFamily", value: record.fontFamily });
  return marks;
}

function normalizeBlockType(
  value: string,
  record: Record<string, unknown>,
  attrs: Record<string, unknown>
): RichArticleBlockType {
  const type = value.toLowerCase().replace(/[-\s]/g, "_");

  if (!type) {
    if (firstNonEmptyString(record.content, record.text, attrs.text, attrs.content)) return "paragraph";
    if (firstNonEmptyString(record.media_url, attrs.url, attrs.src)) return "image";
    return "unknown";
  }

  if (type === "text") return "paragraph";
  if (type === "title" || type === "header" || type === "h1" || type === "h2") return "heading";
  if (type === "subtitle" || type === "sub_title" || type === "h3" || type === "h4" || type === "h5" || type === "h6") return "subheading";
  if (type === "note" || type === "highlight" || type === "important") return "important_note";
  if (type === "orderedlist" || type === "numberedlist" || type === "numbered_list" || type === "ol") return "ordered_list";
  if (type === "bulletlist" || type === "bulleted_list" || type === "unorderedlist" || type === "ul") return "unordered_list";
  if (type === "imagepair" || type === "image_pair" || type === "carousel") return "gallery";
  if (type === "horizontal_rule" || type === "hr") return "divider";
  if (type === "paid" || type === "premium" || type === "paywall") return "paid_content";

  const supported: RichArticleBlockType[] = [
    "paragraph",
    "heading",
    "subheading",
    "image",
    "gallery",
    "video",
    "quote",
    "audio",
    "file",
    "important_note",
    "list",
    "ordered_list",
    "unordered_list",
    "table",
    "callout",
    "divider",
    "link",
    "paid_content",
    "spacer",
  ];

  return supported.includes(type as RichArticleBlockType) ? (type as RichArticleBlockType) : "unknown";
}

function normalizeImages(value: unknown): RichArticleMedia[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): RichArticleMedia | null => {
      if (typeof item === "string") return { url: item };
      const record = asRecord(item);
      if (!record) return null;
      const url = firstNonEmptyString(
        record.url,
        record.src,
        record.image,
        record.image_url,
        record.media_url,
        nestedString(record.file, "url")
      );
      if (!url) return null;
      return {
        url,
        caption: firstNonEmptyString(record.caption, record.alt_text, record.alt, record.title),
        alt: firstNonEmptyString(record.alt_text, record.alt),
        thumbnailUrl: firstNonEmptyString(record.thumbnail, record.thumbnail_url, record.poster),
      };
    })
    .filter((item): item is RichArticleMedia => !!item);
}

function normalizeListItems(value: unknown): RichTextSegment[][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const segments = extractInlineSegments(item);
      if (segments.length > 0) return segments;
      const record = asRecord(item);
      return plainSegments(firstNonEmptyString(record?.text, record?.content, record?.title, item));
    })
    .filter((item) => segmentsToText(item).trim().length > 0);
}

function normalizeTable(
  record: Record<string, unknown>,
  data: Record<string, unknown>,
  attrs: Record<string, unknown>
): { headers: RichTextSegment[][]; rows: RichTextSegment[][][] } {
  // Admin editor saves table_data = { columns: [...], rows: [[...]] }.
  const tableData = firstRecord(record.table_data, data.table_data, attrs.table_data);
  const headersSource = firstArray(
    tableData.columns, tableData.headers,
    record.headers, data.headers, attrs.headers, record.headings, data.headings, attrs.headings
  );
  const rowsSource = firstArray(tableData.rows, record.rows, data.rows, attrs.rows, data.table, attrs.table);
  const headers = normalizeTableCells(headersSource);
  let rows = normalizeTableRows(rowsSource);

  if (headers.length === 0 && rows.length > 0) {
    const [firstRow, ...rest] = rows;
    return { headers: firstRow, rows: rest };
  }

  return { headers, rows };
}

function normalizeTableCells(value: unknown): RichTextSegment[][] {
  if (!Array.isArray(value)) return [];
  return value.map((cell) => {
    const segments = extractInlineSegments(cell);
    return segments.length > 0 ? segments : plainSegments(firstNonEmptyString(cell));
  });
}

function normalizeTableRows(value: unknown): RichTextSegment[][][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (Array.isArray(row) ? row : firstArray(asRecord(row)?.cells, asRecord(row)?.columns)))
    .filter(Array.isArray)
    .map((row) => normalizeTableCells(row));
}

function listItemSegments(value: unknown): RichTextSegment[][] {
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.content)) {
    const segments = extractInlineSegments(record.content);
    return segments.length > 0 ? [segments] : [];
  }
  return normalizeListItems([value]);
}

function parseHtmlListItems(inner: string): RichTextSegment[][] {
  const items: RichTextSegment[][] = [];
  const itemRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(inner))) {
    const segments = parseHtmlInline(match[1]);
    if (segmentsToText(segments).trim()) items.push(segments);
  }
  return items;
}

function parseHtmlTable(inner: string): { headers: RichTextSegment[][]; rows: RichTextSegment[][][] } {
  const rows: RichTextSegment[][][] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(inner))) {
    const cells: RichTextSegment[][] = [];
    const cellRegex = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(match[1]))) {
      cells.push(parseHtmlInline(cellMatch[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1) };
}

function firstHtmlImage(html: string): RichArticleMedia | null {
  const match = html.match(/<img\b([^>]*)\/?>/i);
  if (!match) return null;
  const attrs = match[1] ?? "";
  const url = extractHtmlAttr(attrs, "src");
  if (!url) return null;
  return { url, caption: extractHtmlAttr(attrs, "alt") };
}

function firstHtmlSource(html: string): string {
  const match = html.match(/<source\b([^>]*)\/?>/i);
  return match ? extractHtmlAttr(match[1] ?? "", "src") : "";
}

function extractTagInner(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function extractHtmlAttr(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function sanitizeHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function stripHtmlToText(value: string): string {
  return segmentsToText(parseHtmlInline(value)).replace(/\n{3,}/g, "\n\n").trim();
}

function makeTextBlock(type: "paragraph" | "heading" | "subheading", segments: RichTextSegment[], id: string): RichArticleBlock {
  return {
    id,
    type,
    text: segmentsToText(segments),
    segments,
  };
}

function fallbackUnknownBlock(id: string, originalType: unknown, text: string): RichArticleBlock {
  return {
    id,
    type: "unknown",
    originalType: safeString(originalType, "unknown"),
    text,
    segments: text ? plainSegments(text) : [],
  };
}

export function plainSegments(text: string): RichTextSegment[] {
  return text ? [{ text }] : [];
}

function textFromBlocks(blocks: RichArticleBlock[]): string {
  return blocks.map((block) => block.text || block.title || block.caption || "").filter(Boolean).join("\n\n");
}

function segmentsToText(segments: RichTextSegment[] = []): string {
  return segments.map((segment) => segment.text).join("");
}

function compactSegments(segments: RichTextSegment[]): RichTextSegment[] {
  const compacted: RichTextSegment[] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const previous = compacted[compacted.length - 1];
    if (previous && marksKey(previous.marks) === marksKey(segment.marks)) {
      previous.text += segment.text;
    } else {
      compacted.push({ text: segment.text, marks: segment.marks });
    }
  }
  return compacted;
}

function marksKey(marks: ArticleInlineMark[] = []): string {
  return marks.map((mark) => JSON.stringify(mark)).join("|");
}

function mergeMarks(...sets: ArticleInlineMark[][]): ArticleInlineMark[] {
  const next: ArticleInlineMark[] = [];
  const seen = new Set<string>();
  for (const mark of sets.flat()) {
    const key = JSON.stringify(mark);
    if (!seen.has(key)) {
      seen.add(key);
      next.push(mark);
    }
  }
  return next;
}

function inferCategory(row: MobileArticleRichContent): ArticleCategory {
  const record = firstRecord(row.rich_content);
  const candidate = firstNonEmptyString(
    record.category,
    record.category_name,
    record.topic,
    row.editor_type === "html" ? "Media" : ""
  );
  return ARTICLE_CATEGORIES.includes(candidate as ArticleCategory) ? (candidate as ArticleCategory) : "Tahlil";
}

function estimateReadingMinutes(wordCountValue: unknown, fallbackText: string): number {
  const wordCount = normalizeNumber(wordCountValue) || fallbackText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 180));
}

function readingMinutesFromLabel(label: string | undefined): number {
  const minutes = normalizeNumber(label);
  return minutes > 0 ? minutes : 1;
}

function normalizeHeadingLevel(value: unknown, fallbackType: "heading" | "subheading"): number {
  const level = normalizeNumber(value);
  if (level >= 1 && level <= 6) return level;
  return fallbackType === "subheading" ? 3 : 2;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstRecord(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    const parsed = parseMaybeJson(value);
    const record = asRecord(parsed);
    if (record) return record;
  }
  return {};
}

function mergeRecords(...values: unknown[]): Record<string, unknown> {
  return values.reduce<Record<string, unknown>>((merged, value) => {
    const record = firstRecord(value);
    return { ...merged, ...record };
  }, {});
}

function firstArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    const parsed = parseMaybeJson(value);
    if (Array.isArray(parsed)) return parsed;
  }
  return [];
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function safeText(value: unknown, fallback: string): string {
  const text = firstNonEmptyString(value);
  return text || fallback;
}

function nestedString(value: unknown, key: string): string {
  const record = asRecord(value);
  return firstNonEmptyString(record?.[key]);
}

function normalizeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  if (typeof value === "number") return value === 1;
  return false;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function truncateText(value: string, maxLength: number): string {
  const text = stripHtmlToText(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function styleValue(style: string, property: string): string {
  const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
