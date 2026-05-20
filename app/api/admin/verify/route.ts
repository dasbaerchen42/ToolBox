import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);

  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    );
    if (!res.ok) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const tokenInfo = await res.json();
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail || tokenInfo.email !== adminEmail) {
      return NextResponse.json({ isAdmin: false }, { status: 403 });
    }

    return NextResponse.json({ isAdmin: true });
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }
}
