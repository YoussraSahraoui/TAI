import styles from "./Analytics.module.css";

interface Props {
  advice: string[];
}

export default function AdvisoryPanel({ advice }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Advisory</h3>
        <p className={styles.subtitle}>Structural recommendations from solver results</p>
      </div>
      <div className={styles.cardBody}>
        {advice.length === 0 ? (
          <p className={styles.empty}>Run the solver to get recommendations</p>
        ) : (
          <ul className={styles.adviceList}>
            {advice.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
