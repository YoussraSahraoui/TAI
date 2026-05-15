import random
import math

class CourseRoomAllocationProblem:
    """
    University Course-to-Room Allocator — ITC2007 Curriculum-Based Format.
    version of 02/05/2026 14:58
    ── COURSE MODEL ─────────────────────────────────────────────────────────────
    Each course dict must contain:
        'course'            (str)  – unique course identifier
        'teacher'           (str)  – teacher identifier
        'type'              (str)  – one of {'lecture', 'tuto', 'lab'}
        'students'          (int)  – enrollment count
        'lectures_per_week' (int)  – number of sessions to schedule
        'min_working_days'  (int)  – soft constraint: spread across at least
                                     this many distinct days

    ── LECTURE MODEL (internally generated) ─────────────────────────────────────
    Each lecture is auto-generated from its course and contains:
        'course'   (str) – parent course identifier
        'teacher'  (str) – inherited from course
        'type'     (str) – inherited from course
        'students' (int) – inherited from course

    ── CURRICULA STRUCTURE ───────────────────────────────────────────────────────
    Provided as a dict:
        { curriculum_id (str) : set of course IDs (set[str]) }

    Two lectures conflict if their parent courses share at least one curriculum:
        conflict(A, B)  ↔  courses_to_curricula[A.course] ∩
                            courses_to_curricula[B.course] ≠ ∅

    ── ROOM MODEL ───────────────────────────────────────────────────────────────
    Each room dict must contain:
        'name'   (str)  – human-readable room name (e.g. 'Amphi-A')
        'type'   (str)  – one of {'amphi', 'tuto', 'lab'}
        'cap'    (int)  – seating capacity (> 0)
    Optionally:
        'coords' (tuple) – (x, y,z) for distance-aware evaluation

    ── TYPE COMPATIBILITY ───────────────────────────────────────────────────────
        lecture  →  amphi  ONLY
        tuto     →  tuto   ONLY
        lab      →  lab    ONLY

    ── PERIODS (ITC2007-STYLE INTEGER ENCODING) ─────────────────────────────────
    Total periods = days * periods_per_day.
    Period p  →  day  = p // periods_per_day
                  slot = p %  periods_per_day

    ── HARD CONSTRAINTS ─────────────────────────────────────────────────────────
        1. Room type compatibility
        2. Room capacity
        3. No double-booking      : no two lectures share (room, period)
        4. No curriculum conflict : no two lectures whose courses share a
                                    curriculum may occupy the same period
        5. No teacher conflict    : a teacher cannot teach two lectures
                                    in the same period

    ── COST FUNCTION ────────────────────────────────────────────────────────────
    Mode 1 – no coordinates:
        C(S) = beta  * Cwaste
             + gamma * Cchange_teacher
             + delta * Cworking_days

    Mode 2 – distance-aware (all rooms have 'coords'):
        C(S) = alpha * Cdist
             + beta  * Cwaste
             + gamma * Cchange_teacher
             + delta * Cworking_days
    """

    TYPE_MAP = {
        "lecture": "amphi",
        "tuto":    "tuto",
        "lab":     "lab",
    }
    VALID_COURSE_TYPES = set(TYPE_MAP.keys())
    VALID_ROOM_TYPES   = set(TYPE_MAP.values())

    # ─────────────────────────────────────────────────────────────────────────
    # Construction
    # ─────────────────────────────────────────────────────────────────────────

    def __init__(self,
                 courses,
                 rooms,
                 curricula,
                 days,
                 periods_per_day,
                 alpha=1.0,
                 beta=0.5,
                 gamma=0.5,
                 delta=1.0,
                 epsilon=2.0,
                 use_distance=None,
                 unavailability=None):
        """
        Parameters
        ----------
        courses         : list[dict]       – course definitions (see COURSE MODEL).
        rooms           : list[dict]       – available rooms (see ROOM MODEL).
        curricula       : dict[str, set]   – {curriculum_id: set of course IDs}.
        days            : int              – number of teaching days.
        periods_per_day : int              – number of periods per day.
        alpha           : float            – weight for Cdist.
        beta            : float            – weight for Cwaste.
        gamma           : float            – weight for Cchange_teacher.
        delta           : float            – weight for Cworking_days.
        use_distance    : bool|None        – None = auto-detect from room coords.
        """
        self._validate_rooms(rooms)
        self._validate_courses(courses)
        self._validate_curricula(curricula, courses)

        self.courses         = courses
        self.rooms           = rooms
        self.curricula       = curricula
        self.days            = days
        self.periods_per_day = periods_per_day
        self.n_periods       = days * periods_per_day
        self.n_rooms         = len(rooms)
        self.alpha           = alpha
        self.beta            = beta
        self.gamma           = gamma
        self.delta           = delta
        self.epsilon         = epsilon
        # H6 — per-course forbidden periods. Caller passes
        # {course_code: set[int]} or None.
        self.unavailability  = {
            k: set(v) for k, v in (unavailability or {}).items()
        }

        # Generate lectures from courses
        self.lectures   = self._generate_lectures()
        self.n_lectures = len(self.lectures)

        # Precompute: course_id -> set of curriculum IDs it belongs to
        self.course_to_curricula = self._build_course_to_curricula()

        # Precompute: lecture_idx -> set of curriculum IDs (via parent course)
        self.lecture_curricula = [
            self.course_to_curricula.get(lec['course'], set())
            for lec in self.lectures
        ]

        # Precompute: course_id -> list of lecture indices
        self.course_to_lectures = {}
        for li, lec in enumerate(self.lectures):
            self.course_to_lectures.setdefault(lec['course'], []).append(li)

        # Precompute: course_id -> min_working_days
        self.course_min_days = {
            c['course']: c['min_working_days'] for c in courses
        }

        # Distance mode
        if use_distance is None:
            self.use_distance = all('coords' in r for r in rooms)
        else:
            if use_distance and not all('coords' in r for r in rooms):
                raise ValueError(
                    "use_distance=True requires every room to have a 'coords' key.")
            self.use_distance = use_distance

        # Initial state is built lazily — call build_initial_state() after
        # construction to seed it via CSP (preferred) or random fallback.
        # This mirrors the notebook's two-phase lifecycle.
        self.initial_state    = None
        self._reference_state = None

    def build_initial_state(self, unavailability=None):
        """Generate a hard-constraint-satisfying initial state.

        Uses the CSP solver (backtracking + MRV + forward checking) for
        reliability on tight instances; falls back to random greedy with
        retries if CSP times out.

        Parameters
        ----------
        unavailability : dict | None
            { course_id : set[int] } of forbidden period indices. If
            provided here, it overrides any unavailability passed to
            __init__ and is mirrored into self.unavailability so move
            validators (H6) stay in sync.
        """
        if unavailability is not None:
            self.unavailability = {k: set(v) for k, v in unavailability.items()}
        # Lazy import to avoid a module-level cycle.
        from src.algorithms.csp import csp_or_random
        state, _source = csp_or_random(self)
        self.initial_state    = state
        self._reference_state = dict(state)
        return state

    def _seed_initial_state(self, max_attempts: int = 200):
        """Random-greedy fallback. Used by HC restarts and as a safety net."""
        last_error = None
        for _ in range(max_attempts):
            try:
                return self._generate_random_state()
            except ValueError as e:
                last_error = e
        raise last_error if last_error else ValueError("Could not seed an initial state.")

    # ─────────────────────────────────────────────────────────────────────────
    # Period helpers  (ITC2007-style)
    # ─────────────────────────────────────────────────────────────────────────

    def get_day(self, period):
        """Returns the day index (0-indexed) of an integer period."""
        return period // self.periods_per_day

    def get_slot(self, period):
        """Returns the within-day slot index (0-indexed) of an integer period."""
        return period % self.periods_per_day

    # ─────────────────────────────────────────────────────────────────────────
    # Lecture generation
    # ─────────────────────────────────────────────────────────────────────────

    def _generate_lectures(self):
        """
        Expands each course into lectures_per_week individual lecture dicts.
        Each lecture inherits course, teacher, type, and students from its
        parent course. No curricula field is stored in lectures.
        """
        lectures = []
        for course in self.courses:
            for _ in range(course['lectures_per_week']):
                lectures.append({
                    'course':   course['course'],
                    'teacher':  course['teacher'],
                    'type':     course['type'],
                    'students': course['students'],
                })
        return lectures

    # ─────────────────────────────────────────────────────────────────────────
    # Curricula precomputation
    # ─────────────────────────────────────────────────────────────────────────

    def _build_course_to_curricula(self):
        """
        Inverts the curricula dict to produce:
            { course_id : set of curriculum IDs that contain this course }
        """
        mapping = {}
        for curr_id, course_set in self.curricula.items():
            for course_id in course_set:
                mapping.setdefault(course_id, set()).add(curr_id)
        return mapping

    # ─────────────────────────────────────────────────────────────────────────
    # Validation
    # ─────────────────────────────────────────────────────────────────────────

    def _validate_rooms(self, rooms):
        if not rooms:
            raise ValueError("Rooms list cannot be empty.")
        for i, r in enumerate(rooms):
            for key in ('name', 'type', 'cap'):
                if key not in r:
                    raise ValueError(
                        f"Room {i} is missing required key '{key}'.")
            if r['type'] not in self.VALID_ROOM_TYPES:
                raise ValueError(
                    f"Room {i} (name='{r.get('name', '?')}') has invalid "
                    f"type '{r['type']}'. Must be one of {self.VALID_ROOM_TYPES}.")
            if not isinstance(r['cap'], int) or r['cap'] < 1:
                raise ValueError(
                    f"Room {i} (name='{r.get('name', '?')}') has invalid "
                    f"cap '{r['cap']}'. Must be a positive integer.")

    def _validate_courses(self, courses):
        if not courses:
            raise ValueError("Courses list cannot be empty.")
        required = {'course', 'teacher', 'type', 'students',
                    'lectures_per_week', 'min_working_days'}
        for i, c in enumerate(courses):
            missing = required - c.keys()
            if missing:
                raise ValueError(
                    f"Course {i} (course='{c.get('course', '?')}') "
                    f"is missing required keys: {missing}.")
            if c['type'] not in self.VALID_COURSE_TYPES:
                raise ValueError(
                    f"Course {i} (course='{c.get('course', '?')}') "
                    f"has invalid type '{c['type']}'. "
                    f"Must be one of {self.VALID_COURSE_TYPES}.")
            if not isinstance(c['students'], int) or c['students'] < 1:
                raise ValueError(
                    f"Course {i} (course='{c.get('course', '?')}') "
                    f"has invalid students '{c['students']}'.")
            if not isinstance(c['lectures_per_week'], int) or c['lectures_per_week'] < 1:
                raise ValueError(
                    f"Course {i} (course='{c.get('course', '?')}') "
                    f"has invalid lectures_per_week '{c['lectures_per_week']}'.")
            if not isinstance(c['min_working_days'], int) or c['min_working_days'] < 1:
                raise ValueError(
                    f"Course {i} (course='{c.get('course', '?')}') "
                    f"has invalid min_working_days '{c['min_working_days']}'.")

    def _validate_curricula(self, curricula, courses):
        if not isinstance(curricula, dict):
            raise ValueError("curricula must be a dict mapping curriculum_id -> set of course IDs.")
        known_courses = {c['course'] for c in courses}
        for curr_id, course_set in curricula.items():
            if not isinstance(course_set, set):
                raise ValueError(
                    f"Curriculum '{curr_id}' must map to a set of course IDs.")
            unknown = course_set - known_courses
            if unknown:
                raise ValueError(
                    f"Curriculum '{curr_id}' references unknown courses: {unknown}.")

    # ─────────────────────────────────────────────────────────────────────────
    # Fast-lookup builders
    # ─────────────────────────────────────────────────────────────────────────

    def _build_occupied(self, state):
        """Returns {(room_idx, period_idx): lecture_idx}."""
        return {v: k for k, v in state.items()}

    def _build_curriculum_periods(self, state):
        """
        Returns {(curriculum_id, period_idx): lecture_idx}.
        Covers all curricula of each lecture's parent course.
        """
        cp = {}
        for li, (ri, pi) in state.items():
            for curr in self.lecture_curricula[li]:
                cp[(curr, pi)] = li
        return cp

    def _build_teacher_periods(self, state):
        """Returns {(teacher_id, period_idx): lecture_idx}."""
        tp = {}
        for li, (ri, pi) in state.items():
            tp[(self.lectures[li]['teacher'], pi)] = li
        return tp

    # ─────────────────────────────────────────────────────────────────────────
    # Lookup mutators
    # ─────────────────────────────────────────────────────────────────────────

    def _register(self, li, ri, pi, occupied, curriculum_periods, teacher_periods):
        """Add lecture li at (ri, pi) into all fast-lookup dicts."""
        occupied[(ri, pi)] = li
        for curr in self.lecture_curricula[li]:
            curriculum_periods[(curr, pi)] = li
        teacher_periods[(self.lectures[li]['teacher'], pi)] = li

    def _unregister(self, li, ri, pi, occupied, curriculum_periods, teacher_periods):
        """Remove lecture li at (ri, pi) from all fast-lookup dicts."""
        del occupied[(ri, pi)]
        for curr in self.lecture_curricula[li]:
            del curriculum_periods[(curr, pi)]
        del teacher_periods[(self.lectures[li]['teacher'], pi)]

    # ─────────────────────────────────────────────────────────────────────────
    # Centralised hard-constraint check  (single source of truth)
    # ─────────────────────────────────────────────────────────────────────────

    def _is_valid_assignment(self,
                             lecture_idx,
                             room_idx,
                             period_idx,
                             occupied,
                             curriculum_periods,
                             teacher_periods):
        """
        Returns True iff assigning lecture_idx to (room_idx, period_idx)
        satisfies ALL five hard constraints.

        Constraints (cheapest first):
            1. Room type compatibility
            2. Room capacity
            3. No double-booking
            4. No curriculum conflict  – based on shared curricula of courses
            5. No teacher conflict
        """
        lec  = self.lectures[lecture_idx]
        room = self.rooms[room_idx]

        # 1. Room type compatibility
        if room['type'] != self.TYPE_MAP[lec['type']]:
            return False

        # 2. Room capacity
        if room['cap'] < lec['students']:
            return False

        # H6. Course-specific period unavailability
        forbidden = self.unavailability.get(lec['course'])
        if forbidden is not None and period_idx in forbidden:
            return False

        # 3. No double-booking
        occupant = occupied.get((room_idx, period_idx))
        if occupant is not None and occupant != lecture_idx:
            return False

        # 4. No curriculum conflict
        #    Uses precomputed lecture_curricula — no lec['curricula'] access.
        for curr in self.lecture_curricula[lecture_idx]:
            holder = curriculum_periods.get((curr, period_idx))
            if holder is not None and holder != lecture_idx:
                return False

        # 5. No teacher conflict
        teach_holder = teacher_periods.get((lec['teacher'], period_idx))
        if teach_holder is not None and teach_holder != lecture_idx:
            return False

        return True

    # ─────────────────────────────────────────────────────────────────────────
    # Initial state generator
    # ─────────────────────────────────────────────────────────────────────────

    def _generate_random_state(self):
        """
        Builds a complete hard-constraint-satisfying assignment by iterating
        lectures in random order and selecting a valid (room, period) pair
        uniformly at random.
        Raises ValueError if any lecture cannot be placed.
        """
        state              = {}
        occupied           = {}
        curriculum_periods = {}
        teacher_periods    = {}

        order = list(range(self.n_lectures))
        random.shuffle(order)

        for li in order:
            candidates = [
                (ri, pi)
                for ri in range(self.n_rooms)
                for pi in range(self.n_periods)
                if self._is_valid_assignment(
                    li, ri, pi,
                    occupied, curriculum_periods, teacher_periods)
            ]

            if not candidates:
                lec = self.lectures[li]
                raise ValueError(
                    f"Lecture {li} (course='{lec['course']}', "
                    f"type='{lec['type']}', "
                    f"teacher='{lec['teacher']}', "
                    f"students={lec['students']}) has no valid "
                    f"(room, period) assignment satisfying all hard constraints. "
                    f"Check room types, capacities, curricula, and teacher conflicts.")

            ri, pi = random.choice(candidates)
            state[li] = (ri, pi)
            self._register(li, ri, pi,
                           occupied, curriculum_periods, teacher_periods)

        return state

    # ─────────────────────────────────────────────────────────────────────────
    # Cost components
    # ─────────────────────────────────────────────────────────────────────────

    def _distance(self, room_a_idx, room_b_idx):
        """Euclidean distance between two rooms (requires 'coords')."""
        xa, ya, za= self.rooms[room_a_idx]['coords']
        xb, yb, zb = self.rooms[room_b_idx]['coords']
        return math.sqrt((xa - xb) ** 2 + (ya - yb) ** 2 + (za - zb) ** 2)

    def _cdist(self, state):
        """
        Teacher travel cost.
        Sums distances between rooms of consecutive sessions
        (adjacent periods within the same day) for each teacher.
        """
        teacher_schedule = {}
        for li, (ri, pi) in state.items():
            teacher = self.lectures[li]['teacher']
            teacher_schedule.setdefault(teacher, []).append((pi, ri))

        total = 0.0
        for sessions in teacher_schedule.values():
            sessions.sort(key=lambda x: x[0])
            for k in range(len(sessions) - 1):
                pi,  ri  = sessions[k]
                pi1, ri1 = sessions[k + 1]
                # Adjacent within the same day only
                if pi1 == pi + 1 and self.get_day(pi1) == self.get_day(pi):
                    total += self._distance(ri, ri1)
        return total

    def _cwaste(self, state):
        """Capacity waste: sum of (cap - students) across all assignments."""
        return float(sum(
            self.rooms[ri]['cap'] - self.lectures[li]['students']
            for li, (ri, _) in state.items()
        ))

    def _cchange_teacher(self, state):
        """
        Teacher room-stability penalty.
        Counts sessions where a teacher is in a different room than in the
        reference (initial) state for the same period.
        """
        ref = self._reference_state

        current   = {}
        reference = {}
        for li, (ri, pi) in state.items():
            current.setdefault(self.lectures[li]['teacher'], {})[pi] = ri
        for li, (ri, pi) in ref.items():
            reference.setdefault(self.lectures[li]['teacher'], {})[pi] = ri

        penalty = 0.0
        for teacher, period_rooms in current.items():
            ref_period_rooms = reference.get(teacher, {})
            for pi, ri in period_rooms.items():
                ref_ri = ref_period_rooms.get(pi)
                if ref_ri is not None and ref_ri != ri:
                    penalty += 1.0
        return penalty

    def _cworking_days(self, state):
        """
        Minimum working days penalty (soft constraint).
        For each course, counts the number of distinct days on which its
        lectures are scheduled. If fewer than min_working_days, adds a
        penalty equal to the shortfall.
        """
        penalty = 0.0
        for course_id, lecture_indices in self.course_to_lectures.items():
            days_used = {self.get_day(state[li][1]) for li in lecture_indices}
            min_days  = self.course_min_days[course_id]
            shortfall = min_days - len(days_used)
            if shortfall > 0:
                penalty += shortfall
        return penalty

    def _clunch_break_penalty(self, state):
        """Lunch-break soft constraint.

        Penalises any teacher OR curriculum that occupies more than 3
        consecutive slots within a single day. For each chain of length L
        on the same day, the penalty contribution is max(0, L - 3).

        Examples (sorted occupied slots, on one day):
            [0, 1, 2, 3, 4]   chain=5  penalty += 2
            [0, 1, 3, 4, 5]   chains 2 + 3, both ≤ 3, penalty += 0
            [0, 1, 2, 3]      chain=4  penalty += 1

        Total is summed across all teachers AND all curricula, all days.
        """
        from collections import defaultdict

        teacher_day_slots = defaultdict(lambda: defaultdict(list))
        curr_day_slots    = defaultdict(lambda: defaultdict(list))

        for li, (_ri, pi) in state.items():
            day  = self.get_day(pi)
            slot = self.get_slot(pi)

            teacher = self.lectures[li]['teacher']
            teacher_day_slots[teacher][day].append(slot)

            for curr_id in self.lecture_curricula[li]:
                curr_day_slots[curr_id][day].append(slot)

        def _chain_penalty(slots):
            if len(slots) < 4:
                return 0.0
            penalty = 0.0
            chain_len = 1
            for k in range(1, len(slots)):
                if slots[k] == slots[k - 1] + 1:
                    chain_len += 1
                else:
                    penalty += max(0, chain_len - 3)
                    chain_len = 1
            penalty += max(0, chain_len - 3)
            return penalty

        total = 0.0
        for day_slots in teacher_day_slots.values():
            for _, slots in day_slots.items():
                slots.sort()
                total += _chain_penalty(slots)
        for day_slots in curr_day_slots.values():
            for _, slots in day_slots.items():
                slots.sort()
                total += _chain_penalty(slots)
        return total

    def evaluate(self, state):
        """Scalar cost — lower is better.

        Without coords:
            C(S) = β·Cwaste + γ·Cchange + δ·Cworking_days + ε·Clunch
        With coords:
            C(S) = α·Cdist + β·Cwaste + γ·Cchange + δ·Cworking_days + ε·Clunch
        """
        cost = (self.beta    * self._cwaste(state)              +
                self.gamma   * self._cchange_teacher(state)     +
                self.delta   * self._cworking_days(state)       +
                self.epsilon * self._clunch_break_penalty(state))
        if self.use_distance:
            cost += self.alpha * self._cdist(state)
        return cost

    # ─────────────────────────────────────────────────────────────────────────
    # Neighbor generation
    # ─────────────────────────────────────────────────────────────────────────

    def generate_neighbors(self, state):
        """
        Returns every valid neighbor reachable by one of three operators:

            RA – Reassign  : move one lecture to any other (room, period).
            RS – Room Swap : exchange rooms of two lectures (periods fixed).
            TS – Time Shift: move one lecture to another period, same room.

        All five hard constraints are enforced exclusively via
        _is_valid_assignment. Duplicates are suppressed via a seen-set.
        """
        neighbors = []
        seen      = set()

        occupied           = self._build_occupied(state)
        curriculum_periods = self._build_curriculum_periods(state)
        teacher_periods    = self._build_teacher_periods(state)

        def try_add(new_state):
            key = tuple(sorted(new_state.items()))
            if key not in seen:
                seen.add(key)
                neighbors.append(new_state)

        def check_move(li, ri, pi):
            old_ri, old_pi = state[li]
            self._unregister(li, old_ri, old_pi,
                             occupied, curriculum_periods, teacher_periods)
            valid = self._is_valid_assignment(
                li, ri, pi, occupied, curriculum_periods, teacher_periods)
            self._register(li, old_ri, old_pi,
                           occupied, curriculum_periods, teacher_periods)
            if valid:
                ns = dict(state)
                ns[li] = (ri, pi)
                return ns
            return None

        # ── Operator RA: Reassign ────────────────────────────────────────────
        for li in range(self.n_lectures):
            cur_ri, cur_pi = state[li]
            for ri in range(self.n_rooms):
                for pi in range(self.n_periods):
                    if ri == cur_ri and pi == cur_pi:
                        continue
                    ns = check_move(li, ri, pi)
                    if ns is not None:
                        try_add(ns)

        # ── Operator RS: Room Swap ───────────────────────────────────────────
        for li in range(self.n_lectures):
            for lj in range(li + 1, self.n_lectures):
                ri, pi = state[li]
                rj, pj = state[lj]
                if ri == rj:
                    continue
                self._unregister(li, ri, pi,
                                 occupied, curriculum_periods, teacher_periods)
                self._unregister(lj, rj, pj,
                                 occupied, curriculum_periods, teacher_periods)
                valid_li = self._is_valid_assignment(
                    li, rj, pi, occupied, curriculum_periods, teacher_periods)
                valid_lj = self._is_valid_assignment(
                    lj, ri, pj, occupied, curriculum_periods, teacher_periods)
                self._register(li, ri, pi,
                               occupied, curriculum_periods, teacher_periods)
                self._register(lj, rj, pj,
                               occupied, curriculum_periods, teacher_periods)
                if valid_li and valid_lj:
                    ns = dict(state)
                    ns[li] = (rj, pi)
                    ns[lj] = (ri, pj)
                    try_add(ns)

        # ── Operator TS: Time Shift ──────────────────────────────────────────
        for li in range(self.n_lectures):
            cur_ri, cur_pi = state[li]
            for pi in range(self.n_periods):
                if pi == cur_pi:
                    continue
                ns = check_move(li, cur_ri, pi)
                if ns is not None:
                    try_add(ns)

        return neighbors

    def generate_random_neighbor(self, state):
        """
        Returns one random valid neighbor state.
        Tries up to 50 random attempts, then falls back to exhaustive TS scan.
        Returns a copy of state only if no valid move exists anywhere.
        """
        occupied           = self._build_occupied(state)
        curriculum_periods = self._build_curriculum_periods(state)
        teacher_periods    = self._build_teacher_periods(state)

        def try_move(li, ri, pi):
            old_ri, old_pi = state[li]
            self._unregister(li, old_ri, old_pi,
                             occupied, curriculum_periods, teacher_periods)
            valid = self._is_valid_assignment(
                li, ri, pi, occupied, curriculum_periods, teacher_periods)
            self._register(li, old_ri, old_pi,
                           occupied, curriculum_periods, teacher_periods)
            return valid

        operators    = ['RA', 'RS', 'TS']
        max_attempts = 50

        for _ in range(max_attempts):
            op = random.choice(operators)

            if op == 'RA':
                li = random.randrange(self.n_lectures)
                ri = random.randrange(self.n_rooms)
                pi = random.randrange(self.n_periods)
                cur_ri, cur_pi = state[li]
                if ri == cur_ri and pi == cur_pi:
                    continue
                if try_move(li, ri, pi):
                    ns = dict(state)
                    ns[li] = (ri, pi)
                    return ns

            elif op == 'RS':
                li = random.randrange(self.n_lectures)
                lj = random.randrange(self.n_lectures)
                if li == lj:
                    continue
                ri, pi = state[li]
                rj, pj = state[lj]
                if ri == rj:
                    continue
                self._unregister(li, ri, pi,
                                 occupied, curriculum_periods, teacher_periods)
                self._unregister(lj, rj, pj,
                                 occupied, curriculum_periods, teacher_periods)
                valid_li = self._is_valid_assignment(
                    li, rj, pi, occupied, curriculum_periods, teacher_periods)
                valid_lj = self._is_valid_assignment(
                    lj, ri, pj, occupied, curriculum_periods, teacher_periods)
                self._register(li, ri, pi,
                               occupied, curriculum_periods, teacher_periods)
                self._register(lj, rj, pj,
                               occupied, curriculum_periods, teacher_periods)
                if valid_li and valid_lj:
                    ns = dict(state)
                    ns[li] = (rj, pi)
                    ns[lj] = (ri, pj)
                    return ns

            else:  # TS
                li = random.randrange(self.n_lectures)
                pi = random.randrange(self.n_periods)
                cur_ri, cur_pi = state[li]
                if pi == cur_pi:
                    continue
                if try_move(li, cur_ri, pi):
                    ns = dict(state)
                    ns[li] = (cur_ri, pi)
                    return ns

        # ── Last resort: exhaustive TS scan ───────────────────────────────────
        for li in range(self.n_lectures):
            cur_ri, cur_pi = state[li]
            for pi in range(self.n_periods):
                if pi == cur_pi:
                    continue
                if try_move(li, cur_ri, pi):
                    ns = dict(state)
                    ns[li] = (cur_ri, pi)
                    return ns

        return dict(state)
