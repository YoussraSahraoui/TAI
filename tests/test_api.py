"""End-to-end API smoke test: upload → CRUD list → CSP solve → fetch results.

Uses an isolated SQLite DB via DATABASE_URL monkeypatch + importlib.reload,
mirroring the pattern in test_parsers.py::test_persistence_writes_all_tables.
"""

from __future__ import annotations

import importlib
import random
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _seed():
    random.seed(0)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/test.db")
    # Reload the chain so the new env var sticks.
    import backend.config
    import backend.models.database
    import backend.models.entities
    import backend.parser.persistence
    import backend.services.problem_builder
    import backend.routers.upload
    import backend.routers.solver
    import backend.main

    for mod in (
        backend.config,
        backend.models.database,
        backend.models.entities,
        backend.parser.persistence,
        backend.services.problem_builder,
        backend.routers.upload,
        backend.routers.solver,
        backend.main,
    ):
        importlib.reload(mod)

    from backend.models.database import Base, engine
    Base.metadata.create_all(bind=engine)

    # Reset the in-memory results cache between tests.
    from backend.services import results_cache
    results_cache.clear()

    from fastapi.testclient import TestClient
    return TestClient(backend.main.app)


def test_full_pipeline_itc2007(client):
    upload_payload = (FIXTURES / "sample_itc2007.ctt").read_bytes()
    r = client.post(
        "/api/upload",
        data={"format": "itc2007"},
        files={"file": ("sample.ctt", upload_payload, "text/plain")},
    )
    assert r.status_code == 200, r.text
    summary = r.json()
    assert summary["n_courses"] == 3
    assert summary["n_rooms"] == 2

    # CRUD listing
    rooms = client.get("/api/rooms").json()
    teachers = client.get("/api/teachers").json()
    courses = client.get("/api/courses").json()
    curricula = client.get("/api/curricula").json()
    assert len(rooms) == 2
    assert len(teachers) >= 2
    assert len(courses) == 3
    assert len(curricula) == 2

    # CSP solve
    r = client.post("/api/solve/csp")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] in {"csp", "random_fallback"}
    assert body["n_lectures"] >= 3

    # Fetch results
    r = client.get("/api/results")
    assert r.status_code == 200
    res = r.json()
    assert len(res["assignments"]) == body["n_lectures"]
    assert all("course_code" in a for a in res["assignments"])


def test_constraints_and_schedule_config_singletons(client):
    r = client.get("/api/constraints")
    assert r.status_code == 200
    cfg = r.json()
    assert cfg["alpha"] == 1.0

    r = client.put("/api/constraints", json={"alpha": 2.0, "beta": 1.0, "gamma": 0.25, "delta": 0.5})
    assert r.status_code == 200
    assert r.json()["alpha"] == 2.0

    r = client.get("/api/schedule-config")
    assert r.status_code == 200
    assert r.json()["days"] == 5

    r = client.put("/api/schedule-config", json={"days": 6, "periods_per_day": 5})
    assert r.status_code == 200
    assert r.json()["days"] == 6


def test_results_404_when_no_solver_run(client):
    r = client.get("/api/results")
    assert r.status_code == 404


def test_pdf_export_after_csp(client):
    r = client.post(
        "/api/upload",
        data={"format": "itc2007"},
        files={"file": ("sample.ctt", (FIXTURES / "sample_itc2007.ctt").read_bytes(), "text/plain")},
    )
    assert r.status_code == 200
    assert client.post("/api/solve/csp").status_code == 200
    r = client.get("/api/export/pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"
    assert len(r.content) > 1000


def test_pdf_export_404_when_no_result(client):
    r = client.get("/api/export/pdf")
    assert r.status_code == 404
