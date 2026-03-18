import { NextResponse } from "next/server";
import { PREVIEW_COOKIE_NAME } from "@/lib/preview-mode";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/app", url.origin);
  const response = NextResponse.redirect(target);
  response.cookies.set(PREVIEW_COOKIE_NAME, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7,
    secure: url.protocol === "https:",
  });
  return response;
}
