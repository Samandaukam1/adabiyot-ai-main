import { supabase } from "@/lib/supabase";
import { resolveMediaUrl, resolveProfileAvatarUrl } from "@/lib/media";
import { resolveBadgeType, type VerificationType } from "@/types/profile";

const REELS_BUCKET = "reels";
export const PUBLIC_REELS_PAGE_SIZE = 24;
const USER_REELS_LIMIT = 48;
const SAVED_REELS_LIMIT = 60;
const REEL_COMMENTS_LIMIT = 80;
const PUBLIC_REELS_CACHE_TTL_MS = 45_000;
const LINKED_WORK_CACHE_TTL_MS = 5 * 60_000;

interface ReelPageOptions {
  limit?: number;
  offset?: number;
  force?: boolean;
}

const PUBLIC_REELS_SELECT =
  "id,user_id,video_url,thumbnail_url,title,caption,creator_name,creator_username,creator_avatar_url,creator_badge,likes_count,comments_count,saves_count,shares_count";

const TABLE_REELS_SELECT =
  "id,user_id,video_url,video_path,thumbnail_url,thumbnail_path,title,caption,description,creator_badge,likes_count,comments_count,saves_count,shares_count,created_at,linked_content_id,linked_content_type,linked_content_title";

const TABLE_REELS_BASIC_SELECT =
  "id,user_id,video_url,thumbnail_url,title,caption,description,likes_count,comments_count,saves_count,shares_count,created_at";

export interface PublicReel {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  title: string;
  caption: string | null;
  description: string | null;
  creatorName: string | null;
  creatorUsername: string | null;
  creatorAvatarUrl: string | null;
  creatorBadge: string | null;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
  userId: string | null;
  authorId: string | null;
  likedByMe: boolean;
  savedByMe: boolean;
  /** Moderation state — only populated by the by-user fetch (own profile). */
  status: string | null;
  isPublished: boolean;
  /** Adabiyot (book/poem/article/screenplay) attached to the reel, if any. */
  linkedContentId: string | null;
  linkedContentType: string | null;
  linkedContentTitle: string | null;
}

/** A resolved attached work — cover + title + author, shown on the reel. */
export interface ReelLinkedWork {
  id: string;
  contentType: string;
  title: string;
  coverUrl: string | null;
  author: string | null;
}

export interface ReelComment {
  id: string;
  reelId: string;
  userId: string | null;
  parentId: string | null;
  content: string;
  createdAt: string;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  /** Combined author badge (Muallif / Ijodkor / …) resolved from the profile. */
  authorBadge: VerificationType;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  /** Optional attached literature (reel_comments.linked_content_* columns). */
  linkedContentId: string | null;
  linkedContentType: string | null;
  linkedContentTitle: string | null;
  linkedContentCover: string | null;
  linkedContentAuthor: string | null;
}

export interface ReelUploadAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface SubmitReelInput {
  userId: string;
  authorId?: string | null;
  title: string;
  caption: string;
  description: string;
  video: ReelUploadAsset;
  thumbnail?: ReelUploadAsset | null;
  linkedContentType?: string | null;
  linkedContentId?: string | null;
  linkedContentTitle?: string | null;
  /** Staged upload progress (0–100) for the UI. */
  onProgress?: (pct: number) => void;
}

export interface SubmitReelResult {
  id: string;
}

interface UploadedReelAsset {
  path: string;
  url: string;
}

interface PublicProfileInfo {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  badge: VerificationType;
  authorId: string | null;
}

const publicReelsBaseCache = new Map<string, { rows: PublicReel[]; timestamp: number }>();
const publicReelsBaseInflight = new Map<string, Promise<PublicReel[]>>();
const linkedWorkCache = new Map<string, { value: ReelLinkedWork | null; timestamp: number }>();
const linkedWorkInflight = new Map<string, Promise<ReelLinkedWork | null>>();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePageOptions(opts?: ReelPageOptions): Required<Pick<ReelPageOptions, "limit" | "offset">> {
  const limit = Math.max(1, Math.min(opts?.limit ?? PUBLIC_REELS_PAGE_SIZE, 60));
  const offset = Math.max(0, opts?.offset ?? 0);
  return { limit, offset };
}

