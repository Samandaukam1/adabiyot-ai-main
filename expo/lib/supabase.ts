import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://jrwtggbxveficgglccxq.supabase.co";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyd3RnZ2J4dmVmaWNnZ2xjY3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODQ3NTQsImV4cCI6MjA5NjY2MDc1NH0.cetiMjsvysZL5EPveJ2BAmAcQWAA3KG8Et3bvuNlsOY";

if (__DEV__) {
  console.log("[Supabase] URL exists:", !!supabaseUrl);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});
