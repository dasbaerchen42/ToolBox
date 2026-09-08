# Das Baerchen Tool Box

一套給中文寫作者用的網頁工具箱，用 Next.js App Router + TypeScript 寫成。

起因是自己在寫長篇時反覆碰到的那些瑣事：貼到社群平台前要把半形標點換成全形、
一篇兩萬字要按平台字數上限切成好幾段、Google Docs 和瀏覽器之間來回搬稿子。
與其每次手動處理，不如把它們做成工具。

## 功能

| 功能 | 路徑 | 說明 |
|---|---|---|
| 通用編輯器 | `/editor` | 多文件、本機自動儲存、復原/重做、尋找取代、字數統計、Markdown / HTML 預覽、匯出成圖片、Google Docs 匯入匯出 |
| 標點置換所 | `/tools/fullwidth` | 全形／半形與標點轉換，可自訂規則、保護區段（程式碼、網址、引用）不被轉換 |
| 文字切割刀 | `/tools/knife` | 依字數上限切段，逐段預覽與命名，適合貼上有長度限制的平台 |
| 社群轉換區 | `/tools` | 社群貼文排版、花式字體（Unicode 變體）轉換 |
| 故事排版器 | `/tools/story-formatter` | 把 Google Docs 貼過來的原稿整理成故事館的資料格式 |
| 故事館 | `/stories` | 由 Supabase 供應的作品閱覽頁，含後台管理（`/admin`） |

全站有七款可切換主題與一組自訂／隨機配色引擎，配色會經過對比度檢查再套用。

## 技術

Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS v4、
Supabase（Postgres + Row Level Security）、Google OAuth 2.0、Jest。

編輯器與各工具的核心邏輯都抽在 `lib/` 與 `app/tools/*/_lib/` 底下，
與 React 元件分離，方便單獨測試——目前 4 個測試檔、121 個測試。

## 開始開發

### 1. 安裝

```bash
git clone https://github.com/dasbaerchen42/ToolBox.git
cd ToolBox
npm install
```

### 2. 環境變數

複製 `.env.example` 成 `.env.local` 再填值。四個變數都是選用的——
沒設 Google 的話編輯器仍可用，只是 Google Docs 匯入匯出會停用；
沒設 Supabase 的話故事館會顯示空狀態，其餘工具不受影響。

| 變數 | 是否進前端 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 是 | Google OAuth Client ID。請在 Google Cloud Console 限制 Authorized JavaScript origins |
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 專案網址 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | Supabase anon key，寫入權限一律由 RLS 控管 |
| `SUPABASE_SERVICE_ROLE_KEY` | **否** | 只在 `/api/admin/*` 使用。絕對不要加 `NEXT_PUBLIC_` 前綴 |
| `ADMIN_EMAIL` | **否** | 後台管理員的 Google 帳號 email |

### 3. 資料庫

要用故事館的話，把 `supabase-schema.sql` 整份貼進 Supabase Dashboard 的
SQL Editor 執行。裡面包含資料表、`updated_at` trigger、索引，以及
**Row Level Security policy——這段不能略過**，公開讀取的邊界靠它守住。

### 4. 執行

```bash
npm run dev     # 開發伺服器 http://localhost:3000
npm run lint    # ESLint
npm test        # Jest
npm run build   # 正式建置
```

## 安全性

- 後台認證比對 Google access token 的 `aud`、`email_verified` 與 `ADMIN_EMAIL`
  三項，缺任何環境變數一律拒絕（fail closed）。只比對 email 而不驗 `aud`
  會讓任何第三方網站拿到的 token 都能通過，這點必須留著。
- Admin 寫入走欄位白名單（`lib/admin-fields.ts`），擋 mass assignment。
- 500 錯誤一律回固定訊息，原始的 Postgres 錯誤只留在伺服器 log。
- Markdown / HTML 預覽的產物一律經過 DOMPurify，且關閉 SVG 與 MathML profile。
- `.env.local`、憑證 JSON、私鑰都在 `.gitignore` 內，不要提交。

發現安全問題請開 issue（若涉及可利用的漏洞，請先私下聯絡而非公開細節）。

## 授權

MIT，見 [LICENSE](LICENSE)。

本 repo 只包含程式碼。作品內容（角色設定、故事原文）存放在 Supabase，
不隨程式碼一起授權。
