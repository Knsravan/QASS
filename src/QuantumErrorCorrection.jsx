// QUANTUM ERROR CORRECTION MODULE — Cinematic 7-Step Story Experience
// 3-Qubit Bit-Flip Repetition Code Visualizer
// Architecture mirrors NoCloning.jsx / Decoherence.jsx
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { BlockMath, InlineMath } from 'react-katex';
import { QubitCore } from './BlochSphere';
import CameraShifter from './CameraShifter';
import { useQECAudio } from './useQECAudio';
import { QuantumNavButtons } from './QuantumNavButtons';
import { SCENE_GL } from './sceneGl';
import { QualityComposer } from './QualityScene';
import { SharedCanvas } from './SharedCanvas';


// ─── Color Palette ────────────────────────────────────────────────────────────
const CI = '#6366f1';   // Indigo  — healthy data qubit
const CI2 = '#818cf8';  // Indigo light — ring
const CA = '#f59e0b';   // Amber   — ancilla qubit
const CA2 = '#fbbf24';  // Amber light
const CE = '#ef4444';   // Red     — error / corrupted
const CE2 = '#fca5a5';  // Red light
const CG = '#22c55e';   // Green   — corrected / restored
const CG2 = '#4ade80';  // Green light

// ─── Scene Positions ─────────────────────────────────────────────────────────
const POS_Q1 = [-10.5, 1.2, 0];
const POS_Q2 = [0, 1.2, 0];
const POS_Q3 = [10.5, 1.2, 0];
const POS_A1 = [-5.25, -7.5, 0]; // Centered between Q1 and Q2
const POS_A2 = [5.25, -7.5, 0];  // Centered between Q2 and Q3

// ─── 7 Steps ─────────────────────────────────────────────────────────────────
const QEC_STEPS = [
  {
    id: 'intro',
    title: 'The Problem: Qubits are Fragile',
    emoji: '⚡',
    analogy: 'Imagine whispering a secret message across a noisy room. One bad noise and the message is gone forever.',
    math: String.raw`X |\psi\rangle = \alpha|1\rangle + \beta|0\rangle \quad \leftarrow \text{Bit-flip error}`,
    insight: 'A single bit-flip destroys the entire quantum state — we need armor.',
    color: CE,
  },
  {
    id: 'encode',
    title: 'Logical Encoding: The 3-Qubit Shield',
    emoji: '🛡️',
    analogy: 'Say "Yes" three times — if autocorrect changes one to "Yos", the other two "Yes" votes win. That\'s majority voting!',
    math: String.raw`|0_L\rangle = |000\rangle, \quad |1_L\rangle = |111\rangle`,
    insight: 'One logical qubit becomes THREE physical qubits — redundantly encoded for protection (a superposition α|0⟩+β|1⟩ would become the entangled state α|000⟩+β|111⟩).',
    color: CI,
  },
  {
    id: 'noise',
    title: 'Error Strikes! Cosmic Ray Hits Q₁',
    emoji: '☄️',
    analogy: 'A cosmic ray zaps one qubit in the chain — flipping it from |0⟩ to |1⟩. But which one? We can\'t just look!',
    math: String.raw`X_1 |000\rangle = |100\rangle \quad \leftarrow \text{error on } Q_1`,
    insight: 'Measuring the qubits directly would collapse them. We need a smarter way to find the error.',
    color: CE,
  },
  {
    id: 'syndrome_1',
    title: 'Parity Check 1: Are Q₁ and Q₂ the Same?',
    emoji: '🔬',
    analogy: 'Instead of "what is the value of the test?", ask "are test 1 and test 2 different?" — no collapse!',
    math: String.raw`s_1 = Q_1 \oplus Q_2 = \langle Z_1 Z_2 \rangle`,
    insight: 'Ancilla A₁ secretly reads the DIFFERENCE between Q₁ and Q₂ — without touching their actual values.',
    color: CA,
  },
  {
    id: 'syndrome_2',
    title: 'Parity Check 2: Are Q₂ and Q₃ the Same?',
    emoji: '🔭',
    analogy: 'Now ask "are test 2 and test 3 different?" The two answers together point to exactly which one failed.',
    math: String.raw`s_2 = Q_2 \oplus Q_3 = \langle Z_2 Z_3 \rangle`,
    insight: 'Ancilla A₂ checks Q₂ vs Q₃. Together s₁ and s₂ form a 2-bit "address" of the error location.',
    color: CA,
  },
  {
    id: 'decode',
    title: 'Error Located — Syndrome Decoded!',
    emoji: '🎯',
    analogy: 'Two yes/no answers tell us EXACTLY which friend got the message wrong — like binary GPS!',
    math: String.raw`\begin{cases} s_1{=}1,\ s_2{=}0 & \Rightarrow X_1 \text{ (fix Q}_1\text{)} \\ s_1{=}1,\ s_2{=}1 & \Rightarrow X_2 \text{ (fix Q}_2\text{)} \\ s_1{=}0,\ s_2{=}1 & \Rightarrow X_3 \text{ (fix Q}_3\text{)} \end{cases}`,
    insight: 'The syndrome (s₁, s₂) is a precise error address. No data was read — only the parity was checked.',
    color: CE,
  },
  {
    id: 'correct',
    title: 'Restored! The Logical Qubit Survives ✓',
    emoji: '✅',
    analogy: 'We flip the one wrong answer back — "Yos" becomes "Yes" again. Message perfectly recovered!',
    math: String.raw`X_1|100\rangle = |000\rangle \quad \checkmark \quad \text{Logical qubit intact!}`,
    insight: 'The X gate fires on Q₁ only. All 3 qubits align — the logical state is 100% recovered.',
    color: CG,
  },
];

