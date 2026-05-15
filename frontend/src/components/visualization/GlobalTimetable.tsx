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

interface Session {
  event_idx: number;
  subject: string;
  teacher: string;
  room: string;
  group: string;
  type: string;
}

/**
 * Final-result timetable view.
 *
 * Days span the X-axis, time slots span the Y-axis (e.g. "08:00 → 09:00").
 * Each cell contains every session running at that day+slot across all
 * rooms, since multiple rooms can be in use in parallel.
 */
export default function GlobalTimetable({ grid }: Props) {
  // Distinct days in encounter order.
  const days = useMemo(() => {
    const out: string[] = [];
    for (const p of grid.periods) if (!out.includes(p.day)) out.push(p.day);
    return out;
  }, [grid.periods]);

  // Distinct slot indices (within a day) in numeric order, with the time
  // labels of whichever day actually carries them.
  const slots = useMemo(() => {
    const seen = new Map<number, { start: string; end: string }>();
    for (const p of grid.periods) {
      if (!seen.has(p.slot_idx)) {
        seen.set(p.slot_idx, { start: p.start_time, end: p.end_time });
      }
    }
    return [...seen.entries()]
      .sort(([a], [b]) => a - b)
      .map(([idx, t]) => ({ idx, ...t }));
  }, [grid.periods]);

  // Index periods by (day, slot_idx) → period.idx for quick lookup.
  const periodAt = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    for (const p of grid.periods) {
      if (!m[p.day]) m[p.day] = {};
      m[p.day][p.slot_idx] = p.idx;
    }
    return m;
  }, [grid.periods]);

  // For each (day, slot_idx) collect sessions across all rooms.
  const sessionsAt = useMemo(() => {
    const out: Record<string, Record<number, Session[]>> = {};
    for (const day of days) {
      out[day] = {};
      for (const s of slots) {
        const periodIdx = periodAt[day]?.[s.idx];
        if (periodIdx === undefined) {
          out[day][s.idx] = [];
          continue;
        }
        const list: Session[] = [];
        for (let ri = 0; ri < grid.rooms.length; ri++) {
          const cell = grid.grid[ri]?.[periodIdx];
          if (cell) {
            const groupLabel = cell.curricula?.length
              ? cell.curricula.join(", ")
              : cell.student_group;
            list.push({
              event_idx: cell.event_idx,
              subject: cell.event_label,
              teacher: cell.teacher,
              room: grid.rooms[ri].name,
              group: groupLabel,
              type: cell.type,
            });
          }
        }
        out[day][s.idx] = list;
      }
    }
    return out;
  }, [grid, days, slots, periodAt]);

  if (grid.rooms.length === 0 || grid.periods.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}><h3>Final Timetable</h3></div>
        <p className={styles.empty}>No data yet</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Final Timetable</h3>
        <p className={styles.subtitle}>Days across · time slots down · each cell shows every parallel session</p>
      </div>
      <div className={styles.scroller}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.roomHeader}>Time</th>
              {days.map((d) => (
                <th key={d} className={styles.dayHeader}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.idx}>
                <th className={styles.slotHeader} style={{ whiteSpace: "nowrap", textAlign: "left", padding: "8px 12px" }}>
                  {s.start && s.end ? `${s.start} → ${s.end}` : `Slot ${s.idx + 1}`}
                </th>
                {days.map((d) => {
                  const list = sessionsAt[d]?.[s.idx] ?? [];
                  if (list.length === 0) return <td key={d} className={styles.empty} />;
                  return (
                    <td key={d} className={styles.bigCell}>
                      <div className={styles.sessionStack}>
                        {list.map((sess) => (
                          <div
                            key={sess.event_idx}
                            className={styles.sessionPill}
                            style={{ borderLeftColor: TYPE_COLOR[sess.type] || "#444" }}
                            title={`${sess.subject} · ${sess.teacher} · ${sess.room}${sess.group ? ` · ${sess.group}` : ""}`}
                          >
                            <div className={styles.sessionTitle}>{sess.subject}</div>
                            <div className={styles.sessionMeta}>
                              <span>{sess.teacher}</span>
                              <span className={styles.sessionRoom}>{sess.room}</span>
                            </div>
                            {sess.group && <div className={styles.sessionGroup}>{sess.group}</div>}
                          </div>
                        ))}
                      </div>
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
