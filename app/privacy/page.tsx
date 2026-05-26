import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策 | Das Baerchen Tool Box",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-wide mb-2">
          隱私權政策
        </h1>
        <p className="text-sm text-stone-500 mb-12">Privacy Policy</p>

        <section className="space-y-8 text-sm leading-relaxed tracking-wide text-stone-700">

          <div>
            <h2 className="font-medium text-stone-900 mb-2">關於本服務</h2>
            <p>
              Das Baerchen Tool Box（以下簡稱「本服務」）是一個個人寫作工具集，
              提供文字編輯、格式轉換、故事閱覽等功能，由 Das Baerchen 個人維護。
            </p>
          </div>

          <div>
            <h2 className="font-medium text-stone-900 mb-2">Google 帳號授權</h2>
            <p>
              本服務提供 Google Docs 匯入／匯出功能。使用此功能時，會要求你授權本服務存取你的 Google 帳號。
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-stone-600">
              <li>本服務只會在你主動操作時存取 Google Docs</li>
              <li>匯出功能會在你的 Google Drive 建立或更新文件</li>
              <li>匯入功能會讀取你指定的 Google Docs 文件內容</li>
              <li>本服務不會儲存你的 Google 帳號資訊或存取憑證</li>
              <li>你可以隨時在 Google 帳戶設定中撤銷本服務的授權</li>
            </ul>
          </div>

          <div>
            <h2 className="font-medium text-stone-900 mb-2">資料儲存</h2>
            <p>
              你在編輯器中建立的文件和偏好設定，儲存於你自己的瀏覽器本機儲存空間（localStorage），
              不會傳送至任何伺服器。故事館的內容由本服務管理，不涉及使用者的個人資料。
            </p>
          </div>

          <div>
            <h2 className="font-medium text-stone-900 mb-2">第三方服務</h2>
            <p>本服務使用以下第三方服務：</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-stone-600">
              <li>Vercel — 網站託管</li>
              <li>Vercel Analytics — 匿名網站流量統計，不收集個人識別資訊</li>
              <li>Google OAuth 2.0 — 帳號授權（僅限使用 Google Docs 功能時）</li>
            </ul>
          </div>

          <div>
            <h2 className="font-medium text-stone-900 mb-2">聯絡方式</h2>
            <p>
              如對本隱私權政策有任何疑問，歡迎透過網站上的聯絡方式與我們聯繫。
            </p>
          </div>

          <div className="pt-4 text-xs text-stone-400">
            最後更新：2025 年 5 月
          </div>
        </section>
      </div>
    </main>
  );
}
