import { Noto_Sans_Math } from "next/font/google";

// 只會被 lib/web-fonts/index.ts 動態 import:選到這套字時才載入它的 @font-face CSS
// 這套字在 Google Fonts 沒有可預載的子集,next/font 會自動關掉預載,所以不寫 subsets / preload
const font = Noto_Sans_Math({
  weight: "400",
  display: "swap",
  variable: "--font-noto-math",
});

export default font;
