import type { ConstraintViolation } from "../../api/types";
import styles from "./Analytics.module.css";

interface Props {
  violations: ConstraintViolation[];
}

export default function BottleneckTable({ violations }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Constraint Bottlenecks</h3>
        <p className={styles.subtitle}>Top violated constraints in best solution</p>
      </div>
      {violations.length === 0 ? (
        <p className={styles.empty}>No violations detected</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Entity</th>
              <th>Severity</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((v, i) => (
              <tr key={i}>
                <td>
                  <span className={`${styles.badge} ${v.constraint_type === "travel_distance" ? styles.badgeTravel : styles.badgeWaste}`}>
                    {v.constraint_type}
                  </span>
                </td>
                <td>{v.entity}</td>
                <td className={styles.severity}>{v.severity.toFixed(1)}</td>
                <td className={styles.desc}>{v.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
