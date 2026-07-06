import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import {
  loadProfileAfterLogin,
  signInWithApple as runAppleSignIn,
  signInWithGoogle as runGoogleSignIn,
} from "@/lib/auth";
import { setCurrentUserId } from "@/lib/userStorage";
import type { ProfileRow } from "@/types/database";

const GUEST_KEY = "adabiyot.guest.v1";

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

  const continueAsGuest = useCallback(async () => {
    setIsGuest(true);
    await AsyncStorage.setItem(GUEST_KEY, "1").catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setProfileRow(null);
    syncedUserId.current = null;
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
    setIsGuest(false);
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
      continueAsGuest,
      signOut,
      refreshProfileRow,
    ]
  );
});
