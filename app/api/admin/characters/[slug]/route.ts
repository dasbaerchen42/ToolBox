import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import type { Database } from "@/lib/database.types";

type CharacterUpdate = Database["public"]["Tables"]["characters"]["Update"];

type Params = { params: Promise<{ slug: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const supabase = createAdminClient();
  const body = await request.json() as CharacterUpdate;

  const { data, error } = await supabase
    .from("characters")
    .update(body)
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
