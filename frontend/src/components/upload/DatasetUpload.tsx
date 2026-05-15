import { useRef, useState } from "react";
import { api } from "../../api/client";
import type { UploadSummary } from "../../api/types";
import styles from "./DatasetUpload.module.css";

interface Props {
  onUploaded?: (summary: UploadSummary) => void;
  variant?: "hero" | "compact";
}

export default function DatasetUpload({ onUploaded, variant = "hero" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      // Auto-detect format from extension; user can switch later.
      const fmt = file.name.toLowerCase().endsWith(".ctt") ? "itc2007" : "custom";
      const s = await api.uploadDataset(file, fmt);
      setSummary(s);
      onUploaded?.(s);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <div className={`${styles.box} ${variant === "compact" ? styles.compact : styles.hero} ${dragOver ? styles.over : ""}`}
         onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
         onDragLeave={() => setDragOver(false)}
         onDrop={onDrop}>
      <input
        ref={inputRef}
        type="file"
        accept=".ctt,.txt"
        className={styles.input}
        onChange={onPick}
      />
      <div className={styles.left}>
        <div className={styles.eyebrow}>Dataset</div>
        <div className={styles.title}>Upload a .ctt timetable</div>
        <div className={styles.hint}>
          Drag a file here or click to browse. ITC2007 standard or ENSIA-extended .ctt.
        </div>
        {error && <div className={styles.error}>{error}</div>}
        {summary && (
          <div className={styles.summary}>
            <span><b>{summary.n_courses}</b> courses</span>
            <span><b>{summary.n_lectures}</b> lectures</span>
            <span><b>{summary.n_rooms}</b> rooms</span>
            <span><b>{summary.n_teachers}</b> teachers</span>
            <span><b>{summary.n_curricula}</b> curricula</span>
            <span><b>{summary.days}×{summary.periods_per_day}</b> grid</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className={styles.btn}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : summary ? "Replace dataset" : "Choose .ctt file"}
      </button>
    </div>
  );
}
