// lib/theme.ts

export type ThemeMode = "light" | "dark";

export type ThemeClasses = {
  page: string;
  panel: string;
  subPanel: string;
  input: string;
  muted: string;
  primary: string;
  secondary: string;
  selected: string;
  unselected: string;
  divider: string;
  listSelected: string;
  listUnselected: string;
};

export function getThemeClasses(theme: ThemeMode): ThemeClasses {
  if (theme === "dark") {
    return {
      page: "bg-zinc-950 text-zinc-100",
      panel: "border-zinc-800 bg-zinc-900/90",
      subPanel: "border-zinc-800 bg-zinc-950/80",
      input: "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500",
      muted: "text-zinc-400",
      primary: "border-zinc-100 bg-zinc-100 text-zinc-900 hover:bg-white",
      secondary: "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800",
      selected: "border-zinc-100 bg-zinc-100 text-zinc-900",
      unselected: "border-zinc-700 bg-zinc-900 text-zinc-300",
      divider: "border-zinc-800",
      listSelected: "border-zinc-100 bg-zinc-100 text-zinc-900 shadow-sm",
      listUnselected: "border-zinc-800 bg-zinc-900/70 text-zinc-100 hover:bg-zinc-900",
    };
  }

  return {
    page: "bg-stone-100 text-stone-900",
    panel: "border-stone-300 bg-white/90",
    subPanel: "border-stone-300 bg-stone-50/90",
    input: "border-stone-300 bg-white text-stone-900 placeholder:text-stone-400",
    muted: "text-stone-500",
    primary: "border-stone-900 bg-stone-900 text-white hover:bg-stone-800",
    secondary: "border-stone-300 bg-white text-stone-900 hover:bg-stone-50",
    selected: "border-stone-900 bg-stone-900 text-white",
    unselected: "border-stone-300 bg-white text-stone-700",
    divider: "border-stone-300",
    listSelected: "border-stone-900 bg-stone-900 text-white shadow-sm",
    listUnselected: "border-stone-300 bg-white text-stone-900 hover:bg-stone-50",
  };
}