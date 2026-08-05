import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    environment: process.env.VERCEL_ENV ?? "unknown",
    supabaseUrlPresent: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    ),
    publishableKeyPresent: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    ),
    anonKeyPresent: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    ),
  })
}
