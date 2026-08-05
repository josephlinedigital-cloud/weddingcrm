import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isPublic = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/forgot-password") || request.nextUrl.pathname.startsWith("/auth/callback") || request.nextUrl.pathname.startsWith("/rsvp") || request.nextUrl.pathname.startsWith("/api/rsvp");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !publishableKey) {
    if (isPublic) return response;
    const url = request.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return response;
}
