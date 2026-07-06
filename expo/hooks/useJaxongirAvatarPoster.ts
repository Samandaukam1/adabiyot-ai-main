import { useMemo } from "react";
import { useJaxongirAvatarVideos, type AvatarVideoState } from "@/hooks/useJaxongirAvatarVideos";

const PREFERRED: AvatarVideoState[] = ["greeting", "idle", "talking", "explaining", "listening"];

/**
 * Returns the best available Jaxongir AI avatar still image (poster) from the
 * avatar-video system, so the same official Jaxongir face is shown across the
 * book "ask AI" bar and chat. Returns null when no poster is available yet
 * (callers fall back to a robot icon).
 */
export function useJaxongirAvatarPoster(): string | null {
  const { videos } = useJaxongirAvatarVideos();
  return useMemo(() => {
    for (const state of PREFERRED) {
      const url = videos[state]?.poster_url;
      if (url) return url;
    }
    for (const v of Object.values(videos)) {
      if (v?.poster_url) return v.poster_url;
    }
    return null;
  }, [videos]);
}
