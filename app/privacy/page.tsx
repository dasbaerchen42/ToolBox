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
            <h2 className="font-medium text-(--ink-primary) mb-2">資料儲存</h2>
            <p>
              本服務是一個純靜態網站，沒有後端伺服器，也沒有資料庫。
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-(--ink-secondary)">
              <li>
                你在編輯器中建立的文件和偏好設定，儲存於你自己的瀏覽器本機儲存空間（localStorage），
                不會傳送至任何伺服器；清除網站資料或換裝置時不會自動保留，請定期使用完整備份功能
              </li>
              <li>
                影像工作檯的所有處理（遮罩、切割、拼接、加框、沖印效果）都在你的瀏覽器內完成，
                圖片不會被上傳到任何地方
              </li>
              <li>
                拼豆工坊的照片轉換、熨燙與周邊（小卡套、吊飾、御守、透卡與魔術棒去背）同樣在瀏覽器內完成，照片不會被上傳；
                收藏冊裡的作品與周邊素材存在你自己的瀏覽器本機儲存空間（localStorage 或 IndexedDB）
              </li>
              <li>其餘工具的文字轉換同樣在瀏覽器內完成，輸入的內容不會離開你的裝置</li>
              <li>本服務不設定任何 cookie</li>
            </ul>
          </div>

          <div>
            <h2 className="font-medium text-(--ink-primary) mb-2">第三方服務</h2>
            <p>本服務使用 Cloudflare 提供網站託管。使用工具時不需要建立帳號或登入。</p>
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
            最後更新：2026 年 10 月
          </div>
        </section>
      </div>
    </main>
  );
}
