/**
 * AdabiyotX payments API client.
 *
 * SECURITY: this is the ONLY surface the user app uses for payments. It talks
 * exclusively to our backend (the admin Next.js app). There is no Payme key and
 * no direct Payme call anywhere in the user app — the backend owns the Payme
 * cashbox secret. Card data is sent only to our backend over TLS for Payme
 * tokenization with save:false; no card number or Payme key is stored on-device.
 *
 * Every request is authenticated with the current Supabase access token
 * (`Authorization: Bearer …`), which the backend verifies via `requireUser`.
 */
import { supabase } from "@/lib/supabase";
import {
  extractCreateOrderIdentifiers,
  normalizeCreateOrderResponse,
  PaymentApiError,
  type ActivePromo,
  type ActivePromosResult,
  type CardCreateInput,
  type CardCreateResponse,
  type CheckResponse,
  type CreateOrderBody,
  type CreateOrderResponse,
  type GetVerifyCodeResponse,
  type MyEntitlementsResponse,
  type PaymentOrder,
  type PayWithTokenInput,
  type PayWithTokenResponse,
  type PromoTarget,
  type ValidatePromoResponse,
  type VerifyCardResponse,
} from "@/types/payments";

/**
 * Base URL of the backend payment API (the admin app). Configure per
 * environment with `EXPO_PUBLIC_PAYMENTS_API_URL`; the placeholder below must be
 * replaced before a real build.
 */
export const PAYMENTS_API_URL = (
  process.env.EXPO_PUBLIC_PAYMENTS_API_URL || "https://REPLACE-ME.example.com"
).replace(/\/+$/, "");

if (__DEV__) {
  // Safe: only the base URL — no tokens/keys.
  if (__DEV__) console.log("[PAYMENTS_API_URL]", PAYMENTS_API_URL);
}

/**
 * Reads the current Supabase access token, refreshing the session first if it's
 * missing or about to expire. Returns null when the user isn't signed in.
 * Never logs the token value.
 */
async function getSessionToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
  const nearExpiry = expiresAtMs > 0 && expiresAtMs <= Date.now() + 10_000;

  if (!session?.access_token || nearExpiry) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) session = refreshed.session;
    } catch {
      // keep whatever we had; caller decides how to handle a null token
    }
  }

  const token = session?.access_token ?? null;
  if (__DEV__) {
    if (__DEV__) console.log("[PAYMENT_AUTH]", { hasSession: !!session, hasAccessToken: !!token });
  }
  return token;
}

async function getAccessToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) {
    throw new PaymentApiError("Avval akkauntingizga kiring.", "unauthorized", 401);
  }
  return token;
}

async function getMaybeAccessToken(): Promise<string | null> {
  return getSessionToken();
}

interface AuthedFetchInit {
  method?: "GET" | "POST";
  body?: unknown;
}

/**
 * Authenticated JSON fetch against the payments backend. Returns parsed JSON on
 * success, throws a `PaymentApiError` (with `code`) on any non-2xx or network
 * failure. Network/timeout failures surface as `code: "network"`.
 */
async function authedFetch<T>(path: string, init: AuthedFetchInit = {}): Promise<T> {
  const token = await getAccessToken();
  return jsonFetch<T>(path, init, token);
}

interface RawJsonResult {
  status: number;
  ok: boolean;
  json: unknown;
}

/** Low-level authenticated fetch that returns the raw HTTP status + parsed body
 *  WITHOUT throwing on non-2xx. Only network/timeout failures throw. Callers that
 *  need the status/body (e.g. create-order diagnostics) build on this. */
