import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

import { VisitSource } from "@/components/landing/visit-source";

import "./globals.css";

const code = Geist_Mono({ subsets: ["latin"], variable: "--font-code" });

// Satoshi is served from this site, so no visitor's IP goes to Fontshare.
// scripts/satoshi.ts fetches the file before dev and build, and it is never
// committed: its licence forbids it in a public repository.
const satoshi = localFont({
  src: "../fonts/Satoshi-Variable.woff2",
  weight: "300 900",
  variable: "--font-satoshi",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://shipcut.dev"),
  title: { default: "shipcut", template: "%s, shipcut" },
  description:
    "Your coding agent writes a Playwright script. shipcut records it frame by frame and edits it like a person would.",
  openGraph: { siteName: "shipcut", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${satoshi.variable} ${code.variable}`}>
      <body>
        {children}
        <Analytics />
        <VisitSource />
      </body>
    </html>
  );
}
