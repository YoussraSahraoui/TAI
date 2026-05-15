from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.entities import TimeslotConfig
from backend.models.schemas import TimeslotCreate, TimeslotResponse

router = APIRouter(prefix="/api/timeslots", tags=["timeslots"])


@router.get("", response_model=list[TimeslotResponse])
def list_timeslots(db: Session = Depends(get_db)):
    return db.query(TimeslotConfig).order_by(TimeslotConfig.id).all()


@router.get("/{ts_id}", response_model=TimeslotResponse)
def get_timeslot(ts_id: int, db: Session = Depends(get_db)):
    ts = db.get(TimeslotConfig, ts_id)
    if not ts:
        raise HTTPException(404, "Timeslot not found")
    return ts


@router.post("", response_model=TimeslotResponse, status_code=201)
def create_timeslot(body: TimeslotCreate, db: Session = Depends(get_db)):
    ts = TimeslotConfig(**body.model_dump())
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


@router.post("/generate", response_model=list[TimeslotResponse], status_code=201)
def generate_timegrid(
    days: list[str],
    start_hour: int,
    end_hour: int,
    duration_minutes: int = 60,
    db: Session = Depends(get_db),
):
    """Generate a full time grid (e.g. Mon-Fri, 8-18, 60min slots)."""
    db.query(TimeslotConfig).delete()
    created = []
    for day in days:
        hour = start_hour
        while hour < end_hour:
            label = f"{day}-{hour:02d}:00"
            ts = TimeslotConfig(
                label=label,
                day=day,
                start_time=f"{hour:02d}:00",
                slot_duration_minutes=duration_minutes,
            )
            db.add(ts)
            created.append(ts)
            hour += duration_minutes // 60
    db.commit()
    for ts in created:
        db.refresh(ts)
    return created


@router.put("/{ts_id}", response_model=TimeslotResponse)
def update_timeslot(ts_id: int, body: TimeslotCreate, db: Session = Depends(get_db)):
    ts = db.get(TimeslotConfig, ts_id)
    if not ts:
        raise HTTPException(404, "Timeslot not found")
    for k, v in body.model_dump().items():
        setattr(ts, k, v)
    db.commit()
    db.refresh(ts)
    return ts


@router.delete("/{ts_id}", status_code=204)
def delete_timeslot(ts_id: int, db: Session = Depends(get_db)):
    ts = db.get(TimeslotConfig, ts_id)
    if not ts:
        raise HTTPException(404, "Timeslot not found")
    db.delete(ts)
    db.commit()
