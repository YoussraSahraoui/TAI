import type { StateResponse } from "../../api/types";
import styles from "./Solver.module.css";

interface Props {
  sa: StateResponse | null;
  hc: StateResponse | null;
}

function durationMs(s: StateResponse | null): number | null {
  if (!s || s.started_at == null) return null;
  const end = s.finished_at ?? s.timestamp;
  return Math.max(0, (end - s.started_at) * 1000);
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(2)} min`;
}

function ipsOf(s: StateResponse | null): number | null {
  const ms = durationMs(s);
  if (!s || ms == null || ms === 0) return null;
  return s.iteration / (ms / 1000);
}

/**
 * Side-by-side run metrics for SA vs HC.
 *
 * Time = wall-clock from solver start to finish (or "now" while running).
 * Performance = iterations per second.
 * Accuracy = final best_fitness (lower is better, in the heuristic units).
 */
export default function RunMetrics({ sa, hc }: Props) {
  const saMs = durationMs(sa);
  const hcMs = durationMs(hc);
  const saBest = sa?.best_fitness;
  const hcBest = hc?.best_fitness;

  const winner: "sa" | "hc" | "tie" | null = (() => {
    if (saBest == null || hcBest == null) return null;
    if (!isFinite(saBest) && !isFinite(hcBest)) return null;
    if (saBest === hcBest) return "tie";
    return saBest < hcBest ? "sa" : "hc";
  })();

  const gap = (saBest != null && hcBest != null && isFinite(saBest) && isFinite(hcBest))
    ? Math.abs(saBest - hcBest)
    : null;

  const Cell = ({ v, mono = true }: { v: string; mono?: boolean }) => (
    <td style={{ fontFamily: mono ? "var(--mono)" : "inherit", padding: "8px 12px", textAlign: "right" }}>{v}</td>
  );

  const Row = ({ label, sa: saV, hc: hcV }: { label: string; sa: string; hc: string }) => (
    <tr>
      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 500, color: "var(--gray-500)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</th>
      <Cell v={saV} />
      <Cell v={hcV} />
    </tr>
  );

  return (
    <div className={styles.control} style={{ marginBottom: 16 }}>
      <div className={styles.controlHeader}>
        <h3>Run Metrics</h3>
        <p className={styles.controlSubtitle}>Performance · time · accuracy in heuristic units</p>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--gray-200)" }}>
            <th />
            <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontSize: 12 }}>
              Simulated Annealing {winner === "sa" && <span style={{ color: "var(--accent)" }}>★</span>}
              {winner === "tie" && <span style={{ color: "var(--gray-500)" }}> (tie)</span>}
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontSize: 12 }}>
              Hill Climbing {winner === "hc" && <span style={{ color: "var(--accent)" }}>★</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          <Row label="Status" sa={sa?.status ?? "—"} hc={hc?.status ?? "—"} />
          <Row label="Iterations" sa={sa ? sa.iteration.toLocaleString() : "—"} hc={hc ? hc.iteration.toLocaleString() : "—"} />
          <Row label="Wall time" sa={fmtDuration(saMs)} hc={fmtDuration(hcMs)} />
          <Row
            label="Iter/sec"
            sa={ipsOf(sa) != null ? ipsOf(sa)!.toFixed(0) : "—"}
            hc={ipsOf(hc) != null ? ipsOf(hc)!.toFixed(0) : "—"}
          />
          <Row
            label="Best cost (lower is better)"
            sa={saBest != null && isFinite(saBest) ? saBest.toFixed(2) : "—"}
            hc={hcBest != null && isFinite(hcBest) ? hcBest.toFixed(2) : "—"}
          />
          <Row label="Gap" sa={gap != null ? gap.toFixed(2) : "—"} hc={gap != null ? gap.toFixed(2) : "—"} />
        </tbody>
      </table>
    </div>
  );
}
