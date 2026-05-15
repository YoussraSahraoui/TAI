from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.entities import StudentGroup
from backend.models.schemas import StudentGroupCreate, StudentGroupResponse

router = APIRouter(prefix="/api/student-groups", tags=["student-groups"])


@router.get("", response_model=list[StudentGroupResponse])
def list_groups(db: Session = Depends(get_db)):
    return db.query(StudentGroup).all()


@router.get("/{group_id}", response_model=StudentGroupResponse)
def get_group(group_id: int, db: Session = Depends(get_db)):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Student group not found")
    return g


@router.post("", response_model=StudentGroupResponse, status_code=201)
def create_group(body: StudentGroupCreate, db: Session = Depends(get_db)):
    g = StudentGroup(**body.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.put("/{group_id}", response_model=StudentGroupResponse)
def update_group(group_id: int, body: StudentGroupCreate, db: Session = Depends(get_db)):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Student group not found")
    for k, v in body.model_dump().items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Student group not found")
    db.delete(g)
    db.commit()
