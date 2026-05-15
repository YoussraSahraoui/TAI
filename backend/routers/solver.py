"""Solver HTTP layer.

Endpoints
---------
* `POST /solve`            launch SA or HC; returns a job_id immediately.
* `GET  /state/{job_id}`   poll a job's live state (assignments + history).
* `GET  /jobs`             list all jobs.
* `GET  /grid/{job_id}`    timetable grid (rooms × periods) for the best state.

The legacy frontend polls `/state/:job_id` every 500ms, which suits the
in-process background thread runner without any SSE plumbing.
"""

from __future__ import annotations

import threading
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import (
    AssignmentPoint,
    JobSummary,
    SolveRequest,
    SolveResponse,
    StateResponse,
)
from services.job_manager import job_manager
from bservices.solver_service import build_problem_from_db

router = APIRouter(tags=["solver"])


def _seed_job(problem, event_meta, room_meta, period_meta, algorithm: str, run_id: str):
    job = job_manager.create_job(algorithm=algorithm, run_id=run_id)
    job.rooms = room_meta
    job.events = event_meta
    job.timeslots = [p["label"] for p in period_meta]
    job.period_meta = period_meta
    return job


@router.post("/solve", response_model=SolveResponse)
def launch_solver(request: SolveRequest, db: Session = Depends(get_db)):
    """Run BOTH algorithms (SA and HC) in parallel.

    The user no longer picks an algorithm — they just press Solve and we
    fire both, surfacing the better result and both fitness curves.
    Returns the SA job id as `job_id` (for backwards compat) and both ids
    in `jobs`.
    """
    try:
        problem, event_meta, room_meta, period_meta = build_problem_from_db(db)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Both jobs of one /solve invocation share a run_id so the frontend
    # can group them and always show SA + HC together regardless of which
    # one the user clicked from history.
    run_id = str(uuid.uuid4())
    sa_job = _seed_job(problem, event_meta, room_meta, period_meta, "sa", run_id)
    hc_job = _seed_job(problem, event_meta, room_meta, period_meta, "hc", run_id)

    threading.Thread(
        target=job_manager.run_solver_sa,
        args=(sa_job, problem, request.solver_params),
        daemon=True,
    ).start()
    threading.Thread(
        target=job_manager.run_solver_hc,
        args=(hc_job, problem, request.solver_params),
        daemon=True,
    ).start()

    return SolveResponse(
        job_id=sa_job.job_id,
        status="processing",
        sa_job_id=sa_job.job_id,
        hc_job_id=hc_job.job_id,
    )


@router.get("/state/{job_id}", response_model=StateResponse)
def get_state(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    state = job.best_state or job.current_state or {}
    assignments = []
    for ei, (ri, ti) in state.items():
        room = job.rooms[ri] if 0 <= ri < len(job.rooms) else {}
        period = job.period_meta[ti] if 0 <= ti < len(job.period_meta) else {}
        ev = job.events[ei] if 0 <= ei < len(job.events) else {}

        x = float(room.get("coord_x", 0.0))
        y = float(room.get("coord_y", 0.0))
        z = float(ti)

        event_label = ev.get("subject_name") or f"Event {ei}"
        room_label = room.get("name") or f"Room {ri}"
        ts_label = period.get("label") or str(ti)

        assignments.append(
            AssignmentPoint(
                event_idx=ei,
                room_idx=ri,
                timeslot_idx=ti,
                x=x,
                y=y,
                z=z,
                event_label=event_label,
                room_label=room_label,
                timeslot_label=ts_label,
            )
        )

    return StateResponse(
        job_id=job_id,
        algorithm=job.algorithm,
        status=job.status,
        iteration=job.iteration,
        fitness=job.current_fitness,
        best_fitness=job.best_fitness,
        assignments=assignments,
        fitness_history=job.fitness_history[-2000:],
        current_history=job.current_history[-2000:],
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        timestamp=time.time(),
    )


@router.get("/jobs", response_model=list[JobSummary])
def list_jobs():
    return [
        JobSummary(
            job_id=j.job_id,
            run_id=j.run_id,
            algorithm=j.algorithm,
            status=j.status,
            iteration=j.iteration,
            best_fitness=j.best_fitness,
            created_at=j.created_at,
        )
        for j in job_manager.list_jobs()
    ]


@router.get("/grid/{job_id}")
def get_timetable_grid(job_id: str):
    """Return a rooms × periods grid suitable for a heatmap or table view.

    Each cell contains either `null` or `{event_idx, event_label, teacher,
    student_group}`. The frontend uses room/period meta to render headers.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    n_rooms = len(job.rooms)
    n_periods = len(job.period_meta)
    grid: list[list[dict | None]] = [[None] * n_periods for _ in range(n_rooms)]

    state = job.best_state or job.current_state or {}
    for ei, (ri, ti) in state.items():
        if not (0 <= ri < n_rooms and 0 <= ti < n_periods):
            continue
        ev = job.events[ei] if 0 <= ei < len(job.events) else {}
        grid[ri][ti] = {
            "event_idx": ei,
            "event_label": ev.get("subject_name") or f"Event {ei}",
            "teacher": ev.get("teacher_name") or "",
            "student_group": ev.get("student_group_name") or "",
            "curricula": ev.get("curricula_names") or [],
            "students": ev.get("students", 0),
            "type": ev.get("type") or "",
        }

    return {
        "job_id": job_id,
        "status": job.status,
        "rooms": [
            {"idx": i, "name": r.get("name"), "capacity": r.get("capacity")}
            for i, r in enumerate(job.rooms)
        ],
        "periods": [
            {
                "idx": i,
                "day": p.get("day"),
                "start_time": p.get("start_time"),
                "end_time": p.get("end_time", ""),
                "slot_idx": p.get("slot_idx", i),
                "label": p.get("label"),
            }
            for i, p in enumerate(job.period_meta)
        ],
        "grid": grid,
    }
