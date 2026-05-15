"""Build a CourseRoomAllocationProblem from current DB state.

The DB is the single source of truth — every solver run reads the latest
entities and constraint weights and constructs a fresh Problem.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from models.entities import (
    ConstraintConfig,
    Course,
    Curriculum,
    Room,
    ScheduleConfig,
    Unavailability,
)
from src.core.problem import CourseRoomAllocationProblem


def build_problem(db: Session) -> CourseRoomAllocationProblem:
    rooms_db = db.query(Room).order_by(Room.id).all()
    courses_db = db.query(Course).order_by(Course.id).all()
    curricula_db = db.query(Curriculum).all()
    unavail_db = db.query(Unavailability).all()
    sched = db.query(ScheduleConfig).first()
    weights = db.query(ConstraintConfig).first()

    if not rooms_db:
        raise ValueError("No rooms in database; upload a dataset first.")
    if not courses_db:
        raise ValueError("No courses in database; upload a dataset first.")

    rooms = [
        {
            "name": r.name,
            "type": r.type,
            "cap": r.cap,
            **(
                {"coords": (r.coord_x, r.coord_y)}
                if r.coord_x is not None and r.coord_y is not None
                else {}
            ),
        }
        for r in rooms_db
    ]
    courses = [
        {
            "course": c.code,
            "teacher": c.teacher.name,
            "type": c.type,
            "students": c.students,
            "lectures_per_week": c.lectures_per_week,
            "min_working_days": c.min_working_days,
        }
        for c in courses_db
    ]
    curricula = {cu.name: {c.code for c in cu.courses} for cu in curricula_db}

    unavailability: dict[str, set[int]] = {}
    for u in unavail_db:
        unavailability.setdefault(u.course.code, set()).add(u.period)

    days = sched.days if sched else 5
    periods_per_day = sched.periods_per_day if sched else 6

    use_distance = bool(rooms) and all("coords" in r for r in rooms)

    kwargs = {
        "courses": courses,
        "rooms": rooms,
        "curricula": curricula,
        "days": days,
        "periods_per_day": periods_per_day,
        "unavailability": unavailability,
        "use_distance": use_distance,
    }
    if weights is not None:
        kwargs.update(
            alpha=weights.alpha,
            beta=weights.beta,
            gamma=weights.gamma,
            delta=weights.delta,
        )
    return CourseRoomAllocationProblem(**kwargs)
