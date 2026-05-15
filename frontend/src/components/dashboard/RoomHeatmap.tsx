import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { ResultsResponse } from "../../api/types";
import styles from "./Dashboard.module.css";

interface Props {
  /** Bumped by parent after a solver run completes to trigger reload. */
  refreshKey?: number;
}

/**
 * Rooms × periods occupancy grid. Cell shaded by utilization (students / cap),
 * label shows course code.
 */
export default function RoomHeatmap({ refreshKey = 0 }: Props) {
  const [results, setResults] = useState<ResultsResponse | null>(null);
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

  const grid = useMemo(() => {
    if (!results) return null;
    const periods = new Set<number>();
    const rooms = new Map<string, Map<number, { code: string; util: number }>>();
    for (const a of results.assignments) {
      periods.add(a.period);
      if (!rooms.has(a.room_name)) rooms.set(a.room_name, new Map());
      rooms.get(a.room_name)!.set(a.period, {
        code: a.course_code,
        util: a.cap > 0 ? a.students / a.cap : 0,
      });
    }
    const periodsList = [...periods].sort((a, b) => a - b);
    const roomsList = [...rooms.keys()].sort();
    return { periodsList, roomsList, rooms };
  }, [results]);

  const periodsPerDay = useMemo(() => {
    if (!results) return 1;
    let max = 0;
    for (const a of results.assignments) {
      if (a.slot > max) max = a.slot;
    }
    return max + 1;
  }, [results]);

  if (err) return <div className={styles.card}><div className={styles.error}>{err}</div></div>;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Room Occupancy</h3>
        <span className={styles.cardHint}>
          {results ? `${results.assignments.length} assignments · cost ${results.cost.toFixed(2)}` : "—"}
        </span>
      </div>
      {!results || !grid ? (
        <div className={styles.cardHint}>No solver result yet. Run CSP first.</div>
      ) : (
        <div className={styles.heatmapWrap}>
          <table className={styles.heatmap}>
            <thead>
              <tr>
                <th className={styles.rowHeader}>Room</th>
                {grid.periodsList.map((p) => (
                  <th key={p}>D{Math.floor(p / periodsPerDay) + 1}P{(p % periodsPerDay) + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.roomsList.map((room) => (
                <tr key={room}>
                  <th className={styles.rowHeader}>{room}</th>
                  {grid.periodsList.map((p) => {
                    const cell = grid.rooms.get(room)!.get(p);
                    if (!cell) return <td key={p} className={styles.empty}>·</td>;
                    const u = Math.min(1, cell.util);
                    // Light → accent gradient.
                    const bg = `rgba(230, 57, 70, ${0.12 + 0.6 * u})`;
                    return (
                      <td key={p} title={`util ${(u * 100).toFixed(0)}%`} style={{ background: bg, color: u > 0.6 ? "var(--white)" : "var(--black)" }}>
                        {cell.code}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
