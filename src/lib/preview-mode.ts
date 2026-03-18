import { cookies } from "next/headers";

export const PREVIEW_COOKIE_NAME = "lockbox_preview";

export async function isPreviewModeServer(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(PREVIEW_COOKIE_NAME)?.value === "1";
}

export function isPreviewModeClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .includes(`${PREVIEW_COOKIE_NAME}=1`);
}
