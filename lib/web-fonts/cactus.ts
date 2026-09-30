import { Cactus_Classical_Serif } from "next/font/google";

// 只會被 lib/web-fonts/index.ts 動態 import:選到這套字時才載入它的 @font-face CSS
const font = Cactus_Classical_Serif({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-cactus",
});

export default font;
