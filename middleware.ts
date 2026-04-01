// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  needsAccountTypeSetup,
  readOnboardingStateFromAgentSettings,
} from "@/lib/onboarding";

async function hasLegacyWorkspaceData(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  const [{ data: leadRow }, { data: dealRow }] = await Promise.all([
    supabase.from("leads").select("id").eq("agent_id", userId).limit(1).maybeSingle(),
    supabase.from("deals").select("id").eq("agent_id", userId).limit(1).maybeSingle(),
  ]);

  return Boolean(leadRow?.id || dealRow?.id);
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const isPingRoute = pathname === "/ping";
  const isAppRoute = pathname.startsWith("/app");
  const isSetupRoute = pathname.startsWith("/setup");
  const isAccountTypeSetupRoute = pathname === "/setup/account-type";
  const isHomeRoute = pathname === "/";
  const isLegacySelectWorkspaceRoute = pathname === "/app/select-workspace";

  if (process.env.NODE_ENV === "production" && isPingRoute) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Avoid a network auth roundtrip on public routes when no Supabase auth cookie is present.
  const hasSupabaseAuthCookie = req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
  const shouldCheckSession =
    isAppRoute || isSetupRoute || ((isHomeRoute || isLegacySelectWorkspaceRoute) && hasSupabaseAuthCookie);

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

  if (isSetupRoute && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  let mustChooseAccountType = false;

  if (user) {
    const { data: agentRow } = await supabase
      .from("agents")
      .select("settings")
      .eq("id", user.id)
      .maybeSingle();

    const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
    if (needsAccountTypeSetup(onboardingState)) {
      const legacyWorkspaceExists = await hasLegacyWorkspaceData(supabase, user.id);
      mustChooseAccountType = !legacyWorkspaceExists;
    }
  }

  // Route access rules
  if (user && (isHomeRoute || isLegacySelectWorkspaceRoute)) {
    const url = req.nextUrl.clone();
    url.pathname = mustChooseAccountType ? "/setup/account-type" : "/app";
    return NextResponse.redirect(url);
  }

  if (isAppRoute && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  if (user && mustChooseAccountType && isAppRoute && pathname !== "/app/onboarding") {
    const url = req.nextUrl.clone();
    url.pathname = "/setup/account-type";
    return NextResponse.redirect(url);
  }

  if (user && mustChooseAccountType && isSetupRoute && !isAccountTypeSetupRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/setup/account-type";
    return NextResponse.redirect(url);
  }

  if (user && !mustChooseAccountType && isAccountTypeSetupRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/", "/auth", "/setup/:path*", "/app/:path*", "/ping"],
};
