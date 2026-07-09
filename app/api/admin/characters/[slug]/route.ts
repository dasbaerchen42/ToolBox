import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { pickFields, CHARACTER_WRITE_FIELDS } from "@/lib/admin-fields";
import { serverError } from "@/lib/api-error";

type Params = { params: Promise<{ slug: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const supabase = createAdminClient();
  const body = pickFields(await request.json(), CHARACTER_WRITE_FIELDS);

  const { data, error } = await supabase
    .from("characters")
    .update(body)
    .eq("slug", slug)
    .select()
    .single();

  if (error) return serverError("admin.characters.slug", error);
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

  if (error) return serverError("admin.characters.slug", error);
  return new NextResponse(null, { status: 204 });
}
