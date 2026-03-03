// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { normalizeWorkspaceMode, parseFullAccessUserIds } from "./src/lib/workspace-mode";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const isSelectWorkspaceRoute = pathname === "/app/select-workspace";
  const isTeamRoute = pathname === "/app/team" || pathname.startsWith("/app/team/");

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
  const workspaceMode = normalizeWorkspaceMode(user?.user_metadata?.workspace_mode);
  const fullAccessUsers = parseFullAccessUserIds(process.env.FULL_ACCESS_USER_IDS);
  const hasFullAccess = user ? fullAccessUsers.has(user.id) : false;

  // Route access rules
  const isAppRoute = pathname.startsWith("/app");
  const isAuthRoute = pathname === "/auth";
  const isHomeRoute = pathname === "/";

  if (user && (isAuthRoute || isHomeRoute)) {
    const url = req.nextUrl.clone();
    if (!hasFullAccess && !workspaceMode) {
      url.pathname = "/app/select-workspace";
    } else if (!hasFullAccess && workspaceMode === "team") {
      url.pathname = "/app/team";
    } else {
      url.pathname = "/app";
    }
    return NextResponse.redirect(url);
  }

  if (isAppRoute && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  if (!user || !isAppRoute || hasFullAccess) {
    return res;
  }

  if (!workspaceMode && !isSelectWorkspaceRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/app/select-workspace";
    return NextResponse.redirect(url);
  }

  if (workspaceMode && isSelectWorkspaceRoute) {
    const url = req.nextUrl.clone();
    url.pathname = workspaceMode === "team" ? "/app/team" : "/app";
    return NextResponse.redirect(url);
  }

  if (workspaceMode === "solo" && isTeamRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/", "/auth", "/app/:path*", "/ping", "/_debug/:path*"],
};