function applyPageRange(query: any, opts?: ReelPageOptions): any {
  const { limit, offset } = normalizePageOptions(opts);
  return query.range(offset, offset + limit - 1);
}

function cloneReels(rows: PublicReel[]): PublicReel[] {
  return rows.map((row) => ({ ...row }));
}

function publicReelsCacheKey(opts?: ReelPageOptions): string {
  const { limit, offset } = normalizePageOptions(opts);
  return `${offset}:${limit}`;
}

function normalizeCount(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value: string | null | undefined): boolean {
  return UUID_RE.test((value ?? "").trim());
}

function normalizeBadge(value: unknown): string | null {
  if (value === true) return "Ijodkor";
  const text = normalizeString(value);
  return text ? "Ijodkor" : null;
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42703" || (message.includes("column") && message.includes("does not exist"));
}

function isMissingRelationError(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42P01" || message.includes("could not find the table") || message.includes("does not exist");
}

function isRlsError(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("row-level security") || message.includes("violates row") || error?.code === "42501";
}

async function resolveCanonicalLinkedContentId(
  contentType: string | null | undefined,
  contentId: string | null | undefined,
  contentTitle: string | null | undefined
): Promise<string | null> {
  const rawId = normalizeString(contentId);
  if (isUuid(rawId)) return rawId;

  const title = normalizeString(contentTitle);
  if (!title) return null;

  const type = normalizeString(contentType)?.toLowerCase();
  const tables = (() => {
    if (type === "poem") return ["poems"] as const;
    if (type === "article") return ["articles"] as const;
    if (type === "screenplay" || type === "scenario") return ["screenplays"] as const;
    return ["books", "poems", "articles"] as const;
  })();

  for (const table of tables) {
    for (const operator of ["eq", "ilike"] as const) {
      const query = (supabase as any).from(table).select("id,title");
      const filtered =
        operator === "eq"
          ? query.eq("title", title)
          : query.ilike("title", title.includes("%") ? title : `%${title}%`);
      const { data, error } = await filtered.limit(1).maybeSingle();
      if (!error && data?.id && isUuid(String(data.id))) {
        return String(data.id);
      }
      if (error && !isMissingRelationError(error) && !isMissingColumnError(error)) {
        // Try the next table/operator; title matching is best-effort.
      }
    }
  }

  return null;
}

export function formatReelError(error: unknown, fallback: string): string {
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  if (isRlsError({ message })) {
    return "Reels amali uchun ruxsat yo'q. Bazada Reels RLS qoidasini tekshiring.";
  }
  return message || fallback;
}

function toPublicReel(row: Record<string, unknown>, profile?: PublicProfileInfo): PublicReel | null {
  const id = normalizeString(row.id);
  const rawVideo = normalizeString(row.video_url) ?? normalizeString(row.video_path);
  const videoUrl = resolveMediaUrl(rawVideo, REELS_BUCKET);
  if (!id || !videoUrl) return null;

  const rawThumbnail = normalizeString(row.thumbnail_url) ?? normalizeString(row.thumbnail_path);
  return {
    id,
    videoUrl,
    thumbnailUrl: resolveMediaUrl(rawThumbnail, REELS_BUCKET),
    title: normalizeString(row.title) ?? "Nomsiz reels",
    caption: normalizeString(row.caption),
    description: normalizeString(row.description) ?? normalizeString(row.caption),
    creatorName: normalizeString(row.creator_name) ?? profile?.name ?? null,
    creatorUsername: normalizeString(row.creator_username) ?? profile?.username ?? null,
    creatorAvatarUrl: resolveProfileAvatarUrl(
      normalizeString(row.creator_avatar_url),
      profile?.avatarUrl
    ),
    creatorBadge: normalizeBadge(row.creator_badge),
    likesCount: normalizeCount(row.likes_count),
    commentsCount: normalizeCount(row.comments_count),
    savesCount: normalizeCount(row.saves_count),
    sharesCount: normalizeCount(row.shares_count),
    userId: normalizeString(row.user_id),
    authorId: normalizeString(row.author_id) ?? profile?.authorId ?? null,
    likedByMe: false,
    savedByMe: false,
    status: normalizeString(row.status),
    isPublished: row.is_published !== false,
    linkedContentId: normalizeString(row.linked_content_id),
    linkedContentType: normalizeString(row.linked_content_type),
    linkedContentTitle: normalizeString(row.linked_content_title),
  };
}

