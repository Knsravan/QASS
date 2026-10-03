import React, { useState, useRef, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { InlineMath } from 'react-katex';
import { MorphIcon } from 'morphicons/react';
import { Droplets, Calculator, Zap, Timer, Triangle, Thermometer, Flame, ArrowDown } from 'lucide';
import CameraShifter from './CameraShifter';
import { useDecoherenceAudio } from './useDecoherenceAudio';
import { QuantumNavButtons } from './QuantumNavButtons';
import { SCENE_GL } from './sceneGl';
import GlassSlider from './GlassSlider';
import { QualityComposer } from './QualityScene';
import { SharedCanvas } from './SharedCanvas';
import { handoff } from './handoff';


// ============================================================
// COLORS
// ============================================================
const CT = '#14b8a6'; // Teal - Pure
const CA = '#f59e0b'; // Amber - Noisy / Thermal
const CR = '#ef4444'; // Red - Bit Flip / Mixed
const CP = '#a855f7'; // Purple - Phase Flip
const CB = '#38bdf8'; // Blue - Cryogenic / Cold
const CG = '#22c55e'; // Green - Pure Purity
const CW = '#f8fafc'; // White

// How visible the noise particles are. Opened from the hub they start unseen and fade in
// with the cards (the App announces `qass-jelly-run`), and fade out with them on the way back.
const particleFade = { p: 1, target: 1 };
// The arrows' reach: opened from the hub they start at the hub qubit's shorter arrow and grow to full as the cards pop.
const arrowGrow = { p: 1, target: 1 };

// ============================================================
// CONSTANTS
// ============================================================
const SPHERE_R  = 2.75;
const MODEL_Y   = 1.65;
const PURE_POS  = [-5.8, MODEL_Y, 0];
const NOISY_POS = [ 5.8, MODEL_Y, 0];
const GHOST_N   = 12;

const DECO_STEPS = ['intro', 'what_is_decoherence', 'density_matrix', 'noise_types', 'coherence_time', 'lindblad', 'why_hard'];

const STEP_NOISE = {
  intro:               0.00,
  what_is_decoherence: 0.38,
  density_matrix:      0.55,
  noise_types:         0.65,
  coherence_time:      0.75,
  lindblad:            0.85,
  why_hard:            0.92,
};

// Cinematic drone camera waypoints (Positioned for zero UI overlap)
const CAM_WP = {
  intro:               { pos: [0,    MODEL_Y + 0.6, 20.0], look: [0,    MODEL_Y, 0] },
  what_is_decoherence: { pos: [3.8,  MODEL_Y + 0.3, 13.0], look: [5.8,  MODEL_Y, 0] },
  density_matrix:      { pos: [7.2,  MODEL_Y + 0.8, 10.2], look: [5.8,  MODEL_Y, 0] },
  noise_types:         { pos: [6.8,  MODEL_Y + 0.6, 11.2], look: [5.8,  MODEL_Y, 0] },
  coherence_time:      { pos: [6.8,  MODEL_Y + 0.6, 11.2], look: [5.8,  MODEL_Y, 0] },
  lindblad:            { pos: [3.8,  MODEL_Y + 0.4, 13.5], look: [5.2,  MODEL_Y, 0] },
  why_hard:            { pos: [-2.0, MODEL_Y + 0.5, 18.2], look: [0.2,  MODEL_Y, 0] },
};

// ============================================================
// DRONE CAMERA CONTROLLER
// ============================================================
function DroneCameraController({ step, audio }) {
  const { camera } = useThree();
  const tPos  = useRef(new THREE.Vector3(...CAM_WP.intro.pos));
  const tLook = useRef(new THREE.Vector3(...CAM_WP.intro.look));
  const sLook = useRef(new THREE.Vector3(0, MODEL_Y, 0));
  const prev  = useRef(step);
  const _wb   = useRef(new THREE.Vector3());
  const _tmp  = useRef(new THREE.Vector3());

  useEffect(() => {
    const wp = CAM_WP[step] || CAM_WP.intro;
    tPos.current.set(...wp.pos);
    tLook.current.set(...wp.look);
    if (prev.current !== step) {
      if (audio && audio.playCameraPan && step !== 'intro') audio.playCameraPan(1.8);
      prev.current = step;
    }
  }, [step, audio]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    _wb.current.set(Math.cos(t * 0.85) * 0.018, Math.sin(t * 1.25) * 0.025, 0);
    _tmp.current.copy(tPos.current).add(_wb.current);
    // Eased by 1 - e^(-k*dt): never past the target, however long a frame
    // takes (a plain delta * k overshoots once a frame runs past ~0.5 s, and
    // the camera then flies off).
    camera.position.lerp(_tmp.current, 1 - Math.exp(-1.8 * delta));
    sLook.current.lerp(tLook.current, 1 - Math.exp(-2.2 * delta));
    camera.lookAt(sLook.current);
  });

  return null;
}

// ============================================================
// 3D EXPONENTIAL DECAY RIBBON (Step 5 Coherence Trail)
// ============================================================
function DecayRibbon3D({ isVisible, noiseLevel }) {
  const lineRef = useRef();
  const points = useMemo(() => {
    const pts = [];
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const angle = u * Math.PI * 4;
      const radius = SPHERE_R * Math.exp(-u * 2.2);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (1.0 - u * 2.0) * 0.6;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, []);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return geom;
  }, [points]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const t = clock.getElapsedTime();
    if (isVisible) {
      lineRef.current.rotation.y = t * 0.35;
      lineRef.current.material.opacity = 0.45 + Math.sin(t * 2.0) * 0.15;
    } else {
      lineRef.current.material.opacity = 0;
    }
  });

  return (
    <line ref={lineRef} geometry={geometry} position={[0, 0, 0]}>
      <lineBasicMaterial color={CT} transparent opacity={0} linewidth={2} />
    </line>
  );
}

