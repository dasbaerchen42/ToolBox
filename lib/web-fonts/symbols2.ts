import { Noto_Sans_Symbols_2 } from "next/font/google";

// 只會被 lib/web-fonts/index.ts 動態 import:選到這套字時才載入它的 @font-face CSS
const font = Noto_Sans_Symbols_2({
  weight: "400",
  subsets: ["symbols"],
  display: "swap",
  preload: false,
  variable: "--font-noto-symbols2",
});

export default font;
