import { useState } from "react";
import type { Course, Unavailability, UnavailabilityCreate } from "../../api/types";
import styles from "./CrudTable.module.css";

interface Props {
  items: Unavailability[];
  courses: Course[];
  onCreate: (d: UnavailabilityCreate) => void;
  onDelete: (id: number) => void;
}

export default function UnavailabilityEditor({ items, courses, onCreate, onDelete }: Props) {
  const [courseId, setCourseId] = useState<string>("");
  const [period, setPeriod] = useState<string>("0");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    onCreate({ course_id: Number(courseId), period: Number(period) });
    setPeriod("0");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Unavailability (H6)</h3>
        <p className={styles.subtitle}>Forbid a course from being scheduled at a specific 0-indexed period.</p>
      </div>

      <form onSubmit={submit} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Course</label>
            <select
              className={styles.input}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="" disabled>Select…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Period index</label>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
            />
          </div>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn}>Add</button>
        </div>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.idCol}>ID</th>
              <th>Course</th>
              <th>Period</th>
              <th className={styles.actionsCol}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td className={styles.idCol}>{u.id}</td>
                <td>{u.course_code ?? `#${u.course_id}`}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{u.period}</td>
                <td className={styles.actionsCol}>
                  <button className={styles.deleteBtn} onClick={() => onDelete(u.id)}>Del</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className={styles.empty}>No unavailability constraints.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
