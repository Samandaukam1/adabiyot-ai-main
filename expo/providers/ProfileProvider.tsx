import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  profileRowToUserProfile,
  userProfilePatchToProfileUpdate,
} from "@/lib/auth";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { submitCreatorApplication, type CreatorApplicationInput, type CreatorApplicationResult } from "@/lib/creator";
import { saveUsername } from "@/lib/username";
import { useAuth } from "@/providers/AuthProvider";
import { userScopedKey } from "@/lib/userStorage";
import type {
  CreatorMediaSubmission,
  MediaSubmissionType,
  UserProfile,
} from "@/types/profile";
import { deriveVerificationType } from "@/types/profile";

const PROFILE_BASE = "profile.v2";

// A neutral, EMPTY profile. No fake name/counts so a brand-new account never
// shows another user's (or demo) identity, followers or likes.
const DEFAULT_PROFILE: UserProfile = {
  id: "guest",
  displayName: "Kitobxon",
  username: null,
  handle: "kitobxon",
  avatarUrl: null,
  coverUrl: null,
  bio: null,
  penName: null,
  fullName: null,
  accountType: "reader",
  verificationType: "none",
  creatorStatus: "none",
  publisherSubType: null,
  isCreator: false,
  creatorBadge: null,
  isVip: false,
  authorId: null,
  phoneVerified: false,
  phoneVerificationStatus: "not_started",
  worksCount: 0,
  readCount: 0,
  followersCount: 0,
  likesCount: 0,
  websiteUrl: null,
  instagramUrl: null,
  telegramUrl: null,
  youtubeUrl: null,
  links: [],
};

interface PersistedProfileState {
  profile: UserProfile;
  submissions: CreatorMediaSubmission[];
}

const defaultPersisted: PersistedProfileState = {
  profile: DEFAULT_PROFILE,
  submissions: [],
};

const EDIT_FLAG_KEYS = [
  "profile_edited_by_user",
  "display_name_edited",
  "full_name_edited",
  "pen_name_edited",
  "avatar_edited",
  "bio_edited",
  "cover_edited",
] as const;

function isMissingColumnError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("column") && message.includes("does not exist");
}

function stripEditedFlags<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const next: Partial<T> = { ...patch };
  for (const key of EDIT_FLAG_KEYS) {
    delete next[key as keyof T];
  }
  return next;
}

