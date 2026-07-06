/**
 * "Tokcham" shelf store — reading progress ("O'qilayotganlar") and planned reads
 * ("Rejalashtirilganlar" / "Tez orada o'qiyman").
 *
 * Design: a single module-level store exposed via `useSyncExternalStore`, so the
 * whole app (detail pages, Tokcham, …) stays in sync without a React provider.
 *
 * Persistence is local-first + Supabase-mirrored:
 *   • AsyncStorage (scoped per account) is the always-available source.
 *   • On load we merge the Supabase tables (`reading_progress` / `planned_reads`)
 *     and push up any local-only rows; writes upsert/delete best-effort.
 * If the Supabase tables don't exist yet (migration not applied) everything still
 * works locally and silently — once the migration is applied it syncs.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId, userScopedKey } from "@/lib/userStorage";

export type ShelfContentType = "book" | "poem" | "article" | "scenario";

export interface ShelfItem {
  contentType: ShelfContentType;
  contentId: string;
  title: string;
  cover: string | null;
  author: string | null;
  updatedAt: number;
  /** Reading progress 0..1 (reading items only). */
  progress?: number;
  finished?: boolean;
}

const READING_BASE = "shelf.reading.v1";
const PLANNED_BASE = "shelf.planned.v1";

interface ShelfState {
  reading: ShelfItem[];
  planned: ShelfItem[];
  ready: boolean;
}

let state: ShelfState = { reading: [], planned: [], ready: false };
let loadedUserId: string | null | undefined = undefined;
const listeners = new Set<() => void>();

/**
 * The account a write should be scoped to. Prefer the loaded scope, but fall
 * back to the live auth user id so writes from screens that never mounted a
 * `useShelf` consumer (e.g. the reader) still land in the right account.
 */
function writeScopeUserId(): string | null {
  return loadedUserId !== undefined ? loadedUserId : getCurrentUserId();
}

function emit() {
  for (const l of Array.from(listeners)) l();
}
function setState(next: ShelfState) {
  state = next;
  emit();
}

export function subscribeShelf(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getShelfSnapshot(): ShelfState {
  return state;
}

const keyOf = (item: Pick<ShelfItem, "contentType" | "contentId">) =>
  `${item.contentType}:${item.contentId}`;

function safeParse(raw: string | null | undefined): ShelfItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function persistLocal(userId: string | null) {
  try {
    await AsyncStorage.multiSet([
      [userScopedKey(READING_BASE, userId), JSON.stringify(state.reading)],
      [userScopedKey(PLANNED_BASE, userId), JSON.stringify(state.planned)],
    ]);
  } catch {
    /* ignore */
  }
}

/** A Supabase table missing (migration not applied) — degrade silently. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST116" ||
    msg.includes("does not exist") ||
    msg.includes("not found")
  );
}

function rowToReading(row: any): ShelfItem {
  return {
    contentType: row.content_type,
    contentId: String(row.content_id),
    title: row.title ?? "",
    cover: row.cover_url ?? null,
    author: row.author ?? null,
    progress: typeof row.progress === "number" ? row.progress : 0,
    finished: !!row.finished,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}
function rowToPlanned(row: any): ShelfItem {
  return {
    contentType: row.content_type,
    contentId: String(row.content_id),
    title: row.title ?? "",
    cover: row.cover_url ?? null,
    author: row.author ?? null,
    updatedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mergeByKey(remote: ShelfItem[], local: ShelfItem[]): {
  merged: ShelfItem[];
  localOnly: ShelfItem[];
} {
  const map = new Map<string, ShelfItem>();
  for (const r of remote) map.set(keyOf(r), r);
  const localOnly: ShelfItem[] = [];
  for (const l of local) {
    const k = keyOf(l);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, l);
      localOnly.push(l);
    } else if ((l.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      map.set(k, l); // keep the newer local copy
    }
  }
  const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return { merged, localOnly };
}

async function mergeRemote(userId: string) {
  try {
    const [readingRes, plannedRes] = await Promise.all([
      (supabase as any)
        .from("reading_progress")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      (supabase as any)
        .from("planned_reads")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (isMissingTable(readingRes.error) && isMissingTable(plannedRes.error)) return;

    let nextReading = state.reading;
    let nextPlanned = state.planned;

    if (!readingRes.error && Array.isArray(readingRes.data)) {
      const remote = readingRes.data.map(rowToReading);
      const { merged, localOnly } = mergeByKey(remote, state.reading);
      nextReading = merged;
      for (const item of localOnly) void upsertReadingRemote(userId, item);
    }
    if (!plannedRes.error && Array.isArray(plannedRes.data)) {
      const remote = plannedRes.data.map(rowToPlanned);
      const { merged, localOnly } = mergeByKey(remote, state.planned);
      nextPlanned = merged;
      for (const item of localOnly) void upsertPlannedRemote(userId, item);
    }

    setState({ reading: nextReading, planned: nextPlanned, ready: true });
    await persistLocal(userId);
  } catch {
    /* offline / missing tables — local stays authoritative */
  }
}

