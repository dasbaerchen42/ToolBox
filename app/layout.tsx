import type { Metadata } from "next";
import "./globals.css";
import SiteNavigation from "@/components/site-navigation";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "My Writing App",
  description: "A writing tool with Google Docs integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="font-mono tracking-[0.04em] leading-7 antialiased">
        <SiteNavigation />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
