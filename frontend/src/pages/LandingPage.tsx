import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import styles from "./LandingPage.module.css";
import { useTheme, type Theme } from "../hooks/useTheme";
import ThemeToggle from "../components/ui/ThemeToggle";

const N_POINTS = 900;
const N_SECTIONS = 5;

/* ================================================================ */
/* Hero typing animation: prefix toggles between "T" and             */
/* "Timetabling " — combined with a static "AI" suffix you read       */
/* "TAI" ↔ "Timetabling AI" with a blinking caret in the middle.    */
/* ================================================================ */
function useHeroPrefix() {
  const PREFIXES = ["T", "Timetabling "];
  const TYPE_MS = 70;
  const DELETE_MS = 38;
  const HOLD_MS = 2000;
  const SWITCH_MS = 220;

  const [prefix, setPrefix] = useState(PREFIXES[0]);

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    let cursor = PREFIXES[0].length;
    let mode: "hold" | "deleting" | "typing" = "hold";
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (cancelled) return;
      const target = PREFIXES[i];

      if (mode === "hold") {
        mode = "deleting";
        timer = setTimeout(step, 0);
        return;
      }
      if (mode === "deleting") {
        if (cursor > 0) {
          cursor -= 1;
          setPrefix(target.slice(0, cursor));
          timer = setTimeout(step, DELETE_MS);
        } else {
          i = (i + 1) % PREFIXES.length;
          mode = "typing";
          timer = setTimeout(step, SWITCH_MS);
        }
        return;
      }
      if (mode === "typing") {
        const next = PREFIXES[i];
        if (cursor < next.length) {
          cursor += 1;
          setPrefix(next.slice(0, cursor));
          timer = setTimeout(step, TYPE_MS);
        } else {
          mode = "hold";
          timer = setTimeout(step, HOLD_MS);
        }
      }
    };

    timer = setTimeout(step, HOLD_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return prefix;
}

/* ================================================================ */
/* 3D scene — point cloud that morphs from chaos to an ordered grid  */
/* ================================================================ */

