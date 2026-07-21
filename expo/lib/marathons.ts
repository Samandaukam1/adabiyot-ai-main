import { supabase } from "@/lib/supabase";

/**
 * Data layer for the Marafonlar feature (first marathon: Maqollar Marafoni).
 *
 * Backend contract (RPCs):
 *   - get_active_marathons()                        → list
 *   - submit_marathon_proverb(p_marathon_id, p_user_id, p_proverb_text,
 *                              p_meaning_text, p_source_text)
 *
 * Everything is defensive: missing RPCs/tables/columns degrade to empty results
 * or table fallbacks instead of throwing, so the UI never white-screens.
 */

const db = supabase as any;

export type MarathonStatus = "active" | "scheduled" | "finished";
export type SubmissionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "duplicate"
  | "removed"
  | "unknown";
export type ParticipationStatus = "none" | "pending" | "paid" | "free";

export interface Marathon {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  rules: string;
  coverUrl: string | null;
  rewardPerAccepted: number; // so'm
  startsAt: string;
  endsAt: string;
  status: MarathonStatus;
}

export interface MarathonTariff {
  id: string;
  title: string;
  price: number;
  isFree: boolean;
  description: string;
  perks: string[];
}

export interface MarathonSubmission {
  id: string;
  proverbText: string;
  meaningText: string;
  sourceText: string;
  status: SubmissionStatus;
  adminReason: string;
  reward: number;
  createdAt: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return fallback;
}
function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
function first(row: Record<string, any>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = str(row?.[k]);
    if (v) return v;
  }
  return fallback;
}
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map((x) => str(x)).filter(Boolean);
    } catch {
      return v.split(/[\n;,]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function resolveStatus(row: Record<string, any>): MarathonStatus {
  const raw = first(row, ["status", "state"]).toLowerCase();
  if (raw === "active" || raw === "scheduled" || raw === "finished") return raw as MarathonStatus;
  const now = Date.now();
  const starts = new Date(first(row, ["starts_at", "start_at", "start_date"])).getTime();
  const ends = new Date(first(row, ["ends_at", "end_at", "end_date"])).getTime();
  if (Number.isFinite(ends) && ends < now) return "finished";
  if (Number.isFinite(starts) && starts > now) return "scheduled";
  return "active";
}

function mapMarathon(row: Record<string, any>): Marathon {
  return {
    id: str(row.id),
    slug: first(row, ["slug"], str(row.id)),
    title: first(row, ["title", "name"], "Marafon"),
    subtitle: first(row, ["subtitle", "tagline"]),
    description: first(row, ["description", "about"]),
    rules: first(row, ["rules", "rules_text", "conditions"]),
    coverUrl: first(row, ["cover_url", "banner_url", "image_url", "image"]) || null,
    rewardPerAccepted: num(row.reward_per_accepted ?? row.reward_amount ?? row.reward, 1000),
    startsAt: first(row, ["starts_at", "start_at", "start_date"]),
    endsAt: first(row, ["ends_at", "end_at", "end_date"]),
    status: resolveStatus(row),
  };
}

function mapSubmissionStatus(raw: string): SubmissionStatus {
  const s = raw.toLowerCase();
  if (["accepted", "approved", "qabul"].includes(s)) return "accepted";
  if (["rejected", "reject", "rad"].includes(s)) return "rejected";
  if (["duplicate", "takroriy", "dup"].includes(s)) return "duplicate";
  if (["removed", "deleted", "ochirildi"].includes(s)) return "removed";
  if (["pending", "review", "tekshiruv", "submitted"].includes(s)) return "pending";
  return s ? "unknown" : "pending";
}

function mapSubmission(row: Record<string, any>): MarathonSubmission {
  return {
    id: str(row.id),
    proverbText: first(row, ["proverb_text", "proverb", "text"]),
    meaningText: first(row, ["meaning_text", "meaning"]),
    sourceText: first(row, ["source_text", "source"]),
    status: mapSubmissionStatus(first(row, ["status", "review_status"])),
    adminReason: first(row, ["admin_reason", "reject_reason", "reason", "note"]),
    reward: num(row.reward ?? row.reward_amount, 0),
    createdAt: first(row, ["created_at", "submitted_at"]),
  };
}

// ── fetchers ─────────────────────────────────────────────────────────────────

/** Active/scheduled/finished marathons via RPC, with a table fallback. */
export async function fetchMarathons(): Promise<Marathon[]> {
  const rpc = await db.rpc("get_active_marathons");
  if (!rpc.error && Array.isArray(rpc.data)) return rpc.data.map(mapMarathon).filter((m: Marathon) => m.id);

  const table = await db.from("marathons").select("*").order("starts_at", { ascending: false });
  if (!table.error && Array.isArray(table.data)) return table.data.map(mapMarathon).filter((m: Marathon) => m.id);

  console.warn("[marathons] fetch failed:", rpc.error?.message ?? table.error?.message);
  return [];
}

export async function fetchMarathonBySlug(slug: string): Promise<Marathon | null> {
  // Prefer the base table (exact slug); fall back to scanning the RPC list.
  const bySlug = await db.from("marathons").select("*").eq("slug", slug).limit(1);
  if (!bySlug.error && Array.isArray(bySlug.data) && bySlug.data[0]) return mapMarathon(bySlug.data[0]);

  const byId = await db.from("marathons").select("*").eq("id", slug).limit(1);
  if (!byId.error && Array.isArray(byId.data) && byId.data[0]) return mapMarathon(byId.data[0]);

  const all = await fetchMarathons();
  return all.find((m) => m.slug === slug || m.id === slug) ?? null;
}

/** Tariffs for a marathon. Falls back to three sensible defaults if none exist. */
export async function fetchMarathonTariffs(marathonId: string): Promise<MarathonTariff[]> {
  for (const table of ["marathon_tariffs", "marathon_plans"]) {
    const res = await db.from(table).select("*").eq("marathon_id", marathonId).order("price", { ascending: true });
    if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map((r: Record<string, any>) => ({
        id: str(r.id),
        title: first(r, ["title", "name"], "Tarif"),
        price: num(r.price ?? r.price_uzs ?? r.amount_uzs, 0),
        isFree: r.is_free === true || num(r.price ?? r.price_uzs, 0) <= 0,
        description: first(r, ["description", "subtitle"]),
        perks: arr(r.perks ?? r.benefits ?? r.features),
      }));
    }
  }
  return DEFAULT_TARIFFS;
}

const DEFAULT_TARIFFS: MarathonTariff[] = [
  { id: "start", title: "Boshlang'ich", price: 0, isFree: true, description: "Marafonda qatnashib ko'ring", perks: ["Maqol yuborish", "Hisobotda ko'rinish"] },
  { id: "standard", title: "Standart", price: 15000, isFree: false, description: "Ko'proq imkoniyatlar", perks: ["Barcha maqollar", "Tezkor tekshiruv", "PDF hisobot"] },
  { id: "premium", title: "Premium", price: 39000, isFree: false, description: "To'liq qatnashuv", perks: ["Cheksiz yuborish", "Ustuvor tekshiruv", "Sertifikat", "PDF hisobot"] },
];

/** The current user's participation/payment status for a marathon. */
export async function fetchMyParticipation(marathonId: string, userId: string): Promise<ParticipationStatus> {
  if (!userId) return "none";
  for (const table of ["marathon_participants", "marathon_participation"]) {
    const res = await db.from(table).select("*").eq("marathon_id", marathonId).eq("user_id", userId).limit(1);
    if (!res.error && Array.isArray(res.data) && res.data[0]) {
      const p = first(res.data[0], ["payment_status", "status"]).toLowerCase();
      if (p === "paid") return "paid";
      if (p === "free") return "free";
      return "pending";
    }
  }
  return "none";
}

/** Join a marathon with a chosen tariff. Free tariffs unlock immediately. */
export async function joinMarathon(
  marathonId: string,
  userId: string,
  tariff: MarathonTariff
): Promise<ParticipationStatus> {
  const rpc = await db.rpc("join_marathon", {
    p_marathon_id: marathonId,
    p_user_id: userId,
    p_tariff_id: tariff.id,
  });
  if (!rpc.error) {
    const status = str(rpc.data).toLowerCase();
    if (status === "paid" || status === "free" || status === "pending") return status as ParticipationStatus;
  }
  // No RPC yet → free tariff unlocks; paid waits for admin confirmation.
  return tariff.isFree ? "free" : "pending";
}

export interface SubmitProverbResult {
  ok: boolean;
  error?: string;
}

/** Submit a proverb via the RPC. */
export async function submitMarathonProverb(input: {
  marathonId: string;
  userId: string;
  proverbText: string;
  meaningText: string;
  sourceText: string;
}): Promise<SubmitProverbResult> {
  const { data, error } = await db.rpc("submit_marathon_proverb", {
    p_marathon_id: input.marathonId,
    p_user_id: input.userId,
    p_proverb_text: input.proverbText,
    p_meaning_text: input.meaningText,
    p_source_text: input.sourceText,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Yuborishda xatolik" };
  }
  // Some backends return { status: 'duplicate' } etc.
  const status = typeof data === "string" ? data : str(data?.status);
  if (status && ["duplicate", "takroriy"].includes(status.toLowerCase())) {
    return { ok: false, error: "Bu maqol avval yuborilgan (takroriy)." };
  }
  return { ok: true };
}

/** The current user's submissions for a marathon. */
export async function fetchMySubmissions(marathonId: string, userId: string): Promise<MarathonSubmission[]> {
  if (!userId) return [];
  for (const table of ["marathon_proverbs", "marathon_submissions"]) {
    const res = await db
      .from(table)
      .select("*")
      .eq("marathon_id", marathonId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!res.error && Array.isArray(res.data)) return res.data.map(mapSubmission).filter((s: MarathonSubmission) => s.id);
  }
  return [];
}
