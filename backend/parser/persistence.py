"""Wipe-and-replace persistence for parser output."""

from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models.entities import (
    Course,
    Curriculum,
    Room,
    ScheduleConfig,
    Teacher,
    Unavailability,
    curriculum_member,
)
from .types import ParsedDataset


def wipe_and_persist(db: Session, ds: ParsedDataset) -> None:
    """Atomically replaces all dataset entities (Teachers/Rooms/Courses/Curricula
    /Unavailability/ScheduleConfig) with the parsed values.

    Does NOT touch ConstraintConfig (the user's cost weights are preserved
    across uploads).
    """
    # Order matters: drop dependents before parents.
    db.execute(delete(Unavailability))
    db.execute(curriculum_member.delete())
    db.execute(delete(Curriculum))
    db.execute(delete(Course))
    db.execute(delete(Room))
    db.execute(delete(Teacher))
    db.flush()

    # Teachers
    teacher_by_name: dict[str, Teacher] = {}
    for name in ds.teachers:
        t = Teacher(name=name)
        db.add(t)
        teacher_by_name[name] = t
    db.flush()  # populate IDs

    # Rooms (preserve parser order so room_idx is stable). The legacy ORM
    # schema uses `capacity` + `room_type` instead of cap/type.
    for r in ds.rooms:
        db.add(Room(
            name=r["name"],
            capacity=r["cap"],
            room_type=r["type"],
            coord_x=r.get("coord_x") or 0.0,
            coord_y=r.get("coord_y") or 0.0,
            coord_z=r.get("coord_z") or 0.0,
        ))
    db.flush()

    # Courses
    course_by_code: dict[str, Course] = {}
    for c in ds.courses:
        teacher = teacher_by_name.get(c["teacher"])
        if teacher is None:
            # Should not happen — parsers populate ds.teachers from courses.
            teacher = Teacher(name=c["teacher"])
            db.add(teacher)
            db.flush()
            teacher_by_name[c["teacher"]] = teacher
        course = Course(
            code=c["code"],
            teacher_id=teacher.id,
            type=c["type"],
            students=c["students"],
            lectures_per_week=c["lectures_per_week"],
            min_working_days=c["min_working_days"],
        )
        db.add(course)
        course_by_code[c["code"]] = course
    db.flush()

    # Curricula + M2M membership
    for curr_name, member_codes in ds.curricula.items():
        curr = Curriculum(name=curr_name)
        for code in member_codes:
            course = course_by_code.get(code)
            if course is None:
                raise ValueError(
                    f"Curriculum '{curr_name}' references unknown course '{code}'.")
            curr.courses.append(course)
        db.add(curr)
    db.flush()

    # Unavailability
    for course_code, periods in ds.unavailability.items():
        course = course_by_code.get(course_code)
        if course is None:
            raise ValueError(
                f"Unavailability references unknown course '{course_code}'.")
        for p in periods:
            db.add(Unavailability(course_id=course.id, period=p))

    # ScheduleConfig — singleton row id=1
    cfg = db.query(ScheduleConfig).first()
    if cfg is None:
        cfg = ScheduleConfig(id=1, days=ds.days, periods_per_day=ds.periods_per_day)
        db.add(cfg)
    else:
        cfg.days = ds.days
        cfg.periods_per_day = ds.periods_per_day

    db.commit()
