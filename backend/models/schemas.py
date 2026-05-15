from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Teacher
# ---------------------------------------------------------------------------
class TeacherCreate(BaseModel):
    name: str

class TeacherResponse(TeacherCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Room
# ---------------------------------------------------------------------------
class RoomCreate(BaseModel):
    name: str
    capacity: int = Field(ge=1)
    room_type: str
    coord_x: float = 0.0
    coord_y: float = 0.0
    coord_z: float = 0.0

class RoomResponse(RoomCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------
class SubjectCreate(BaseModel):
    name: str
    event_type: str

class SubjectResponse(SubjectCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# StudentGroup
# ---------------------------------------------------------------------------
class StudentGroupCreate(BaseModel):
    name: str
    size: int = Field(ge=1)

class StudentGroupResponse(StudentGroupCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Event
# ---------------------------------------------------------------------------
class EventCreate(BaseModel):
    subject_id: int
    teacher_id: int
    student_group_id: int

class EventResponse(EventCreate):
    id: int
    subject_name: str | None = None
    teacher_name: str | None = None
    group_name: str | None = None
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Timeslot
# ---------------------------------------------------------------------------
class TimeslotCreate(BaseModel):
    label: str
    day: str
    start_time: str
    slot_duration_minutes: int = 60

class TimeslotResponse(TimeslotCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------
class ConstraintUpdate(BaseModel):
    """Notebook-aligned weights. Raw floats, no normalisation."""
    enforce_capacity: bool = True
    enforce_type_match: bool = True
    enforce_no_double_booking: bool = True
    alpha:   float = Field(default=1.0, ge=0.0, le=10.0)   # Cdist
    beta:    float = Field(default=0.5, ge=0.0, le=10.0)   # Cwaste
    gamma:   float = Field(default=0.5, ge=0.0, le=10.0)   # Cchange_teacher
    delta:   float = Field(default=1.0, ge=0.0, le=10.0)   # Cworking_days
    epsilon: float = Field(default=2.0, ge=0.0, le=10.0)   # Clunch_break

class ConstraintResponse(ConstraintUpdate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Solver
# ---------------------------------------------------------------------------
class SolverParams(BaseModel):
    """Notebook defaults: T_max=800, T_min=0.01, α=0.995, max_iter=15000."""
    algorithm: Literal["sa", "hc"] = "sa"
    initial_temp: float = Field(default=800.0, gt=0)
    cooling_rate: float = Field(default=0.995, gt=0, lt=1)
    max_iterations: int = Field(default=15000, ge=1)

class SolveRequest(BaseModel):
    """Soft-cost weights are sourced from ConstraintConfig in the DB; the
    request only carries solver hyper-parameters."""
    solver_params: SolverParams = Field(default_factory=SolverParams)

class SolveResponse(BaseModel):
    job_id: str
    status: str
    sa_job_id: str | None = None
    hc_job_id: str | None = None

class AssignmentPoint(BaseModel):
    event_idx: int
    room_idx: int
    timeslot_idx: int
    x: float
    y: float
    z: float
    event_label: str
    room_label: str
    timeslot_label: str

class StateResponse(BaseModel):
    job_id: str
    algorithm: str = "sa"
    status: str
    iteration: int
    fitness: float
    best_fitness: float
    assignments: list[AssignmentPoint]
    fitness_history: list[float]            # running best per iter
    current_history: list[float] = []       # current-cost per iter
    created_at: float | None = None
    started_at: float | None = None
    finished_at: float | None = None
    timestamp: float

class JobSummary(BaseModel):
    job_id: str
    run_id: str = ""
    algorithm: str = "sa"
    status: str
    iteration: int
    best_fitness: float
    created_at: float | None = None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class FitnessCurvePoint(BaseModel):
    iteration: int
    fitness: float

class ConstraintViolation(BaseModel):
    constraint_type: str
    entity: str
    severity: float
    description: str

class AnalyticsResponse(BaseModel):
    job_id: str
    fitness_curve: list[FitnessCurvePoint]
    top_violations: list[ConstraintViolation]
    resource_utilization: dict[str, float]
    advisory: list[str]


# ---------------------------------------------------------------------------
# ITC2007 entities (Course / Curriculum / ScheduleConfig / Unavailability)
# ---------------------------------------------------------------------------
class CourseCreate(BaseModel):
    code: str
    teacher_id: int
    type: str = "lecture"
    students: int = Field(ge=1)
    lectures_per_week: int = Field(default=1, ge=1)
    min_working_days: int = Field(default=1, ge=1)

class CourseResponse(BaseModel):
    id: int
    code: str
    teacher_id: int
    type: str
    students: int
    lectures_per_week: int
    min_working_days: int
    teacher_name: str | None = None
    curriculum_ids: list[int] = []
    model_config = ConfigDict(from_attributes=True)


class CurriculumCreate(BaseModel):
    name: str
    course_ids: list[int] = []

class CurriculumResponse(BaseModel):
    id: int
    name: str
    course_ids: list[int]
    model_config = ConfigDict(from_attributes=True)


class ScheduleConfigUpdate(BaseModel):
    days: int = Field(default=5, ge=1, le=7)
    periods_per_day: int = Field(default=6, ge=1, le=12)
    start_hour: int = Field(default=8, ge=0, le=23)
    slot_duration_minutes: int = Field(default=60, ge=15, le=240)

class ScheduleConfigResponse(ScheduleConfigUpdate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class UnavailabilityCreate(BaseModel):
    course_id: int
    period: int = Field(ge=0)

class UnavailabilityResponse(BaseModel):
    id: int
    course_id: int
    period: int
    course_code: str | None = None
    model_config = ConfigDict(from_attributes=True)


class UploadSummary(BaseModel):
    format: str
    n_courses: int
    n_lectures: int
    n_rooms: int
    n_teachers: int
    n_curricula: int
    n_unavailabilities: int
    days: int
    periods_per_day: int
    use_distance: bool
