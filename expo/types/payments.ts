/**
 * Shared types for the AdabiyotX payment flow.
 *
 * The user app NEVER talks to Payme directly and never holds a Payme key — it
 * only calls the backend payment endpoints (see `lib/paymentsApi.ts`). Access is
 * granted by the backend (paid order → entitlement / content unlock), never
 * on-device. These types mirror the backend response shapes 1:1.
 */

/** Content kinds the backend understands. App route `screenplay` maps to `scenario`. */
export type PaymentContentType = "book" | "poem" | "article" | "scenario";

/** Subscription tariff identifiers (must match the seeded `payment_products.plan_key`). */
export type PlanKey = "premium" | "vip" | "ultra";

/** Order / receipt status as resolved by the backend from Payme. */
export type OrderStatus = "pending" | "paid" | "failed" | "canceled";

/**
 * App-side content type → backend `content_type`. The app uses `screenplay`
 * for routes/UI, but the catalog stores screenplays as `scenario`. Audio is part
 * of the book purchase, so it resolves to `book`.
 */
export const APP_TO_API_CONTENT_TYPE: Record<string, PaymentContentType> = {
  book: "book",
  audio: "book",
  poem: "poem",
  article: "article",
  screenplay: "scenario",
  scenario: "scenario",
};

/** Uzbek label for a content type, used in paywall copy ("Ushbu {label}: …"). */
export const CONTENT_TYPE_LABEL: Record<PaymentContentType, string> = {
  book: "kitob",
  poem: "she'r",
  article: "maqola",
  scenario: "ssenariy",
};

export function toApiContentType(appType: string): PaymentContentType {
  return APP_TO_API_CONTENT_TYPE[appType] ?? (appType as PaymentContentType);
}

/* ──────────────────────────  Request inputs  ────────────────────────── */

export type CreateOrderInput =
  | { plan_key: PlanKey }
  | { content_type: PaymentContentType; content_id: string }
  | { product_id: string; content_type?: PaymentContentType; content_id?: string };

/** create-order body: a product selector plus an optional promo code. */
export type CreateOrderBody = CreateOrderInput & { promo_code?: string };

/** Active single-purchase product resolved from `payment_products`. */
export interface PaymentProduct {
  id: string;
  content_type: PaymentContentType;
  content_id: string;
  title: string | null;
  amount_uzs: number;
  is_active: boolean;
  allow_single_purchase: boolean;
}

/** POST /cards/create body. The raw PAN is sent only to the backend. */
export interface CardCreateInput {
  number: string;
  expire: string;
}

/** POST /pay-with-token body. */
export interface PayWithTokenInput {
  order_id?: string;
  order_number?: string;
  token: string;
}

/* ──────────────────────────  Promo codes  ───────────────────────────── */

export type PromoScopeType =
  | "all_content"
  | "selected_content"
  | "books"
  | "articles"
  | "poems"
  | "screenplays"
  | "audio_books";

export type PromoSourceType = "author" | "publisher" | "company";

/** A promo row from GET /active-promos (only non-sensitive fields). */
export interface ActivePromo {
  id: string;
  code: string;
  title: string;
  description: string | null;
  source_type: PromoSourceType;
  source_author_id: string | null;
  source_publisher_id: string | null;
  scope_type: PromoScopeType;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  total_usage_limit: number | null;
  used_count: number;
}

export interface ActivePromoPreview {
  promo: ActivePromo;
  discount_percent: number;
  original_amount_uzs: number;
  discount_amount_uzs: number;
  final_amount_uzs: number;
  ends_at: string | null;
  countdown_seconds?: number | null;
}

export interface ActivePromosResult {
  promos: ActivePromo[];
  preview: ActivePromoPreview | null;
}

/** Identifies the product a promo is checked against (content purchases only). */
export interface PromoTarget {
  contentType?: PaymentContentType;
  contentId?: string | null;
  productId?: string | null;
}

/** Backend-computed pricing for a promo (validate-promo + create-order carry it). */
export interface PromoPricing {
  discount_percent: number;
  original_amount_uzs: number;
  discount_amount_uzs: number;
  final_amount_uzs: number;
}