// ============================================================
// BLOCH SPHERE UNIT
// ============================================================
function BlochSphereUnit({ posArr, color, label, isPure, noiseLevel, activeNoise, noiseBurstId, entranceRef, posKey, step, tempK }) {
  const outerRef     = useRef();
  const shellRef     = useRef();
  const vectorGrpRef = useRef();
  const ghostRefs    = useRef([]);

  const phiRef   = useRef(Math.PI / 2);
  const thetaRef = useRef(isPure ? 0.2 : 0.8);
  const lenRef   = useRef(SPHERE_R);

  const activeNoiseRef = useRef(null);
  const noiseTimerRef  = useRef(0);

  const _up     = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const _target = useMemo(() => new THREE.Vector3(),         []);
  const _quat   = useMemo(() => new THREE.Quaternion(),      []);

  // Cryogenic color transition when temperature drops to 15 mK in Step 7
  const isCryo = !isPure && (tempK != null && tempK < 1.0);
  const activeUnitColor = isCryo ? CB : color;

  const ghostOffsets = useMemo(() =>
    Array.from({ length: GHOST_N }, (_, i) => ({
      ao: (i / GHOST_N) * Math.PI * 2,
      rs: 0.72 + (i % 3) * 0.12,
      ph: (i * 1.618) % (Math.PI * 2),
    })), []);

  useEffect(() => {
    if (!isPure && activeNoise) {
      activeNoiseRef.current = activeNoise;
      noiseTimerRef.current  = 0;
    }
  }, [activeNoise, noiseBurstId, isPure]);

  useFrame(({ clock }, delta) => {
    const t  = clock.getElapsedTime();
    const nl = noiseLevel;

    if (outerRef.current) {
      const sc = Math.max(0.0001, entranceRef.current[posKey] != null ? entranceRef.current[posKey] : 0);
      outerRef.current.scale.setScalar(sc);
      outerRef.current.position.x = posArr[0];
      outerRef.current.position.y = (posArr[1] || MODEL_Y) + (entranceRef.current.yRise != null ? entranceRef.current.yRise : 0);
      outerRef.current.position.z = posArr[2] || 0;
    }

    if (isPure) {
      thetaRef.current += delta * 0.38;
      phiRef.current = Math.PI / 2;
    } else {
      thetaRef.current += delta * (0.38 + Math.sin(t * 1.8) * nl * 0.55);
      phiRef.current    = Math.PI / 2 + Math.sin(t * 1.6) * nl * 0.65 + Math.cos(t * 2.2) * nl * 0.35;
    }

    let phiExtra = 0, thetaExtra = 0;
    if (activeNoiseRef.current && !isPure) {
      const tn    = noiseTimerRef.current;
      const decay = Math.exp(-tn * 1.2);
      if (activeNoiseRef.current === 'bitflip') {
        phiExtra = Math.sin(tn * 10) * decay * Math.PI * 0.95;
      }
      if (activeNoiseRef.current === 'phaseflip') {
        thetaExtra = Math.sin(tn * 12) * decay * Math.PI * 1.25;
      }
      if (activeNoiseRef.current === 'damping') {
        phiExtra = -Math.min(tn * 1.0, 1.4) * decay;
      }
      noiseTimerRef.current += delta;
      if (noiseTimerRef.current > 3.2) activeNoiseRef.current = null;
    }

    const targetLen = SPHERE_R * (1.0 - nl * 0.48);
    lenRef.current += (targetLen - lenRef.current) * 0.08;

    if (vectorGrpRef.current) {
      const fP = phiRef.current + phiExtra;
      const fT = thetaRef.current + thetaExtra;
      _target.set(Math.sin(fP) * Math.cos(fT), Math.cos(fP), Math.sin(fP) * Math.sin(fT));
      _quat.setFromUnitVectors(_up, _target);
      vectorGrpRef.current.quaternion.copy(_quat);
      vectorGrpRef.current.scale.setScalar(lenRef.current * (0.55 + 0.45 * arrowGrow.p));
      handoff.decQ[posKey].copy(_quat);
    }

    if (shellRef.current && !isPure) {
      const activePulse = activeNoiseRef.current ? 0.35 : 0.0;
      shellRef.current.material.opacity = 0.12 + Math.sin(t * (3.0 + nl * 8.0)) * nl * 0.22 + activePulse;
    }

    if (!isPure && nl > 0.04) {
      const fP = phiRef.current + phiExtra;
      const fT = thetaRef.current + thetaExtra;
      ghostRefs.current.forEach((ref, i) => {
        if (!ref) return;
        const { ao, rs, ph } = ghostOffsets[i];
        const spr = nl * 0.75 + (activeNoiseRef.current ? 0.35 : 0);
        const gP  = fP + Math.sin(t * 1.2  + ph) * spr;
        const gT  = fT + Math.cos(t * 0.95 + ph * 1.4 + ao) * spr;
        const gL  = lenRef.current * rs;
        ref.position.set(Math.sin(gP) * Math.cos(gT) * gL, Math.cos(gP) * gL, Math.sin(gP) * Math.sin(gT) * gL);
        if (ref.material) ref.material.opacity = nl * 0.42 * rs + (activeNoiseRef.current ? 0.3 : 0);
      });
    } else if (!isPure) {
      ghostRefs.current.forEach(r => { if (r && r.material) r.material.opacity = 0; });
    }
  });

  return (
    <group ref={outerRef}>
      {/* Outer Wireframe Sphere */}
      <mesh ref={shellRef}>
        <sphereGeometry args={[SPHERE_R, 30, 22]} />
        <meshBasicMaterial color={activeUnitColor} wireframe transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {/* Equatorial Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[SPHERE_R, 0.016, 12, 90]} />
        <meshBasicMaterial color={activeUnitColor} transparent opacity={0.35} depthWrite={false} />
      </mesh>

      {/* Latitudinal Rings */}
      <mesh position={[0, SPHERE_R * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[SPHERE_R * 0.866, 0.008, 8, 60]} />
        <meshBasicMaterial color={activeUnitColor} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh position={[0, -SPHERE_R * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[SPHERE_R * 0.866, 0.008, 8, 60]} />
        <meshBasicMaterial color={activeUnitColor} transparent opacity={0.15} depthWrite={false} />
      </mesh>

      {/* Vertical Meridian Ring */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[SPHERE_R, 0.010, 8, 80]} />
        <meshBasicMaterial color={activeUnitColor} transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* Z Axis (Green, Vertical) */}
      <mesh>
        <cylinderGeometry args={[0.016, 0.016, SPHERE_R * 2.25, 8]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.32} />
      </mesh>

      {/* X Axis (Red, Horizontal) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.016, SPHERE_R * 2.25, 8]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.32} />
      </mesh>

      {/* Top Status Chip (Above 3D Model) */}
      <Html position={[0, SPHERE_R + 0.88, 0]} center style={{ pointerEvents: 'none' }}>
        <div data-jelly style={{ '--j': 1,
          background: activeUnitColor + '1a', border: '1.5px solid ' + activeUnitColor + '55',
          borderRadius: '16px', padding: '5px 16px',
          fontSize: '11px', fontWeight: '800', color: activeUnitColor,
          fontFamily: "'Inter', sans-serif", letterSpacing: '1.8px',
          whiteSpace: 'nowrap', textTransform: 'uppercase',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px ' + activeUnitColor + '22',
          transition: 'all 0.4s ease',
        }}>
          {isCryo ? 'CRYOGENIC QUBIT (15 mK)' : label}
        </div>
      </Html>

      {/* |0⟩ Pole Label */}
      <Html position={[0, SPHERE_R + 0.32, 0]} center style={{ pointerEvents: 'none' }}>
        <span data-jelly style={{ '--j': 1, display: 'inline-block', color: '#64748b', fontSize: '11px', fontWeight: '700', fontFamily: 'Inter, sans-serif' }}>|0⟩</span>
      </Html>
      {/* |1⟩ Pole Label */}
      <Html position={[0, -SPHERE_R - 0.38, 0]} center style={{ pointerEvents: 'none' }}>
        <span data-jelly style={{ '--j': 1, display: 'inline-block', color: '#64748b', fontSize: '11px', fontWeight: '700', fontFamily: 'Inter, sans-serif' }}>|1⟩</span>
      </Html>

      {/* 3D Coherence Decay Ribbon (Step 5 on Noisy Qubit) */}
      {!isPure && <DecayRibbon3D isVisible={step === 'coherence_time'} noiseLevel={noiseLevel} />}

      {/* State Vector Arrow (Shaft + Pointed Cone Arrowhead) */}
      <group ref={vectorGrpRef}>
        {/* Vector Shaft */}
        <mesh position={[0, 0.44, 0]}>
          <cylinderGeometry args={[0.034, 0.034, 0.88, 12]} />
          <meshStandardMaterial color={activeUnitColor} emissive={activeUnitColor} emissiveIntensity={0.85} />
        </mesh>
        {/* Pointed Arrowhead */}
        <mesh position={[0, 0.98, 0]}>
          <coneGeometry args={[0.15, 0.34, 16]} />
          <meshStandardMaterial color={activeUnitColor} emissive={activeUnitColor} emissiveIntensity={2.2} />
        </mesh>
      </group>

      {/* Ghost Tips (Noisy Sphere Only) */}
      {!isPure && ghostOffsets.map((_, i) => (
        <mesh key={i} ref={el => { ghostRefs.current[i] = el; }}>
          <coneGeometry args={[0.10, 0.24, 10]} />
          <meshStandardMaterial color={CA} emissive={CA} emissiveIntensity={1.8} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================
// NOISE PARTICLE SYSTEM (Cryogenic Crystallization Support)
// ============================================================
function ParticleSystem({ color, count, noiseLevel, seedOffset, activeNoise, tempK, particleType }) {
  const meshRef = useRef();
  const dummy   = useRef(new THREE.Object3D()).current;
  const tmpVec  = useRef(new THREE.Vector3()).current;

  const state = useRef(null);
  if (!state.current) {
    const s = [];
    for (let i = 0; i < count; i++) {
      const j = i + (seedOffset || 0);
      const u = ((j * 1.618) % 1);
      const initX = -0.6 + u * 4.2;
      const height = MODEL_Y + (((j * 3.141) % 1) - 0.5) * 4.4;
      const initZ = (((j * 2.718) % 1) - 0.5) * 4.8;
      s.push({
        baseX: initX,
        x: initX,
        y: height,
        z: initZ,
        driftSpeed: 0.45 + ((j % 7) * 0.09),
        wobblePhase: (j * 1.414) % (Math.PI * 2),
        wobbleSpeed: 0.90 + ((j % 5) * 0.25),
        vx: 0, vy: 0, vz: 0,
        angle: (i / count) * Math.PI * 2,
      });
    }
    state.current = s;
  }

  const isCold = tempK != null && tempK < 1.0;
  const renderColor = isCold ? CB : color;

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;
    const t  = clock.getElapsedTime();
    const nl = noiseLevel;
    const ps = state.current;
    meshRef.current.visible = particleFade.p > 0.01;
    meshRef.current.material.opacity = 0.88 * particleFade.p;

    // In cryogenic temperatures (15 mK), thermal kinetic speed dramatically drops
    const thermalSpeed = Math.max(0.04, Math.sqrt((tempK || 300) / 300));
    const agitatedSpeed = thermalSpeed * (1.0 + nl * 1.8);
    const shieldRadius = SPHERE_R + 0.85;
    const shieldRadiusSq = shieldRadius * shieldRadius;

    for (let i = 0; i < count; i++) {
      const p = ps[i];

      // ========================================================
      // 1. SPECIFIC STEP 4 ACTIVE NOISE TYPE ATTACK FORMATIONS
      // ========================================================
      if (activeNoise === 'bitflip' && particleType === 'bitflip') {
        const targetX = NOISY_POS[0] + Math.sin(t * 8 + p.wobblePhase) * 1.8;
        const targetY = MODEL_Y + (Math.sin(t * 10 + (i * 0.6)) > 0 ? 1.5 : -1.5);
        const targetZ = Math.cos(t * 7 + p.wobblePhase) * 1.3;
        p.x += (targetX - p.x) * 0.14;
        p.y += (targetY - p.y) * 0.15;
        p.z += (targetZ - p.z) * 0.14;
      }
      else if (activeNoise === 'phaseflip' && particleType === 'phaseflip') {
        p.angle += delta * (4.8 + (i % 3) * 1.2);
        const rTornado = 1.8 + ((i % 4) * 0.35);
        const targetX = NOISY_POS[0] + Math.cos(p.angle) * rTornado;
        const targetZ = Math.sin(p.angle) * rTornado;
        const targetY = MODEL_Y + Math.sin(p.angle * 2 + p.wobblePhase) * 0.35;
        p.x += (targetX - p.x) * 0.12;
        p.y += (targetY - p.y) * 0.12;
        p.z += (targetZ - p.z) * 0.12;
      }
      else if (activeNoise === 'damping' && particleType === 'thermal') {
        p.y -= delta * (2.8 + (i % 4) * 0.8);
        const rDrain = 0.9 + ((i * 1.2) % 1.1);
        const ang = (i * 1.618) + t * 1.2;
        p.x = NOISY_POS[0] + Math.cos(ang) * rDrain;
        p.z = Math.sin(ang) * rDrain;
        if (p.y < MODEL_Y - SPHERE_R - 1.0) {
          p.y = MODEL_Y + SPHERE_R + 0.8 + Math.random() * 0.6;
        }
      }
      else {
        // ========================================================
        // 2. NATURAL AMBIENT CENTER-TO-RIGHT RIVER STREAM
        // ========================================================
        const targetY = MODEL_Y + Math.sin(t * 0.65 * p.wobbleSpeed * agitatedSpeed + p.wobblePhase) * 2.2;
        const targetZ = Math.cos(t * 0.55 * p.wobbleSpeed * agitatedSpeed + p.wobblePhase * 1.2) * 2.6;

        p.y += (targetY - p.y) * 0.025 * agitatedSpeed;
        p.z += (targetZ - p.z) * 0.025 * agitatedSpeed;
        p.x += Math.sin(t * 0.45 * p.driftSpeed * agitatedSpeed + p.wobblePhase) * 0.018 * agitatedSpeed;

        // Pure qubit vacuum shield
        const dxP = p.x - PURE_POS[0];
        const dyP = p.y - PURE_POS[1];
        const dzP = p.z - PURE_POS[2];
        const d2P = dxP * dxP + dyP * dyP + dzP * dzP;
        if (d2P < shieldRadiusSq) {
          const dP = Math.sqrt(d2P) || 0.001;
          const push = (shieldRadius - dP) * 0.32;
          p.x += (dxP / dP) * push;
          p.y += (dyP / dP) * push * 0.5;
          p.z += (dzP / dP) * push;
          p.vx = Math.abs(p.vx) + 0.03;
        }

        if (p.x < -1.0) {
          p.x = -1.0 + Math.random() * 0.4;
          p.vx = Math.abs(p.vx) + 0.02;
        }

        // Pull toward Noisy Qubit
        if (nl > 0.02) {
          const dxN = NOISY_POS[0] - p.x;
          const dyN = NOISY_POS[1] - p.y;
          const dzN = -p.z;
          const d2N = dxN * dxN + dyN * dyN + dzN * dzN;
          const pull = nl * 0.038 * thermalSpeed / Math.max(d2N, 0.6);
          p.vx += dxN * pull;
          p.vy += dyN * pull * 0.40;
          p.vz += dzN * pull * 0.50;
        }

        p.vx *= 0.95; p.vy *= 0.95; p.vz *= 0.95;
        p.x  += p.vx; p.y  += p.vy; p.z  += p.vz;

        // Impact & dissolve on front face and recycle back to central corridor
        tmpVec.set(p.x - NOISY_POS[0], p.y - NOISY_POS[1], p.z);
        if (tmpVec.lengthSq() < (SPHERE_R * 0.90) * (SPHERE_R * 0.90) || p.x > 5.4) {
          p.x = -0.8 + Math.random() * 2.8;
          p.y = MODEL_Y + (Math.random() - 0.5) * 4.2;
          p.z = (Math.random() - 0.5) * 4.6;
          p.vx = 0.025 * (1.0 + nl) * thermalSpeed;
          p.vy = 0;
          p.vz = 0;
        }
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const isActiveType = (activeNoise === 'bitflip' && particleType === 'bitflip') ||
                       (activeNoise === 'phaseflip' && particleType === 'phaseflip') ||
                       (activeNoise === 'damping' && particleType === 'thermal');
  const emissiveInt = isActiveType ? 6.2 : isCold ? 4.5 : 3.2;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[isActiveType ? 0.12 : 0.088, 8, 8]} />
      <meshStandardMaterial
        color={renderColor}
        emissive={renderColor}
        emissiveIntensity={emissiveInt}
        roughness={0.1}
        metalness={0.9}
        transparent
        opacity={0.88}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function NoiseParticleField({ noiseLevel, activeNoise, tempK }) {
  return (
    <>
      <ParticleSystem color={CA}       count={42} noiseLevel={noiseLevel} seedOffset={0}   activeNoise={activeNoise} tempK={tempK} particleType="thermal"   />
      <ParticleSystem color="#06b6d4"  count={40} noiseLevel={noiseLevel} seedOffset={100} activeNoise={activeNoise} tempK={tempK} particleType="em"        />
      <ParticleSystem color={CR}       count={38} noiseLevel={noiseLevel} seedOffset={200} activeNoise={activeNoise} tempK={tempK} particleType="bitflip"   />
      <ParticleSystem color={CP}       count={38} noiseLevel={noiseLevel} seedOffset={300} activeNoise={activeNoise} tempK={tempK} particleType="phaseflip" />
    </>
  );
}

// ============================================================
// 3D SCENE
// ============================================================
function ParticleFader() {
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-3.2 * Math.min(delta, 0.1));
    particleFade.p += (particleFade.target - particleFade.p) * k;
    if (Math.abs(particleFade.target - particleFade.p) < 0.004) particleFade.p = particleFade.target;
    arrowGrow.p += (arrowGrow.target - arrowGrow.p) * k;
    if (Math.abs(arrowGrow.target - arrowGrow.p) < 0.004) arrowGrow.p = arrowGrow.target;
  });
  return null;
}

function DecoherenceScene({ step, noiseLevel, activeNoise, noiseBurstId, entranceRef, audio, tempK }) {
  return (
    <>
      <ParticleFader />
      <DroneCameraController step={step} audio={audio} />
      <ambientLight intensity={0.16} />
      <pointLight position={[-6, MODEL_Y + 5, 7]} intensity={0.95} color={CT} />
      <pointLight position={[ 6, MODEL_Y + 5, 7]} intensity={0.95} color={tempK < 1 ? CB : CA} />
      <pointLight position={[ 0, MODEL_Y + 7, 9]} intensity={0.38} color="#ffffff" />
      <BlochSphereUnit posArr={PURE_POS}  color={CT} label="Pure Qubit"  isPure={true}  noiseLevel={0}          activeNoise={null}        entranceRef={entranceRef} posKey="pure"  step={step} tempK={tempK} />
      <BlochSphereUnit posArr={NOISY_POS} color={CA} label="Noisy Qubit" isPure={false} noiseLevel={noiseLevel} activeNoise={activeNoise} noiseBurstId={noiseBurstId} entranceRef={entranceRef} posKey="noisy" step={step} tempK={tempK} />
      <NoiseParticleField noiseLevel={noiseLevel} activeNoise={activeNoise} tempK={tempK} />
      <QualityComposer>
        <Bloom intensity={0.65} luminanceThreshold={0.16} luminanceSmoothing={0.88} />
      </QualityComposer>
    </>
  );
}

// ============================================================
// LIVE DENSITY MATRIX DISPLAY
// ============================================================
function DensityMatrixDisplay({ noiseLevel, onSliderChange }) {
  const r01  = 0.5 * Math.exp(-noiseLevel * 4.8);
  const trSq = 0.5 + 2 * r01 * r01;
  const tColor = trSq > 0.82 ? CG : trSq > 0.62 ? CA : CR;
  const purity = Math.round(Math.max(0, Math.min(100, (trSq - 0.5) * 200)));
  const pLabel = trSq > 0.82 ? 'PURE' : trSq > 0.62 ? 'MIXING' : 'MIXED';

  return (
    <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid ' + tColor + '44', borderRadius: '14px', padding: '12px 14px', marginTop: '10px', transition: 'border-color 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700', letterSpacing: '1.2px', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Live Density Matrix ρ</span>
        <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '1px', color: tColor, background: tColor + '22', padding: '2px 8px', borderRadius: '8px', transition: 'all 0.3s ease', fontFamily: "'Inter', sans-serif" }}>{pLabel}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontFamily: "'Inter', monospace", fontSize: '13px', fontWeight: '700', borderLeft: '2px solid ' + tColor + '66', borderRight: '2px solid ' + tColor + '66', padding: '6px 10px', margin: '0 8px 8px', borderRadius: '2px' }}>
        <div style={{ color: CW }}>0.500</div>
        <div style={{ color: tColor, transition: 'color 0.2s ease' }}>{r01.toFixed(3)}</div>
        <div style={{ color: tColor, transition: 'color 0.2s ease' }}>{r01.toFixed(3)}</div>
        <div style={{ color: CW }}>0.500</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>
          Purity <InlineMath math="\mathrm{Tr}(\rho^2)" /> = <span style={{ color: tColor, fontWeight: '700', transition: 'color 0.2s ease' }}>{trSq.toFixed(3)}</span>
        </span>
        <span style={{ fontSize: '10.5px', color: tColor, fontFamily: "'Inter', monospace", fontWeight: '700' }}>{purity}%</span>
      </div>

      {onSliderChange && (
        <div style={{ marginTop: '8px' }}>
          <GlassSlider
            min="0"
            max="100"
            value={Math.round(noiseLevel * 100)}
            onChange={(e) => onSliderChange(Number(e.target.value) / 100)}
            color={tColor}
            format={(v) => `${v}%`}
            aria-label="Noise level"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginTop: '4px', fontFamily: "'Inter', sans-serif" }}>
            <span style={{ color: CG, fontWeight: '700' }}>◀ Pure (1.0)</span>
            <span style={{ color: '#94a3b8' }}>Drag to test Decoherence</span>
            <span style={{ color: CR, fontWeight: '700' }}>Mixed (0.5) ▶</span>
          </div>
        </div>
      )}

      {!onSliderChange && (
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
          <div style={{ width: purity + '%', background: 'linear-gradient(90deg, ' + tColor + ', ' + tColor + 'bb)', height: '100%', borderRadius: '4px', transition: 'width 0.08s ease, background 0.3s ease', boxShadow: '0 0 8px ' + tColor + '88' }} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// DECAY CURVE CHART (2D Canvas with 1/e Crossover)
// ============================================================
function DecayCurveChart({ noiseLevel }) {
  const canvasRef = useRef(null);
  const nlRef = useRef(noiseLevel);
  nlRef.current = noiseLevel;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 280, H = canvas.offsetHeight || 95;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const T2 = 2.5, xMax = 6, PL = 38, PR = 12, PT = 10, PB = 28;
    const cW = W - PL - PR, cH = H - PT - PB;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL, PT); ctx.lineTo(PL, H - PB); ctx.lineTo(W - PR, H - PB); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const xn = i/120, x = PL + xn*cW, y = (H-PB) - cH*Math.exp(-(xn*xMax)/T2); if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.lineTo(PL+cW, H-PB); ctx.lineTo(PL, H-PB); ctx.closePath();
      ctx.fillStyle = CT + '18'; ctx.fill();
      ctx.strokeStyle = CT; ctx.lineWidth = 2.2; ctx.shadowColor = CT; ctx.shadowBlur = 7;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const xn = i/120, x = PL + xn*cW, y = (H-PB) - cH*Math.exp(-(xn*xMax)/T2); if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.stroke(); ctx.shadowBlur = 0;
      const t2xn = T2/xMax, t2x = PL + t2xn*cW, t2y = (H-PB) - cH*Math.exp(-1);
      ctx.strokeStyle = CA; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(t2x, PT); ctx.lineTo(t2x, H-PB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = CA; ctx.lineWidth = 0.8; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(PL, t2y); ctx.lineTo(t2x, t2y); ctx.stroke();
      ctx.setLineDash([]);
      const nl = Math.max(0, Math.min(0.99, nlRef.current));
      const mxn = nl * 0.85, mx = PL + mxn*cW, my = (H-PB) - cH*Math.exp(-(mxn*xMax)/T2);
      ctx.fillStyle = CT; ctx.shadowColor = CT; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#475569'; ctx.fillText('|ρ₀₁|', 2, H/2+4);
      ctx.fillText('t', W-PR-6, H-PB+10);
      ctx.fillStyle = CA; ctx.fillText('T₂', t2x-5, H-PB+10);
      ctx.fillStyle = '#64748b'; ctx.fillText('1/e', 2, t2y+4);
    };
    draw();
    const id = setInterval(draw, 80);
    return () => clearInterval(id);
  }, []);
  return <canvas ref={canvasRef} style={{ width: '100%', height: '95px', borderRadius: '10px', marginTop: '8px', display: 'block' }} />;
}

