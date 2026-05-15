from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.models.database import Base, engine
from backend.routers import (
    analytics,
    constraints,
    courses,
    curricula,
    events,
    rooms,
    schedule_config,
    solver,
    student_groups,
    subjects,
    teachers,
    timeslots,
    unavailability,
    upload,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Timetabling AI",
    version="0.1.0",
    description="AI-driven university timetabling optimizer API",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(teachers.router)
app.include_router(rooms.router)
app.include_router(subjects.router)
app.include_router(student_groups.router)
app.include_router(events.router)
app.include_router(timeslots.router)
app.include_router(constraints.router)
app.include_router(solver.router)
app.include_router(analytics.router)
app.include_router(courses.router)
app.include_router(curricula.router)
app.include_router(schedule_config.router)
app.include_router(unavailability.router)
app.include_router(upload.router)