/** POST /validate-promo response. NOTE: the request field is `code`, not promo_code. */
export interface ValidatePromoResponse extends Partial<PromoPricing> {
  valid: boolean;
  error?: string;
  /** Machine reason code, e.g. "promo_expired", "promo_scope_mismatch". */
  code?: string;
  promo?: { code: string; title: string } | null;
}

/** Map a validate-promo failure to a warm Uzbek message (backend error is a fallback). */
const PROMO_REASON_UZ: Record<string, string> = {
  promo_not_found: "Promo kod topilmadi",
  promo_inactive: "Promo kod amal qilmaydi",
  promo_not_started: "Promo kod hali boshlanmagan",
  promo_expired: "Chegirma muddati tugadi",
  promo_scope_mismatch: "Bu promo kod ushbu asar uchun amal qilmaydi",
  promo_source_mismatch: "Bu promo kod ushbu asar uchun amal qilmaydi",
  promo_limit_reached: "Promo koddan foydalanish limiti tugagan",
  promo_per_user_reached: "Siz bu promo koddan allaqachon foydalangansiz",
  promo_invalid: "Promo kod amal qilmaydi",
  content_not_found: "Asar topilmadi",
  promo_error: "Hozircha promo tekshirib bo'lmadi",
  promo_missing: "Promo kod kiritilmadi",
};

export function promoErrorMessage(res: { code?: string | null; error?: string | null }): string {
  if (res.code && PROMO_REASON_UZ[res.code]) return PROMO_REASON_UZ[res.code];
  if (res.error) return res.error; // backend already returns an Uzbek message
  return "Promo kod amal qilmaydi";
}

/* ──────────────────────────  Response shapes  ───────────────────────── */

export interface CreateOrderResponse {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  /** Amount actually charged (already discounted when a promo was applied). */
  amount_uzs: number;
  /** Promo breakdown — present (discount 0) even without a promo. */
  original_amount_uzs?: number;
  discount_percent?: number;
  discount_amount_uzs?: number;
  final_amount_uzs?: number;
  promo_code?: string | null;
  payme_receipt_id: string | null;
  checkout_url: string | null;
  kassa_active: boolean;
}

export interface CreateOrderIdentifiers {
  orderId: string | null;
  orderNumber: string | null;
  receiptId: string | null;
}

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function asOrderStatus(value: unknown): OrderStatus | undefined {
  if (typeof value !== "string") return undefined;
  const status = value.toLowerCase();
  if (status === "pending" || status === "paid" || status === "failed" || status === "canceled") {
    return status;
  }
  if (status === "cancelled") return "canceled";
  return undefined;
}

function collectCreateOrderRecords(value: unknown, depth = 0): AnyRecord[] {
  const record = asRecord(value);
  if (!record || depth > 3) return [];

  const records = [record];
  for (const key of ["data", "response", "result", "body", "payload"]) {
    records.push(...collectCreateOrderRecords(record[key], depth + 1));
  }
  return records;
}

function valueAtPath(record: AnyRecord, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord || !(key in currentRecord)) return undefined;
    current = currentRecord[key];
  }
  return current;
}

function firstString(records: AnyRecord[], paths: string[][]): string | null {
  for (const record of records) {
    for (const path of paths) {
      const value = asString(valueAtPath(record, path));
      if (value) return value;
    }
  }
  return null;
}

