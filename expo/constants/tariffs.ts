import type { PlanKey } from "@/types/payments";

export interface Tariff {
  planKey: PlanKey;
  title: string;
  priceUzs: number;
  /** Billing period label, e.g. "30 kun". */
  period: string;
  features: string[];
  /** Optional highlight badge ("Eng maqbul tanlov" on VIP). */
  badge?: string;
}

/**
 * AdabiyotX one-time, 30-day access tariffs. First stage: no recurrent renewal —
 * the user re-buys manually when the period ends. `planKey` must match the
 * seeded `payment_products.plan_key` so create-order resolves the product.
 */
export const TARIFFS: Tariff[] = [
  {
    planKey: "premium",
    title: "AdabiyotX Premium",
    priceUzs: 24_000,
    period: "30 kun",
    features: [
      "Oyiga 40 tagacha sotuvdagi kontent",
      "Haftasiga 10 tagacha",
      "Jaxongir AI",
      "Marafonlarda qatnashish",
      "1 ta AdabiyotX kuponi",
    ],
  },
  {
    planKey: "vip",
    title: "AdabiyotX VIP",
    priceUzs: 38_000,
    period: "30 kun",
    badge: "Eng maqbul tanlov",
    features: [
      "Oyiga 80 tagacha sotuvdagi kontent",
      "Haftasiga 20 tagacha",
      "Jaxongir AI",
      "Barcha ruxsat berilgan PDFlarni yuklab olish",
      "2 ta AdabiyotX kuponi",
    ],
  },
  {
    planKey: "ultra",
    title: "AdabiyotX Ultra",
    priceUzs: 69_000,
    period: "30 kun",
    features: [
      "Kengaytirilgan / cheklanmagan foydalanish",
      "Adolatli foydalanish siyosati amal qiladi",
      "Jaxongir AI+",
      "3 ta AdabiyotX kuponi",
    ],
  },
];

export function getTariff(planKey: PlanKey | string | null | undefined): Tariff | undefined {
  return TARIFFS.find((t) => t.planKey === planKey);
}

/**
 * "24 000 so'm" — thousands grouped with a space. Done manually (not via
 * `toLocaleString`) because Hermes lacks reliable Intl digit grouping.
 */
export function formatUzs(value: number): string {
  const n = Math.round(value);
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${grouped} so'm`;
}
