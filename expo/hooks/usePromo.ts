/**
 * Promo-code hooks for the AdabiyotX user app.
 *
 * The app NEVER computes a price: it shows what the backend resolves. A content
 * page calls `usePromo(target)`, which (1) lists active promos, (2) auto-resolves
 * the best one that actually applies to this content via `validate-promo`, and
 * (3) lets the user apply/remove a code manually. Only the promo *code* is ever
 * sent to checkout — `create-order` recomputes and charges the final amount.
 */
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchActivePromos, validatePromo } from "@/lib/paymentsApi";
import { useAuth } from "@/providers/AuthProvider";
import {
  type ActivePromoPreview,
  PaymentApiError,
  promoErrorMessage,
  type ActivePromo,
  type PromoPricing,
  type PromoScopeType,
  type PromoTarget,
} from "@/types/payments";

/* ──────────────────────────  Countdown  ─────────────────────────────── */

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** Seconds → "HH:MM:SS" (hours may exceed 24 for long promos). */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * Ticks every second toward `endsAt`. `expired` is only true when there is a
 * deadline that has passed (a null `endsAt` is "no deadline", never expired).
 */
export function usePromoCountdown(endsAt: string | null | undefined) {
  const endMs = useMemo(() => (endsAt ? new Date(endsAt).getTime() : 0), [endsAt]);
  const [remaining, setRemaining] = useState(() => (endMs ? Math.max(0, endMs - Date.now()) : 0));

  useEffect(() => {
    if (!endMs) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, endMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endMs]);

  const hasDeadline = !!endMs;
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    hasDeadline,
    totalSeconds,
    expired: hasDeadline && remaining <= 0,
    label: formatCountdown(totalSeconds),
  };
}

/* ──────────────────────────  Active promos  ─────────────────────────── */

export function useActivePromos(target?: PromoTarget) {
  const { userId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["payments", "active-promos", userId, target?.productId, target?.contentType, target?.contentId],
    queryFn: () => fetchActivePromos(target),
    // active-promos requires auth — don't fire for signed-out users (avoids 401).
    enabled:
      isAuthenticated &&
      (!!target?.productId || (!!target?.contentType && !!target?.contentId)),
    staleTime: 60_000,
    retry: 1,
  });
}

/** App `content_type` → the type-wide promo scope it belongs to. */
const TYPE_SCOPE: Partial<Record<string, PromoScopeType>> = {
  book: "books",
  article: "articles",
  poem: "poems",
  scenario: "screenplays",
};

/** Promos that *could* apply to this content (scope filter; backend confirms). */
function candidatesFor(promos: ActivePromo[] | undefined, target: PromoTarget): ActivePromo[] {
  if (!promos || !target.contentType) return [];
  const typeScope = TYPE_SCOPE[target.contentType];
  return promos
    .filter(
      (p) =>
        p.scope_type === "all_content" ||
        p.scope_type === "selected_content" ||
        p.scope_type === typeScope,
    )
    .sort((a, b) => b.discount_percent - a.discount_percent);
}

/** Validate candidates (best discount first) and return the first that applies. */
async function resolveBest(
  target: PromoTarget,
  candidates: ActivePromo[],
): Promise<{ promo: ActivePromo; pricing: PromoPricing } | null> {
  for (const promo of candidates) {
    try {
      const res = await validatePromo({ code: promo.code, ...target });
      if (res.valid && res.final_amount_uzs != null && res.original_amount_uzs != null) {
        return {
          promo,
          pricing: {
            discount_percent: res.discount_percent ?? promo.discount_percent,
            original_amount_uzs: res.original_amount_uzs,
            discount_amount_uzs: res.discount_amount_uzs ?? 0,
            final_amount_uzs: res.final_amount_uzs,
          },
        };
      }
    } catch {
      // Skip a candidate that errors; try the next one.
    }
  }
  return null;
}

/* ──────────────────────────  usePromo  ──────────────────────────────── */

interface AppliedPromo {
  code: string;
  pricing: PromoPricing;
  endsAt: string | null;
  title: string | null;
}

