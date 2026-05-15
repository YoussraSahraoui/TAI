import { useState } from "react";
import { api } from "../../api/client";
import type { SolveResponse } from "../../api/types";
import styles from "./Dashboard.module.css";

interface Props {
  /** Called when user clicks Run SA — parent owns the SSE URL state. */
  onStartSA: () => void;
  /** Called when user clicks Run HC. */
  onStartHC: () => void;
  /** Called after CSP completes so parent can refresh dependent widgets. */
  onCspDone?: (resp: SolveResponse) => void;
  /** True while either SSE stream is live; disables Run buttons. */
  streaming: boolean;
}

export default function Controls({ onStartSA, onStartHC, onCspDone, streaming }: Props) {
  const [cspBusy, setCspBusy] = useState(false);
  const [cspResult, setCspResult] = useState<SolveResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const runCsp = async () => {
    setCspBusy(true);
    setErr(null);
    try {
      const r = await api.runCsp();
      setCspResult(r);
      onCspDone?.(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setCspBusy(false);
    }
  };

  const downloadPdf = () => {
    window.open(api.exportPdfUrl(), "_blank");
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Solver Controls</h3>
        <span className={styles.cardHint}>CSP → SA / HC → export</span>
      </div>

      <div className={styles.row} style={{ flexWrap: "wrap" }}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={runCsp}
          disabled={cspBusy || streaming}
        >
          {cspBusy ? "Solving…" : "1 · Run CSP"}
        </button>
        <button
          className={styles.btn}
          onClick={onStartSA}
          disabled={streaming}
        >
          2a · Run SA
        </button>
        <button
          className={styles.btn}
          onClick={onStartHC}
          disabled={streaming}
        >
          2b · Run HC
        </button>
        <button
          className={`${styles.btn} ${styles.btnAccent}`}
          onClick={downloadPdf}
          disabled={streaming}
        >
          Export PDF
        </button>
      </div>

      {err && <div className={styles.error}>{err}</div>}

      {cspResult && (
        <div className={styles.cardHint}>
          CSP <strong>{cspResult.status}</strong> · cost <strong>{cspResult.cost.toFixed(2)}</strong> · {cspResult.n_lectures} lectures
        </div>
      )}
    </div>
  );
}
