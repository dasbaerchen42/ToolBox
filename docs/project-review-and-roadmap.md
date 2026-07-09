# 專案健檢報告與未來規劃

> 掃描日期:2026-07-06
> 範圍:全專案(app / components / hooks / lib / scripts / 設定檔)
> 驗證方式:實際執行 `npm run lint`(通過)、`npm test`(51 tests 全過)、`npm run build`(**失敗**,見 P0-1)

---

## 一、現況摘要

| 面向 | 狀態 |
|---|---|
| 框架 | Next.js 16.2.1(App Router + Turbopack)、React 19、TypeScript、Tailwind v4 |
| 功能 | 寫作編輯器、全形轉換、切刀、社群排版、故事站(Supabase)、後台管理、抽籤 |
| 主題系統 | 已完成全站 CSS 變數主題引擎(theme-core + 七款 preset + 自訂/隨機) |
| 測試 | Jest,僅 2 個測試檔(`lib/tools/knife.test.ts`、`lib/validators.test.ts`),51 tests |
| CI | **無**(沒有 `.github/workflows`) |
| Lint | ESLint 9 flat config,目前零警告 |

---

## 二、需改善項目

### P0 — 建議優先處理

#### ✅ P0-1:沒有環境變數時 `npm run build` 直接失敗 — 已修 2026-07-09

> `lib/supabase.ts` 改為延遲初始化:module 載入不建 client,以 Proxy 轉發存取,
> 第一次實際使用才 `createClient`;缺 env 時於使用當下丟明確錯誤,不再 build 期崩潰。
> 已實測「未設 Supabase env 的 `next build`」通過(18 頁全生成)。以下保留原描述。

`lib/supabase.ts` 在 module 頂層用 non-null 斷言建立 client:

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

build 階段收集 `/api/characters` 等頁面資料時,env 不存在就拋出 `supabaseUrl is required`,整個 build 中斷。這代表:

- 新 clone 的環境、未來的 CI、任何沒設 Supabase 的協作者都無法 build。
- **建議**:改為延遲初始化(getter 函式,呼叫時才 `createClient`),或在缺 env 時回傳明確錯誤而非 build 期崩潰;同時將依賴 Supabase 的 API route 標記為動態(依 `node_modules/next/dist/docs/` 本版指南確認寫法)。

#### ✅ P0-2:Admin API 未驗證輸入(mass assignment) — 已修 2026-07-09

> 新增 `lib/admin-fields.ts`：`STORY_WRITE_FIELDS` / `CHARACTER_WRITE_FIELDS` 白名單
> ＋ `pickFields()`。stories 與 characters 的 POST/PUT（共 4 個 route）改為只取
> 白名單欄位再進 insert/update，擋掉 id/created_at/updated_at/未知欄位。
> tsc / eslint / 51 tests / build（18 頁）全通過。以下保留原描述。

#### P0-2(原):Admin API 未驗證輸入(mass assignment)
`app/api/admin/stories/route.ts` 等 POST/PUT 直接把 `request.json()` 的原始 body 丟進 Supabase:

```ts
const body = await request.json();
const { data, error } = await supabase.from("stories").insert(body)...
```

呼叫端可塞任意欄位(覆寫 `id`、`created_at`、不存在的欄位造成 500)。`lib/validators.ts` 只驗編輯器文字格式,API 層完全沒有 schema 驗證。

- **建議**:引入 zod(或手寫 picker)為每個 admin route 定義允許欄位白名單,只挑白名單欄位進 insert/update。

#### ✅ P0-3:建立 CI(GitHub Actions) — 已完成 2026-07-09

> 新增 `.github/workflows/ci.yml`：push / PR 到 main 時跑 `npm ci → lint → test → build`
> （build 已不需 env）。以下保留原描述。

目前 lint / test / build 完全靠人工記得跑。P0-1 這種「build 早就壞了」的問題就是沒 CI 才會潛伏。

- **建議**:加 `.github/workflows/ci.yml`,PR 與 main push 時跑 `npm ci && npm run lint && npm test && npm run build`(build 需先解 P0-1,或在 CI 提供 dummy env)。

### P1 — 短期內值得做

#### P1-1:Admin 驗證邏輯重複
`lib/admin-auth.ts` 的 `verifyAdmin()` 與 `app/api/admin/verify/route.ts` 各自實作了一份幾乎相同的 Google tokeninfo 檢查。

- **建議**:verify route 改呼叫 `verifyAdmin()`;順帶把 tokeninfo 端點從已過時的 `oauth2/v1` 換成 `oauth2/v3`,並考慮短期(如 60 秒)記憶體快取,避免後台每個請求都打一次 Google。

#### ✅ P1-2:API 錯誤訊息直接外洩 — 已修 2026-07-09

