import type { ConstraintConfig } from "../../api/types";
import styles from "./Constraints.module.css";

interface Props {
  config: ConstraintConfig | null;
  onChange: (key: string, value: number) => void;
}

/**
 * Soft-cost weight editor. Names mirror the Greek letters used in the
 * canonical notebook so the UI labels match the cost function:
 *   C(S) = α·Cdist + β·Cwaste + γ·Cchange + δ·Cworking_days + ε·Clunch
 */
const SOFT = [
  { key: "alpha",   label: "α — Teacher travel distance",            help: "Sums Euclidean distance between rooms of consecutive sessions per teacher (only when room coords are provided)." },
  { key: "beta",    label: "β — Wasted room capacity",               help: "Sum of (room.capacity − lecture.students) across all assignments." },
  { key: "gamma",   label: "γ — Schedule changes from reference",    help: "Counts teacher-period slots whose room differs from the CSP-seeded baseline." },
  { key: "delta",   label: "δ — Spread across working days",         help: "Penalises any course scheduled on fewer than its min_working_days distinct days." },
  { key: "epsilon", label: "ε — Lunch-break (>3 consecutive slots)", help: "Per teacher AND per curriculum, penalises chains of more than three consecutive slots in a day." },
] as const;

export default function SoftConstraints({ config, onChange }: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Soft Constraints</h3>
        <p className={styles.subtitle}>Raw weights — values pass straight to the cost function (no normalisation).</p>
      </div>
      <div className={styles.body}>
        {SOFT.map((c) => (
          <div key={c.key} className={styles.slider} title={c.help}>
            <div className={styles.sliderLabel}>{c.label}</div>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={config ? Number((config as unknown as Record<string, number>)[c.key]) : 1}
                onChange={(e) => onChange(c.key, Number(e.target.value))}
              />
              <span className={styles.value}>
                {config ? Number((config as unknown as Record<string, number>)[c.key]).toFixed(2) : "1.00"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
