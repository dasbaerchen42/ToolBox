import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { pickFields, STORY_WRITE_FIELDS } from "@/lib/admin-fields";
import { serverError } from "@/lib/api-error";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "找不到" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const body = pickFields(await request.json(), STORY_WRITE_FIELDS);

  const { data, error } = await supabase
    .from("stories")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) return serverError("admin.stories.id", error);
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", id);

  if (error) return serverError("admin.stories.id", error);
  return new NextResponse(null, { status: 204 });
}
