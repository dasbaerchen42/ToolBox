import { Noto_Sans_Math } from "next/font/google";

// 只會被 lib/web-fonts/index.ts 動態 import:選到這套字時才載入它的 @font-face CSS
const font = Noto_Sans_Math({
  weight: "400",
  subsets: ["math"],
  display: "swap",
  preload: false,
  variable: "--font-noto-math",
});

export default font;
