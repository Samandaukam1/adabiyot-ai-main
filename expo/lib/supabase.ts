import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://jrwtggbxveficgglccxq.supabase.co";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyd3RnZ2J4dmVmaWNnZ2xjY3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODQ3NTQsImV4cCI6MjA5NjY2MDc1NH0.cetiMjsvysZL5EPveJ2BAmAcQWAA3KG8Et3bvuNlsOY";

/**
 * Project URL + anon key, for the few call sites that hit an Edge Function
 * directly because they need the raw HTTP status (`supabase.functions.invoke`
 * hides it). Both are public values — the service-role key never lives here.
 */
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

if (__DEV__) {
  console.log("[Supabase] URL exists:", !!supabaseUrl);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the Supabase session so Google/Apple logins survive app restarts.
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,

    // PKCE, explicitly. The auth-js default is `implicit`, which never writes a
    // `…-auth-token-code-verifier` to storage — so when Supabase redirects back
    // with `?code=…` (which it does for Apple), `exchangeCodeForSession()` posts
    // an EMPTY code_verifier and the server rejects the whole exchange with
    // "both auth code and code verifier should be non-empty". That was the
    // "Kirishni yakunlab bo'lmadi" screen. With `pkce` the verifier is stored at
    // sign-in time and the exchange succeeds — identically for Google and Apple,
    // on web and on native.
    flowType: "pkce",

    // `/auth/callback` performs the exchange itself (see app/auth/callback.tsx).
    // Leaving auto-detection on would race it: auth-js consumes the code during
    // `_initialize()`, deletes the verifier and strips `?code=` from the URL, so
    // our own exchange would then fail on an already-spent code.
    detectSessionInUrl: false,
  },
});
