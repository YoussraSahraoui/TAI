"""ITC2007 Curriculum-based Course Timetabling parser.

Supports two flavours:

  * **Standard ITC2007** — header section + 5-token COURSES + 2-token ROOMS.
    Reference: http://www.cs.qub.ac.uk/itc2007/curriculmcourse/curriculmcourse.htm

  * **Extended (ENSIA)** — no header, 6-token COURSES, 3-token ROOMS. The
    extra trailing token is a type code (0 = lecture/amphi, 1 = tuto,
    2 = lab). When the header is missing we default to 5 days × 6 periods.

Format
------
::

    Name: <name>            (optional)
    Courses: <n>            (optional)
    Rooms: <n>              (optional)
    Days: <n>               (optional, default 5)
    Periods_per_day: <n>    (optional, default 6)
    Curricula: <n>          (optional)
    Constraints: <n>        (optional)

    COURSES:
    <id> <teacher> <#lectures> <#min_working_days> <#students> [<type_code>]

    ROOMS:
    <id> <capacity> [<type_code>]

    CURRICULA:
    <id> <#courses> <course_id_1> ... <course_id_n>

    UNAVAILABILITY_CONSTRAINTS:
    <course_id> <day> <period_in_day>

    END.                    (optional)

Type code mapping (extended format)::

    0 -> course='lecture',  room='amphi'
    1 -> course='tuto',     room='tuto'
    2 -> course='lab',      room='lab'

Coordinates are not part of either flavour — `use_distance` will be False.
"""

from __future__ import annotations

import re

from .types import ParsedDataset


_HEADER_KEYS = {
    "Name", "Courses", "Rooms", "Days", "Periods_per_day",
    "Curricula", "Constraints",
}

_SECTION_KEYS = {
    "COURSES:", "ROOMS:", "CURRICULA:",
    "UNAVAILABILITY_CONSTRAINTS:", "END.",
}

_COURSE_TYPE_CODE = {0: "lecture", 1: "tuto", 2: "lab"}
_ROOM_TYPE_CODE = {0: "amphi", 1: "tuto", 2: "lab"}

_DEFAULT_DAYS = 5
_DEFAULT_PERIODS_PER_DAY = 6


def parse_itc2007(text: str) -> ParsedDataset:
    """Parse ITC2007 text (standard or ENSIA-extended) into a ParsedDataset."""

    header: dict[str, str] = {}
    section: str | None = None
    out = ParsedDataset()
    teachers_seen: set[str] = set()

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line in _SECTION_KEYS:
            section = line
            continue

        if section is None:
            m = re.match(r"^(\w+)\s*:\s*(.+)$", line)
            if m and m.group(1) in _HEADER_KEYS:
                header[m.group(1)] = m.group(2).strip()
            continue

        if section == "COURSES:":
            tokens = line.split()
            if len(tokens) not in (5, 6):
                raise ValueError(
                    "COURSES line must have 5 or 6 tokens "
                    "(<id> <teacher> <#lectures> <#min_days> <#students> "
                    f"[<type_code>]), got: {line!r}"
                )
            code, teacher, n_lec, n_min, n_stud, *rest = tokens
            type_code = int(rest[0]) if rest else 0
            c_type = _COURSE_TYPE_CODE.get(type_code, "lecture")
            teachers_seen.add(teacher)
            out.courses.append({
                "code": code,
                "teacher": teacher,
                "type": c_type,
                "students": int(n_stud),
                "lectures_per_week": int(n_lec),
                "min_working_days": int(n_min),
            })

        elif section == "ROOMS:":
            tokens = line.split()
            if len(tokens) not in (2, 3, 6):
                raise ValueError(
                    "ROOMS line must have 2, 3 or 6 tokens "
                    f"(<id> <capacity> [<type_code>] [<x> <y> <z>]), got: {line!r}"
                )
            name = tokens[0]
            cap = int(tokens[1])
            type_code = int(tokens[2]) if len(tokens) >= 3 else 0
            r_type = _ROOM_TYPE_CODE.get(type_code, "amphi")
            if len(tokens) == 6:
                x = float(tokens[3])
                y = float(tokens[4])
                z = float(tokens[5])
            else:
                x = y = z = None
            out.rooms.append({
                "name": name,
                "cap": cap,
                "type": r_type,
                "coord_x": x,
                "coord_y": y,
                "coord_z": z,
            })

        elif section == "CURRICULA:":
            tokens = line.split()
            if len(tokens) < 2:
                raise ValueError(
                    "CURRICULA line must have at least 2 tokens "
                    f"(<id> <#courses> ...), got: {line!r}"
                )
            curr_id = tokens[0]
            n_courses = int(tokens[1])
            members = tokens[2:]
            if len(members) != n_courses:
                raise ValueError(
                    f"CURRICULA '{curr_id}': declared {n_courses} courses "
                    f"but listed {len(members)}"
                )
            out.curricula[curr_id] = members

        elif section == "UNAVAILABILITY_CONSTRAINTS:":
            tokens = line.split()
            if len(tokens) != 3:
                raise ValueError(
                    "UNAVAILABILITY line must have 3 tokens "
                    f"(<course_id> <day> <period_in_day>), got: {line!r}"
                )
            course_id, day, slot = tokens
            try:
                day_i = int(day)
                slot_i = int(slot)
            except ValueError as e:
                raise ValueError(
                    f"UNAVAILABILITY day/slot must be ints: {line!r}"
                ) from e
            out.unavailability.setdefault(course_id, set()).add(
                _encode_unavailability_marker(day_i, slot_i)
            )

        elif section == "END.":
            break
        else:
            raise ValueError(f"Unknown section: {section!r}")

    out.days = int(header.get("Days", _DEFAULT_DAYS))
    out.periods_per_day = int(header.get("Periods_per_day", _DEFAULT_PERIODS_PER_DAY))

    out.unavailability = _resolve_unavailability(
        out.unavailability, out.periods_per_day, out.days
    )

    seen: set[str] = set()
    for c in out.courses:
        if c["teacher"] not in seen:
            out.teachers.append(c["teacher"])
            seen.add(c["teacher"])

    if not out.courses:
        raise ValueError("ITC2007 file has no COURSES section or it is empty.")
    if not out.rooms:
        raise ValueError("ITC2007 file has no ROOMS section or it is empty.")

    return out


def _encode_unavailability_marker(day: int, slot: int) -> int:
    return (day << 16) | slot


def _resolve_unavailability(
    unav: dict[str, set[int]],
    periods_per_day: int,
    days: int,
) -> dict[str, set[int]]:
    resolved: dict[str, set[int]] = {}
    n_periods = days * periods_per_day
    for course_id, markers in unav.items():
        period_set: set[int] = set()
        for m in markers:
            day = m >> 16
            slot = m & 0xFFFF
            if not (0 <= day < days):
                raise ValueError(
                    f"UNAVAILABILITY for course '{course_id}' has day "
                    f"{day} out of range [0, {days})."
                )
            if not (0 <= slot < periods_per_day):
                raise ValueError(
                    f"UNAVAILABILITY for course '{course_id}' has period "
                    f"{slot} out of range [0, {periods_per_day})."
                )
            period_set.add(day * periods_per_day + slot)
        for p in period_set:
            if not (0 <= p < n_periods):
                raise ValueError(
                    f"resolved period {p} out of range for course '{course_id}'"
                )
        resolved[course_id] = period_set
    return resolved
