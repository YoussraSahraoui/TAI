import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LabelList,
} from "recharts";
import type { StateResponse } from "../../api/types";
import { useThemeColors } from "../../hooks/useThemeColors";
import styles from "./Analytics.module.css";

const SA_COLOR = "#1d3557";
const HC_COLOR = "#e76f51";

function durationMs(s: StateResponse | null): number {
  if (!s || s.started_at == null) return 0;
  const end = s.finished_at ?? s.timestamp;
  return Math.max(0, (end - s.started_at) * 1000);
}

function fmt(ms: number) {
  if (ms <= 0) return "—";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(2)} min`;
}

export default function RunningTimeChart({
  sa, hc,
}: { sa: StateResponse | null; hc: StateResponse | null }) {
  const c = useThemeColors();
  const saMs = durationMs(sa);
  const hcMs = durationMs(hc);
  const data = [
    { algorithm: "SA", time_ms: saMs, label: fmt(saMs) },
    { algorithm: "HC", time_ms: hcMs, label: fmt(hcMs) },
  ];
  const colors = [SA_COLOR, HC_COLOR];
  const maxV = Math.max(saMs, hcMs);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Wall-time Comparison</h3>
        <p className={styles.subtitle}>How long each algorithm took</p>
      </div>
      <div className={styles.cardBody} style={{ minHeight: 240 }}>
        {maxV === 0 ? (
          <p className={styles.empty}>Waiting for first iteration…</p>
        ) : (
          <ResponsiveContainer width="100%" height={220} minWidth={220}>
            <BarChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.gridLine} />
              <XAxis
                dataKey="algorithm"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text, fontWeight: 600 }}
              />
              <YAxis
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text }}
                domain={[0, "auto"]}
                allowDecimals={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}`}
              />
              <Tooltip
                formatter={(v) => fmt(typeof v === "number" ? v : Number(v))}
                contentStyle={{
                  background: c.surfaceInverse,
                  border: "none",
                  borderRadius: 0,
                  color: c.textOnInverse,
                  fontSize: 12,
                  fontFamily: "var(--mono)",
                }}
                labelStyle={{ color: c.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}
                cursor={{ fill: "rgba(127,127,127,0.08)" }}
              />
              <Bar dataKey="time_ms" radius={0} name="wall time" maxBarSize={120}>
                {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                <LabelList dataKey="label" position="top" style={{ fill: c.text, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
