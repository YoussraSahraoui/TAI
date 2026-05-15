import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { ConstraintConfig } from "../api/types";
import HardConstraints from "../components/constraints/HardConstraints";
import SoftConstraints from "../components/constraints/SoftConstraints";
import styles from "./Pages.module.css";

/**
 * Constraint editing page.
 *
 * The slider drag bug came from binding `value` directly to the server
 * config: every onChange round-tripped through the API and the response set
 * a (slightly stale) value back into the slider, which made it jump. Fix:
 * keep an optimistic `draft` locally and only push to the server when the
 * user pauses (debounced) or commits the gesture.
 */
export default function ConstraintsPage() {
  const [draft, setDraft] = useState<ConstraintConfig | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getConstraints().then(setDraft).catch(() => {});
  }, []);

  const queueSave = (next: ConstraintConfig) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { id: _id, ...body } = next;
      api.updateConstraints(body).catch(() => {});
    }, 250);
  };

  const update = <K extends keyof ConstraintConfig>(key: K, val: ConstraintConfig[K]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: val };
      queueSave(next);
      return next;
    });
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <div className={styles.eyebrow}>Rules</div>
          <h1 className={styles.pageTitle}>Constraint Configuration</h1>
          <p className={styles.pageLede}>
            Hard constraints must always hold. Soft weights shape the objective —
            raise the ones you care about most and the solver will prioritise them.
          </p>
        </div>
      </header>

      <HardConstraints
        config={draft}
        onChange={(key, val) => update(key as keyof ConstraintConfig, val as never)}
      />
      <SoftConstraints
        config={draft}
        onChange={(key, val) => update(key as keyof ConstraintConfig, val as never)}
      />
    </div>
  );
}
