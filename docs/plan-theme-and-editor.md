# 版本規畫:共用主題引擎接入 + 編輯器尋找/取代/還原

> 開發分支:`claude/color-theme-editor-features-phb0en`(不動 main)
> 狀態:規畫已拍板,尚未動工。若 session 中斷,照本文件從未完成的 Phase 接續即可。
> 參考:使用者提供的交接文件「my-universe 接入共用主題換色引擎」(theme-core 引擎原始碼 §7、
> 產生器 §9、七款 preset 皆出自該文件;本文件記錄的是 ToolBox 的改編版)。

---

## 已拍板決策

| 項目 | 決定 |
|---|---|
| A. 主題範圍 | **全站統一**一個主題(取代 tools 各頁的淺/深切換與編輯器獨立主題) |
| B. Preset 清單 | **共用七款**:灰黃🐻 / 拿鐵☕ / 薏仁🪨 / 情人果🥭 / 蜜桃🍑 / 蝶豆花🦋 / 哈密瓜🍈 |
| C. 自訂調色 + 隨機配色 UI | **這次一起做**(4 色自訂、對比防呆、隨機產生、已存隨機上限 5 筆 FIFO) |
| D. 舊偏好 | **接受重設**:`orange-writing-preferences` 內的 `theme` 欄位棄用,首次載入回預設主題,不寫 migration;其餘偏好(字級、行高、字距、寬度、字體)不動 |
| 尋找/取代 | 純文字比對(不做 regex),含區分大小寫開關;跳選反白 + 「第 n / 共 m 筆」計數 |
| 還原/重做 | **自建歷史堆疊**(不依賴瀏覽器內建 undo、不用已廢棄的 execCommand),實體按鈕 + 攔截 Ctrl+Z / Ctrl+Shift+Z(Ctrl+Y) |
| 方案三雜項修正 | **全做**(清單見 Phase 5) |

## 動工前置(每次 session 接手都要)

1. `npm install`(本 repo 的 node_modules 未必存在)。
2. 讀 `node_modules/next/dist/docs/` 相關指南 —— AGENTS.md 明言此版 Next(16.2.1)有 breaking changes,不可憑記憶寫。
3. `git checkout claude/color-theme-editor-features-phb0en && git pull origin claude/color-theme-editor-features-phb0en`。

---

## 現況摘要(勘查結果,2026-07)

- ToolBox **沒有任何 CSS 變數主題**,是兩套 Tailwind class 系統:
  - `lib/theme.ts` 的 `getThemeClasses(light|dark)`:被 `app/page.tsx`、`app/tools/page.tsx`、`app/tools/knife/page.tsx`、`app/tools/fullwidth/page.tsx`、`app/tools/story-formatter/page.tsx`、`app/stories/*` 共 9 處使用;各頁 `useState("light")`,**不持久化**,換頁重設。
  - `app/editor/page.tsx` 內嵌 `themeMap`(dark/light/forest/sunny/paper 五款),存於 `orange-writing-preferences`。
- `components/site-navigation.tsx` 第三套:Tailwind `dark:` 前綴跟 OS 深淺色走,與頁面主題脫鉤。
- 所有元件都透過 `theme` 物件 prop 取樣式 → **間接層已存在**,換引擎時消費端幾乎不動。
- `components/editor/editor-textarea.tsx` 是原生 `<textarea>`,尚未轉發 ref。
- 文件狀態管理:`hooks/useDocuments.ts`(`updateActiveDoc` 寫回 + 自動存 localStorage)。
- 偏好:`hooks/useEditorPreferences.ts` + `lib/preferences.ts`(`EditorPreferences.theme: ThemeName` 這欄位將棄用)。

---

## Phase 1:主題引擎(純新增,不碰既有檔)

1. **`lib/theme-core.ts`**:複製交接文件 §7 引擎,改動:
   - localStorage keys:`toolbox-theme` / `toolbox-theme-custom-input` / `toolbox-theme-custom-vars` / `toolbox-theme-random-saves`。
   - `PRESETS` 用共用七款(id:`huninn/latte/stone/mango/peach/butterfly/melon`),預設 `huninn`。
   - 匯出 `BOOTSTRAP_SCRIPT`(無閃爍開機腳本)。