export const [ProfileProvider, useProfile] = createContextHook(() => {
  const {
    profileRow,
    userId,
    user,
    isAuthenticated,
    loading: authLoading,
    refreshProfileRow,
  } = useAuth();
  const [state, setState] = useState<PersistedProfileState>(defaultPersisted);
  const [loading, setLoading] = useState(true);
  const hydratedProfileKey = useRef<string | null>(null);
  const profileRef = useRef<UserProfile>(DEFAULT_PROFILE);

  // Profile cache is namespaced per account so identities never bleed across
  // Google / Apple / guest sessions on the same device.
  const storageKey = userScopedKey(PROFILE_BASE, userId);
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  const effectiveProfile = useMemo<UserProfile>(() => {
    const base: UserProfile =
      !isAuthenticated || !profileRow
        ? state.profile
        : { ...state.profile, ...profileRowToUserProfile(profileRow) };

    // If neither avatar_url nor provider_avatar_url is saved in the DB yet,
    // fall back to the OAuth provider photo stored in the session user_metadata
    // (Google sends avatar_url / picture; Apple rarely sends one).
    if (!base.avatarUrl && user?.user_metadata) {
      const meta = user.user_metadata as Record<string, string | undefined>;
      const providerAvatar = resolveProfileAvatarUrl(meta.avatar_url, meta.picture);
      if (providerAvatar) return { ...base, avatarUrl: providerAvatar };
    }

    return base;
  }, [isAuthenticated, profileRow, state.profile, user]);

  useEffect(() => {
    profileRef.current = effectiveProfile;
  }, [effectiveProfile]);

  // (Re)load the scoped cache whenever the account changes. This resets the
  // in-memory profile immediately on account switch, before re-hydration.
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(true);
    hydratedProfileKey.current = null;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedProfileState>;
          setState({
            profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) },
            submissions: parsed.submissions ?? [],
          });
        } else {
          setState(defaultPersisted);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storageKey, authLoading]);

  // Hydrate the persisted profile from the authoritative Supabase row.
  useEffect(() => {
    if (authLoading || loading) return;

    if (!isAuthenticated) {
      hydratedProfileKey.current = null;
      return;
    }

    if (!userId || !profileRow) return;

    const rowKey = [
      userId,
      profileRow.updated_at,
      profileRow.display_name,
      profileRow.full_name,
      profileRow.pen_name,
      profileRow.bio,
      profileRow.avatar_url,
      profileRow.cover_url,
      profileRow.provider_full_name,
      profileRow.provider_avatar_url,
      profileRow.verification_type,
      profileRow.account_type,
      profileRow.author_id,
      profileRow.username,
      profileRow.is_creator,
      profileRow.creator_status,
      profileRow.creator_badge,
      profileRow.is_adib,
      profileRow.is_vip,
    ].join("|");

    if (hydratedProfileKey.current === rowKey) return;

    hydratedProfileKey.current = rowKey;
    setState((prev) => {
      const updated: UserProfile = {
        ...prev.profile,
        ...profileRowToUserProfile(profileRow),
      };
      const next = { ...prev, profile: updated };
      AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [authLoading, isAuthenticated, loading, profileRow, userId]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const previousProfile = profileRef.current;
      setState((prev) => {
        const updated: UserProfile = { ...prev.profile, ...patch };
        updated.verificationType = deriveVerificationType(
          updated.accountType,
          updated.isVip
        );
        const next = { ...prev, profile: updated };
        AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch(() => {});
        return next;
      });

      if (userId) {
        const remotePatch = userProfilePatchToProfileUpdate(patch, previousProfile);
        if (Object.keys(remotePatch).length > 0) {
          try {
            let { data, error } = await (supabase as any)
              .from("profiles")
              .update(remotePatch)
              .eq("id", userId)
              .select("*")
              .maybeSingle();
            if (error && isMissingColumnError(error)) {
              const fallbackPatch = stripEditedFlags(remotePatch as Record<string, unknown>);
              const retry = await (supabase as any)
                .from("profiles")
                .update(fallbackPatch)
                .eq("id", userId)
                .select("*")
                .maybeSingle();
              data = retry.data;
              error = retry.error;
            }
            if (__DEV__ && error) {
              console.warn("[profile] remote update failed:", error.message);
            }
            const refetched = await refreshProfileRow();
            const latestRow = refetched ?? data;
            const latest = latestRow ? profileRowToUserProfile(latestRow) : null;
            if (latest) {
              setState((prev) => {
                const updated: UserProfile = { ...prev.profile, ...latest };
                const next = { ...prev, profile: updated };
                AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch(() => {});
                return next;
              });
            }
          } catch {
            // Local profile persistence remains the source of truth if sync fails.
          }
        }
      }
    },
    [refreshProfileRow, userId]
  );

  // Claim / change / clear the unique @username. Goes through the `set_username`
  // RPC (format + uniqueness enforced server-side), then mirrors the result into
  // local state. Throws with a friendly Uzbek message on failure (e.g. taken).
  const setUsername = useCallback(
    async (raw: string): Promise<string | null> => {
      const saved = await saveUsername(raw);
      setState((prev) => {
        const updated: UserProfile = { ...prev.profile, username: saved };
        const next = { ...prev, profile: updated };
        AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch(() => {});
        return next;
      });
      // Pull the authoritative row so any other derived fields stay in sync.
      refreshProfileRow().catch(() => {});
      return saved;
    },
    [refreshProfileRow]
  );

  // Send a real "Ijodkor bo'lish" application to Supabase (admin panel picks it
  // up) and mark the profile `pending`. NEVER auto-approves — the badge only
  // appears after the admin flips is_creator/creator_status.
  const requestCreatorUpgrade = useCallback(
    async (form: CreatorApplicationInput): Promise<CreatorApplicationResult> => {
      if (!userId) throw new Error("Avval tizimga kiring");
      const result = await submitCreatorApplication(userId, profileRef.current.username, form);
      // Optimistically reflect pending locally; the fresh row confirms it.
      setState((prev) => {
        const updated: UserProfile = { ...prev.profile, creatorStatus: "pending" };
        const next = { ...prev, profile: updated };
        AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch(() => {});
        return next;
      });
      refreshProfileRow().catch(() => {});
      return result;
    },
    [userId, refreshProfileRow]
  );

  const submitMedia = useCallback(
    (params: {
      title: string;
      description: string;
      mediaType: MediaSubmissionType;
      relatedBookId?: string;
    }) => {
      const submission: CreatorMediaSubmission = {
        id: `sub-${Date.now()}`,
        title: params.title,
        description: params.description || null,
        mediaType: params.mediaType,
        fileUrl: null,
        thumbnailUrl: null,
        relatedBookId: params.relatedBookId ?? null,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      setState((prev) => {
        const next = {
          ...prev,
          submissions: [submission, ...prev.submissions],
        };
        AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch(() => {});
        return next;
      });
      return submission;
    },
    []
  );

  return useMemo(
    () => ({
      profile: effectiveProfile,
      submissions: state.submissions,
      loading,
      updateProfile,
      setUsername,
      requestCreatorUpgrade,
      submitMedia,
    }),
    [effectiveProfile, state.submissions, loading, updateProfile, setUsername, requestCreatorUpgrade, submitMedia]
  );
});
