import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ConstraintConfig } from "../../api/types";
import styles from "./Dashboard.module.css";

const FIELDS: { key: keyof Pick<ConstraintConfig, "alpha" | "beta" | "gamma" | "delta">; w: string; label: string; hint: string }[] = [
  { key: "alpha", w: "w1", label: "Cdist", hint: "Inter-class travel distance" },
  { key: "beta",  w: "w2", label: "Cwaste", hint: "Wasted room capacity" },
  { key: "gamma", w: "w3", label: "Cchange_teacher", hint: "Teacher room instability" },
  { key: "delta", w: "w4", label: "Cworking_days", hint: "MinWorkingDays violation" },
];

const MIN = 0;
const MAX = 5;
const STEP = 0.1;

export default function WeightSliders() {
  const [cfg, setCfg] = useState<ConstraintConfig | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getConstraints().then(setCfg).catch((e) => setErr(String(e)));
  }, []);

  const update = async (key: "alpha" | "beta" | "gamma" | "delta", value: number) => {
    if (!cfg) return;
    const next = { ...cfg, [key]: value };
    setCfg(next);
    setPending(true);
    setErr(null);
    try {
      const saved = await api.updateConstraints({
        alpha: next.alpha, beta: next.beta, gamma: next.gamma, delta: next.delta,
      });
      setCfg(saved);
    } catch (e) {
      setErr(String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Cost Weights</h3>
        <span className={styles.cardHint}>{pending ? "Saving…" : "Auto-saved"}</span>
      </div>
      {err && <div className={styles.error}>{err}</div>}
      {!cfg ? (
        <div className={styles.cardHint}>Loading…</div>
      ) : (
        FIELDS.map((f) => {
          const value = cfg[f.key] as number;
          return (
            <div key={f.key}>
              <div className={styles.sliderLabel}>
                <span>
                  <strong>{f.w}</strong> · {f.label} <span style={{ color: "var(--gray-400)" }}>— {f.hint}</span>
                </span>
                <span className={styles.sliderValue}>{value.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={MIN}
                max={MAX}
                step={STEP}
                value={value}
                onChange={(e) => update(f.key, Number(e.target.value))}
                className={styles.slider}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
