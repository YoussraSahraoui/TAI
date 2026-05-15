import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { StateResponse } from "../../api/types";
import { useThemeColors } from "../../hooks/useThemeColors";
import styles from "./Analytics.module.css";

const SA_COLOR = "#1d3557";
const HC_COLOR = "#e76f51";

interface Props {
  sa: StateResponse | null;
  hc: StateResponse | null;
}

interface Pt { t: number; cost: number }

/**
 * Map iteration index → ms-since-its-own-start by linear interpolation
 * across `(started_at, finished_at|now)`. Both jobs launched at the same
 * wall-clock instant from the user's POV, so we can plot them on a shared
 * "elapsed since launch" axis.
 */
function buildSeries(s: StateResponse | null): Pt[] {
  if (!s || !s.fitness_history.length || s.started_at == null) return [];
  const end = s.finished_at ?? s.timestamp;
  const totalMs = Math.max(1, (end - s.started_at) * 1000);
  const n = s.fitness_history.length;
  if (n === 1) return [{ t: 0, cost: s.fitness_history[0] }];
  return s.fitness_history.map((cost, i) => ({
    t: (i / (n - 1)) * totalMs,
    cost,
  }));
}

/**
 * Stepwise lookup: best cost recorded at-or-before time `t` in this series.
 * Returns null when t precedes any data point.
 */
function valueAt(series: Pt[], t: number): number | null {
  if (series.length === 0 || t < series[0].t) return null;
  // Binary search for largest index with series[i].t <= t.
  let lo = 0, hi = series.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (series[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  return series[lo].cost;
}

export default function CostOverTimeChart({ sa, hc }: Props) {
  const c = useThemeColors();

  const data = useMemo(() => {
    const saSeries = buildSeries(sa);
    const hcSeries = buildSeries(hc);
    if (saSeries.length === 0 && hcSeries.length === 0) return [];

    // Build the union of time stamps so each algorithm shows its own ticks.
    const ts = new Set<number>();
    saSeries.forEach((p) => ts.add(Math.round(p.t)));
    hcSeries.forEach((p) => ts.add(Math.round(p.t)));
    const sorted = [...ts].sort((a, b) => a - b);

    // Down-sample to ~400 points to keep Recharts fast on long runs.
    const step = sorted.length > 400 ? Math.ceil(sorted.length / 400) : 1;
    const picked = step > 1
      ? sorted.filter((_, i) => i % step === 0 || i === sorted.length - 1)
      : sorted;

    return picked.map((t) => ({
      t,
      sa: valueAt(saSeries, t),
      hc: valueAt(hcSeries, t),
    }));
  }, [sa, hc]);

  const fmtTime = (ms: number) =>
    ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Cost vs. Time</h3>
        <p className={styles.subtitle}>Best cost over wall-time — both algorithms overlaid</p>
      </div>
      <div className={styles.cardBody}>
        {data.length === 0 ? (
          <p className={styles.empty}>No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.gridLine} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text }}
                tickFormatter={fmtTime}
              />
              <YAxis
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                labelFormatter={(v) => `t = ${fmtTime(Number(v))}`}
                formatter={(v: number | string, name) => [typeof v === "number" ? v.toFixed(2) : v, name]}
                contentStyle={{
                  background: c.surfaceInverse,
                  border: "none",
                  borderRadius: 0,
                  color: c.textOnInverse,
                  fontSize: 12,
                  fontFamily: "var(--mono)",
                }}
                labelStyle={{ color: c.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: c.muted }} />
              <Line
                type="monotone"
                dataKey="sa"
                name="Simulated Annealing"
                stroke={SA_COLOR}
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="hc"
                name="Hill Climbing"
                stroke={HC_COLOR}
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