function useTargets() {
  return useMemo(() => {
    const chaos = new Float32Array(N_POINTS * 3);
    const grid = new Float32Array(N_POINTS * 3);

    // Chaos — points distributed on a fuzzy sphere shell
    for (let i = 0; i < N_POINTS; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      const r = 6 + (Math.random() - 0.5) * 3;
      chaos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      chaos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      chaos[i * 3 + 2] = r * Math.cos(phi);
    }

    // Grid — an ordered lattice (the "solved" schedule)
    const side = Math.ceil(Math.cbrt(N_POINTS));
    const step = 0.9;
    const origin = -(side - 1) * step * 0.5;
    for (let i = 0; i < N_POINTS; i++) {
      const ix = i % side;
      const iy = Math.floor(i / side) % side;
      const iz = Math.floor(i / (side * side));
      grid[i * 3 + 0] = origin + ix * step;
      grid[i * 3 + 1] = origin + iy * step * 0.7;
      grid[i * 3 + 2] = origin + iz * step;
    }

    return { chaos, grid };
  }, []);
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function Scene({ scrollRef, theme }: { scrollRef: React.MutableRefObject<number>; theme: Theme }) {
  const { chaos, grid } = useTargets();
  const themeRef = useRef<Theme>(theme);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  const pointsRef = useRef<THREE.Points>(null);
  const pathRef = useRef<THREE.Line>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Working buffer (mutated in-place)
  const positions = useMemo(() => new Float32Array(chaos), [chaos]);

  // Pre-computed search-path points — a noisy curve through space
  const pathPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const steps = 220;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = 4 - t * 3.2;
      const angle = t * Math.PI * 6;
      pts.push(
        new THREE.Vector3(
          r * Math.cos(angle) + Math.sin(t * 14) * 0.3,
          -2.2 + t * 4.5 + Math.cos(t * 11) * 0.25,
          r * Math.sin(angle) + Math.cos(t * 13) * 0.3
        )
      );
    }
    return pts;
  }, []);

  const pathGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(pathPoints);
    g.setDrawRange(0, 0);
    return g;
  }, [pathPoints]);

  useFrame((state) => {
    const off = scrollRef.current;
    const t = smoothstep(0.1, 0.75, off); // morph progress
    const time = state.clock.getElapsedTime();

    // Morph point positions
    const arr = pointsRef.current!.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < chaos.length; i++) {
      arr[i] = chaos[i] * (1 - t) + grid[i] * t;
    }
    pointsRef.current!.geometry.attributes.position.needsUpdate = true;

    // Per-point color — shift toward red accent on points near the current search-path head
    const head = pathPoints[Math.floor(off * (pathPoints.length - 1))];
    const colorAttr = pointsRef.current!.geometry.attributes.color as THREE.BufferAttribute | undefined;
    if (colorAttr && head) {
      const cArr = colorAttr.array as Float32Array;
      const dark = themeRef.current === "dark";
      // Base = grey on the page bg, hot = red accent. Lerp base → red.
      const baseR = dark ? 0.78 : 0.04;
      const baseG = dark ? 0.78 : 0.04;
      const baseB = dark ? 0.78 : 0.04;
      const hotR = 0.90, hotG = 0.22, hotB = 0.27;
      for (let i = 0; i < N_POINTS; i++) {
        const dx = arr[i * 3 + 0] - head.x;
        const dy = arr[i * 3 + 1] - head.y;
        const dz = arr[i * 3 + 2] - head.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const hot = Math.max(0, 1 - d / 1.2);
        cArr[i * 3 + 0] = baseR * (1 - hot) + hotR * hot;
        cArr[i * 3 + 1] = baseG * (1 - hot) + hotG * hot;
        cArr[i * 3 + 2] = baseB * (1 - hot) + hotB * hot;
      }
      colorAttr.needsUpdate = true;
    }

    // Grow the search path with scroll
    const draw = Math.floor(off * pathPoints.length);
    pathGeometry.setDrawRange(0, Math.max(2, draw));

    // Rotate & parallax
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.05 + off * Math.PI * 0.6;
      groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.05 - off * 0.25;
    }

    // Camera dolly — zoom in as user scrolls
    const cam = state.camera;
    const zBase = 14 - off * 7;
    cam.position.x += (Math.sin(time * 0.1) * 0.4 - cam.position.x) * 0.02;
    cam.position.y += (1.2 - off * 0.6 - cam.position.y) * 0.04;
    cam.position.z += (zBase - cam.position.z) * 0.04;
    cam.lookAt(0, 0, 0);
  });

  // Initial colors — dark gray
  const initialColors = useMemo(() => {
    const c = new Float32Array(N_POINTS * 3);
    for (let i = 0; i < c.length; i++) c[i] = 0.04;
    return c;
  }, []);

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[initialColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.055}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.95}
        />
      </points>

      <line ref={pathRef as never}>
        <primitive object={pathGeometry} attach="geometry" />
        <lineBasicMaterial color="#e63946" transparent opacity={0.85} />
      </line>

      {/* subtle ground grid */}
      <gridHelper
        args={[40, 40,
          theme === "dark" ? "#3a3a3a" : "#d4d4d4",
          theme === "dark" ? "#1f1f1f" : "#ececec",
        ]}
        position={[0, -4, 0]}
      />
    </group>
  );
}

/* ================================================================ */
/* Page                                                             */
/* ================================================================ */

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  roleDesc: string;
  photo: string;
}

