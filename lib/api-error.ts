import { NextResponse } from "next/server";

// 500 統一回固定訊息，完整錯誤只留在伺服器 log。
// 避免把 Supabase / PostgreSQL 原始錯誤（含資料表結構線索）洩漏給前端。
export function serverError(context: string, error: unknown) {
  console.error(`[api:${context}]`, error);
  return NextResponse.json(
    { error: "伺服器發生錯誤,請稍後再試" },
    { status: 500 }
  );
}
