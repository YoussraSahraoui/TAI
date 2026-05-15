import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useThemeColors } from "../../hooks/useThemeColors";
import styles from "./Analytics.module.css";

interface Props {
  utilization: Record<string, number>;
}

export default function UtilizationChart({ utilization }: Props) {
  const c = useThemeColors();
  const data = Object.entries(utilization).map(([room, pct]) => ({
    room,
    utilization: pct,
  }));

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>Room Utilization</h3>
      </div>
      <div className={styles.cardBody}>
        {data.length === 0 ? (
          <p className={styles.empty}>No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.gridLine} />
              <XAxis
                dataKey="room"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text }}
              />
              <YAxis
                unit="%"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: c.text }}
                tick={{ fill: c.text }}
                domain={[0, 100]}
              />
              <Tooltip
                formatter={(v) => `${typeof v === "number" ? v.toFixed(1) : v}%`}
                contentStyle={{
                  background: c.surfaceInverse,
                  border: "none",
                  borderRadius: 0,
                  color: c.textOnInverse,
                  fontSize: 12,
                  fontFamily: "var(--mono)",
                }}
              />
              <Bar dataKey="utilization" radius={0}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.utilization > 60 ? c.text : d.utilization > 30 ? c.muted : c.accent}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
