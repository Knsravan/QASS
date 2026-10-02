// NO-CLONING THEOREM MODULE — Interactive Cinematic Story Experience
import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { InlineMath } from 'react-katex';
import { ClassicalBit, QubitCore } from './BlochSphere';
import CameraShifter from './CameraShifter';
import { QuantumNavButtons } from './QuantumNavButtons';
import { useNoCloningAudio } from './useNoCloningAudio';
import { SCENE_GL } from './sceneGl';
import { QualityCanvas, QualityComposer } from './QualityScene';

// Color Palette
const CC = '#00f2fe'; // Cyan / Classical
const CP = '#c084fc'; // Purple / Quantum
const CR = '#ef4444'; // Red / Collapse
const CG = '#22c55e'; // Green / Success

// 3D Scene Coordinates:
// Generous 10.4 unit gap between Classical Bit 2 (-5.2) and Qubit A (+5.2)
// Big center VS badge sits at (0, -0.6, 0) right in the middle with ample space on both sides
// Layout stays within ±10.2 so all four objects (plus their labels) fit in frame at
// 1440px-wide viewports even with the sidebar open (CameraShifter crops the right
// edge of the view by half the sidebar width)
const POS_BIT_1 = [-10.2, -0.6, 0];
const POS_BIT_2 = [-5.2, -0.6, 0];
const POS_QUBIT_A = [5.2, -0.6, 0];
const POS_QUBIT_B = [10.2, -0.6, 0];

const NC_STEPS = ['intro', 'classical_focus', 'classical_done', 'quantum_focus', 'quantum_cnot', 'quantum_collapse', 'summary'];

// Camera Waypoints for Each Step (Cinematic drone positions for clear framing)
const CAMERA_WAYPOINTS = {
  intro: { pos: [0, 1.4, 31.0], look: [0, -0.6, 0] },
  classical_focus: { pos: [-7.7, 0.2, 16.0], look: [-7.7, -0.6, 0] },
  classical_copying: { pos: [-7.7, 0.2, 16.0], look: [-7.7, -0.6, 0] },
  classical_done: { pos: [-7.7, 0.2, 16.0], look: [-7.7, -0.6, 0] },
  quantum_focus: { pos: [7.7, 0.3, 16.5], look: [7.7, -0.6, 0] },
  quantum_cnot: { pos: [7.7, 0.3, 16.5], look: [7.7, -0.6, 0] },
  quantum_collapse: { pos: [5.2, 0.2, 14.5], look: [5.2, -0.6, 0] },
  summary: { pos: [0, 1.4, 31.0], look: [0, -0.6, 0] },
};

// Bloch vector orientation constants & scratch objects (allocated once — the
// precession loop runs at frame rate, so per-frame allocations are avoided)
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const QUAT_NORTH = new THREE.Quaternion(); // |0⟩ points straight up to North Pole
const QUAT_SOUTH = new THREE.Quaternion().setFromAxisAngle(AXIS_X, Math.PI); // |1⟩
const QUAT_EQUATOR_TILT = new THREE.Quaternion().setFromAxisAngle(AXIS_X, Math.PI / 2);
const _tumbleEuler = new THREE.Euler();