// ─── Dynamic Step Generator based on selected errorQubit ─────────────────────
const getQECStep = (stepIndex, errorQubit = 0) => {
  const step = QEC_STEPS[stepIndex];
  if (!step) return null;
  const qNum = errorQubit + 1;

  if (step.id === 'noise') {
    return {
      ...step,
      title: `Error Strikes! Cosmic Ray Hits Q${qNum}`,
      math: errorQubit === 0
        ? String.raw`X_1 |000\rangle = |100\rangle \quad \leftarrow \text{error on } Q_1`
        : errorQubit === 1
          ? String.raw`X_2 |000\rangle = |010\rangle \quad \leftarrow \text{error on } Q_2`
          : String.raw`X_3 |000\rangle = |001\rangle \quad \leftarrow \text{error on } Q_3`,
      analogy: `A cosmic ray zaps Qubit ${qNum} in the chain — flipping it from |0⟩ to |1⟩. But which one? We can't just look!`,
    };
  }

  if (step.id === 'syndrome_1') {
    const s1Val = errorQubit <= 1 ? 1 : 0;
    return {
      ...step,
      math: errorQubit === 0
        ? String.raw`s_1 = Q_1 \oplus Q_2 = 1 \oplus 0 = 1 \quad (\text{Mismatch!})`
        : errorQubit === 1
          ? String.raw`s_1 = Q_1 \oplus Q_2 = 0 \oplus 1 = 1 \quad (\text{Mismatch!})`
          : String.raw`s_1 = Q_1 \oplus Q_2 = 0 \oplus 0 = 0 \quad (\text{Parity match } \checkmark)`,
      insight: s1Val === 1
        ? `Ancilla A₁ reads s₁ = 1 — detecting that Q₁ and Q₂ differ! But which one flipped?`
        : `Ancilla A₁ reads s₁ = 0 — confirming Q₁ and Q₂ match! The error must be on Q₃.`,
    };
  }

  if (step.id === 'syndrome_2') {
    const s2Val = errorQubit >= 1 ? 1 : 0;
    return {
      ...step,
      math: errorQubit === 0
        ? String.raw`s_2 = Q_2 \oplus Q_3 = 0 \oplus 0 = 0 \quad (\text{Parity match } \checkmark)`
        : errorQubit === 1
          ? String.raw`s_2 = Q_2 \oplus Q_3 = 1 \oplus 0 = 1 \quad (\text{Mismatch!})`
          : String.raw`s_2 = Q_2 \oplus Q_3 = 0 \oplus 1 = 1 \quad (\text{Mismatch!})`,
      insight: s2Val === 1
        ? `Ancilla A₂ reads s₂ = 1 — detecting that Q₂ and Q₃ differ!`
        : `Ancilla A₂ reads s₂ = 0 — confirming Q₂ and Q₃ match!`,
    };
  }

  if (step.id === 'correct') {
    return {
      ...step,
      math: errorQubit === 0
        ? String.raw`X_1|100\rangle = |000\rangle \quad \checkmark \quad \text{Logical qubit intact!}`
        : errorQubit === 1
          ? String.raw`X_2|010\rangle = |000\rangle \quad \checkmark \quad \text{Logical qubit intact!}`
          : String.raw`X_3|001\rangle = |000\rangle \quad \checkmark \quad \text{Logical qubit intact!}`,
      insight: `The X gate fires on Q${qNum} only. All 3 qubits align — the logical state is 100% recovered.`,
    };
  }

  return step;
};

// ─── Syndrome Truth Table ─────────────────────────────────────────────────────
// errorQubit: 0=Q1, 1=Q2, 2=Q3
const SYNDROME_TABLE = {
  0: { s1: 1, s2: 0, label: 'Error on Q₁' },
  1: { s1: 1, s2: 1, label: 'Error on Q₂' },
  2: { s1: 0, s2: 1, label: 'Error on Q₃' },
};

// ─── Camera Waypoints ─────────────────────────────────────────────────────────
const CAM = {
  intro: { pos: [0, 1.8, 34], look: [0, 0.6, 0] },
  encode: { pos: [0, 2.2, 32], look: [0, 0.8, 0] },
  noise: { pos: [-5.5, 1.8, 26], look: [-10.5, 0.8, 0] },
  syndrome_1: { pos: [-3.0, -1.8, 34], look: [-3.0, -3.2, 0] },
  syndrome_2: { pos: [3.0, -1.8, 34], look: [3.0, -3.2, 0] },
  decode: { pos: [0, -1.8, 36], look: [0, -3.2, 0] },
  correct: { pos: [0, -1.8, 36], look: [0, -3.2, 0] },
};

// =============================================================================
// 1. DRONE CAMERA CONTROLLER
// =============================================================================
function QECDroneCamera({ step, errorQubit = 0, orbitRef, audio, isExpanded = false }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(...CAM.intro.pos));
  const targetLook = useRef(new THREE.Vector3(...CAM.intro.look));
  const smoothLook = useRef(new THREE.Vector3(0, 0, 0));
  const prevStep = useRef(step);
  const prevErrorQubit = useRef(errorQubit);

  useEffect(() => {
    let wp = CAM[step] || CAM.intro;
    if (step === 'noise') {
      if (errorQubit === 0) {
        wp = { pos: [-5.5, 1.8, 25], look: [-10.5, 0.8, 0] };
      } else if (errorQubit === 1) {
        wp = { pos: [0.0, 1.8, 25], look: [0, 0.8, 0] };
      } else {
        wp = { pos: [5.5, 1.8, 25], look: [10.5, 0.8, 0] };
      }
    }

    // Dynamic horizontal & vertical framing offset (moves 3D scene smoothly rightward to clear top-left Notation card)
    const X_OFFSET = -2.2;
    const yShift = isExpanded ? (['syndrome_1', 'syndrome_2', 'decode', 'correct'].includes(step) ? -3.2 : -1.0) : 0;
    const zShift = isExpanded ? (['syndrome_1', 'syndrome_2', 'decode', 'correct'].includes(step) ? 6.5 : 3.0) : 0;

    targetPos.current.set(wp.pos[0] + X_OFFSET, wp.pos[1] + yShift, wp.pos[2] + zShift);
    targetLook.current.set(wp.look[0] + X_OFFSET, wp.look[1] + yShift, wp.look[2]);

    if (prevStep.current !== step || (step === 'noise' && prevErrorQubit.current !== errorQubit)) {
      audio?.playCameraPan?.(1.6);
      prevStep.current = step;
      prevErrorQubit.current = errorQubit;
    }
  }, [step, errorQubit, audio, isExpanded]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const wobY = Math.sin(t * 1.3) * 0.04;
    const wobX = Math.cos(t * 0.95) * 0.025;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.current.x + wobX, 2.0, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.current.y + wobY, 2.0, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.current.z, 2.0, delta);

    smoothLook.current.x = THREE.MathUtils.damp(smoothLook.current.x, targetLook.current.x, 2.6, delta);
    smoothLook.current.y = THREE.MathUtils.damp(smoothLook.current.y, targetLook.current.y, 2.6, delta);
    smoothLook.current.z = THREE.MathUtils.damp(smoothLook.current.z, targetLook.current.z, 2.6, delta);

    if (orbitRef.current) {
      orbitRef.current.target.copy(smoothLook.current);
      orbitRef.current.update();
    } else {
      camera.lookAt(smoothLook.current);
    }
  });
  return null;
}

