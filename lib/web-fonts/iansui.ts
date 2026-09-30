import { Iansui } from "next/font/google";

// 只會被 lib/web-fonts/index.ts 動態 import:選到這套字時才載入它的 @font-face CSS
const font = Iansui({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-iansui",
});

export default font;
