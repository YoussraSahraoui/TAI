"""Hill climbing for CourseRoomAllocationProblem.

Two flavours:
    * `hill_climbing(problem, initial_state)` — steepest-ascent climb until no
      strictly-improving neighbour exists; returns (state, cost, history).
    * `hill_climbing_with_restarts(problem, n_restarts)` — random-restart wrapper
      that calls `_generate_random_state()` each round and keeps the best.

History returned by the inner climb is a per-iteration *best* cost so it can be
fed directly into the same fitness chart used by simulated annealing.
"""

from __future__ import annotations

from src.core.problem import CourseRoomAllocationProblem


def hill_climbing(
    problem: CourseRoomAllocationProblem,
    initial_state: dict,
    max_iter: int = 1000,
):
    current_state = dict(initial_state)
    current_cost = problem.evaluate(current_state)
    history = [current_cost]

    for _ in range(max_iter):
        neighbors = problem.generate_neighbors(current_state)
        if not neighbors:
            break

        best_neighbor = min(neighbors, key=problem.evaluate)
        best_cost = problem.evaluate(best_neighbor)

        if best_cost < current_cost:
            current_state = best_neighbor
            current_cost = best_cost
            history.append(current_cost)
        else:
            break

    return current_state, current_cost, history


def hill_climbing_with_restarts(
    problem: CourseRoomAllocationProblem,
    n_restarts: int = 10,
    max_iter_per_restart: int = 1000,
):
    best_state = None
    best_cost = float("inf")
    aggregated_history: list[float] = []

    for _ in range(n_restarts):
        initial_state = problem._generate_random_state()
        state, cost, history = hill_climbing(
            problem, initial_state, max_iter=max_iter_per_restart
        )
        aggregated_history.extend(history)
        if cost < best_cost:
            best_state = state
            best_cost = cost

    return best_state, best_cost, aggregated_history
