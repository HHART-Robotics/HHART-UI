// Canvases can't read CSS variables, scenes use token()

export type Theme = "dark" | "light";

const KEY = "hhart.theme";

export function readTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}

export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
