import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAME, PRODUCT_STAGE_LABEL } from "@/lib/features";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} • ${PRODUCT_STAGE_LABEL}`,
  description: "Social-first lead ops CRM for solo operators managing inbound leads and disciplined follow-up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
