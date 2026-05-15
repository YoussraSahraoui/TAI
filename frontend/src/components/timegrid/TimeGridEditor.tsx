import { useState } from "react";
import type { Timeslot } from "../../api/types";
import styles from "./TimeGridEditor.module.css";

interface Props {
  timeslots: Timeslot[];
  onGenerate: (days: string[], startHour: number, endHour: number, duration: number) => void;
  onDelete: (id: number) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function TimeGridEditor({ timeslots, onGenerate, onDelete }: Props) {
  const [selectedDays, setSelectedDays] = useState<string[]>([...DEFAULT_DAYS]);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(18);
  const [duration, setDuration] = useState(60);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Time Grid Definition</h3>
      </div>
      <div className={styles.config}>
        <div className={styles.days}>
          {DAYS.map((day) => (
            <label key={day} className={styles.dayLabel}>
              <input
                type="checkbox"
                checked={selectedDays.includes(day)}
                onChange={() => toggleDay(day)}
              />
              {day}
            </label>
          ))}
        </div>
        <div className={styles.params}>
          <label>
            Start Hour
            <input type="number" value={startHour} min={0} max={23}
              onChange={(e) => setStartHour(Number(e.target.value))} />
          </label>
          <label>
            End Hour
            <input type="number" value={endHour} min={1} max={24}
              onChange={(e) => setEndHour(Number(e.target.value))} />
          </label>
          <label>
            Duration (min)
            <input type="number" value={duration} min={15} step={15}
              onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
          <button onClick={() => onGenerate(selectedDays, startHour, endHour, duration)}>
            Generate
          </button>
        </div>
      </div>

      {timeslots.length > 0 && (
        <div className={styles.grid}>
          <p>{timeslots.length} slots defined</p>
          <div className={styles.slots}>
            {timeslots.map((ts) => (
              <span key={ts.id} className={styles.slot}>
                {ts.label}
                <button onClick={() => onDelete(ts.id)}>&times;</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