// Placeholder team — replace names, photos and copy with real data
const TEAM: TeamMember[] = [
  {
    name: "Alaeddine Gadi",
    role: "The Orchestrator",
    bio: "The Master Architect who ensures every brick is placed correctly and that the final building is accessible to the public.",
    roleDesc: "Acts as the project’s middleware and integration lead. They enforce code standards via rigorous review and design the UI/UX to ensure complex algorithmic data is translated into a clear, visual narrative.",
    photo: "",
  },
  {
    name: "Youssra Sahraoui",
    role: "Backend Engineer",
    bio: "Builds the FastAPI service layer and the SQLAlchemy data model that powers the entity registry.",
    roleDesc: "Owns the REST contract, persistence schemas, and the bridge between the database and the optimisation engine.",
    photo: "",
  },
  {
    name: "Mohamed Boubaya",
    role: "The Theoretician",
    bio: "The Legislator who writes the fundamental constitution that defines how this world operates.",
    roleDesc: "Responsible for the mathematical modeling of the problem. They translate the messy real-world constraints into formal sets, variables, and domains (X,D,C), providing the logical proof that the algorithms rely on.",
    photo: "",
  },
  {
    name: "Dania Arab",
    role: "The Smith",
    bio: "The Master Metallurgist who heats the metal to a fluid state to work out impurities before cooling it into a perfect blade.",
    roleDesc: "Implements the probabilistic optimization strategy. By controlling the temperature parameter, they allow the system to escape local traps early in the search, forging a path toward the global optimum.",
    photo: "",
  },
  {
    name: "Benkadi Meriem",
    role: "The Explorer",
    bio: "The High-Altitude Scout who quickly identifies and ascends the steepest path to the nearest peak.",
    roleDesc: "Focused on greedy local search. They take a valid state and rapidly mutate it through iterative improvement, ensuring the system reaches a local optimum with maximum efficiency and speed.",
    photo: "",
  },
  {
    name: "Mohamed Ikbal Rekik",
    role: "The Sentinel",
    bio: "The Gatekeeper of Reality who prevents the system from attempting the impossible by enforcing the laws",
    roleDesc: "Manages the core validity of the state-space. By implementing strict constraint propagation and backtracking, they filter out illegal configurations, ensuring the optimizers only work within valid boundaries.",
    photo: "",
  },
];

const FEATURES = [
  {
    idx: "01",
    title: "Entity Management",
    desc: "Define teachers, rooms, subjects, student groups and events through a clean tabular interface.",
  },
  {
    idx: "02",
    title: "Constraint Control",
    desc: "Toggle hard rules and tune soft preference weights for travel, capacity and schedule stability.",
  },
  {
    idx: "03",
    title: "Metaheuristic Solver",
    desc: "Run Simulated Annealing or Hill Climbing with live iteration streaming over WebSockets.",
  },
  {
    idx: "04",
    title: "3D Visualisation",
    desc: "Watch the search trajectory through a three-dimensional state space in real time.",
  },
  {
    idx: "05",
    title: "Analytics",
    desc: "Fitness curves, bottleneck detection and advisory feedback after every run.",
  },
  {
    idx: "06",
    title: "REST API",
    desc: "All operations exposed via FastAPI with auto-generated OpenAPI documentation.",
  },
];

