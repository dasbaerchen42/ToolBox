// Admin 寫入欄位白名單 + pick——只取允許欄位寫進 DB，擋 mass assignment。
// 不讓 id / created_at / updated_at / 未知欄位透過 request body 混進 insert/update。

export const STORY_WRITE_FIELDS = [
  "character_slug",
  "title",
  "type",
  "order_index",
  "excerpt",
  "content",
  "published",
] as const;

export const CHARACTER_WRITE_FIELDS = [
  "slug",
  "name",
  "job",
  "age",
  "tagline",
  "chat_link",
  "chat_link_alt",
  "display_order",
  "coming_soon",
] as const;

// 只挑白名單中「有出現且非 undefined」的欄位；其餘一律丟棄。
export function pickFields<K extends string>(
  body: unknown,
  fields: readonly K[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (body && typeof body === "object") {
    const src = body as Record<string, unknown>;
    for (const f of fields) {
      if (f in src && src[f] !== undefined) out[f] = src[f];
    }
  }
  return out;
}