const USER_REELS_SELECT =
  "id,user_id,video_url,video_path,thumbnail_url,thumbnail_path,title,caption,description,creator_badge,likes_count,comments_count,saves_count,shares_count,created_at,status,is_published,linked_content_id,linked_content_type,linked_content_title";

/**
 * Reels published by one user, for their profile "Reels" tab. Public callers get
 * only approved + published reels; the profile owner may pass `includeUnpublished`
 * to also see their pending / rejected uploads (badged in the UI).
 */
export async function fetchReelsByUser(
  userId: string,
  opts?: { includeUnpublished?: boolean; currentUserId?: string | null; limit?: number }
): Promise<PublicReel[]> {
  const applyFilters = (q: any) => {
    let query = q
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(opts?.limit ?? USER_REELS_LIMIT, 80)));
    if (!opts?.includeUnpublished) query = query.eq("status", "approved").eq("is_published", true);
    return query;
  };

  let { data, error } = await applyFilters((supabase as any).from("reels").select(USER_REELS_SELECT));
  if (error && isMissingColumnError(error)) {
    const retry = await applyFilters((supabase as any).from("reels").select(TABLE_REELS_BASIC_SELECT));
    data = retry.data;
    error = retry.error;
  }
  if (error || !Array.isArray(data)) {
    throw error ?? new Error("Reels yuklanmadi");
  }

  const profileMap = await fetchPublicProfileMap(data.map((row: Record<string, unknown>) => normalizeString(row.user_id)));
  const reels = data
    .map((row: Record<string, unknown>) => toPublicReel(row, profileMap[normalizeString(row.user_id) ?? ""]))
    .filter((item): item is PublicReel => item !== null);

  const state = await fetchReelInteractionState(reels.map((r) => r.id), opts?.currentUserId);
  return reels.map((r) => ({ ...r, likedByMe: state.liked.has(r.id), savedByMe: state.saved.has(r.id) }));
}

const LINKED_WORK_TABLES: Record<string, string> = {
  book: "books",
  poem: "poems",
  article: "articles",
  screenplay: "screenplays",
  scenario: "screenplays",
};

/**
 * Resolve the attached work's cover/title/author for the reel card. Best-effort:
 * returns null when the id/type is missing or the row can't be read.
 */
export async function fetchReelLinkedWork(
  contentType: string | null | undefined,
  contentId: string | null | undefined
): Promise<ReelLinkedWork | null> {
  const id = normalizeString(contentId);
  const type = normalizeString(contentType)?.toLowerCase() ?? "book";
  if (!isUuid(id)) return null;
  const table = LINKED_WORK_TABLES[type] ?? "books";
  const cacheKey = `${table}:${id}`;
  const cached = linkedWorkCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp <= LINKED_WORK_CACHE_TTL_MS) {
    return cached.value ? { ...cached.value } : null;
  }
  const inflight = linkedWorkInflight.get(cacheKey);
  if (inflight) {
    const value = await inflight;
    return value ? { ...value } : null;
  }

  const runSelect = (columns: string) =>
    (supabase as any).from(table).select(columns).eq("id", id).maybeSingle();

  const lookup = (async () => {
    let { data, error } = await runSelect("id,title,cover_url,author");
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await runSelect("id,title,cover_url"));
    }
    if (error || !data) return null;

    return {
      id: String(data.id),
      contentType: type,
      title: normalizeString(data.title) ?? "Nomsiz asar",
      coverUrl: normalizeString(data.cover_url),
      author: normalizeString(data.author),
    };
  })();

  linkedWorkInflight.set(cacheKey, lookup);
  try {
    const value = await lookup;
    linkedWorkCache.set(cacheKey, { value, timestamp: Date.now() });
    return value ? { ...value } : null;
  } finally {
    linkedWorkInflight.delete(cacheKey);
  }
}

