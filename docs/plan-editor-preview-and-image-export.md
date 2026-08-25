# 編輯器：MD/HTML 渲染切換 + 文轉圖

## 需求

1. 編輯器要吃得下 Markdown 與 HTML，可以在純文字與渲染之間切換。
2. 文轉圖：把整篇內容（含渲染結果）下載成 PNG，寬度由工具自己決定，跟視窗大小無關。

## 決策

| 題目 | 決定 |
| --- | --- |
| 切換型態 | 三態：純文字／渲染／並排（並排只在 `md` 以上出現） |
| 渲染綁在哪 | 綁既有的 `WritingMode`，不另開模式。只有 `markdown` 與 `html` 有渲染 |
| 渲染管線 | `marked` → `DOMPurify`。HTML 模式跳過 marked 直接清洗 |
| MD 裡混寫 HTML | 天然支援：marked 會原樣吐出，最後一起被 sanitize |
| 截圖寬度 | 600 / 800 / 1080 CSS px，一律 2 倍輸出（1080 → 2160 px） |
| 長圖超過上限 | 自動分頁，多張時用既有的 `jszip` 打包成 zip |
| 匯出配色 | 跟著當下主題的 CSS 變數走，深色主題就是深底淺字 |

## 實作要點

- `lib/markdown.ts`：`marked` 與 `dompurify` 都用動態 `import()` 載入，不進首屏 bundle；
  sanitize 只開 `html` profile，不開 SVG / MathML。
- `lib/export-image.ts`：**不截畫面上那塊預覽**。預覽寬度會跟著視窗跑，手機永遠截不出
  1080 寬的圖，所以另外在畫面外（`left: -100000px`）組一個固定寬度的節點來截。
  - 分頁門檻取 iOS Safari 的 canvas 面積上限（約 16.7M 裝置像素）保守估算，
    1080 寬 2 倍輸出時一頁約 3700 CSS px。
  - 換頁點盡量落在區塊元素之間，避免把一行字從中間切斷；單一元素本身超過一頁才硬切。
  - 截圖前 `await document.fonts.ready`，否則字型會掉回系統字。
  - 截圖庫用 `html2canvas-pro`：原版 `html2canvas` 遇到 `oklch()` 會直接丟錯，
    而 Tailwind v4 的預設調色盤就是 oklch。
- `app/globals.css` 的 `.md-preview`：Tailwind preflight 會清掉標題與清單樣式，這裡補回來。
  顏色一律走主題變數，螢幕上與匯出的 PNG 才是同一套配色。

## 已驗證

Playwright 實機走查：三態切換、Markdown 渲染（標題／清單／表格／引言／程式碼區塊）、
Markdown 內混寫 HTML 有渲染、`<script>` 與 `onerror` 被清掉、
純文字模式轉圖、Markdown 轉圖（2160 px 寬）、長文自動分成 9 張並打包 zip，無 JS 錯誤。
