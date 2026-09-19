import type { CSSProperties } from "react";

/** 透明區域的棋盤格底,不然使用者分不出「透明」跟「白色」 */
export const CHECKERBOARD: CSSProperties = {
  backgroundImage: [
    "linear-gradient(45deg, rgba(128,128,128,0.22) 25%, transparent 25%)",
    "linear-gradient(-45deg, rgba(128,128,128,0.22) 25%, transparent 25%)",
    "linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.22) 75%)",
    "linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.22) 75%)",
  ].join(", "),
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

/** 有底色就用底色,沒有(透明)就鋪棋盤格 */
export function backgroundStyle(color: string | null): CSSProperties {
  return color ? { background: color } : CHECKERBOARD;
}