function toReelComment(row: Record<string, unknown>, profile?: PublicProfileInfo): ReelComment | null {
  const id = normalizeString(row.id);
  const reelId = normalizeString(row.reel_id);
  const content = normalizeString(row.content) ?? normalizeString(row.body);
  if (!id || !reelId || !content) return null;
  return {
    id,
    reelId,
    userId: normalizeString(row.user_id),
    parentId: normalizeString(row.parent_id) ?? normalizeString(row.parent_comment_id),
    content,
    createdAt: normalizeString(row.created_at) ?? new Date().toISOString(),
    authorName:
      normalizeString(row.author_name) ??
      normalizeString(row.pen_name) ??
      normalizeString(row.display_name) ??
      normalizeString(row.full_name) ??
      profile?.name ??
      null,
    authorUsername: normalizeString(row.author_username) ?? normalizeString(row.username) ?? profile?.username ?? null,
    authorAvatarUrl: resolveProfileAvatarUrl(
      normalizeString(row.author_avatar_url),
      normalizeString(row.avatar_url),
      normalizeString(row.provider_avatar_url),
      profile?.avatarUrl
    ),
    authorBadge: profile?.badge ?? "none",
    likeCount: typeof row.like_count === "number" ? (row.like_count as number) : 0,
    likedByMe: false,
    replyCount: typeof row.reply_count === "number" ? (row.reply_count as number) : 0,
    linkedContentId: normalizeString(row.linked_content_id),
    linkedContentType: normalizeString(row.linked_content_type),
    linkedContentTitle: normalizeString(row.linked_content_title),
    linkedContentCover: normalizeString(row.linked_content_cover_url),
    linkedContentAuthor: normalizeString(row.linked_content_author),
  };
}

async function fetchPublicProfileMap(userIds: (string | null | undefined)[]): Promise<Record<string, PublicProfileInfo>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return {};

  const profileSelect =
    "id,display_name,full_name,pen_name,username,avatar_url,provider_avatar_url,account_type,is_creator,is_adib,verification_type,is_vip,author_id";
  const basicSelect = "id,display_name,full_name,pen_name,username,avatar_url,provider_avatar_url";
  let { data, error } = await (supabase as any)
    .from("mobile_public_profiles")
    .select(profileSelect)
    .in("id", ids);
  if (error) {
    // Try profiles (has the badge columns) then, last, a badge-less select.
    let fb = await (supabase as any).from("profiles").select(profileSelect).in("id", ids);
    if (fb.error) fb = await (supabase as any).from("profiles").select(basicSelect).in("id", ids);
    data = fb.data;
    error = fb.error;
  }
  if (error || !Array.isArray(data)) return {};

  return data.reduce((acc: Record<string, PublicProfileInfo>, row: Record<string, unknown>) => {
    const id = normalizeString(row.id);
    if (!id) return acc;
    acc[id] = {
      name:
        normalizeString(row.pen_name) ??
        normalizeString(row.display_name) ??
        normalizeString(row.full_name),
      username: normalizeString(row.username),
      avatarUrl: resolveProfileAvatarUrl(
        normalizeString(row.avatar_url),
        normalizeString(row.provider_avatar_url)
      ),
      // Same combined badge shown on the profile / So'zLab (green Muallif,
      // blue Ijodkor, gold Ijodkor+Muallif). Derived — a linked author's raw
      // verification_type is 'none'.
      badge: resolveBadgeType({
        account_type: normalizeString(row.account_type),
        is_creator: row.is_creator === true,
        is_adib: row.is_adib === true,
        author_id: normalizeString(row.author_id),
        verification_type: normalizeString(row.verification_type),
        is_vip: row.is_vip === true,
      }),
      authorId: normalizeString(row.author_id),
    };
    return acc;
  }, {});
}

