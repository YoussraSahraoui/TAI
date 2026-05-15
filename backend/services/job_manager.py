"""Background solver execution + in-memory job registry.

A `SolverJob` snapshot is updated in-place from a worker thread; the HTTP
state endpoint reads the latest values out of it. The state representation
is the ITC2007 dict {lecture_idx: (room_idx, period_idx)}. Lectures and
events are 1:1 in the legacy bridge, so callers can use the same index for
both.
"""

from __future__ import annotations

import math
import random
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class SolverJob:
    job_id: str
    run_id: str = ""
    algorithm: Literal["sa", "hc"] = "sa"
    status: Literal["pending", "processing", "completed", "failed"] = "pending"
    iteration: int = 0
    current_fitness: float = float("inf")
    best_fitness: float = float("inf")
    best_state: dict | None = None
    current_state: dict | None = None
    fitness_history: list[float] = field(default_factory=list)   # running best
    current_history: list[float] = field(default_factory=list)   # per-iter current
    state_centroids: list[tuple[float, float, float]] = field(default_factory=list)
    error: str | None = None
    rooms: list[dict] = field(default_factory=list)
    timeslots: list = field(default_factory=list)
    events: list[dict] = field(default_factory=list)
    period_meta: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    finished_at: float | None = None


class JobManager:
    def __init__(self):
        self._jobs: dict[str, SolverJob] = {}
        self._lock = threading.Lock()

    def create_job(self, algorithm: str = "sa", run_id: str = "") -> SolverJob:
        job_id = str(uuid.uuid4())
        job = SolverJob(job_id=job_id, run_id=run_id, algorithm=algorithm)  # type: ignore[arg-type]
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> SolverJob | None:
        return self._jobs.get(job_id)

    def list_jobs(self) -> list[SolverJob]:
        return sorted(self._jobs.values(), key=lambda j: j.created_at)

    # ── Simulated Annealing ──────────────────────────────────────────────────
    def run_solver_sa(self, job: SolverJob, problem, params) -> None:
        try:
            job.status = "processing"
            job.started_at = time.time()
            state = dict(problem.initial_state)
            cost = problem.evaluate(state)

            job.current_state = dict(state)
            job.best_state = dict(state)
            job.current_fitness = cost
            job.best_fitness = cost
            job.fitness_history.append(cost)
            job.current_history.append(cost)
            job.state_centroids.append(self._compute_centroid(state, job.rooms))

            temp = float(params.initial_temp)

            for i in range(int(params.max_iterations)):
                neighbor = problem.generate_random_neighbor(state)
                neighbor_cost = problem.evaluate(neighbor)
                delta = neighbor_cost - cost

                if delta < 0 or random.random() < math.exp(-delta / max(temp, 1e-10)):
                    state = neighbor
                    cost = neighbor_cost

                if cost < job.best_fitness:
                    job.best_fitness = cost
                    job.best_state = dict(state)

                job.current_state = dict(state)
                job.current_fitness = cost
                job.iteration = i + 1
                job.fitness_history.append(job.best_fitness)
                job.current_history.append(cost)

                if i % 10 == 0:
                    job.state_centroids.append(self._compute_centroid(state, job.rooms))

                temp *= float(params.cooling_rate)

            job.status = "completed"
            job.finished_at = time.time()
        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            job.finished_at = time.time()

    # ── Hill Climbing (sampled steepest ascent + CSP restarts) ───────────────
    def run_solver_hc(self, job: SolverJob, problem, params) -> None:
        """Sampled steepest-ascent hill climbing with CSP-seeded restarts.

        Same shape as the notebook's `hill_climbing_with_restarts(use_csp=True)`,
        but each inner step samples up to NEIGHBOR_CAP=64 random neighbours
        and accepts the best of that pool — instead of enumerating the full
        neighbourhood (~250k candidates on ENSIA-sized instances). This caps
        per-step cost to ~tens of milliseconds so HC's wall time stays
        comparable to SA's. The convergence behaviour (climb until no
        sampled neighbour improves → restart from a fresh CSP state) is
        unchanged.
        """
        try:
            from src.algorithms.csp import csp_or_random

            NEIGHBOR_CAP = 64

            job.status = "processing"
            job.started_at = time.time()

            state = dict(problem.initial_state)
            cost = problem.evaluate(state)
            job.best_state = dict(state)
            job.best_fitness = cost
            job.current_state = dict(state)
            job.current_fitness = cost
            job.fitness_history.append(cost)
            job.current_history.append(cost)
            job.state_centroids.append(self._compute_centroid(state, job.rooms))

            max_iter = int(params.max_iterations)
            total = 0
            restart = 0

            while total < max_iter:
                if restart > 0:
                    try:
                        seed, _src = csp_or_random(problem)
                    except Exception:
                        seed = problem._seed_initial_state()
                    state = seed
                    cost = problem.evaluate(state)

                # Inner sampled-steepest loop — stop when the best of N
                # random neighbours is no improvement (treated as local min).
                while total < max_iter:
                    best_neighbor = None
                    best_n_cost = float("inf")
                    for _ in range(NEIGHBOR_CAP):
                        n = problem.generate_random_neighbor(state)
                        nc = problem.evaluate(n)
                        if nc < best_n_cost:
                            best_n_cost = nc
                            best_neighbor = n

                    if best_neighbor is not None and best_n_cost < cost:
                        state = best_neighbor
                        cost = best_n_cost
                        total += 1
                        if cost < job.best_fitness:
                            job.best_fitness = cost
                            job.best_state = dict(state)
                        job.current_state = dict(state)
                        job.current_fitness = cost
                        job.iteration = total
                        job.fitness_history.append(job.best_fitness)
                        job.current_history.append(cost)
                        if total % 5 == 0:
                            job.state_centroids.append(
                                self._compute_centroid(state, job.rooms)
                            )
                    else:
                        # Sampled local minimum — break to outer restart loop.
                        break

                restart += 1

            job.status = "completed"
            job.finished_at = time.time()
        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            job.finished_at = time.time()

    @staticmethod
    def _compute_centroid(
        state: dict, rooms: list[dict]
    ) -> tuple[float, float, float]:
        if not state or not rooms:
            return (0.0, 0.0, 0.0)
        xs, ys, zs = [], [], []
        for _li, (ri, ti) in state.items():
            if 0 <= ri < len(rooms):
                xs.append(float(rooms[ri].get("coord_x", 0.0)))
                ys.append(float(rooms[ri].get("coord_y", 0.0)))
            zs.append(float(ti))
        n_xy = max(len(xs), 1)
        n_z = max(len(zs), 1)
        return (
            sum(xs) / n_xy if xs else 0.0,
            sum(ys) / n_xy if ys else 0.0,
            sum(zs) / n_z if zs else 0.0,
        )


job_manager = JobManager()
