import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 延遲初始化:module 載入時不建立 client,第一次實際使用時才建。
// 這樣沒有 env 的環境(build 期、新 clone、CI、未設 Supabase 的協作者)
// 匯入本檔不會崩潰;真的缺 env 時,在使用當下丟明確錯誤而非 build 期 crash。
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 環境變數"
    );
  }
  client = createClient(url, key);
  return client;
}

// 對外維持 `supabase.from(...)` 的用法不變:用 Proxy 把存取轉發到延遲建立的 client。
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient() as object, prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
