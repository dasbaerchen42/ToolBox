import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

// 驗證邏輯統一放在 lib/admin-auth.ts，這裡只負責把結果轉成 HTTP 回應，
// 避免兩份實作各自漂移（曾經就是各寫一份，其中一份漏了 aud 檢查）。
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }
  return NextResponse.json({ isAdmin: true });
}
