import { useState } from "react";
import { api } from "../../api/client";
import type { DatasetFormat, UploadSummary } from "../../api/types";
import styles from "./Dashboard.module.css";

interface Props {
  onUploaded?: (summary: UploadSummary) => void;
}

export default function FileUpload({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<DatasetFormat>("itc2007");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setSummary(null);
    try {
      const result = await api.uploadDataset(file, format);
      setSummary(result);
      onUploaded?.(result);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Dataset Upload</h3>
        <span className={styles.cardHint}>ITC2007 or custom format</span>
      </div>

      <input
        type="file"
        className={styles.fileInput}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <div className={styles.row}>
        <select
          className={styles.select}
          value={format}
          onChange={(e) => setFormat(e.target.value as DatasetFormat)}
        >
          <option value="itc2007">ITC2007</option>
          <option value="custom">Custom</option>
        </select>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!file || busy}
          onClick={submit}
        >
          {busy ? "Uploading…" : "Upload & Validate"}
        </button>
      </div>

      {err && <div className={styles.error}>{err}</div>}

      {summary && (
        <div className={styles.summaryGrid}>
          <Stat label="Format" value={summary.format} />
          <Stat label="Courses" value={summary.n_courses} />
          <Stat label="Lectures" value={summary.n_lectures} />
          <Stat label="Rooms" value={summary.n_rooms} />
          <Stat label="Teachers" value={summary.n_teachers} />
          <Stat label="Curricula" value={summary.n_curricula} />
          <Stat label="Unavail." value={summary.n_unavailabilities} />
          <Stat label="Days × Per." value={`${summary.days}×${summary.periods_per_day}`} />
          <Stat label="Distance" value={summary.use_distance ? "yes" : "no"} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.summaryItem}>
      <div className={styles.summaryValue}>{value}</div>
      <div className={styles.summaryLabel}>{label}</div>
    </div>
  );
}
