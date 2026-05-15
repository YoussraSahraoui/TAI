from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.entities import ConstraintConfig
from backend.models.schemas import ConstraintResponse, ConstraintUpdate

router = APIRouter(prefix="/api/constraints", tags=["constraints"])


def _get_or_create(db: Session) -> ConstraintConfig:
    cfg = db.query(ConstraintConfig).first()
    if not cfg:
        cfg = ConstraintConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("", response_model=ConstraintResponse)
def get_constraints(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("", response_model=ConstraintResponse)
def update_constraints(body: ConstraintUpdate, db: Session = Depends(get_db)):
    cfg = _get_or_create(db)
    for k, v in body.model_dump().items():
        setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return cfg
