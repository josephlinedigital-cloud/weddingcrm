const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""

const supabaseKey =
  supabasePublishableKey || supabaseAnonKey

export const supabaseEnv = {
  url: supabaseUrl,
  key: supabaseKey,
  isConfigured: Boolean(supabaseUrl && supabaseKey),
}

export function requireSupabaseEnv() {
  if (!supabaseEnv.isConfigured) {
    throw new Error(
      "Supabase is not configured. Missing NEXT_PUBLIC_SUPABASE_URL or Supabase publishable/anon key."
    )
  }

  return {
    url: supabaseEnv.url,
    key: supabaseEnv.key,
  }
}
