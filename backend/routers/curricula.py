from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.entities import Course, Curriculum
from backend.models.schemas import CurriculumCreate, CurriculumResponse

router = APIRouter(prefix="/api/curricula", tags=["curricula"])


def _to_response(cu: Curriculum) -> dict:
    return {
        "id": cu.id,
        "name": cu.name,
        "course_ids": [c.id for c in cu.courses],
    }


def _resolve_courses(db: Session, ids: list[int]) -> list[Course]:
    if not ids:
        return []
    courses = db.query(Course).filter(Course.id.in_(ids)).all()
    if len(courses) != len(set(ids)):
        missing = set(ids) - {c.id for c in courses}
        raise HTTPException(400, f"Course IDs not found: {sorted(missing)}")
    return courses


@router.get("", response_model=list[CurriculumResponse])
def list_curricula(db: Session = Depends(get_db)):
    return [_to_response(cu) for cu in db.query(Curriculum).all()]


@router.get("/{curriculum_id}", response_model=CurriculumResponse)
def get_curriculum(curriculum_id: int, db: Session = Depends(get_db)):
    cu = db.get(Curriculum, curriculum_id)
    if not cu:
        raise HTTPException(404, "Curriculum not found")
    return _to_response(cu)


@router.post("", response_model=CurriculumResponse, status_code=201)
def create_curriculum(body: CurriculumCreate, db: Session = Depends(get_db)):
    cu = Curriculum(name=body.name, courses=_resolve_courses(db, body.course_ids))
    db.add(cu)
    db.commit()
    db.refresh(cu)
    return _to_response(cu)


@router.put("/{curriculum_id}", response_model=CurriculumResponse)
def update_curriculum(curriculum_id: int, body: CurriculumCreate, db: Session = Depends(get_db)):
    cu = db.get(Curriculum, curriculum_id)
    if not cu:
        raise HTTPException(404, "Curriculum not found")
    cu.name = body.name
    cu.courses = _resolve_courses(db, body.course_ids)
    db.commit()
    db.refresh(cu)
    return _to_response(cu)


@router.delete("/{curriculum_id}", status_code=204)
def delete_curriculum(curriculum_id: int, db: Session = Depends(get_db)):
    cu = db.get(Curriculum, curriculum_id)
    if not cu:
        raise HTTPException(404, "Curriculum not found")
    db.delete(cu)
    db.commit()
