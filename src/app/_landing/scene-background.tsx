"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 280;
const CONNECTION_DISTANCE = 2.2;
const FIELD_SIZE = 14;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ── Particle positions & velocities ─────────────────────────────────────────

function useParticleData() {
  return useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities: [number, number, number][] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * FIELD_SIZE;
      positions[i * 3 + 1] = (Math.random() - 0.5) * FIELD_SIZE;
      positions[i * 3 + 2] = (Math.random() - 0.5) * FIELD_SIZE * 0.5;
      velocities.push([
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.003,
      ]);
    }
    return { positions, velocities };
  }, []);
}

// ── Connection lines between nearby particles ────────────────────────────────

function Connections({ positions }: { positions: Float32Array }) {
  const ref = useRef<THREE.LineSegments>(null);

  const { linePositions, lineAlphas } = useMemo(() => {
    const maxLines = PARTICLE_COUNT * 4;
    return {
      linePositions: new Float32Array(maxLines * 6),
      lineAlphas: new Float32Array(maxLines * 2),
    };
  }, []);

  useFrame(() => {
    let lineIdx = 0;
    const maxLines = PARTICLE_COUNT * 4;
    for (let i = 0; i < PARTICLE_COUNT && lineIdx < maxLines; i++) {
      const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
      for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < maxLines; j++) {
        const bx = positions[j * 3], by = positions[j * 3 + 1], bz = positions[j * 3 + 2];
        const dist = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
        if (dist < CONNECTION_DISTANCE) {
          const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.35;
          linePositions[lineIdx * 6 + 0] = ax;
          linePositions[lineIdx * 6 + 1] = ay;
          linePositions[lineIdx * 6 + 2] = az;
          linePositions[lineIdx * 6 + 3] = bx;
          linePositions[lineIdx * 6 + 4] = by;
          linePositions[lineIdx * 6 + 5] = bz;
          lineAlphas[lineIdx * 2] = alpha;
          lineAlphas[lineIdx * 2 + 1] = alpha;
          lineIdx++;
        }
      }
    }
    // Clear unused segments
    for (let k = lineIdx; k < maxLines; k++) {
      linePositions.fill(0, k * 6, k * 6 + 6);
      lineAlphas.fill(0, k * 2, k * 2 + 2);
    }

    if (ref.current) {
      const geo = ref.current.geometry;
      (geo.attributes.position as THREE.BufferAttribute).array = linePositions;
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.alpha as THREE.BufferAttribute).array = lineAlphas;
      (geo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  const maxLines = PARTICLE_COUNT * 4;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(maxLines * 2), 1));
    return g;
  }, [maxLines]);

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color(0.18, 0.44, 0.93),
    transparent: true,
    opacity: 0.5,
    vertexColors: false,
  }), []);

  return <lineSegments ref={ref} geometry={geo} material={mat} />;
}

// ── Particle points ──────────────────────────────────────────────────────────

function Particles({
  data,
  reduced,
  mouse,
}: {
  data: ReturnType<typeof useParticleData>;
  reduced: boolean;
  mouse: React.MutableRefObject<[number, number]>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { positions, velocities } = data;
  const { viewport } = useThree();

  // Sizes buffer — vary particle sizes
  const sizes = useMemo(() => {
    const s = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s[i] = Math.random() * 3 + 1.5;
    }
    return s;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [positions, sizes]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0.25, 0.55, 0.98) } },
    vertexShader: `
      attribute float size;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (280.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.1, d) * 0.75;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useFrame((_, delta) => {
    if (reduced) return;

    // Drift particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3 + 0] += velocities[i][0];
      positions[i * 3 + 1] += velocities[i][1];
      positions[i * 3 + 2] += velocities[i][2];

      // Wrap around edges
      const half = FIELD_SIZE / 2;
      if (positions[i * 3] > half) positions[i * 3] = -half;
      if (positions[i * 3] < -half) positions[i * 3] = half;
      if (positions[i * 3 + 1] > half) positions[i * 3 + 1] = -half;
      if (positions[i * 3 + 1] < -half) positions[i * 3 + 1] = half;
    }

    if (pointsRef.current) {
      (pointsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Mouse parallax rotation
    if (groupRef.current) {
      const [mx, my] = mouse.current;
      groupRef.current.rotation.y += (mx * 0.3 - groupRef.current.rotation.y) * 0.04 * delta * 60;
      groupRef.current.rotation.x += (-my * 0.15 - groupRef.current.rotation.x) * 0.04 * delta * 60;
    }
  });

  void viewport;

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geo} material={mat} />
      <Connections positions={positions} />
    </group>
  );
}

// ── Scene wrapper ────────────────────────────────────────────────────────────

function Scene({ reduced }: { reduced: boolean }) {
  const mouse = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current = [
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      ];
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const data = useParticleData();

  return (
    <>
      <ambientLight intensity={0.4} />
      <Particles data={data} reduced={reduced} mouse={mouse} />
    </>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function SceneBackground() {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 9], fov: 60 }}
        gl={{ antialias: false, alpha: true }}
        dpr={Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5)}
      >
        <Scene reduced={reduced} />
      </Canvas>
    </div>
  );
}
