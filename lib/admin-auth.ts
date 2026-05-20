import { NextRequest } from "next/server";

export async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const accessToken = authHeader.slice(7);

  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    );
    if (!res.ok) return false;

    const tokenInfo = await res.json();
    const adminEmail = process.env.ADMIN_EMAIL;

    return Boolean(adminEmail && tokenInfo.email === adminEmail);
  } catch {
    return false;
  }
}
