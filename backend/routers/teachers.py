from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.entities import Teacher
from models.schemas import TeacherCreate, TeacherResponse

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


@router.get("", response_model=list[TeacherResponse])
def list_teachers(db: Session = Depends(get_db)):
    return db.query(Teacher).all()


@router.get("/{teacher_id}", response_model=TeacherResponse)
def get_teacher(teacher_id: int, db: Session = Depends(get_db)):
    t = db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(404, "Teacher not found")
    return t


@router.post("", response_model=TeacherResponse, status_code=201)
def create_teacher(body: TeacherCreate, db: Session = Depends(get_db)):
    t = Teacher(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/{teacher_id}", response_model=TeacherResponse)
def update_teacher(teacher_id: int, body: TeacherCreate, db: Session = Depends(get_db)):
    t = db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(404, "Teacher not found")
    for k, v in body.model_dump().items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{teacher_id}", status_code=204)
def delete_teacher(teacher_id: int, db: Session = Depends(get_db)):
    t = db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(404, "Teacher not found")
    db.delete(t)
    db.commit()
