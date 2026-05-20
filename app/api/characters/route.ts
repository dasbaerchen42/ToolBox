import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
