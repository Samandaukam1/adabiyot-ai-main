/**
 * Muallif (author) account domain types.
 *
 * The user app reads the SAME production views/tables the admin panel writes to
 * (all live under `public`, all filter by `author_id`):
 *   • public.authors                 → LinkedAuthor (found by profiles.author_id)
 *   • public.author_works            → AuthorWork[]           (author_id filter)
 *   • public.author_earnings         → AuthorEarning[]        (author_id filter)
 *   • public.author_earnings_summary → AuthorEarningsSummary  (author_id filter)
 * Earnings are READ-ONLY — the app never computes them, it only reads the view.
 * Every query is scoped to the signed-in user's own `profiles.author_id`, so no
 * other author's data is ever requested.
 */

export type EarningStatus = "pending" | "available" | "paid_out";
export type ContentKind = "book" | "poem" | "article" | "screenplay";

/* ─────────────────────────  RAW VIEW ROWS  ─────────────────────────── */

/** A row of `public.authors` (readable). Column names carry legacy twins. */
export interface AuthorRow {
  id: string;
  full_name: string | null;
  slug: string | null;
  avatar_url: string | null;
  short_bio: string | null;
  short_description: string | null;
  bio: string | null;
  full_bio: string | null;
  quote: string | null;
  profession: string | null;
  occupation: string | null;
  is_verified: boolean | null;
  encyclopedia_article_id: string | null;
  status: string | null;
  linked_account_id?: string | null;
  profile_id?: string | null;
}

/** A row of the `public.author_works` view. */
export interface AuthorWorkRow {
  id: string;
  author_id: string | null;
  content_type: string | null;
  title: string | null;
  slug: string | null;
  cover_url: string | null;
  created_at: string | null;
}

/** A row of the `public.author_earnings` view (per-sale ledger). */
export interface AuthorEarningRow {
  id: string;
  author_id: string | null;
  order_id: string | null;
  content_type: string | null;
  content_id: string | null;
  content_title?: string | null;
  gross_amount_uzs: number | string | null;
  author_percent: number | string | null;
  author_amount_uzs: number | string | null;
  platform_amount_uzs: number | string | null;
  currency: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
}

/** The single aggregate row of the `public.author_earnings_summary` view. */
export interface AuthorEarningsSummaryRow {
  author_id: string | null;
  sales_count: number | string | null;
  gross_total_uzs: number | string | null;
  author_total_uzs: number | string | null;
  platform_total_uzs: number | string | null;
  available_uzs: number | string | null;
  pending_uzs: number | string | null;
  paid_out_uzs: number | string | null;
}

/* ─────────────────────────  APP-FACING TYPES  ──────────────────────── */

export interface LinkedAuthor {
  id: string;
  fullName: string;
  slug: string | null;
  avatarUrl: string | null;
  shortDescription: string | null;
  bio: string | null;
  quote: string | null;
  profession: string | null;
  isVerified: boolean;
  encyclopediaEntryId: string | null;
  status: string | null;
  linkedProfileId: string | null;
  linkedAccountId: string | null;
  username: string | null;
}

export interface AuthorWork {
  contentType: ContentKind | string;
  id: string;
  title: string;
  coverUrl: string | null;
  /** Standalone media URL for creator submissions such as monologues. */
  mediaUrl: string | null;
  price: number;
  isFree: boolean;
  status: string;
  isPublished: boolean;
  createdAt: string | null;
  publishedAt: string | null;
  salesCount: number;
  earnedUzs: number;
}

export interface AuthorEarning {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  contentType: ContentKind | string | null;
  contentId: string | null;
  contentTitle: string;
  saleAmountUzs: number;
  authorSharePercent: number;
  authorAmountUzs: number;
  status: EarningStatus;
  paymentStatus: string | null;
  soldAt: string | null;
}

export interface AuthorEarningsSummary {
  /** Author's own share total (`author_total_uzs`). */
  totalEarned: number;
  /** Gross sales total before the split (`gross_total_uzs`). */
  grossTotal: number;
  availableBalance: number;
  pendingAmount: number;
  paidOutAmount: number;
  salesCount: number;
  authorSharePercent: number;
}

/* ─────────────────────────────  MAPPERS  ───────────────────────────── */

