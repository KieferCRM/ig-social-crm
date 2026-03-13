// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const isDebugRoute = pathname.startsWith("/_debug");
  const isPingRoute = pathname === "/ping";
  const isAppRoute = pathname.startsWith("/app");
  const isAuthRoute = pathname === "/auth";
  const isHomeRoute = pathname === "/";
  const isLegacySelectWorkspaceRoute = pathname === "/app/select-workspace";

  if (process.env.NODE_ENV === "production" && (isDebugRoute || isPingRoute)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Avoid a network auth roundtrip on public routes when no Supabase auth cookie is present.
  const hasSupabaseAuthCookie = req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
  const shouldCheckSession =
    isAppRoute || ((isHomeRoute || isLegacySelectWorkspaceRoute) && hasSupabaseAuthCookie);

  if (!shouldCheckSession) {
    return res;
  }

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

  // This call refreshes the session cookie when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route access rules
  if (user && (isHomeRoute || isLegacySelectWorkspaceRoute)) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  if (isAppRoute && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/", "/auth", "/app/:path*", "/ping", "/_debug/:path*"],
};
