"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitDemoRequest(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const note = (formData.get("note") as string)?.trim();

  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

  try {
    await resend.emails.send({
      from: "LockboxHQ <onboarding@resend.dev>",
      to: "lockboxhq1@gmail.com",
      subject: `Demo request from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nNote: ${note || "None"}`,
    });

    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
