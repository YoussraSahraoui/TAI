import { useState } from "react";
import type { Course, Curriculum, CurriculumCreate } from "../../api/types";
import styles from "./CrudTable.module.css";

interface Props {
  curricula: Curriculum[];
  courses: Course[];
  onCreate: (d: CurriculumCreate) => void;
  onUpdate: (id: number, d: CurriculumCreate) => void;
  onDelete: (id: number) => void;
}

export default function CurriculaEditor({ curricula, courses, onCreate, onUpdate, onDelete }: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editId, setEditId] = useState<number | null>(null);

  const reset = () => {
    setName("");
    setSelected(new Set());
    setEditId(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: CurriculumCreate = { name: name.trim(), course_ids: [...selected] };
    if (editId !== null) onUpdate(editId, payload);
    else onCreate(payload);
    reset();
  };

  const startEdit = (c: Curriculum) => {
    setEditId(c.id);
    setName(c.name);
    setSelected(new Set(c.course_ids));
  };

  const toggle = (cid: number) => {
    const next = new Set(selected);
    if (next.has(cid)) next.delete(cid);
    else next.add(cid);
    setSelected(next);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Curricula</h3>
        <p className={styles.subtitle}>Pick the courses that share students. H5 prevents same-curriculum courses from clashing on a timeslot.</p>
      </div>

      <form onSubmit={submit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Curriculum name</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CS-Y1"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Courses ({selected.size} selected)</label>
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--gray-200)", borderRadius: 4, padding: 8 }}>
            {courses.length === 0 && <span className={styles.fieldHelp}>Create some courses first.</span>}
            {courses.map((c) => (
              <label key={c.id} style={{ display: "block", padding: "4px 0", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  style={{ marginRight: 8 }}
                />
                <strong>{c.code}</strong> <span style={{ color: "var(--gray-500)" }}>({c.teacher_name ?? "?"} · {c.type})</span>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          {editId !== null && (
            <button type="button" className={styles.cancelBtn} onClick={reset}>Cancel</button>
          )}
          <button type="submit" className={styles.submitBtn}>{editId !== null ? "Update" : "Add"}</button>
        </div>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.idCol}>ID</th>
              <th>Name</th>
              <th>Courses</th>
              <th className={styles.actionsCol}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {curricula.map((c) => (
              <tr key={c.id}>
                <td className={styles.idCol}>{c.id}</td>
                <td>{c.name}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                  {c.course_ids
                    .map((cid) => courses.find((co) => co.id === cid)?.code ?? `#${cid}`)
                    .join(", ") || "—"}
                </td>
                <td className={styles.actionsCol}>
                  <button className={styles.editBtn} onClick={() => startEdit(c)}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => onDelete(c.id)}>Del</button>
                </td>
              </tr>
            ))}
            {curricula.length === 0 && (
              <tr><td colSpan={4} className={styles.empty}>No curricula yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