> 新增 `lib/api-error.ts` 的 `serverError(context, error)`：完整錯誤 `console.error`
> 留伺服器、前端只收固定訊息。stories/characters（admin + 公開）共 9 處 500 回傳改用它，
> 一處 404 也改為不外洩訊息。以下保留原描述。

#### P1-2(原):API 錯誤訊息直接外洩
所有 route 都 `NextResponse.json({ error: error.message }, { status: 500 })`,把 Supabase/PostgreSQL 原始錯誤(含資料表結構線索)回給前端。

- **建議**:500 回固定訊息,詳細錯誤只 `console.error` 留在伺服器 log。

#### P1-3:測試覆蓋率偏低
有測試的只有 knife 與 validators。以下純函式邏輯複雜、無外部依賴,最適合補測:

- `app/tools/fullwidth/_lib/convert.ts`(208 行轉換規則)
- `lib/social-format.ts`、`lib/editor-stats.ts`、`lib/datetime.ts`
- `lib/theme-core.ts`(對比防呆 ensureReadable、隨機配色、FIFO 上限)
- `hooks/useEditorHistory.ts`(自建 undo/redo 堆疊,回歸風險高)

#### P1-4:`lib/theme.ts` 過渡層清理
主題引擎上線後 `getThemeClasses()` 的 `ThemeMode` 參數已被忽略,但 9 個頁面仍傳入並各自留著相關 state/props 痕跡。

- **建議**:移除 `ThemeMode` 參數與呼叫端殘留,`ThemeClasses` 直接匯出常數物件即可,少一層假的間接。

### P2 — 整理與衛生

| 項目 | 說明 |
|---|---|
| P2-1 `public/gacha.html` | 705 行獨立 HTML 用 iframe 嵌入,自帶一套寫死的樣式,不吃全站主題。建議改寫成 React page(`app/gacha`),樣式接 token。 |
| P2-2 README 過期 | 未提及 Supabase 環境變數(`.env.example` 已有 4 個)、故事站與後台功能、測試指令;Markdown code fence 從「2. Install dependencies」起格式破損,後半段全被吃進程式碼區塊。 |
| P2-3 `app/my-writing-app.code-workspace` | 編輯器工作區檔誤放在 `app/` 內,應移出 repo 或加入 `.gitignore`。 |
| P2-4 package 名稱 | `package.json` name 為 `my-writing-app`,與 repo 名 ToolBox 不一致,建議統一。 |
| P2-5 Huninn 字體 build 警告 | `Failed to find font override values for font 'Huninn'`,無 fallback font metrics,會有些微 CLS。可改 `next/font/local` 自架或接受現狀並註記。 |
| P2-6 `next.config.ts` 空白 | 可考慮補安全 headers(CSP、X-Frame-Options 等,注意 gacha iframe 需同源允許)。 |

---

## 三、未來規劃建議(Roadmap)

### 近期(1–2 個迭代)
1. **修 build + 上 CI**(P0-1、P0-3)——所有後續開發的地基。
2. **API 驗證層**(P0-2、P1-2)——後台寫入路徑加白名單驗證與統一錯誤處理。
3. **補核心純函式測試**(P1-3)——優先 convert.ts 與 useEditorHistory。

### 中期
4. **編輯器文件雲端同步**:目前文件只存 localStorage(`orange-writing-documents`),清瀏覽器資料即遺失。可用既有 Supabase 加上 Supabase Auth(Google 登入已有)+ RLS,做多裝置同步與版本備份;匯出 zip 的 jszip 已在依賴中,可先做「一鍵全量匯出備份」作為過渡。
5. **gacha 改寫入主站**(P2-1),統一主題與字體。
6. **後台體驗**:admin stories 頁 455 行單檔,可拆元件;列表加上拖曳排序(已有 `order_index`)。

### 長期
7. **PWA / 離線編輯**:寫作工具離線可用價值高,localStorage 基礎已在,加 service worker 與同步佇列。
8. **工具註冊表**:tools 頁面各工具目前手寫並列,工具數成長後可抽 metadata registry(名稱、描述、路由、圖示),首頁與導覽自動生成。
9. **無障礙與行動版整理**:主題引擎已有對比防呆,可延伸做 a11y 掃描(焦點順序、aria label、鍵盤操作編輯器工具列)。

---

## 四、驗證紀錄

| 指令 | 結果 |
|---|---|
| `npm run lint` | ✅ 通過,無警告 |
| `npm test` | ✅ 2 suites / 51 tests 全過 |
| `npm run build` | ❌ 失敗:`Error: supabaseUrl is required.`(收集 `/api/characters` 頁面資料時;另有 Huninn 字體 fallback 警告) |
