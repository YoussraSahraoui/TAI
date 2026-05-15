import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { ResultsResponse } from "../../api/types";
import styles from "./Dashboard.module.css";

interface Props {
  refreshKey?: number;
}

export default function ProfessorSchedule({ refreshKey = 0 }: Props) {
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    api
      .getResults()
      .then((r) => { if (!cancelled) setResults(r); })
      .catch((e) => {
        if (cancelled) return;
        if (String(e).startsWith("404")) setResults(null);
        else setErr(String(e));
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const teachers = useMemo(() => {
    if (!results) return [];
    return [...new Set(results.assignments.map((a) => a.teacher_name))].sort();
  }, [results]);

  // Auto-select first teacher when data lands.
  useEffect(() => {
    if (!selected && teachers.length > 0) setSelected(teachers[0]);
  }, [teachers, selected]);

  const periodsPerDay = useMemo(() => {
    if (!results) return 1;
    let max = 0;
    for (const a of results.assignments) if (a.slot > max) max = a.slot;
    return max + 1;
  }, [results]);

  const days = useMemo(() => {
    if (!results) return 1;
    let max = 0;
    for (const a of results.assignments) if (a.day > max) max = a.day;
    return max + 1;
  }, [results]);

  const cells = useMemo(() => {
    const grid: ({ code: string; room: string } | null)[][] = Array.from(
      { length: periodsPerDay },
      () => Array(days).fill(null),
    );
    if (!results || !selected) return grid;
    for (const a of results.assignments) {
      if (a.teacher_name !== selected) continue;
      grid[a.slot][a.day] = { code: a.course_code, room: a.room_name };
    }
    return grid;
  }, [results, selected, periodsPerDay, days]);

  if (err) return <div className={styles.card}><div className={styles.error}>{err}</div></div>;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Professor Schedule</h3>
        {teachers.length > 0 && (
          <select
            className={styles.select}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {teachers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
      {!results ? (
        <div className={styles.cardHint}>No solver result yet.</div>
      ) : teachers.length === 0 ? (
        <div className={styles.cardHint}>No teachers in result set.</div>
      ) : (
        <div className={styles.heatmapWrap}>
          <table className={styles.heatmap}>
            <thead>
              <tr>
                <th className={styles.rowHeader}>Period</th>
                {Array.from({ length: days }, (_, d) => (
                  <th key={d}>Day {d + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map((row, slot) => (
                <tr key={slot}>
                  <th className={styles.rowHeader}>P{slot + 1}</th>
                  {row.map((cell, d) => (
                    <td key={d} className={cell ? "" : styles.empty}>
                      {cell ? <span><strong>{cell.code}</strong><br />{cell.room}</span> : "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
