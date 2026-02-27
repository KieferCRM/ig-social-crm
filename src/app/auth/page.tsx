import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // server components can't set cookies
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If logged in, go to the app. If not, go to auth.
  if (user) redirect("/app");
  redirect("/auth");
}