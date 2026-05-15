"""Post-run analytics: fitness curve, bottlenecks, utilization, advisory.

Reads from a finished `SolverJob`. Both `events` and `rooms` are the
metadata lists produced by `solver_service.build_problem_from_db`, so each
entry has rich descriptive keys (`coord_x`, `coord_y`, `enrol`, `prof`,
`name`, `capacity`).
"""

from __future__ import annotations

import math

from backend.models.schemas import ConstraintViolation, FitnessCurvePoint
from backend.services.job_manager import SolverJob


def get_fitness_curve(job: SolverJob) -> list[FitnessCurvePoint]:
    return [
        FitnessCurvePoint(iteration=i, fitness=f)
        for i, f in enumerate(job.fitness_history)
    ]


def get_bottlenecks(job: SolverJob) -> list[ConstraintViolation]:
    state = job.best_state
    if not state:
        return []

    violations: list[ConstraintViolation] = []
    rooms = job.rooms
    events = job.events
    n_rooms = len(rooms)
    n_events = len(events)

    # Per-event wasted capacity (top 10%)
    waste_scores: list[tuple[int, int, int]] = []
    for ei, (ri, _ti) in state.items():
        if 0 <= ei < n_events and 0 <= ri < n_rooms:
            cap = int(rooms[ri].get("capacity", 0))
            enrol = int(events[ei].get("enrol", 0))
            waste_scores.append((ei, ri, cap - enrol))

    waste_scores.sort(key=lambda x: x[2], reverse=True)
    top_n = max(1, len(waste_scores) // 10)
    for ei, ri, waste in waste_scores[:top_n]:
        room_name = rooms[ri].get("name", f"Room {ri}")
        ev = events[ei]
        violations.append(
            ConstraintViolation(
                constraint_type="wasted_capacity",
                entity=f"{ev.get('subject_name', f'Event {ei}')} in {room_name}",
                severity=float(waste),
                description=(
                    f"{room_name} (cap={rooms[ri].get('capacity')}) hosts "
                    f"{ev.get('subject_name', f'Event {ei}')} "
                    f"(enrol={ev.get('enrol')}); "
                    f"{waste} seats wasted."
                ),
            )
        )

    # Teacher travel between consecutive periods
    prof_schedule: dict[str, list[tuple[int, int, int]]] = {}
    for ei, (ri, ti) in state.items():
        if 0 <= ei < n_events:
            prof = events[ei].get("prof", "")
            prof_schedule.setdefault(prof, []).append((ti, ri, ei))

    for prof, sched in prof_schedule.items():
        sched.sort(key=lambda x: x[0])
        for k in range(len(sched) - 1):
            ti, ri, _ei = sched[k]
            ti1, ri1, _ei1 = sched[k + 1]
            if ti1 == ti + 1 and ri != ri1:
                if 0 <= ri < n_rooms and 0 <= ri1 < n_rooms:
                    cx = float(rooms[ri].get("coord_x", 0.0))
                    cy = float(rooms[ri].get("coord_y", 0.0))
                    cz = float(rooms[ri].get("coord_z", 0.0))
                    cx1 = float(rooms[ri1].get("coord_x", 0.0))
                    cy1 = float(rooms[ri1].get("coord_y", 0.0))
                    cz1 = float(rooms[ri1].get("coord_z", 0.0))
                    dist = math.sqrt((cx - cx1) ** 2 + (cy - cy1) ** 2 + (cz - cz1) ** 2)
                    if dist > 0:
                        violations.append(
                            ConstraintViolation(
                                constraint_type="travel_distance",
                                entity=f"Prof {prof}",
                                severity=dist,
                                description=(
                                    f"{prof} must travel {dist:.1f} units "
                                    f"between {rooms[ri].get('name')} and "
                                    f"{rooms[ri1].get('name')} "
                                    f"in consecutive slots."
                                ),
                            )
                        )

    violations.sort(key=lambda v: v.severity, reverse=True)
    return violations


def get_utilization(job: SolverJob) -> dict[str, float]:
    state = job.best_state
    if not state:
        return {}

    n_periods = len(job.period_meta) or len(job.timeslots) or 1
    room_usage: dict[int, int] = {}
    for _ei, (ri, _ti) in state.items():
        room_usage[ri] = room_usage.get(ri, 0) + 1

    result: dict[str, float] = {}
    for ri in range(len(job.rooms)):
        used = room_usage.get(ri, 0)
        pct = (used / n_periods) * 100 if n_periods > 0 else 0
        name = job.rooms[ri].get("name", f"Room {ri}")
        result[name] = round(pct, 1)
    return result


def get_advisory(job: SolverJob) -> list[str]:
    state = job.best_state
    if not state:
        return ["No solution available yet."]

    advice: list[str] = []
    rooms = job.rooms
    events = job.events
    n_periods = len(job.period_meta) or len(job.timeslots) or 1

    # Teachers sprinkled across many rooms
    prof_rooms: dict[str, set[int]] = {}
    for ei, (ri, _ti) in state.items():
        if 0 <= ei < len(events):
            prof = events[ei].get("prof", "")
            prof_rooms.setdefault(prof, set()).add(ri)

    for prof, room_set in prof_rooms.items():
        if len(room_set) > 3:
            advice.append(
                f"{prof} teaches in {len(room_set)} different rooms — "
                f"consider grouping their classes to reduce travel."
            )

    # Underutilised rooms
    room_usage: dict[int, int] = {}
    for _ei, (ri, _ti) in state.items():
        room_usage[ri] = room_usage.get(ri, 0) + 1

    for ri in range(len(rooms)):
        used = room_usage.get(ri, 0)
        pct = (used / n_periods) * 100 if n_periods > 0 else 0
        if pct < 30 and n_periods > 2:
            name = rooms[ri].get("name", f"Room {ri}")
            advice.append(
                f"{name} is only {pct:.0f}% utilised — "
                f"consider removing it from the pool."
            )

    # Bad capacity matches
    for ei, (ri, _ti) in state.items():
        if 0 <= ei < len(events) and 0 <= ri < len(rooms):
            cap = int(rooms[ri].get("capacity", 0))
            enrol = int(events[ei].get("enrol", 0))
            waste = cap - enrol
            if cap > 0 and waste > cap * 0.6:
                advice.append(
                    f"{events[ei].get('subject_name', f'Event {ei}')} "
                    f"(enrol={enrol}) sits in {rooms[ri].get('name')} "
                    f"(cap={cap}); a smaller room would improve efficiency."
                )

    if not advice:
        advice.append("The current schedule looks well-optimised.")

    return advice
