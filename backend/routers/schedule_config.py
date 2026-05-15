from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import get_db
from models.entities import ScheduleConfig
from models.schemas import ScheduleConfigResponse, ScheduleConfigUpdate

router = APIRouter(prefix="/api/schedule-config", tags=["schedule-config"])


def _get_or_create(db: Session) -> ScheduleConfig:
    cfg = db.query(ScheduleConfig).first()
    if not cfg:
        cfg = ScheduleConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("", response_model=ScheduleConfigResponse)
def get_schedule_config(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("", response_model=ScheduleConfigResponse)
def update_schedule_config(body: ScheduleConfigUpdate, db: Session = Depends(get_db)):
    cfg = _get_or_create(db)
    for k, v in body.model_dump().items():
        setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return cfg
