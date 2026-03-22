import type { Metadata } from "next";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./globals.css";
import SiteNavigation from "@/components/site-navigation";
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
          <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
            <SiteNavigation />
            {children}
          </GoogleOAuthProvider>
      </body>
    </html>
  );
}