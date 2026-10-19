"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN || "vitstudent.ac.in";

/** Null when Supabase isn't configured: the app then runs in demo / dev mode. */
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

export async function signInWithVitGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    // hd= asks Google to show only college accounts; the API still enforces the domain.
    options: { redirectTo: `${window.location.origin}/dashboard`, queryParams: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
  });
}

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
