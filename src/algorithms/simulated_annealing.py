import math
import random


def simulated_annealing(problem,
                        T_max=800.0, T_min=0.01, alpha=0.995,
                        max_iter=15000):
    """
    Simulated Annealing for CourseRoomAllocationProblem.

    Parameters
    ----------
    problem   : CourseRoomAllocationProblem instance
                Provides:
                    _ problem.initial_state          → starting assignment
                    _ problem.generate_random_neighbor(state) → one neighbor
                    _ problem.evaluate(state)         → scalar cost (lower=better)

    T_max     : float  _ starting temperature (high = accepts bad moves freely)
    T_min     : float  _ minimum temperature clamp (avoids division by zero)
    alpha     : float  _ cooling rate per iteration (e.g. 0.995 means slow cool)
    max_iter  : int    _ total number of iterations

    State format (from CourseRoomAllocationProblem)
    -----------------------------------------------
    dict  lecture_idx (int) → (room_idx int, period_idx int)

    Returns
    -------
    best_state   : dict  _ best assignment found
    cost_history : list  _ best cost recorded at each iteration
    """

    # ── Initialise from the problem's pre-built valid state ──────────────────
    current      = dict(problem.initial_state)
    best         = dict(current)
    T            = T_max
    current_cost = problem.evaluate(current)
    best_cost    = current_cost
    cost_history = [best_cost]

    # ── Main SA loop ─────────────────────────────────────────────────────────
    for _ in range(max_iter):

        # 1. Generate one random valid neighbor (uses RA / RS / TS operators)
        neighbor = problem.generate_random_neighbor(current)
        new_cost = problem.evaluate(neighbor)

        delta = new_cost - current_cost

        # 2. Accept / reject
        if delta < 0:
            # Always accept improvements
            current      = neighbor
            current_cost = new_cost
        else:
            # Accept worse solution with probability exp(-delta / T)
            if random.random() < math.exp(-delta / T):
                current      = neighbor
                current_cost = new_cost

        # 3. Track best solution found so far
        if current_cost < best_cost:
            best      = dict(current)
            best_cost = current_cost

        # 4. Cool the temperature
        T *= alpha
        if T < T_min:
            T = T_min   # clamp — prevents division by zero at low temperatures

        cost_history.append(best_cost)

    return best, best_cost, cost_history