async function fetchPublicReelsFromTable(opts?: ReelPageOptions): Promise<PublicReel[]> {
  let { data, error } = await applyPageRange((supabase as any)
    .from("reels")
    .select(TABLE_REELS_SELECT)
    .eq("status", "approved")
    .eq("is_published", true)
    .order("created_at", { ascending: false }), opts);

  if (error && isMissingColumnError(error)) {
    const retry = await applyPageRange((supabase as any)
      .from("reels")
      .select(TABLE_REELS_BASIC_SELECT)
      .eq("status", "approved")
      .eq("is_published", true)
      .order("created_at", { ascending: false }), opts);
    data = retry.data;
    error = retry.error;
  }

  if (error || !Array.isArray(data)) {
    throw error ?? new Error("Reels yuklanmadi");
  }

  const profileMap = await fetchPublicProfileMap(data.map((row: Record<string, unknown>) => normalizeString(row.user_id)));
  return data
    .map((row: Record<string, unknown>) => toPublicReel(row, profileMap[normalizeString(row.user_id) ?? ""]))
    .filter((item): item is PublicReel => item !== null);
}

async function fetchReelInteractionState(
  reelIds: string[],
  userId: string | null | undefined
): Promise<{ liked: Set<string>; saved: Set<string> }> {
  if (!userId || reelIds.length === 0) {
    return { liked: new Set(), saved: new Set() };
  }

  const [likes, saves] = await Promise.all([
    (supabase as any).from("reel_likes").select("reel_id").eq("user_id", userId).in("reel_id", reelIds),
    (supabase as any).from("reel_saves").select("reel_id").eq("user_id", userId).in("reel_id", reelIds),
  ]);

  const liked = new Set<string>();
  const saved = new Set<string>();
  if (!likes.error && Array.isArray(likes.data)) {
    likes.data.forEach((row: Record<string, unknown>) => {
      const id = normalizeString(row.reel_id);
      if (id) liked.add(id);
    });
  }
  if (!saves.error && Array.isArray(saves.data)) {
    saves.data.forEach((row: Record<string, unknown>) => {
      const id = normalizeString(row.reel_id);
      if (id) saved.add(id);
    });
  }

  return { liked, saved };
}

/**
 * The `public_reels` view doesn't expose the linked_content_* columns, so fill
 * them in from the base `reels` table by id. Best-effort — on any error the
 * reels are returned unchanged (the card just falls back to the caption).
 */
async function attachLinkedContent(reels: PublicReel[]): Promise<PublicReel[]> {
  const ids = reels.filter((reel) => !reel.linkedContentId).map((reel) => reel.id);
  if (ids.length === 0) return reels;
  const { data, error } = await (supabase as any)
    .from("reels")
    .select("id,linked_content_id,linked_content_type,linked_content_title")
    .in("id", ids);
  if (error || !Array.isArray(data)) return reels;
  const byId = new Map<string, Record<string, unknown>>();
  data.forEach((row: Record<string, unknown>) => {
    const id = normalizeString(row.id);
    if (id) byId.set(id, row);
  });
  return reels.map((reel) => {
    const row = byId.get(reel.id);
    if (!row) return reel;
    return {
      ...reel,
      linkedContentId: reel.linkedContentId ?? normalizeString(row.linked_content_id),
      linkedContentType: reel.linkedContentType ?? normalizeString(row.linked_content_type),
      linkedContentTitle: reel.linkedContentTitle ?? normalizeString(row.linked_content_title),
    };
  });
}

async function fetchPublicReelsBase(opts?: ReelPageOptions): Promise<PublicReel[]> {
  const cacheKey = publicReelsCacheKey(opts);
  const cached = publicReelsBaseCache.get(cacheKey);
  if (!opts?.force && cached && Date.now() - cached.timestamp <= PUBLIC_REELS_CACHE_TTL_MS) {
    return cloneReels(cached.rows);
  }

  const inflight = publicReelsBaseInflight.get(cacheKey);
  if (!opts?.force && inflight) {
    return cloneReels(await inflight);
  }

  const request = (async () => {
    let data: Record<string, unknown>[] | null = null;
    let error: { message?: string; code?: string } | null = null;

    const viewResult = await applyPageRange((supabase as any)
      .from("public_reels")
      .select(PUBLIC_REELS_SELECT)
      .order("created_at", { ascending: false }), opts);
    if (!viewResult.error && Array.isArray(viewResult.data)) {
      data = viewResult.data;
    } else {
      error = viewResult.error;
    }

    let reels: PublicReel[];
    if (data) {
      reels = data
        .map((row) => toPublicReel(row))
        .filter((item): item is PublicReel => item !== null);
    } else if (error && (isMissingRelationError(error) || isMissingColumnError(error) || isRlsError(error))) {
      reels = await fetchPublicReelsFromTable(opts);
    } else if (error) {
      throw error;
    } else {
      reels = [];
    }

    reels = await attachLinkedContent(reels);
    publicReelsBaseCache.set(cacheKey, { rows: cloneReels(reels), timestamp: Date.now() });
    return reels;
  })();

  publicReelsBaseInflight.set(cacheKey, request);
  try {
    return cloneReels(await request);
  } finally {
    publicReelsBaseInflight.delete(cacheKey);
  }
}

