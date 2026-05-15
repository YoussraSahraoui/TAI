from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.entities import Subject
from models.schemas import SubjectCreate, SubjectResponse

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectResponse])
def list_subjects(db: Session = Depends(get_db)):
    return db.query(Subject).all()


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    s = db.get(Subject, subject_id)
    if not s:
        raise HTTPException(404, "Subject not found")
    return s


@router.post("", response_model=SubjectResponse, status_code=201)
def create_subject(body: SubjectCreate, db: Session = Depends(get_db)):
    s = Subject(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(subject_id: int, body: SubjectCreate, db: Session = Depends(get_db)):
    s = db.get(Subject, subject_id)
    if not s:
        raise HTTPException(404, "Subject not found")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{subject_id}", status_code=204)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    s = db.get(Subject, subject_id)
    if not s:
        raise HTTPException(404, "Subject not found")
    db.delete(s)
    db.commit()
