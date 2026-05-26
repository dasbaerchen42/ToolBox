import type { Metadata } from "next";
import "./globals.css";
import SiteNavigation from "@/components/site-navigation";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Das Baerchen Tool Box",
  description: "寫作工具集・故事館・Das Baerchen",
  verification: {
    google: "iussrliej7Z_Mq1_thPKiAdmcmkJwLCtLS7Qli4in3k",
  },
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