// ==========================================================
// 1. CLASSICAL ENERGY TETHER (CYAN -> GREEN PULSE)
// ==========================================================
function ClassicalEnergyTether({ active, isCopied }) {
  const coreRef = useRef();
  const glowRef = useRef();
  const particlesRef = useRef([]);
  const dist = Math.abs(POS_BIT_2[0] - POS_BIT_1[0]);
  const midX = (POS_BIT_1[0] + POS_BIT_2[0]) / 2;

  const N = 28;
  const particleData = useRef(
    Array.from({ length: N }, (_, i) => ({
      progress: i / N,
      speed: 0.85 + (i % 3) * 0.2,
      radius: 0.10 + (i % 3) * 0.05,
      angle: (i / N) * Math.PI * 4,
      size: 0.035 + (i % 3) * 0.015
    }))
  ).current;

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!active) return;

    if (coreRef.current) {
      coreRef.current.material.opacity = 0.85 + Math.sin(t * 8) * 0.15;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.4 + Math.sin(t * 6) * 0.2;
    }

    if (!isCopied) {
      particleData.forEach((p, i) => {
        p.progress = (p.progress + delta * p.speed) % 1;
        const mesh = particlesRef.current[i];
        if (!mesh) return;
        const curX = THREE.MathUtils.lerp(POS_BIT_1[0], POS_BIT_2[0], p.progress);
        const curAngle = p.angle + t * 6;
        mesh.position.set(curX, POS_BIT_1[1] + Math.sin(curAngle) * p.radius, Math.cos(curAngle) * p.radius);
        mesh.material.opacity = Math.sin(p.progress * Math.PI) * 0.95;
      });
    }
  });

  if (!active) return null;

  const tetherColor = isCopied ? CG : CC;

  return (
    <group>
      <mesh ref={coreRef} position={[midX, POS_BIT_1[1], 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.026, 0.026, dist, 16]} />
        <meshBasicMaterial color={tetherColor} transparent opacity={0.85} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={glowRef} position={[midX, POS_BIT_1[1], 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.095, 0.095, dist, 16]} />
        <meshStandardMaterial color={tetherColor} emissive={tetherColor} emissiveIntensity={6} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
      </mesh>
      {!isCopied && particleData.map((p, i) => (
        <mesh key={i} ref={el => (particlesRef.current[i] = el)}>
          <sphereGeometry args={[p.size, 8, 8]} />
          <meshStandardMaterial
            color="#a5f3fc"
            emissive={tetherColor}
            emissiveIntensity={5}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      <Html center position={[midX, POS_BIT_1[1] + 1.8, 0]} zIndexRange={[60, 0]}>
        <div style={{
          background: isCopied ? 'rgba(6, 40, 20, 0.88)' : 'rgba(8, 24, 40, 0.88)',
          backdropFilter: 'blur(16px)',
          border: `1.5px solid ${tetherColor}88`,
          borderRadius: '20px',
          padding: '5px 16px',
          fontSize: '10.5px',
          fontWeight: '800',
          color: tetherColor,
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '1px',
          whiteSpace: 'nowrap',
          boxShadow: `0 0 16px ${tetherColor}44`,
          pointerEvents: 'none',
          transition: 'all 0.4s ease'
        }}>
          {isCopied ? '✨ 100% Copied & Independent!' : '⚡ Copying Voltage Stream...'}
        </div>
      </Html>
    </group>
  );
}

// ==========================================================
// 2. QUANTUM ENTANGLEMENT CONDUIT & SHOCKWAVE
// ==========================================================
function QuantumConduitTether({ active, snapping, color = CP }) {
  const coreRef = useRef();
  const glowRef = useRef();
  const particlesRef = useRef([]);
  const dist = Math.abs(POS_QUBIT_B[0] - POS_QUBIT_A[0]);
  const midX = (POS_QUBIT_A[0] + POS_QUBIT_B[0]) / 2;

  const N = 36;
  const particleData = useRef(
    Array.from({ length: N }, (_, i) => ({
      progress: i / N,
      speed: 0.35 + (i % 4) * 0.08,
      radius: 0.16 + (i % 3) * 0.06,
      angle: (i / N) * Math.PI * 4,
      size: 0.032 + (i % 4) * 0.012
    }))
  ).current;

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!active) return;

    if (coreRef.current) {
      coreRef.current.material.opacity = (0.7 + Math.sin(t * 7) * 0.3) * (snapping ? 0.3 : 1);
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (0.35 + Math.sin(t * 4.5) * 0.15) * (snapping ? 0.2 : 1);
    }

    particleData.forEach((p, i) => {
      p.progress = (p.progress + delta * p.speed * (snapping ? 3.5 : 1)) % 1;
      const mesh = particlesRef.current[i];
      if (!mesh) return;
      const x = THREE.MathUtils.lerp(POS_QUBIT_A[0], POS_QUBIT_B[0], p.progress);
      const curAngle = p.angle + t * 4.5;
      mesh.position.set(x, POS_QUBIT_A[1] + Math.sin(curAngle) * p.radius, Math.cos(curAngle) * p.radius);
      mesh.material.opacity = Math.sin(p.progress * Math.PI) * (snapping ? 0.3 : 0.9);
    });
  });

  if (!active) return null;

  return (
    <group>
      <mesh ref={coreRef} position={[midX, POS_QUBIT_A[1], 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.024, 0.024, dist, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={glowRef} position={[midX, POS_QUBIT_A[1], 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, dist, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} transparent opacity={0.35} blending={THREE.AdditiveBlending} />
      </mesh>
      {particleData.map((p, i) => (
        <mesh key={i} ref={el => (particlesRef.current[i] = el)}>
          <sphereGeometry args={[p.size, 8, 8]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#ffffff' : color}
            emissive={color}
            emissiveIntensity={4}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      <Html center position={[midX, POS_QUBIT_A[1] + 1.8, 0]} zIndexRange={[60, 0]}>
        <div style={{
          background: 'rgba(15, 4, 30, 0.88)',
          backdropFilter: 'blur(16px)',
          border: `1.5px solid ${snapping ? CR : color}88`,
          borderRadius: '20px',
          padding: '5px 16px',
          fontSize: '10.5px',
          fontWeight: '800',
          color: snapping ? '#fca5a5' : color,
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '1px',
          whiteSpace: 'nowrap',
          boxShadow: `0 0 16px ${snapping ? CR : color}44`,
          pointerEvents: 'none'
        }}>
          {snapping ? '⚡ Entanglement Snapped!' : '🔗 Entanglement Flux (Not a Clone!)'}
        </div>
      </Html>
    </group>
  );
}

// ==========================================================
// 3. COLLAPSE SHOCKWAVE EXPLOSION
// ==========================================================
function CollapseShockwave({ active, origin }) {
  const meshRef = useRef();
  const ringRef = useRef();

  useEffect(() => {
    if (!active || !meshRef.current) return;
    meshRef.current.scale.set(0.1, 0.1, 0.1);
    meshRef.current.material.opacity = 1;
    gsap.to(meshRef.current.scale, { x: 4.5, y: 4.5, z: 4.5, duration: 0.85, ease: 'power2.out' });
    gsap.to(meshRef.current.material, { opacity: 0, duration: 0.85, ease: 'power2.out' });

    if (ringRef.current) {
      ringRef.current.scale.set(0.1, 0.1, 0.1);
      ringRef.current.material.opacity = 1;
      gsap.to(ringRef.current.scale, { x: 5.2, y: 5.2, z: 5.2, duration: 0.95, ease: 'power2.out' });
      gsap.to(ringRef.current.material, { opacity: 0, duration: 0.95, ease: 'power2.out' });
    }
  }, [active]);

  if (!active) return null;

  return (
    <group position={origin}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.0, 24, 24]} />
        <meshStandardMaterial color={CR} emissive={CR} emissiveIntensity={6} transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.05, 16, 64]} />
        <meshStandardMaterial color="#fff" emissive={CR} emissiveIntensity={8} transparent opacity={1} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ==========================================================
// 4. DEDICATED DRONE CAMERA CONTROLLER
// ==========================================================
function DroneCameraController({ step, orbitRef, audio }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(...CAMERA_WAYPOINTS.intro.pos));
  const targetLook = useRef(new THREE.Vector3(...CAMERA_WAYPOINTS.intro.look));
  const smoothLook = useRef(new THREE.Vector3(0, 0, 0));
  const prevStep = useRef(step);

  useEffect(() => {
    const wp = CAMERA_WAYPOINTS[step] || CAMERA_WAYPOINTS.intro;
    targetPos.current.set(...wp.pos);
    targetLook.current.set(...wp.look);

    if (prevStep.current !== step) {
      if (audio?.playCameraPan && step !== 'intro') {
        audio.playCameraPan(1.8);
      }
      prevStep.current = step;
    }
  }, [step, audio]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const droneWobbleY = Math.sin(t * 1.4) * 0.035;
    const droneWobbleX = Math.cos(t * 1.0) * 0.025;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.current.x + droneWobbleX, 2.2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.current.y + droneWobbleY, 2.2, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.current.z, 2.2, delta);

    smoothLook.current.x = THREE.MathUtils.damp(smoothLook.current.x, targetLook.current.x, 2.8, delta);
    smoothLook.current.y = THREE.MathUtils.damp(smoothLook.current.y, targetLook.current.y, 2.8, delta);
    smoothLook.current.z = THREE.MathUtils.damp(smoothLook.current.z, targetLook.current.z, 2.8, delta);

    if (orbitRef.current) {
      orbitRef.current.target.copy(smoothLook.current);
      orbitRef.current.update();
    } else {
      camera.lookAt(smoothLook.current);
    }
  });

  return null;
}

// ==========================================================
// 5. MAIN NO-CLONING THEOREM MODULE
// ==========================================================
// 4. SMOOTH 3D MODEL ENTRANCE CONTROLLER
// ==========================================================
// Entrance choreography is driven from wall-clock time (not a tween ticker), so the
// scene settles in ~1.5s of real time even when the WebGL frame rate is very low.
const ENTRANCE_STAGGER = { bit1: 0.0, bit2: 0.1, vs: 0.2, qubitA: 0.3, qubitB: 0.4 };
const ENTRANCE_POP = 0.7; // per-model bloom duration (s)
const ENTRANCE_RISE = 1.0; // shared upward-float duration (s)
const easeBackOut = (x, s = 1.5) => {
  const p = x - 1;
  return 1 + p * p * ((s + 1) * p + s);
};
const easeCubicOut = (x) => 1 - Math.pow(1 - x, 3);

function ModelEntranceAnimator({ entranceRef, groupBit1, groupBit2, groupVS, groupQubitA, groupQubitB }) {
  useFrame(() => {
    const startedAt = entranceRef.current.startedAt;
    const elapsed = startedAt == null ? 0 : (performance.now() - startedAt) / 1000;
    const yRise = -2.2 * (1 - easeCubicOut(THREE.MathUtils.clamp(elapsed / ENTRANCE_RISE, 0, 1)));

    const apply = (group, baseY, delay) => {
      if (!group.current) return;
      const p = easeBackOut(THREE.MathUtils.clamp((elapsed - delay) / ENTRANCE_POP, 0, 1));
      group.current.scale.setScalar(p);
      group.current.position.y = baseY + yRise * (1 - p);
    };

    apply(groupBit1, POS_BIT_1[1], ENTRANCE_STAGGER.bit1);
    apply(groupBit2, POS_BIT_2[1], ENTRANCE_STAGGER.bit2);
    apply(groupVS, -0.6, ENTRANCE_STAGGER.vs);
    apply(groupQubitA, POS_QUBIT_A[1], ENTRANCE_STAGGER.qubitA);
    apply(groupQubitB, POS_QUBIT_B[1], ENTRANCE_STAGGER.qubitB);
  });
  return null;
}

// ==========================================================
export default function NoCloningModule({ theme, isSidebarOpen, isGlobalMuted }) {
  // Interactive Story Steps:
  // 'intro' -> 'classical_focus' -> 'classical_copying' -> 'classical_done' -> 'quantum_focus' -> 'quantum_cnot' -> 'quantum_collapse' -> 'summary'
  const [step, setStep] = useState('intro');
  const [isCopied, setIsCopied] = useState(false);
  const [isClassicalTetherActive, setIsClassicalTetherActive] = useState(false);
  const [collapseOutcome, setCollapseOutcome] = useState('0');
  const [showCollapseShockwave, setShowCollapseShockwave] = useState(false);
  const [introTooltipVisible, setIntroTooltipVisible] = useState(false);

  // Group references for smooth 3D entrance
  const groupBit1 = useRef();
  const groupBit2 = useRef();
  const groupVS = useRef();
  const groupQubitA = useRef();
  const groupQubitB = useRef();

  const entranceAnim = useRef({ startedAt: null });
  const epochRef = useRef(performance.now());

  const orbitRef = useRef();
  const audio = useNoCloningAudio(isGlobalMuted);

  // Registry of every pending timeout so step sequences never fire after unmount,
  // a reset, or a backwards navigation
  const pendingTimersRef = useRef(new Set());
  const scheduleTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      pendingTimersRef.current.delete(id);
      fn();
    }, delay);
    pendingTimersRef.current.add(id);
    return id;
  }, []);
  const clearPendingTimeouts = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current.clear();
  }, []);
  useEffect(() => clearPendingTimeouts, [clearPendingTimeouts]);

  const isLight = theme === 'light';
  const currentSidebarWidth = isSidebarOpen ? 420 : 112;

  const uiBoundsStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: `${currentSidebarWidth}px`,
    transition: 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    pointerEvents: 'none',
    zIndex: 10
  };

  // State vectors
  const quatQubitA = useRef(new THREE.Quaternion());
  const quatQubitB = useRef(new THREE.Quaternion());

  // Initialize audio once and play peaceful 3D model entrance bloom in sync with blooming animation
  useEffect(() => {
    audio.initAudio().then(() => {
      audio.playModuleEntranceBloom();
    }).catch(() => {});
    return () => audio.stopAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth entrance sequence on mount: 3D Models appear first with staggered bloom + rise, THEN "Do You Know" popup appears smoothly.
  // The popup is gated on a wall-clock timeout (not an animation callback), so the CTA
  // reliably appears ~1.5s after mount regardless of how slowly the scene renders.
  useEffect(() => {
    entranceAnim.current.startedAt = performance.now();
    setIntroTooltipVisible(false);
    scheduleTimeout(() => setIntroTooltipVisible(true), 1400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Precession animation loop for Qubits (Matches 1st Module natural superposition rotation)
  useEffect(() => {
    let animId;

    const animateVectors = () => {
      // Persistent epoch so step changes never rewind the precession phase
      const t = (performance.now() - epochRef.current) / 1000;
      const isCollapsed = step === 'quantum_collapse' || step === 'summary';
      const isEntangled = step === 'quantum_cnot';

      if (isCollapsed) {
        // Post-measurement: the correlated outcome IS two identical definite states
        const tgt = collapseOutcome === '0' ? QUAT_NORTH : QUAT_SOUTH;
        quatQubitA.current.copy(tgt);
        quatQubitB.current.copy(tgt);
      } else if (isEntangled) {
        // After CNOT neither qubit holds an individual pure state (each reduced state
        // is maximally mixed), so both vectors tumble without a definite direction —
        // deliberately decorrelated so Qubit B never reads as a live copy of Qubit A
        quatQubitA.current.setFromEuler(_tumbleEuler.set(t * 1.9, t * 1.3, t * 0.9));
        quatQubitB.current.setFromEuler(_tumbleEuler.set(-t * 1.5 + 2.1, t * 1.7 + 4.2, -t * 1.1 + 1.0));
      } else {
        // Smooth equator superposition sweep identical to Module 1 (Bit vs Qubit)
        quatQubitA.current.setFromAxisAngle(AXIS_Y, t * 0.75).multiply(QUAT_EQUATOR_TILT);
        quatQubitB.current.copy(QUAT_NORTH); // Target |0⟩ points straight up to North Pole
      }
      animId = requestAnimationFrame(animateVectors);
    };

    animId = requestAnimationFrame(animateVectors);
    return () => cancelAnimationFrame(animId);
  }, [step, collapseOutcome]);

  // ==========================================================
  // ACTION HANDLERS FOR STEP PROGRESSION
  // ==========================================================

  // Step 1 -> Step 2: Go to Classical Bits
  const handleStartClassical = useCallback(() => {
    audio.playButtonClick();
    setStep('classical_focus');
  }, [audio]);

  // Step 2 -> Step 3: Trigger Classical Copy Animation
  const handleTriggerClassicalCopy = useCallback(() => {
    audio.playButtonClick();
    setStep('classical_copying');
    setIsClassicalTetherActive(true);

    // Tether animation: passes particles for 1.8s, then copies
    scheduleTimeout(() => {
      setIsCopied(true);
      audio.playScanSuccess();
      scheduleTimeout(() => {
        setStep('classical_done');
      }, 500);
    }, 1800);
  }, [audio, scheduleTimeout]);

  // Step 3 -> Step 4: Go to Quantum Qubits
  const handleStartQuantum = useCallback(() => {
    audio.playButtonClick();
    setStep('quantum_focus');
  }, [audio]);

  // Step 4 -> Step 5: Trigger CNOT Entanglement
  const handleTriggerCNOT = useCallback(() => {
    audio.playTetherIgnite();
    setStep('quantum_cnot');
  }, [audio]);

  // Step 5 -> Step 6: Measurement and Wavefunction Collapse
  const handleTriggerCollapse = useCallback(() => {
    audio.playButtonClick();
    setStep('quantum_collapse');

    const outcome = Math.random() < 0.5 ? '0' : '1';
    setCollapseOutcome(outcome);
    setShowCollapseShockwave(true);

    scheduleTimeout(() => setShowCollapseShockwave(false), 900);
    scheduleTimeout(() => audio.playCollapseResolved(outcome), 200);
  }, [audio, scheduleTimeout]);

  // Step 6 -> Step 7: Summary
  const handleGoToSummary = useCallback(() => {
    audio.playButtonClick();
    setStep('summary');
  }, [audio]);

  // Reset Experience
  const handleReset = useCallback(() => {
    audio.playButtonClick();
    clearPendingTimeouts();
    setStep('intro');
    setIsCopied(false);
    setIsClassicalTetherActive(false);
    setShowCollapseShockwave(false);
    setIntroTooltipVisible(false);

    entranceAnim.current.startedAt = performance.now();

    scheduleTimeout(() => {
      audio.playModuleEntranceBloom();
    }, 120);
    scheduleTimeout(() => setIntroTooltipVisible(true), 1400);
  }, [audio, clearPendingTimeouts, scheduleTimeout]);

  const currentStepIdx = NC_STEPS.indexOf(step === 'classical_copying' ? 'classical_focus' : step);

  const handleNCPrev = useCallback(() => {
    if (currentStepIdx <= 0) return;
    audio.playButtonClick();
    clearPendingTimeouts();

    const targetIdx = currentStepIdx - 1;
    const target = NC_STEPS[targetIdx];
    const copiedFromIdx = NC_STEPS.indexOf('classical_done');

    // Keep the copy visuals consistent with how the target step is reached going forward
    setIsCopied(targetIdx >= copiedFromIdx);
    setIsClassicalTetherActive(targetIdx >= copiedFromIdx);
    setShowCollapseShockwave(false);
    if (target === 'intro') setIntroTooltipVisible(true);
    setStep(target);
  }, [audio, currentStepIdx, clearPendingTimeouts]);

  const handleNCNext = useCallback(() => {
    if (step === 'intro') {
      handleStartClassical();
    } else if (step === 'classical_focus') {
      handleTriggerClassicalCopy();
    } else if (step === 'classical_done') {
      handleStartQuantum();
    } else if (step === 'quantum_focus') {
      handleTriggerCNOT();
    } else if (step === 'quantum_cnot') {
      handleTriggerCollapse();
    } else if (step === 'quantum_collapse') {
      handleGoToSummary();
    } else if (step === 'summary') {
      handleReset();
    }
    // 'classical_copying' is a no-op: the copy animation finishes on its own
  }, [step, handleStartClassical, handleTriggerClassicalCopy, handleStartQuantum, handleTriggerCNOT, handleTriggerCollapse, handleGoToSummary, handleReset]);

  // Determine dynamic tooltip position based on current active step
  const isClassicalStep = step === 'classical_focus' || step === 'classical_copying' || step === 'classical_done';

  const cardStyle = {
    position: 'absolute',
    top: '32px',
    ...(isClassicalStep
      ? { left: '24px' } // Sits cleanly on the left
      : { right: '24px' } // Sits cleanly on the right
    ),
    width: '345px',
    maxWidth: 'calc(100% - 48px)',
    background: 'transparent',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: `1.5px solid ${step === 'quantum_collapse' ? CR : (step === 'classical_done' ? CG : (isClassicalStep ? CC : CP))}55`,
    borderRadius: '20px',
    padding: '16px 20px',
    boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
    pointerEvents: 'auto',
    animation: 'ncTooltipEnter 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    zIndex: 200,
    transition: 'all 0.35s ease'
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes ncTooltipEnter {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.93);
            filter: blur(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }
        .no-cloning-math {
          overflow: hidden !important;
        }
        .no-cloning-math .katex {
          font-size: 13.5px !important;
        }
        .no-cloning-math .katex-display {
          overflow: hidden !important;
          margin: 0 !important;
          font-size: 13.5px !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .no-cloning-math *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      {/* ========================================================== */}
      {/* 3D WEBGL CANVAS SCENE */}
      {/* ========================================================== */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <QualityCanvas
          gl={SCENE_GL}
          camera={{ position: [0, 1.4, 31.0], fov: 45 }}
        >
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <OrbitControls
            ref={orbitRef}
            makeDefault
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            minDistance={8}
            maxDistance={38}
          />
          <QualityComposer disableNormalPass multisampling={0}>
            <Bloom luminanceThreshold={0.25} mipmapBlur intensity={0.55} />
          </QualityComposer>

          <Suspense fallback={null}>
            <DroneCameraController step={step} orbitRef={orbitRef} audio={audio} />
            <ModelEntranceAnimator
              entranceRef={entranceAnim}
              groupBit1={groupBit1}
              groupBit2={groupBit2}
              groupVS={groupVS}
              groupQubitA={groupQubitA}
              groupQubitB={groupQubitB}
            />

            <ambientLight intensity={isLight ? 0.85 : 0.5} />
            <pointLight position={[-10, 10, 10]} color={CC} intensity={isLight ? 14 : 9} distance={35} />
            <pointLight position={[10, 10, 10]} color={CP} intensity={isLight ? 14 : 9} distance={35} />
            <pointLight position={[0, -6, 12]} color="#ffffff" intensity={2.5} distance={25} />

            {/* ========================================================== */}
            {/* 1. CLASSICAL BITS (SCALED UP FOR IMPACT & CLARITY) */}
            {/* ========================================================== */}
            {/* Classical Bit 1 (Original: Shifts between 0 and 1 before copy, stays locked at 1 after copy) */}
            <group ref={groupBit1} position={POS_BIT_1}>
              <ClassicalBit
                position={[0, 0, 0]}
                scale={1.85}
                theme={theme}
                activeModule="nocloning"
                flipMode={step === 'intro' || step === 'classical_focus' ? 'slow' : 'force-1'}
                attemptCopy={false}
              />
              <Html center position={[0, 4.0, 0]} zIndexRange={[50, 0]}>
                <div style={{
                  padding: '4px 14px',
                  borderRadius: '18px',
                  background: 'rgba(15, 23, 42, 0.88)',
                  border: `1.5px solid ${CC}80`,
                  color: CC,
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none'
                }}>
                  {step === 'intro' || step === 'classical_focus' ? 'Bit 1 (Original)' : 'Bit 1 (Original = 1)'}
                </div>
              </Html>
            </group>

            {/* Classical Bit 2 (Target: Starts completely blank until copied) */}
            <group ref={groupBit2} position={POS_BIT_2}>
              <ClassicalBit
                position={[0, 0, 0]}
                scale={1.85}
                theme={theme}
                activeModule="nocloning"
                isBlank={!isCopied}
                flipMode={isCopied ? 'force-1' : 'static'}
                attemptCopy={isCopied}
                customGridColor={isCopied ? CG : '#f59e0b'}
              />
              <Html center position={[0, 4.0, 0]} zIndexRange={[50, 0]}>
                <div style={{
                  padding: '4px 14px',
                  borderRadius: '18px',
                  background: 'rgba(15, 23, 42, 0.88)',
                  border: `1.5px solid ${isCopied ? CG : '#f59e0b'}80`,
                  color: isCopied ? CG : '#fbbf24',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 0 15px ${isCopied ? CG : '#f59e0b'}40`,
                  transition: 'all 0.4s ease',
                  pointerEvents: 'none'
                }}>
                  {isCopied ? 'Bit 2 (Copied = 1)' : 'Bit 2 (Blank Target)'}
                </div>
              </Html>
            </group>

            {/* Classical Energy Tether Animation */}
            <ClassicalEnergyTether
              active={isClassicalTetherActive}
              isCopied={isCopied}
            />

            {/* ========================================================== */}
            {/* 2. QUANTUM QUBITS (SCALED UP & CLEAN GAP BETWEEN RINGS) */}
            {/* ========================================================== */}
            {/* Qubit A (Alice / Unknown Superposition |ψ⟩) */}
            <group ref={groupQubitA} position={POS_QUBIT_A}>
              <QubitCore
                position={[0, 0, 0]}
                scale={1.55}
                theme={theme}
                activeModule="entanglement"
                superpositionStep={-1}
                customVectorQuat={quatQubitA.current}
                customGridColor={step === 'quantum_collapse' || step === 'summary' ? CR : CP}
                customRingColor={step === 'quantum_collapse' || step === 'summary' ? CR : CP}
                emissiveColor={step === 'quantum_collapse' || step === 'summary' ? CR : CP}
              />
              <Html center position={[0, 4.2, 0]} zIndexRange={[50, 0]}>
                <div style={{
                  padding: '4px 14px',
                  borderRadius: '20px',
                  background: 'rgba(15, 23, 42, 0.88)',
                  border: `1.5px solid ${step === 'quantum_collapse' || step === 'summary' ? CR : CP}80`,
                  color: step === 'quantum_collapse' || step === 'summary' ? '#fca5a5' : '#fff',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 0 15px ${step === 'quantum_collapse' || step === 'summary' ? CR : CP}40`,
                  pointerEvents: 'none'
                }}>
                  {step === 'quantum_collapse' || step === 'summary'
                    ? `Qubit A (Collapsed to |${collapseOutcome}⟩)`
                    : (step === 'quantum_cnot' ? 'Qubit A (Entangled)' : 'Qubit A (Unknown |ψ⟩)')}
                </div>
              </Html>
            </group>

            {/* Qubit B (Bob / Blank Target |0⟩ -> Entangled in CNOT) */}
            <group ref={groupQubitB} position={POS_QUBIT_B}>
              <QubitCore
                position={[0, 0, 0]}
                scale={1.55}
                theme={theme}
                activeModule="entanglement"
                superpositionStep={-1}
                customVectorQuat={quatQubitB.current}
                customGridColor={step === 'quantum_cnot' ? CP : (step === 'quantum_collapse' || step === 'summary' ? CR : '#f59e0b')}
                customRingColor={step === 'quantum_cnot' ? CP : (step === 'quantum_collapse' || step === 'summary' ? CR : '#fbbf24')}
                emissiveColor={step === 'quantum_cnot' ? CP : (step === 'quantum_collapse' || step === 'summary' ? CR : '#f59e0b')}
              />
              <Html center position={[0, 4.2, 0]} zIndexRange={[50, 0]}>
                <div style={{
                  padding: '4px 14px',
                  borderRadius: '20px',
                  background: 'rgba(15, 23, 42, 0.88)',
                  border: `1.5px solid ${step === 'quantum_cnot' ? CP : (step === 'quantum_collapse' || step === 'summary' ? CR : '#f59e0b')}80`,
                  color: step === 'quantum_cnot' ? CP : (step === 'quantum_collapse' || step === 'summary' ? '#fca5a5' : '#fbbf24'),
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 0 15px ${step === 'quantum_cnot' ? CP : (step === 'quantum_collapse' || step === 'summary' ? CR : '#f59e0b')}40`,
                  transition: 'all 0.4s ease',
                  pointerEvents: 'none'
                }}>
                  {step === 'quantum_cnot'
                    ? 'Qubit B (Entangled)'
                    : (step === 'quantum_collapse' || step === 'summary' ? `Qubit B (Collapsed to |${collapseOutcome}⟩)` : 'Qubit B (Target |0⟩)')}
                </div>
              </Html>
            </group>

            {/* Quantum Entanglement Tether */}
            <QuantumConduitTether
              active={step === 'quantum_cnot' || (step === 'quantum_collapse' && showCollapseShockwave)}
              snapping={showCollapseShockwave}
              color={CP}
            />

            {/* Collapse Shockwave */}
            <CollapseShockwave
              active={showCollapseShockwave}
              origin={POS_QUBIT_A}
            />

            {/* ========================================================== */}
            {/* 3. CENTER GLASS VS BADGE (Much Bigger & Frosted) */}
            {/* ========================================================== */}
            <group ref={groupVS} position={[0, -0.6, 0]}>
              <Html center position={[0, 0, 0]} zIndexRange={[40, 0]}>
                <div style={{
                  opacity: step === 'intro' || step === 'summary' ? 1 : 0,
                  transform: step === 'intro' || step === 'summary' ? 'scale(1)' : 'scale(0.75)',
                  transition: 'opacity 0.45s ease, transform 0.45s ease',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(10, 16, 30, 0.38)',
                  backdropFilter: 'blur(30px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                  border: '2px solid rgba(255, 255, 255, 0.22)',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.35), 0 0 30px rgba(0, 242, 254, 0.3)',
                  userSelect: 'none'
                }}>
                  <span style={{
                    background: `linear-gradient(135deg, ${CC}, ${CP})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '900',
                    fontSize: '18px',
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: '1.5px'
                  }}>
                    VS
                  </span>
                </div>
              </Html>
            </group>
          </Suspense>
        </QualityCanvas>
      </div>

      {/* ========================================================== */}
      {/* 2D HTML INTERACTIVE STORY POP-UP TOOLTIPS */}
      {/* ========================================================== */}
      <div style={uiBoundsStyle}>
        {/* Classical Physics & Quantum Physics Section Headers (Smooth fade-out when clicking "Let's see how it works", reappears on Restart) */}
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          width: '0px',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10,
          pointerEvents: 'none',
          opacity: step === 'intro' ? 1 : 0,
          transform: step === 'intro' ? 'translateY(0)' : 'translateY(-14px)',
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div className="section-title classical" style={{ position: 'absolute', left: '-39vh', transform: 'translateX(-50%)' }}>
            <div className="section-title-dot" />
            <span>CLASSICAL PHYSICS</span>
          </div>
          <div className="section-title quantum" style={{ position: 'absolute', left: '39vh', transform: 'translateX(-50%)' }}>
            <div className="section-title-dot" />
            <span>QUANTUM PHYSICS</span>
          </div>
        </div>

        {/* ========================================================== */}
        {/* STEP 1: DO YOU KNOW? INTRO TOOLTIP (TRUE BOTTOM-CENTER FLEX CONTAINER) */}
        {/* ========================================================== */}
        {step === 'intro' && introTooltipVisible && (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 200
          }}>
            <div key="step-intro" style={{
              width: '395px',
              maxWidth: 'calc(100% - 48px)',
              background: 'transparent',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: `1.5px solid ${CC}55`,
              borderRadius: '20px',
              padding: '13px 18px',
              boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
              pointerEvents: 'auto',
              animation: 'ncTooltipEnter 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '8px',
                background: 'rgba(0, 242, 254, 0.15)',
                border: '1px solid rgba(0, 242, 254, 0.35)',
                fontSize: '9px',
                fontWeight: '900',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: CC,
                marginBottom: '4px',
                fontFamily: "'Inter', sans-serif"
              }}>
                💡 DO YOU KNOW?
              </div>

              <h3 style={{
                margin: '0 0 4px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                lineHeight: '1.35'
              }}>
                Have you wondered or tried how Qubits are copied?
              </h3>

              <p style={{
                margin: '0 0 8px',
                fontSize: '11px',
                lineHeight: '1.45',
                color: '#cbd5e1',
                fontFamily: "'Inter', sans-serif"
              }}>
                In classical computing, duplicating data is instantaneous and non-destructive. But can we build a <strong>Quantum Photocopier</strong> to duplicate an unknown qubit state <InlineMath math={String.raw`|\psi\rangle`} />?
              </p>

              <button
                onClick={handleStartClassical}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${CC}88`,
                  background: `linear-gradient(135deg, ${CC}22, ${CC}44)`,
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  fontFamily: "'Inter', sans-serif",
                  cursor: 'pointer',
                  boxShadow: `0 0 14px ${CC}35`,
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = `0 0 20px ${CC}60`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 0 14px ${CC}35`;
                }}
              >
                Let's see how it works →
              </button>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* STEP 2: CLASSICAL FOCUS TOOLTIP (ABOVE CLASSICAL BITS) */}
        {/* ========================================================== */}
        {step === 'classical_focus' && (
          <div key="step-classical-focus" style={cardStyle}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '10px',
              background: 'rgba(0, 242, 254, 0.12)',
              border: '1px solid rgba(0, 242, 254, 0.35)',
              fontSize: '9.5px',
              fontWeight: '900',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: CC,
              marginBottom: '8px',
              fontFamily: "'Inter', sans-serif"
            }}>
              ⚡ 1. CLASSICAL DUPLICATION
            </div>

            <h3 style={{
              margin: '0 0 7px',
              fontSize: '14.5px',
              fontWeight: '800',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              lineHeight: '1.4'
            }}>
              First, see how Classical Bits are copied
            </h3>

            <p style={{
              margin: '0 0 8px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#cbd5e1',
              fontFamily: "'Inter', sans-serif"
            }}>
              A classical bit exists deterministically as <strong>0</strong> or <strong>1</strong>. A sensor non-destructively probes Bit 1's voltage and transfers the exact charge to Bit 2.
            </p>

            <div className="no-cloning-math" style={{
              padding: '8px 12px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(0, 242, 254, 0.28)',
              textAlign: 'center',
              color: '#f8fafc',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                <InlineMath math={String.raw`C(x, 0) = (x, x) \quad \text{for } x \in \{0, 1\}`} />
              </div>
            </div>

            <button
              onClick={handleTriggerClassicalCopy}
              style={{
                width: '100%',
                padding: '10px 18px',
                borderRadius: '12px',
                border: `1.5px solid ${CC}88`,
                background: `linear-gradient(135deg, ${CC}22, ${CC}44)`,
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
                boxShadow: `0 0 16px ${CC}40`,
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 0 24px ${CC}66`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 0 16px ${CC}40`;
              }}
            >
              Copy Classical Bit →
            </button>
          </div>
        )}

        {/* ========================================================== */}
        {/* STEP 3: CLASSICAL DONE TOOLTIP (ABOVE CLASSICAL BITS) */}
        {/* ========================================================== */}
        {step === 'classical_done' && (
          <div key="step-classical-done" style={cardStyle}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              fontSize: '9.5px',
              fontWeight: '900',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: CG,
              marginBottom: '8px',
              fontFamily: "'Inter', sans-serif"
            }}>
              ✅ CLASSICAL SUCCESS
            </div>

            <h3 style={{
              margin: '0 0 7px',
              fontSize: '14.5px',
              fontWeight: '800',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              lineHeight: '1.4'
            }}>
              Bit Copied Perfectly & Independently!
            </h3>

            <p style={{
              margin: '0 0 10px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#cbd5e1',
              fontFamily: "'Inter', sans-serif"
            }}>
              Bit 2 is now an identical clone of Bit 1 (<InlineMath math={String.raw`|1\rangle \otimes |1\rangle`} />). They are 100% independent—flipping or reading Bit 1 has zero effect on Bit 2.
            </p>

            <button
              onClick={handleStartQuantum}
              style={{
                width: '100%',
                padding: '10px 18px',
                borderRadius: '12px',
                border: `1.5px solid ${CP}88`,
                background: `linear-gradient(135deg, ${CP}22, ${CP}44)`,
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
                boxShadow: `0 0 16px ${CP}40`,
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 0 24px ${CP}66`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 0 16px ${CP}40`;
              }}
            >
              Let's see how Qubits are copied →
            </button>
          </div>
        )}

        {/* ========================================================== */}
        {/* STEP 4: QUANTUM FOCUS TOOLTIP (TOP-RIGHT) */}
        {/* ========================================================== */}
        {step === 'quantum_focus' && (
          <div key="step-quantum-focus" style={cardStyle}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '10px',
              background: 'rgba(192, 132, 252, 0.15)',
              border: '1px solid rgba(192, 132, 252, 0.4)',
              fontSize: '9.5px',
              fontWeight: '900',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: CP,
              marginBottom: '8px',
              fontFamily: "'Inter', sans-serif"
            }}>
              ⚛️ 2. THE QUANTUM ATTEMPT
            </div>

            <h3 style={{
              margin: '0 0 7px',
              fontSize: '14.5px',
              fontWeight: '800',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              lineHeight: '1.4'
            }}>
              Can we duplicate an unknown Qubit?
            </h3>

            <p style={{
              margin: '0 0 10px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#cbd5e1',
              fontFamily: "'Inter', sans-serif"
            }}>
              Qubit A holds an unmeasured, arbitrary superposition <InlineMath math={String.raw`|\psi\rangle = \alpha|0\rangle + \beta|1\rangle`} />. Qubit B is a blank target <InlineMath math={String.raw`|0\rangle`} />. Let's try applying a quantum <strong>CNOT gate</strong> to copy it!
            </p>

            <button
              onClick={handleTriggerCNOT}
              style={{
                width: '100%',
                padding: '10px 18px',
                borderRadius: '12px',
                border: `1.5px solid ${CP}88`,
                background: `linear-gradient(135deg, ${CP}22, ${CP}44)`,
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
                boxShadow: `0 0 16px ${CP}40`,
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 0 24px ${CP}66`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 0 16px ${CP}40`;
              }}
            >
              Attempt Quantum Copy (CNOT) →
            </button>
          </div>
        )}

        {/* ========================================================== */}
        {/* STEP 5: QUANTUM CNOT (ENTANGLEMENT TRAP) TOOLTIP (TOP-RIGHT) */}
        {/* ========================================================== */}
        {step === 'quantum_cnot' && (
          <div key="step-quantum-cnot" style={cardStyle}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '10px',
              background: 'rgba(192, 132, 252, 0.15)',
              border: '1px solid rgba(192, 132, 252, 0.4)',
              fontSize: '9.5px',
              fontWeight: '900',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: CP,
              marginBottom: '8px',
              fontFamily: "'Inter', sans-serif"
            }}>
              🔗 CNOT CREATES ENTANGLEMENT
            </div>

            <h3 style={{
              margin: '0 0 7px',
              fontSize: '14.5px',
              fontWeight: '800',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              lineHeight: '1.4'
            }}>
              Not a Clone: The Entanglement Trap!
            </h3>

            <p style={{
              margin: '0 0 8px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#cbd5e1',
              fontFamily: "'Inter', sans-serif"
            }}>
              Instead of two independent copies (<InlineMath math={String.raw`|\psi\rangle|\psi\rangle`} />), CNOT produced an <strong>entangled state</strong>. Neither qubit holds a definite state of its own anymore — the information now lives only in their joint correlations. Nothing was cloned!
            </p>

            <div className="no-cloning-math" style={{
              padding: '8px 12px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(192, 132, 252, 0.28)',
              textAlign: 'center',
              color: '#f8fafc',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '13px', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                <InlineMath math={String.raw`CNOT|\psi\rangle|0\rangle = \alpha|00\rangle + \beta|11\rangle`} />
              </div>
              <div style={{
                fontSize: '12px',
                color: '#fca5a5',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <InlineMath math={String.raw`\alpha|00\rangle + \beta|11\rangle`} />
                <span style={{ fontSize: '15px', fontWeight: '900', color: '#fca5a5', lineHeight: 1 }}>≠</span>
                <InlineMath math={String.raw`|\psi\rangle|\psi\rangle`} />
              </div>
            </div>

            <button
              onClick={handleTriggerCollapse}
              style={{
                width: '100%',
                padding: '10px 18px',
                borderRadius: '12px',
                border: `1.5px solid ${CR}88`,
                background: `linear-gradient(135deg, ${CR}22, ${CR}44)`,
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
                boxShadow: `0 0 16px ${CR}40`,
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 0 24px ${CR}66`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 0 16px ${CR}40`;
              }}
            >
              Try Reading & Recreating State →
            </button>
          </div>
        )}

        {/* ========================================================== */}
        {/* STEP 6: QUANTUM COLLAPSE & MATHEMATICAL PROOF (TOP-RIGHT) */}
        {/* ========================================================== */}
        {step === 'quantum_collapse' && (
          <div key="step-quantum-collapse" style={cardStyle}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              fontSize: '9.5px',
              fontWeight: '900',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: CR,
              marginBottom: '8px',
              fontFamily: "'Inter', sans-serif"
            }}>
              💥 NO-CLONING THEOREM PROVEN
            </div>

            <h3 style={{
              margin: '0 0 7px',
              fontSize: '14.5px',
              fontWeight: '800',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              lineHeight: '1.4'
            }}>
              Wavefunction Collapse & The Proof
            </h3>

            <p style={{
              margin: '0 0 8px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#fca5a5',
              fontFamily: "'Inter', sans-serif"
            }}>
              Measuring <InlineMath math={String.raw`|\psi\rangle`} /> violently snapped the wavefunction into <strong style={{ color: '#fff' }}><InlineMath math={`|${collapseOutcome}\\rangle`} /></strong>! The continuous superposition <InlineMath math={String.raw`(\alpha, \beta)`} /> is permanently destroyed.
            </p>

            <div className="no-cloning-math" style={{
              padding: '8px 12px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              textAlign: 'center',
              color: '#f8fafc',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '13px', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                <InlineMath math={String.raw`\langle\psi|\phi\rangle = (\langle\psi|\phi\rangle)^2 \implies \langle\psi|\phi\rangle \in \{0, 1\}`} />
              </div>
              <div style={{ fontSize: '10.5px', color: '#f87171', lineHeight: '1.35', fontWeight: '500' }}>
                Unitary physics preserves inner products. Universal cloning is impossible!
              </div>
            </div>

            <button
              onClick={handleGoToSummary}
              style={{
                width: '100%',
                padding: '10px 18px',
                borderRadius: '12px',
                border: '1.5px solid rgba(56, 189, 248, 0.8)',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(56, 189, 248, 0.45))',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 0 24px rgba(56, 189, 248, 0.65)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.4)';
              }}
            >
              Why This Protects Us (Quantum Security) →
            </button>
          </div>
        )}

        {/* ========================================================== */}
        {/* STEP 7: SUMMARY & QUANTUM SECURITY (TRUE BOTTOM-CENTER FLEX CONTAINER) */}
        {/* ========================================================== */}
        {step === 'summary' && (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 200
          }}>
            <div key="step-summary" style={{
              width: '395px',
              maxWidth: 'calc(100% - 48px)',
              background: 'transparent',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1.5px solid rgba(56, 189, 248, 0.55)',
              borderRadius: '20px',
              padding: '13px 18px',
              boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
              pointerEvents: 'auto',
              animation: 'ncTooltipEnter 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                fontSize: '9px',
                fontWeight: '900',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: '#38bdf8',
                marginBottom: '4px',
                fontFamily: "'Inter', sans-serif"
              }}>
                🛡️ THE QUANTUM SUPERPOWER
              </div>

              <h3 style={{
                margin: '0 0 4px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                lineHeight: '1.35'
              }}>
                Why No-Cloning Protects the Universe
              </h3>

              <p style={{
                margin: '0 0 8px',
                fontSize: '11px',
                lineHeight: '1.45',
                color: '#cbd5e1',
                fontFamily: "'Inter', sans-serif"
              }}>
                The No-Cloning Theorem is quantum mechanics' greatest superpower! In <strong>Quantum Key Distribution (BB84)</strong>, no eavesdropper can intercept and copy cryptographic photon keys without immediately leaving detectable collapse fingerprints.
              </p>

              <button
                onClick={handleReset}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid rgba(56, 189, 248, 0.8)',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(56, 189, 248, 0.4))',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  fontFamily: "'Inter', sans-serif",
                  cursor: 'pointer',
                  boxShadow: '0 0 14px rgba(56, 189, 248, 0.3)',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.55)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 14px rgba(56, 189, 248, 0.3)';
                }}
              >
                ↺ Restart Experience
              </button>
            </div>
          </div>
        )}

        {/* 🚀 Dynamic Bottom-Right Navigation Controller (always available) 🚀 */}
        <QuantumNavButtons
          canPrev={currentStepIdx > 0}
          canNext={step !== 'classical_copying'}
          onPrev={handleNCPrev}
          onNext={handleNCNext}
          prevLabel="Prev"
          nextLabel={step === 'summary' ? 'Restart' : 'Next'}
          isLast={step === 'summary'}
          accentColor={CC}
        />
      </div>
    </div>
  );
}
