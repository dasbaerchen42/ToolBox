import type { Metadata } from "next";
import { Huninn } from "next/font/google";
import "./globals.css";
import SiteNavigation from "@/components/site-navigation";
import { BOOTSTRAP_SCRIPT } from "@/lib/theme-core";

const huninn = Huninn({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-huninn",
});

const SITE_URL = "https://tool-box.dasbaerchen.site";
const SITE_NAME = "Das Baerchen Tool Box";
const SITE_DESCRIPTION =
  "給中文寫作者的網頁工具箱：標點轉換、長文切段、影像處理、社群排版，全部在瀏覽器內完成。";

export const metadata: Metadata = {
  // 有了正式網域才設得了。之後 metadata 裡若出現相對路徑(例如 og 圖),
  // 會以這個為基準補成完整網址;沒設的話 build 會直接報錯。
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    // 這裡刻意不寫 url:openGraph 整組會被沒有自己 openGraph 的子頁面繼承,
    // 寫了就會變成每一頁的 og:url 都指向首頁。
    type: "website",
    locale: "zh_TW",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
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
      {/*
        導覽列與 main 疊在同一欄裡:main 用 flex-1 吃掉剩下的高度。
        以前 main 各自寫 min-h-screen,導覽列的高度就變成多出來的,
        結果是每一頁即使內容不滿也一定要捲一個導覽列的距離。
      */}
      <body className="flex min-h-dvh flex-col tracking-[0.04em] leading-7 antialiased">
        {/* 無閃爍主題 bootstrap:在 body 內容繪製前套用已儲存的主題 */}
        <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
        <SiteNavigation />
        {children}
      </body>
    </html>
  );
}
