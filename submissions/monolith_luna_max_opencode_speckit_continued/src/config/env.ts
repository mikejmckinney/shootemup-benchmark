export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface PublicEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  [key: string]: unknown;
}

export function readPublicConfig(env: PublicEnv = import.meta.env): PublicConfig {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function hasPublicConfig(env: PublicEnv = import.meta.env): boolean {
  return Boolean(env.VITE_SUPABASE_URL?.trim() && env.VITE_SUPABASE_ANON_KEY?.trim());
}
