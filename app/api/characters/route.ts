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
    .order("display_order");

  if (error) return serverError("characters.GET", error);
  return NextResponse.json(data);
}
