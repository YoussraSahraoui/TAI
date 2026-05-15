import { useEffect, useMemo, useState } from "react";
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

interface Slot {
  roomName: string;
  subject: string;
  teacher: string;
  type: string;
}

/**
 * Per-curriculum (student group) weekly view.
 *
 * Same shape as TeacherSchedule but filtered by `student_group` instead
 * of `teacher`. A group can attend at most one session per period (H4),
 * so each cell holds at most one entry.
 */
export default function GroupSchedule({ grid }: Props) {
  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const row of grid.grid) for (const cell of row) {
      if (!cell) continue;
      // Enumerate every curriculum a lecture is attended by, not just the
      // primary one — so shared lectures (e.g. AI_S1 spanning G1..G6) make
      // every relevant group selectable.
      const cs = cell.curricula?.length ? cell.curricula : (cell.student_group ? [cell.student_group] : []);
      for (const c of cs) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [grid]);

  const [selected, setSelected] = useState<string>("");
  useEffect(() => {
    if (groups.length === 0) return;
    if (!selected || !groups.includes(selected)) setSelected(groups[0]);
  }, [groups, selected]);

  const days = useMemo(() => {
    const out: string[] = [];
    for (const p of grid.periods) if (!out.includes(p.day)) out.push(p.day);
    return out;
  }, [grid.periods]);

  const slots = useMemo(() => {
    const seen = new Map<number, { start: string; end: string }>();
    for (const p of grid.periods) {
      if (!seen.has(p.slot_idx)) seen.set(p.slot_idx, { start: p.start_time, end: p.end_time });
    }
    return [...seen.entries()].sort(([a], [b]) => a - b).map(([idx, t]) => ({ idx, ...t }));
  }, [grid.periods]);

  const periodAt = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    for (const p of grid.periods) {
      if (!m[p.day]) m[p.day] = {};
      m[p.day][p.slot_idx] = p.idx;
    }
    return m;
  }, [grid.periods]);

  const groupSlot = useMemo(() => {
    const m: Record<string, Record<number, Slot | null>> = {};
    if (!selected) return m;
    for (const day of days) {
      m[day] = {};
      for (const s of slots) {
        const periodIdx = periodAt[day]?.[s.idx];
        if (periodIdx === undefined) { m[day][s.idx] = null; continue; }
        let found: Slot | null = null;
        for (let ri = 0; ri < grid.rooms.length; ri++) {
          const cell = grid.grid[ri]?.[periodIdx];
          if (!cell) continue;
          const memberOf = cell.curricula?.length
            ? cell.curricula.includes(selected)
            : cell.student_group === selected;
          if (memberOf) {
            found = {
              roomName: grid.rooms[ri].name,
              subject: cell.event_label,
              teacher: cell.teacher,
              type: cell.type,
            };
            break;
          }
        }
        m[day][s.idx] = found;
      }
    }
    return m;
  }, [grid, selected, days, slots, periodAt]);

  if (groups.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}><h3>Schedule by Group</h3></div>
        <p className={styles.empty}>No data yet</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Schedule by Group</h3>
        <p className={styles.subtitle}>{groups.length} curricula · pick one to see its week</p>
      </div>
      <div style={{ padding: "12px 28px" }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 12, fontFamily: "inherit", background: "var(--white)", color: "var(--black)", border: "1px solid var(--gray-300)" }}
        >
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className={styles.scroller}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.roomHeader}>Time</th>
              {days.map((d) => <th key={d} className={styles.dayHeader}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.idx}>
                <th className={styles.slotHeader} style={{ whiteSpace: "nowrap", textAlign: "left", padding: "8px 12px" }}>
                  {s.start && s.end ? `${s.start} → ${s.end}` : `Slot ${s.idx + 1}`}
                </th>
                {days.map((d) => {
                  const slot = groupSlot[d]?.[s.idx];
                  if (!slot) return <td key={d} className={styles.empty} />;
                  return (
                    <td key={d} className={styles.bigCell}>
                      <div
                        className={styles.sessionPill}
                        style={{ borderLeftColor: TYPE_COLOR[slot.type] || "#444" }}
                      >
                        <div className={styles.sessionTitle}>{slot.subject}</div>
                        <div className={styles.sessionMeta}>
                          <span>{slot.teacher}</span>
                          <span className={styles.sessionRoom}>{slot.roomName}</span>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
