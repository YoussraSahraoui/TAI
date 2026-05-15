// --- Entity types ---
export interface Teacher {
  id: number;
  name: string;
}
export type TeacherCreate = Omit<Teacher, "id">;

export interface Room {
  id: number;
  name: string;
  capacity: number;
  room_type: string;
  coord_x: number;
  coord_y: number;
  coord_z: number;
}
export type RoomCreate = Omit<Room, "id">;

export interface Subject {
  id: number;
  name: string;
  event_type: string;
}
export type SubjectCreate = Omit<Subject, "id">;

export interface StudentGroup {
  id: number;
  name: string;
  size: number;
}
export type StudentGroupCreate = Omit<StudentGroup, "id">;

export interface Event {
  id: number;
  subject_id: number;
  teacher_id: number;
  student_group_id: number;
  subject_name?: string;
  teacher_name?: string;
  group_name?: string;
}
export type EventCreate = Omit<Event, "id" | "subject_name" | "teacher_name" | "group_name">;

export interface Timeslot {
  id: number;
  label: string;
  day: string;
  start_time: string;
  slot_duration_minutes: number;
}
export type TimeslotCreate = Omit<Timeslot, "id">;

// --- Constraints (notebook-aligned: raw float weights α β γ δ ε) ---
export interface ConstraintConfig {
  id: number;
  enforce_capacity: boolean;
  enforce_type_match: boolean;
  enforce_no_double_booking: boolean;
  alpha: number;       // Cdist weight
  beta: number;        // Cwaste weight
  gamma: number;       // Cchange_teacher weight
  delta: number;       // Cworking_days weight
  epsilon: number;     // Clunch_break weight
}
export type ConstraintUpdate = Omit<ConstraintConfig, "id">;

// --- Solver ---
export interface SolverParams {
  algorithm?: "sa" | "hc";
  initial_temp: number;
  cooling_rate: number;
  max_iterations: number;
}

export interface SolveRequest {
  solver_params: SolverParams;
}

export interface SolveResponse {
  job_id: string;
  status: string;
  sa_job_id?: string;
  hc_job_id?: string;
}

export interface UploadSummary {
  format: string;
  n_courses: number;
  n_lectures: number;
  n_rooms: number;
  n_teachers: number;
  n_curricula: number;
  n_unavailabilities: number;
  days: number;
  periods_per_day: number;
  use_distance: boolean;
}

export interface AssignmentPoint {
  event_idx: number;
  room_idx: number;
  timeslot_idx: number;
  x: number;
  y: number;
  z: number;
  event_label: string;
  room_label: string;
  timeslot_label: string;
}

export interface StateResponse {
  job_id: string;
  algorithm: "sa" | "hc";
  status: string;
  iteration: number;
  fitness: number;
  best_fitness: number;
  assignments: AssignmentPoint[];
  fitness_history: number[];        // running best
  current_history: number[];        // current-cost per iter
  created_at: number | null;
  started_at: number | null;
  finished_at: number | null;
  timestamp: number;
}

export interface JobSummary {
  job_id: string;
  run_id: string;
  algorithm: "sa" | "hc";
  status: string;
  iteration: number;
  best_fitness: number;
  created_at: number | null;
}

// --- Analytics ---
export interface FitnessCurvePoint {
  iteration: number;
  fitness: number;
}

export interface ConstraintViolation {
  constraint_type: string;
  entity: string;
  severity: number;
  description: string;
}

export interface AnalyticsResponse {
  job_id: string;
  fitness_curve: FitnessCurvePoint[];
  top_violations: ConstraintViolation[];
  resource_utilization: Record<string, number>;
  advisory: string[];
}

// --- Timetable grid ---
export interface GridCell {
  event_idx: number;
  event_label: string;
  teacher: string;
  student_group: string;          // primary curriculum (legacy convenience)
  curricula: string[];            // ALL curricula attending this lecture
  students: number;
  type: string;
}

export interface GridRoom {
  idx: number;
  name: string;
  capacity: number;
}

export interface GridPeriod {
  idx: number;
  day: string;
  start_time: string;
  end_time: string;
  slot_idx: number;
  label: string;
}

export interface TimetableGrid {
  job_id: string;
  status: string;
  rooms: GridRoom[];
  periods: GridPeriod[];
  grid: (GridCell | null)[][];
}
