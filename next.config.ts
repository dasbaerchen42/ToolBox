import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 全站沒有 API route 也沒有伺服器端取資料,整包就是靜態檔案。
  output: "export",

  // 不能省:沒有它匯出的是 editor.html 而不是 editor/index.html,
  // 不會自動補 .html 的靜態主機一律 404。加了之後任何靜態主機都吃得下。
  trailingSlash: true,
};

export default nextConfig;
