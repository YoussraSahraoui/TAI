import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HCEvent, SAEvent } from "../../api/types";
import { useSSE } from "../../hooks/useSSE";
import styles from "./Dashboard.module.css";

interface Props {
  saUrl: string | null;
  hcUrl: string | null;
  onSaDone?: (final: number) => void;
  onHcDone?: (final: number) => void;
}

interface Row {
  step: number;
  sa?: number;
  hc?: number;
}

/**
 * Real-time cost-vs-iteration chart with SA (blue) and HC (orange) overlaid.
 *
 * Each stream emits its own (x, cost) sequence on independent x-axes. We pad
 * by step index and let recharts' connectNulls bridge gaps so both lines
 * share one chart even if their lengths differ.
 */
export default function CostChart({ saUrl, hcUrl, onSaDone, onHcDone }: Props) {
  const [saSeries, setSaSeries] = useState<number[]>([]);
  const [hcSeries, setHcSeries] = useState<number[]>([]);

  // Reset SA series when starting a new SA run.
  useEffect(() => {
    if (saUrl !== null) setSaSeries([]);
  }, [saUrl]);
  useEffect(() => {
    if (hcUrl !== null) setHcSeries([]);
  }, [hcUrl]);

  const sa = useSSE<SAEvent>({
    url: saUrl,
    onMessage: (ev) => setSaSeries((s) => [...s, ev.best]),
    onDone: (final) => {
      const f = (final as { final_cost?: number } | null)?.final_cost;
      if (typeof f === "number") onSaDone?.(f);
    },
  });

  const hc = useSSE<HCEvent>({
    url: hcUrl,
    onMessage: (ev) => setHcSeries((s) => [...s, ev.best]),
    onDone: (final) => {
      const f = (final as { final_cost?: number } | null)?.final_cost;
      if (typeof f === "number") onHcDone?.(f);
    },
  });

  const data: Row[] = useMemo(() => {
    const n = Math.max(saSeries.length, hcSeries.length);
    const rows: Row[] = [];
    for (let i = 0; i < n; i++) {
      rows.push({
        step: i,
        sa: i < saSeries.length ? saSeries[i] : undefined,
        hc: i < hcSeries.length ? hcSeries[i] : undefined,
      });
    }
    return rows;
  }, [saSeries, hcSeries]);

  const statusTag = (status: string, label: string) => {
    if (status === "streaming")
      return <span className={`${styles.tag} ${styles.tagWarn}`}>{label} live</span>;
    if (status === "done")
      return <span className={`${styles.tag} ${styles.tagOk}`}>{label} done</span>;
    if (status === "error")
      return <span className={`${styles.tag} ${styles.tagErr}`}>{label} err</span>;
    if (status === "connecting")
      return <span className={styles.tag}>{label} …</span>;
    return null;
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Cost vs Iteration</h3>
        <div className={styles.row}>
          {statusTag(sa.status, "SA")}
          {statusTag(hc.status, "HC")}
        </div>
      </div>

      <div style={{ width: "100%", height: 320 }}>
        {data.length === 0 ? (
          <div className={styles.cardHint} style={{ paddingTop: 100, textAlign: "center" }}>
            Run SA or HC to stream live cost updates.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--gray-200)" strokeDasharray="3 3" />
              <XAxis
                dataKey="step"
                stroke="var(--gray-500)"
                fontSize={11}
                label={{ value: "iter / restart", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis stroke="var(--gray-500)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--white)",
                  border: "1px solid var(--gray-300)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="sa"
                name="SA (best)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="hc"
                name="HC (best)"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className={styles.cardHint}>
        SA points: {saSeries.length} · HC points: {hcSeries.length}
        {sa.error && <span style={{ color: "var(--accent)", marginLeft: 12 }}>SA: {sa.error}</span>}
        {hc.error && <span style={{ color: "var(--accent)", marginLeft: 12 }}>HC: {hc.error}</span>}
      </div>
    </div>
  );
}
