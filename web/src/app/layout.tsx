import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";

import { VisitSource } from "@/components/landing/visit-source";

import "./globals.css";

const code = Geist_Mono({ subsets: ["latin"], variable: "--font-code" });

export const metadata: Metadata = {
  title: "shipcut",
  description: "A demo video that updates with every deploy.",
  metadataBase: new URL("https://shipcut.dev"),
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={code.variable}>
      <head>
        {/* Satoshi comes from Fontshare's API: its licence forbids the font file in a public repository. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="preconnect"
          href="https://cdn.fontshare.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@1&display=swap"
        />
      </head>
      <body>
        {children}
        <Analytics />
        <VisitSource />
      </body>
    </html>
  );
}