export async function fetchPublicReels(
  userId?: string | null,
  opts?: ReelPageOptions
): Promise<PublicReel[]> {
  const reels = await fetchPublicReelsBase(opts);
  const state = await fetchReelInteractionState(reels.map((reel) => reel.id), userId);
  return reels.map((reel) => ({
    ...reel,
    likedByMe: state.liked.has(reel.id),
    savedByMe: state.saved.has(reel.id),
  }));
}

export async function fetchSavedReels(userId: string | null | undefined): Promise<PublicReel[]> {
  if (!userId) return [];
  const { data, error } = await (supabase as any)
    .from("saved_reels")
    .select("*")
    .eq("saved_by_user_id", userId)
    .limit(SAVED_REELS_LIMIT);
  if (error || !Array.isArray(data)) {
    throw error ?? new Error("Saqlangan reels yuklanmadi");
  }
  return data
    .map((row: Record<string, unknown>) => {
      const normalized = {
        ...row,
        id: normalizeString(row.reel_id) ?? normalizeString(row.id),
        user_id: normalizeString(row.user_id) ?? normalizeString(row.creator_user_id),
      };
      const reel = toPublicReel(normalized);
      return reel ? { ...reel, savedByMe: true } : null;
    })
    .filter((item): item is PublicReel => item !== null);
}

export async function toggleReelLike(params: {
  reelId: string;
  userId: string;
  liked: boolean;
}): Promise<boolean> {
  const query = (supabase as any).from("reel_likes");
  const { error } = params.liked
    ? await query.delete().eq("reel_id", params.reelId).eq("user_id", params.userId)
    : await query.insert({ reel_id: params.reelId, user_id: params.userId });

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (!params.liked && (error.code === "23505" || message.includes("duplicate"))) return true;
    throw error;
  }
  return !params.liked;
}

export async function toggleReelSave(params: {
  reelId: string;
  userId: string;
  saved: boolean;
}): Promise<boolean> {
  const query = (supabase as any).from("reel_saves");
  const { error } = params.saved
    ? await query.delete().eq("reel_id", params.reelId).eq("user_id", params.userId)
    : await query.insert({ reel_id: params.reelId, user_id: params.userId });

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (!params.saved && (error.code === "23505" || message.includes("duplicate"))) return true;
    throw error;
  }
  return !params.saved;
}

export async function fetchReelComments(reelId: string, currentUserId?: string | null): Promise<ReelComment[]> {
  const { data, error } = await (supabase as any)
    .from("reel_comments")
    .select("*")
    .eq("reel_id", reelId)
    .order("created_at", { ascending: true })
    .limit(REEL_COMMENTS_LIMIT);
  if (error || !Array.isArray(data)) {
    throw error ?? new Error("Izohlar yuklanmadi");
  }

  const visibleRows = data.filter((row: Record<string, unknown>) => row.is_deleted !== true);
  const profileMap = await fetchPublicProfileMap(visibleRows.map((row: Record<string, unknown>) => normalizeString(row.user_id)));
  const comments = visibleRows
    .map((row: Record<string, unknown>) => toReelComment(row, profileMap[normalizeString(row.user_id) ?? ""]))
    .filter((item): item is ReelComment => item !== null);

  // Likes: count per comment + whether the current user liked it. Best-effort —
  // if reel_comment_likes doesn't exist yet the query fails and counts stay 0.
  const ids = comments.map((c) => c.id);
  if (ids.length > 0) {
    const { data: likeData } = await (supabase as any)
      .from("reel_comment_likes")
      .select("comment_id,user_id")
      .in("comment_id", ids);
    const likeCount: Record<string, number> = {};
    const mine = new Set<string>();
    (Array.isArray(likeData) ? likeData : []).forEach((r: Record<string, unknown>) => {
      const cid = normalizeString(r.comment_id);
      if (!cid) return;
      likeCount[cid] = (likeCount[cid] ?? 0) + 1;
      if (currentUserId && normalizeString(r.user_id) === currentUserId) mine.add(cid);
    });
    // Reply counts derived from the parent links we already fetched.
    const replyCount: Record<string, number> = {};
    comments.forEach((c) => {
      if (c.parentId) replyCount[c.parentId] = (replyCount[c.parentId] ?? 0) + 1;
    });
    comments.forEach((c) => {
      c.likeCount = likeCount[c.id] ?? c.likeCount;
      c.likedByMe = mine.has(c.id);
      c.replyCount = replyCount[c.id] ?? 0;
    });
  }
  return comments;
}

