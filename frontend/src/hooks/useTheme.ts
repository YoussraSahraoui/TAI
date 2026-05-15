import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "tai-theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Single source of truth for the active theme.
 *
 * Persists to localStorage and writes `data-theme` on the <html> element
 * so CSS token overrides in index.css apply globally. Adds a brief
 * `theme-animate` class on <html> while toggling so the page colours
 * crossfade instead of snapping.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const html = document.documentElement;
    html.classList.add("theme-animate");
    setTheme((t) => (t === "light" ? "dark" : "light"));
    window.setTimeout(() => html.classList.remove("theme-animate"), 450);
  }, []);

  return { theme, toggle };
}
