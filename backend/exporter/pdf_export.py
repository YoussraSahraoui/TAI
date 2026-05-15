"""PDF export of the latest solver result.

Produces a 3-section A4 document:
    1. Summary stats (cost, lectures, rooms, distance mode)
    2. Room × period grid
    3. Per-teacher schedules
"""

from __future__ import annotations

import io
from collections import defaultdict

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from services.results_cache import CachedResult


def render_pdf(cached: CachedResult) -> bytes:
    """Return a PDF document as bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Timetabling Result")
    styles = getSampleStyleSheet()
    story: list = []

    problem = cached.problem
    state = cached.state
    pp_day = problem.periods_per_day
    days = problem.days

    # ── Section 1: Summary ───────────────────────────────────────────────────
    wasted = sum(
        problem.rooms[ri]["cap"] - problem.lectures[li]["students"]
        for li, (ri, _) in state.items()
    )
    summary = [
        ["Source", cached.source.upper()],
        ["Cost", f"{cached.cost:.2f}"],
        ["Lectures", str(problem.n_lectures)],
        ["Rooms", str(problem.n_rooms)],
        ["Distance mode", "yes" if problem.use_distance else "no"],
        ["Days × periods", f"{days} × {pp_day}"],
        ["Total wasted seats", str(wasted)],
    ]
    story.append(Paragraph("Timetabling Result", styles["Title"]))
    story.append(Spacer(1, 12))
    t = Table(summary, colWidths=[180, 240])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ── Section 2: Room × period grid ────────────────────────────────────────
    story.append(Paragraph("Room schedule", styles["Heading2"]))
    grid: dict[tuple[int, int], str] = {}
    for li, (ri, pi) in state.items():
        lec = problem.lectures[li]
        grid[(ri, pi)] = f"{lec['course']}\n({lec['teacher']})"
    header = [""] + [
        f"D{p // pp_day + 1}P{p % pp_day + 1}" for p in range(problem.n_periods)
    ]
    rows = [header]
    for ri, room in enumerate(problem.rooms):
        row = [room["name"]] + [grid.get((ri, p), "") for p in range(problem.n_periods)]
        rows.append(row)
    grid_table = Table(rows, repeatRows=1)
    grid_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightblue),
        ("BACKGROUND", (0, 1), (0, -1), colors.lightgrey),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(grid_table)
    story.append(PageBreak())

    # ── Section 3: Per-teacher schedules ─────────────────────────────────────
    story.append(Paragraph("Per-teacher schedules", styles["Heading2"]))
    by_teacher: dict[str, list[tuple[int, str, str]]] = defaultdict(list)
    for li, (ri, pi) in state.items():
        lec = problem.lectures[li]
        by_teacher[lec["teacher"]].append((pi, lec["course"], problem.rooms[ri]["name"]))

    for teacher in sorted(by_teacher.keys()):
        story.append(Spacer(1, 6))
        story.append(Paragraph(teacher, styles["Heading3"]))
        rows = [["Day", "Period", "Course", "Room"]]
        for pi, course, room_name in sorted(by_teacher[teacher]):
            rows.append([
                str(pi // pp_day + 1),
                str(pi % pp_day + 1),
                course,
                room_name,
            ])
        tbl = Table(rows, colWidths=[40, 60, 140, 100])
        tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        story.append(tbl)

    doc.build(story)
    return buf.getvalue()
