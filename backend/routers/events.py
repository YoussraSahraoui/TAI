from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.models.database import get_db
from backend.models.entities import Event
from backend.models.schemas import EventCreate, EventResponse

router = APIRouter(prefix="/api/events", tags=["events"])


def _to_response(e: Event) -> EventResponse:
    return EventResponse(
        id=e.id,
        subject_id=e.subject_id,
        teacher_id=e.teacher_id,
        student_group_id=e.student_group_id,
        subject_name=e.subject.name if e.subject else None,
        teacher_name=e.teacher.name if e.teacher else None,
        group_name=e.student_group.name if e.student_group else None,
    )


@router.get("", response_model=list[EventResponse])
def list_events(db: Session = Depends(get_db)):
    events = (
        db.query(Event)
        .options(
            joinedload(Event.subject),
            joinedload(Event.teacher),
            joinedload(Event.student_group),
        )
        .all()
    )
    return [_to_response(e) for e in events]


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    e = (
        db.query(Event)
        .options(
            joinedload(Event.subject),
            joinedload(Event.teacher),
            joinedload(Event.student_group),
        )
        .filter(Event.id == event_id)
        .first()
    )
    if not e:
        raise HTTPException(404, "Event not found")
    return _to_response(e)


@router.post("", response_model=EventResponse, status_code=201)
def create_event(body: EventCreate, db: Session = Depends(get_db)):
    e = Event(**body.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    e = (
        db.query(Event)
        .options(
            joinedload(Event.subject),
            joinedload(Event.teacher),
            joinedload(Event.student_group),
        )
        .filter(Event.id == e.id)
        .first()
    )
    return _to_response(e)


@router.put("/{event_id}", response_model=EventResponse)
def update_event(event_id: int, body: EventCreate, db: Session = Depends(get_db)):
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    db.commit()
    e = (
        db.query(Event)
        .options(
            joinedload(Event.subject),
            joinedload(Event.teacher),
            joinedload(Event.student_group),
        )
        .filter(Event.id == e.id)
        .first()
    )
    return _to_response(e)


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    db.delete(e)
    db.commit()
