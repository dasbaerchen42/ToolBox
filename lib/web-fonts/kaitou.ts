import localFont from "next/font/local";

const font = localFont({
  src: "./assets/kaitou-yokoku-gothic.woff",
  weight: "400",
  display: "swap",
  variable: "--font-kaitou",
});

export default font;
