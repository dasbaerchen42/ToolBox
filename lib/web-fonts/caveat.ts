import { Caveat } from "next/font/google";

// 只會被 lib/web-fonts/index.ts 動態 import:選到這套字時才載入它的 @font-face CSS
const font = Caveat({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-caveat",
});

export default font;