/** Adds or removes the current user's like on a reel comment. Best-effort. */
export async function toggleReelCommentLike(params: {
  commentId: string;
  userId: string;
  liked: boolean;
}): Promise<boolean> {
  if (params.liked) {
    await (supabase as any)
      .from("reel_comment_likes")
      .delete()
      .eq("comment_id", params.commentId)
      .eq("user_id", params.userId);
    return false;
  }
  await (supabase as any)
    .from("reel_comment_likes")
    .insert({ comment_id: params.commentId, user_id: params.userId });
  return true;
}

export interface ReelCommentAttachmentInput {
  contentType: string;
  contentId: string;
  title: string;
  coverUrl?: string | null;
  author?: string | null;
}

export async function addReelComment(params: {
  reelId: string;
  userId: string;
  content: string;
  parentId?: string | null;
  attachment?: ReelCommentAttachmentInput | null;
}): Promise<ReelComment | null> {
  const base: Record<string, unknown> = {
    reel_id: params.reelId,
    user_id: params.userId,
    parent_id: params.parentId ?? null,
    content: params.content,
  };
  if (params.attachment) {
    base.linked_content_type = params.attachment.contentType;
    base.linked_content_id = params.attachment.contentId;
    base.linked_content_title = params.attachment.title;
    base.linked_content_cover_url = params.attachment.coverUrl ?? null;
    base.linked_content_author = params.attachment.author ?? null;
  }

  let { data, error } = await (supabase as any).from("reel_comments").insert(base).select("*").single();
  // If the linked_content_* columns don't exist yet, retry without them so the
  // comment still posts (the migration adds those columns).
  if (error && params.attachment) {
    const retry = await (supabase as any)
      .from("reel_comments")
      .insert({ reel_id: params.reelId, user_id: params.userId, parent_id: params.parentId ?? null, content: params.content })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;

  const profileMap = await fetchPublicProfileMap([params.userId]);
  return toReelComment(data as Record<string, unknown>, profileMap[params.userId]);
}

export async function recordReelShare(params: {
  reelId: string;
  userId: string;
  shareTarget?: string | null;
}): Promise<void> {
  const payload: Record<string, string | null> = {
    reel_id: params.reelId,
    user_id: params.userId,
    share_target: params.shareTarget ?? null,
  };
  const { error } = await (supabase as any).from("reel_shares").insert(payload);
  if (error) throw error;
}

export async function recordReelView(params: {
  reelId: string;
  userId: string;
}): Promise<void> {
  const { error } = await (supabase as any)
    .from("reel_views")
    .insert({ reel_id: params.reelId, user_id: params.userId });
  if (error) throw error;
}

function extensionFromAsset(asset: ReelUploadAsset, fallback: string): string {
  const source = asset.fileName ?? asset.uri;
  const raw = (source.split(".").pop() ?? fallback).split("?")[0].toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(raw) ? raw : fallback;
}

function contentTypeForAsset(asset: ReelUploadAsset, kind: "video" | "thumbnail", ext: string): string {
  if (asset.mimeType?.trim()) return asset.mimeType;
  if (kind === "video") return ext === "mov" ? "video/quicktime" : `video/${ext === "m4v" ? "mp4" : ext}`;
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function uploadReelAsset(
  asset: ReelUploadAsset,
  userId: string,
  kind: "video" | "thumbnail"
): Promise<UploadedReelAsset> {
  const fallbackExt = kind === "video" ? "mp4" : "jpg";
  const ext = extensionFromAsset(asset, fallbackExt);
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("Fayl bo'sh yoki o'qilmadi");
  }
  const contentType = response.headers.get("content-type") || contentTypeForAsset(asset, kind, ext);
  const { error } = await supabase.storage
    .from(REELS_BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: true });
  if (error) throw error;
  const url = supabase.storage.from(REELS_BUCKET).getPublicUrl(path).data.publicUrl;
  if (!url) throw new Error("Yuklangan fayl URL'i olinmadi");
  return { path, url };
}

