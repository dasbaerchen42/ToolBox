import { Noto_Sans_TC } from "next/font/google";

// 只會被 lib/web-fonts/index.ts 動態 import:選到這套字時才載入它的 @font-face CSS
const font = Noto_Sans_TC({
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-tc",
});

export default font;
