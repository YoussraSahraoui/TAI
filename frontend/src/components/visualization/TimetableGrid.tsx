import { useMemo } from "react";
import type { TimetableGrid as Grid } from "../../api/types";
import styles from "./TimetableGrid.module.css";

interface Props {
  grid: Grid;
}

const TYPE_COLOR: Record<string, string> = {
  lecture: "#1d3557",
  tuto: "#2a9d8f",
  lab: "#e76f51",
};

export default function TimetableGrid({ grid }: Props) {
  const days = useMemo(() => {
    const seen: string[] = [];
    for (const p of grid.periods) {
      if (!seen.includes(p.day)) seen.push(p.day);
    }
    return seen;
  }, [grid.periods]);

  const periodsByDay = useMemo(() => {
    const m: Record<string, { idx: number; start_time: string; label: string }[]> = {};
    for (const p of grid.periods) {
      if (!m[p.day]) m[p.day] = [];
      m[p.day].push({ idx: p.idx, start_time: p.start_time, label: p.label });
    }
    return m;
  }, [grid.periods]);

  if (grid.rooms.length === 0 || grid.periods.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}><h3>Timetable Grid</h3></div>
        <p className={styles.empty}>No data yet</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Timetable Grid</h3>
        <p className={styles.subtitle}>
          {grid.rooms.length} rooms × {grid.periods.length} periods
        </p>
      </div>
      <div className={styles.scroller}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th rowSpan={2} className={styles.roomHeader}>Room</th>
              {days.map((d) => (
                <th key={d} colSpan={periodsByDay[d].length} className={styles.dayHeader}>
                  {d}
                </th>
              ))}
            </tr>
            <tr>
              {days.flatMap((d) =>
                periodsByDay[d].map((p) => (
                  <th key={`${d}-${p.idx}`} className={styles.slotHeader} title={p.label}>
                    {p.start_time || `S${p.idx}`}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {grid.rooms.map((room) => (
              <tr key={room.idx}>
                <th className={styles.roomCell} title={`Capacity: ${room.capacity}`}>
                  {room.name}
                  <span className={styles.cap}>{room.capacity}</span>
                </th>
                {grid.periods.map((p) => {
                  const cell = grid.grid[room.idx]?.[p.idx];
                  if (!cell) return <td key={p.idx} className={styles.empty} />;
                  return (
                    <td
                      key={p.idx}
                      className={styles.cell}
                      style={{ background: TYPE_COLOR[cell.type] || "#444" }}
                      title={`${cell.event_label}\nteacher: ${cell.teacher}\ngroup: ${cell.student_group} (${cell.students})`}
                    >
                      <span className={styles.cellLabel}>{cell.event_label}</span>
                      <span className={styles.cellMeta}>{cell.teacher}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.legend}>
        {Object.entries(TYPE_COLOR).map(([k, v]) => (
          <span key={k} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
