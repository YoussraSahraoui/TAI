from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ParsedDataset:
    """Format-agnostic parser output. Maps 1:1 onto the DB schema."""
    teachers: list[str] = field(default_factory=list)
    rooms: list[dict] = field(default_factory=list)
    # course dict keys: code, teacher, type, students, lectures_per_week, min_working_days
    courses: list[dict] = field(default_factory=list)
    # curriculum_name -> list of course codes
    curricula: dict[str, list[str]] = field(default_factory=dict)
    # course_code -> set of integer periods
    unavailability: dict[str, set[int]] = field(default_factory=dict)
    days: int = 5
    periods_per_day: int = 6

    @property
    def use_distance(self) -> bool:
        """True only when every room has a full (x, y, z) triplet."""
        return bool(self.rooms) and all(
            r.get("coord_x") is not None
            and r.get("coord_y") is not None
            and r.get("coord_z") is not None
            for r in self.rooms
        )
