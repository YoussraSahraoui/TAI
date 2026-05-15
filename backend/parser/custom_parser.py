"""
Custom dataset format parser.

Format (per project spec, with same `Name:`/`Days:`/`Periods_per_day:` header
style as ITC2007 to make `(days × periods_per_day)` parseable):

    Name: <name>
    Days: <n>
    Periods_per_day: <n>

    COURSES:
    <Course_ID> <Teacher> <#Lectures> <MinWorkingDays> <#Students> <Type>

    ROOMS:
    <RoomID> <Capacity> <Type> [<x> <y>]
        # type integers: 0=lecture, 1=tutorial, 2=lab
        # coords are optional 2D (z is accepted but ignored, per notebook)

    CURRICULA:
    <CurriculumID> <#Courses> <MemberID> ... <MemberID>

    UNAVAILABILITY_CONSTRAINTS:
    <CourseID> <Day> <Day_Period>

    END.
"""

from __future__ import annotations

import re

from .types import ParsedDataset


_TYPE_MAP_COURSE = {0: "lecture", 1: "tuto", 2: "lab"}
_TYPE_MAP_ROOM   = {0: "amphi",   1: "tuto", 2: "lab"}

_SECTION_KEYS = {
    "COURSES:", "ROOMS:", "CURRICULA:",
    "UNAVAILABILITY_CONSTRAINTS:", "END.",
}


def parse_custom(text: str) -> ParsedDataset:
    """Parse the project's custom format. Raises ValueError on malformed input."""

    header: dict[str, str] = {}
    section: str | None = None
    out = ParsedDataset()

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line in _SECTION_KEYS:
            section = line
            continue

        if section is None:
            m = re.match(r"^(\w+)\s*:\s*(.+)$", line)
            if not m:
                raise ValueError(f"Unexpected header line: {line!r}")
            header[m.group(1)] = m.group(2).strip()
            continue

        if section == "COURSES:":
            tokens = line.split()
            if len(tokens) != 6:
                raise ValueError(
                    f"COURSES line must have 6 tokens (<id> <teacher> "
                    f"<#lectures> <min_days> <#students> <type>), got: {line!r}")
            code, teacher, n_lec, n_min, n_stud, tp = tokens
            tp_i = _parse_type_int(tp, _TYPE_MAP_COURSE, "course")
            out.courses.append({
                "code": code,
                "teacher": teacher,
                "type": tp_i,
                "students": int(n_stud),
                "lectures_per_week": int(n_lec),
                "min_working_days": int(n_min),
            })

        elif section == "ROOMS:":
            tokens = line.split()
            if len(tokens) < 3:
                raise ValueError(
                    f"ROOMS line needs at least 3 tokens "
                    f"(<id> <cap> <type> [<x> <y>]), got: {line!r}")
            name, cap, tp = tokens[0], tokens[1], tokens[2]
            tp_str = _parse_type_int(tp, _TYPE_MAP_ROOM, "room")
            coord_x: float | None = None
            coord_y: float | None = None
            extras = tokens[3:]
            if extras:
                if len(extras) not in (2, 3):
                    raise ValueError(
                        f"ROOMS coords must be 2D or 3D (got {len(extras)} extras): {line!r}")
                try:
                    coord_x = float(extras[0])
                    coord_y = float(extras[1])
                    # extras[2] (z) is parsed but ignored — notebook is 2D-only.
                except ValueError as e:
                    raise ValueError(
                        f"ROOMS coords must be numeric: {line!r}") from e
            out.rooms.append({
                "name": name,
                "cap": int(cap),
                "type": tp_str,
                "coord_x": coord_x,
                "coord_y": coord_y,
            })

        elif section == "CURRICULA:":
            tokens = line.split()
            if len(tokens) < 2:
                raise ValueError(
                    f"CURRICULA line needs <id> <#courses> ..., got: {line!r}")
            curr_id = tokens[0]
            n_courses = int(tokens[1])
            members = tokens[2:]
            if len(members) != n_courses:
                raise ValueError(
                    f"CURRICULA '{curr_id}': declared {n_courses} courses "
                    f"but listed {len(members)}")
            out.curricula[curr_id] = members

        elif section == "UNAVAILABILITY_CONSTRAINTS:":
            tokens = line.split()
            if len(tokens) != 3:
                raise ValueError(
                    f"UNAVAILABILITY line must have 3 tokens "
                    f"(<course_id> <day> <day_period>), got: {line!r}")
            course_id, day, slot = tokens
            try:
                day_i = int(day)
                slot_i = int(slot)
            except ValueError as e:
                raise ValueError(f"UNAVAILABILITY ints required: {line!r}") from e
            out.unavailability.setdefault(course_id, set()).add(
                (day_i << 16) | slot_i
            )

        elif section == "END.":
            break

    # Days / periods_per_day from header (with sane defaults)
    if "Days" in header:
        out.days = int(header["Days"])
    if "Periods_per_day" in header:
        out.periods_per_day = int(header["Periods_per_day"])

    # Resolve unavailability markers → integer periods
    resolved: dict[str, set[int]] = {}
    n_periods = out.days * out.periods_per_day
    for course_id, markers in out.unavailability.items():
        period_set: set[int] = set()
        for m in markers:
            day = m >> 16
            slot = m & 0xFFFF
            if not (0 <= day < out.days):
                raise ValueError(
                    f"UNAVAILABILITY for course '{course_id}' has day "
                    f"{day} out of range [0, {out.days}).")
            if not (0 <= slot < out.periods_per_day):
                raise ValueError(
                    f"UNAVAILABILITY for course '{course_id}' has period "
                    f"{slot} out of range [0, {out.periods_per_day}).")
            p = day * out.periods_per_day + slot
            assert 0 <= p < n_periods
            period_set.add(p)
        resolved[course_id] = period_set
    out.unavailability = resolved

    # Teacher list (preserve first-seen order)
    seen: set[str] = set()
    for c in out.courses:
        if c["teacher"] not in seen:
            out.teachers.append(c["teacher"])
            seen.add(c["teacher"])

    return out


def _parse_type_int(token: str, table: dict[int, str], kind: str) -> str:
    try:
        i = int(token)
    except ValueError as e:
        raise ValueError(f"{kind} type must be 0/1/2, got {token!r}") from e
    if i not in table:
        raise ValueError(f"{kind} type must be 0/1/2, got {i}")
    return table[i]
