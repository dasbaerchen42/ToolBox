import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("stories")
    .select("id, character_slug, title, type, order_index, excerpt, content")
    .eq("id", id)
    .eq("published", true)
    .single();

  if (error) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json(data);
}
