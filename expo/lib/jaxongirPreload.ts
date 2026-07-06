import { createVideoPlayer } from "expo-video";

let _warmedUrl: string | null = null;

/**
 * Warm the Jaxongir AI greeting clip into expo-video's on-disk cache at app
 * start, so when the assistant opens (e.g. on shake) the greeting plays
 * instantly with no download wait.
 *
 * A view-less background player streams the source through to the end (muted,
 * `useCaching: true`), which fills the disk cache, then releases itself — the
 * cached bytes survive the release. Playback sources must also pass
 * `useCaching: true` with the same URL to read from this cache.
 *
 * Best-effort: any failure is swallowed so it can never block app start.
 */
export function preloadJaxongirVideo(url: string | null | undefined) {
  if (!url || _warmedUrl === url) return;
  _warmedUrl = url;

  try {
    const player = createVideoPlayer({ uri: url, useCaching: true });
    player.muted = true;
    player.loop = false;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { player.pause(); } catch { /* */ }
      try { player.release(); } catch { /* */ }
    };

    try { player.addListener("playToEnd", finish); } catch { /* */ }
    try { player.play(); } catch { /* */ }

    // Safety net: release even if the end event never arrives.
    setTimeout(finish, 20000);
  } catch {
    // Preloading is purely an optimisation — never surface errors.
  }
}
