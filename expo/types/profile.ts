export type AccountType =
  | "reader"
  | "creator"
  | "adib"
  | "creator_adib"
  | "vip"
  | "publisher"
  | "company";

export type VerificationType =
  | "none"
  | "creator_blue"
  | "adib_green"
  | "creator_adib_gold"
  | "vip_yellow"
  | "publisher_black"
  | "company_black";

export type CreatorStatus =
  | "none"
  | "requested"
  | "pending"
  | "approved"
  | "rejected";

export type MediaSubmissionType = "reel" | "monologue" | "audio" | "video";
export type MediaSubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revision_required";

export type PublisherSubType = "gigant" | "independent" | "small" | "adabiyot_ai";

/** A custom link shown on the profile (maps to the `profile_links` table). */
export interface ProfileLink {
  id: string;
  title: string;
  url: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  /**
   * Unique public handle shown as "@username". Stored lowercase, without the
   * "@", in `profiles.username`. Null until the user picks one; the UI then
   * falls back to the derived {@link UserProfile.handle}.
   */
  username: string | null;
  handle: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  penName: string | null;
  fullName: string | null;
  accountType: AccountType;
  verificationType: VerificationType;
  creatorStatus: CreatorStatus;
  publisherSubType: PublisherSubType | null;
  /** Admin-controlled: true once a creator application is approved. */
  isCreator: boolean;
  /** Optional custom creator badge label from the admin (profiles.creator_badge). */
  creatorBadge: string | null;
  isVip: boolean;
  /**
   * Linked `authors` row id, set by the admin panel. When present the account is
   * a "Muallif akkaunti" (author) — the profile shows works + an earnings tab.
   */
  authorId: string | null;
  worksCount: number;
  readCount: number;
  followersCount: number;
  likesCount: number;
  /** Social / web links (map to `profiles` columns) */
  websiteUrl: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  youtubeUrl: string | null;
  /** Extra custom links (map to `profile_links` table) */
  links: ProfileLink[];
  /** Phone verification — prepared for later, not active yet */
  phoneVerified: boolean;
  phoneVerificationStatus: string;
}

export interface CreatorMediaSubmission {
  id: string;
  title: string;
  description: string | null;
  mediaType: MediaSubmissionType;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  relatedBookId: string | null;
  status: MediaSubmissionStatus;
  createdAt: string;
}

export interface PublicProfileRow {
  id: string;
  display_name: string | null;
  username?: string | null;
  handle: string | null;
  avatar_url: string | null;
  provider_avatar_url?: string | null;
  cover_url: string | null;
  bio: string | null;
  pen_name: string | null;
  full_name: string | null;
  provider_full_name?: string | null;
  account_type: string;
  verification_type: string;
  creator_status: string;
  creator_badge?: string | null;
  publisher_sub_type: string | null;
  is_vip: boolean;
  is_creator?: boolean | null;
  is_adib?: boolean | null;
  author_id?: string | null;
  works_count: number;
  read_count: number;
  followers_count: number;
  likes_count: number;
}

/**
 * The "@handle" text to show for a profile (without the leading "@"): the
 * user-chosen {@link UserProfile.username} when set, otherwise the derived
 * {@link UserProfile.handle} fallback.
 */
export function profileHandle(
  profile: Pick<UserProfile, "username" | "handle">
): string {
  return profile.username?.trim() || profile.handle;
}

/** Builds 1–2 letter initials from a display name for avatar placeholders. */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * True when the account is a "Muallif akkaunti". An account counts as an author
 * if the admin linked it to an `authors` row (`authorId`) OR its account type is
 * an author/writer type (adib). A plain reader is never treated as an author.
 */
export function isAuthorAccount(
  profile: Pick<UserProfile, "authorId" | "accountType">
): boolean {
  return (
    !!profile.authorId ||
    profile.accountType === "adib" ||
    profile.accountType === "creator_adib"
  );
}

const ACCOUNT_TYPES: AccountType[] = [
  "reader",
  "creator",
  "adib",
  "creator_adib",
  "vip",
  "publisher",
  "company",
];

const VERIFICATION_TYPES: VerificationType[] = [
  "none",
  "creator_blue",
  "adib_green",
  "creator_adib_gold",
  "vip_yellow",
  "publisher_black",
  "company_black",
];

/**
 * The single source of truth for turning a raw DB profile row (from ANY view —
 * `profiles`, `mobile_public_profiles`, a So'zLab author join) into an
 * {@link AccountType}. `account_type = 'author'` OR a linked `author_id` both
 * mean the login is a writer and surface as the green "adib" type.
 */
export function resolveAccountType(input: {
  account_type?: string | null;
  is_creator?: boolean | null;
  is_adib?: boolean | null;
  author_id?: string | null;
}): AccountType {
  if (input.is_creator && input.is_adib) return "creator_adib";
  if (input.is_adib) return "adib";
  if (input.account_type === "author" || input.author_id) return "adib";
  if (input.is_creator) return "creator";
  const at = input.account_type ?? undefined;
  if (at && ACCOUNT_TYPES.includes(at as AccountType)) return at as AccountType;
  return "reader";
}

