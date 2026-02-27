// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT:
  // This call refreshes the session cookie when needed.
  // We do it for protected areas AND for our /ping test route.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /app/* (your actual app)
  const isAppRoute = req.nextUrl.pathname.startsWith("/app");

  if (isAppRoute && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/ping", "/_debug/:path*"],
};