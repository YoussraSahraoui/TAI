import { useEffect, useState } from "react";

export interface ThemeColors {
  text: string;
  muted: string;
  gridLine: string;
  surface: string;
  surfaceInverse: string;
  textOnInverse: string;
  accent: string;
}

const FALLBACK: ThemeColors = {
  text: "#0a0a0a",
  muted: "#737373",
  gridLine: "#e5e5e5",
  surface: "#ffffff",
  surfaceInverse: "#0a0a0a",
  textOnInverse: "#ffffff",
  accent: "#e63946",
};

function read(): ThemeColors {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fb: string) => (cs.getPropertyValue(name).trim() || fb);
  return {
    text: get("--black", FALLBACK.text),
    muted: get("--gray-500", FALLBACK.muted),
    gridLine: get("--gray-200", FALLBACK.gridLine),
    surface: get("--white", FALLBACK.surface),
    surfaceInverse: get("--ink", FALLBACK.surfaceInverse),
    textOnInverse: get("--paper", FALLBACK.textOnInverse),
    accent: get("--accent", FALLBACK.accent),
  };
}

/**
 * Resolves CSS-variable colours so SVG-attribute consumers (Recharts) can
 * use them. Re-reads when `[data-theme]` flips on <html>.
 */
export function useThemeColors(): ThemeColors {
  const [c, setC] = useState<ThemeColors>(read);
  useEffect(() => {
    setC(read());
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return c;
}
