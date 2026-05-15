from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.entities import Course, ScheduleConfig, Unavailability
from backend.models.schemas import UnavailabilityCreate, UnavailabilityResponse

router = APIRouter(prefix="/api/unavailability", tags=["unavailability"])


def _to_response(u: Unavailability) -> dict:
    return {
        "id": u.id,
        "course_id": u.course_id,
        "period": u.period,
        "course_code": u.course.code if u.course else None,
    }


def _validate_period(db: Session, period: int) -> None:
    cfg = db.query(ScheduleConfig).first()
    if cfg is not None:
        n = cfg.days * cfg.periods_per_day
        if not 0 <= period < n:
            raise HTTPException(400, f"period must be in [0, {n})")


@router.get("", response_model=list[UnavailabilityResponse])
def list_unavailability(db: Session = Depends(get_db)):
    return [_to_response(u) for u in db.query(Unavailability).all()]


@router.post("", response_model=UnavailabilityResponse, status_code=201)
def create_unavailability(body: UnavailabilityCreate, db: Session = Depends(get_db)):
    if not db.get(Course, body.course_id):
        raise HTTPException(400, f"Course {body.course_id} does not exist")
    _validate_period(db, body.period)
    u = Unavailability(**body.model_dump())
    db.add(u)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "(course_id, period) already exists")
    db.refresh(u)
    return _to_response(u)


@router.delete("/{unavailability_id}", status_code=204)
def delete_unavailability(unavailability_id: int, db: Session = Depends(get_db)):
    u = db.get(Unavailability, unavailability_id)
    if not u:
        raise HTTPException(404, "Unavailability not found")
    db.delete(u)
    db.commit()
