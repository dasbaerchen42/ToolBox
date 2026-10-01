import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策 | Das Baerchen Tool Box",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 bg-(--paper-bg) text-(--ink-primary) px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-wide mb-2">
          隱私權政策
        </h1>
        <p className="text-sm text-(--ink-tertiary) mb-12">Privacy Policy</p>

        <section className="space-y-8 text-sm leading-relaxed tracking-wide text-(--ink-secondary)">

          <div>
            <h2 className="font-medium text-(--ink-primary) mb-2">關於本服務</h2>
            <p>
              Das Baerchen Tool Box（以下簡稱「本服務」）是一個個人寫作工具集，
              提供文字編輯、標點與格式轉換、文字切割、社群排版、影像處理等功能，
              由 Das Baerchen 個人維護。
            </p>
          </div>

          <div>
            <h2 className="font-medium text-(--ink-primary) mb-2">Google 帳號授權</h2>
            <p>
              本服務提供 Google Docs 匯入／匯出功能。使用此功能時，會要求你授權本服務存取你的 Google 帳號。
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-(--ink-secondary)">
              <li>本服務只會在你主動操作時存取 Google Docs</li>
              <li>匯出功能會在你的 Google Drive 建立或更新文件</li>
              <li>匯入功能會讀取你指定的 Google Docs 文件內容</li>
              <li>本服務不會儲存你的 Google 帳號資訊或存取憑證</li>
              <li>你可以隨時在 Google 帳戶設定中撤銷本服務的授權</li>
            </ul>
          </div>

          <div>
            <h2 className="font-medium text-(--ink-primary) mb-2">資料儲存</h2>
            <p>
              本服務是一個純靜態網站，沒有後端伺服器，也沒有資料庫。
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-(--ink-secondary)">
              <li>
                你在編輯器中建立的文件和偏好設定，儲存於你自己的瀏覽器本機儲存空間（localStorage），
                不會傳送至任何伺服器
              </li>
              <li>
                影像工作檯的所有處理（遮罩、切割、拼接、加框、沖印效果）都在你的瀏覽器內完成，
                圖片不會被上傳到任何地方
              </li>
              <li>
                拼豆工坊的照片轉換與熨燙同樣在瀏覽器內完成，照片不會被上傳；
                收藏冊裡的作品存在你自己的瀏覽器本機儲存空間（localStorage）
              </li>
              <li>其餘工具的文字轉換同樣在瀏覽器內完成，輸入的內容不會離開你的裝置</li>
              <li>本服務不設定任何 cookie</li>
            </ul>
          </div>

          <div>
            <h2 className="font-medium text-(--ink-primary) mb-2">第三方服務</h2>
            <p>本服務使用以下第三方服務：</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-(--ink-secondary)">
              <li>Cloudflare — 網站託管</li>
              <li>Google OAuth 2.0 — 帳號授權（僅限使用 Google Docs 功能時）</li>
            </ul>
          </div>

          <div>
            <h2 className="font-medium text-(--ink-primary) mb-2">聯絡方式</h2>
            <p>
              本服務為開放原始碼專案。如對本隱私權政策有任何疑問，
              歡迎到{" "}
              <a
                href="https://github.com/dasbaerchen42/ToolBox/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-(--ink-primary)"
              >
                GitHub 專案頁面
              </a>{" "}
              開 issue 詢問。
            </p>
          </div>

          <div className="pt-4 text-xs text-(--ink-tertiary)">
            最後更新：2026 年 9 月
          </div>
        </section>
      </div>
    </main>
  );
}
