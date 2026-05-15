import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { JobSummary } from "../api/types";
import DatasetUpload from "../components/upload/DatasetUpload";
import styles from "./Pages.module.css";

const STAT_LABELS: Record<string, string> = {
  teachers: "Teachers",
  rooms: "Rooms",
  subjects: "Subjects",
  groups: "Groups",
  events: "Events",
  timeslots: "Timeslots",
};

const QUICK_LINKS = [
  {
    to: "/entities",
    idx: "01",
    title: "Define Entities",
    desc: "Register teachers, rooms, subjects, student groups and the weekly time grid.",
  },
  {
    to: "/constraints",
    idx: "02",
    title: "Configure Constraints",
    desc: "Toggle hard rules and tune soft preference weights for travel, capacity and stability.",
  },
  {
    to: "/solver",
    idx: "03",
    title: "Launch Solver",
    desc: "Run simulated annealing or Hill Climbing and explore the 3D search space.",
  },
];

export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [counts, setCounts] = useState({
    teachers: 0, rooms: 0, subjects: 0, groups: 0, events: 0, timeslots: 0,
  });

  const reload = () => {
    Promise.all([
      api.getJobs(),
      api.getTeachers(),
      api.getRooms(),
      api.getSubjects(),
      api.getStudentGroups(),
      api.getEvents(),
      api.getTimeslots(),
    ]).then(([j, t, r, s, g, e, ts]) => {
      setJobs(j);
      setCounts({
        teachers: t.length,
        rooms: r.length,
        subjects: s.length,
        groups: g.length,
        events: e.length,
        timeslots: ts.length,
      });
    }).catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  const statusColor = (s: string) => {
    if (s === "completed") return "var(--success)";
    if (s === "processing") return "var(--warning)";
    if (s === "failed") return "var(--accent)";
    return "var(--gray-500)";
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <div className={styles.eyebrow}>Overview</div>
          <h1 className={styles.pageTitle}>TAI</h1>
          <p className={styles.pageLede}>
            Assign university events to rooms and timeslots by minimising travel
            distance, wasted capacity, and disruption to an existing reference schedule.
          </p>
        </div>
      </header>

      <DatasetUpload onUploaded={reload} />

      <div className={styles.statGrid}>
        {Object.entries(counts).map(([key, val]) => (
          <div key={key} className={styles.statCard}>
            <div className={styles.statValue}>{val}</div>
            <div className={styles.statLabel}>{STAT_LABELS[key] ?? key}</div>
          </div>
        ))}
      </div>

      <div className={styles.quickLinks}>
        {QUICK_LINKS.map((q) => (
          <Link key={q.to} to={q.to} className={styles.quickLink}>
            <div className={styles.quickLinkIdx}>{q.idx}</div>
            <div className={styles.quickLinkTitle}>{q.title}</div>
            <div className={styles.quickLinkDesc}>{q.desc}</div>
          </Link>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Recent Jobs</h3>
          <span className={styles.sectionHint}>{jobs.length} total</span>
        </div>
        {jobs.length === 0 ? (
          <p className={styles.empty}>No solver jobs yet — launch one from the Solver page</p>
        ) : (
          <div className={styles.jobGrid}>
            {jobs.slice(-5).reverse().map((j) => (
              <div key={j.job_id} className={styles.jobCard}>
                <span className={styles.badge} style={{ background: statusColor(j.status) }}>
                  {j.status}
                </span>
                <span className={styles.mono}>{j.job_id.slice(0, 12)}</span>
                <span className={styles.jobMeta}>
                  ITER <strong>{j.iteration.toLocaleString()}</strong>
                </span>
                <span className={styles.jobMeta} style={{ marginLeft: "auto" }}>
                  BEST <strong>{j.best_fitness === Infinity ? "--" : j.best_fitness.toFixed(2)}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
