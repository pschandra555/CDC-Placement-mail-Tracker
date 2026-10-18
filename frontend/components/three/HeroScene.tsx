"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Lightformer, MeshDistortMaterial, RoundedBox, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// Labels drawn to a canvas texture, so no font files are fetched at runtime.
const CARDS = [
  { org: "Nimbus Labs", line: "SDE · ₹24 LPA", tag: "ELIGIBLE", c1: "#8b5cf6", c2: "#22d3ee" },
  { org: "HackVerse 2026", line: "36h · ₹3L pool", tag: "OPEN TO ALL", c1: "#a3e635", c2: "#22d3ee" },
  { org: "Quantix", line: "DS Intern · ₹60k/mo", tag: "ELIGIBLE", c1: "#22d3ee", c2: "#3b82f6" },
  { org: "Orbitra", line: "Intern + FT · 18 LPA", tag: "CLOSES 2D", c1: "#ec4899", c2: "#8b5cf6" },
  { org: "Ledgerly", line: "Backend · ₹16 LPA", tag: "DEADLINE +12H", c1: "#f59e0b", c2: "#ec4899" },
  { org: "Arcus Semi", line: "Embedded Intern", tag: "ELIGIBLE", c1: "#14b8a6", c2: "#8b5cf6" },
];

function cardTexture(c: (typeof CARDS)[number]) {
  const w = 512;
  const h = 300;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "rgba(15,17,40,0.92)");
  grad.addColorStop(1, "rgba(25,20,55,0.92)");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(0, 0, w, h, 36);
  g.fill();
  const edge = g.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, c.c1);
  edge.addColorStop(1, c.c2);
  g.strokeStyle = edge;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(3, 3, w - 6, h - 6, 34);
  g.stroke();
  // logo tile
  g.fillStyle = edge;
  g.beginPath();
  g.roundRect(36, 40, 76, 76, 18);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "bold 36px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(c.org[0], 74, 80);
  g.textAlign = "left";
  g.font = "600 40px system-ui, sans-serif";
  g.fillText(c.org, 132, 66);
  g.fillStyle = "rgba(220,225,255,0.7)";
  g.font = "28px system-ui, sans-serif";
  g.fillText(c.line, 132, 106);
  // tag pill
  g.font = "bold 24px system-ui, sans-serif";
  const tw = g.measureText(c.tag).width + 44;
  g.fillStyle = c.c1 + "33";
  g.beginPath();
  g.roundRect(36, 190, tw, 56, 28);
  g.fill();
  g.strokeStyle = c.c1;
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "#fff";
  g.fillText(c.tag, 58, 219);
  // progress line
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(w - 170, 214, 130, 8);
  g.fillStyle = edge;
  g.fillRect(w - 170, 214, 80, 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function OrbitCards() {
  const group = useRef<THREE.Group>(null!);
  const textures = useMemo(() => CARDS.map(cardTexture), []);
  const refs = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Cards rise out of the envelope during the first seconds, then orbit.
    const emerge = THREE.MathUtils.smoothstep(t, 1.2, 3.4);
    refs.current.forEach((m, i) => {
      if (!m) return;
      const a = (i / CARDS.length) * Math.PI * 2 + t * 0.22;
      const radius = 3.1 * emerge;
      const tx = Math.cos(a) * radius;
      const tz = Math.sin(a) * radius * 0.55;
      const ty = Math.sin(a * 2 + i) * 0.35 + 0.35 * emerge + (1 - emerge) * 0.2;
      m.position.set(tx, ty, tz);
      m.lookAt(state.camera.position);
      m.scale.setScalar(0.35 + 0.65 * emerge);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(1, emerge * 1.4) * (0.55 + 0.45 * ((tz / 1.7 + 1) / 2));
    });
  });

  return (
    <group ref={group}>
      {textures.map((tex, i) => (
        <mesh key={i} ref={(m) => {
            if (m) refs.current[i] = m;
          }}>
          <planeGeometry args={[1.5, 0.88]} />
          <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Envelope() {
  const flap = useRef<THREE.Group>(null!);
  const letter = useRef<THREE.Mesh>(null!);
  const flapShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.2, 0);
    s.lineTo(1.2, 0);
    s.lineTo(0, -0.95);
    s.closePath();
    return s;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const open = THREE.MathUtils.smoothstep(t, 0.3, 1.4);
    flap.current.rotation.x = -open * Math.PI * 0.92;
    const rise = THREE.MathUtils.smoothstep(t, 0.9, 2.2);
    letter.current.position.y = -0.1 + rise * 0.75 + Math.sin(t * 1.4) * 0.03 * rise;
  });

  const glass = (
    <meshPhysicalMaterial
      color="#a78bfa"
      roughness={0.08}
      metalness={0.1}
      transmission={0.9}
      thickness={0.6}
      ior={1.4}
      iridescence={1}
      iridescenceIOR={1.6}
      clearcoat={1}
      transparent
      opacity={0.95}
    />
  );

  return (
    <group position={[0, -0.25, 0]}>
      {/* letter peeking out */}
      <mesh ref={letter} position={[0, -0.1, -0.02]}>
        <planeGeometry args={[2, 1.2]} />
        <meshStandardMaterial color="#e0e7ff" emissive="#7c3aed" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <RoundedBox args={[2.4, 1.55, 0.12]} radius={0.08} smoothness={6}>
        {glass}
      </RoundedBox>
      {/* front V seam */}
      <mesh position={[0, 0.05, 0.07]}>
        <torusGeometry args={[0.9, 0.012, 8, 3, Math.PI]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      <group ref={flap} position={[0, 0.775, 0.06]}>
        <mesh>
          <extrudeGeometry args={[flapShape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }]} />
          {glass}
        </mesh>
      </group>
      {/* glowing edge light */}
      <pointLight position={[0, 0.9, 0.6]} intensity={6} color="#22d3ee" distance={4} />
    </group>
  );
}

function Rig() {
  const { camera, pointer } = useThree();
  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.9, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.4 + pointer.y * 0.5, 0.04);
    camera.lookAt(0, 0.1, 0);
  });
  return null;
}