function firstNumber(records: AnyRecord[], paths: string[][]): number | undefined {
  for (const record of records) {
    for (const path of paths) {
      const value = asNumber(valueAtPath(record, path));
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function firstBoolean(records: AnyRecord[], paths: string[][]): boolean | undefined {
  for (const record of records) {
    for (const path of paths) {
      const value = asBoolean(valueAtPath(record, path));
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function firstStatus(records: AnyRecord[], paths: string[][]): OrderStatus | undefined {
  for (const record of records) {
    for (const path of paths) {
      const value = asOrderStatus(valueAtPath(record, path));
      if (value) return value;
    }
  }
  return undefined;
}

export function extractCreateOrderIdentifiers(payload: unknown): CreateOrderIdentifiers {
  const records = collectCreateOrderRecords(payload);

  return {
    orderId: firstString(records, [
      ["order_id"],
      ["orderId"],
      ["payment_order_id"],
      ["paymentOrderId"],
      ["order", "id"],
      ["order", "order_id"],
      ["order", "orderId"],
      ["payment_order", "id"],
      ["payment_order", "order_id"],
      ["paymentOrder", "id"],
      ["id"],
    ]),
    orderNumber: firstString(records, [
      ["order_number"],
      ["orderNumber"],
      ["order", "order_number"],
      ["order", "orderNumber"],
      ["payment_order", "order_number"],
      ["paymentOrder", "orderNumber"],
    ]),
    receiptId: firstString(records, [
      ["payme_receipt_id"],
      ["receipt_id"],
      ["receiptId"],
      ["receiptID"],
      ["order", "payme_receipt_id"],
      ["order", "receipt_id"],
      ["order", "receiptId"],
      ["order", "receipt", "id"],
      ["order", "receipt", "_id"],
      ["receipt", "id"],
      ["receipt", "_id"],
      ["receipt", "receipt_id"],
      ["payme", "receipt", "id"],
      ["payme", "receipt", "_id"],
    ]),
  };
}

export function normalizeCreateOrderResponse(payload: unknown): CreateOrderResponse {
  const records = collectCreateOrderRecords(payload);
  const ids = extractCreateOrderIdentifiers(payload);
  const finalAmount = firstNumber(records, [["final_amount_uzs"], ["order", "final_amount_uzs"]]);
  const amount = firstNumber(records, [["amount_uzs"], ["order", "amount_uzs"]]) ?? finalAmount ?? 0;

  return {
    order_id: ids.orderId ?? "",
    order_number: ids.orderNumber ?? "",
    status: firstStatus(records, [["status"], ["order", "status"]]) ?? "pending",
    amount_uzs: amount,
    original_amount_uzs: firstNumber(records, [["original_amount_uzs"], ["order", "original_amount_uzs"]]),
    discount_percent: firstNumber(records, [["discount_percent"], ["order", "discount_percent"]]),
    discount_amount_uzs: firstNumber(records, [["discount_amount_uzs"], ["order", "discount_amount_uzs"]]),
    final_amount_uzs: finalAmount,
    promo_code: firstString(records, [["promo_code"], ["promoCode"], ["order", "promo_code"]]),
    payme_receipt_id: ids.receiptId,
    checkout_url: firstString(records, [["checkout_url"], ["checkoutUrl"], ["order", "checkout_url"]]),
    kassa_active: firstBoolean(records, [["kassa_active"], ["kassaActive"], ["order", "kassa_active"]]) ?? true,
  };
}

export interface CheckResponse {
  order_number: string;
  status: OrderStatus;
  access_granted: boolean;
}

/** POST /cards/create — Payme card tokenized with save:false. */
export interface CardCreateResponse {
  token: string | null;
  verify: boolean | null;
  recurrent: boolean | null;
  card_number: string | null;
}

/** POST /cards/get-verify-code — Payme sent an SMS code to the card holder. */
export interface GetVerifyCodeResponse {
  sent: boolean;
  phone: string | null;
  wait: number | null;
}

/** POST /cards/verify — SMS code confirmed, token activated for charging. */
export interface VerifyCardResponse {
  verified: boolean;
}

/** POST /pay-with-token — receipts.pay result, then backend re-checks receipt state. */
export interface PayWithTokenResponse {
  order_number: string;
  status: OrderStatus;
  access_granted: boolean;
  pay_warning?: string;
}

/** A row from `payment_orders` (ORDER_COLUMNS). */
export interface PaymentOrder {
  id: string;
  order_number: string;
  user_id: string | null;
  product_id: string | null;
  project_key: string | null;
  product_type: string | null;
  plan_key: PlanKey | null;
  content_type: PaymentContentType | null;
  content_id: string | null;
  title: string;
  amount_uzs: number;
  amount_tiyin: number | null;
  currency: string | null;
  provider: string | null;
  status: OrderStatus;
  payme_receipt_id: string | null;
  payme_transaction_id: string | null;
  payme_state: number | null;
  access_granted: boolean;
  duration_days: number | null;
  monthly_limit: number | null;
  weekly_limit: number | null;
  paid_at: string | null;
  canceled_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entitlement {
  id: string;
  entitlement_type: string; // "subscription" | "content_access" | …
  plan_key: PlanKey | null;
  content_type: PaymentContentType | null;
  content_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  monthly_limit: number | null;
  weekly_limit: number | null;
  monthly_used: number | null;
  weekly_used: number | null;
  is_active: boolean;
  source_order_id: string | null;
  created_at: string;
}

export interface ContentUnlock {
  id: string;
  content_type: PaymentContentType | null;
  content_id: string | null;
  unlock_source: string | null;
  source_order_id: string | null;
  entitlement_id: string | null;
  created_at: string;
}

export interface MyEntitlementsResponse {
  entitlements: Entitlement[];
  content_unlocks: ContentUnlock[];
}

/** True when an entitlement represents an active subscription tariff. */
export function isSubscriptionEntitlement(e: Entitlement): boolean {
  return e.entitlement_type === "subscription" || (!!e.plan_key && !e.content_id);
}

/* ──────────────────  Payment success / status detection  ────────────────── */

/** Payme receipt state 4 = paid. */
function isPaidState(value: unknown): boolean {
  return value === 4 || value === "4";
}

/**
 * Robustly decides whether a pay-with-token / check response means "paid".
 *
 * The backend (or the raw Payme receipt it forwards) can express success in many
 * shapes, so we scan for ANY of these — at the top level or nested:
 *   status === "paid" · paid === true · success === true · access_granted === true
 *   state === 4 · receipt.state === 4 · result.state === 4 · check.result.state === 4
 *   payment_order.status === "paid" · order.status === "paid"
 * Once a Payme `state: 4` (or an explicit paid status) is found anywhere, the
 * payment is treated as successful — it is never reported as failed.
 */
export function paymentSucceeded(payload: unknown, depth = 0): boolean {
  if (payload == null || depth > 6) return false;
  if (Array.isArray(payload)) return payload.some((p) => paymentSucceeded(p, depth + 1));
  if (typeof payload !== "object") return false;

  const obj = payload as Record<string, unknown>;
  const status = typeof obj.status === "string" ? obj.status.toLowerCase() : null;

  if (status === "paid") return true;
  if (obj.paid === true) return true;
  if (obj.access_granted === true) return true;
  if (isPaidState(obj.state)) return true;

  // `success: true` only counts when nothing in the same object contradicts it
  // (no pending/failed status, no non-paid state).
  if (obj.success === true) {
    const contradicts =
      (status && status !== "paid") ||
      (obj.state !== undefined && !isPaidState(obj.state));
    if (!contradicts) return true;
  }

  // Recurse into the common nested containers Payme / the backend may use.
  for (const key of [
    "result",
    "receipt",
    "check",
    "payment_order",
    "order",
    "data",
    "response",
    "payme",
    "payment",
  ]) {
    if (key in obj && paymentSucceeded(obj[key], depth + 1)) return true;
  }
  return false;
}

/** Reads a coarse order status from any response shape (after a paid check). */
export function readOrderStatus(payload: unknown, depth = 0): OrderStatus {
  if (paymentSucceeded(payload)) return "paid";
  if (payload == null || depth > 6 || typeof payload !== "object") return "pending";

  const obj = payload as Record<string, unknown>;
  const status = typeof obj.status === "string" ? obj.status.toLowerCase() : null;
  if (status === "failed") return "failed";
  if (status === "canceled" || status === "cancelled") return "canceled";

  // Payme negative states = cancelled.
  const state = typeof obj.state === "number" ? obj.state : Number(obj.state);
  if (Number.isFinite(state) && state < 0) return "canceled";

  for (const key of ["result", "receipt", "check", "payment_order", "order", "data", "response", "payme", "payment"]) {
    if (key in obj) {
      const nested = readOrderStatus(obj[key], depth + 1);
      if (nested !== "pending") return nested;
    }
  }
  return "pending";
}

/* ──────────────────────────  Errors  ────────────────────────────────── */

/**
 * Normalised error thrown by `paymentsApi`. `code` carries the backend error
 * code (e.g. "payme_not_configured") or "network" for connectivity failures.
 */
export class PaymentApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "PaymentApiError";
    this.code = code;
    this.status = status;
  }
}