function num(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeStatus(value: string | null | undefined): EarningStatus {
  return value === "pending" || value === "paid_out" ? value : "available";
}

export function mapLinkedAuthor(row: AuthorRow): LinkedAuthor {
  return {
    id: row.id,
    fullName: (row.full_name ?? "").trim() || "Muallif",
    slug: row.slug ?? null,
    avatarUrl: row.avatar_url ?? null,
    shortDescription: row.short_description ?? row.short_bio ?? null,
    bio: row.bio ?? row.full_bio ?? null,
    quote: row.quote ?? null,
    profession: row.profession ?? row.occupation ?? null,
    isVerified: row.is_verified === true,
    encyclopediaEntryId: row.encyclopedia_article_id ?? null,
    status: row.status ?? null,
    linkedProfileId: row.linked_account_id ?? row.profile_id ?? null,
    linkedAccountId: row.linked_account_id ?? null,
    username: null,
  };
}

// `author_works` exposes only identity + cover (no price / status / sales), so
// the price and stat fields default to unknown and the card hides them.
export function mapAuthorWork(row: AuthorWorkRow): AuthorWork {
  return {
    contentType: row.content_type ?? "book",
    id: row.id,
    title: (row.title ?? "").trim() || "Nomsiz asar",
    coverUrl: row.cover_url ?? null,
    mediaUrl: null,
    price: 0,
    isFree: false,
    status: "published",
    isPublished: true,
    createdAt: row.created_at ?? null,
    publishedAt: row.created_at ?? null,
    salesCount: 0,
    earnedUzs: 0,
  };
}

export function mapAuthorEarning(row: AuthorEarningRow): AuthorEarning {
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    orderNumber: null,
    contentType: row.content_type ?? null,
    contentId: row.content_id ?? null,
    contentTitle: (row.content_title ?? "").trim() || "Asar",
    saleAmountUzs: num(row.gross_amount_uzs),
    authorSharePercent: num(row.author_percent) || 50,
    authorAmountUzs: num(row.author_amount_uzs),
    status: normalizeStatus(row.status),
    paymentStatus: row.status ?? null,
    soldAt: row.paid_at ?? row.created_at ?? null,
  };
}

export function mapEarningsSummary(
  row: AuthorEarningsSummaryRow | null | undefined
): AuthorEarningsSummary {
  return {
    totalEarned: num(row?.author_total_uzs),
    grossTotal: num(row?.gross_total_uzs),
    availableBalance: num(row?.available_uzs),
    pendingAmount: num(row?.pending_uzs),
    paidOutAmount: num(row?.paid_out_uzs),
    salesCount: num(row?.sales_count),
    authorSharePercent: 50,
  };
}

/* ────────────────────────────  DISPLAY  ────────────────────────────── */

export function contentTypeLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "book":
      return "Kitob";
    case "poem":
      return "She'r";
    case "article":
      return "Maqola";
    case "screenplay":
    case "scenario":
      return "Ssenariy";
    case "audio":
      return "Audio";
    case "monologue":
      return "Monolog";
    default:
      return "Asar";
  }
}

export function earningStatusMeta(status: EarningStatus): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "pending":
      return { label: "Kutilmoqda", color: "#B45309", bg: "rgba(245,158,11,0.14)" };
    case "paid_out":
      return { label: "To'langan", color: "#2563EB", bg: "rgba(37,99,235,0.14)" };
    case "available":
    default:
      return { label: "Mavjud", color: "#15803D", bg: "rgba(34,197,94,0.16)" };
  }
}

const MONTH_PAD = (n: number) => String(n).padStart(2, "0");

/** "01.07.2026, 12:38" — sale date + time in local form. */
export function formatSaleDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${MONTH_PAD(d.getDate())}.${MONTH_PAD(d.getMonth() + 1)}.${d.getFullYear()}`;
  const time = `${MONTH_PAD(d.getHours())}:${MONTH_PAD(d.getMinutes())}`;
  return `${date}, ${time}`;
}

/** Route for a work / earning content item, matching the app's detail screens. */
export function contentRoute(
  contentType: string | null | undefined,
  id: string
): string {
  switch (contentType) {
    case "poem":
      return `/poem/${id}`;
    case "article":
      return `/article/${id}`;
    case "screenplay":
    case "scenario":
      return `/screenplay/${id}`;
    case "book":
    default:
      return `/book/${id}`;
  }
}