// ============================================================
// TEMPERATURE METER (Cryogenic 15 mK Scale)
// ============================================================
function TemperatureMeter({ tempK }) {
  const color = tempK > 100 ? CR : tempK > 10 ? CA : tempK > 1 ? CT : CB;
  const label = tempK >= 1 ? Math.round(tempK) + ' K' : (tempK * 1000).toFixed(1) + ' mK';
  return (
    <div style={{ background: 'rgba(0,0,0,0.35)', border: '1.5px solid ' + color + '55', borderRadius: '14px', padding: '12px 16px', marginTop: '10px', transition: 'border-color 0.4s ease', boxShadow: '0 0 24px ' + color + '22' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Operating Temperature</span>
        <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '1px', color, background: color + '22', padding: '2px 8px', borderRadius: '8px', fontFamily: "'Inter', sans-serif" }}>CRYOGENIC</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '900', color, fontFamily: 'Inter, monospace', transition: 'color 0.4s ease' }}>{label}</div>
      <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '4px', height: '6px', overflow: 'hidden', marginTop: '8px' }}>
        <div style={{ width: Math.max(5, Math.min(100, (tempK / 300) * 100)) + '%', background: 'linear-gradient(90deg, ' + color + ', ' + color + 'bb)', height: '100%', borderRadius: '4px', transition: 'width 0.3s ease, background 0.4s ease', boxShadow: '0 0 10px ' + color + 'aa' }} />
      </div>
    </div>
  );
}

