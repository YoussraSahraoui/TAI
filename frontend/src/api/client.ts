const BASE_URL = "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Teachers
  getTeachers: () => request<import("./types").Teacher[]>("/api/teachers"),
  createTeacher: (d: import("./types").TeacherCreate) =>
    request<import("./types").Teacher>("/api/teachers", { method: "POST", body: JSON.stringify(d) }),
  updateTeacher: (id: number, d: import("./types").TeacherCreate) =>
    request<import("./types").Teacher>(`/api/teachers/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteTeacher: (id: number) =>
    request<void>(`/api/teachers/${id}`, { method: "DELETE" }),

  // Rooms
  getRooms: () => request<import("./types").Room[]>("/api/rooms"),
  createRoom: (d: import("./types").RoomCreate) =>
    request<import("./types").Room>("/api/rooms", { method: "POST", body: JSON.stringify(d) }),
  updateRoom: (id: number, d: import("./types").RoomCreate) =>
    request<import("./types").Room>(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteRoom: (id: number) =>
    request<void>(`/api/rooms/${id}`, { method: "DELETE" }),

  // Subjects
  getSubjects: () => request<import("./types").Subject[]>("/api/subjects"),
  createSubject: (d: import("./types").SubjectCreate) =>
    request<import("./types").Subject>("/api/subjects", { method: "POST", body: JSON.stringify(d) }),
  updateSubject: (id: number, d: import("./types").SubjectCreate) =>
    request<import("./types").Subject>(`/api/subjects/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteSubject: (id: number) =>
    request<void>(`/api/subjects/${id}`, { method: "DELETE" }),

  // Student Groups
  getStudentGroups: () => request<import("./types").StudentGroup[]>("/api/student-groups"),
  createStudentGroup: (d: import("./types").StudentGroupCreate) =>
    request<import("./types").StudentGroup>("/api/student-groups", { method: "POST", body: JSON.stringify(d) }),
  updateStudentGroup: (id: number, d: import("./types").StudentGroupCreate) =>
    request<import("./types").StudentGroup>(`/api/student-groups/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteStudentGroup: (id: number) =>
    request<void>(`/api/student-groups/${id}`, { method: "DELETE" }),

  // Events
  getEvents: () => request<import("./types").Event[]>("/api/events"),
  createEvent: (d: import("./types").EventCreate) =>
    request<import("./types").Event>("/api/events", { method: "POST", body: JSON.stringify(d) }),
  updateEvent: (id: number, d: import("./types").EventCreate) =>
    request<import("./types").Event>(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteEvent: (id: number) =>
    request<void>(`/api/events/${id}`, { method: "DELETE" }),

  // Timeslots
  getTimeslots: () => request<import("./types").Timeslot[]>("/api/timeslots"),
  createTimeslot: (d: import("./types").TimeslotCreate) =>
    request<import("./types").Timeslot>("/api/timeslots", { method: "POST", body: JSON.stringify(d) }),
  generateTimeGrid: (days: string[], startHour: number, endHour: number, duration: number) =>
    request<import("./types").Timeslot[]>(
      `/api/timeslots/generate?start_hour=${startHour}&end_hour=${endHour}&duration_minutes=${duration}`,
      { method: "POST", body: JSON.stringify(days) },
    ),
  deleteTimeslot: (id: number) =>
    request<void>(`/api/timeslots/${id}`, { method: "DELETE" }),

  // Constraints
  getConstraints: () => request<import("./types").ConstraintConfig>("/api/constraints"),
  updateConstraints: (d: import("./types").ConstraintUpdate) =>
    request<import("./types").ConstraintConfig>("/api/constraints", { method: "PUT", body: JSON.stringify(d) }),

  // Solver
  launchSolver: (d: import("./types").SolveRequest) =>
    request<import("./types").SolveResponse>("/solve", { method: "POST", body: JSON.stringify(d) }),
  getState: (jobId: string) =>
    request<import("./types").StateResponse>(`/state/${jobId}`),
  getJobs: () => request<import("./types").JobSummary[]>("/jobs"),

  // Analytics
  getAnalytics: (jobId: string) =>
    request<import("./types").AnalyticsResponse>(`/api/analytics/${jobId}`),

  // Timetable grid
  getGrid: (jobId: string) =>
    request<import("./types").TimetableGrid>(`/grid/${jobId}`),

  // Upload .ctt / custom dataset
  uploadDataset: async (file: File, format: "itc2007" | "custom") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", format);
    const res = await fetch(`${BASE_URL}/api/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json() as Promise<import("./types").UploadSummary>;
  },
};