2. **`scripts/generate-theme-css.mjs`**:交接文件 §9 產生器 + CLI 入口(`node scripts/generate-theme-css.mjs > app/theme.css`);PRESETS 與 theme-core 保持一致(單一真相在 theme-core,產生器可從註解標明「改 preset 兩邊同步」或直接 import 不到 .ts 就複製一份並註記)。
3. **`app/theme.css`**:產生器輸出的七款 `[data-theme=...]` 靜態變數(交接文件 §8 那份的色值即可直接用,id 相同)。
4. `app/globals.css` 頂端 `@import "./theme.css";`,並把 `:root { --background/--foreground }` 那段舊 token 對映到新變數或移除(body 樣式改用 `var(--paper-bg)` / `var(--ink-primary)`)。

**驗證**:`npm run build` 過。

## Phase 2:轉接層——既有頁面全面改吃 CSS 變數

1. **`lib/theme.ts` 改寫**:`ThemeClasses` 介面與 `getThemeClasses()` 簽名保留,但回傳值收斂成**單一一套** token class(Tailwind v4 任意值語法,如 `bg-(--paper-bg) text-(--ink-primary)`、`border-(--border-light)` 等);`ThemeMode` 參數保留但忽略(或標 deprecated),9 個呼叫端零改動也能先動起來。對映表:
   - `page` → paper-bg + ink-primary;`panel` → paper-bg-2 + border-light;`subPanel` → paper-bg-3;
   - `input` → paper-bg + border-light + ink-primary + placeholder ink-tertiary;`muted` → ink-secondary;
   - `primary` → accent 底 + on-accent 字;`secondary` → paper-bg-2 + border + hover paper-bg-3;
   - `selected/listSelected` → accent 系;`unselected/listUnselected` → paper-bg-2 系;`divider` → border-light。
2. **`app/editor/page.tsx`**:刪掉 130 行 `themeMap`,`ThemeConfig` 改為同樣的 token 常數一份(欄位名不變:pageBg/panelBg/…),元件 props 不動。
3. **`app/layout.tsx`**:`<html data-theme="huninn">` + `<head>` 注入 `BOOTSTRAP_SCRIPT`(dangerouslySetInnerHTML)。
4. **`components/site-navigation.tsx`**:改用 token class,移除所有 `dark:` 前綴 → 導覽列跟全站主題一致。
5. **`lib/preferences.ts`**:`EditorPreferences` 移除 `theme` 欄位與 `ThemeName`(讀舊 JSON 多出的欄位無害,直接忽略);`defaultPreferences` 同步刪。
6. 各頁面移除 `useState<ThemeMode>` 與 `ToolHeader` 的淺/深按鈕(`ToolHeader` 的 `theme/setTheme` props 拿掉,只留標題描述)。

**驗證**:build 過;手動檢查每頁(首頁/editor/tools/knife/fullwidth/story-formatter/stories/gacha/privacy)無殘留 zinc/stone 寫死配色的突兀區塊。

## Phase 3:全站主題選擇 UI(含自訂 + 隨機)

1. **`components/theme-menu.tsx`**(新):掛在 `site-navigation.tsx` 右側的主題按鈕 → 下拉面板:
   - 七款 preset 色票(emoji + 名稱 + 4 色預覽點),點選 `applyTheme(id)`。
   - 「自訂」區:4 個顏色輸入(bg / bg2 / ink / accent,`<input type="color">` + hex 文字框),即時 `applyCustomTheme()`(內含對比防呆 ensureReadable)。
   - 「隨機」按鈕:`generateRandomScheme()` 即套用;「保存這組」→ `saveRandomScheme`(上限 5,FIFO);已存清單可點選套用、可刪除。
   - client component;初始高亮用 `getCurrentThemeId()`。
2. **`app/editor/page.tsx` 設定面板**:`editor-settings-panel.tsx` 的「主題配色」select 移除(全站統一由導覽列管),其餘設定不動。

**驗證**:切 preset 無閃爍(重整後 bootstrap 直接套);自訂低對比色會被自動推開;隨機存滿 5 筆會擠掉最舊。

## Phase 4:編輯器尋找/取代 + 還原/重做

