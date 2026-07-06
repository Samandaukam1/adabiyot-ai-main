/**
 * React-query hooks for the AdabiyotX payment flow.
 *
 * Access is always derived from backend data (entitlements + content unlocks) —
 * never granted on-device. The purchase orchestrator drives the one-time flow:
 * create-order → hosted Payme checkout → check (poll) → refresh.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import {
  checkOrder,
  createCard,
  createOrder,
  fetchMyEntitlements,
  fetchMyOrders,
  getCardVerifyCode,
  payWithToken,
  verifyCard,
} from "@/lib/paymentsApi";
import { useAuth } from "@/providers/AuthProvider";
import {
  PaymentApiError,
  isSubscriptionEntitlement,
  paymentSucceeded,
  readOrderStatus,
  toApiContentType,
  type CreateOrderInput,
  type CreateOrderResponse,
  type Entitlement,
  type OrderStatus,
  type PaymentContentType,
  type PaymentProduct,
} from "@/types/payments";

/* ──────────────────────────  Messages (spec §8)  ────────────────────── */

const MSG = {
  kassa: "To'lov tizimi hozircha faollashtirilmoqda. Iltimos, keyinroq urinib ko'ring.",
  network: "Internet aloqasini tekshiring.",
  failed: "To'lov amalga oshmadi. Qayta urinib ko'ring.",
  pending: "To‘lov hali tasdiqlanmadi",
  expired: "To'lov muddati tugadi. Qaytadan urinib ko'ring.",
  unauthorized: "Avval akkauntingizga kiring.",
  cardInvalid: "Karta ma'lumotlarini tasdiqlab bo'lmadi. Tekshirib qayta kiriting.",
  smsFailed: "SMS kodni yuborib bo'lmadi. Qayta urinib ko'ring.",
  codeInvalid: "Tasdiqlash kodi noto'g'ri. Qayta urinib ko'ring.",
};

export const PAYMENT_PRODUCT_MISSING_MESSAGE =
  "Ushbu asar uchun to‘lov mahsuloti topilmadi. Admin narxni qayta saqlashi kerak.";

const PAYMENT_PRODUCT_COLUMNS =
  "id,content_type,content_id,title,amount_uzs,is_active,allow_single_purchase";

function isPaymentContentType(value: string | null | undefined): value is PaymentContentType {
  return value === "book" || value === "poem" || value === "article" || value === "scenario";
}

function normalizePaymentContentType(value: string | null | undefined): PaymentContentType | null {
  if (!value) return null;
  const apiType = toApiContentType(value);
  return isPaymentContentType(apiType) ? apiType : null;
}

function normalizePaymentProduct(row: unknown): PaymentProduct | null {
  if (!row || typeof row !== "object") return null;
  const product = row as {
    id?: unknown;
    content_type?: unknown;
    content_id?: unknown;
    title?: unknown;
    amount_uzs?: unknown;
    is_active?: unknown;
    allow_single_purchase?: unknown;
  };
  const contentType =
    typeof product.content_type === "string"
      ? normalizePaymentContentType(product.content_type)
      : null;
  const amount =
    typeof product.amount_uzs === "number"
      ? product.amount_uzs
      : Number(product.amount_uzs ?? 0);

  if (typeof product.id !== "string" || !contentType || typeof product.content_id !== "string") {
    return null;
  }

  return {
    id: product.id,
    content_type: contentType,
    content_id: product.content_id,
    title: typeof product.title === "string" ? product.title : null,
    amount_uzs: Number.isFinite(amount) ? amount : 0,
    is_active: product.is_active === true,
    allow_single_purchase: product.allow_single_purchase === true,
  };
}

export function showMissingPaymentProductAlert() {
  Alert.alert("To'lov mahsuloti topilmadi", PAYMENT_PRODUCT_MISSING_MESSAGE);
}

export function createOrderInputFromPaymentProduct(paymentProduct: PaymentProduct): CreateOrderInput {
  return {
    product_id: paymentProduct.id,
    content_type: paymentProduct.content_type,
    content_id: paymentProduct.content_id,
  };
}

export function logCreateOrderDebug(paymentProduct: PaymentProduct | null | undefined) {
  console.log("[CREATE_ORDER_DEBUG]", {
    productId: paymentProduct?.id,
    contentType: paymentProduct?.content_type,
    contentId: paymentProduct?.content_id,
    title: paymentProduct?.title,
    price: paymentProduct?.amount_uzs,
  });
}

function messageForError(error: unknown): string {
  if (error instanceof PaymentApiError) {
    if (error.code === "payme_not_configured" || error.code === "payme_receipt_failed") return MSG.kassa;
    if (error.code === "network") return MSG.network;
    if (error.code === "unauthorized") return MSG.unauthorized;
    return error.message || MSG.failed;
  }
  return MSG.failed;
}

