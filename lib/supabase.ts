import { createClient } from "@supabase/supabase-js";

// Supabase publishable project settings are safe for browser clients.
// Environment variables still override these defaults for staging/future migration.
const fallbackUrl = "https://pesgnpbachfjgnglxtxd.supabase.co";
const fallbackPublishableKey = "sb_publishable_J-xuCeuIYPWDLDii-mGVkw_GoVK9cMN";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fallbackPublishableKey;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 20 } }
    })
  : null;
