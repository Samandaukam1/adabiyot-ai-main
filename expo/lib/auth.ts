import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import { getQueryParams } from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { isLocalMediaUri, resolveProfileAvatarUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import type {
  ProfileRow,
  ProfileUpdate,
} from "@/types/database";
import type { AccountType, UserProfile } from "@/types/profile";
import { resolveAccountType, resolveVerificationType } from "@/types/profile";

// Required so the web browser can finish an auth session after redirect.
WebBrowser.maybeCompleteAuthSession();

export type AuthProviderId = "google" | "apple";

/** Normalised provider metadata used when creating / updating a profile row. */
export interface ProviderData {
  provider: AuthProviderId;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

const FALLBACK_DISPLAY_NAME = "Kitobxon";
const NATIVE_REDIRECT_URI = "rork-app://auth/callback";

function getAuthRedirectUri(): string {
  if (Platform.OS !== "web") return NATIVE_REDIRECT_URI;
  return makeRedirectUri();
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/* ─────────────────────────────  SIGN IN  ────────────────────────────── */

/** Parse the OAuth redirect URL and hand the tokens to Supabase. */
async function createSessionFromUrl(url: string): Promise<Session | null> {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token) return null;
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

export interface SignInResult {
  session: Session;
  provider: AuthProviderId;
  /** Apple only — the full name, available solely on the first sign-in. */
  appleFullName?: string | null;
}

/**
 * Google sign-in via Supabase OAuth + an in-app browser. No client secrets
 * live in the app — the Google provider is configured in the Supabase
 * dashboard. Returns `null` if the user cancels.
 */
export async function signInWithGoogle(): Promise<SignInResult | null> {
  const redirectTo = getAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Google kirish manzili olinmadi");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") return null;
  if (result.type !== "success" || !result.url) {
    throw new Error("Google bilan kirishda xatolik");
  }

  const session = await createSessionFromUrl(result.url);
  if (!session) throw new Error("Sessiya yaratilmadi");
  return { session, provider: "google" };
}

/** Combine the Apple name parts (only present on the first login). */
function formatAppleName(
  name: AppleAuthentication.AppleAuthenticationFullName | null
): string | null {
  if (!name) return null;
  const full = [name.givenName, name.familyName].filter(Boolean).join(" ").trim();
  return full || null;
}

/**
 * Apple sign-in via the native dialog + Supabase `signInWithIdToken`.
 * Returns `null` if the user cancels the system sheet.
 */
export async function signInWithApple(): Promise<SignInResult | null> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    // The user dismissed the Apple sheet.
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error("Apple identifikatsiya tokeni olinmadi");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });
  if (error) throw error;
  if (!data.session) throw new Error("Sessiya yaratilmadi");

  return {
    session: data.session,
    provider: "apple",
    appleFullName: formatAppleName(credential.fullName),
  };
}

/** Is Apple sign-in usable on this device? (iOS 13+ only.) */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/* ─────────────────────────  PROFILE SYNC  ──────────────────────────── */

/**
 * Login restore is DB-first: the RPC owns first-create / provider refresh
 * semantics, then the app reads `public.profiles` as the only UI source.
 */
export async function loadProfileAfterLogin(session: Session): Promise<ProfileRow> {
  const { error: rpcError } = await (supabase as any).rpc("ensure_my_profile_after_login");
  if (rpcError) throw rpcError;

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Profil topilmadi");

  if (__DEV__) {
    console.log("AUTH USER ID", session.user.id);
    console.log("LOADED PROFILE ID", data.id);
    console.log("LOADED PROFILE DISPLAY NAME", data.display_name);
    console.log("LOADED PROFILE AVATAR", data.avatar_url);
  }

  return data as ProfileRow;
}

/* ─────────────────────  ROW <-> UI PROFILE MAPPING  ────────────────── */

function deriveAccountType(row: ProfileRow): AccountType {
  return resolveAccountType({
    account_type: row.account_type,
    is_creator: row.is_creator,
    is_adib: row.is_adib,
    author_id: row.author_id,
  });
}

