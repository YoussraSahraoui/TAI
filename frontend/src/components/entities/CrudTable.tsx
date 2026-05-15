import { useState } from "react";
import styles from "./CrudTable.module.css";

interface SelectOption {
  value: string;
  label: string;
}

interface Column<T> {
  key: keyof T & string;
  label: string;
  type?: "text" | "number";
  helpText?: string;
  options?: SelectOption[];
  placeholder?: string;
}

interface Props<T extends { id: number }> {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  items: T[];
  onCreate: (data: Record<string, unknown>) => void;
  onUpdate: (id: number, data: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
}

export default function CrudTable<T extends { id: number }>({
  title,
  subtitle,
  columns,
  items,
  onCreate,
  onUpdate,
  onDelete,
}: Props<T>) {
  const emptyForm = Object.fromEntries(
    columns.map((c) => [c.key, c.options?.[0]?.value ?? ""])
  );
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {};
    for (const col of columns) {
      data[col.key] = col.type === "number" ? Number(form[col.key]) : form[col.key];
    }
    if (editId !== null) {
      onUpdate(editId, data);
      setEditId(null);
    } else {
      onCreate(data);
    }
    setForm(emptyForm);
  };

  const startEdit = (item: T) => {
    setEditId(item.id);
    const f: Record<string, string> = {};
    for (const col of columns) {
      f[col.key] = String(item[col.key] ?? "");
    }
    setForm(f);
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(emptyForm);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{title}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          {columns.map((col) => (
            <div key={col.key} className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`f-${col.key}`}>
                {col.label}
              </label>
              {col.options ? (
                <select
                  id={`f-${col.key}`}
                  className={styles.input}
                  value={form[col.key]}
                  onChange={(e) => setForm({ ...form, [col.key]: e.target.value })}
                  required
                >
                  {col.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`f-${col.key}`}
                  className={styles.input}
                  type={col.type || "text"}
                  placeholder={col.placeholder ?? col.label}
                  value={form[col.key]}
                  onChange={(e) => setForm({ ...form, [col.key]: e.target.value })}
                  step={col.type === "number" ? "any" : undefined}
                  required
                />
              )}
              {col.helpText && (
                <span className={styles.fieldHelp}>{col.helpText}</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          {editId !== null && (
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={cancelEdit}
            >
              Cancel
            </button>
          )}
          <button type="submit" className={styles.submitBtn}>
            {editId !== null ? "Update" : "Add"}
          </button>
        </div>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.idCol}>ID</th>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th className={styles.actionsCol}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className={styles.idCol}>{item.id}</td>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.options
                      ? c.options.find((o) => o.value === String(item[c.key]))?.label
                        ?? String(item[c.key] ?? "")
                      : String(item[c.key] ?? "")}
                  </td>
                ))}
                <td className={styles.actionsCol}>
                  <button className={styles.editBtn} onClick={() => startEdit(item)}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => onDelete(item.id)}>Del</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className={styles.empty}>
                  No items yet — add one using the form above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
