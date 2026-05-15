from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    events: Mapped[list["Event"]] = relationship(back_populates="teacher")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    capacity: Mapped[int] = mapped_column(Integer)
    room_type: Mapped[str] = mapped_column(String(50))
    coord_x: Mapped[float] = mapped_column(Float, default=0.0)
    coord_y: Mapped[float] = mapped_column(Float, default=0.0)
    coord_z: Mapped[float] = mapped_column(Float, default=0.0)


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    event_type: Mapped[str] = mapped_column(String(50))
    events: Mapped[list["Event"]] = relationship(back_populates="subject")


class StudentGroup(Base):
    __tablename__ = "student_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    size: Mapped[int] = mapped_column(Integer)
    events: Mapped[list["Event"]] = relationship(back_populates="student_group")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"))
    student_group_id: Mapped[int] = mapped_column(ForeignKey("student_groups.id"))

    subject: Mapped[Subject] = relationship(back_populates="events")
    teacher: Mapped[Teacher] = relationship(back_populates="events")
    student_group: Mapped[StudentGroup] = relationship(back_populates="events")


class TimeslotConfig(Base):
    __tablename__ = "timeslot_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(50))
    day: Mapped[str] = mapped_column(String(10))
    start_time: Mapped[str] = mapped_column(String(10))
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)


class ConstraintConfig(Base):
    __tablename__ = "constraint_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Hard constraints (boolean toggles — informational; enforced unconditionally
    # in CourseRoomAllocationProblem._is_valid_assignment).
    enforce_capacity: Mapped[bool] = mapped_column(Boolean, default=True)
    enforce_type_match: Mapped[bool] = mapped_column(Boolean, default=True)
    enforce_no_double_booking: Mapped[bool] = mapped_column(Boolean, default=True)
    # Soft-cost weights, named per the canonical notebook (raw floats — no
    # normalisation). Defaults reproduce the notebook's reference run.
    alpha:   Mapped[float] = mapped_column(Float, default=1.0)   # Cdist
    beta:    Mapped[float] = mapped_column(Float, default=0.5)   # Cwaste
    gamma:   Mapped[float] = mapped_column(Float, default=0.5)   # Cchange_teacher
    delta:   Mapped[float] = mapped_column(Float, default=1.0)   # Cworking_days
    epsilon: Mapped[float] = mapped_column(Float, default=2.0)   # Clunch_break


# ───────────────────────────────────────────────────────────────────────────
# ITC2007 entities — populated by /api/upload, used by the solver bridge when
# present. Run alongside the legacy entities above so existing CRUD pages
# keep working for manual entry.
# ───────────────────────────────────────────────────────────────────────────

curriculum_member = Table(
    "curriculum_member",
    Base.metadata,
    Column("curriculum_id", ForeignKey("curricula.id"), primary_key=True),
    Column("course_id", ForeignKey("courses.id"), primary_key=True),
)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(120), unique=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"))
    type: Mapped[str] = mapped_column(String(20), default="lecture")
    students: Mapped[int] = mapped_column(Integer)
    lectures_per_week: Mapped[int] = mapped_column(Integer, default=1)
    min_working_days: Mapped[int] = mapped_column(Integer, default=1)

    teacher: Mapped[Teacher] = relationship()
    curricula: Mapped[list["Curriculum"]] = relationship(
        secondary=curriculum_member, back_populates="courses"
    )


class Curriculum(Base):
    __tablename__ = "curricula"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)

    courses: Mapped[list[Course]] = relationship(
        secondary=curriculum_member, back_populates="curricula"
    )


class ScheduleConfig(Base):
    __tablename__ = "schedule_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    days: Mapped[int] = mapped_column(Integer, default=5)
    periods_per_day: Mapped[int] = mapped_column(Integer, default=6)
    start_hour: Mapped[int] = mapped_column(Integer, default=8)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)


class Unavailability(Base):
    __tablename__ = "unavailability"
    __table_args__ = (UniqueConstraint("course_id", "period", name="uq_course_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    period: Mapped[int] = mapped_column(Integer)

    course: Mapped[Course] = relationship()
