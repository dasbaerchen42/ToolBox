"use client";

import { useSyncExternalStore } from "react";
import { canShareImages } from "@/lib/download";

const subscribe = () => () => {};

/** 靜態匯出時伺服器端一律當作不支援,水合後才換成瀏覽器的真實答案 */
export function useCanShareImages(): boolean {
  return useSyncExternalStore(subscribe, canShareImages, () => false);
}
