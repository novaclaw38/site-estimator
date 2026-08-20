import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { bodyFont, displayFont, monoFont } from "./fonts";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/client";

export const metadata: Metadata = {
  title: "Site Estimator",
  description: "Turn job-site footage into a costed quote.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}
      >
        <body>
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
