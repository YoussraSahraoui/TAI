from fastapi import APIRouter, HTTPException

from models.schemas import AnalyticsResponse
from services.analytics_service import (
    get_advisory,
    get_bottlenecks,
    get_fitness_curve,
    get_utilization,
)
from services.job_manager import job_manager

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/{job_id}", response_model=AnalyticsResponse)
def get_analytics(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    return AnalyticsResponse(
        job_id=job_id,
        fitness_curve=get_fitness_curve(job),
        top_violations=get_bottlenecks(job),
        resource_utilization=get_utilization(job),
        advisory=get_advisory(job),
    )
