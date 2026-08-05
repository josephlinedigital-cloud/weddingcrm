const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey
);

export const supabaseConfigurationError =
  "Supabase is not configured for this deployment. Check the project environment variables.";

export function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(supabaseConfigurationError);
  }

  return { supabaseUrl, supabaseKey };
}
