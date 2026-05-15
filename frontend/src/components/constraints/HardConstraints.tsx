import type { ConstraintConfig } from "../../api/types";
import styles from "./Constraints.module.css";

interface Props {
  config: ConstraintConfig | null;
  onChange: (key: string, value: boolean) => void;
}

const HARD_CONSTRAINTS = [
  { key: "enforce_capacity", label: "Room capacity must be >= class size" },
  { key: "enforce_type_match", label: "Room type must match event type" },
  { key: "enforce_no_double_booking", label: "No overlapping room bookings" },
] as const;

export default function HardConstraints({ config, onChange }: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Hard Constraints</h3>
        <p className={styles.subtitle}>Rules that must always be satisfied</p>
      </div>
      <div className={styles.body}>
        {HARD_CONSTRAINTS.map((c) => (
          <label key={c.key} className={styles.toggle}>
            <input
              type="checkbox"
              checked={config ? (config[c.key] as boolean) : true}
              onChange={(e) => onChange(c.key, e.target.checked)}
            />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  );
}
