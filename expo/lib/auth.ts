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

/**
 * The app's own URL scheme, and the OAuth deep link the provider redirects back
 * to on native. MUST stay in sync with `expo.scheme` in app.json — a mismatch is
 * what silently breaks Google sign-in in a TestFlight/App Store build (the
 * in-app browser opens, the user signs in, but the redirect never reaches us).
 *
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs must
 * allow all three of:
 *   adabiyotx://auth/callback
 *   https://adabiyotx.uz/auth/callback
 *   https://www.adabiyotx.uz/auth/callback
 */
const APP_SCHEME = "adabiyotx";
const AUTH_CALLBACK_PATH = "auth/callback";

function getAuthRedirectUri(): string {
  if (Platform.OS === "web") return makeRedirectUri({ path: AUTH_CALLBACK_PATH });
  return makeRedirectUri({ scheme: APP_SCHEME, path: AUTH_CALLBACK_PATH });
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
 * Turn a raw Supabase OAuth error into a friendly, non-crashing message —
 * chiefly for the case where the provider isn't enabled in the dashboard yet.
 */
function friendlyProviderError(error: unknown, label: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/not enabled|unsupported provider|provider is not enabled|validation_failed/i.test(message)) {
    return new Error(`${label} bilan kirish hozircha yoqilmagan. Boshqa usulni tanlang.`);
  }

  // Apple: the native id_token's `aud` claim is ALWAYS the app's bundle id
  // (uz.adabiyotx.app). Supabase rejects it with "Unacceptable audience in
  // id_token" until that exact bundle id is listed in
  //   Supabase Dashboard → Authentication → Providers → Apple
  //     → "Authorized Client IDs"  (comma-separated; add uz.adabiyotx.app)
  // Nothing in the app can work around it, so log loudly in dev and show the
  // user a calm, non-technical message.
  if (/unacceptable audience|invalid audience|bad_jwt|invalid.*id_token/i.test(message)) {
    if (__DEV__) {
      console.error(
        "[AppleLogin] Supabase rejected the id_token audience. Add the bundle id " +
          "`uz.adabiyotx.app` to Supabase → Authentication → Providers → Apple → " +
          "Authorized Client IDs, then retry.",
        message
      );
    }
    return new Error(
      `${label} orqali kirishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.`
    );
  }

  return error instanceof Error ? error : new Error(message);
}

/**
 * Shared OAuth browser flow (works on native and web): ask Supabase for the
 * provider URL, open it, then exchange the redirect for a session. Returns
 * `null` when the user cancels. Used by Google everywhere, and by Apple on web.
 */
async function signInWithOAuthBrowser(
  provider: AuthProviderId,
  label: string,
  queryParams?: Record<string, string>
): Promise<SignInResult | null> {
  const redirectTo = getAuthRedirectUri();
  if (__DEV__) console.log(`[${label}Login] start → redirectTo`, redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true, queryParams },
  });
  if (error) {
    if (__DEV__) console.error(`[${label}Login] signInWithOAuth error`, error.message);
    throw friendlyProviderError(error, label);
  }
  if (!data?.url) throw new Error(`${label} kirish manzili olinmadi`);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") {
    if (__DEV__) console.log(`[${label}Login] canceled by user`);
    return null;
  }
  if (result.type !== "success" || !result.url) {
    if (__DEV__) console.error(`[${label}Login] browser session failed`, result.type);
    throw new Error(
      `${label} orqali kirishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.`
    );
  }

  const session = await createSessionFromUrl(result.url);
  if (!session) throw new Error("Sessiya yaratilmadi");
  if (__DEV__) console.log(`[${label}Login] session created`);
  return { session, provider };
}

/**
 * Google sign-in via Supabase OAuth + an in-app browser. No client secrets
 * live in the app — the Google provider is configured in the Supabase
 * dashboard. Returns `null` if the user cancels.
 */
export async function signInWithGoogle(): Promise<SignInResult | null> {
  return signInWithOAuthBrowser("google", "Google", { prompt: "select_account" });
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
 * Apple sign-in. On the web there is no native Apple sheet, so we use the same
 * Supabase OAuth browser flow as Google (provider `apple`). On iOS we use the
 * native dialog + `signInWithIdToken`. Returns `null` if the user cancels.
 */
export async function signInWithApple(): Promise<SignInResult | null> {
  if (Platform.OS === "web") {
    return signInWithOAuthBrowser("apple", "Apple");
  }

  if (__DEV__) console.log("[AppleLogin] start");

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
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      if (__DEV__) console.log("[AppleLogin] canceled by user");
      return null;
    }
    if (__DEV__) console.error("[AppleLogin] signInAsync error", e);
    throw friendlyProviderError(e, "Apple");
  }

  if (!credential.identityToken) {
    if (__DEV__) console.error("[AppleLogin] identityToken missing");
    throw new Error("Apple orqali kirishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
  }
  if (__DEV__) console.log("[AppleLogin] identityToken exists");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });
  if (error) {
    if (__DEV__) console.error("[AppleLogin] signInWithIdToken error", error.message);
    throw friendlyProviderError(error, "Apple");
  }
  if (!data.session) throw new Error("Sessiya yaratilmadi");
  if (__DEV__) console.log("[AppleLogin] signInWithIdToken success");

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
    if (__DEV__) console.log("AUTH USER ID", session.user.id);
    if (__DEV__) console.log("LOADED PROFILE ID", data.id);
    if (__DEV__) console.log("LOADED PROFILE DISPLAY NAME", data.display_name);
    if (__DEV__) console.log("LOADED PROFILE AVATAR", data.avatar_url);
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
