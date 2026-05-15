import { useState } from "react";
import type { Event, EventCreate, Teacher, Subject, StudentGroup } from "../../api/types";
import styles from "./CrudTable.module.css";

interface Props {
  events: Event[];
  teachers: Teacher[];
  subjects: Subject[];
  groups: StudentGroup[];
  onCreate: (data: EventCreate) => void;
  onDelete: (id: number) => void;
}

export default function EventTable({ events, teachers, subjects, groups, onCreate, onDelete }: Props) {
  const [form, setForm] = useState({ subject_id: "", teacher_id: "", student_group_id: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      subject_id: Number(form.subject_id),
      teacher_id: Number(form.teacher_id),
      student_group_id: Number(form.student_group_id),
    });
    setForm({ subject_id: "", teacher_id: "", student_group_id: "" });
  };

  const ready = subjects.length > 0 && teachers.length > 0 && groups.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Events</h3>
        <p className={styles.subtitle}>
          An event = teacher + subject + student group. The solver will assign a room and timeslot.
        </p>
      </div>

      {!ready ? (
        <div className={styles.form}>
          <p className={styles.subtitle}>
            Add at least one Teacher, Subject, and Student Group before creating events.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ev-subject">Subject</label>
              <select
                id="ev-subject"
                className={styles.input}
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                required
              >
                <option value="">Select a subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ev-teacher">Teacher</label>
              <select
                id="ev-teacher"
                className={styles.input}
                value={form.teacher_id}
                onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                required
              >
                <option value="">Select a teacher...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ev-group">Student Group</label>
              <select
                id="ev-group"
                className={styles.input}
                value={form.student_group_id}
                onChange={(e) => setForm({ ...form, student_group_id: e.target.value })}
                required
              >
                <option value="">Select a group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.submitBtn}>Add Event</button>
          </div>
        </form>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.idCol}>ID</th>
              <th>Subject</th>
              <th>Teacher</th>
              <th>Group</th>
              <th className={styles.actionsCol}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td className={styles.idCol}>{ev.id}</td>
                <td>{ev.subject_name}</td>
                <td>{ev.teacher_name}</td>
                <td>{ev.group_name}</td>
                <td className={styles.actionsCol}>
                  <button className={styles.deleteBtn} onClick={() => onDelete(ev.id)}>Del</button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} className={styles.empty}>No events yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