function deriveHandle(row: ProfileRow): string {
  const email = row.provider_email ?? row.google_email ?? row.apple_email;
  const local = email?.split("@")[0];
  const base = local ?? row.display_name ?? row.full_name ?? row.pen_name ?? "kitobxon";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24) || "kitobxon";
}

/** Map a remote profile row into the local UI profile shape. */
export function profileRowToUserProfile(row: ProfileRow): Partial<UserProfile> {
  const accountType = deriveAccountType(row);
  const verificationType = resolveVerificationType(
    accountType,
    row.verification_type,
    row.is_vip
  );

  const displayName = firstNonEmpty(
    row.display_name,
    row.full_name,
    row.pen_name,
    row.provider_full_name,
    FALLBACK_DISPLAY_NAME
  ) ?? FALLBACK_DISPLAY_NAME;

  return {
    id: row.id,
    displayName,
    username: row.username ?? null,
    handle: deriveHandle(row),
    fullName: row.full_name,
    penName: row.pen_name,
    avatarUrl: resolveProfileAvatarUrl(row.avatar_url, row.provider_avatar_url),
    coverUrl: row.cover_url,
    bio: row.bio,
    accountType,
    verificationType,
    creatorStatus: (row.creator_status as UserProfile["creatorStatus"]) ?? "none",
    isCreator: row.is_creator === true,
    creatorBadge: row.creator_badge ?? null,
    isVip: row.is_vip,
    authorId: row.author_id ?? null,
    websiteUrl: row.website_url,
    instagramUrl: row.instagram_url,
    telegramUrl: row.telegram_url,
    youtubeUrl: row.youtube_url,
    phoneVerified: row.phone_verified,
    phoneVerificationStatus: row.phone_verification_status,
  };
}

/** Map a local UI profile edit into remote `profiles` columns. */
export function userProfilePatchToProfileUpdate(
  patch: Partial<UserProfile>,
  previous?: UserProfile
): ProfileUpdate {
  const update: ProfileUpdate = {
    profile_edited_by_user: true,
    updated_at: new Date().toISOString(),
  };
  if (patch.displayName !== undefined) {
    update.display_name = patch.displayName;
    if (!previous || patch.displayName !== previous.displayName) update.display_name_edited = true;
  }
  if (patch.fullName !== undefined) {
    update.full_name = patch.fullName;
    if (!previous || patch.fullName !== previous.fullName) update.full_name_edited = true;
  }
  if (patch.penName !== undefined) {
    update.pen_name = patch.penName;
    if (!previous || patch.penName !== previous.penName) update.pen_name_edited = true;
  }
  // A local/device-only URI (file:// / content:// / blob://) must NEVER be
  // written to the DB — it would resolve to nothing after relaunch. Only
  // persist remote (uploaded) URLs or an explicit clear (null).
  if (patch.avatarUrl !== undefined && !isLocalMediaUri(patch.avatarUrl)) {
    update.avatar_url = patch.avatarUrl;
    if (!previous || patch.avatarUrl !== previous.avatarUrl) update.avatar_edited = true;
  }
  if (patch.coverUrl !== undefined && !isLocalMediaUri(patch.coverUrl)) {
    update.cover_url = patch.coverUrl;
    if (!previous || patch.coverUrl !== previous.coverUrl) update.cover_edited = true;
  }
  if (patch.bio !== undefined) {
    update.bio = patch.bio;
    if (!previous || patch.bio !== previous.bio) update.bio_edited = true;
  }
  if (patch.websiteUrl !== undefined) update.website_url = patch.websiteUrl;
  if (patch.instagramUrl !== undefined) update.instagram_url = patch.instagramUrl;
  if (patch.telegramUrl !== undefined) update.telegram_url = patch.telegramUrl;
  if (patch.youtubeUrl !== undefined) update.youtube_url = patch.youtubeUrl;
  return update;
}
