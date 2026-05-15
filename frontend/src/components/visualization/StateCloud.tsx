import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AssignmentPoint } from "../../api/types";
import styles from "./Visualization.module.css";

const TIMESLOT_Z_SCALE = 2.0;

interface PointCloudProps {
  assignments: AssignmentPoint[];
  maxFitness: number;
}

function PointCloud({ assignments, maxFitness }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0008;
    }
  });

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(assignments.length * 3);
    const col = new Float32Array(assignments.length * 3);

    assignments.forEach((a, i) => {
      pos[i * 3] = a.x;
      pos[i * 3 + 1] = a.y;
      pos[i * 3 + 2] = a.z * TIMESLOT_Z_SCALE;

      const normalizedZ = maxFitness > 0 ? a.z / maxFitness : 0;
      const r = Math.min(1, normalizedZ * 2);
      const g = Math.min(1, (1 - normalizedZ) * 2);
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = 0.15;
    });

    return { positions: pos, colors: col };
  }, [assignments, maxFitness]);

  if (assignments.length === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial vertexColors size={0.5} sizeAttenuation transparent opacity={0.92} />
    </points>
  );
}

interface SearchPathProps {
  centroids: [number, number, number][];
}

function SearchPath({ centroids }: SearchPathProps) {
  if (centroids.length < 2) return null;
  const points = centroids.map(
    ([x, y, z]) => new THREE.Vector3(x, y, z * TIMESLOT_Z_SCALE)
  );
  return <Line points={points} color="#e63946" lineWidth={1} transparent opacity={0.5} />;
}

function AxisLabels() {
  return (
    <>
      <Text position={[12, 0, 0]} fontSize={0.5} color="#555" font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2">X</Text>
      <Text position={[0, 12, 0]} fontSize={0.5} color="#555" font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2">Y</Text>
      <Text position={[0, 0, 12]} fontSize={0.5} color="#555" font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2">Z</Text>
    </>
  );
}

interface Props {
  assignments: AssignmentPoint[];
  searchPath: [number, number, number][];
  fitness: number;
  bestFitness: number;
  iteration: number;
}

export default function StateCloud({ assignments, searchPath, fitness, bestFitness, iteration }: Props) {
  const maxZ = useMemo(
    () => Math.max(1, ...assignments.map((a) => a.z)),
    [assignments]
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>3D State Space</h3>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Iteration</span>
            <span className={styles.statValue}>{iteration.toLocaleString()}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Current</span>
            <span className={styles.statValue}>{fitness === Infinity ? "--" : fitness.toFixed(2)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Best</span>
            <span className={styles.statValue}>{bestFitness === Infinity ? "--" : bestFitness.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className={styles.canvas}>
        <Canvas camera={{ position: [15, 15, 15], fov: 55 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={0.6} />
          <OrbitControls enableDamping dampingFactor={0.08} />
          <gridHelper args={[20, 20, "#222", "#1a1a1a"]} />
          <axesHelper args={[10]} />
          <AxisLabels />
          <PointCloud assignments={assignments} maxFitness={maxZ} />
          <SearchPath centroids={searchPath} />
        </Canvas>
      </div>
      <div className={styles.footer}>
        <span className={`${styles.legendLabel} ${styles.legendGood}`}>Optimal</span>
        <div className={styles.gradientBar} />
        <span className={`${styles.legendLabel} ${styles.legendBad}`}>Violation</span>
      </div>
    </div>
  );
}
