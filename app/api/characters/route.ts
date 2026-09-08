import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { serverError } from "@/lib/api-error";

export async function GET() {
  const { data, error } = await supabase
    .from("characters")
    .select(`
      *,
      stories (
        id,
        title,
        type,
        order_index,
        excerpt,
        published
      )
    `)
    // 未發布的故事本來就被 RLS 擋掉，這裡再明寫一次：
    // 別人 fork 這個專案卻漏跑 supabase-schema.sql 的 RLS 段落時，
    // 草稿不會因為少一條 policy 就整篇從公開 API 流出去。
    .eq("stories.published", true)
    .order("display_order");

  if (error) return serverError("characters.GET", error);
  return NextResponse.json(data);
}
