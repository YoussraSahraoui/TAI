"""Smoke tests for SA and HC: final cost must not exceed the CSP seed cost."""

from __future__ import annotations

import random
from pathlib import Path

import pytest

from backend.parser import parse_custom
from src.algorithms.csp import csp_solve
from src.algorithms.hill_climbing import hill_climbing
from src.algorithms.simulated_annealing import simulated_annealing
from src.core.problem import CourseRoomAllocationProblem


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _seed():
    random.seed(0)


@pytest.fixture
def problem_and_seed() -> tuple[CourseRoomAllocationProblem, dict]:
    ds = parse_custom((FIXTURES / "sample_custom.txt").read_text())
    rooms = [
        {
            "name": r["name"], "type": r["type"], "cap": r["cap"],
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
            "course": c["code"], "teacher": c["teacher"], "type": c["type"],
            "students": c["students"],
            "lectures_per_week": c["lectures_per_week"],
            "min_working_days": c["min_working_days"],
        }
        for c in ds.courses
    ]
    prob = CourseRoomAllocationProblem(
        courses=courses, rooms=rooms,
        curricula={n: set(m) for n, m in ds.curricula.items()},
        days=ds.days, periods_per_day=ds.periods_per_day,
        unavailability={k: set(v) for k, v in ds.unavailability.items()},
        use_distance=ds.use_distance,
    )
    seed = csp_solve(prob, max_steps=20_000)
    assert seed is not None
    return prob, seed


def test_sa_does_not_increase_cost(problem_and_seed):
    prob, seed = problem_and_seed
    seed_cost = prob.evaluate(seed)
    _, best_cost, history = simulated_annealing(
        prob, seed, max_iters=500, t_initial=10.0, alpha=0.99,
    )
    assert best_cost <= seed_cost
    assert len(history) <= 500


def test_sa_callback_invoked(problem_and_seed):
    prob, seed = problem_and_seed
    calls: list[tuple[int, float, float]] = []
    simulated_annealing(
        prob, seed, max_iters=20, t_initial=5.0, alpha=0.99,
        callback=lambda i, c, b: calls.append((i, c, b)),
    )
    assert len(calls) == 20
    assert calls[0][0] == 0


def test_hc_does_not_increase_cost(problem_and_seed):
    prob, seed = problem_and_seed
    seed_cost = prob.evaluate(seed)
    _, best_cost, restart_costs = hill_climbing(
        prob, seed, n_restarts=3, n_perturbations=2, max_steps_per_restart=20,
    )
    assert best_cost <= seed_cost
    assert len(restart_costs) == 3


def test_hc_callback_invoked(problem_and_seed):
    prob, seed = problem_and_seed
    calls: list[tuple[int, float]] = []
    hill_climbing(
        prob, seed, n_restarts=4, n_perturbations=1, max_steps_per_restart=10,
        callback=lambda r, c: calls.append((r, c)),
    )
    assert [c[0] for c in calls] == [0, 1, 2, 3]
