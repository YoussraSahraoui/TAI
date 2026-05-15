import { useEffect, useRef, useState } from "react";
import type { Theme } from "../../hooks/useTheme";
import styles from "./ThemeToggle.module.css";

interface Props {
  theme: Theme;
  onToggle: () => void;
}

const LABELS: Record<Theme, string> = { light: "LIGHT", dark: "DARK" };

/**
 * Creative dark-mode toggle:
 *   • A half-filled disc that rotates 180° between modes (Swiss eclipse).
 *   • A typing-animated label that backspaces the old word and types
 *     the new one — same idiom as the hero title.
 */
export default function ThemeToggle({ theme, onToggle }: Props) {
  const target = LABELS[theme];
  const [shown, setShown] = useState(target);
  const lastTarget = useRef(target);

  useEffect(() => {
    if (target === lastTarget.current && shown === target) return;
    lastTarget.current = target;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let current = shown;

    const tick = () => {
      if (cancelled) return;
      // Delete while current isn't a prefix of target
      if (!target.startsWith(current)) {
        current = current.slice(0, -1);
        setShown(current);
        timer = setTimeout(tick, 28);
        return;
      }
      // Then type until we reach target
      if (current.length < target.length) {
        current = target.slice(0, current.length + 1);
        setShown(current);
        timer = setTimeout(tick, 50);
      }
    };

    timer = setTimeout(tick, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Animation is keyed on `target`. Reading `shown` as initial seed only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={styles.btn}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span className={`${styles.disc} ${theme === "dark" ? styles.discDark : ""}`} aria-hidden>
        <span className={styles.discFill} />
        <span className={styles.discPip} />
      </span>
      <span className={styles.label}>
        {shown}
        <span className={styles.caret} aria-hidden />
      </span>
    </button>
  );
}
