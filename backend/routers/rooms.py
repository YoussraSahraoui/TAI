from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.entities import Room
from models.schemas import RoomCreate, RoomResponse

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomResponse])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(room_id: int, db: Session = Depends(get_db)):
    r = db.get(Room, room_id)
    if not r:
        raise HTTPException(404, "Room not found")
    return r


@router.post("", response_model=RoomResponse, status_code=201)
def create_room(body: RoomCreate, db: Session = Depends(get_db)):
    r = Room(**body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/{room_id}", response_model=RoomResponse)
def update_room(room_id: int, body: RoomCreate, db: Session = Depends(get_db)):
    r = db.get(Room, room_id)
    if not r:
        raise HTTPException(404, "Room not found")
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    r = db.get(Room, room_id)
    if not r:
        raise HTTPException(404, "Room not found")
    db.delete(r)
    db.commit()
