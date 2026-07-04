import type { Metadata } from "next";
import { Huninn } from "next/font/google";
import "./globals.css";
import SiteNavigation from "@/components/site-navigation";
import { Analytics } from "@vercel/analytics/react";
import { BOOTSTRAP_SCRIPT } from "@/lib/theme-core";

const huninn = Huninn({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-huninn",
});

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
    // bootstrap script 會在 React 水合前改寫 data-theme/inline vars,屬預期差異
    <html
      lang="zh-TW"
      data-theme="huninn"
      className={huninn.variable}
      suppressHydrationWarning
    >
      <body className="tracking-[0.04em] leading-7 antialiased">
        {/* 無閃爍主題 bootstrap:在 body 內容繪製前套用已儲存的主題 */}
        <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
        <SiteNavigation />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
