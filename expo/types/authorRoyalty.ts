/**
 * Muallif royalty (daromad) domain types — the NEW ledger-based system.
 *
 * Backed by SQL objects applied straight in the Supabase dashboard:
 *   • get_my_author_royalty_summary()            — summary for the signed-in author
 *   • get_my_author_royalty_ledger()             — sale/payout/adjustment ledger rows
 *   • create_my_author_payout_complaint(...)     — "pul yetib kelmadi" complaint
 *   • author_payout_complaints                   — own complaints (RLS-scoped)
 *
 * The RPCs resolve the linked author via auth.uid() server-side, so the app
 * only reads — it never picks an author id for earnings. Column names may
 * differ slightly between deployments, so every mapper reads through alias
 * lists (the same defensive style as the admin panel's royalty data layer).
 */

export type RoyaltyTransactionType =
  | "sale"
  | "payout"
  | "adjustment"
  | "refund"
  | "correction";

export interface AuthorRoyaltySummary {
  authorId: string | null;
  authorName: string | null;
  royaltyPercent: number;
  /** Jami ishlab topilgan (sotuvlardan tushgan muallif ulushi). */
  totalEarned: number;
  /** Mavjud balans (ishlab topilgan − to'langan). */
  availableBalance: number;
  /** Jami to'langan. */
  totalPaid: number;
  /** Yil boshidan beri to'langan. */
  paidThisYear: number;
  /** Sotuvlar soni. */
  salesCount: number;
  lastPayoutAt: string | null;
}

export interface RoyaltyLedgerEntry {
  id: string;
  transactionType: RoyaltyTransactionType | string;
  contentType: string | null;
  contentId: string | null;
  contentTitle: string | null;
  /** Sotuv summasi (gross), faqat sale yozuvlarida > 0. */
  grossAmount: number;
  royaltyPercent: number | null;
  /** Muallif ulushi — signed: sale musbat, payout manfiy. */
  royaltyAmount: number;
  balanceAfter: number | null;
  description: string | null;
  payoutReference: string | null;
  /** paid | disputed | … — payout yozuvlarida. */
  payoutStatus: string | null;
  payoutDate: string | null;
  createdAt: string;
}

export interface MyPayoutComplaint {
  id: string;
  ledgerId: string | null;
  status: string | null;
  createdAt: string | null;
}

/* ─────────────────────  ALIAS-TOLERANT PICKERS  ────────────────────── */

export type RawRow = Record<string, unknown>;

function pickRaw(row: RawRow, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row && row[key] != null) return row[key];
  }
  return null;
}

export function pickStr(row: RawRow, keys: string[]): string | null {
  const v = pickRaw(row, keys);
  return v == null || v === "" ? null : String(v);
}

