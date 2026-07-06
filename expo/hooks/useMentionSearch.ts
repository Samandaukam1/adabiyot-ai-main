import { useEffect, useState } from "react";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";

export interface MentionCandidate {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  verification: string | null;
}

/** Username-style handle: spaces removed + lowercased (Instagram-style). */
export function normalizeHandle(s: string): string {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function mapProfile(p: any): MentionCandidate {
  const name = p.pen_name?.trim() || p.display_name?.trim() || p.full_name?.trim() || "Foydalanuvchi";
  return {
    id: p.id,
    name,
    handle: normalizeHandle(p.pen_name || p.display_name || p.full_name || "user"),
    avatarUrl: resolveProfileAvatarUrl(p.avatar_url, p.provider_avatar_url),
    verification: p.verification_type ?? null,
  };
}

const PROFILE_COLS_WITH_PROVIDER =
  "id,display_name,full_name,pen_name,avatar_url,provider_avatar_url,verification_type";
const PROFILE_COLS = "id,display_name,full_name,pen_name,avatar_url,verification_type";

/**
 * Searches public profiles for an @mention autocomplete. Pass the raw token the
 * user is typing after "@" (without the @). Empty query → no results.
 */
export function useMentionSearch(query: string) {
  const [results, setResults] = useState<MentionCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const filter = `pen_name.ilike.${like},display_name.ilike.${like},full_name.ilike.${like}`;
      let { data, error } = await (supabase as any)
        .from("mobile_public_profiles")
        .select(PROFILE_COLS_WITH_PROVIDER)
        .or(filter)
        .limit(8);
      if (error) {
        const retry = await (supabase as any)
          .from("mobile_public_profiles")
          .select(PROFILE_COLS)
          .or(filter)
          .limit(8);
        data = retry.data;
        error = retry.error;
      }
      // Fall back to the base profiles table if the public view errors out.
      if (error) {
        if (__DEV__) console.warn("[mention] public_profiles failed, trying profiles:", error.message);
        const fb = await (supabase as any)
          .from("profiles")
          .select(PROFILE_COLS_WITH_PROVIDER)
          .or(filter)
          .limit(8);
        data = fb.data;
      }
      if (!active) return;
      setResults(Array.isArray(data) ? data.map(mapProfile) : []);
      setLoading(false);
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading };
}

/**
 * Resolves an @handle (the despaced/lowercased token rendered in a post) back
 * to a profile id so a tapped mention can open that user's page. Works for the
 * common single-word handle; returns null when no profile matches.
 */
export async function resolveHandleToUserId(handle: string): Promise<string | null> {
  const h = normalizeHandle(handle.replace(/^@/, ""));
  if (!h) return null;
  const like = `%${h}%`;
  const filter = `pen_name.ilike.${like},display_name.ilike.${like},full_name.ilike.${like}`;
  let { data, error } = await (supabase as any)
    .from("mobile_public_profiles")
    .select("id,display_name,full_name,pen_name")
    .or(filter)
    .limit(10);
  if (error) {
    const fb = await (supabase as any)
      .from("profiles")
      .select("id,display_name,full_name,pen_name")
      .or(filter)
      .limit(10);
    data = fb.data;
  }
  if (!Array.isArray(data) || data.length === 0) return null;
  const exact = data.find((p: any) =>
    [p.pen_name, p.display_name, p.full_name].some((n) => n && normalizeHandle(n) === h)
  );
  return exact?.id ?? data[0]?.id ?? null;
}

/** Detects an in-progress "@token" immediately before the caret. */
export function getActiveMentionToken(
  text: string,
  caret: number
): { token: string; start: number } | null {
  const upto = text.slice(0, caret);
  const match = upto.match(/(?:^|\s)@([\p{L}\p{N}_.'’-]*)$/u);
  if (!match) return null;
  const token = match[1] ?? "";
  const start = caret - token.length - 1; // index of the '@'
  return { token, start };
}
