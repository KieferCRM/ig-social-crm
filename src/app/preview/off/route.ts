import { NextResponse } from "next/server";
import { PREVIEW_COOKIE_NAME } from "@/lib/preview-mode";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/auth", url.origin);
  const response = NextResponse.redirect(target);
  response.cookies.set(PREVIEW_COOKIE_NAME, "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 0,
    secure: url.protocol === "https:",
  });
  return response;
}
