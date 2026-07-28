/**
 * delete-own-account — irreversible deletion of the CALLER's own account.
 *
 * Apple App Review guideline 5.1.1 (v) requires an in-app path that actually
 * deletes the account, not a support request. This is that path.
 *
 * Security model:
 *   - The service-role key exists only here, read from the Edge Function
 *     environment. It is never sent to, or reachable from, the mobile app.
 *   - The account to delete is derived from the caller's own JWT
 *     (`auth.getUser(token)`). No user id is accepted from the request body,
 *     so one user can never delete another.
 *   - `delete_user_account_data()` is `security definer` and granted to
 *     `service_role` only, so the anon key cannot invoke it either.
 *
 * Response codes the client relies on:
 *   200 { ok: true }                  deleted
 *   401 { error, code: "unauthorized" } no / expired / invalid token
 *   409 { error, code: "in_progress" }  a deletion for this user is running
 *   429 { error, code: "rate_limited" } too many attempts from this isolate
 *   500 { error, code: "server_error" } nothing was deleted — never lie
 */
// Same pinned version as the other functions in this project.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Best-effort throttle. Per-isolate only — the deletion lock row below is what
 *  actually prevents concurrent deletions of the same account. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_ATTEMPTS;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** SHA-256 of the user id — the audit row must not hold a reversible identifier. */
async function hashUserId(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Only POST is supported.", code: "method" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[delete-own-account] missing environment configuration");
    return json({ error: "Server is not configured.", code: "server_error" }, 500);
  }

  // ── 1. Identify the caller from their own bearer token ──────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return json({ error: "Authorization token is required.", code: "unauthorized" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user ?? null;

  if (userError || !user) {
    // Never log the token itself.
    console.warn("[delete-own-account] token rejected:", userError?.message ?? "no user");
    return json({ error: "Session is invalid or expired.", code: "unauthorized" }, 401);
  }

  const userId = user.id;

  if (isRateLimited(userId)) {
    return json({ error: "Too many attempts. Try again shortly.", code: "rate_limited" }, 429);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 2. One deletion per account at a time ───────────────────────────────
  // A short-lived row, not a session advisory lock: PostgREST pools connections,
  // so a session-scoped lock could not be released by a later request.
  const { data: lockAcquired, error: lockError } = await admin.rpc("try_account_deletion_lock", {
    p_user_id: userId,
  });

  if (lockError) {
    console.error("[delete-own-account] lock failed:", lockError.message);
    return json({ error: "Could not start deletion.", code: "server_error" }, 500);
  }
  if (lockAcquired !== true) {
    return json({ error: "Deletion is already in progress.", code: "in_progress" }, 409);
  }

  try {
    // ── 3. Purge every row this account owns ──────────────────────────────
    const { data: report, error: purgeError } = await admin.rpc("delete_user_account_data", {
      p_user_id: userId,
    });

    if (purgeError) {
      console.error("[delete-own-account] purge failed:", purgeError.message);
      return json({ error: "Could not delete account data.", code: "server_error" }, 500);
    }

    // ── 4. Delete the auth identity itself ────────────────────────────────
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error("[delete-own-account] auth delete failed:", authDeleteError.message);
      return json({ error: "Could not delete the account.", code: "server_error" }, 500);
    }

    // ── 5. Audit (no PII) ─────────────────────────────────────────────────
    // Written through the RPC, not a raw insert: the audit table is shared with
    // the admin panel's deletion trail, and the function owns the column names.
    const { error: auditError } = await admin.rpc("record_self_account_deletion", {
      p_user_id: userId,
      p_user_id_hash: await hashUserId(userId),
      p_rows: report ?? {},
      p_client: req.headers.get("x-client-info") ?? null,
    });
    // The account IS gone at this point — a failed audit insert must not turn a
    // successful deletion into an error for the user.
    if (auditError) console.error("[delete-own-account] audit insert failed:", auditError.message);

    return json({ ok: true, deleted: report ?? null }, 200);
  } finally {
    await admin.rpc("release_account_deletion_lock", { p_user_id: userId });
  }
});
