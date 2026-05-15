import { useMemo, useState } from "react";
import type { SolveRequest, JobSummary } from "../../api/types";
import styles from "./Solver.module.css";

interface Props {
  jobs: JobSummary[];
  onLaunch: (req: SolveRequest) => void;
  activeJobId: string | null;
  activeHcId?: string | null;
  onSelectJob: (job: JobSummary) => void;
}

interface Run {
  run_id: string;
  sa: JobSummary | null;
  hc: JobSummary | null;
  created_at: number;
}

/**
 * Solver control panel.
 *
 * The user no longer chooses an algorithm — every Solve dispatches both
 * Simulated Annealing and Hill Climbing in parallel. Jobs are listed grouped
 * by `run_id` so the SA and HC sibling of one launch appear paired; clicking
 * either one loads both into the comparison view.
 */
export default function JobControlCenter({ jobs, onLaunch, activeJobId, activeHcId, onSelectJob }: Props) {
  // SA defaults match the canonical notebook reference run.
  const [params, setParams] = useState({
    initial_temp: 800,
    cooling_rate: 0.995,
    max_iterations: 15000,
  });

  const handleLaunch = () => {
    onLaunch({
      solver_params: {
        initial_temp: params.initial_temp,
        cooling_rate: params.cooling_rate,
        max_iterations: params.max_iterations,
      },
    });
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "#16a34a";
    if (s === "processing") return "#ca8a04";
    if (s === "failed") return "#e63946";
    return "#737373";
  };

  // Group jobs by run_id (single-orphan jobs go into a synthetic run).
  const runs: Run[] = useMemo(() => {
    const byRun = new Map<string, Run>();
    for (const j of jobs) {
      const key = j.run_id || j.job_id;       // legacy/orphan jobs key by their own id
      const r = byRun.get(key) ?? {
        run_id: key,
        sa: null,
        hc: null,
        created_at: j.created_at ?? 0,
      };
      if (j.algorithm === "hc") r.hc = j; else r.sa = j;
      r.created_at = Math.min(r.created_at || j.created_at || 0, j.created_at ?? r.created_at);
      byRun.set(key, r);
    }
    return [...byRun.values()].sort((a, b) => b.created_at - a.created_at).slice(0, 8);
  }, [jobs]);

  const isRunActive = (r: Run) =>
    (r.sa && activeJobId === r.sa.job_id) || (r.hc && activeHcId === r.hc.job_id);

  return (
    <div className={styles.control}>
      <div className={styles.controlHeader}>
        <h3>Job Control Center</h3>
        <p className={styles.controlSubtitle}>
          Each run launches Simulated Annealing and Hill Climbing in parallel.
          Soft-cost weights live on the Constraints page.
        </p>
      </div>
      <div className={styles.paramGrid}>
        <label>
          Initial Temp
          <input type="number" value={params.initial_temp} min={1}
            onChange={(e) => setParams({ ...params, initial_temp: Number(e.target.value) })} />
        </label>
        <label>
          Cooling Rate
          <input type="number" value={params.cooling_rate} min={0.001} max={0.9999} step={0.001}
            onChange={(e) => setParams({ ...params, cooling_rate: Number(e.target.value) })} />
        </label>
        <label>
          Max Iterations
          <input type="number" value={params.max_iterations} min={100} step={500}
            onChange={(e) => setParams({ ...params, max_iterations: Number(e.target.value) })} />
        </label>
      </div>
      <div className={styles.launchSection}>
        <button className={styles.launchBtn} onClick={handleLaunch}>
          Launch Solver
        </button>
      </div>

      {runs.length > 0 && (
        <div className={styles.jobList}>
          <div className={styles.jobListHeader}>Runs</div>
          {runs.map((r) => {
            const repr = r.sa || r.hc!;
            const active = isRunActive(r);
            return (
              <div
                key={r.run_id}
                className={`${styles.jobCard} ${active ? styles.activeJob : ""}`}
                onClick={() => onSelectJob(repr)}
                style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, padding: "8px 12px" }}
              >
                <span className={styles.jobId} style={{ alignSelf: "center" }}>
                  run {r.run_id.slice(0, 8)}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(["sa", "hc"] as const).map((algo) => {
                    const j = algo === "sa" ? r.sa : r.hc;
                    return (
                      <div key={algo} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 6px",
                          background: algo === "hc" ? "#e76f51" : "#1d3557",
                          color: "#fff",
                          opacity: j ? 1 : 0.35,
                        }}>
                          {algo.toUpperCase()}
                        </span>
                        {j ? (
                          <>
                            <span className={styles.status} style={{ background: statusColor(j.status), padding: "1px 6px", fontSize: 9 }}>
                              {j.status}
                            </span>
                            <span className={styles.jobMeta}>
                              {j.iteration.toLocaleString()} iter · {isFinite(j.best_fitness) ? j.best_fitness.toFixed(2) : "--"}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "var(--gray-400)", fontFamily: "var(--mono)", fontSize: 10 }}>missing</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
