"""Parser tests — round-trip into a valid CourseRoomAllocationProblem."""

from __future__ import annotations

import os
import random
from pathlib import Path

import pytest

from backend.parser import parse_custom, parse_itc2007
from src.core.problem import CourseRoomAllocationProblem


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _seed():
    random.seed(0)


def _to_problem(ds):
    rooms = [
        {
            "name": r["name"],
            "type": r["type"],
            "cap": r["cap"],
            **(
                {"coords": (r["coord_x"], r["coord_y"])}
                if r.get("coord_x") is not None and r.get("coord_y") is not None
                else {}
            ),
        }
        for r in ds.rooms
    ]
    courses = [
        {
            "course": c["code"],
            "teacher": c["teacher"],
            "type": c["type"],
            "students": c["students"],
            "lectures_per_week": c["lectures_per_week"],
            "min_working_days": c["min_working_days"],
        }
        for c in ds.courses
    ]
    curricula = {name: set(members) for name, members in ds.curricula.items()}
    return CourseRoomAllocationProblem(
        courses=courses,
        rooms=rooms,
        curricula=curricula,
        days=ds.days,
        periods_per_day=ds.periods_per_day,
        unavailability={k: set(v) for k, v in ds.unavailability.items()},
    )


def test_itc2007_parser_basic():
    text = (FIXTURES / "sample_itc2007.ctt").read_text()
    ds = parse_itc2007(text)

    assert ds.days == 5
    assert ds.periods_per_day == 4
    assert len(ds.courses) == 3
    assert len(ds.rooms) == 2
    assert ds.teachers == ["Ocra", "Indaco", "Rosa"]      # first-seen order
    assert all(c["type"] == "lecture" for c in ds.courses)
    assert all(r["type"] == "amphi" for r in ds.rooms)
    assert ds.use_distance is False                        # ITC2007 has no coords

    # Curricula
    assert ds.curricula == {
        "Cur01": ["SceCosC", "ArcTec"],
        "Cur02": ["ArcTec", "TecCos"],
    }

    # Unavailability resolution: (day=0, slot=0) → period 0
    #                            (day=4, slot=3) → period 4*4 + 3 = 19
    assert ds.unavailability == {"TecCos": {0, 19}}


def test_itc2007_parser_round_trip_to_problem():
    text = (FIXTURES / "sample_itc2007.ctt").read_text()
    ds = parse_itc2007(text)
    p = _to_problem(ds)

    # 3 + 2 + 2 = 7 lectures
    assert p.n_lectures == 7
    assert p.n_periods == 20
    assert p.use_distance is False

    # Initial state respects all 6 constraints (constructor would have raised otherwise)
    cost = p.evaluate(p.initial_state)
    assert cost >= 0

    # H6: TecCos lectures avoid forbidden periods
    tc_lectures = [i for i, lec in enumerate(p.lectures) if lec["course"] == "TecCos"]
    for li in tc_lectures:
        assert p.initial_state[li][1] not in {0, 19}


def test_custom_parser_basic():
    text = (FIXTURES / "sample_custom.txt").read_text()
    ds = parse_custom(text)

    assert ds.days == 5
    assert ds.periods_per_day == 4
    assert len(ds.courses) == 4
    assert len(ds.rooms) == 4

    # Type translation
    types = {c["code"]: c["type"] for c in ds.courses}
    assert types == {"Algo": "lecture", "Stats": "lecture",
                     "AlgoTD": "tuto", "DBLab": "lab"}
    rtypes = {r["name"]: r["type"] for r in ds.rooms}
    assert rtypes == {"A1": "amphi", "A2": "amphi", "TD1": "tuto", "L1": "lab"}

    # Coords parsed → use_distance True
    assert ds.use_distance is True
    a1 = next(r for r in ds.rooms if r["name"] == "A1")
    assert (a1["coord_x"], a1["coord_y"]) == (0.0, 0.0)

    # Unavailability: (0,0) → 0; (0,1) → 1
    assert ds.unavailability == {"Algo": {0, 1}}


def test_custom_parser_round_trip_to_problem():
    text = (FIXTURES / "sample_custom.txt").read_text()
    ds = parse_custom(text)
    p = _to_problem(ds)

    # Lectures: 2+2+1+1 = 6
    assert p.n_lectures == 6
    assert p.use_distance is True

    cost = p.evaluate(p.initial_state)
    assert cost >= 0

    # H6: Algo lectures never at periods 0 or 1
    algo = [i for i, lec in enumerate(p.lectures) if lec["course"] == "Algo"]
    for li in algo:
        assert p.initial_state[li][1] not in {0, 1}


def test_itc2007_rejects_bad_curriculum_count():
    bad = """Name: x
Courses: 1
Rooms: 1
Days: 1
Periods_per_day: 1
Curricula: 1
Constraints: 0

COURSES:
A T 1 1 10

ROOMS:
R 30

CURRICULA:
Cur01 5 A
"""
    with pytest.raises(ValueError, match="declared 5 courses but listed 1"):
        parse_itc2007(bad)


def test_custom_rejects_bad_type():
    bad = """Days: 1
Periods_per_day: 1

COURSES:
A T 1 1 10 9
"""
    with pytest.raises(ValueError, match="course type must be 0/1/2"):
        parse_custom(bad)


def test_persistence_writes_all_tables(tmp_path, monkeypatch):
    """End-to-end: parse → wipe_and_persist → query DB."""
    # Use a temp DB so we don't clobber the dev database.
    db_url = f"sqlite:///{tmp_path / 'test.db'}"
    monkeypatch.setenv("DATABASE_URL", db_url)

    # Re-import to pick up env var.
    import importlib
    import backend.config
    importlib.reload(backend.config)
    import backend.models.database
    importlib.reload(backend.models.database)
    import backend.models.entities
    importlib.reload(backend.models.entities)
    import backend.parser.persistence
    importlib.reload(backend.parser.persistence)

    from backend.models.database import Base, SessionLocal, engine
    from backend.models.entities import (
        Course,
        Curriculum,
        Room,
        ScheduleConfig,
        Teacher,
        Unavailability,
    )
    from backend.parser.persistence import wipe_and_persist

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ds = parse_custom((FIXTURES / "sample_custom.txt").read_text())
        wipe_and_persist(db, ds)

        assert db.query(Teacher).count() == 3       # T1, T2, T3
        assert db.query(Room).count() == 4
        assert db.query(Course).count() == 4
        assert db.query(Curriculum).count() == 1
        assert db.query(Unavailability).count() == 2
        cfg = db.query(ScheduleConfig).first()
        assert cfg is not None
        assert (cfg.days, cfg.periods_per_day) == (5, 4)

        # Re-upload should wipe-and-replace, not duplicate.
        wipe_and_persist(db, ds)
        assert db.query(Teacher).count() == 3
        assert db.query(Course).count() == 4
    finally:
        db.close()
