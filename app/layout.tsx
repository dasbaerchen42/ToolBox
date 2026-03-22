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
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  console.log("SERVER clientId =", clientId);

  const content = (
    <>
      <SiteNavigation />
      {children}
      <div style={{ display: "none" }} id="debug-client-id">
        {clientId ? `clientId exists: ${clientId}` : "clientId missing"}
      </div>
    </>
  );

  return (
    <html lang="zh-TW">
      <body className="font-mono tracking-[0.04em] leading-7 antialiased">
        {clientId ? (
          <GoogleOAuthProvider clientId={clientId}>
            {content}
          </GoogleOAuthProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