export async function submitReel(input: SubmitReelInput): Promise<SubmitReelResult> {
  const progress = input.onProgress ?? (() => {});
  progress(10);
  const linkedContentId = await resolveCanonicalLinkedContentId(
    input.linkedContentType ?? null,
    input.linkedContentId ?? null,
    input.linkedContentTitle ?? null
  );
  // Sequential so each stage maps to a clear percentage for the UI.
  const video = await uploadReelAsset(input.video, input.userId, "video");
  progress(60);
  const thumbnail = input.thumbnail
    ? await uploadReelAsset(input.thumbnail, input.userId, "thumbnail")
    : null;
  progress(80);

  const payloadWithPaths = {
    user_id: input.userId,
    author_id: input.authorId ?? null,
    title: input.title,
    caption: input.caption || null,
    description: input.description || null,
    video_url: video.url,
    video_path: video.path,
    thumbnail_url: thumbnail?.url ?? null,
    thumbnail_path: thumbnail?.path ?? null,
    linked_content_type: input.linkedContentType ?? null,
    linked_content_id: linkedContentId,
    linked_content_title: input.linkedContentTitle ?? null,
    status: "pending",
    is_published: false,
  };

  progress(90);
  const { data, error } = await (supabase as any)
    .from("reels")
    .insert(payloadWithPaths)
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[reels] insert failed after storage upload", {
      error,
      insertedRow: data,
      payload: payloadWithPaths,
      uploadedVideo: video,
      uploadedThumbnail: thumbnail,
    });
    throw new Error("Video yuklandi, lekin reels bazaga yozilmadi");
  }

  const reelId = String(data.id);
  progress(100);
  if (__DEV__) console.log("[reels] inserted row id", reelId);
  return { id: reelId };
}

export interface ReelMetadataUpdate {
  title?: string;
  caption?: string | null;
  description?: string | null;
  linkedContentType?: string | null;
  linkedContentId?: string | null;
  linkedContentTitle?: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Owner-only metadata edit. Updates ONLY the allowed columns and is scoped to
 * the owner's own reel (`.eq('user_id', userId)` + RLS). Never touches the
 * video, status, is_published or any moderation field.
 */
export async function updateReelMetadata(params: {
  reelId: string;
  userId: string;
  fields: ReelMetadataUpdate;
}): Promise<void> {
  const f = params.fields;
  const patch: Record<string, unknown> = {};
  if (f.title !== undefined) patch.title = f.title;
  if (f.caption !== undefined) patch.caption = f.caption;
  if (f.description !== undefined) patch.description = f.description;
  if (f.linkedContentType !== undefined) patch.linked_content_type = f.linkedContentType;
  if (f.linkedContentId !== undefined) patch.linked_content_id = f.linkedContentId;
  if (f.linkedContentTitle !== undefined) patch.linked_content_title = f.linkedContentTitle;
  if (f.thumbnailUrl !== undefined) patch.thumbnail_url = f.thumbnailUrl;
  if (Object.keys(patch).length === 0) return;

  const { error } = await (supabase as any)
    .from("reels")
    .update(patch)
    .eq("id", params.reelId)
    .eq("user_id", params.userId);
  if (error) throw error;
}

/** Uploads a replacement thumbnail image and returns its public URL. */
export async function uploadReelThumbnail(asset: ReelUploadAsset, userId: string): Promise<string> {
  const uploaded = await uploadReelAsset(asset, userId, "thumbnail");
  return uploaded.url;
}