/**
 * The badge tier. An explicit DB `verification_type` is honoured ONLY when it is
 * a real badge — a stored "none" (the default the admin never changed) must not
 * suppress an author/creator's badge, so it is derived from the account type
 * instead. This is why a linked Muallif (adib) always shows the green "Adib"
 * tick, everywhere the same profile is rendered.
 */
export function resolveVerificationType(
  accountType: AccountType,
  rawVerification?: string | null,
  isVip?: boolean | null
): VerificationType {
  const rv = rawVerification as VerificationType;
  if (VERIFICATION_TYPES.includes(rv) && rv !== "none") return rv;
  return deriveVerificationType(accountType, !!isVip);
}

/**
 * True only once the admin has APPROVED the creator application — the "Ijodkor"
 * badge must never appear on a pending/rejected request (spec #8). Requires BOTH
 * `is_creator = true` AND `creator_status = 'approved'`.
 */
export function isApprovedCreator(
  profile: Pick<UserProfile, "isCreator" | "creatorStatus">
): boolean {
  return profile.isCreator === true && profile.creatorStatus === "approved";
}

/**
 * The single premium badge shown next to a name across the app (spec #6). The
 * UI logic wins over the raw `creator_badge` column:
 *   author + approved creator → "Ijodkor + Muallif" (gold)
 *   approved creator only     → "Ijodkor" (blue)
 *   author only               → "Muallif" (green)
 *   otherwise                 → null (fall back to the account's own badge)
 */
export function resolveDisplayBadge(
  profile: Pick<UserProfile, "authorId" | "accountType" | "isCreator" | "creatorStatus">
): { label: string; type: VerificationType } | null {
  const author = isAuthorAccount(profile);
  const creator = isApprovedCreator(profile);
  if (author && creator) return { label: "Ijodkor + Muallif", type: "creator_adib_gold" };
  if (creator) return { label: "Ijodkor", type: "creator_blue" };
  if (author) return { label: "Muallif", type: "adib_green" };
  return null;
}

/**
 * The badge TYPE to render next to a name for ANY user, from raw DB fields —
 * the same combined logic as {@link resolveDisplayBadge} so the header, So'zLab
 * and the profile always show the identical icon (gold "Ijodkor + Muallif" /
 * blue "Ijodkor" / green "Muallif" / vip / stored badge / none).
 * `is_creator` is admin-set only on approval, so when `creator_status` is absent
 * we treat `is_creator = true` as approved.
 */
export function resolveBadgeType(input: {
  account_type?: string | null;
  is_creator?: boolean | null;
  creator_status?: string | null;
  is_adib?: boolean | null;
  author_id?: string | null;
  verification_type?: string | null;
  is_vip?: boolean | null;
}): VerificationType {
  const isAuthor =
    input.account_type === "author" ||
    input.account_type === "adib" ||
    input.account_type === "creator_adib" ||
    input.is_adib === true ||
    !!input.author_id;
  const isCreator =
    input.is_creator === true &&
    (input.creator_status == null || input.creator_status === "approved");

  if (isAuthor && isCreator) return "creator_adib_gold";
  if (isCreator) return "creator_blue";
  if (isAuthor) return "adib_green";

  const rv = input.verification_type as VerificationType;
  if (VERIFICATION_TYPES.includes(rv) && rv !== "none") return rv;
  if (input.is_vip) return "vip_yellow";
  return "none";
}

export function deriveVerificationType(
  accountType: AccountType,
  isVip: boolean
): VerificationType {
  if (accountType === "company") return "company_black";
  if (accountType === "publisher") return "publisher_black";
  if (accountType === "creator_adib") return "creator_adib_gold";
  if (accountType === "adib") return "adib_green";
  if (accountType === "creator") return "creator_blue";
  if (isVip) return "vip_yellow";
  return "none";
}

export function accountTypeLabel(
  accountType: AccountType,
  publisherSubType?: PublisherSubType | null
): string {
  switch (accountType) {
    case "reader":
      return "Oddiy kitobxon";
    case "creator":
      return "Ijodkor";
    case "adib":
      return "Adib";
    case "creator_adib":
      return "Ijodkor · Adib";
    case "vip":
      return "AdabiyotX VIP";
    case "publisher":
      return publisherSubTypeLabel(publisherSubType) ?? "Nashriyot";
    case "company":
      return "AdabiyotX kompaniyasi";
    default:
      return "Kitobxon";
  }
}

export function publisherSubTypeLabel(sub?: PublisherSubType | null): string | null {
  switch (sub) {
    case "gigant":
      return "Gigant nashriyot";
    case "independent":
      return "Mustaqil nashriyot";
    case "small":
      return "Kichik nashriyot";
    case "adabiyot_ai":
      return "AdabiyotX kompaniyasi";
    default:
      return null;
  }
}