// =============================================================================
// 2. CNOT TETHER BEAM (Data Qubit → Ancilla)
// =============================================================================
function CNOTBeam({ from, to, active, color = CI, isMeasured = false }) {
  const coreRef = useRef();
  const glowRef = useRef();
  const particlesRef = useRef([]);
  const N = 22;

  const fromVec = new THREE.Vector3(...from);
  const toVec = new THREE.Vector3(...to);
  const midPoint = fromVec.clone().add(toVec).multiplyScalar(0.5);
  const dist = fromVec.distanceTo(toVec);
  const dir = toVec.clone().sub(fromVec).normalize();
  const angle = Math.atan2(dir.x, dir.y);

  const particleData = useRef(
    Array.from({ length: N }, (_, i) => ({
      progress: i / N,
      speed: 0.7 + (i % 4) * 0.15,
      radius: 0.08 + (i % 3) * 0.04,
      angle: (i / N) * Math.PI * 5,
      size: 0.03 + (i % 3) * 0.015,
    }))
  ).current;

  const _perp = useRef(new THREE.Vector3());
  const _pos = useRef(new THREE.Vector3());

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!active || isMeasured) return;

    if (coreRef.current) {
      coreRef.current.material.opacity = 0.7 + Math.sin(t * 7) * 0.15;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.3 + Math.sin(t * 5) * 0.12;
    }

    particleData.forEach((p, i) => {
      p.progress = (p.progress + delta * p.speed) % 1;
      const mesh = particlesRef.current[i];
      if (!mesh) return;
      _pos.current.copy(fromVec).lerp(toVec, p.progress);
      const localAngle = p.angle + t * 5;
      _perp.current.set(-dir.y, dir.x, 0).normalize();
      _pos.current.addScaledVector(_perp.current, Math.sin(localAngle) * p.radius);
      _pos.current.z += Math.cos(localAngle) * p.radius;
      mesh.position.copy(_pos.current);
      mesh.material.opacity = Math.sin(p.progress * Math.PI) * 0.9;
    });
  });

  if (!active) return null;

  return (
    <group renderOrder={20}>
      <mesh
        ref={coreRef}
        position={[midPoint.x, midPoint.y, midPoint.z]}
        rotation={[0, 0, -angle]}
      >
        <cylinderGeometry args={[0.045, 0.045, dist, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh
        ref={glowRef}
        position={[midPoint.x, midPoint.y, midPoint.z]}
        rotation={[0, 0, -angle]}
      >
        <cylinderGeometry args={[0.16, 0.16, dist, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={8} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
      </mesh>
      {!isMeasured && particleData.map((p, i) => (
        <mesh key={i} ref={el => (particlesRef.current[i] = el)}>
          <sphereGeometry args={[p.size * 1.4, 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={8}
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// =============================================================================
// 3. NOISE PARTICLE BURST (Cosmic Ray Strike)
// =============================================================================
function NoiseParticleBurst({ active, origin }) {
  const meshRef = useRef();
  const ringRef = useRef();
  const lastOriginStr = useRef('');

  useEffect(() => {
    const mesh = meshRef.current;
    const ring = ringRef.current;
    const killTweens = () => {
      lastOriginStr.current = '';
      if (mesh) {
        gsap.killTweensOf(mesh.scale);
        gsap.killTweensOf(mesh.material);
      }
      if (ring) {
        gsap.killTweensOf(ring.scale);
        gsap.killTweensOf(ring.material);
      }
    };

    if (!active) {
      lastOriginStr.current = '';
      return killTweens;
    }
    const currentOrigin = (origin || []).join(',');
    if (lastOriginStr.current === currentOrigin && lastOriginStr.current !== '') return killTweens;
    lastOriginStr.current = currentOrigin;

    if (mesh) {
      gsap.killTweensOf(mesh.scale);
      gsap.killTweensOf(mesh.material);
      mesh.scale.set(0.1, 0.1, 0.1);
      mesh.material.opacity = 1;
      gsap.to(mesh.scale, { x: 4.0, y: 4.0, z: 4.0, duration: 0.55, ease: 'power2.out' });
      gsap.to(mesh.material, { opacity: 0, duration: 0.55, ease: 'power2.out' });
    }
    if (ring) {
      gsap.killTweensOf(ring.scale);
      gsap.killTweensOf(ring.material);
      ring.scale.set(0.1, 0.1, 0.1);
      ring.material.opacity = 1;
      gsap.to(ring.scale, { x: 7.5, y: 7.5, z: 7.5, duration: 0.85, ease: 'power2.out' });
      gsap.to(ring.material, { opacity: 0, duration: 0.85, ease: 'power2.out', delay: 0.1 });
    }
    return killTweens;
  }, [active, origin]);

  if (!active) return null;

  return (
    <group position={origin}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.9, 20, 20]} />
        <meshStandardMaterial color={CE} emissive={CE} emissiveIntensity={8} transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.05, 14, 64]} />
        <meshStandardMaterial color={CE2} emissive={CE} emissiveIntensity={10} transparent opacity={1} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// =============================================================================
// 4. RESTORATION FLASH (green victory ring on corrected qubit)
// =============================================================================
function RestorationFlash({ active, origin }) {
  const ringRef = useRef();
  const hasFired = useRef(false);

  useEffect(() => {
    const ring = ringRef.current;
    const killTweens = () => {
      hasFired.current = false;
      if (ring) {
        gsap.killTweensOf(ring.scale);
        gsap.killTweensOf(ring.material);
      }
    };

    if (!active) { hasFired.current = false; return killTweens; }
    if (hasFired.current) return killTweens;
    hasFired.current = true;

    if (ring) {
      ring.scale.set(0.1, 0.1, 0.1);
      ring.material.opacity = 1;
      gsap.to(ring.scale, { x: 7, y: 7, z: 7, duration: 1.1, ease: 'power2.out' });
      gsap.to(ring.material, { opacity: 0, duration: 1.1, ease: 'power2.out', delay: 0.2 });
    }
    return killTweens;
  }, [active]);

  if (!active) return null;

  return (
    <group position={origin}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.06, 14, 64]} />
        <meshStandardMaterial color={CG2} emissive={CG} emissiveIntensity={10} transparent opacity={1} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// =============================================================================
// 6. MAIN QEC SCENE (Three.js Canvas Content)
// =============================================================================
function QECScene({ step, errorQubit, onErrorQubitChange, theme, isSidebarOpen, isExpanded, audio }) {
  const orbitRef = useRef();
  const isLight = theme === 'light';

  const syndrome = SYNDROME_TABLE[errorQubit] || SYNDROME_TABLE[0];
  const isError = ['noise', 'syndrome_1', 'syndrome_2', 'decode'].includes(step);
  const isCorrected = step === 'correct';

  // State vector quaternions
  const quatUp = new THREE.Quaternion(); // |0⟩ — north pole
  const quatDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); // |1⟩ — south pole

  const getDataQubitGrid = (idx) => {
    if (isCorrected) return CG;
    if (isError && idx === errorQubit) return CE;
    if (step === 'intro' && idx === errorQubit) return CE;
    if (step === 'encode') return CI;
    return CI;
  };

  const getDataQubitRing = (idx) => {
    if (isCorrected) return CG2;
    if (isError && idx === errorQubit) return CE2;
    if (step === 'intro' && idx === errorQubit) return CE2;
    return CI2;
  };

  const getDataQubitEmissive = (idx) => {
    if (isCorrected) return CG;
    if (isError && idx === errorQubit) return CE;
    if (step === 'intro' && idx === errorQubit) return CE;
    return CI;
  };

  const getVectorQuat = (idx) => {
    if (isError && idx === errorQubit) return quatDown;
    if (isCorrected) return quatUp;
    return quatUp;
  };

  const dataPositions = [POS_Q1, POS_Q2, POS_Q3];

  // Tether & Ancilla visibility
  const showEncodeBeams = ['encode', 'noise', 'syndrome_1', 'syndrome_2', 'decode', 'correct'].includes(step);
  const showAncillaBeam1 = ['syndrome_1', 'syndrome_2', 'decode', 'correct'].includes(step);
  const showAncillaBeam2 = ['syndrome_2', 'decode', 'correct'].includes(step);
  const showAncilla1 = ['syndrome_1', 'syndrome_2', 'decode', 'correct'].includes(step);
  const showAncilla2 = ['syndrome_2', 'decode', 'correct'].includes(step);

  const ancilla1Syndrome = showAncillaBeam1 ? syndrome.s1 : null;
  const ancilla2Syndrome = showAncillaBeam2 ? syndrome.s2 : null;

  return (
    <>
      <QECDroneCamera step={step} errorQubit={errorQubit} orbitRef={orbitRef} audio={audio} isExpanded={isExpanded} />

      <OrbitControls
        ref={orbitRef}
        makeDefault
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={45}
      />

      <QualityComposer disableNormalPass multisampling={0}>
        <Bloom luminanceThreshold={0.22} mipmapBlur intensity={0.65} />
      </QualityComposer>

      <ambientLight intensity={isLight ? 0.9 : 0.5} />
      <pointLight position={[-12, 10, 10]} color={CI} intensity={isLight ? 16 : 10} distance={40} />
      <pointLight position={[12, 10, 10]} color={CA} intensity={isLight ? 10 : 6} distance={40} />
      <pointLight position={[0, -14, 12]} color="#ffffff" intensity={2.5} distance={30} />

      {/* ─── 3 DATA QUBITS ─────────────────────────────────────────────────── */}
      {dataPositions.map((pos, idx) => {
        const isErrorQubit = isError && idx === errorQubit;
        const isTarget = (step === 'intro' && idx === errorQubit) || isErrorQubit;
        const gridColor = getDataQubitGrid(idx);
        const ringColor = getDataQubitRing(idx);
        const emissiveColor = getDataQubitEmissive(idx);

        return (
          <group key={idx} position={pos}>
            <QubitCore
              theme={theme}
              activeModule="error-correction"
              superpositionStep={-1}
              customVectorQuat={getVectorQuat(idx)}
              showCustomVector={true}
              customGridColor={gridColor}
              customRingColor={ringColor}
              emissiveColor={emissiveColor}
              scale={2.2}
            />
            {/* Interactive Floating Label with Custom Target Highlight */}
            <Html center position={[0, 5.8, 0]} zIndexRange={[60, 0]}>
              <div
                onClick={() => {
                  if (['intro', 'encode', 'noise'].includes(step) && onErrorQubitChange) {
                    onErrorQubitChange(idx);
                  }
                }}
                style={{
                  padding: '5px 16px',
                  borderRadius: '22px',
                  background: isTarget
                    ? 'rgba(239, 68, 68, 0.25)'
                    : (isCorrected ? 'rgba(34, 197, 94, 0.22)' : 'rgba(15, 23, 42, 0.90)'),
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: isCorrected
                    ? `1.5px solid ${CG}`
                    : (isTarget
                      ? `1.5px solid ${CE}`
                      : `1.5px solid ${CI}80`),
                  color: isCorrected
                    ? CG2
                    : (isTarget ? CE2 : CI2),
                  fontSize: '12px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  boxShadow: isTarget
                    ? `0 0 28px ${CE}99, 0 0 10px ${CE}`
                    : (isCorrected ? `0 0 22px ${CG}80` : `0 0 16px ${CI}45`),
                  transform: isTarget ? 'scale(1.12)' : 'scale(1)',
                  cursor: ['intro', 'encode', 'noise'].includes(step) ? 'pointer' : 'default',
                  pointerEvents: 'auto',
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  fontFamily: "'Inter', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  userSelect: 'none',
                }}
                title={['intro', 'encode', 'noise'].includes(step) ? `Click to target Q${idx + 1}` : undefined}
              >
                {isCorrected ? (
                  <span>Q{idx + 1} ✓ |0⟩</span>
                ) : (isError && idx === errorQubit) ? (
                  <span>Q{idx + 1} ⚠ ERROR</span>
                ) : (step === 'encode') ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    Q{idx + 1} 🛡️ <InlineMath math="|0_L\rangle" />
                  </span>
                ) : (step === 'intro' && idx === errorQubit) ? (
                  <span>Q{idx + 1} 🎯 TARGET |0⟩</span>
                ) : (
                  <span>Q{idx + 1} |0⟩</span>
                )}
              </div>
            </Html>

            {/* Restoration flash on corrected qubit */}
            {isCorrected && idx === errorQubit && (
              <RestorationFlash active={isCorrected} origin={[0, 0, 0]} />
            )}
          </group>
        );
      })}

      {/* ─── NOISE BURST on error qubit ─────────────────────────────────────── */}
      <NoiseParticleBurst
        active={step === 'noise'}
        origin={dataPositions[errorQubit]}
      />

      {/* ─── CNOT TETHERS BETWEEN DATA QUBITS (encoding) ────────────────────── */}
      {showEncodeBeams && (
        <>
          <CNOTBeam
            from={POS_Q1} to={POS_Q2}
            active={true}
            color={isCorrected ? CG : (isError && errorQubit <= 1 ? CE : CI)}
            isMeasured={false}
          />
          <CNOTBeam
            from={POS_Q2} to={POS_Q3}
            active={true}
            color={isCorrected ? CG : (isError && errorQubit >= 1 ? CE : CI)}
            isMeasured={false}
          />
        </>
      )}

      {/* ─── ANCILLA QUBITS + SYNDROME BEAMS ────────────────────────────────── */}
      {showAncilla1 && (
        <group position={POS_A1}>
          <QubitCore
            theme={theme}
            activeModule="error-correction"
            superpositionStep={-1}
            customVectorQuat={ancilla1Syndrome === 1 ? quatDown : quatUp}
            showCustomVector={true}
            customGridColor={ancilla1Syndrome === 1 ? CE : CA}
            customRingColor={ancilla1Syndrome === 1 ? CE2 : CA2}
            emissiveColor={ancilla1Syndrome === 1 ? CE : CA}
            scale={1.6}
          />
          <Html center position={[0, 4.4, 0]} zIndexRange={[60, 0]}>
            <div style={{
              padding: '4px 14px',
              borderRadius: '16px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: `1.5px solid ${ancilla1Syndrome === 1 ? CE : CA}80`,
              color: ancilla1Syndrome === 1 ? CE2 : CA2,
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              boxShadow: `0 0 14px ${ancilla1Syndrome === 1 ? CE : CA}40`,
              pointerEvents: 'none',
              fontFamily: "'Inter', sans-serif",
            }}>
              {showAncillaBeam1
                ? `A₁ — s₁ = ${ancilla1Syndrome}`
                : 'A₁ — Ancilla'}
            </div>
          </Html>
        </group>
      )}

      {showAncilla2 && (
        <group position={POS_A2}>
          <QubitCore
            theme={theme}
            activeModule="error-correction"
            superpositionStep={-1}
            customVectorQuat={ancilla2Syndrome === 1 ? quatDown : quatUp}
            showCustomVector={true}
            customGridColor={ancilla2Syndrome === 1 ? CE : CA}
            customRingColor={ancilla2Syndrome === 1 ? CE2 : CA2}
            emissiveColor={ancilla2Syndrome === 1 ? CE : CA}
            scale={1.6}
          />
          <Html center position={[0, 4.4, 0]} zIndexRange={[60, 0]}>
            <div style={{
              padding: '4px 14px',
              borderRadius: '16px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: `1.5px solid ${ancilla2Syndrome === 1 ? CE : CA}80`,
              color: ancilla2Syndrome === 1 ? CE2 : CA2,
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              boxShadow: `0 0 14px ${ancilla2Syndrome === 1 ? CE : CA}40`,
              pointerEvents: 'none',
              fontFamily: "'Inter', sans-serif",
            }}>
              {showAncillaBeam2
                ? `A₂ — s₂ = ${ancilla2Syndrome}`
                : 'A₂ — Ancilla'}
            </div>
          </Html>
        </group>
      )}

      {/* Beams: Q2 → A1 and Q1 → A1 (parity check Q1-Q2) */}
      {showAncillaBeam1 && (
        <>
          <CNOTBeam from={POS_Q2} to={POS_A1} active={true} color={ancilla1Syndrome === 1 ? CE : CA} />
          <CNOTBeam from={POS_Q1} to={POS_A1} active={true} color={ancilla1Syndrome === 1 ? CE : CA} />
        </>
      )}

      {/* Beams: Q2 → A2 and Q3 → A2 (parity check Q2-Q3) */}
      {showAncillaBeam2 && (
        <>
          <CNOTBeam from={POS_Q2} to={POS_A2} active={true} color={ancilla2Syndrome === 1 ? CE : CA} />
          <CNOTBeam from={POS_Q3} to={POS_A2} active={true} color={ancilla2Syndrome === 1 ? CE : CA} />
        </>
      )}

    </>
  );
}

// =============================================================================
// 7. STEP BOTTOM PANEL (2D Overlay — Compact, 3D-space preserving)
// =============================================================================
function QECStepPanel({ stepData, stepIndex, totalSteps, errorQubit, onErrorQubitChange, isLight, isExpanded, onToggleExpand }) {
  if (!stepData) return null;

  const accent = stepData.color || CI;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 200,
    }}>
      <div className="glass-interactive" style={{
        width: 'min(640px, calc(100% - 240px))',
        background: 'var(--glass-bg-base)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : `1.5px solid ${accent}55`,
        borderRadius: '26px',
        boxShadow: isLight
          ? 'inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 20px 48px -10px rgba(0,0,0,0.15)'
          : `var(--glass-highlight), var(--glass-shadow-base)`,
        pointerEvents: 'auto',
        animation: 'qecPanelEnter 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Progress bar — top edge */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', borderRadius: '18px 18px 0 0', background: 'rgba(255,255,255,0.05)' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: '18px 18px 0 0',
            background: `linear-gradient(90deg, ${accent}, ${accent}bb)`,
            transition: 'width 0.5s ease', boxShadow: `0 0 10px ${accent}80`,
          }} />
        </div>

        {/* ── COMPACT STRIP (always visible) ──────────────────────────────── */}
        <div style={{ padding: '12px 18px 12px 16px' }}>
          {/* Top row: Title + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{stepData.emoji}</span>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stepData.title}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Error qubit selector */}
              {(stepIndex === 0 || stepIndex === 2) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}>☄️ Strike:</span>
                  {[0, 1, 2].map(q => (
                    <button
                      key={q}
                      onClick={(e) => { e.stopPropagation(); onErrorQubitChange(q); }}
                      style={{
                        padding: '3px 8px', borderRadius: '7px', cursor: 'pointer',
                        border: errorQubit === q ? `1.5px solid ${CE}` : '1px solid rgba(255,255,255,0.12)',
                        background: errorQubit === q ? `${CE}28` : 'rgba(255,255,255,0.05)',
                        color: errorQubit === q ? CE2 : '#94a3b8',
                        fontSize: '10.5px', fontWeight: 700, transition: 'all 0.2s',
                      }}
                    >
                      Q{q + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Step counter */}
              <div style={{
                padding: '3px 8px', borderRadius: '8px',
                background: `${accent}20`, border: `1px solid ${accent}50`,
                fontSize: '10.5px', fontWeight: 700, color: accent,
              }}>
                {String(stepIndex + 1).padStart(2, '0')}/{String(totalSteps).padStart(2, '0')}
              </div>

              {/* Expand toggle */}
              <button
                className="glass-btn glass-interactive"
                onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                style={{
                  padding: '5px 13px', borderRadius: '999px',
                  background: isExpanded ? `${accent}25` : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${isExpanded ? accent + '70' : 'rgba(255,255,255,0.18)'}`,
                  color: isExpanded ? accent : '#cbd5e1',
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)',
                }}
                title={isExpanded ? 'Collapse panel' : 'See analogy & math'}
              >
                <span style={{
                  fontSize: '9px',
                  display: 'inline-block',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                  ▲
                </span>
                <span>{isExpanded ? 'Less' : 'More'}</span>
              </button>
            </div>
          </div>

          {/* Subtitle row: Key Insight (Full text with zero cutoff) */}
          <div style={{
            fontSize: '11.5px',
            color: '#94a3b8',
            marginTop: '5px',
            lineHeight: 1.45,
            paddingLeft: '30px',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px'
          }}>
            <span style={{ color: accent, fontWeight: '700' }}>🔑</span>
            <span style={{ color: '#cbd5e1' }}>{stepData.insight}</span>
          </div>
        </div>

        {/* ── EXPANDED DETAIL AREA WITH ULTRA SMOOTH TRANSITION ───────────── */}
        <div style={{
          maxHeight: isExpanded ? '380px' : '0px',
          opacity: isExpanded ? 1 : 0,
          transform: isExpanded ? 'translateY(0)' : 'translateY(-8px)',
          overflow: 'hidden',
          transition: 'max-height 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
          borderTop: isExpanded ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        }}>
          <div style={{ padding: '4px 18px 16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              {/* Analogy */}
              <div style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', padding: '12px 14px',
              }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, letterSpacing: '1.2px', marginBottom: '6px' }}>
                  💡 ANALOGY
                </div>
                <p style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.55, margin: 0 }}>
                  {stepData.analogy}
                </p>
              </div>

              {/* Math */}
              <div style={{
                background: `${accent}0c`, border: `1px solid ${accent}30`,
                borderRadius: '12px', padding: '12px 14px',
              }}>
                <div style={{ fontSize: '10px', color: accent, fontWeight: 800, letterSpacing: '1.2px', marginBottom: '6px' }}>
                  ∑ MATH
                </div>
                <div style={{ fontSize: '12px', color: '#f8fafc', overflowX: 'auto', overflowY: 'hidden' }}>
                  <BlockMath math={stepData.math} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 7.6 TOP-RIGHT SYNDROME TABLE CARD (Decodes s1, s2 in Step 6 & 7)
// =============================================================================
function QECSyndromeTableCard({ isLight, step, errorQubit = 0, onErrorQubitChange }) {
  if (step !== 'decode' && step !== 'correct') return null;

  return (
    <div className="glass-interactive" style={{
      position: 'absolute',
      top: '24px',
      right: '24px',
      width: '240px',
      background: 'var(--glass-bg-base)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : `1.5px solid ${step === 'correct' ? CG : CE}65`,
      borderRadius: '24px',
      padding: '14px 16px',
      boxShadow: isLight
        ? 'inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 16px 36px -8px rgba(0,0,0,0.12)'
        : `var(--glass-highlight), var(--glass-shadow-base)`,
      pointerEvents: 'auto',
      zIndex: 100,
      animation: 'qecSyndromePop 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '9.5px',
        fontWeight: '800',
        letterSpacing: '1.4px',
        color: isLight ? '#475569' : '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: '8px',
      }}>
        <span>🎯 SYNDROME TABLE</span>
        <span style={{ fontSize: '10px', color: step === 'correct' ? CG : CE }}>
          {step === 'correct' ? 'RESTORED ✓' : 'ACTIVE'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[0, 1, 2].map(q => {
          const row = SYNDROME_TABLE[q];
          const isThisError = q === errorQubit;
          return (
            <div
              key={q}
              onClick={() => onErrorQubitChange && onErrorQubitChange(q)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '10px',
                background: isThisError ? (step === 'correct' ? `${CG}25` : `${CE}25`) : 'transparent',
                border: isThisError ? `1.5px solid ${step === 'correct' ? CG : CE}` : '1.5px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title={`Click to test Error on Q${q + 1}`}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: isThisError ? (step === 'correct' ? CG2 : CE2) : '#64748b', fontSize: '11px', fontWeight: 700 }}>
                  s₁={row.s1}
                </span>
                <span style={{ color: isThisError ? (step === 'correct' ? CG2 : CE2) : '#64748b', fontSize: '11px', fontWeight: 700 }}>
                  s₂={row.s2}
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: isThisError ? (step === 'correct' ? CG : CE) : '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                {isThisError ? (step === 'correct' ? '✓ ' : '⚠ ') : ''}{row.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 7.5 TOP-LEFT QUBIT ROLES & COLOR LEGEND CARD (Dynamic per Step)
// =============================================================================
function QECLegendCard({ isLight, step, errorQubit = 0 }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="glass-interactive" style={{
      position: 'absolute',
      top: '24px',
      left: '24px',
      width: '248px',
      background: 'var(--glass-bg-base)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : 'var(--glass-border-base)',
      borderRadius: '24px',
      padding: '14px 16px',
      boxShadow: isLight
        ? 'inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 16px 36px -8px rgba(0,0,0,0.12)'
        : 'var(--glass-highlight), var(--glass-shadow-base)',
      pointerEvents: 'auto',
      zIndex: 100,
      transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '9.5px',
          fontWeight: '800',
          letterSpacing: '1.4px',
          color: isLight ? '#475569' : '#94a3b8',
          textTransform: 'uppercase',
        }}>
          <span style={{ fontSize: '12px' }}>🛡️</span>
          <span>Qubit Roles & Notation</span>
        </div>
        <span style={{
          fontSize: '10px',
          color: '#64748b',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'inline-block',
        }}>
          ▲
        </span>
      </div>

      <div style={{
        maxHeight: isOpen ? '380px' : '0px',
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0)' : 'translateY(-6px)',
        overflow: 'hidden',
        transition: 'max-height 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), margin-top 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        marginTop: isOpen ? '9px' : '0px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}>
        {/* Dynamic Logical State Notation (Only in Step 2: encode) */}
        {step === 'encode' && (
          <div style={{
            padding: '7px 10px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.45)',
            marginBottom: '2px',
            animation: 'qecSyndromePop 0.35s ease',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: CI2, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🛡️ Logical State</span>
              <InlineMath math="|0_L\rangle = |000\rangle" />
            </div>
            <div style={{ fontSize: '9.5px', color: isLight ? '#475569' : '#cbd5e1', lineHeight: 1.25, marginTop: '2px' }}>
              3 physical qubits bound into 1 protected logical bit
            </div>
          </div>
        )}

        {/* Dynamic Bit-Flip Error Notation (Only in Step 3: noise) */}
        {step === 'noise' && (
          <div style={{
            padding: '7px 10px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            marginBottom: '2px',
            animation: 'qecSyndromePop 0.35s ease',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: CE2, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>☄️ Bit-Flip Error</span>
              <InlineMath math={`X_{${errorQubit + 1}}|0\\rangle = |1\\rangle`} />
            </div>
            <div style={{ fontSize: '9.5px', color: isLight ? '#475569' : '#cbd5e1', lineHeight: 1.25, marginTop: '2px' }}>
              Cosmic ray flipped Q{errorQubit + 1} from north to south pole
            </div>
          </div>
        )}

        {/* Dynamic Parity Check 1 Notation (Only in Step 4: syndrome_1) */}
        {step === 'syndrome_1' && (
          <div style={{
            padding: '7px 10px',
            borderRadius: '10px',
            background: (SYNDROME_TABLE[errorQubit]?.s1 === 1) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${(SYNDROME_TABLE[errorQubit]?.s1 === 1) ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.45)'}`,
            marginBottom: '2px',
            animation: 'qecSyndromePop 0.35s ease',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: (SYNDROME_TABLE[errorQubit]?.s1 === 1) ? CE2 : CA2, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔬 Parity Check 1</span>
              <InlineMath math={`s_1 = Q_1 \\oplus Q_2 = ${SYNDROME_TABLE[errorQubit]?.s1 ?? 1}`} />
            </div>
            <div style={{ fontSize: '9.5px', color: isLight ? '#475569' : '#cbd5e1', lineHeight: 1.25, marginTop: '2px' }}>
              {SYNDROME_TABLE[errorQubit]?.s1 === 1
                ? 'Mismatch! Q₁ and Q₂ differ (s₁ = 1)'
                : 'Parity clean! Q₁ and Q₂ agree (s₁ = 0)'}
            </div>
          </div>
        )}

        {/* Dynamic Parity Check 2 Notation (Only in Step 5: syndrome_2) */}
        {step === 'syndrome_2' && (
          <div style={{
            padding: '7px 10px',
            borderRadius: '10px',
            background: (SYNDROME_TABLE[errorQubit]?.s2 === 1) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${(SYNDROME_TABLE[errorQubit]?.s2 === 1) ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.45)'}`,
            marginBottom: '2px',
            animation: 'qecSyndromePop 0.35s ease',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: (SYNDROME_TABLE[errorQubit]?.s2 === 1) ? CE2 : CA2, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔭 Parity Check 2</span>
              <InlineMath math={`s_2 = Q_2 \\oplus Q_3 = ${SYNDROME_TABLE[errorQubit]?.s2 ?? 1}`} />
            </div>
            <div style={{ fontSize: '9.5px', color: isLight ? '#475569' : '#cbd5e1', lineHeight: 1.25, marginTop: '2px' }}>
              {SYNDROME_TABLE[errorQubit]?.s2 === 1
                ? 'Mismatch! Q₂ and Q₃ differ (s₂ = 1)'
                : 'Parity clean! Q₂ and Q₃ agree (s₂ = 0)'}
            </div>
          </div>
        )}

        {/* Dynamic Syndrome Decoded Notation (Only in Step 6: decode) */}
        {step === 'decode' && (
          <div style={{
            padding: '7px 10px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            marginBottom: '2px',
            animation: 'qecSyndromePop 0.35s ease',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: CE2, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎯 Syndrome Decoded</span>
              <InlineMath math={`(s_1, s_2) = (${SYNDROME_TABLE[errorQubit]?.s1}, ${SYNDROME_TABLE[errorQubit]?.s2})`} />
            </div>
            <div style={{ fontSize: '9.5px', color: isLight ? '#475569' : '#cbd5e1', lineHeight: 1.25, marginTop: '2px' }}>
              Parity address isolates corrupted state to Q{errorQubit + 1}!
            </div>
          </div>
        )}

        {/* Dynamic Correction Applied Notation (Only in Step 7: correct) */}
        {step === 'correct' && (
          <div style={{
            padding: '7px 10px',
            borderRadius: '10px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.45)',
            marginBottom: '2px',
            animation: 'qecSyndromePop 0.35s ease',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: CG2, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✅ State Restored</span>
              <InlineMath math={`X_{${errorQubit + 1}}|${errorQubit === 0 ? '100' : errorQubit === 1 ? '010' : '001'}\\rangle = |000\\rangle`} />
            </div>
            <div style={{ fontSize: '9.5px', color: isLight ? '#475569' : '#cbd5e1', lineHeight: 1.25, marginTop: '2px' }}>
              Targeted X-pulse restored Q{errorQubit + 1} — logical state 100% recovered!
            </div>
          </div>
        )}

        {[
          { color: CI, label: 'Data Qubits (Q₁, Q₂, Q₃)', desc: 'Store protected quantum information' },
          { color: CA, label: 'Ancilla Qubits (A₁, A₂)', desc: 'Measure parity without collapsing data' },
          { color: CE, label: 'Corrupted Qubit (Error)', desc: 'Flipped by cosmic noise |0⟩ → |1⟩' },
          { color: CG, label: 'Corrected Qubit (Restored)', desc: 'Recovered via targeted X gate pulse' },
        ].map(({ color: pc, label, desc }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: pc,
              marginTop: '3px',
              flexShrink: 0,
              boxShadow: `0 0 8px ${pc}`,
            }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: isLight ? '#0f172a' : '#f8fafc', lineHeight: 1.2 }}>
                {label}
              </div>
              <div style={{ fontSize: '9.5px', color: isLight ? '#64748b' : '#94a3b8', lineHeight: 1.25, marginTop: '1px' }}>
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// 8. NAVIGATION OVERLAY (Bottom Right Corner)
// =============================================================================
function QECNavOverlay({ stepIndex, totalSteps, onPrev, onNext, isFirst, isLast, stepData }) {
  const accent = stepData?.color || CI;
  return (
    <QuantumNavButtons
      canPrev={stepIndex > 0}
      canNext={stepIndex < totalSteps - 1}
      onPrev={onPrev}
      onNext={onNext}
      prevLabel="Prev"
      nextLabel={stepIndex < totalSteps - 1 ? "Next" : "Completed"}
      isLast={stepIndex === totalSteps - 1}
      accentColor={accent}
      containerStyle={{
        position: 'absolute',
        bottom: '24px',
        right: '28px',
        zIndex: 300,
      }}
    />
  );
}

// =============================================================================
// 9. ROOT MODULE COMPONENT (exported)
// =============================================================================
export default function QuantumErrorCorrectionModule({ theme, isSidebarOpen, isGlobalMuted }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [errorQubit, setErrorQubit] = useState(0); // 0=Q1, 1=Q2, 2=Q3
  const [isExpanded, setIsExpanded] = useState(false);
  const isLight = theme === 'light';

  const audio = useQECAudio(isGlobalMuted);
  const hasInited = useRef(false);

  // Init audio on mount
  useEffect(() => {
    let cancelled = false;
    audio.initAudio().then(() => {
      if (!cancelled) {
        audio.playAmbient();
      }
    }).catch(() => { });
    return () => {
      cancelled = true;
      audio.stopAll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStep = getQECStep(stepIndex, errorQubit);

  // Audio trigger on step change
  useEffect(() => {
    if (!hasInited.current) { hasInited.current = true; return; }
    const stepId = QEC_STEPS[stepIndex]?.id;
    if (!audio.initAudio) return;
    let cancelled = false;
    const timeoutIds = [];
    const schedule = (fn, delay) => {
      timeoutIds.push(setTimeout(() => { if (!cancelled) fn(); }, delay));
    };
    audio.initAudio().then(() => {
      if (cancelled) return;
      switch (stepId) {
        case 'encode':
          [0, 1, 2].forEach(i => schedule(() => audio.playEncodeBeam(i), i * 250));
          break;
        case 'noise':
          schedule(() => audio.playNoiseBurst(), 300);
          break;
        case 'syndrome_1':
          audio.playAncillaActivate();
          schedule(() => audio.playSyndromeReveal(SYNDROME_TABLE[errorQubit].s1), 800);
          break;
        case 'syndrome_2':
          audio.playAncillaActivate();
          schedule(() => audio.playSyndromeReveal(SYNDROME_TABLE[errorQubit].s2), 800);
          break;
        case 'decode':
          audio.playErrorLocated();
          break;
        case 'correct':
          audio.playCorrection();
          schedule(() => audio.playRestored(), 500);
          break;
        default: break;
      }
    }).catch(() => { });
    return () => {
      cancelled = true;
      timeoutIds.forEach(clearTimeout);
    };
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => setStepIndex(s => Math.min(s + 1, QEC_STEPS.length - 1));
  const handlePrev = () => setStepIndex(s => Math.max(s - 1, 0));

  const handleErrorQubitChange = (q) => {
    setErrorQubit(q);
    if (QEC_STEPS[stepIndex]?.id === 'noise') {
      audio?.playNoiseBurst?.();
    }
  };

  const currentSidebarWidth = isSidebarOpen ? 420 : 112;
  const uiBoundsStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: `${currentSidebarWidth}px`,
    transition: 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    pointerEvents: 'none',
    zIndex: 100,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'transparent', overflow: 'hidden' }}>
      <style>{`
        @keyframes qecPanelEnter {
          from { opacity: 0; transform: translateY(20px); filter: blur(8px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0px); }
        }
        @keyframes qecSyndromePop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ─── 3D WebGL Canvas ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <SharedCanvas
          gl={SCENE_GL}
          camera={{ position: [0, 1.8, 34], fov: 48 }}
        >
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <Suspense fallback={null}>
            <QECScene
              step={currentStep?.id}
              errorQubit={errorQubit}
              onErrorQubitChange={handleErrorQubitChange}
              theme={theme}
              isSidebarOpen={isSidebarOpen}
              isExpanded={isExpanded}
              audio={audio}
            />
          </Suspense>
        </SharedCanvas>
      </div>

      {/* ─── 2D OVERLAYS BOUNDED TO CANVAS VIEWPORT ─────────────────────── */}
      <div style={uiBoundsStyle}>
        {/* ─── Top-Left Qubit Roles & Color Legend Card ────────────────────── */}
        <QECLegendCard isLight={isLight} step={currentStep?.id} errorQubit={errorQubit} />

        {/* ─── Top-Right Syndrome Truth Table Card (Step 6 & 7) ────────────── */}
        <QECSyndromeTableCard
          isLight={isLight}
          step={currentStep?.id}
          errorQubit={errorQubit}
          onErrorQubitChange={handleErrorQubitChange}
        />

        {/* ─── Top Step Indicator (Aligned directly below Beginner header) ─── */}
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          zIndex: 150,
          pointerEvents: 'none',
        }}>
          {QEC_STEPS.map((step, i) => (
            <div key={i} style={{
              width: i === stepIndex ? '24px' : '7px',
              height: '7px',
              borderRadius: '4px',
              background: i === stepIndex ? (step.color || CI) : (i < stepIndex ? `${step.color || CI}70` : 'rgba(255,255,255,0.18)'),
              transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
              boxShadow: i === stepIndex ? `0 0 12px ${step.color || CI}` : 'none',
            }} />
          ))}
        </div>
        <QECNavOverlay
          stepIndex={stepIndex}
          totalSteps={QEC_STEPS.length}
          onPrev={handlePrev}
          onNext={handleNext}
          isFirst={stepIndex === 0}
          isLast={stepIndex === QEC_STEPS.length - 1}
          stepData={currentStep}
        />

        <QECStepPanel
          stepData={currentStep}
          stepIndex={stepIndex}
          totalSteps={QEC_STEPS.length}
          errorQubit={errorQubit}
          onErrorQubitChange={handleErrorQubitChange}
          isLight={isLight}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(v => !v)}
        />
      </div>
    </div>
  );
}
