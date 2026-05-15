import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { FitnessCurvePoint } from "../../api/types";
import { useThemeColors } from "../../hooks/useThemeColors";
import styles from "./Analytics.module.css";

interface Props {
  data: FitnessCurvePoint[];
  /** Optional: per-iteration current cost (e.g. SA acceptance trace). */
  current?: number[];
  title?: string;
}

export default function FitnessCurve({ data, current, title = "Fitness vs. Iteration" }: Props) {
  const c = useThemeColors();

  const sampleStep = data.length > 500 ? Math.ceil(data.length / 500) : 1;
  const merged = data.map((p, i) => ({
    iteration: p.iteration,
    best: p.fitness,
    current: current && i < current.length ? current[i] : undefined,
  }));
  const sampled = sampleStep > 1
    ? merged.filter((_, i) => i % sampleStep === 0 || i === merged.length - 1)
    : merged;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>{title}</h3>
      </div>
      <div className={styles.cardBody}>
        {sampled.length === 0 ? (
          <p className={styles.empty}>No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={sampled}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.gridLine} />
              <XAxis
                dataKey="iteration"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text }}
              />
              <YAxis
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text }}
              />
              <Tooltip
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
              {current && current.length > 0 && (
                <Legend wrapperStyle={{ fontSize: 10, color: c.muted }} />
              )}
              {current && current.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="current"
                  name="current"
                  stroke={c.muted}
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="best"
                name="best"
                stroke={c.accent}
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