async function upsertReadingRemote(userId: string, item: ShelfItem) {
  try {
    await (supabase as any).from("reading_progress").upsert(
      {
        user_id: userId,
        content_type: item.contentType,
        content_id: item.contentId,
        title: item.title || null,
        cover_url: item.cover,
        author: item.author,
        progress: item.progress ?? 0,
        finished: item.finished ?? false,
        updated_at: new Date(item.updatedAt).toISOString(),
      },
      { onConflict: "user_id,content_type,content_id" }
    );
  } catch {
    /* ignore */
  }
}

async function upsertPlannedRemote(userId: string, item: ShelfItem) {
  try {
    await (supabase as any).from("planned_reads").upsert(
      {
        user_id: userId,
        content_type: item.contentType,
        content_id: item.contentId,
        title: item.title || null,
        cover_url: item.cover,
        author: item.author,
      },
      { onConflict: "user_id,content_type,content_id" }
    );
  } catch {
    /* ignore */
  }
}

async function deletePlannedRemote(userId: string, item: Pick<ShelfItem, "contentType" | "contentId">) {
  try {
    await (supabase as any)
      .from("planned_reads")
      .delete()
      .eq("user_id", userId)
      .eq("content_type", item.contentType)
      .eq("content_id", item.contentId);
  } catch {
    /* ignore */
  }
}

/** Load the shelf for an account scope (idempotent per userId). */
export async function ensureShelfLoaded(userId: string | null) {
  if (loadedUserId === userId && state.ready) return;
  loadedUserId = userId;
  setState({ reading: [], planned: [], ready: false });
  try {
    const [r, p] = await AsyncStorage.multiGet([
      userScopedKey(READING_BASE, userId),
      userScopedKey(PLANNED_BASE, userId),
    ]);
    setState({ reading: safeParse(r[1]), planned: safeParse(p[1]), ready: true });
  } catch {
    setState({ reading: [], planned: [], ready: true });
  }
  if (userId) void mergeRemote(userId);
}

/** Pull the latest from Supabase (Tokcham pull-to-refresh). */
export async function refreshShelf() {
  if (loadedUserId) await mergeRemote(loadedUserId);
}

/** Add/refresh a "reading" entry — call when a reader is opened. */
export function recordReading(item: Omit<ShelfItem, "updatedAt"> & { updatedAt?: number }) {
  const uid = writeScopeUserId();
  const now = item.updatedAt ?? Date.now();
  const entry: ShelfItem = { ...item, updatedAt: now, finished: item.finished ?? false };
  const reading = [entry, ...state.reading.filter((x) => keyOf(x) !== keyOf(entry))].slice(0, 60);
  setState({ ...state, reading });
  void persistLocal(uid);
  if (uid) void upsertReadingRemote(uid, entry);
}

/** Toggle a planned read ("Tez orada o'qiyman"). Returns the new planned state. */
export function togglePlanned(item: Omit<ShelfItem, "updatedAt">): boolean {
  const uid = writeScopeUserId();
  const k = keyOf(item);
  const exists = state.planned.some((x) => keyOf(x) === k);
  if (exists) {
    setState({ ...state, planned: state.planned.filter((x) => keyOf(x) !== k) });
    void persistLocal(uid);
    if (uid) void deletePlannedRemote(uid, item);
    return false;
  }
  const entry: ShelfItem = { ...item, updatedAt: Date.now() };
  setState({ ...state, planned: [entry, ...state.planned] });
  void persistLocal(uid);
  if (uid) void upsertPlannedRemote(uid, entry);
  return true;
}

export function removePlanned(item: Pick<ShelfItem, "contentType" | "contentId">) {
  const uid = writeScopeUserId();
  const k = keyOf(item);
  setState({ ...state, planned: state.planned.filter((x) => keyOf(x) !== k) });
  void persistLocal(uid);
  if (uid) void deletePlannedRemote(uid, item);
}
