import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { serverError } from "@/lib/api-error";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { slug } = await params;

  const { data: character, error: charError } = await supabase
    .from("characters")
    .select("*")
    .eq("slug", slug)
    .single();

  if (charError) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const { data: stories, error: storiesError } = await supabase
    .from("stories")
    .select("id, title, type, order_index, excerpt")
    .eq("character_slug", slug)
    .eq("published", true)
    .order("order_index");

  if (storiesError) {
    return serverError("stories.bySlug", storiesError);
  }

  return NextResponse.json(Object.assign({}, character, { stories: stories ?? [] }));
}
