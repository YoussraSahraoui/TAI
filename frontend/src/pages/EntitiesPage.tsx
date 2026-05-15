import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import type { Teacher, Room, Subject, StudentGroup, Event, Timeslot } from "../api/types";
import CrudTable from "../components/entities/CrudTable";
import EventTable from "../components/entities/EventTable";
import TimeGridEditor from "../components/timegrid/TimeGridEditor";
import DatasetUpload from "../components/upload/DatasetUpload";
import styles from "./Pages.module.css";

type Tab = "teachers" | "rooms" | "subjects" | "groups" | "events" | "timegrid";

const TAB_SUBTITLES: Record<Tab, string> = {
  teachers: "People who teach events. Each teacher must have a unique name — they will be assigned to events on the Events tab.",
  rooms: "Physical spaces available for scheduling. Set capacity, type and (x,y) coordinates — coordinates are used to minimise teacher travel between rooms.",
  subjects: "Courses or activities that need to be scheduled. The event type determines which rooms are compatible (e.g. a lab subject needs a lab room).",
  groups: "Cohorts of students that attend events together. Group size must fit within the capacity of any assigned room.",
  events: "A teacher delivering a subject to a student group. Events are the atomic units the solver places into rooms and timeslots.",
  timegrid: "Define the weekly time grid by generating slots from opening/closing hours and a slot duration, or by deleting individual slots.",
};

const ROOM_TYPES = [
  { value: "classroom", label: "Classroom" },
  { value: "lecture_hall", label: "Lecture Hall" },
  { value: "lab", label: "Laboratory" },
  { value: "seminar_room", label: "Seminar Room" },
  { value: "computer_lab", label: "Computer Lab" },
];

const EVENT_TYPES = [
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "lab", label: "Laboratory" },
  { value: "seminar", label: "Seminar" },
];

export default function EntitiesPage() {
  const [tab, setTab] = useState<Tab>("teachers");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);

  const reload = useCallback(() => {
    api.getTeachers().then(setTeachers).catch(() => {});
    api.getRooms().then(setRooms).catch(() => {});
    api.getSubjects().then(setSubjects).catch(() => {});
    api.getStudentGroups().then(setGroups).catch(() => {});
    api.getEvents().then(setEvents).catch(() => {});
    api.getTimeslots().then(setTimeslots).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "teachers", label: "Teachers", count: teachers.length },
    { key: "rooms", label: "Rooms", count: rooms.length },
    { key: "subjects", label: "Subjects", count: subjects.length },
    { key: "groups", label: "Groups", count: groups.length },
    { key: "events", label: "Events", count: events.length },
    { key: "timegrid", label: "Time Grid", count: timeslots.length },
  ];

  return (
    <div>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <div className={styles.eyebrow}>Data</div>
          <h1 className={styles.pageTitle}>Entity Management</h1>
          <p className={styles.pageLede}>
            Build the problem instance: register every teacher, room, subject,
            student group and event the solver should consider, then generate
            a weekly time grid.
          </p>
        </div>
      </header>

      <DatasetUpload onUploaded={reload} />

      <div className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.activeTab : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} <span style={{ opacity: 0.5, marginLeft: 4 }}>{t.count}</span>
          </button>
        ))}
      </div>

      <p className={styles.tabSubtitle}>{TAB_SUBTITLES[tab]}</p>

      {tab === "teachers" && (
        <CrudTable<Teacher>
          title="Teachers"
          subtitle="Add, edit or remove teaching staff."
          columns={[
            { key: "name", label: "Full Name", helpText: "E.g. Dr. Marie Curie", placeholder: "Enter full name" },
          ]}
          items={teachers}
          onCreate={(d) => api.createTeacher(d as { name: string }).then(reload)}
          onUpdate={(id, d) => api.updateTeacher(id, d as { name: string }).then(reload)}
          onDelete={(id) => api.deleteTeacher(id).then(reload)}
        />
      )}

      {tab === "rooms" && (
        <CrudTable<Room>
          title="Classrooms"
          subtitle="Each room has a fixed capacity, a type that constrains which events fit, and (x,y) coordinates used for travel-distance cost."
          columns={[
            { key: "name", label: "Name", placeholder: "Room B-201" },
            { key: "capacity", label: "Capacity", type: "number", helpText: "Max seats available" },
            { key: "room_type", label: "Type", options: ROOM_TYPES, helpText: "Must match event type" },
            { key: "coord_x", label: "X Coordinate", type: "number", helpText: "For travel cost" },
            { key: "coord_y", label: "Y Coordinate", type: "number", helpText: "For travel cost" },
            { key: "coord_z", label: "Z Coordinate", type: "number", helpText: "For travel cost (floor / level)" },
          ]}
          items={rooms}
          onCreate={(d) => api.createRoom(d as any).then(reload)}
          onUpdate={(id, d) => api.updateRoom(id, d as any).then(reload)}
          onDelete={(id) => api.deleteRoom(id).then(reload)}
        />
      )}

      {tab === "subjects" && (
        <CrudTable<Subject>
          title="Subjects"
          subtitle="Courses and activities. The event type determines which rooms are compatible."
          columns={[
            { key: "name", label: "Subject Name", placeholder: "Discrete Mathematics" },
            { key: "event_type", label: "Event Type", options: EVENT_TYPES, helpText: "Required room category" },
          ]}
          items={subjects}
          onCreate={(d) => api.createSubject(d as any).then(reload)}
          onUpdate={(id, d) => api.updateSubject(id, d as any).then(reload)}
          onDelete={(id) => api.deleteSubject(id).then(reload)}
        />
      )}

      {tab === "groups" && (
        <CrudTable<StudentGroup>
          title="Student Groups"
          subtitle="Cohorts that attend events together. Size must fit in any assigned room."
          columns={[
            { key: "name", label: "Group Name", placeholder: "CS-Year-1-A" },
            { key: "size", label: "Size", type: "number", helpText: "Number of students" },
          ]}
          items={groups}
          onCreate={(d) => api.createStudentGroup(d as any).then(reload)}
          onUpdate={(id, d) => api.updateStudentGroup(id, d as any).then(reload)}
          onDelete={(id) => api.deleteStudentGroup(id).then(reload)}
        />
      )}

      {tab === "events" && (
        <EventTable
          events={events}
          teachers={teachers}
          subjects={subjects}
          groups={groups}
          onCreate={(d) => api.createEvent(d).then(reload)}
          onDelete={(id) => api.deleteEvent(id).then(reload)}
        />
      )}

      {tab === "timegrid" && (
        <TimeGridEditor
          timeslots={timeslots}
          onGenerate={(days, start, end, dur) =>
            api.generateTimeGrid(days, start, end, dur).then(reload)
          }
          onDelete={(id) => api.deleteTimeslot(id).then(reload)}
        />
      )}
    </div>
  );
}
