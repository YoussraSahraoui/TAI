from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.entities import Course, Curriculum, Teacher
from backend.models.schemas import CourseCreate, CourseResponse

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _to_response(c: Course) -> dict:
    return {
        "id": c.id,
        "code": c.code,
        "teacher_id": c.teacher_id,
        "type": c.type,
        "students": c.students,
        "lectures_per_week": c.lectures_per_week,
        "min_working_days": c.min_working_days,
        "teacher_name": c.teacher.name if c.teacher else None,
        "curriculum_ids": [cu.id for cu in c.curricula],
    }


@router.get("", response_model=list[CourseResponse])
def list_courses(db: Session = Depends(get_db)):
    return [_to_response(c) for c in db.query(Course).all()]


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: int, db: Session = Depends(get_db)):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    return _to_response(c)


@router.post("", response_model=CourseResponse, status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db)):
    if not db.get(Teacher, body.teacher_id):
        raise HTTPException(400, f"Teacher {body.teacher_id} does not exist")
    c = Course(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_response(c)


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(course_id: int, body: CourseCreate, db: Session = Depends(get_db)):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    if not db.get(Teacher, body.teacher_id):
        raise HTTPException(400, f"Teacher {body.teacher_id} does not exist")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _to_response(c)


@router.delete("/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    db.delete(c)
    db.commit()
