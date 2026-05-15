"""Bridge between the legacy DB schema and the ITC2007 `CourseRoomAllocationProblem`.

The DB still stores Teachers, Rooms, Subjects, StudentGroups, Events and
TimeslotConfig (legacy model). The solver core has moved to the curriculum-
based ITC2007 format. This module reads the DB and produces:

    * a Problem instance ready to be optimised
    * `event_meta`  — list aligned with `problem.lectures` so analytics and
      the API response can render human-readable labels
    * `room_meta`   — list aligned with `problem.rooms` (for the same reason)
    * `period_meta` — list aligned with period indices: each entry has the
      original `day` and `start_time` so the frontend can build a weekly grid

Mapping rules
-------------
* Each DB Event becomes a single Course with `lectures_per_week=1` and
  `min_working_days=1`. Lectures and events therefore share the same index.
* Course type is taken from the related Subject (`event_type`). A simple
  normalisation maps "lecture"/"course"/"amphi" -> "lecture", "td"/"tuto" ->
  "tuto", "tp"/"lab" -> "lab".
* Each StudentGroup defines a curriculum: every event belonging to that group
  is added to the curriculum so they conflict in the same period.
* `days` and `periods_per_day` are inferred from TimeslotConfig — distinct
  `day` strings count, then we count slots per day (max wins).
"""

from __future__ import annotations

from collections import OrderedDict, defaultdict

from sqlalchemy.orm import Session, joinedload

from models.entities import (
    ConstraintConfig,
    Course,
    Curriculum,
    Event,
    Room,
    ScheduleConfig,
    StudentGroup,
    Subject,
    Teacher,
    TimeslotConfig,
    Unavailability,
)
<<<<<<< HEAD
from core.problem import CourseRoomAllocationProblem
=======
from ..src.core.problem import CourseRoomAllocationProblem
>>>>>>> a1ff24e2ad1806633bfd24d6d291242214fcc805


_COURSE_TYPE = {
    "lecture": "lecture", "course": "lecture", "amphi": "lecture", "cm": "lecture",
    "td": "tuto", "tuto": "tuto", "tutorial": "tuto",
    "tp": "lab", "lab": "lab", "practical": "lab",
}

_ROOM_TYPE = {
    "lecture": "amphi", "amphi": "amphi", "auditorium": "amphi", "hall": "amphi",
    "td": "tuto", "tuto": "tuto", "classroom": "tuto", "room": "tuto",
    "tp": "lab", "lab": "lab", "laboratory": "lab",
}


def _course_type(raw: str) -> str:
    """Normalise Subject.event_type → {'lecture', 'tuto', 'lab'}."""
    return _COURSE_TYPE.get((raw or "").strip().lower(), "lecture")


def _room_type(raw: str) -> str:
    """Normalise Room.room_type → {'amphi', 'tuto', 'lab'} (Problem-side keys)."""
    return _ROOM_TYPE.get((raw or "").strip().lower(), "amphi")


