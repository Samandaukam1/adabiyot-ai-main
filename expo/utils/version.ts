/**
 * App version / build-number comparison for the "update available" check.
 *
 * Pure & deterministic — no platform APIs here, so it's trivially testable.
 * Build numbers (Android versionCode / iOS CFBundleVersion) are the primary
 * signal when both sides have them; otherwise we fall back to semantic version
 * comparison.
 */

/** Split "1.2.3" into numeric segments; tolerates a "v" prefix and build suffixes. */
export function parseVersion(input: string | null | undefined): number[] {
  if (typeof input !== "string") return [];
  const core = input.trim().replace(/^v/i, "").split(/[-+\s]/)[0] ?? "";
  if (!core) return [];
  return core.split(".").map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/**
 * Compare two semantic versions.
 * Returns -1 if `a < b`, 0 if equal, 1 if `a > b`.
 *   compareVersions("1.0.0", "1.0.1") === -1
 *   compareVersions("1.0.2", "1.0.1") ===  1
 *   compareVersions("1.2.0", "1.1.9") ===  1
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Coerce a build number (versionCode / CFBundleVersion) to an integer, or null. */
export function parseBuild(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.trunc(input) : null;
  if (typeof input === "string") {
    const n = parseInt(input.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type UpdateDecision = "none" | "optional" | "force";

export interface VersionCompareInput {
  currentVersion: string;
  currentBuild: number | null;
  latestVersion?: string | null;
  minimumVersion?: string | null;
  latestBuild?: number | null;
  minimumBuild?: number | null;
  forceUpdate?: boolean | null;
}

/**
 * Decide whether to prompt an update:
 *  - "force"    → current is below the minimum supported build/version, or a
 *                 newer build exists AND the server flags force_update.
 *  - "optional" → a newer build/version exists but current is still supported.
 *  - "none"     → up to date.
 */
export function decideUpdate(input: VersionCompareInput): UpdateDecision {
  const {
    currentVersion,
    currentBuild,
    latestVersion,
    minimumVersion,
    latestBuild,
    minimumBuild,
    forceUpdate,
  } = input;

  // Below the minimum supported → hard block.
  let belowMinimum = false;
  if (currentBuild != null && minimumBuild != null) {
    belowMinimum = currentBuild < minimumBuild;
  } else if (minimumVersion) {
    belowMinimum = compareVersions(currentVersion, minimumVersion) < 0;
  }
  if (belowMinimum) return "force";

  // A newer release is available.
  let hasNewer = false;
  if (currentBuild != null && latestBuild != null) {
    hasNewer = currentBuild < latestBuild;
  } else if (latestVersion) {
    hasNewer = compareVersions(currentVersion, latestVersion) < 0;
  }
  if (hasNewer) return forceUpdate ? "force" : "optional";

  return "none";
}
