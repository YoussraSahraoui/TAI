"""POST /api/upload — parse a dataset file and replace DB contents."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import UploadSummary
from parser import parse_custom, parse_itc2007, wipe_and_persist
from parser.types import ParsedDataset

from ...src.core.problem import CourseRoomAllocationProblem

from ...src.core.problem import CourseRoomAllocationProblem


router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("", response_model=UploadSummary)
async def upload_dataset(
    file: UploadFile = File(...),
    format: Literal["itc2007", "custom"] = Form(...),
    db: Session = Depends(get_db),
):
    raw = (await file.read()).decode("utf-8", errors="replace")

    parser = parse_itc2007 if format == "itc2007" else parse_custom
    try:
        ds: ParsedDataset = parser(raw)
    except ValueError as e:
        raise HTTPException(400, f"Parse error: {e}")

    # Validate by attempting to construct a Problem instance — the notebook's
    # validators will reject infeasible/malformed input with descriptive errors.
    try:
        _validate_against_problem(ds)
    except ValueError as e:
        raise HTTPException(400, f"Dataset validation failed: {e}")

    try:
        wipe_and_persist(db, ds)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, f"Persistence error: {e}")

    n_lectures = sum(c["lectures_per_week"] for c in ds.courses)
    return UploadSummary(
        format=format,
        n_courses=len(ds.courses),
        n_lectures=n_lectures,
        n_rooms=len(ds.rooms),
        n_teachers=len(ds.teachers),
        n_curricula=len(ds.curricula),
        n_unavailabilities=sum(len(s) for s in ds.unavailability.values()),
        days=ds.days,
        periods_per_day=ds.periods_per_day,
        use_distance=ds.use_distance,
    )


def _validate_against_problem(ds: ParsedDataset) -> None:
    """Build a CourseRoomAllocationProblem to surface schema errors early.

    This also exercises _generate_random_state, so a feasibility failure
    bubbles up as a clear ValueError before we touch the DB.
    """
    rooms = [
        {
            "name": r["name"],
            "type": r["type"],
            "cap": r["cap"],
            **(
                {"coords": (r["coord_x"], r["coord_y"], r["coord_z"])}
                if r.get("coord_x") is not None
                and r.get("coord_y") is not None
                and r.get("coord_z") is not None
                else {}
            ),
        }
        for r in ds.rooms
    ]
    courses = [
        {
            "course": c["code"],
            "teacher": c["teacher"],
            "type": c["type"],
            "students": c["students"],
            "lectures_per_week": c["lectures_per_week"],
            "min_working_days": c["min_working_days"],
        }
        for c in ds.courses
    ]
    curricula = {name: set(members) for name, members in ds.curricula.items()}
    CourseRoomAllocationProblem(
        courses=courses,
        rooms=rooms,
        curricula=curricula,
        days=ds.days,
        periods_per_day=ds.periods_per_day,
        unavailability={k: set(v) for k, v in ds.unavailability.items()},
    )
