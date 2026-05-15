"""In-memory cache for the latest solver result.

The cache holds the last successful state and the Problem instance used to
produce it, so that GET /api/results and PDF export can format the assignment
without re-running the solver. Process-local; resets on restart.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from src.core.problem import CourseRoomAllocationProblem


State = dict[int, tuple[int, int]]


@dataclass
class CachedResult:
    problem: CourseRoomAllocationProblem
    state: State
    cost: float
    source: str  # "csp", "sa", "hc"


_cache: Optional[CachedResult] = None


def set_result(result: CachedResult) -> None:
    global _cache
    _cache = result


def get_result() -> Optional[CachedResult]:
    return _cache


def clear() -> None:
    global _cache
    _cache = None