function Rings() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, d) => {
    ref.current.rotation.z += d * 0.08;
    ref.current.rotation.y += d * 0.05;
  });
  return (
    <group ref={ref} rotation={[Math.PI / 2.4, 0, 0]}>
      {[2.3, 3.1, 3.9].map((r, i) => (
        <mesh key={r} rotation={[0, 0, i]}>
          <torusGeometry args={[r, 0.006, 8, 160]} />
          <meshBasicMaterial color={["#8b5cf6", "#22d3ee", "#ec4899"][i]} transparent opacity={0.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 6.5], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} color="#c4b5fd" />
      <directionalLight position={[-4, -2, 2]} intensity={0.8} color="#22d3ee" />

      {/* iridescent orb behind the envelope */}
      <mesh position={[0, 0.2, -2.2]} scale={1.9}>
        <icosahedronGeometry args={[1, 32]} />
        <MeshDistortMaterial color="#6d28d9" emissive="#3b0764" emissiveIntensity={0.25} roughness={0.05} metalness={0.9} distort={0.38} speed={1.6} />
      </mesh>

      <Float speed={1.6} rotationIntensity={0.35} floatIntensity={0.8}>
        <Envelope />
      </Float>
      <OrbitCards />
      <Rings />
      <Sparkles count={120} scale={[12, 7, 6]} size={2.2} speed={0.35} color="#c4b5fd" opacity={0.7} />
      <Sparkles count={60} scale={[10, 6, 4]} size={3} speed={0.25} color="#22d3ee" opacity={0.6} />

      {/* Local lightformers: reflections without downloading an HDR file */}
      <Environment resolution={256}>
        <Lightformer form="ring" intensity={3} color="#8b5cf6" position={[0, 3, -4]} scale={4} />
        <Lightformer form="rect" intensity={2.5} color="#22d3ee" position={[-5, 0, 2]} scale={[2, 6, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#ec4899" position={[5, 1, 2]} scale={[2, 6, 1]} />
        <Lightformer form="circle" intensity={2} color="#ffffff" position={[0, 5, 3]} scale={2} />
      </Environment>
      <Rig />
    </Canvas>
  );
}
