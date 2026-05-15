"""CSP solver tests — verify backtracking yields a feasible state on both fixtures."""

from __future__ import annotations

import random
from pathlib import Path

import pytest

from backend.parser import parse_custom, parse_itc2007
from src.algorithms.csp import csp_or_random, csp_solve
from src.core.problem import CourseRoomAllocationProblem


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _seed():
    random.seed(0)


def _to_problem(ds, use_distance: bool = False) -> CourseRoomAllocationProblem:
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
        use_distance=use_distance,
    )


def _assert_state_feasible(problem: CourseRoomAllocationProblem, state: dict) -> None:
    """Replay assignments through _is_valid_assignment to confirm full H1–H6."""
    assert len(state) == problem.n_lectures, "every lecture must be assigned"
    occupied: dict = {}
    cur_periods: dict = {}
    teacher_periods: dict = {}
    for li, (ri, pi) in state.items():
        assert problem._is_valid_assignment(
            li, ri, pi, occupied, cur_periods, teacher_periods
        ), f"lecture {li}=({ri},{pi}) violates a hard constraint"
        problem._register(li, ri, pi, occupied, cur_periods, teacher_periods)


def test_csp_solves_itc2007_fixture():
    ds = parse_itc2007((FIXTURES / "sample_itc2007.ctt").read_text())
    prob = _to_problem(ds)
    state = csp_solve(prob, max_steps=20_000)
    assert state is not None
    _assert_state_feasible(prob, state)


def test_csp_solves_custom_fixture():
    ds = parse_custom((FIXTURES / "sample_custom.txt").read_text())
    prob = _to_problem(ds, use_distance=ds.use_distance)
    state = csp_solve(prob, max_steps=20_000)
    assert state is not None
    _assert_state_feasible(prob, state)


def test_csp_or_random_returns_csp_for_easy_instance():
    ds = parse_itc2007((FIXTURES / "sample_itc2007.ctt").read_text())
    prob = _to_problem(ds)
    state, source = csp_or_random(prob, max_steps=20_000)
    assert source == "csp"
    _assert_state_feasible(prob, state)


def test_csp_or_random_falls_back_when_step_budget_zero():
    """A budget of 0 forces the search to abort, exercising the random fallback."""
    ds = parse_custom((FIXTURES / "sample_custom.txt").read_text())
    prob = _to_problem(ds, use_distance=ds.use_distance)
    state, source = csp_or_random(prob, max_steps=0)
    assert source == "random_fallback"
    assert len(state) == prob.n_lectures