// ============================================================
// STEP CARD BADGE
// ============================================================
const Badge = ({ icon: Icon, text, color: bc }) => {
  const c = bc || CT;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase', color: c, background: c + '20', border: '1px solid ' + c + '44', borderRadius: '20px', padding: '4px 10px', marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
      {typeof Icon === 'object' || typeof Icon === 'function' ? (
        <MorphIcon icon={Icon} spring="smooth" strokeWidth={1} size={13} color={c} />
      ) : (
        <span>{Icon}</span>
      )}
      <span>{text}</span>
    </div>
  );
};

// ============================================================
// MAIN MODULE
// ============================================================
export default function DecoherenceModule({ theme, isSidebarOpen, isGlobalMuted, onNavigateToModule, fromHub = false }) {
  const audio = useDecoherenceAudio(isGlobalMuted);
  const [step, setStep]                           = useState('intro');
  const [introTooltipVisible, setIntroTooltipVisible] = useState(false);
  const [noiseLevel, setNoiseLevel]               = useState(0);
  const [activeNoise, setActiveNoise]             = useState(null);
  const [noiseBurstId, setNoiseBurstId]           = useState(0);
  const [tempK, setTempK]                         = useState(300);
  const [showTempMeter, setShowTempMeter]         = useState(false);

  const currentSidebarWidth = isSidebarOpen ? 420 : 112;

  const noiseTween          = useRef({ value: 0 });
  const tempTween           = useRef({ value: 300 });
  // Opened from the hub, the two qubits arrive already in place (the hub's pair zoomed into them).
  const entranceAnim        = useRef(fromHub ? { pure: 1, noisy: 1, yRise: 0 } : { pure: 0, noisy: 0, yRise: -2.5 });
  const fadeInit            = useRef(false);
  if (!fadeInit.current) { fadeInit.current = true; particleFade.p = particleFade.target = arrowGrow.p = arrowGrow.target = fromHub ? 0 : 1; }
  useEffect(() => {
    const run = () => { particleFade.target = 1; arrowGrow.target = 1; };
    const out = () => { particleFade.target = 0; arrowGrow.target = 0; };
    window.addEventListener('qass-jelly-run', run);
    window.addEventListener('qass-jelly-out', out);
    return () => { window.removeEventListener('qass-jelly-run', run); window.removeEventListener('qass-jelly-out', out); particleFade.p = particleFade.target = arrowGrow.p = arrowGrow.target = 1; };
  }, []);
  const noiseTimerRef       = useRef(null);
  const bloomTimerRef       = useRef(null);
  const entranceTlRef       = useRef(null);
  const entranceFallbackRef = useRef(null);

  const audioRef = useRef(audio);
  useEffect(() => { audioRef.current = audio; });

  // Browsers keep the AudioContext suspended until a user gesture,
  // so re-attempt the unlock on the first pointer interaction.
  useEffect(() => {
    const unlock = () => { audioRef.current.initAudio().catch(() => {}); };
    unlock();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const runEntrance = useCallback((onDone) => {
    if (entranceTlRef.current) entranceTlRef.current.kill();
    clearTimeout(entranceFallbackRef.current);
    // rAF can stall while the canvas warms up; guarantee the intro CTA appears promptly regardless
    entranceFallbackRef.current = setTimeout(onDone, 2200);
    const tl = gsap.timeline({
      delay: 0.05,
      onComplete: () => { clearTimeout(entranceFallbackRef.current); onDone(); },
    });
    tl.to(entranceAnim.current, { pure:  1, duration: 1.0, ease: 'back.out(1.4)' }, 0.0);
    tl.to(entranceAnim.current, { noisy: 1, duration: 1.0, ease: 'back.out(1.4)' }, 0.22);
    tl.to(entranceAnim.current, { yRise: 0, duration: 1.3, ease: 'power3.out'    }, 0.0);
    tl.to({}, { duration: 0.3 });
    entranceTlRef.current = tl;
  }, []);

  useEffect(() => {
    if (fromHub) { setIntroTooltipVisible(true); return; }
    entranceAnim.current = { pure: 0, noisy: 0, yRise: -2.5 };
    setIntroTooltipVisible(false);
    bloomTimerRef.current = setTimeout(() => audioRef.current.playModuleEntranceBloom(), 80);
    runEntrance(() => setIntroTooltipVisible(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuous peaceful quantum particle atmospheric stream
  useEffect(() => {
    if (!isGlobalMuted) audioRef.current.startAmbientParticleStream();
    return () => {
      audioRef.current.stopAmbientParticleStream();
    };
  }, [isGlobalMuted]);

  // Real-time animation-driven variant modulation
  useEffect(() => {
    audioRef.current.updateAmbientParticleStream({ noiseLevel, activeNoise, tempK });
  }, [noiseLevel, activeNoise, tempK]);

  useEffect(() => {
    const target = STEP_NOISE[step] != null ? STEP_NOISE[step] : 0;
    gsap.killTweensOf(noiseTween.current);
    gsap.to(noiseTween.current, { value: target, duration: 1.5, ease: 'power2.inOut', onUpdate: () => setNoiseLevel(noiseTween.current.value) });
  }, [step]);

  useEffect(() => () => {
    clearTimeout(noiseTimerRef.current);
    clearTimeout(bloomTimerRef.current);
    clearTimeout(entranceFallbackRef.current);
    if (entranceTlRef.current) entranceTlRef.current.kill();
    gsap.killTweensOf(noiseTween.current);
    gsap.killTweensOf(tempTween.current);
  }, []);

  const currentStepIdx = DECO_STEPS.indexOf(step);

  const handleStart     = useCallback(() => { audio.playButtonClick(); setStep('what_is_decoherence'); }, [audio]);
  const handleNext      = useCallback((s) => { audio.playButtonClick(); setStep(s); }, [audio]);

  const handleReset = useCallback(() => {
    audio.playButtonClick();
    setStep('intro'); setActiveNoise(null); setShowTempMeter(false);
    clearTimeout(noiseTimerRef.current);
    gsap.killTweensOf(noiseTween.current); gsap.killTweensOf(tempTween.current);
    gsap.set(noiseTween.current, { value: 0 }); gsap.set(tempTween.current, { value: 300 });
    setNoiseLevel(0); setTempK(300);
    entranceAnim.current = { pure: 0, noisy: 0, yRise: -2.5 };
    setIntroTooltipVisible(false);
    clearTimeout(bloomTimerRef.current);
    bloomTimerRef.current = setTimeout(() => audioRef.current.playModuleEntranceBloom(), 120);
    runEntrance(() => setIntroTooltipVisible(true));
  }, [audio, runEntrance]);

  const handleDecoPrev = useCallback(() => {
    if (currentStepIdx > 0) {
      audio.playButtonClick();
      setStep(DECO_STEPS[currentStepIdx - 1]);
    }
  }, [audio, currentStepIdx]);

  const handleDecoNext = useCallback(() => {
    if (currentStepIdx < DECO_STEPS.length - 1) {
      audio.playButtonClick();
      setStep(DECO_STEPS[currentStepIdx + 1]);
    } else {
      handleReset();
    }
  }, [audio, currentStepIdx, handleReset]);

  const handleNoiseSlider = useCallback((val) => {
    gsap.killTweensOf(noiseTween.current);
    noiseTween.current.value = val;
    setNoiseLevel(val);
  }, []);

  const handleNoiseType = useCallback((type) => {
    audio.playButtonClick();
    if (type === 'bitflip')   audio.playBitFlip();
    if (type === 'phaseflip') audio.playPhaseFlip();
    if (type === 'damping')   audio.playAmplitudeDamping();
    setActiveNoise(type);
    setNoiseBurstId(n => n + 1);
    clearTimeout(noiseTimerRef.current);
    noiseTimerRef.current = setTimeout(() => setActiveNoise(null), 3200);
  }, [audio]);

  const handleExploreQEC = useCallback(() => {
    if (onNavigateToModule) {
      audio.playButtonClick();
      onNavigateToModule('error-correction');
    } else {
      handleReset();
    }
  }, [audio, onNavigateToModule, handleReset]);

  const handleDropTemp = useCallback(() => {
    audio.playTemperatureDrop(); setShowTempMeter(true);
    gsap.to(tempTween.current,  { value: 0.015, duration: 2.5, ease: 'power3.out', onUpdate: () => setTempK(tempTween.current.value) });
    gsap.to(noiseTween.current, { value: 0.10,  duration: 2.5, ease: 'power3.out', onUpdate: () => setNoiseLevel(noiseTween.current.value) });
  }, [audio]);

  // Viewport bounds styling for perfect responsive alignment
  const uiBoundsStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: currentSidebarWidth + 'px',
    transition: 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    pointerEvents: 'none',
    zIndex: 200,
  };

  const cardStyle = useMemo(() => ({
    position: 'absolute', top: '32px', right: '24px',
    width: '360px', maxWidth: 'calc(100% - 48px)',
    background: 'transparent',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1.5px solid ' + CT + '44',
    borderRadius: '20px', padding: '18px 20px',
    boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
    pointerEvents: 'auto',
    animation: 'ncTooltipEnter 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
    zIndex: 200,
  }), []);

  const titleStyle = { fontSize: '17px', fontWeight: '800', color: CW, marginBottom: '10px', fontFamily: "'Inter', sans-serif", lineHeight: 1.35 };
  const textStyle  = { fontSize: '13px', color: '#94a3b8', lineHeight: 1.65, marginBottom: '10px', fontFamily: "'Inter', sans-serif" };
  const mathStyle  = { padding: '10px 14px', borderRadius: '12px', background: 'transparent', border: '1px solid ' + CT + '2a', color: CW, marginBottom: '10px' };
  const btnP       = {
    width: '100%',
    height: '48px',
    padding: '0 24px',
    borderRadius: '999px',
    background: 'var(--glass-bg-pill)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1px solid rgba(56, 189, 248, 0.45)',
    color: '#38bdf8',
    fontSize: '13.5px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '0.2px',
    boxShadow: 'var(--glass-highlight), var(--glass-shadow-pill)',
    transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    userSelect: 'none',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'transparent' }}>
      {/* 3D CANVAS WITH CAMERA SHIFTER */}
      <SharedCanvas
        sceneId="bit-scene"
        camera={{ position: [0, MODEL_Y + 0.6, 20.0], fov: 44 }}
        gl={SCENE_GL}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      >
        <Suspense fallback={null}>
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <DecoherenceScene step={step} noiseLevel={noiseLevel} activeNoise={activeNoise} noiseBurstId={noiseBurstId} entranceRef={entranceAnim} audio={audio} tempK={tempK} />
        </Suspense>
      </SharedCanvas>

      {/* 2D OVERLAY BOUNDED TO VIEWPORT AREA */}
      <div style={uiBoundsStyle}>
        {/* TOP-LEFT NOISE FIELD SPECTRA LEGEND CARD */}
        <div data-jelly style={{
          '--j': 0,
          position: 'absolute',
          top: '24px',
          left: '24px',
          width: '236px',
          // Same glass as the step cards (cardStyle), not a dark fill of its own.
          background: 'transparent',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1.5px solid ' + CT + '44',
          borderRadius: '16px',
          padding: '12px 14px',
          boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
          opacity: step === 'intro' ? 1 : 0,
          transform: step === 'intro' ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.96)',
          transition: 'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1), transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: step === 'intro' ? 'auto' : 'none',
          zIndex: 100,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '9.5px',
            fontWeight: '800',
            letterSpacing: '1.4px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: '9px',
            fontFamily: "'Inter', sans-serif"
          }}>
            <span style={{ fontSize: '12px' }}>✨</span>
            <span>Noise Field Spectra</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {[
              { color: CA, label: 'Thermal Phonons', desc: 'Lattice heat vibrations (T₁ decay)' },
              { color: '#06b6d4', label: 'Stray EM Photons', desc: 'Stray microwave radiation' },
              { color: CR, label: 'Bit-Flip Noise', desc: 'Random |0⟩ ↔ |1⟩ flips (X)' },
              { color: CP, label: 'Phase / Flux Noise', desc: 'Randomizes phase α → −α (Z)' },
            ].map(({ color: pc, label, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: pc,
                  marginTop: '3px',
                  flexShrink: 0,
                  boxShadow: '0 0 8px ' + pc,
                }} />
                <div style={{ fontFamily: "'Inter', sans-serif" }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#f8fafc', lineHeight: 1.2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748b', lineHeight: 1.25 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* INTRO: COMPACT & SLEEK DID YOU KNOW TOOLTIP */}
        {step === 'intro' && introTooltipVisible && (
          <div style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 200 }}>
            <div key="step-intro" data-jelly style={{
              width: '380px', maxWidth: 'calc(100% - 40px)',
              background: 'transparent',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1.5px solid ' + CT + '44', borderRadius: '18px', padding: '14px 18px',
              boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
              animation: 'ncTooltipEnter 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
              pointerEvents: 'auto',
            }}>
              <div style={{ fontSize: '9.5px', fontWeight: '800', letterSpacing: '1.8px', color: CT, textTransform: 'uppercase', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                💧 Did You Know?
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: CW, marginBottom: '6px', fontFamily: "'Inter', sans-serif", lineHeight: 1.35 }}>
                Quantum computers run colder than outer space
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '12px', fontFamily: "'Inter', sans-serif" }}>
                A qubit's quantum state is <strong style={{ color: CW }}>extraordinarily fragile</strong>. Even a single photon or the tiniest vibration can instantly destroy its superposition — a process called <strong style={{ color: CT }}>Decoherence</strong>. This is quantum computing's #1 challenge.
              </div>
              <button onClick={handleStart} style={{ width: '100%', padding: '9px 16px', borderRadius: '11px', background: 'linear-gradient(135deg, ' + CT + '33, ' + CT + '18)', border: '1.5px solid ' + CT + '77', color: CT, fontSize: '12px', fontWeight: '800', cursor: 'pointer', fontFamily: "'Inter', sans-serif", letterSpacing: '0.4px', transition: 'all 0.2s ease' }}>
                Let's Explore Decoherence →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: WHAT IS DECOHERENCE */}
        {step === 'what_is_decoherence' && (
          <div key="step-what" data-jelly style={cardStyle}>
            <Badge icon={Droplets} text="Decoherence Explained" />
            <div style={titleStyle}>What is Decoherence?</div>
            <div style={textStyle}>Your qubit lives in a perfect superposition: <InlineMath math="\alpha|0\rangle + \beta|1\rangle" />. But the universe is <strong style={{ color: CW }}>not isolated</strong>. Every air molecule, stray photon, and chip vibration bumps into your qubit and steals a bit of its quantum-ness.</div>
            <div style={textStyle}>Each interaction <strong style={{ color: CT }}>entangles your qubit with the environment</strong>, leaking its coherence away — permanently.</div>
            
            <div style={{ ...mathStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                <InlineMath math="|\psi\rangle = \alpha|0\rangle + \beta|1\rangle \;\xrightarrow{\text{environment}}\; \rho(t)" />
              </div>
              <div style={{ fontSize: '12.5px', color: CW }}>
                <InlineMath math="\rho(t) = \begin{pmatrix} |\alpha|^2 & \alpha\beta^* e^{-t/T_2} \\[4pt] \alpha^*\beta\, e^{-t/T_2} & |\beta|^2 \end{pmatrix}" />
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>👉 Watch the Noisy Qubit's vector wobble, shrink & blur on the right</div>
            <button onClick={() => handleNext('density_matrix')} style={btnP}>Next: The Density Matrix →</button>
          </div>
        )}

        {/* STEP 3: DENSITY MATRIX (With Interactive Purity Slider) */}
        {step === 'density_matrix' && (
          <div key="step-rho" data-jelly style={cardStyle}>
            <Badge icon={Calculator} text="Density Matrix" />
            <div style={titleStyle}>The Density Matrix — Tracking Impurity</div>
            <div style={textStyle}>When we can't describe a quantum state as a pure <InlineMath math="|\psi\rangle" /> anymore, we use a <strong style={{ color: CW }}>Density Matrix ρ</strong>. A perfectly pure qubit has <InlineMath math="\mathrm{Tr}(\rho^2) = 1" />. As decoherence sets in, <InlineMath math="\mathrm{Tr}(\rho^2) < 1" /> — the state becomes a 'mixed state': a probability cloud with no quantum edge.</div>
            
            <div style={{ ...mathStyle, textAlign: 'center', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '11.5px', marginBottom: '8px', color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>
                <span><strong style={{ color: CG }}>Pure:</strong> <InlineMath math="\mathrm{Tr}(\rho^2) = 1" /></span>
                <span><strong style={{ color: CR }}>Mixed:</strong> <InlineMath math="\mathrm{Tr}(\rho^2) < 1" /></span>
              </div>
              <div style={{ fontSize: '12px', color: CW }}>
                <InlineMath math="\rho = \begin{pmatrix} 0.5 & 0.5 \\[2pt] 0.5 & 0.5 \end{pmatrix} \xrightarrow{t\to\infty} \begin{pmatrix} 0.5 & 0 \\[2pt] 0 & 0.5 \end{pmatrix}" />
              </div>
            </div>

            <DensityMatrixDisplay noiseLevel={noiseLevel} onSliderChange={handleNoiseSlider} />
            <button onClick={() => handleNext('noise_types')} style={{ ...btnP, marginTop: '12px' }}>Next: Types of Quantum Noise →</button>
          </div>
        )}

        {/* STEP 4: THREE NOISE TYPES (Focused Close-Up View) */}
        {step === 'noise_types' && (
          <div key="step-noise" data-jelly style={cardStyle}>
            <Badge icon={Zap} text="Noise Types" color={CR} />
            <div style={titleStyle}>Three Types of Quantum Noise</div>
            <div style={textStyle}>Not all noise is the same. Click each criminal button below to trigger live quantum attack animations on the Noisy Qubit:</div>
            
            {/* Interactive Noise Buttons */}
            <div style={{ display: 'flex', gap: '7px', marginBottom: '12px' }}>
              {[
                { id: 'bitflip',   icon: Zap, label: 'Bit Flip (X)', color: CR, desc: '|0⟩ ↔ |1⟩ flips' },
                { id: 'phaseflip', icon: Flame, label: 'Phase Flip (Z)', color: CP, desc: 'Phase α → −α' },
                { id: 'damping',   icon: ArrowDown, label: 'Amp. Damp. (T₁)', color: CA, desc: '|1⟩ decays → |0⟩' },
              ].map(({ id, icon: IconComponent, label, color: bc, desc }) => (
                <button
                  key={id}
                  onClick={() => handleNoiseType(id)}
                  style={{
                    flex: '1 0 0',
                    padding: '10px 5px',
                    borderRadius: '12px',
                    background: activeNoise === id ? bc + '33' : bc + '14',
                    border: '1.5px solid ' + bc + (activeNoise === id ? '99' : '38'),
                    color: bc,
                    fontSize: '10.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    textAlign: 'center',
                    transition: 'all 0.22s ease',
                    boxShadow: activeNoise === id ? '0 0 20px ' + bc + '55' : 'none',
                    transform: activeNoise === id ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    <MorphIcon icon={IconComponent} spring="smooth" strokeWidth={1} size={18} color={bc} />
                  </div>
                  <div style={{ lineHeight: 1.25 }}>{label}</div>
                  <div style={{ fontSize: '9px', opacity: 0.78, marginTop: '3px', fontWeight: '600' }}>{desc}</div>
                </button>
              ))}
            </div>

            {/* Clean Math Block */}
            <div style={{ ...mathStyle, textAlign: 'center', padding: '8px 10px' }}>
              <div style={{ fontSize: '11.5px', marginBottom: '4px', color: CR }}>
                <InlineMath math="\mathcal{E}_X(\rho) = (1-p)\rho + p\,X\rho X^\dagger" />
              </div>
              <div style={{ fontSize: '11.5px', color: CP }}>
                <InlineMath math="\mathcal{E}_Z(\rho) = (1-p)\rho + p\,Z\rho Z^\dagger" />
              </div>
            </div>

            <button onClick={() => handleNext('coherence_time')} style={btnP}>Next: Coherence Times T₁ and T₂ →</button>
          </div>
        )}

        {/* STEP 5: COHERENCE TIME */}
        {step === 'coherence_time' && (
          <div key="step-t1t2" data-jelly style={cardStyle}>
            <Badge icon={Timer} text="Coherence Times" />
            <div style={titleStyle}>Coherence Times: T₁ and T₂</div>
            <div style={textStyle}>Decoherence is measured using two fundamental quantum lifetimes:</div>
            <div style={{ marginBottom: '10px' }}>
              {[
                { sym: 'T₁', name: 'Relaxation Time', color: CA, desc: 'How long before excited |1⟩ decays to ground |0⟩ (energy loss)' },
                { sym: 'T₂', name: 'Dephasing Time',  color: CT, desc: 'How long before superposition phase becomes random (coherence loss)' },
              ].map(({ sym, name, color: bc, desc }) => (
                <div key={sym} style={{ background: bc + '14', border: '1px solid ' + bc + '33', borderRadius: '10px', padding: '8px 12px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '900', color: bc, fontFamily: 'Inter, monospace' }}>{sym}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>{name}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4, fontFamily: "'Inter', sans-serif" }}>{desc}</div>
                </div>
              ))}
            </div>

            {/* Relatable Real-World Eyeblink Stats Box */}
            <div style={{ background: 'rgba(0,0,0,0.32)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 12px', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#cbd5e1', marginBottom: '3px', fontFamily: "'Inter', sans-serif" }}>👁️ The Fragility Scale:</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', lineHeight: 1.45, fontFamily: "'Inter', sans-serif" }}>
                Superconducting qubits: <strong style={{ color: CA }}>T₁ ≈ 100–500 μs</strong>, <strong style={{ color: CT }}>T₂ ≈ 50–300 μs</strong>.<br />
                A human eyeblink is <strong style={{ color: CW }}>150,000 μs</strong> — over <span style={{ color: CR, fontWeight: '700' }}>500× longer</span> than a qubit's entire lifetime!
              </div>
            </div>

            <div style={{ ...mathStyle, fontSize: '12px', textAlign: 'center', padding: '8px 10px' }}>
              <InlineMath math="\rho_{01}(t) = \rho_{01}(0)\, e^{-t/T_2}, \quad T_2 \leq 2T_1" />
            </div>

            <DecayCurveChart noiseLevel={noiseLevel} />
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '4px', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>● Live qubit state │ T₂ crossover in amber │ e⁻ᵗᐟᵀ₂ in teal</div>
            <button onClick={() => handleNext('lindblad')} style={{ ...btnP, marginTop: '10px' }}>Next: The Lindblad Equation →</button>
          </div>
        )}

        {/* STEP 6: LINDBLAD */}
        {step === 'lindblad' && (
          <div key="step-lindblad" data-jelly style={cardStyle}>
            <Badge icon={Triangle} text="Lindblad Equation" color={CP} />
            <div style={titleStyle}>The Master Equation of Quantum Noise</div>
            <div style={textStyle}>The <strong style={{ color: CW }}>Lindblad Master Equation</strong> is the complete math of how an open quantum system evolves when coupled to its environment. It's the quantum equivalent of diffusion — the universe slowly dissolving your qubit.</div>
            <div style={{ ...mathStyle, padding: '10px 8px', fontSize: '11px', overflowX: 'auto', textAlign: 'center' }}>
              <InlineMath math="\frac{d\rho}{dt} = -\frac{i}{\hbar}[H,\rho] + \sum_k \gamma_k \!\left(L_k\rho L_k^\dagger - \tfrac{1}{2}\{L_k^\dagger L_k,\rho\}\right)" />
            </div>
            <div style={{ marginBottom: '10px' }}>
              {[
                { sym: '-i/ℏ [H, ρ]',   color: CT, desc: 'Coherent evolution — the useful quantum dynamics' },
                { sym: 'γₖ',              color: CA, desc: 'Decay rate for each noise channel k' },
                { sym: 'Lₖ (Jump ops)',        color: CR, desc: 'Specific noise type: bit flip, phase flip, decay' },
                { sym: '−½{Lₖ†Lₖ, ρ}', color: CP, desc: 'Keeps ρ a valid quantum state (Hermitian, trace 1)' },
              ].map(({ sym, color: bc, desc }) => (
                <div key={sym} style={{ display: 'flex', gap: '8px', marginBottom: '5px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '700', color: bc, minWidth: '82px', fontFamily: 'Inter, monospace', paddingTop: '1px', whiteSpace: 'nowrap' }}>{sym}</span>
                  <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.45, fontFamily: "'Inter', sans-serif" }}>{desc}</span>
                </div>
              ))}
            </div>
            <button onClick={() => handleNext('why_hard')} style={btnP}>Next: Why Is This So Hard? →</button>
          </div>
        )}

        {/* STEP 7: WHY HARD (Perfect Plan Alignment & Cryogenic Transformation) */}
        {step === 'why_hard' && (
          <div key="step-hard" data-jelly style={cardStyle}>
            <Badge icon={Thermometer} text="Real-World Reality" color={CB} />
            <div style={titleStyle}>Why Building Quantum Computers is So Hard</div>
            <div style={textStyle}>Real quantum computers operate at <strong style={{ color: CB }}>15 millikelvin</strong> — colder than outer space (2.7 K)! Even then, qubits survive only <strong style={{ color: CA }}>hundreds of microseconds</strong>. Every gate must be blazing fast and ultra-precise.</div>
            
            {/* Real-World Temperature Comparison Table */}
            <div style={{ ...mathStyle, padding: '8px 12px', marginBottom: '10px' }}>
              <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>Temperature Comparison</div>
              {[
                { env: 'Room temperature', T: '300 K',   color: CR },
                { env: 'Liquid nitrogen',  T: '77 K',    color: CA },
                { env: 'Outer space',      T: '2.7 K',   color: CT },
                { env: '⚡ Quantum computer', T: '0.015 K (15 mK)', color: CB },
              ].map(({ env, T, color: bc }) => (
                <div key={env} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: "'Inter', sans-serif" }}>
                  <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{env}</span>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: bc }}>{T}</span>
                </div>
              ))}
            </div>

            {!showTempMeter && (
              <button onClick={handleDropTemp} style={{ ...btnP, border: '1.5px solid ' + CB + '77', color: CW, background: 'linear-gradient(135deg, ' + CB + '44, ' + CB + '18)', boxShadow: '0 0 20px ' + CB + '33' }}>
                🧄 Drop Temperature to 15 mK →
              </button>
            )}
            {showTempMeter && <TemperatureMeter tempK={tempK} />}

            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.65, marginTop: '12px', fontFamily: "'Inter', sans-serif" }}>
              This is why <strong style={{ color: CT }}>Quantum Error Correction</strong> exists — to fight decoherence mathematically. That's our very next module!
            </div>

            {showTempMeter && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
                <button onClick={handleExploreQEC} style={{ ...btnP, background: 'linear-gradient(135deg, ' + CT + '33, ' + CT + '18)', border: '1.5px solid ' + CT + '77', color: CW, marginTop: 0 }}>
                  Explore Quantum Error Correction →
                </button>
                <button onClick={handleReset} style={{ ...btnP, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#64748b', fontSize: '11px', padding: '7px 12px', marginTop: 0 }}>
                  ↺ Restart Experience
                </button>
              </div>
            )}
          </div>
        )}

        <QuantumNavButtons
          canPrev={currentStepIdx > 0}
          onPrev={handleDecoPrev}
          onNext={handleDecoNext}
          nextLabel={currentStepIdx < DECO_STEPS.length - 1 ? 'Next' : 'Restart'}
          isLast={currentStepIdx === DECO_STEPS.length - 1}
          accentColor={CT}
          containerStyle={{ position: 'absolute', bottom: '24px', right: '28px', zIndex: 300 }}
        />
      </div>
    </div>
  );
}