export type PromoState = ReturnType<typeof usePromo>;

function appliedFromPreview(preview: ActivePromoPreview): AppliedPromo {
  return {
    code: preview.promo.code,
    pricing: {
      discount_percent: preview.discount_percent,
      original_amount_uzs: preview.original_amount_uzs,
      discount_amount_uzs: preview.discount_amount_uzs,
      final_amount_uzs: preview.final_amount_uzs,
    },
    endsAt: preview.ends_at,
    title: preview.promo.title,
  };
}

/**
 * Resolves and manages the promo for one content item. Auto-applies the best
 * applicable active promo, and exposes `apply`/`remove` for manual codes plus a
 * live countdown. When the deadline passes, the promo deactivates on its own.
 */
export function usePromo(target: PromoTarget) {
  const { isAuthenticated } = useAuth();
  const listQuery = useActivePromos(target);

  const candidates = useMemo(
    () => candidatesFor(listQuery.data?.promos, target),
    [listQuery.data?.promos, target],
  );
  const candidateKey = candidates.map((c) => c.code).join(",");

  const autoQuery = useQuery({
    queryKey: ["payments", "promo-auto", target.productId, target.contentType, target.contentId, candidateKey],
    queryFn: () => resolveBest(target, candidates),
    enabled:
      isAuthenticated &&
      !listQuery.data?.preview &&
      (!!target.productId || (!!target.contentType && !!target.contentId)) &&
      candidates.length > 0,
    staleTime: 60_000,
    retry: 0,
  });

  const previewAuto = listQuery.data?.preview ? appliedFromPreview(listQuery.data.preview) : null;
  const validatedAuto: AppliedPromo | null = autoQuery.data
    ? {
        code: autoQuery.data.promo.code,
        pricing: autoQuery.data.pricing,
        endsAt: autoQuery.data.promo.ends_at,
        title: autoQuery.data.promo.title,
      }
    : null;
  const auto = previewAuto ?? validatedAuto;

  const [manual, setManual] = useState<AppliedPromo | null>(null);
  const [removed, setRemoved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  const effective = removed ? null : manual ?? auto;
  const countdown = usePromoCountdown(effective?.endsAt ?? null);
  const isActive = !!effective && !(effective.endsAt && countdown.expired);

  const apply = useCallback(
    async (codeRaw: string) => {
      const code = codeRaw.trim();
      if (!code) return;
      setValidating(true);
      setError(null);
      setJustApplied(false);
      try {
        const res = await validatePromo({ code, ...target });
        if (!res.valid || res.final_amount_uzs == null || res.original_amount_uzs == null) {
          setError(promoErrorMessage(res));
          return;
        }
        const listItem =
          listQuery.data?.promos.find((p) => p.code.toLowerCase() === code.toLowerCase()) ?? null;
        setManual({
          code: res.promo?.code ?? code,
          pricing: {
            discount_percent: res.discount_percent ?? 0,
            original_amount_uzs: res.original_amount_uzs,
            discount_amount_uzs: res.discount_amount_uzs ?? 0,
            final_amount_uzs: res.final_amount_uzs,
          },
          endsAt: listItem?.ends_at ?? null,
          title: res.promo?.title ?? listItem?.title ?? null,
        });
        setRemoved(false);
        setJustApplied(true);
      } catch (e) {
        setError(
          e instanceof PaymentApiError
            ? promoErrorMessage({ error: e.message })
            : "Hozircha promo tekshirib bo'lmadi",
        );
      } finally {
        setValidating(false);
      }
    },
    [target, listQuery.data],
  );

  const remove = useCallback(() => {
    setManual(null);
    setRemoved(true);
    setError(null);
    setJustApplied(false);
  }, []);

  return {
    isActive,
    appliedCode: isActive && effective ? effective.code : null,
    pricing: isActive && effective ? effective.pricing : null,
    title: isActive && effective ? effective.title : null,
    endsAt: isActive && effective ? effective.endsAt : null,
    countdown,
    validating,
    error,
    justApplied,
    apply,
    remove,
  };
}
