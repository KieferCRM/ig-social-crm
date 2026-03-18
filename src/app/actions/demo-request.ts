"use server";

import { Resend } from "resend";

export async function submitDemoRequest(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const note = (formData.get("note") as string)?.trim();

  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "Email service not configured." };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "LockboxHQ <onboarding@resend.dev>",
      to: "lockboxhq1@gmail.com",
      subject: `Demo request from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nNote: ${note || "None"}`,
    });

    return { success: true };
  } catch (err) {
    console.error("Resend error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