async function rawJsonFetch(path: string, init: AuthedFetchInit, token: string | null): Promise<RawJsonResult> {
  let res: Response;
  try {
    res = await fetch(`${PAYMENTS_API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new PaymentApiError("Internet aloqasini tekshiring.", "network");
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, ok: res.ok, json };
}

function throwForFailedResponse(result: RawJsonResult): never {
  const payload = (result.json ?? {}) as { error?: string; code?: string };
  throw new PaymentApiError(
    payload.error || "Xatolik yuz berdi. Qayta urinib ko'ring.",
    payload.code,
    result.status,
  );
}

async function jsonFetch<T>(path: string, init: AuthedFetchInit, token: string | null): Promise<T> {
  const result = await rawJsonFetch(path, init, token);
  if (!result.ok) throwForFailedResponse(result);
  return result.json as T;
}

/* ──────────────────────────  Endpoints  ─────────────────────────────── */

/**
 * POST /api/payments/create-order. `promo_code` is optional; the discount is
 * always computed on the backend — the app never sends an amount.
 *
 * The backend response shape varies (flat `order_id`, nested `order.id`,
 * `receipt.id`, `payme_receipt_id`, …), so we ALWAYS run it through
 * `normalizeCreateOrderResponse`, which digs the identifiers out regardless of
 * field name / nesting. The normalized result guarantees `order_id`,
 * `order_number` and `payme_receipt_id` are populated when the backend sent
 * them in ANY form, so the card step can proceed.
 */
export async function createOrder(input: CreateOrderBody): Promise<CreateOrderResponse> {
  const token = await getAccessToken();
  const result = await rawJsonFetch("/api/payments/create-order", { method: "POST", body: input }, token);

  const ids = extractCreateOrderIdentifiers(result.json);
  const hasIdentifier = !!(ids.orderId || ids.orderNumber || ids.receiptId);
  // Predicted next step for the flow: a 2xx with any identifier → card entry.
  const nextStep = !result.ok ? "failed_order_creation" : hasIdentifier ? "card" : "card_no_identifier";

  // Diagnostic (safe: response body carries order/receipt ids only — never the
  // card number, token, SMS code, or access token, which are sent elsewhere).
  if (__DEV__) console.log("[CREATE_ORDER_RESPONSE_DEBUG]", {
    status: result.status,
    ok: result.ok,
    body: result.json,
    extractedOrderId: ids.orderId,
    extractedReceiptId: ids.receiptId,
    nextStep,
  });

  // Only a genuinely failed order (non-2xx) throws — this is the ONLY path that
  // may surface a real backend error message. The generic "kassa activating"
  // message is NEVER produced for a 2xx response.
  if (!result.ok) throwForFailedResponse(result);

  return normalizeCreateOrderResponse(result.json);
}

/* ───────────────────────────  Promo codes  ──────────────────────────── */

/** Maps a promo target to the product selector the backend expects. */
function targetToProductBody(target: PromoTarget): Record<string, string> {
  if (target.productId) return { product_id: target.productId };
  if (target.contentType && target.contentId) {
    return { content_type: target.contentType, content_id: target.contentId };
  }
  return {};
}

function targetToQuery(target?: PromoTarget): string {
  if (!target) return "";
  const params = new URLSearchParams();
  if (target.productId) params.set("product_id", target.productId);
  if (target.contentType) params.set("content_type", target.contentType);
  if (target.contentId) params.set("content_id", target.contentId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

type ActivePromosApiResponse = {
  promos?: ActivePromo[];
  active_promo?: ActivePromo | null;
  original_amount_uzs?: number | null;
  discount_percent?: number | null;
  discount_amount_uzs?: number | null;
  final_amount_uzs?: number | null;
  ends_at?: string | null;
  countdown_seconds?: number | null;
};

/** GET /api/payments/active-promos — currently usable promos to show in-app. */
export async function fetchActivePromos(target?: PromoTarget): Promise<ActivePromosResult> {
  // The endpoint requires auth; for a signed-out user there are no personal
  // promos to show, so skip the call (no 401 noise) and return nothing.
  const token = await getMaybeAccessToken();
  if (!token) return { promos: [], preview: null };

  const data = await jsonFetch<ActivePromosApiResponse>(
    `/api/payments/active-promos${targetToQuery(target)}`,
    {},
    token,
  );
  const promos = data.promos ?? (data.active_promo ? [data.active_promo] : []);
  const preview =
    data.active_promo &&
    data.original_amount_uzs != null &&
    data.final_amount_uzs != null
      ? {
          promo: data.active_promo,
          original_amount_uzs: data.original_amount_uzs,
          discount_percent: data.discount_percent ?? data.active_promo.discount_percent,
          discount_amount_uzs: data.discount_amount_uzs ?? 0,
          final_amount_uzs: data.final_amount_uzs,
          ends_at: data.ends_at ?? data.active_promo.ends_at ?? null,
          countdown_seconds: data.countdown_seconds ?? null,
        }
      : null;
  return { promos, preview };
}

/**
 * POST /api/payments/validate-promo — preview a promo discount for a product.
 * Invalid-but-resolvable promos come back as 200 `{ valid: false, ... }`; other
 * failures (404/400/5xx) throw a PaymentApiError.
 */
export function validatePromo(input: { code: string } & PromoTarget): Promise<ValidatePromoResponse> {
  const { code, ...target } = input;
  return authedFetch<ValidatePromoResponse>("/api/payments/validate-promo", {
    method: "POST",
    body: { code, ...targetToProductBody(target) },
  });
}

/** POST /api/payments/check */
export function checkOrder(orderNumber: string): Promise<CheckResponse> {
  return authedFetch<CheckResponse>("/api/payments/check", {
    method: "POST",
    body: { order_number: orderNumber },
  });
}

/* ───────────────────────  Card payment flow  ───────────────────────── */

/** POST /api/payments/cards/create — tokenize card with save:false. */
export function createCard(input: CardCreateInput): Promise<CardCreateResponse> {
  return authedFetch<CardCreateResponse>("/api/payments/cards/create", {
    method: "POST",
    body: { number: input.number, expire: input.expire },
  });
}

/** POST /api/payments/cards/get-verify-code — request Payme SMS code. */
export function getCardVerifyCode(token: string): Promise<GetVerifyCodeResponse> {
  return authedFetch<GetVerifyCodeResponse>("/api/payments/cards/get-verify-code", {
    method: "POST",
    body: { token },
  });
}

/** POST /api/payments/cards/verify — confirm SMS code. */
export function verifyCard(token: string, code: string): Promise<VerifyCardResponse> {
  return authedFetch<VerifyCardResponse>("/api/payments/cards/verify", {
    method: "POST",
    body: { token, code },
  });
}

/** POST /api/payments/pay-with-token — receipts.pay through backend only. */
export function payWithToken(input: PayWithTokenInput): Promise<PayWithTokenResponse> {
  return authedFetch<PayWithTokenResponse>("/api/payments/pay-with-token", {
    method: "POST",
    body: input,
  });
}

/** GET /api/payments/my-orders */
export async function fetchMyOrders(): Promise<PaymentOrder[]> {
  const data = await authedFetch<{ orders: PaymentOrder[] }>("/api/payments/my-orders");
  return data.orders ?? [];
}

/** GET /api/payments/my-entitlements */
export function fetchMyEntitlements(): Promise<MyEntitlementsResponse> {
  return authedFetch<MyEntitlementsResponse>("/api/payments/my-entitlements");
}