export function pickNum(row: RawRow, keys: string[]): number {
  const v = pickRaw(row, keys);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ─────────────────────────────  MAPPERS  ───────────────────────────── */

export function mapRoyaltySummary(row: RawRow | null | undefined): AuthorRoyaltySummary {
  const r = row ?? {};
  const percent = pickNum(r, ["royalty_percent", "royalty", "author_percent"]);
  return {
    authorId: pickStr(r, ["author_id", "id"]),
    authorName: pickStr(r, ["author_name", "full_name", "name"]),
    royaltyPercent: percent > 0 ? percent : 50,
    totalEarned: pickNum(r, [
      "total_royalty_amount",
      "total_royalty_uzs",
      "royalty_total",
      "total_earned",
      "total_earned_uzs",
      "total_royalty",
      "author_total_uzs",
      "earned_total",
      "total_income",
    ]),
    availableBalance: pickNum(r, [
      "unpaid_royalty_amount",
      "unpaid_royalty",
      "unpaid_amount",
      "pending_royalty_amount",
      "outstanding_amount",
      "available_balance",
      "available_uzs",
      "balance",
      "current_balance",
    ]),
    totalPaid: pickNum(r, [
      "paid_royalty_amount",
      "royalty_paid",
      "total_paid",
      "total_paid_out",
      "paid_out_uzs",
      "paid_total",
      "total_payouts",
    ]),
    paidThisYear: pickNum(r, [
      "paid_this_year",
      "paid_ytd",
      "ytd_paid",
      "year_paid",
      "paid_this_year_uzs",
    ]),
    salesCount: pickNum(r, ["sales_count", "total_sales", "sale_count", "sales", "sold_count"]),
    lastPayoutAt: pickStr(r, ["last_payout_at", "last_paid_at", "last_payout_date"]),
  };
}

export function mapRoyaltyLedgerEntry(row: RawRow): RoyaltyLedgerEntry | null {
  const id = pickStr(row, ["id", "ledger_id"]);
  if (!id) return null;
  const percentRaw = pickRaw(row, ["royalty_percent", "author_percent"]);
  const balanceRaw = pickRaw(row, ["balance_after", "running_balance"]);
  return {
    id,
    transactionType:
      pickStr(row, ["transaction_type", "type", "entry_type"]) ?? "sale",
    contentType: pickStr(row, ["content_type"]),
    contentId: pickStr(row, ["content_id"]),
    contentTitle: pickStr(row, ["content_title", "title"]),
    grossAmount: pickNum(row, ["gross_amount", "gross_amount_uzs"]),
    royaltyPercent:
      percentRaw == null ? null : pickNum(row, ["royalty_percent", "author_percent"]),
    royaltyAmount: pickNum(row, [
      "royalty_amount",
      "author_amount",
      "author_amount_uzs",
      "amount",
      "author_share",
      "amount_uzs",
    ]),
    balanceAfter:
      balanceRaw == null ? null : pickNum(row, ["balance_after", "running_balance"]),
    description: pickStr(row, ["description"]),
    payoutReference: pickStr(row, ["payout_reference", "reference"]),
    payoutStatus: pickStr(row, ["payout_status", "status"]),
    payoutDate: pickStr(row, ["payout_date", "paid_at"]),
    createdAt: pickStr(row, ["created_at"]) ?? "",
  };
}

export function mapMyComplaint(row: RawRow): MyPayoutComplaint | null {
  const id = pickStr(row, ["id", "complaint_id"]);
  if (!id) return null;
  return {
    id,
    ledgerId: pickStr(row, ["ledger_id", "ledger_entry_id", "payout_ledger_id"]),
    status: pickStr(row, ["status", "complaint_status"]),
    createdAt: pickStr(row, ["created_at"]),
  };
}

/* ────────────────────────────  DISPLAY  ────────────────────────────── */

export interface LedgerTypeMeta {
  /** "Yangi sotuv" / "To'landi" / … */
  label: string;
  /** "+" for income rows, "−" for payouts/refunds, "" for neutral. */
  sign: "+" | "-" | "";
  color: string;
  bg: string;
}

/** How a ledger row's amount is presented, per transaction type + sign. */
export function ledgerTypeMeta(
  type: RoyaltyTransactionType | string,
  amount: number
): LedgerTypeMeta {
  switch (type) {
    case "sale":
      return { label: "Yangi sotuv", sign: "+", color: "#15803D", bg: "rgba(34,197,94,0.16)" };
    case "payout":
      return { label: "To'landi", sign: "-", color: "#2563EB", bg: "rgba(37,99,235,0.14)" };
    case "refund":
      return { label: "Qaytarish", sign: "-", color: "#B91C1C", bg: "rgba(239,68,68,0.14)" };
    case "adjustment":
    case "correction": {
      const label = type === "adjustment" ? "Tuzatish" : "Korreksiya";
      return amount >= 0
        ? { label, sign: "+", color: "#15803D", bg: "rgba(34,197,94,0.16)" }
        : { label, sign: "-", color: "#B45309", bg: "rgba(245,158,11,0.14)" };
    }
    default:
      return { label: "Yozuv", sign: "", color: "#6B7280", bg: "rgba(107,114,128,0.14)" };
  }
}

/** Payout holati — disputed bo'lsa "Ko'rib chiqilmoqda". */
export function payoutStatusLabel(status: string | null | undefined): string | null {
  switch (status) {
    case "disputed":
      return "Ko'rib chiqilmoqda";
    case "resolved":
      return "Hal qilindi";
    default:
      return null;
  }
}