/* ──────────────────────────  Queries  ───────────────────────────────── */

const PAYMENTS_QUERY_KEY = ["payments"] as const;

export function usePaymentProduct(
  contentType: PaymentContentType | string | null | undefined,
  contentId: string | null | undefined,
) {
  const apiContentType = useMemo(() => normalizePaymentContentType(contentType), [contentType]);

  return useQuery({
    queryKey: ["payments", "payment-product", apiContentType, contentId ?? null],
    queryFn: async () => {
      if (!apiContentType || !contentId) return null;
      const { data, error } = await supabase
        .from("payment_products")
        .select(PAYMENT_PRODUCT_COLUMNS)
        .eq("content_type", apiContentType)
        .eq("content_id", contentId)
        .eq("is_active", true)
        .eq("allow_single_purchase", true)
        .maybeSingle();

      if (error) throw error;
      return normalizePaymentProduct(data);
    },
    enabled: !!apiContentType && !!contentId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useMyEntitlements() {
  const { userId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["payments", "entitlements", userId],
    queryFn: fetchMyEntitlements,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

export function useMyOrders() {
  const { userId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["payments", "orders", userId],
    queryFn: fetchMyOrders,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

/** The user's active subscription tariff entitlement, if any. */
export function useActiveSubscription(): Entitlement | null {
  const { data } = useMyEntitlements();
  return useMemo(() => data?.entitlements.find(isSubscriptionEntitlement) ?? null, [data]);
}

/**
 * Whether the current user can open a given paid content item. Access is true
 * when there is a matching content unlock OR an active subscription entitlement.
 * Per-content subscription limits are enforced by the backend — the client only
 * reflects what the backend reports.
 */
export function useContentAccess(contentType: PaymentContentType, contentId: string | null | undefined) {
  const { isAuthenticated } = useAuth();
  const query = useMyEntitlements();
  const data = query.data;

  const hasAccess = useMemo(() => {
    if (!data || !contentId) return false;
    const unlocked = data.content_unlocks.some(
      (u) => u.content_type === contentType && u.content_id === contentId,
    );
    if (unlocked) return true;
    return data.entitlements.some(isSubscriptionEntitlement);
  }, [data, contentType, contentId]);

  return {
    hasAccess,
    isLoading: isAuthenticated && query.isLoading,
    isAuthenticated,
    refetch: query.refetch,
  };
}

/**
 * Set of `${content_type}:${content_id}` the user actually OWNS (content unlocks
 * only — not subscription grants). Use for "my library / purchases" shelves.
 */
export function useOwnedContentSet(): Set<string> {
  const { data } = useMyEntitlements();
  return useMemo(() => {
    const set = new Set<string>();
    data?.content_unlocks.forEach((u) => {
      if (u.content_id) set.add(`${u.content_type}:${u.content_id}`);
    });
    return set;
  }, [data]);
}

/**
 * Returns a checker `(type, id) => boolean` for whether the user can VIEW a paid
 * item (owned unlock OR an active subscription). Use for lock badges in lists so
 * a single entitlements fetch covers many items.
 */
export function useContentAccessChecker(): (
  contentType: PaymentContentType,
  contentId: string | null | undefined,
) => boolean {
  const { data } = useMyEntitlements();
  return useMemo(() => {
    const owned = new Set<string>();
    let hasSubscription = false;
    if (data) {
      data.content_unlocks.forEach((u) => {
        if (u.content_id) owned.add(`${u.content_type}:${u.content_id}`);
      });
      hasSubscription = data.entitlements.some(isSubscriptionEntitlement);
    }
    return (contentType, contentId) =>
      !!contentId && (hasSubscription || owned.has(`${contentType}:${contentId}`));
  }, [data]);
}

/* ──────────────────────────  Purchase flow  ─────────────────────────── */

export type PurchaseState =
  | "idle"
  | "creating"
  | "card"
  | "tokenizing"
  | "sms"
  | "verifying"
  | "ready"
  | "paying"
  | "awaiting_payment"
  | "checking"
  | "paid"
  | "pending"
  | "failed";

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 3000;
const PAY_POLL_ATTEMPTS = 4;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls /check until the order settles (paid/failed/canceled) or attempts run out. */
async function pollUntilSettled(orderNumber: string, attempts = POLL_ATTEMPTS): Promise<OrderStatus> {
  let status: OrderStatus = "pending";
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await checkOrder(orderNumber);
      lastError = null;
      // Interpret the raw response defensively — a Payme `state: 4` (even nested)
      // always means paid, regardless of how the backend labels `status`.
      if (paymentSucceeded(res)) return "paid";
      status = readOrderStatus(res);
      if (__DEV__) console.log("[payments] check →", status);
      if (status === "failed" || status === "canceled") return status;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await delay(POLL_INTERVAL_MS);
  }
  if (lastError) throw lastError;
  return status;
}

/**
 * One-time purchase orchestrator. `start(input, { promoCode })` creates an
 * order and opens the card-entry step. The app sends only `promo_code`; all
 * final amount and access decisions stay on the backend. The card token lives
 * only in a ref for the current flow and is cleared on reset/success.
 */
export function usePurchaseFlow() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PurchaseState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [smsPhone, setSmsPhone] = useState<string | null>(null);
  const [amountUzs, setAmountUzs] = useState<number | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [originalAmountUzs, setOriginalAmountUzs] = useState<number | null>(null);
  const [discountAmountUzs, setDiscountAmountUzs] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);

  const lastInput = useRef<CreateOrderInput | null>(null);
  const lastOpts = useRef<{ promoCode?: string | null } | null>(null);
  const orderRef = useRef<CreateOrderResponse | null>(null);
  const cardTokenRef = useRef<string | null>(null);
  const busy = useRef(false);

  const reset = useCallback(() => {
    cardTokenRef.current = null;
    orderRef.current = null;
    setSmsPhone(null);
    setAmountUzs(null);
    setDiscountPercent(0);
    setOriginalAmountUzs(null);
    setDiscountAmountUzs(null);
    setPromoCode(null);
    setErrorMessage(null);
    setState("idle");
  }, []);

  const start = useCallback(async (input: CreateOrderInput, opts?: { promoCode?: string | null }) => {
    if (busy.current) return;
    busy.current = true;
    lastInput.current = input;
    lastOpts.current = opts ?? null;
    cardTokenRef.current = null;
    orderRef.current = null;
    setSmsPhone(null);
    setAmountUzs(null);
    setDiscountPercent(0);
    setOriginalAmountUzs(null);
    setDiscountAmountUzs(null);
    setPromoCode(null);
    setErrorMessage(null);
    setState("creating");

    try {
      const promoCode = opts?.promoCode?.trim();
      const order = await createOrder(promoCode ? { ...input, promo_code: promoCode } : input);
      orderRef.current = order;
      setAmountUzs(order.amount_uzs ?? null);
      setDiscountPercent(order.discount_percent ?? 0);
      setOriginalAmountUzs(order.original_amount_uzs ?? null);
      setDiscountAmountUzs(order.discount_amount_uzs ?? null);
      setPromoCode(order.promo_code ?? promoCode ?? null);

      // create-order returned 200 → the order (and, when a receipt id came back,
      // the Payme receipt) is real, so the cashbox IS active. Advance straight to
      // the card-entry step. We deliberately do NOT gate on `kassa_active` here:
      // the "To'lov tizimi faollashtirilmoqda" message must only ever come from a
      // real is_active=false failure (a non-2xx error handled in `catch`), never
      // from a successful 200.
      const hasIdentifier = !!(order.order_id || order.order_number || order.payme_receipt_id);
      if (!hasIdentifier) {
        // 200 but nothing usable parsed out. Still open the card sheet (never a
        // failed modal after a successful order) but flag it in the logs.
        console.warn("[PAYMENT_FLOW_STOPPED_AFTER_CREATE_ORDER]", {
          reason: "no_identifier_in_200_response",
          body: order,
          extractedReceiptId: order.payme_receipt_id,
        });
      }
      setState("card");
    } catch (error) {
      // Reached only when create-order ITSELF failed (non-2xx / network). Show
      // the backend's real error message (kassa-inactive codes → kassa message).
      setErrorMessage(messageForError(error));
      setState("failed");
    } finally {
      busy.current = false;
    }
  }, []);

  const submitCard = useCallback(async (number: string, expire: string) => {
    if (busy.current || !orderRef.current) return;
    busy.current = true;
    setErrorMessage(null);
    setState("tokenizing");

    try {
      const created = await createCard({ number, expire });
      if (!created.token) {
        setErrorMessage(MSG.cardInvalid);
        setState("card");
        return;
      }
      cardTokenRef.current = created.token;

      try {
        const verify = await getCardVerifyCode(created.token);
        setSmsPhone(verify.phone ?? null);
      } catch (error) {
        cardTokenRef.current = null;
        setErrorMessage(messageForError(error) || MSG.smsFailed);
        setState("card");
        return;
      }
      setState("sms");
    } catch (error) {
      setErrorMessage(messageForError(error) || MSG.cardInvalid);
      setState("card");
    } finally {
      busy.current = false;
    }
  }, []);

  const submitCode = useCallback(async (code: string) => {
    const token = cardTokenRef.current;
    if (busy.current || !token) return;
    busy.current = true;
    setErrorMessage(null);
    setState("verifying");

    try {
      const res = await verifyCard(token, code);
      if (!res.verified) {
        setErrorMessage(MSG.codeInvalid);
        setState("sms");
        return;
      }
      setState("ready");
    } catch (error) {
      setErrorMessage(messageForError(error) || MSG.codeInvalid);
      setState("sms");
    } finally {
      busy.current = false;
    }
  }, []);

  const pay = useCallback(async () => {
    const token = cardTokenRef.current;
    const order = orderRef.current;
    if (busy.current || !token || !order) return;
    busy.current = true;
    setErrorMessage(null);
    setState("paying");

    try {
      // Send only the identifiers we actually have — the backend resolves the
      // order from either one, so avoid passing empty strings.
      const res = await payWithToken({
        ...(order.order_id ? { order_id: order.order_id } : {}),
        ...(order.order_number ? { order_number: order.order_number } : {}),
        token,
      });

      // Decide success directly from the pay response. A Payme `state: 4`
      // (top-level or nested) or an explicit paid status means PAID — even if
      // the backend labelled `status` as "pending".
      let status: OrderStatus = paymentSucceeded(res) ? "paid" : readOrderStatus(res);

      // Log ONLY coarse status/state in dev — never the card/token/SMS code.
      if (__DEV__) console.log("[payments] pay-with-token →", status);

      // Ambiguous (still pending) → confirm with /check before reporting failure.
      if (status === "pending") {
        status = await pollUntilSettled(order.order_number, PAY_POLL_ATTEMPTS);
      }

      if (status === "paid") {
        cardTokenRef.current = null;
        // Refresh entitlements + content access + Tokcham purchases.
        await queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
        setState("paid");
      } else if (status === "pending") {
        setErrorMessage(MSG.pending);
        setState("pending");
      } else {
        setErrorMessage(status === "canceled" ? MSG.expired : MSG.failed);
        setState("failed");
      }
    } catch (error) {
      setErrorMessage(messageForError(error));
      setState("failed");
    } finally {
      busy.current = false;
    }
  }, [queryClient]);

  const openCheckout = useCallback(async () => {
    const order = orderRef.current;
    if (busy.current || !order?.checkout_url) return;
    busy.current = true;
    setErrorMessage(null);
    setState("awaiting_payment");

    try {
      try {
        await WebBrowser.openBrowserAsync(order.checkout_url);
      } catch {
        // Browser errors are non-authoritative; /check decides the final state.
      }
      setState("checking");
      const status = await pollUntilSettled(order.order_number);
      if (status === "paid") {
        cardTokenRef.current = null;
        await queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
        setState("paid");
      } else if (status === "pending") {
        setErrorMessage(MSG.pending);
        setState("pending");
      } else {
        setErrorMessage(status === "canceled" ? MSG.expired : MSG.failed);
        setState("failed");
      }
    } catch (error) {
      setErrorMessage(messageForError(error));
      setState("failed");
    } finally {
      busy.current = false;
    }
  }, [queryClient]);

  const recheck = useCallback(async () => {
    const order = orderRef.current;
    if (busy.current || !order) return;
    busy.current = true;
    setErrorMessage(null);
    setState("checking");

    try {
      const status = await pollUntilSettled(order.order_number);
      if (status === "paid") {
        cardTokenRef.current = null;
        await queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
        setState("paid");
      } else if (status === "pending") {
        setErrorMessage(MSG.pending);
        setState("pending");
      } else {
        setErrorMessage(status === "canceled" ? MSG.expired : MSG.failed);
        setState("failed");
      }
    } catch (error) {
      setErrorMessage(messageForError(error));
      setState("pending");
    } finally {
      busy.current = false;
    }
  }, [queryClient]);

  const retry = useCallback(() => {
    if (lastInput.current) void start(lastInput.current, lastOpts.current ?? undefined);
  }, [start]);

  return {
    state,
    errorMessage,
    smsPhone,
    amountUzs,
    discountPercent,
    originalAmountUzs,
    discountAmountUzs,
    promoCode,
    start,
    submitCard,
    submitCode,
    pay,
    openCheckout,
    recheck,
    retry,
    reset,
    hasCheckoutFallback: !!orderRef.current?.checkout_url,
    isBusy:
      state === "creating" ||
      state === "tokenizing" ||
      state === "verifying" ||
      state === "paying" ||
      state === "awaiting_payment" ||
      state === "checking",
  };
}

export type PurchaseFlow = ReturnType<typeof usePurchaseFlow>;
