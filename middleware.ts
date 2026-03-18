// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { PREVIEW_COOKIE_NAME } from "@/lib/preview-mode";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const previewParam = req.nextUrl.searchParams.get("preview");
  const isPingRoute = pathname === "/ping";
  const isAppRoute = pathname.startsWith("/app");
  const isHomeRoute = pathname === "/";
  const isLegacySelectWorkspaceRoute = pathname === "/app/select-workspace";
  const previewEnabled =
    previewParam === "1" || req.cookies.get(PREVIEW_COOKIE_NAME)?.value === "1";

  if (previewParam === "1") {
    res.cookies.set(PREVIEW_COOKIE_NAME, "1", {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      secure: req.nextUrl.protocol === "https:",
    });
  }

  if (process.env.NODE_ENV === "production" && isPingRoute) {
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

  if (previewEnabled && isAppRoute) {
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
  matcher: ["/", "/auth", "/app/:path*", "/ping"],
};
