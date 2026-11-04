import localFont from "next/font/local";

const font = localFont({
  src: [
    { path: "./assets/ryusenkei-regular.woff2", weight: "400", style: "normal" },
    { path: "./assets/ryusenkei-bold.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-ryusenkei",
});

export default font;