export default function LandingPage() {
  const scrollRef = useRef(0);
  const [activeSection, setActiveSection] = useState(0);
  const heroPrefix = useHeroPrefix();
  const { theme, toggle } = useTheme();

  const teamWrapperRef = useRef<HTMLDivElement>(null);
  const teamTrackRef = useRef<HTMLDivElement>(null);
  const teamTargetX = useRef(0);
  const teamCurrentX = useRef(0);
  const [teamActive, setTeamActive] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      // Page-level scroll for 3D canvas + main progress dots
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const o = max > 0 ? window.scrollY / max : 0;
      scrollRef.current = o;
      const mainEnd = 5 * window.innerHeight; // first 5 sections only
      const mainProgress = mainEnd > 0 ? Math.min(1, window.scrollY / mainEnd) : 0;
      setActiveSection(Math.min(N_SECTIONS - 1, Math.floor(mainProgress * N_SECTIONS + 0.15)));

      // Team slider — translate horizontally based on wrapper scroll progress
      const w = teamWrapperRef.current;
      if (w) {
        const rect = w.getBoundingClientRect();
        const span = rect.height - window.innerHeight;
        const scrolled = Math.max(0, -rect.top);
        const progress = span > 0 ? Math.max(0, Math.min(1, scrolled / span)) : 0;
        const lastIdx = TEAM.length - 1;
        teamTargetX.current = -progress * lastIdx * window.innerWidth;
        setTeamActive(Math.min(lastIdx, Math.round(progress * lastIdx)));
      }
    };

    let raf = 0;
    const tick = () => {
      // Smooth ease toward target (lerp factor controls smoothness)
      teamCurrentX.current += (teamTargetX.current - teamCurrentX.current) * 0.14;
      if (teamTrackRef.current) {
        teamTrackRef.current.style.transform = `translate3d(${teamCurrentX.current}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.root}>
      {/* Fixed 3D canvas */}
      <div className={styles.canvas}>
        <Canvas
          camera={{ position: [0, 1.2, 14], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={0.6} />
          <Scene scrollRef={scrollRef} theme={theme} />
        </Canvas>
      </div>

      {/* Fixed top nav */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span>TAI</span>
          <span className={styles.navAccent} />
        </div>
        <div className={styles.navLinks}>
          <a href="#problem" className={styles.navLink}>Problem</a>
          <a href="#approach" className={styles.navLink}>Approach</a>
          <a href="#platform" className={styles.navLink}>Platform</a>
          <ThemeToggle theme={theme} onToggle={toggle} />
          <Link to="/dashboard" className={styles.navEnter}>Enter &nbsp;→</Link>
        </div>
      </nav>

      {/* Fixed progress indicator */}
      <div className={styles.progress} aria-hidden>
        {Array.from({ length: N_SECTIONS }).map((_, i) => (
          <div
            key={i}
            className={`${styles.progressDot} ${i === activeSection ? styles.progressDotActive : ""}`}
          />
        ))}
      </div>

      {/* Scroll cue */}
      {activeSection === 0 && (
        <div className={styles.scrollCue}>
          <span>Scroll</span>
          <div className={styles.scrollLine} />
        </div>
      )}

      {/* Scrolling content */}
      <main className={styles.content}>
        {/* 1. Hero */}
        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.eyebrow}>Course · Room · Timeslot</div>
            <h1 className={styles.heroTitle} aria-label="TAI — Timetabling AI">
              <span>{heroPrefix}</span>
              <span className={styles.heroCursor} aria-hidden />
              <span className={styles.accent}>AI</span>
            </h1>
            <p className={styles.heroSub}>
              A metaheuristic platform for university schedule optimisation.
              Simulated Annealing and Hill Climbing, a clean REST backend,
              and a 3D visual search space — all in one place.
            </p>
            <div className={styles.heroMeta}>
              <div className={styles.heroMetaItem}>
                <strong>2</strong><span>Algorithms</span>
              </div>
              <div className={styles.heroMetaItem}>
                <strong>3D</strong><span>State Space</span>
              </div>
              <div className={styles.heroMetaItem}>
                <strong>∞</strong><span>Configurations</span>
              </div>
            </div>
          </div>
          <div className={styles.footerLine}>
            <span>01 / 05</span>
            <span>Index</span>
          </div>
        </section>

        {/* 2. Problem */}
        <section id="problem" className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.textSection}>
              <div className={styles.secIdx}>01</div>
              <div className={styles.secContent}>
                <div className={styles.eyebrow}>The Problem</div>
                <h2>A combinatorial jungle.</h2>
                <p>
                  For every pairing of a course, a room and a timeslot, a university
                  scheduler faces astronomically many valid — and far more invalid —
                  arrangements. Capacities must fit. Room types must match.
                  Nobody can be in two places at once.
                </p>
                <p>
                  Classical approaches fail to scale. Manual scheduling takes weeks,
                  and the result is rarely close to optimal.
                </p>
              </div>
            </div>
          </div>
          <div className={styles.footerLine}>
            <span>02 / 05</span>
            <span>The Problem</span>
          </div>
        </section>

        {/* 3. Approach */}
        <section id="approach" className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.textSection}>
              <div className={styles.secIdx}>02</div>
              <div className={styles.secContent}>
                <div className={styles.eyebrow}>The Approach</div>
                <h2>Search, cool, settle.</h2>
                <p>
                  Simulated Annealing treats the schedule as a physical system.
                  A high temperature permits bold jumps; cooling forces commitment.
                  Hill Climbing ensures optimality through gradual steps and enhancements.
                </p>
                <p>
                  The cost function balances teacher travel, wasted room capacity
                  and deviation from a reference schedule. Every weight is yours to set.
                </p>
              </div>
            </div>
          </div>
          <div className={styles.footerLine}>
            <span>03 / 05</span>
            <span>The Approach</span>
          </div>
        </section>

        {/* 4. Platform */}
        <section id="platform" className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.eyebrow}>The Platform</div>
            <h2 style={{ fontSize: "clamp(32px, 5vw, 64px)", margin: 0, letterSpacing: "-0.03em", fontWeight: 700, lineHeight: 1 }}>
              A full-stack optimisation studio.
            </h2>
            <div className={styles.featureGrid}>
              {FEATURES.map((f) => (
                <div key={f.idx} className={styles.feature}>
                  <div className={styles.featureIdx}>{f.idx}</div>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureDesc}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.footerLine}>
            <span>04 / 05</span>
            <span>The Platform</span>
          </div>
        </section>

        {/* 5. CTA */}
        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.cta}>
              <div className={styles.eyebrow} style={{ justifyContent: "center" }}>Begin</div>
              <h2 className={styles.ctaTitle}>
                Build a better schedule.
              </h2>
              <p className={styles.ctaSub}>
                Open the console and define your first problem instance.
              </p>
              <Link to="/dashboard" className={styles.ctaBtn}>
                Enter the Console &nbsp;→
              </Link>
            </div>
          </div>
          <div className={styles.footerLine}>
            <span>05 / 05</span>
            <span>End</span>
          </div>
        </section>

        {/* 6. Team — horizontal slider driven by vertical scroll */}
        <section
          ref={teamWrapperRef}
          id="team"
          className={styles.teamWrapper}
          aria-label="Team"
        >
          <div className={styles.teamSticky}>
            <div className={styles.teamHeader}>
              <div className={styles.eyebrow}>The Team</div>
              <div className={styles.teamProgress}>
                <strong>{String(teamActive + 1).padStart(2, "0")}</strong>
                {" / "}
                {String(TEAM.length).padStart(2, "0")}
              </div>
            </div>

            <div ref={teamTrackRef} className={styles.teamTrack}>
              {TEAM.map((m, i) => (
                <article key={m.name} className={styles.teamSlide}>
                  <div className={styles.photoCol}>
                    <img
                      src={m.photo}
                      alt={m.name}
                      className={styles.photo}
                      draggable={false}
                    />
                  </div>
                  <div className={styles.contentCol}>
                    <div className={styles.teamIdx}>
                      Member {String(i + 1).padStart(2, "0")}
                    </div>
                    <h3 className={styles.teamName}>{m.name}</h3>
                    <span className={styles.teamRole}>{m.role}</span>
                    <p className={styles.teamBio}>{m.bio}</p>
                    <div className={styles.subEyebrow}>About the Role</div>
                    <p className={styles.roleDesc}>{m.roleDesc}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.teamDots} aria-hidden>
              {TEAM.map((_, i) => (
                <div
                  key={i}
                  className={`${styles.teamDot} ${i === teamActive ? styles.teamDotActive : ""}`}
                />
              ))}
            </div>

            <div className={styles.teamHint}>Scroll ↓ to traverse</div>
          </div>
        </section>
      </main>
    </div>
  );
}
