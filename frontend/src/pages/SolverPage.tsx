import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api/client";
import type {
  JobSummary,
  StateResponse,
  AnalyticsResponse,
  TimetableGrid,
} from "../api/types";
import DatasetUpload from "../components/upload/DatasetUpload";
import JobControlCenter from "../components/solver/JobControlCenter";
import RunMetrics from "../components/solver/RunMetrics";
import StateCloud from "../components/visualization/StateCloud";
import GlobalTimetable from "../components/visualization/GlobalTimetable";
import TeacherSchedule from "../components/visualization/TeacherSchedule";
import GroupSchedule from "../components/visualization/GroupSchedule";
import FitnessCurve from "../components/analytics/FitnessCurve";
import RunningTimeChart from "../components/analytics/RunningTimeChart";
import CostOverTimeChart from "../components/analytics/CostOverTimeChart";
import UtilizationChart from "../components/analytics/UtilizationChart";
import styles from "./Pages.module.css";

interface JobView {
  state: StateResponse | null;
  analytics: AnalyticsResponse | null;
  grid: TimetableGrid | null;
}

const empty: JobView = { state: null, analytics: null, grid: null };

const TERMINAL = (s: string | undefined) =>
  s === "completed" || s === "failed";

export default function SolverPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [saId, setSaId] = useState<string | null>(null);
  const [hcId, setHcId] = useState<string | null>(null);
  const [sa, setSa] = useState<JobView>(empty);
  const [hc, setHc] = useState<JobView>(empty);

  // Refs let the polling closure read latest values without re-creating
  // the effect every time state changes. saIdRef/hcIdRef are kept in sync
  // with the React state on every render.
  const saIdRef = useRef<string | null>(null);
  const hcIdRef = useRef<string | null>(null);
  const saRef = useRef<JobView>(empty);
  const hcRef = useRef<JobView>(empty);
  saIdRef.current = saId;
  hcIdRef.current = hcId;
  saRef.current = sa;
  hcRef.current = hc;

  const refreshJobs = useCallback(() => {
    api.getJobs().then(setJobs).catch(() => {});
  }, []);

  useEffect(() => { refreshJobs(); }, [refreshJobs]);

  // setInterval-based polling. Fires every 300ms regardless of state
  // changes. Each algorithm has its own in-flight guard so a slow fetch
  // never blocks the other from updating. handleLaunch and onSelectJob
  // can call `pollNow()` to skip the wait.
  const saInflight = useRef(false);
  const hcInflight = useRef(false);

  const fetchOne = useCallback(async (
    jobId: string,
    setView: React.Dispatch<React.SetStateAction<JobView>>,
    ref: React.MutableRefObject<JobView>,
    tokenRef: React.MutableRefObject<string | null>,
  ) => {
    try {
      const s = await api.getState(jobId);
      // If the user switched runs while this fetch was in flight, drop it.
      if (tokenRef.current !== jobId) return;
      if (TERMINAL(s.status) && !ref.current.grid) {
        const [a, g] = await Promise.all([
          api.getAnalytics(jobId).catch(() => null),
          api.getGrid(jobId).catch(() => null),
        ]);
        if (tokenRef.current !== jobId) return;
        setView({ state: s, analytics: a, grid: g });
      } else {
        setView((prev) => ({ ...prev, state: s }));
      }
    } catch { /* swallow & retry next tick */ }
  }, []);

  const pollNow = useCallback(() => {
    const saId = saIdRef.current;
    const hcId = hcIdRef.current;
    if (saId && !saInflight.current) {
      saInflight.current = true;
      fetchOne(saId, setSa, saRef, saIdRef).finally(() => {
        saInflight.current = false;
      });
    }
    if (hcId && !hcInflight.current) {
      hcInflight.current = true;
      fetchOne(hcId, setHc, hcRef, hcIdRef).finally(() => {
        hcInflight.current = false;
      });
    }
  }, [fetchOne]);

  useEffect(() => {
    pollNow();
    const id = setInterval(pollNow, 300);
    return () => clearInterval(id);
  }, [pollNow]);

  const handleLaunch = (req: import("../api/types").SolveRequest) => {
    api.launchSolver(req).then((res) => {
      const newSaId = res.sa_job_id ?? res.job_id;
      const newHcId = res.hc_job_id ?? null;
      // Reset views and refs synchronously so the very next pollNow uses
      // fresh ids and a clean slate.
      setSa(empty);
      setHc(empty);
      saRef.current = empty;
      hcRef.current = empty;
      setSaId(newSaId);
      setHcId(newHcId);
      saIdRef.current = newSaId;
      hcIdRef.current = newHcId;
      saInflight.current = false;
      hcInflight.current = false;
      refreshJobs();
      pollNow();
    }).catch((err) => alert(err.message));
  };

  // Stable winner: pick once both have a final cost; never flip during run.
  const winner: "sa" | "hc" | null = (() => {
    const sBest = sa.state?.best_fitness;
    const hBest = hc.state?.best_fitness;
    if (sBest == null || hBest == null) return null;
    if (!isFinite(sBest) && !isFinite(hBest)) return null;
    return sBest <= hBest ? "sa" : "hc";
  })();

  const winnerView = winner === "sa" ? sa : winner === "hc" ? hc : null;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <div className={styles.eyebrow}>Optimisation</div>
          <h1 className={styles.pageTitle}>Solver & Visualization</h1>
          <p className={styles.pageLede}>
            Each launch dispatches Simulated Annealing and Hill Climbing in
            parallel. Both runs are tracked iteration-by-iteration, then
            compared on time, performance and accuracy.
          </p>
        </div>
      </header>

      <DatasetUpload variant="compact" onUploaded={refreshJobs} />

      <JobControlCenter
        jobs={jobs}
        onLaunch={handleLaunch}
        activeJobId={saId}
        activeHcId={hcId}
        onSelectJob={(job) => {
          // Find both jobs in the same run and load them into their algo
          // slots, so SA and HC stats always appear together regardless of
          // which entry the user clicked.
          setSa(empty);
          setHc(empty);
          saRef.current = empty;
          hcRef.current = empty;
          const siblings = job.run_id
            ? jobs.filter((j) => j.run_id === job.run_id)
            : [job];
          const saSibling = siblings.find((j) => j.algorithm === "sa");
          const hcSibling = siblings.find((j) => j.algorithm === "hc");
          let nextSaId: string | null;
          let nextHcId: string | null;
          if (!saSibling && !hcSibling) {
            // Legacy/orphan jobs without run_id — load just the clicked one.
            nextSaId = job.algorithm === "sa" ? job.job_id : null;
            nextHcId = job.algorithm === "hc" ? job.job_id : null;
          } else {
            nextSaId = saSibling ? saSibling.job_id : null;
            nextHcId = hcSibling ? hcSibling.job_id : null;
          }
          setSaId(nextSaId);
          setHcId(nextHcId);
          saIdRef.current = nextSaId;
          hcIdRef.current = nextHcId;
          saInflight.current = false;
          hcInflight.current = false;
          pollNow();
        }}
      />

      <RunMetrics sa={sa.state} hc={hc.state} />

      {(sa.state || hc.state) && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(420px, 2fr)", gap: 12, marginBottom: 16 }}>
          <RunningTimeChart sa={sa.state} hc={hc.state} />
          <CostOverTimeChart sa={sa.state} hc={hc.state} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {sa.state && sa.state.fitness_history.length > 0 && (
          <FitnessCurve
            title="SA — Cost vs. Iteration"
            data={sa.state.fitness_history.map((f, i) => ({ iteration: i, fitness: f }))}
            current={sa.state.current_history}
          />
        )}
        {hc.state && hc.state.fitness_history.length > 0 && (
          <FitnessCurve
            title="HC — Cost vs. Iteration"
            data={hc.state.fitness_history.map((f, i) => ({ iteration: i, fitness: f }))}
            current={hc.state.current_history}
          />
        )}
      </div>

      {winnerView?.state && (
        <StateCloud
          assignments={winnerView.state.assignments}
          searchPath={[]}
          fitness={winnerView.state.fitness}
          bestFitness={winnerView.state.best_fitness}
          iteration={winnerView.state.iteration}
        />
      )}

      <AlgoBlock label="SIMULATED ANNEALING" view={sa} highlight={winner === "sa"} />
      <AlgoBlock label="HILL CLIMBING" view={hc} highlight={winner === "hc"} />

      {winnerView?.analytics && (
        <UtilizationChart utilization={winnerView.analytics.resource_utilization} />
      )}
    </div>
  );
}

/**
 * Per-algorithm container: timetable + teacher + group views, each with
 * its own dropdowns. Renders nothing until the algorithm has produced a
 * grid, then stays mounted so local state (selected teacher/group) is
 * preserved across polling updates.
 */
function AlgoBlock({ label, view, highlight }: { label: string; view: JobView; highlight: boolean }) {
  if (!view.grid) return null;
  const accent = highlight ? "var(--accent)" : "var(--gray-300)";
  return (
    <section style={{ marginTop: 24, paddingTop: 16, borderTop: `2px solid ${accent}` }}>
      <h2
        style={{
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: highlight ? "var(--accent)" : "var(--gray-500)",
          margin: "0 0 16px",
        }}
      >
        {label} {highlight && "★ winner"}
      </h2>
      <GlobalTimetable grid={view.grid} />
      <TeacherSchedule grid={view.grid} />
      <GroupSchedule grid={view.grid} />
    </section>
  );
}
