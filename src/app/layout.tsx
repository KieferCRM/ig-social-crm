import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAME, PRODUCT_STAGE_LABEL } from "@/lib/features";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} • ${PRODUCT_STAGE_LABEL}`,
  description:
    "LockboxHQ is the Smart CRM for inbound real estate agents who want organized deals without manual entry.",
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
