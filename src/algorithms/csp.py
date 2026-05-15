"""
Custom backtracking CSP solver — generates an initial feasible assignment.

Variables  : lecture indices 0..n_lectures-1
Domains    : (room_idx, period_idx) tuples valid for H1 (type),
             H2 (capacity), H6 (unavailability) — pre-filtered statically.
Constraints: H3 (no double-booking), H4 (no curriculum conflict),
             H5 (no teacher conflict) — checked via Problem._is_valid_assignment
             (single source of truth, matches notebook).

Strategies:
    * MRV (minimum remaining values) for variable ordering.
    * Forward checking after each assignment, with degree-tie-breaking on |dom|.
    * Step budget to bound runtime; on exhaustion the caller can fall back to
      Problem._generate_random_state.
"""

from __future__ import annotations

from typing import Optional

from src.core.problem import CourseRoomAllocationProblem


State = dict[int, tuple[int, int]]


def csp_solve(
    problem: CourseRoomAllocationProblem,
    max_steps: int = 200_000,
) -> Optional[State]:
    """Try to find a feasible state via backtracking with MRV + forward checking.

    Returns the state dict, or ``None`` if the search exhausted ``max_steps``
    or no solution exists. Callers (e.g. solver_service) should fall back to
    ``problem._generate_random_state()`` on None.
    """
    # ── Static domain pre-filter (H1, H2, H6) ────────────────────────────────
    initial_domains: list[list[tuple[int, int]]] = []
    for li in range(problem.n_lectures):
        lec = problem.lectures[li]
        target_room_type = problem.TYPE_MAP[lec["type"]]
        forbidden_periods = problem.unavailability.get(lec["course"], set())
        domain: list[tuple[int, int]] = []
        for ri, room in enumerate(problem.rooms):
            if room["type"] != target_room_type:
                continue
            if room["cap"] < lec["students"]:
                continue
            for pi in range(problem.n_periods):
                if pi in forbidden_periods:
                    continue
                domain.append((ri, pi))
        if not domain:
            # No (room, period) satisfies H1/H2/H6 → infeasible.
            return None
        initial_domains.append(domain)

    state: State = {}
    occupied: dict[tuple[int, int], int] = {}
    curriculum_periods: dict[tuple[str, int], int] = {}
    teacher_periods: dict[tuple[str, int], int] = {}

    steps = [0]  # mutable counter for closure

    def backtrack(domains: list[list[tuple[int, int]]]) -> Optional[State]:
        if len(state) == problem.n_lectures:
            return dict(state)

        steps[0] += 1
        if steps[0] > max_steps:
            return None

        # ── MRV: pick unassigned var with smallest current domain ────────────
        unassigned = [li for li in range(problem.n_lectures) if li not in state]
        li = min(unassigned, key=lambda x: len(domains[x]))

        for ri, pi in domains[li]:
            if not problem._is_valid_assignment(
                li, ri, pi, occupied, curriculum_periods, teacher_periods
            ):
                continue

            # Assign
            state[li] = (ri, pi)
            problem._register(li, ri, pi, occupied, curriculum_periods, teacher_periods)

            # ── Forward checking ────────────────────────────────────────────
            new_domains = list(domains)
            ok = True
            for lk in unassigned:
                if lk == li:
                    continue
                pruned = [
                    (rk, pk)
                    for (rk, pk) in domains[lk]
                    if problem._is_valid_assignment(
                        lk, rk, pk,
                        occupied, curriculum_periods, teacher_periods,
                    )
                ]
                if not pruned:
                    ok = False
                    break
                new_domains[lk] = pruned

            if ok:
                result = backtrack(new_domains)
                if result is not None:
                    return result

            # Undo
            del state[li]
            problem._unregister(li, ri, pi, occupied, curriculum_periods, teacher_periods)

        return None

    return backtrack(initial_domains)


def csp_or_random(
    problem: CourseRoomAllocationProblem,
    max_steps: int = 200_000,
) -> tuple[State, str]:
    """Try CSP; on failure fall back to the notebook's random state generator.

    Returns ``(state, source)`` where source ∈ {"csp", "random_fallback"}.
    """
    state = csp_solve(problem, max_steps=max_steps)
    if state is not None:
        return state, "csp"
    return problem._generate_random_state(), "random_fallback"