def build_problem_from_db(db: Session):
    """Read the DB and build a Problem + index-aligned metadata lists.

    Soft-cost weights (α, β, γ, δ, ε) are read from the singleton
    ConstraintConfig row — see entities.ConstraintConfig. The user edits
    them on the constraints page and the solver consumes them at run time.

    Returns
    -------
    problem      : CourseRoomAllocationProblem
    event_meta   : list[dict]  — keyed by lecture/event index
    room_meta    : list[dict]  — keyed by room index
    period_meta  : list[dict]  — keyed by period index
    """
    # Prefer the ITC2007 tables when populated (uploaded dataset). Otherwise
    # fall back to the legacy Event/StudentGroup CRUD tables.
    if db.query(Course).first() is not None:
        return _build_from_itc(db)

    db_rooms = db.query(Room).order_by(Room.id).all()
    db_timeslots = db.query(TimeslotConfig).order_by(TimeslotConfig.id).all()
    db_events = (
        db.query(Event)
        .options(
            joinedload(Event.subject),
            joinedload(Event.teacher),
            joinedload(Event.student_group),
        )
        .order_by(Event.id)
        .all()
    )

    if not db_rooms:
        raise ValueError("No rooms defined. Add rooms before launching the solver.")
    if not db_timeslots:
        raise ValueError("No timeslots defined. Configure the time grid first.")
    if not db_events:
        raise ValueError("No events defined. Add events before launching the solver.")

    # ── Period grid ──────────────────────────────────────────────────────────
    days_seen: "OrderedDict[str, list[TimeslotConfig]]" = OrderedDict()
    for ts in db_timeslots:
        days_seen.setdefault(ts.day, []).append(ts)
    days = list(days_seen.keys())
    n_days = len(days)
    periods_per_day = max(len(slots) for slots in days_seen.values())

    def _add_minutes(hhmm: str, minutes: int) -> str:
        try:
            h, m = hhmm.split(":")
            total = int(h) * 60 + int(m) + minutes
            return f"{total // 60:02d}:{total % 60:02d}"
        except Exception:
            return ""

    period_meta: list[dict] = []
    for day in days:
        slots = sorted(days_seen[day], key=lambda t: t.start_time)
        for idx in range(periods_per_day):
            if idx < len(slots):
                ts = slots[idx]
                end = _add_minutes(ts.start_time, ts.slot_duration_minutes)
                period_meta.append({
                    "day": ts.day,
                    "start_time": ts.start_time,
                    "end_time": end,
                    "label": ts.label,
                    "slot_idx": idx,
                })
            else:
                period_meta.append({
                    "day": day,
                    "start_time": "",
                    "end_time": "",
                    "label": f"{day}-pad-{idx}",
                    "slot_idx": idx,
                })

    # ── Rooms ────────────────────────────────────────────────────────────────
    rooms: list[dict] = []
    room_meta: list[dict] = []
    for r in db_rooms:
        room_dict: dict = {
            "name": r.name,
            "type": _room_type(r.room_type),
            "cap": int(r.capacity),
        }
        cx = float(r.coord_x) if r.coord_x is not None else 0.0
        cy = float(r.coord_y) if r.coord_y is not None else 0.0
        cz = float(r.coord_z) if r.coord_z is not None else 0.0
        # Only attach coords if at least one component is non-zero — an
        # all-zero triplet is a "no coordinates" signal and disables the
        # distance-aware mode (matches the notebook's auto-detect).
        if cx != 0.0 or cy != 0.0 or cz != 0.0:
            room_dict["coords"] = (cx, cy, cz)
        rooms.append(room_dict)
        room_meta.append({
            "id": r.id,
            "name": r.name,
            "capacity": int(r.capacity),
            "room_type": r.room_type,
            "coord_x": cx,
            "coord_y": cy,
            "coord_z": cz,
        })

    # ── Courses (one per Event) ──────────────────────────────────────────────
    courses: list[dict] = []
    event_meta: list[dict] = []
    code_to_index: dict[str, int] = {}

    for ei, e in enumerate(db_events):
        subj: Subject = e.subject
        teach: Teacher = e.teacher
        group: StudentGroup = e.student_group
        if subj is None or teach is None or group is None:
            raise ValueError(
                f"Event {e.id} has missing relations "
                f"(subject={subj}, teacher={teach}, group={group})."
            )

        code = f"E{e.id}"
        code_to_index[code] = ei
        c_type = _course_type(subj.event_type)
        courses.append({
            "course": code,
            "teacher": teach.name,
            "type": c_type,
            "students": int(group.size),
            "lectures_per_week": 1,
            "min_working_days": 1,
        })
        event_meta.append({
            "id": e.id,
            "code": code,
            "subject_id": subj.id,
            "subject_name": subj.name,
            "teacher_id": teach.id,
            "teacher_name": teach.name,
            "student_group_id": group.id,
            "student_group_name": group.name,
            "curricula_names": [group.name],
            "students": int(group.size),
            "type": c_type,
            # Field names below are kept for backward-compatible analytics code.
            "enrol": int(group.size),
            "prof": teach.name,
        })

    # ── Curricula: one per StudentGroup ──────────────────────────────────────
    curricula: dict[str, set[str]] = defaultdict(set)
    for ei, e in enumerate(db_events):
        gname = e.student_group.name if e.student_group else f"group-{ei}"
        curricula[gname].add(f"E{e.id}")

    # ── Raw weights from ConstraintConfig (no normalisation) ────────────────
    alpha, beta, gamma, delta, epsilon = _read_weights(db)

    problem = CourseRoomAllocationProblem(
        courses=courses,
        rooms=rooms,
        curricula={k: set(v) for k, v in curricula.items()},
        days=n_days,
        periods_per_day=periods_per_day,
        alpha=alpha,
        beta=beta,
        gamma=gamma,
        delta=delta,
        epsilon=epsilon,
    )
    # Two-phase initialisation per notebook: build the initial state via CSP
    # (with random-greedy fallback) using the empty unavailability dict —
    # legacy events have no per-course period bans.
    problem.build_initial_state(unavailability={})

    return problem, event_meta, room_meta, period_meta


