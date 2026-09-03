import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client is created only when both env vars are present.
 *
 * Without them the app still runs: `store.ts` falls back to localStorage and
 * the UI shows a "local mode" banner. That keeps the calculator usable offline
 * and lets the project boot on a fresh clone before anyone has provisioned a
 * Supabase project.
 *
 * Only the anon (publishable) key belongs here — it is safe to expose to the
 * browser because every table is guarded by row level security. The
 * service_role key must never appear in client code or in this repository.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Narrowing helper for the many call sites that need a non-null client. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
    );
  }
  return supabase;
}