1. **`components/editor/editor-textarea.tsx`**:改 `forwardRef`(或 ref prop)露出底層 textarea。
2. **`hooks/useEditorHistory.ts`**(新):
   - 每份文件一條快照堆疊(記憶體內,keyed by docId),上限 100 步。
   - 打字以停頓 800ms 合併為一步;尋找/取代造成的變更**必定獨立成步**。
   - 提供 `record(content)`, `undo()`, `redo()`, `canUndo`, `canRedo`;undo/redo 回傳內容由呼叫端經 `updateActiveDoc` 寫回(寫回時不再 record,需防迴圈 flag)。
3. **`components/editor/editor-find-replace.tsx`**(新):
   - 常駐小工具列:還原、重做按鈕 + 「尋找/取代」開關;展開後:尋找輸入框、上一筆/下一筆、「第 n / 共 m 筆」、區分大小寫開關、取代輸入框、取代單筆、全部取代、關閉(Esc)。
   - 跳筆:計算 match 位置 → `textarea.setSelectionRange(start, end)` + focus + 捲動置中(用 scrollTop 估算或 selection 後讀取)。
   - 取代單筆:取代目前選中那筆後跳下一筆;全部取代:一次寫回並回報取代筆數。
   - 快捷鍵:textarea 與工具列範圍內攔 Ctrl/Cmd+F(開尋找)、Ctrl/Cmd+Z(undo)、Ctrl/Cmd+Shift+Z 與 Ctrl/Cmd+Y(redo),`preventDefault` 避免與瀏覽器內建歷史打架。
4. **`app/editor/page.tsx`**:接線——工具列放在 `EditorTextarea` 上方;內容變更統一經過 history.record。

**驗證**:打一句話 → Ctrl+Z 整句回退;全部取代 → 一鍵還原;切換文件各自歷史獨立;「第 n/m 筆」在無結果、修改內容後正確更新。

## Phase 5:雜項修正(全做)

1. `components/editor/editor-settings-panel.tsx:66`:刪重複的 `tracking-[0.06em]`。
2. 型別集中:`ThemeMode` 重複定義(`lib/theme.ts` vs `app/tools/fullwidth/_lib/types.ts`)、`ThemeConfig` 重複(editor page vs settings panel)→ 隨 Phase 2 收斂到 `lib/theme.ts`(或直接消滅)。
3. `hooks/useEditorPreferences.ts`:加 `loaded` flag,載入完成前不執行儲存 effect(修「掛載瞬間用預設值覆寫 localStorage」的競態)。
4. `hooks/useDocuments.ts`:`updateActiveDoc` 不再每次打字就把文件搬到清單最前(排序改為只在建立/匯入/切換時,或維持既有順序),修打字時側欄跳動。
5. `components/site-navigation.tsx:12`:刪除開發註解 `// ← 加這行`。
6. `app/stories/[slug]/page.tsx:85`:寫死 `getThemeClasses("light")` 的 loading 畫面隨 Phase 2 統一自然修復(確認無殘留)。
7. (低優先、可跳過)editor 匯入/匯出的 `alert()/window.prompt()` 改 inline 訊息——**本版不做**,留待下版。

## Phase 6:收尾

1. `npm run build` 必須過(型別 + 編譯);`npm test`(既有 validators/knife 測試)必須過。
2. 全頁面手動走查(見 Phase 2/3/4 驗證項)。
3. Commit 訊息按 Phase 拆(每個 Phase 至少一個 commit,方便中斷接續),push:
   `git push -u origin claude/color-theme-editor-features-phb0en`(網路錯誤依 2s/4s/8s/16s 退避重試)。
4. 不自行開 PR(等使用者指示)。

---

## 中斷接續指引

- 每完成一個 Phase 就 commit + push,commit 訊息前綴 `feat(theme):` / `feat(editor):` / `fix:` 並標 Phase 編號。
- 接手時:讀本文件 → `git log --oneline` 看最後完成到哪個 Phase → 從下一個 Phase 繼續。
- 引擎原始碼若手邊沒有交接文件,以 `lib/theme-core.ts`(Phase 1 完成後)為準;theme.css 一律用產生器重產,不手改。
