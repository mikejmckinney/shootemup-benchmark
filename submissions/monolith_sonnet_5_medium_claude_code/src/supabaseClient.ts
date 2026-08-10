import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Only the publishable/anon key ever ships to the browser. It is safe to
// expose: RLS policies on the `leaderboard` table are the real gate.
export const supabase = url && key ? createClient(url, key) : null;

export const supabaseConfigured = Boolean(supabase);
