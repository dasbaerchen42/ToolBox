# Das Baerchen Tool Box

一套給中文寫作者用的網頁工具箱，用 Next.js App Router + TypeScript 寫成。

線上版：<https://tool-box.dasbaerchen.site>

起因是自己在寫長篇時反覆卡住的那些地方：貼到社群平台前要把半形標點換成全形、
一篇兩萬字要按平台字數上限切成好幾段、要把長截圖切開或把某幾段遮掉再發出去。
與其每次手動處理，不如一個個做成工具。

## 功能

| 功能 | 路徑 | 說明 |
|---|---|---|
| 通用編輯器 | `/editor` | 多文件、本機自動儲存、復原/重做、尋找取代、字數統計、Markdown / HTML 預覽、匯出成圖片（可選霞鶩文楷、芫荽、仙人掌明體等中文字體，手機可直接存到相簿）、Google Docs 匯入匯出 |
| 標點置換所 | `/tools/fullwidth` | 全形／半形與標點轉換，可自訂規則、保護區段（程式碼、網址、引用）不被轉換 |
| 文字切割刀 | `/tools/knife` | 依字數上限切段，逐段預覽與命名，適合貼上有長度限制的平台 |
| 影像工作檯 | `/tools/image` | 貼上／拖放圖片，塗遮罩、切割（等分／自由下刀／框選裁切）、拼接（單向接圖或棋盤拼貼）、描邊與補長寬比、文字或圖片浮水印與雜訊覆蓋，全程在瀏覽器內完成不上傳，手機可直接存到相簿 |
| 拼豆工坊 | `/tools/beads` | 照片轉成拼豆圖（小板 29×29／大板 58×58，裁滿或完整放進），每格以 OKLab 從和色 76 色裡找最接近的豆子色並可限制色數；列出每色顆數並可整色清掉；也能開空板自由拼（畫筆、橡皮擦、油漆桶、滴管、左右／上下／四向對稱、復原重做），照片轉出來的圖可直接修；看豆子一顆顆落進板子、熨斗推過去燙成一片，輸出透明背景或連板子的 PNG；作品可收進只存在本機的收藏冊，並匯出／匯入 JSON 備份 |
| 社群轉換區 | `/tools` | 一個編輯區，字體（Unicode 變體，作用在選取範圍）、特殊符號、分隔線、顏文字直接作用在上面；社群排版（保護空行與縮排的隱形字元）在複製時才套用，可切換「標記查看」看它插在哪 |

全站有七款可切換主題與一組自訂／隨機配色引擎，配色會經過對比度檢查再套用。

## 技術

Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS v4、
Google OAuth 2.0、Jest。

所有工具都在瀏覽器裡完成：沒有 API route、沒有資料庫、沒有伺服器端取資料。
因此整站以 `output: "export"` 匯出成純靜態檔案（見下方「部署」）。

編輯器與各工具的核心邏輯都抽在 `lib/` 與 `app/tools/*/_lib/` 底下，
與 React 元件分離，方便單獨測試——目前 10 個測試檔、332 個測試。

## 開始開發

### 1. 安裝

```bash
git clone https://github.com/dasbaerchen42/ToolBox.git
cd ToolBox
npm install
```

### 2. 環境變數

複製 `.env.example` 成 `.env.local` 再填值。只有一個變數，而且是選用的——
沒設的話編輯器仍可用，只是 Google Docs 匯入匯出會停用。

| 變數 | 是否進前端 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 是 | Google OAuth Client ID。請在 Google Cloud Console 限制 Authorized JavaScript origins |

### 3. 執行

```bash
npm run dev     # 開發伺服器 http://localhost:3000
npm run lint    # ESLint
npm test        # Jest
npm run build   # 建置並匯出靜態檔案到 out/
```

## 部署

`next.config.ts` 設了 `output: "export"`，`npm run build` 會把整站輸出到 `out/`，
丟給任何靜態主機都能跑，不需要 Node runtime 也不需要任何 adapter。

同時設了 `trailingSlash: true`，匯出的是 `editor/index.html` 而不是 `editor.html`。
少了這行，不會自動補 `.html` 的靜態主機會對每個子頁面回 404。

### 目前的部署：Cloudflare Workers

`wrangler.jsonc` 就是部署設定，`assets.directory` 指向 `out/`。這是 assets-only
的 Worker——沒有 `main`（沒有任何 Worker 程式碼），也沒有 `binding`（那個欄位
只有在有 Worker 腳本時才有意義，這裡加了會出錯）。

專案在 Cloudflare 儀表板上要設的：

| 欄位 | 值 |
|---|---|
| 組建命令 | `npm run build` |
| 部署命令 | `npx wrangler deploy` |
| 根目錄 | `/` |
| 分支控制 | `main` |

Cloudflare 偵測到 Next.js 專案時會**自動**把組建命令設成
`npx opennextjs-cloudflare build`（SSR 轉接器那條路）。這個專案是純靜態匯出、
沒有裝那個套件，維持自動設定的話建置會直接失敗。要手動改回 `npm run build`。

### 環境變數要放在「建置」那一區

Cloudflare 有兩個長得很像的變數區塊，放錯地方不會生效：

| 區塊 | 位置 | 用途 |
|---|---|---|
| 建置變數和祕密 | 設定 → 組建 | 跑建置指令時才存在 ← **`NEXT_PUBLIC_*` 放這裡** |
| 執行時變數和祕密 | 設定 → 變數和祕密 | Worker 執行時用 `env.X` 讀 |

assets-only 的 Worker 沒有執行時，第二區會整個是灰的，那是正常的。

`NEXT_PUBLIC_*` 是**建置時**烤進 bundle 的，不是執行時讀的。變數加完要重新
建置一次才會生效（部署頁 → 檢視建置歷程 → 該筆右邊的 ⋯ → 重試建置；重試套用
的是按下當下的設定）。沒設的話編輯器照常開，只有 Google Docs 匯入匯出會停用。

### 換網域之後

到 Google Cloud Console 把新網域加進 OAuth 用戶端的 Authorized JavaScript
origins，否則編輯器的 Google 登入會被擋。每一個實際提供網站的網址都要各自登記
一次（`example.com` 和 `www.example.com` 算兩個）。

`app/layout.tsx` 裡的 `SITE_URL` 也要一起改。

## 安全性

- Markdown / HTML 預覽的產物一律經過 DOMPurify，且關閉 SVG 與 MathML profile。
- 所有工具都在本機完成，貼進去的文字與圖片不會送到任何伺服器。
- `.env.local`、憑證 JSON、私鑰都在 `.gitignore` 內，不要提交。

發現安全問題請開 issue（若涉及可利用的漏洞，請先私下聯絡而非公開細節）。

## 授權

MIT，見 [LICENSE](LICENSE)。
