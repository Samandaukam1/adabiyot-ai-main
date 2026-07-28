import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import {
  createSessionFromParams,
  createSessionFromUrl,
  loadProfileAfterLogin,
  signInWithApple as runAppleSignIn,
  signInWithGoogle as runGoogleSignIn,
  type AuthCallbackParams,
} from "@/lib/auth";
import { setCurrentUserId } from "@/lib/userStorage";
import type { ProfileRow } from "@/types/database";

const GUEST_KEY = "adabiyot.guest.v1";

/**
 * Delete every persisted Supabase session key (`sb-<ref>-auth-token`, plus the
 * PKCE code verifier). Backed by localStorage on web and the native store on
 * device, so this is the last line of defence against a sign-out that the
 * network refused: without it a page refresh re-hydrates the old session.
 */
async function purgePersistedAuthKeys(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter((k) => /^sb-.+-auth-token/.test(k));
    if (authKeys.length) await AsyncStorage.multiRemove(authKeys);
  } catch (error) {
    console.warn("[auth] could not purge persisted session", error);
  }
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<"google" | "apple" | null>(null);
  // Avoid loading the same profile row repeatedly for restored sessions.
  const syncedUserId = useRef<string | null>(null);

  const syncProfile = useCallback(
    async (nextSession: Session): Promise<ProfileRow> => {
      const row = await loadProfileAfterLogin(nextSession);
      syncedUserId.current = nextSession.user.id;
      setProfileRow(row);
      return row;
    },
    []
  );

  // Restore any persisted session + guest flag on launch.
  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data }, guest] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(GUEST_KEY),
      ]);
      const restoredSession = data.session ?? null;
      if (restoredSession && syncedUserId.current !== restoredSession.user.id) {
        try {
          await syncProfile(restoredSession);
        } catch (error) {
          console.warn("[auth] profile restore failed", error);
          await supabase.auth.signOut().catch(() => {});
          if (!active) return;
          setSession(null);
          setProfileRow(null);
          setIsGuest(false);
          setLoading(false);
          return;
        }
      }
      if (!active) return;
      setSession(restoredSession);
      setIsGuest(restoredSession ? false : guest === "1");
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      if (!next) {
        setProfileRow(null);
        syncedUserId.current = null;
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [syncProfile]);

  // Keep the imperative storage holder in sync so non-React call sites scope
  // their AsyncStorage keys to the active account.
  useEffect(() => {
    setCurrentUserId(session?.user?.id ?? null);
  }, [session]);

  // Keep tokens fresh only while the app is foregrounded (Supabase guidance).
  useEffect(() => {
    const onChange = (state: string) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    supabase.auth.startAutoRefresh();
    const listener = AppState.addEventListener("change", onChange);
    return () => listener.remove();
  }, []);

  const clearGuest = useCallback(async () => {
    setIsGuest(false);
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setSigningIn("google");
    setLoading(true);
    try {
      const result = await runGoogleSignIn();
      if (!result) return false; // cancelled
      await clearGuest();
      await syncProfile(result.session);
      setSession(result.session);
      return true;
    } finally {
      setLoading(false);
      setSigningIn(null);
    }
  }, [clearGuest, syncProfile]);

  const signInWithApple = useCallback(async (): Promise<boolean> => {
    setSigningIn("apple");
    setLoading(true);
    try {
      const result = await runAppleSignIn();
      if (!result) return false; // cancelled
      await clearGuest();
      await syncProfile(result.session);
      setSession(result.session);
      return true;
    } finally {
      setLoading(false);
      setSigningIn(null);
    }
  }, [clearGuest, syncProfile]);

  /**
   * Finish a sign-in that came back as a redirect rather than through the
   * in-app browser promise — the `adabiyotx://auth/callback` deep link on
   * native, or `/auth/callback` on the web. Accepts either the raw URL or the
   * already-parsed params.
   */
  const completeOAuthCallback = useCallback(
    async (input: string | AuthCallbackParams): Promise<boolean> => {
      setLoading(true);
      try {
        let next: Session | null = null;
        try {
          next =
            typeof input === "string"
              ? await createSessionFromUrl(input)
              : await createSessionFromParams(input);
        } catch (error) {
          // Exchange failed — but a session may already exist (a second mount
          // of this screen, a replayed URL). Only rethrow if there really is
          // none, so the user sees the true reason rather than a blank retry.
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw error;
          console.warn("[AuthCallback] exchange failed but a session exists", error);
          next = data.session;
        }

        // The callback may carry nothing usable (e.g. a bare visit to the
        // route) — an already-restored session still counts as success.
        if (!next) next = (await supabase.auth.getSession()).data.session ?? null;
        if (!next) return false;

        await clearGuest();
        // The profile RPC must never cost the user their session: they are
        // signed in, and the row is re-synced on the next focus anyway.
        try {
          await syncProfile(next);
        } catch (error) {
          console.error("[AuthCallback] profile sync failed:", error);
        }
        setSession(next);
        return true;
      } finally {
        setLoading(false);
      }
    },
    [clearGuest, syncProfile]
  );

  const continueAsGuest = useCallback(async () => {
    setIsGuest(true);
    await AsyncStorage.setItem(GUEST_KEY, "1").catch(() => {});
  }, []);

  /**
   * End the session on this device.
   *
   * `supabase.auth.signOut()` bails out *before* clearing local storage when
   * its network call fails with anything other than 401/403/404 — so an
   * offline (or slow) sign-out would leave the token on disk and the user
   * would still be logged in after a refresh. We therefore use the `local`
   * scope and always purge the persisted `sb-*-auth-token` keys ourselves.
   *
   * Throws only when the session genuinely survived, so the caller can tell
   * the user something actually went wrong.
   */
  const signOut = useCallback(async () => {
    let failure: unknown = null;
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) failure = error;
    } catch (error) {
      failure = error;
    }

    if (failure) {
      console.warn("[auth] signOut request failed, purging locally", failure);
      await purgePersistedAuthKeys();
    }

    setSession(null);
    setProfileRow(null);
    syncedUserId.current = null;
    setIsGuest(false);
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});

    const { data } = await supabase.auth
      .getSession()
      .catch(() => ({ data: { session: null } }));
    if (data.session) {
      throw failure instanceof Error
        ? failure
        : new Error("Sessiyani tugatib bo'lmadi.");
    }
  }, []);

  /** Manually refresh the cached profile row (e.g. after an edit). */
  const refreshProfileRow = useCallback(async (): Promise<ProfileRow | null> => {
    if (!session?.user) return null;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    if (data) {
      setProfileRow(data as ProfileRow);
      return data as ProfileRow;
    }
    return null;
  }, [session]);

  return useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      userId: session?.user?.id ?? null,
      profileRow,
      isAuthenticated: !!session,
      isGuest,
      loading,
      signingIn,
      signInWithGoogle,
      signInWithApple,
      completeOAuthCallback,
      continueAsGuest,
      signOut,
      refreshProfileRow,
    }),
    [
      session,
      profileRow,
      isGuest,
      loading,
      signingIn,
      signInWithGoogle,
      signInWithApple,
      completeOAuthCallback,
      continueAsGuest,
      signOut,
      refreshProfileRow,
    ]
  );
});