def _build_from_itc(db: Session):
    """Build a Problem from the uploaded ITC2007 tables (Course/Curriculum/...).

    Each Course expands into `lectures_per_week` Lectures; the index-aligned
    metadata lists carry one entry per lecture so the frontend can label
    every assignment cell, even if the same course appears multiple times.
    """
    db_courses = (
        db.query(Course)
        .options(joinedload(Course.teacher), joinedload(Course.curricula))
        .order_by(Course.id)
        .all()
    )
    db_rooms = db.query(Room).order_by(Room.id).all()
    sched = db.query(ScheduleConfig).first()
    if sched is None:
        # First call — create the singleton with sensible defaults so the
        # config endpoint has something to read.
        sched = ScheduleConfig(days=5, periods_per_day=6)
        db.add(sched)
        db.commit()
        db.refresh(sched)

    if not db_rooms:
        raise ValueError("No rooms in the uploaded dataset.")
    if not db_courses:
        raise ValueError("No courses in the uploaded dataset.")

    # ── Period grid ──────────────────────────────────────────────────────────
    n_days = sched.days
    periods_per_day = sched.periods_per_day
    start_hour = int(sched.start_hour)
    slot_min = int(sched.slot_duration_minutes)
    period_meta: list[dict] = []
    DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for d in range(n_days):
        day_label = DAY_NAMES[d] if d < len(DAY_NAMES) else f"D{d}"
        for s in range(periods_per_day):
            start_minutes = start_hour * 60 + s * slot_min
            end_minutes = start_minutes + slot_min
            start_str = f"{start_minutes // 60:02d}:{start_minutes % 60:02d}"
            end_str = f"{end_minutes // 60:02d}:{end_minutes % 60:02d}"
            period_meta.append({
                "day": day_label,
                "start_time": start_str,
                "end_time": end_str,
                "label": f"{day_label} {start_str}-{end_str}",
                "slot_idx": s,
            })

    # ── Rooms ────────────────────────────────────────────────────────────────
    rooms: list[dict] = []
    room_meta: list[dict] = []
    for r in db_rooms:
        room_dict: dict = {
            "name": r.name,
            "type": _room_type(r.room_type),
            "cap": int(r.capacity),
        }
        cx = float(r.coord_x) if r.coord_x is not None else 0.0
        cy = float(r.coord_y) if r.coord_y is not None else 0.0
        cz = float(r.coord_z) if r.coord_z is not None else 0.0
        if cx != 0.0 or cy != 0.0 or cz != 0.0:
            room_dict["coords"] = (cx, cy, cz)
        rooms.append(room_dict)
        room_meta.append({
            "id": r.id,
            "name": r.name,
            "capacity": int(r.capacity),
            "room_type": r.room_type,
            "coord_x": cx,
            "coord_y": cy,
            "coord_z": cz,
        })

    # ── Courses: pass straight through, preserving lectures_per_week ─────────
    courses_payload: list[dict] = []
    course_index_by_code: dict[str, int] = {}
    for ci, c in enumerate(db_courses):
        course_index_by_code[c.code] = ci
        courses_payload.append({
            "course": c.code,
            "teacher": c.teacher.name if c.teacher else f"T{c.teacher_id}",
            "type": _course_type(c.type),
            "students": int(c.students),
            "lectures_per_week": int(c.lectures_per_week),
            "min_working_days": int(c.min_working_days),
        })

    # ── Curricula ────────────────────────────────────────────────────────────
    curricula: dict[str, set[str]] = {}
    for cu in db.query(Curriculum).options(joinedload(Curriculum.courses)).all():
        curricula[cu.name] = {c.code for c in cu.courses}

    # ── Unavailability ───────────────────────────────────────────────────────
    unavailability: dict[str, set[int]] = defaultdict(set)
    for u in db.query(Unavailability).options(joinedload(Unavailability.course)).all():
        if u.course is not None:
            unavailability[u.course.code].add(int(u.period))

    # ── Raw weights from ConstraintConfig (notebook semantics: no normalise) ──
    alpha, beta, gamma, delta, epsilon = _read_weights(db)

    problem = CourseRoomAllocationProblem(
        courses=courses_payload,
        rooms=rooms,
        curricula=curricula,
        days=n_days,
        periods_per_day=periods_per_day,
        unavailability=dict(unavailability),
        alpha=alpha,
        beta=beta,
        gamma=gamma,
        delta=delta,
        epsilon=epsilon,
    )
    # Two-phase init: CSP-seeded initial state respecting unavailability.
    problem.build_initial_state(unavailability=dict(unavailability))

    # ── Per-lecture metadata aligned with problem.lectures order ────────────
    # `curricula_names` carries EVERY curriculum the parent course belongs to,
    # so a lecture shared across G1..G6 (e.g. AI_S1) shows up in all six
    # groups' weekly schedules at the same period.
    event_meta: list[dict] = []
    for lec in problem.lectures:
        ci = course_index_by_code.get(lec["course"])
        c = db_courses[ci] if ci is not None else None
        curricula_names: list[str] = []
        if c is not None:
            curricula_names = sorted(cu.name for cu in c.curricula)
        students = lec["students"]
        event_meta.append({
            "id": c.id if c is not None else -1,
            "code": lec["course"],
            "subject_id": c.id if c is not None else -1,
            "subject_name": lec["course"],
            "teacher_id": c.teacher_id if c is not None else -1,
            "teacher_name": lec["teacher"],
            "student_group_id": -1,
            "student_group_name": curricula_names[0] if curricula_names else "",
            "curricula_names": curricula_names,
            "students": students,
            "type": lec["type"],
            "enrol": students,
            "prof": lec["teacher"],
        })

    return problem, event_meta, room_meta, period_meta


def _read_weights(db: Session) -> tuple[float, float, float, float, float]:
    """Return (α, β, γ, δ, ε) from the singleton ConstraintConfig row.

    Notebook defaults (alpha=1.0, beta=0.5, gamma=0.5, delta=1.0, epsilon=2.0)
    are baked into the ORM model so a freshly-created config row already
    matches the canonical reference.
    """
    cfg = db.query(ConstraintConfig).first()
    if not cfg:
        cfg = ConstraintConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return (
        float(cfg.alpha),
        float(cfg.beta),
        float(cfg.gamma),
        float(cfg.delta),
        float(cfg.epsilon),
    )


