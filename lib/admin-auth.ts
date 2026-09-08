import { NextRequest } from "next/server";

// Google tokeninfo v3 對 access token 的回應（只列我們會檢查的欄位）。
// email_verified 在 v3 可能回布林或字串 "true"，兩種都要接。
type TokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
};

const TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo";

/**
 * 驗證 Authorization: Bearer <google access token> 是否屬於管理員。
 *
 * 三道檢查缺一不可：
 * 1. aud（token 是發給誰的）必須等於本站的 OAuth Client ID。
 *    少了這道，任何第三方網站只要拿到管理員的 Google access token，
 *    就能直接打本站的 admin API——tokeninfo 只會告訴你「這 token 對應誰」，
 *    不會告訴你「這 token 是不是本站發的」。
 * 2. email_verified 必須為真。
 * 3. email 必須等於 ADMIN_EMAIL。
 *
 * 環境變數缺任何一個一律 fail closed。
 */
export async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const accessToken = authHeader.slice(7).trim();
  if (!accessToken) return false;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!adminEmail || !clientId) return false;

  try {
    const res = await fetch(
      `${TOKENINFO_ENDPOINT}?access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return false;

    const info = (await res.json()) as TokenInfo;

    if (info.aud !== clientId) return false;
    if (info.email_verified !== true && info.email_verified !== "true") return false;

    return info.email?.trim().toLowerCase() === adminEmail;
  } catch {
    return false;
  }
}
