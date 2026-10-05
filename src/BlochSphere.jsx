import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, PresentationControls } from '@react-three/drei';
import { useSpring, a } from '@react-spring/three';
import { handoff, GLIDE } from './handoff';
import { BlochSphereUnit, arrowGrow, DEC_STATIC_ENTRANCE, CT, CA } from './DecoSphereUnit';
import * as THREE from 'three';
import { Bloom } from '@react-three/postprocessing';
import { BlockMath, InlineMath } from 'react-katex';
import { useQuantumAudio } from './useQuantumAudio';
import { QuantumNavButtons } from './QuantumNavButtons';
import { QualityComposer } from './QualityScene';

// =========================================
// 1. CLASSICAL BIT COMPONENT (Left Side)
// =========================================
export const ClassicalBit = ({ position, scale = 1, theme, activeModule, flipMode, isBlank, attemptCopy, isDecohering, onDomainHover, onDomainUnhover, customGridColor }) => {
  const isLight = theme === 'light';
  const groupRef = useRef();
  const orbRef = useRef();
  const lightRef = useRef();

  const [value, setValue] = useState(0);
  const [hovered, setHovered] = useState(false);
  const gridColor = customGridColor || (isLight ? "#0d9488" : "#14b8a6");

  const born = useRef(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (born.current === null) born.current = t;
    const ft = t - born.current; // flips count from when this bit appeared (so it starts at 0)
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    if (activeModule !== 'bit-vs-qubit') {
      if (flipMode === 'slow') setValue(Math.floor(ft * 0.8) % 2);
      else if (flipMode === 'fast') setValue(Math.floor(ft * 2) % 2);
      else if (flipMode === 'async') setValue(Math.floor(ft * 1.8) % 2);
      else if (flipMode === 'static') setValue(0);
      else if (flipMode === 'controlled') { /* handled via prop if we want, or externally */ }
    }

    const targetY = value === 0 ? 1.1 : -1.1;
    if (orbRef.current && !isBlank) {
      if (activeModule === 'bit-vs-qubit') {
        // Discrete teleportation jump
        orbRef.current.position.y = targetY;
      } else if (!activeModule && !flipMode) {
        // Ambient idle state - very slow faint drifting only if no flipMode is set
        const idleVal = (Math.sin(t * 0.4) + 1) / 2; // 0 to 1
        orbRef.current.position.y = THREE.MathUtils.lerp(-1.1, 1.1, 1 - idleVal);
      } else {
        // Crisp digital jump/snap between discrete 0 (1.1) and 1 (-1.1)
        orbRef.current.position.y = THREE.MathUtils.lerp(orbRef.current.position.y, targetY, 0.35);
      }
    }
  });

  // Expose a way to set value externally if needed
  useEffect(() => {
    if (flipMode === 'force-1') setValue(1);
    if (flipMode === 'force-0') setValue(0);
  }, [flipMode]);

  const activeColor = attemptCopy ? "#22c55e" : (value === 0 ? "#00f2fe" : "#f093fb");

  const handleToggle = (e) => {
    e.stopPropagation();
    if (activeModule === 'bit-vs-qubit') setValue((v) => 1 - v);
  };

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      onClick={handleToggle}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); if (onDomainHover) onDomainHover(); }}
      onPointerOut={(e) => { setHovered(false); if (onDomainUnhover) onDomainUnhover(); }}
    >
      {/* Outer Cyber Wireframe Capsule */}
      <mesh>
        <capsuleGeometry args={[0.6, 2.2, 16, 24]} />
        <meshBasicMaterial color={gridColor} wireframe={true} transparent={true} opacity={isLight ? 0.3 : 0.22} blending={isLight ? THREE.NormalBlending : THREE.AdditiveBlending} />
      </mesh>
      {/* Inner Frosted Capsule */}
      <mesh>
        <capsuleGeometry args={[0.58, 2.18, 32, 48]} />
        <meshPhysicalMaterial color={isLight ? "#e2e8f0" : "#ffffff"} transparent={true} transmission={0.92} roughness={0.12} clearcoat={1} ior={1.4} opacity={0.1} />
      </mesh>
      {/* Central Guide Rail */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 2.2, 8]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.35} />
      </mesh>
      {/* Subtle Equator Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.012, 10, 40]} />
        <meshBasicMaterial color={gridColor} transparent opacity={0.35} />
      </mesh>

      {!isBlank && (
        <>
          <Html position={[0.9, 1.1, 0]} center>
            <div style={{ fontSize: '22px', fontFamily: "'Fira Code', monospace", fontWeight: '800', color: value === 0 ? "#00f2fe" : 'var(--text-secondary)', textShadow: value === 0 ? `0 0 15px #00f2fe` : 'none', transition: 'all 0.2s', opacity: 'var(--bit-fade, 1)' }}>0</div>
          </Html>
          <Html position={[0.9, -1.1, 0]} center>
            <div style={{ fontSize: '22px', fontFamily: "'Fira Code', monospace", fontWeight: '800', color: value === 1 ? "#f093fb" : 'var(--text-secondary)', textShadow: value === 1 ? `0 0 15px #f093fb` : 'none', transition: 'all 0.2s', opacity: 'var(--bit-fade, 1)' }}>1</div>
          </Html>

          <mesh ref={orbRef} position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.11, 32, 32]} />
            <meshStandardMaterial color={activeColor} emissive={activeColor} emissiveIntensity={3.5} />
            <pointLight ref={lightRef} color={activeColor} intensity={isLight ? 5 : 2.5} distance={3} />
          </mesh>
        </>
      )}

      {hovered && activeModule !== 'bit-vs-qubit' && (
        <Html position={[0, 2.8, 0]} center zIndexRange={[100, 0]}>
          <div className="glass-tooltip cyan-glow" >
            <h4>Classical Bit</h4>
            <p>{isDecohering ? "Robust: Classical bits easily ignore thermal noise." : (attemptCopy ? "Clonable: Classical data can be perfectly duplicated." : "Exists strictly as a 0 or 1. It jumps instantly between states but never exists in between.")}</p>
          </div>
        </Html>
      )}

      {hovered && activeModule === 'bit-vs-qubit' && (
        <Html position={[1.8, 2.2, 0]} center zIndexRange={[50, 0]}>
          <div className={`glass-tooltip ${value === 0 ? 'cyan-glow' : 'purple-glow'}`} style={{ width: '220px' }}>
            <h4>🔒 Deterministic State {value}</h4>
            <p>{value === 0
              ? "Strictly in the 0 state. Click to apply a NOT gate and instantly flip it to 1."
              : "Strictly in the 1 state. Click to apply a NOT gate and instantly flip it back to 0."}</p>
          </div>
        </Html>
      )}
    </group>
  );
};

// =========================================

// Static THREE objects reused every frame to avoid GC pressure
const _CAM_TARGETS_BS = [
  new THREE.Vector3(0, 2.5, 13),
  new THREE.Vector3(2.5, 1.0, 12),
  new THREE.Vector3(0.5, 7.5, 9.5),
  new THREE.Vector3(0, 1.5, 14),
];
const _DEFAULT_CAM_BS = new THREE.Vector3(0, 0, 13);
const _tmpGoal = new THREE.Color();
const _tmpV = new THREE.Vector3();
const _tmpL = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();
const _tmpQ2 = new THREE.Quaternion();
const _decStartLocal = new THREE.Vector3();
const _tmpM = new THREE.Matrix4();
const _Q_UP = new THREE.Quaternion(); // |0>: the arrow straight up
const _LIGHTS_HUB = [[8, 8, 8], [-8, -8, -8]];
const _LIGHTS_ENT = [[8, 12, 8], [-8, -12, -8]];
// Exponential State Space lights its qubit white and violet from further off (the hub's lights glide there as the qubit zooms in).
const _LIGHTS_EXP = [[10, 15, 10], [-10, -10, -10]];
// Decoherence: a dim teal and amber pair (the pure and the noisy qubit).
const _LIGHTS_DEC = [[-6, 6.65, 7], [6, 6.65, 7]];
const _DEC_LIGHT = { amb: 0.16, c1: new THREE.Color('#14b8a6'), i1: 0.95, c2: new THREE.Color('#f59e0b'), i2: 0.95, dist: 1000 };
// The Decoherence sphere is drawn at the lone qubit's size (radius 2.4) and grows to the module's (2.75) as the pair zooms.
const _DEC_UNIT_FIRST = 2.4 / 2.75;   // inside the first qubit's rig (its base scale is 1.2)
const _DEC_UNIT_SECOND = 2 / 2.75;    // inside the second's (base scale 1)
const _UPV = new THREE.Vector3(0, 1, 0);
const _EXP_LIGHT = { amb: 0.6, c1: new THREE.Color('#ffffff'), i1: 2.0, c2: new THREE.Color('#a855f7'), i2: 1.5, dist: 1000 };
const _HUB_LIGHT = { amb: 0.5, c1: new THREE.Color('#00f2fe'), i1: 8, c2: new THREE.Color('#f093fb'), i2: 8, dist: 30 };
const _ORIGIN_BS = new THREE.Vector3(0, 0, 0);
const _AXIS_Y = new THREE.Vector3(0, 1, 0);
const _DEC_CAM = new THREE.Vector3(0, 2.25, 20);   // Decoherence's resting view: where the camera is and what it aims at
const _DEC_LOOK = new THREE.Vector3(0, 1.65, 0);
const _HUB_CAM = new THREE.Vector3(0, 0, 13);
const _tempColor1_BS = new THREE.Color();
const _tempColor2_BS = new THREE.Color();
const _STEP_COLORS_BS = {
  0: { c1: 0x00f2fe, c2: 0x4fc3f7 }, // icy cyan
  1: { c1: 0xf093fb, c2: 0xff6ec7 }, // electric purple
  2: { c1: 0x00f2fe, c2: 0xf093fb }, // dual (alternating)
  3: { c1: 0xff4466, c2: 0xf093fb }, // red danger
};

// =========================================
// 2. QUANTUM QUBIT COMPONENT (Right Side)
// =========================================
export const QubitCore = ({ position, scale = 1, theme, activeModule, isAncilla, isEntangled, isDecohering, attemptCopy, onDomainHover, onDomainUnhover, superpositionStep, onMeasure, onMeasuredValueChange, customVectorQuat, showCustomVector, emissiveColor, customGridColor, customRingColor, sphereRotation, visible, interferenceStep = 0, interferencePhase = 0, fadeExtras = false, vectorOut, startDir }) => {
  const coreGroupRef = useRef();
  const sphereRef = useRef(); const vectorRef = useRef(); const northPoleRef = useRef(); const southPoleRef = useRef(); const glassCoreRef = useRef();
  // Ground State (Step 0) animation refs
  const shimmerRefs = useRef([null, null, null, null, null]);
  const freezeRingRef = useRef();
  const iceCapRef = useRef();
  const lockedGlowRef = useRef();
  // Step 1 (Hadamard) refs
  const hadamardPulseRef = useRef();
  const hadamardPulseMatRef = useRef();
  const hadamardEntryTime = useRef(-1);
  const prevStepRef = useRef(-1);
  // Step 2 (Superposition) trail refs
  const trailMeshRefs = useRef(Array(20).fill(null));
  const trailAngles = useRef([]);
  // Step 3 (Collapse) refs
  const clickRippleRef = useRef();
  const clickRippleMatRef = useRef();
  const flashStartTime = useRef(0);
  const flashTrigger = useRef(false);
  const flashMatRef = useRef();
  const beaconRef = useRef();
  const beaconMatRef = useRef();
  const collapseTime = useRef(-1);
  // Cinematic refs
  const shockwaveRefs = useRef([null, null, null]);
  const shockwaveMatRefs = useRef([null, null, null]);
  const shockwaveStartTime = useRef(-1);
  const companionRefs = useRef([null, null, null]);
  const collapseRingRefs = useRef([null, null, null]);
  const collapseRingMatRefs = useRef([null, null, null]);
  const atmosphereMatRef = useRef();
  const ghostVec1Ref = useRef();
  const ghostVec2Ref = useRef();
  const ghostVec1MatRef = useRef();
  const ghostVec2MatRef = useRef();


  const [hoveredState, setHoveredState] = useState(null);
  const [measuredValue, setMeasuredValue] = useState(null);
  // A qubit that arrives with its arrow already set (a hand-over) starts there, not swinging in from |0>.
  useLayoutEffect(() => {
    if (customVectorQuat && vectorRef.current) vectorRef.current.quaternion.copy(customVectorQuat);
    else if (startDir && vectorRef.current) vectorRef.current.quaternion.setFromUnitVectors(_UPV, startDir);
    if (vectorOut) vectorOut.current = vectorRef.current;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMeasuredValue(null); }, [activeModule]);

  useEffect(() => {
    if (onMeasuredValueChange) onMeasuredValueChange(measuredValue);
  }, [measuredValue, onMeasuredValueChange]);

  useEffect(() => {
    if (activeModule === 'superposition' && superpositionStep === 4 && measuredValue === null) {
      const currentRotX = vectorRef.current ? vectorRef.current.rotation.x : Math.PI / 2;
      const prob1 = Math.pow(Math.sin(currentRotX / 2), 2);
      setMeasuredValue(Math.random() < prob1 ? 1 : 0);
    }
    if (activeModule === 'superposition' && superpositionStep < 4 && measuredValue !== null) {
      setMeasuredValue(null);
    }
  }, [activeModule, superpositionStep, measuredValue]);

  const isLight = theme === 'light';
  const defaultGrid = isLight ? "#0d9488" : "#14b8a6";
  const gridColor = customGridColor || defaultGrid;
  const ringColor = customRingColor || gridColor;
  const axisColor = isLight ? "#cbd5e1" : "#64748b";

  const targetSphereOpacity = 1;

  const { sOpacity } = useSpring({
    sOpacity: targetSphereOpacity,
    config: { mass: 1, tension: 120, friction: 18 }
  });

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    let targetSphereRotY = time * 0.04;

    if (activeModule === 'superposition') {
      // No special rotation for superposition, handled by vectorRef below
    } else {
      if (coreGroupRef.current) coreGroupRef.current.rotation.x = THREE.MathUtils.lerp(coreGroupRef.current.rotation.x, 0, 0.1);
    }

    sphereRef.current.rotation.y = targetSphereRotY;

    const pulse = 1 + Math.sin(time * 3) * 0.08;
    if (northPoleRef.current) northPoleRef.current.scale.set(pulse, pulse, pulse);
    if (southPoleRef.current) southPoleRef.current.scale.set(pulse, pulse, pulse);

    if (vectorRef.current) {
      let targetX = 0; let targetY = 0; let jitter = 0;

      if (!activeModule) {
        // Ambient idle state: drift pole -> equator -> pole
        // sine wave mapped to 0 to PI
        targetX = ((Math.sin(time * 0.4) + 1) / 2) * Math.PI; 
        targetY = time * 0.2; // slow continuous rotation around Y
        if (glassCoreRef.current) glassCoreRef.current.emissiveIntensity = 0.2 + (Math.sin(time) * 0.1);
      }
      else if (activeModule === 'bit-vs-qubit') {
        if (measuredValue !== null) {
          targetX = measuredValue === 0 ? 0 : Math.PI;
          if (glassCoreRef.current) { glassCoreRef.current.emissiveIntensity = isLight ? 0.5 : 1; glassCoreRef.current.emissive.setHex(0xf093fb); }
        } else {
          // Sweep vector around sphere to show continuous state space
          targetX = Math.PI / 2 + Math.sin(time * 0.65) * (Math.PI / 2 - 0.06);
          targetY = Math.sin(time * 0.3) * 0.8;
          if (glassCoreRef.current) glassCoreRef.current.emissiveIntensity = 0;
        }
      }
      else if (['gates', 'multi-qubit-gates'].includes(activeModule)) {
        // Fallback state-space sweep, only visible when no customVectorQuat is driving the vector.
        // (Here "gates" is also the hub's scene on its way to or from Classical Gates,
        // where the vector rests at |0> to match that scene's start.)
        if (activeModule === 'gates') { targetX = 0; targetY = 0; }
        else {
          targetX = Math.abs(Math.sin(time * 1.5)) * Math.PI;
          targetY = Math.cos(time) * Math.PI;
        }
        if (glassCoreRef.current) {
          glassCoreRef.current.emissiveIntensity = 0;
          if (emissiveColor) {
            glassCoreRef.current.emissive.set(emissiveColor);
          }
        }
      }
      else if (activeModule === 'superposition') {
        if (superpositionStep === 0) {
          // Ground State: frozen at north pole
          targetX = 0; targetY = 0;
          if (glassCoreRef.current) glassCoreRef.current.emissiveIntensity = 0;
          // Atmosphere: icy cold blue
          if (atmosphereMatRef.current) {
            atmosphereMatRef.current.color.setHex(0x00f2fe);
            atmosphereMatRef.current.opacity = 0.03 + Math.sin(time * 3) * 0.01;
          }
          // Reset coreGroup jitter
          if (coreGroupRef.current) {
            coreGroupRef.current.position.x = THREE.MathUtils.lerp(coreGroupRef.current.position.x || 0, 0, 0.2);
            coreGroupRef.current.position.z = THREE.MathUtils.lerp(coreGroupRef.current.position.z || 0, 0, 0.2);
          }
        } else if (superpositionStep === 1) {
          // Hadamard: heavy elastic fall to equator
          targetX = Math.PI / 2; targetY = 0;
          if (glassCoreRef.current) { glassCoreRef.current.emissiveIntensity = 0.5; glassCoreRef.current.emissive.setHex(0xf093fb); }
          // Track entry time for pulse animation
          if (prevStepRef.current !== 1) {
            hadamardEntryTime.current = time;
            prevStepRef.current = 1;
            shockwaveStartTime.current = time; // fire shockwaves!
          }
          // Animate Hadamard energy pulse ring falling from pole to equator
          if (hadamardPulseRef.current && hadamardPulseMatRef.current) {
            const elapsed = Math.min(time - hadamardEntryTime.current, 1.5);
            const progress = elapsed / 1.5;
            hadamardPulseRef.current.position.y = 2.1 * (1 - progress);
            const expand = 0.5 + progress * 1.5;
            hadamardPulseRef.current.scale.set(expand, expand, expand);
            hadamardPulseRef.current.rotation.z = time * 3;
            const fade = progress < 0.7 ? 1 : 1 - ((progress - 0.7) / 0.3);
            hadamardPulseMatRef.current.opacity = fade * 0.85;
          }
          // Animate 3 sequential shockwave rings
          if (shockwaveStartTime.current > 0) {
            shockwaveRefs.current.forEach((ref, idx) => {
              if (!ref || !shockwaveMatRefs.current[idx]) return;
              const delay = idx * 0.18;
              const elapsed = time - shockwaveStartTime.current - delay;
              if (elapsed < 0) { ref.scale.set(0, 0, 0); return; }
              const progress = Math.min(elapsed / 0.8, 1);
              const r = 1 + progress * 4;
              ref.scale.set(r, r, r);
              shockwaveMatRefs.current[idx].opacity = (1 - progress) * 0.7;
            });
          }
          // Atmosphere: electric purple surge
          if (atmosphereMatRef.current) {
            atmosphereMatRef.current.color.setHex(0xf093fb);
            atmosphereMatRef.current.opacity = 0.06 + Math.sin(time * 4) * 0.03;
          }
          // Use heavier lerp so vector has weight/bounce feel
          vectorRef.current.rotation.x = THREE.MathUtils.lerp(vectorRef.current.rotation.x, targetX, 0.06);
          vectorRef.current.rotation.y = THREE.MathUtils.lerp(vectorRef.current.rotation.y, 0, 0.06);
          vectorRef.current.scale.y = 1;
          if (coreGroupRef.current) {
            coreGroupRef.current.position.x = THREE.MathUtils.lerp(coreGroupRef.current.position.x || 0, 0, 0.2);
            coreGroupRef.current.position.z = THREE.MathUtils.lerp(coreGroupRef.current.position.z || 0, 0, 0.2);
          }
        } else if (superpositionStep >= 2) {
          if (measuredValue !== null) {
            // Post-collapse: snap to pole, dim other half
            targetX = measuredValue === 0 ? 0 : Math.PI; targetY = 0;
            if (glassCoreRef.current) { glassCoreRef.current.emissiveIntensity = isLight ? 0.4 : 0.8; glassCoreRef.current.emissive.setHex(measuredValue === 0 ? 0x00f2fe : 0xf093fb); }
            // Track collapse time for beacon animation
            if (collapseTime.current < 0) {
              collapseTime.current = time;
              // Wrap the accumulated equator azimuth so the pole snap unwinds at most one turn
              vectorRef.current.rotation.y %= Math.PI * 2;
            }
            // Animate victory beacon growing at the chosen pole
            if (beaconRef.current && beaconMatRef.current) {
              const beaconElapsed = time - collapseTime.current;
              const s = Math.min(beaconElapsed * 2, 1) * (1 + Math.sin(time * 4) * 0.15);
              beaconRef.current.scale.set(s, s, s);
              beaconMatRef.current.emissiveIntensity = 2 + Math.sin(time * 6) * 1;
            }
            // Animate 3 collapse explosion rings
            collapseRingRefs.current.forEach((ref, idx) => {
              if (!ref || !collapseRingMatRefs.current[idx]) return;
              const delay = idx * 0.2;
              const elapsed = (time - collapseTime.current) - delay;
              if (elapsed < 0) { ref.scale.set(0, 0, 0); return; }
              const progress = Math.min(elapsed / 1.0, 1);
              const r = 0.5 + progress * 3.5;
              ref.scale.set(r, r, r);
              collapseRingMatRefs.current[idx].opacity = (1 - progress) * 0.8;
            });
            // Atmosphere: triumphant glow at measured pole color
            if (atmosphereMatRef.current) {
              const poleColor = measuredValue === 0 ? 0x00f2fe : 0xf093fb;
              atmosphereMatRef.current.color.setHex(poleColor);
              atmosphereMatRef.current.opacity = 0.07 + Math.sin(time * 3) * 0.02;
            }
            // White flash anim
            if (flashTrigger.current) { flashStartTime.current = time; flashTrigger.current = false; }
            if (flashStartTime.current > 0 && flashMatRef.current) {
              const fe = time - flashStartTime.current;
              flashMatRef.current.opacity = fe < 0.08 ? 0.9 : Math.max(0, 0.9 - (fe - 0.08) / 0.3);
              if (fe > 0.4) flashStartTime.current = 0;
            }
            // Settle jitter to zero
            if (coreGroupRef.current) {
              coreGroupRef.current.position.x = THREE.MathUtils.lerp(coreGroupRef.current.position.x || 0, 0, 0.15);
              coreGroupRef.current.position.z = THREE.MathUtils.lerp(coreGroupRef.current.position.z || 0, 0, 0.15);
            }
          } else {
            // No measurement yet
            collapseTime.current = -1;
            targetX = Math.PI / 2; targetY = time * 0.6;
            if (glassCoreRef.current) glassCoreRef.current.emissiveIntensity = 0;
            // Track trail for step 2 (superpositionStep === 2)
            const vAngle = vectorRef.current ? vectorRef.current.rotation.y : 0;
            trailAngles.current.push(vAngle);
            if (trailAngles.current.length > 20) trailAngles.current.shift();
            trailMeshRefs.current.forEach((mesh, i) => {
              if (!mesh) return;
              const ang = trailAngles.current[i];
              if (ang === undefined) { mesh.material.opacity = 0; return; }
              mesh.position.set(Math.sin(ang) * 2, 0, Math.cos(ang) * 2);
              const age = i / Math.max(trailAngles.current.length - 1, 1);
              mesh.material.opacity = superpositionStep === 2 ? age * 0.7 : 0;
              mesh.material.emissiveIntensity = 1 + age * 4;
            });
            // Step 2: companion orbs orbiting equator + atmosphere cyan
            if (superpositionStep === 2) {
              companionRefs.current.forEach((ref, idx) => {
                if (!ref) return;
                const phase = time * 0.8 + (idx * Math.PI * 2 / 3);
                ref.position.set(Math.sin(phase) * 2.4, Math.sin(time * 1.2 + idx) * 0.3, Math.cos(phase) * 2.4);
              });
              if (atmosphereMatRef.current) {
                atmosphereMatRef.current.color.setHex(0x00f2fe);
                atmosphereMatRef.current.opacity = 0.04 + Math.sin(time * 1.5) * 0.02;
              }
            }
            // Step 3: ghost vector smear + red atmosphere pulsing
            if (superpositionStep === 3) {
              [ghostVec1Ref, ghostVec2Ref].forEach((ref, idx) => {
                if (!ref.current) return;
                ref.current.rotation.x = (vectorRef.current?.rotation.x || 0) + (idx === 0 ? 0.18 : -0.18);
                ref.current.rotation.y = (vectorRef.current?.rotation.y || 0) + (idx === 0 ? 0.12 : -0.12);
              });
              [ghostVec1MatRef, ghostVec2MatRef].forEach((ref) => {
                if (!ref.current) return;
                ref.current.opacity = 0.22 + Math.sin(time * 8) * 0.08;
              });
              if (atmosphereMatRef.current) {
                atmosphereMatRef.current.color.setHex(0xff3355);
                atmosphereMatRef.current.opacity = 0.05 + Math.sin(time * 7) * 0.04;
              }
            }
            // Step 2: phase-pulse the vector glow
            if (superpositionStep === 2 && lockedGlowRef.current) {
              lockedGlowRef.current.emissiveIntensity = 4 + Math.sin(vectorRef.current.rotation.y * 1.5) * 2.5;
            }
            // Step 3: vibrate sphere + ripple
            if (superpositionStep === 3) {
              if (coreGroupRef.current) {
                coreGroupRef.current.position.x = Math.sin(time * 28) * 0.04;
                coreGroupRef.current.position.z = Math.cos(time * 22) * 0.03;
              }
              if (clickRippleRef.current && clickRippleMatRef.current) {
                const ripplePhase = (time * 0.7) % 1;
                const rs = 1 + ripplePhase * 2.5;
                clickRippleRef.current.scale.set(rs, rs, rs);
                clickRippleMatRef.current.opacity = (1 - ripplePhase) * 0.55;
              }
            } else {
              // Reset vibration outside step 3
              if (coreGroupRef.current) {
                coreGroupRef.current.position.x = THREE.MathUtils.lerp(coreGroupRef.current.position.x || 0, 0, 0.2);
                coreGroupRef.current.position.z = THREE.MathUtils.lerp(coreGroupRef.current.position.z || 0, 0, 0.2);
              }
            }
          }
        }
        // Update prevStepRef for all steps except 1 (handled above)
        if (superpositionStep !== 1) prevStepRef.current = superpositionStep;
      }
      else if (activeModule === 'exponential') {
        targetX = Math.PI / 2;
      }
      else if (activeModule === 'interference') {
        if (interferenceStep === 0) {
          // Initial Ground State |0⟩ (Points straight up to North Pole)
          targetX = 0;
          targetY = 0;
        } else if (interferenceStep === 1 || interferenceStep === 2) {
          // 1st H-Gate: |+⟩ = (|0⟩ + |1⟩)/√2 -> Sweeps down and rests on Equator (+X)!
          targetX = Math.PI / 2;
          targetY = 0;
        } else if (interferenceStep === 3 || interferenceStep === 4) {
          // Z-Gate: |-⟩ = (|0⟩ - |1⟩)/√2 -> Sweeps 180° along Equator (-X)!
          targetX = Math.PI / 2;
          targetY = Math.PI;
        } else if (interferenceStep === 5) {
          // 2nd H-Gate: H|-⟩ = |1⟩ -> Sweeps from Equator down to South Pole (|1⟩)!
          targetX = Math.PI;
          targetY = Math.PI;
        } else if (interferenceStep === 6) {
          // Stage 3 Sandbox: Vector tracks phase continuously along Equator!
          targetX = Math.PI / 2;
          targetY = interferencePhase || 0;
        }
      }
      else if (activeModule === 'measurement') {
        const isCollapsed = Math.sin(time * 2) > 0.8;
        targetX = isCollapsed ? Math.PI : Math.PI / 2;
        if (glassCoreRef.current) { glassCoreRef.current.emissiveIntensity = isCollapsed ? (isLight ? 0.5 : 1) : 0; glassCoreRef.current.emissive.setHex(0xf093fb); }
      }
      else if (activeModule === 'decoherence') {
        if (isDecohering) {
          targetX = 0; jitter = (Math.random() - 0.5) * 0.5;
          if (glassCoreRef.current) { glassCoreRef.current.emissiveIntensity = Math.random() * 0.8; glassCoreRef.current.emissive.setHex(0xffffff); }
        } else {
          targetX = Math.PI / 2; jitter = 0; if (glassCoreRef.current) glassCoreRef.current.emissiveIntensity = 0;
        }
      }
      else if (activeModule === 'nocloning') targetX = attemptCopy ? 0 : Math.PI / 2;
      else if (activeModule === 'error-correction') targetX = isAncilla ? Math.PI : 0;

      if (isEntangled) targetX = Math.sin(time * 1.5) > 0 ? 0 : Math.PI;

      if (customVectorQuat) {
        vectorRef.current.quaternion.slerp(customVectorQuat, Math.min(1.0, delta * 9));
      } else if (!(activeModule === 'superposition' && superpositionStep === 1)) {
        vectorRef.current.rotation.x = THREE.MathUtils.lerp(vectorRef.current.rotation.x, targetX + jitter, 0.08);
        vectorRef.current.rotation.y = (['gates', 'multi-qubit-gates', 'bit-vs-qubit', 'interference'].includes(activeModule)) ? THREE.MathUtils.lerp(vectorRef.current.rotation.y, targetY, 0.08)
          : (activeModule === 'superposition' && superpositionStep >= 2 && measuredValue === null)
            ? THREE.MathUtils.lerp(vectorRef.current.rotation.y, targetY, 0.02)  // smooth orbital
            : THREE.MathUtils.lerp(vectorRef.current.rotation.y, 0 + jitter, 0.1);
        vectorRef.current.scale.y = 1 + Math.sin(time * 4) * 0.03;
      }
    } // end if (vectorRef.current)

    // ── Ground State (Step 0): icy shimmer + freeze ring ──────────────────
    if (activeModule === 'superposition' && superpositionStep === 0) {
      // Animate 5 shimmer particles running up the vector shaft (icy metallic ripple)
      shimmerRefs.current.forEach((ref, idx) => {
        if (!ref) return;
        // Each particle has a phase offset so they stagger up the shaft
        const phase = (time * 2.4 + idx * 0.4) % 1;
        ref.position.y = -1 + phase * 2.1;          // travel from base (-1) to tip (+1.1)
        const alpha = Math.sin(phase * Math.PI);    // fade in/out
        ref.material.opacity = alpha * 0.85;
        ref.material.emissiveIntensity = 2 + alpha * 6;
        const s = 0.04 + alpha * 0.05;
        ref.scale.set(s, s, s);
      });
      // Pulsing freeze-crystalline ring around north pole
      if (freezeRingRef.current) {
        const ring_pulse = 0.92 + Math.sin(time * 8) * 0.08;
        freezeRingRef.current.scale.set(ring_pulse, ring_pulse, ring_pulse);
        freezeRingRef.current.rotation.z = time * 0.6;
      }
      // Faint locked-glow sphere at north pole pulsing like ice
      if (iceCapRef.current) {
        iceCapRef.current.emissiveIntensity = 1.5 + Math.sin(time * 12) * 0.8;
      }
      // Slow glow on the vector itself
      if (lockedGlowRef.current) {
        lockedGlowRef.current.emissiveIntensity = 3 + Math.sin(time * 9) * 1.5;
      }
    } else {
      // ── Reset all Step-0 effects when not in step 0 ──
      shimmerRefs.current.forEach((ref) => {
        if (ref) ref.material.opacity = 0;
      });
      if (freezeRingRef.current) freezeRingRef.current.scale.set(0, 0, 0);
      // Reset hadamard pulse when not in superposition at all
      if (activeModule !== 'superposition') {
        if (hadamardPulseMatRef.current) hadamardPulseMatRef.current.opacity = 0;
        trailAngles.current = [];
        trailMeshRefs.current.forEach(m => { if (m) m.material.opacity = 0; });
        prevStepRef.current = -1;
        hadamardEntryTime.current = -1;
        collapseTime.current = -1;
        if (coreGroupRef.current) { coreGroupRef.current.position.x = 0; coreGroupRef.current.position.z = 0; }
      }
    }
  }); // end useFrame

  const getTooltipContent = (part) => {
    if (part === 'qubit') {
      if (activeModule === 'bit-vs-qubit') return { title: "Quantum Bit (Qubit)", text: "Unlike a classical bit, this state vector can point ANYWHERE on the sphere. Click to measure and force it to collapse!" };
      if (activeModule === 'entanglement') return { title: "Entangled Qubit", text: <>Part of a 2-qubit joint wavefunction (<InlineMath math={String.raw`|\Psi\rangle`} />). Its state is indivisible from its partner.</> };
      return { title: "Quantum Bit", text: "A fluid geometric probability vector. It can exist in multiple states simultaneously and entangle with other qubits." };
    }
    if (part === 'north') {
      if (activeModule === 'bit-vs-qubit') return { title: <>North Pole — <InlineMath math={String.raw`|0\rangle`} /></>, text: <>Ground state. Measurement collapses the qubit here when <InlineMath math={String.raw`\alpha`} /> is dominant (P = <InlineMath math={String.raw`|\alpha|^2`} />).</> };
      if (activeModule === 'interference') return { title: "Constructive Return", text: <>Two H-Gates cancel out, returning the qubit perfectly to <InlineMath math={String.raw`|0\rangle`} />.</> };
      return { title: <>North Pole — <InlineMath math={String.raw`|0\rangle`} /></>, text: <>The computational basis ground state <InlineMath math={String.raw`|0\rangle`} />.</> };
    }
    if (part === 'south') {
      if (activeModule === 'bit-vs-qubit') return { title: <>South Pole — <InlineMath math={String.raw`|1\rangle`} /></>, text: <>Excited state. Measurement collapses here when <InlineMath math={String.raw`\beta`} /> is dominant (P = <InlineMath math={String.raw`|\beta|^2`} />).</> };
      if (activeModule === 'measurement') return { title: "Collapsed Reality", text: <>The observation forced the superposition to snap into <InlineMath math={String.raw`|1\rangle`} />.</> };
      return { title: <>South Pole — <InlineMath math={String.raw`|1\rangle`} /></>, text: <>The computational basis excited state <InlineMath math={String.raw`|1\rangle`} />.</> };
    }
    if (part === 'equator') {
      const formulaBlock = (
        <div style={{ marginTop: '12px', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
          <BlockMath math={String.raw`\frac{|0\rangle + |1\rangle}{\sqrt{2}}`} />
        </div>
      );
      if (activeModule === 'bit-vs-qubit') return { title: "The Equator — Superposition Zone", text: <> Any point on this ring = 50% chance of <InlineMath math={String.raw`|0\rangle`} /> or <InlineMath math={String.raw`|1\rangle`} />. This is where a classical bit <em>can never be</em>. {formulaBlock}</> };
      if (activeModule === 'superposition' || activeModule === 'exponential') return { title: "Perfect Superposition", text: <> Simultaneously 0 and 1 until a measurement forces it to collapse. {formulaBlock}</> };
      if (activeModule === 'entanglement') return { title: "Superposition Ring", text: <>Both qubits utilize superposition states on this equator (<InlineMath math={String.raw`\frac{|0\rangle + |1\rangle}{\sqrt{2}}`} />) to achieve entanglement.</> };
      return { title: "The Equator", text: "Any point on this ring represents a mixed probability amplitude." };
    }
    return { title: "", text: "" };
  };

  const vectorTarget = emissiveColor ? emissiveColor : (attemptCopy ? "#ef4444" : (isDecohering ? "#94a3b8" : (isAncilla ? "#a855f7" : (isLight ? "#0d9488" : "#14b8a6"))));
  // The arrow's colour glides to a new one (the hub's qubit turning into a module's).
  const vecCol = useRef(null);
  const [vectorColor, setVectorColor] = useState(vectorTarget);
  useFrame((_, dt) => {
    if (!vecCol.current) vecCol.current = new THREE.Color(vectorColor);
    const goal = _tmpGoal.set(vectorTarget);
    const c = vecCol.current;
    const diff = Math.abs(c.r - goal.r) + Math.abs(c.g - goal.g) + Math.abs(c.b - goal.b);
    if (diff < 0.004) { if (diff > 0) { c.copy(goal); setVectorColor(vectorTarget); } return; }
    c.lerp(goal, 1 - Math.exp(-5 * Math.min(dt, 0.1)));
    setVectorColor('#' + c.getHexString());
  });

  return (
    <group ref={coreGroupRef} position={position} scale={scale} visible={visible !== false}>
      <a.group ref={sphereRef} scale={sOpacity} rotation={sphereRotation || [0, 0, 0]}>
        {/* ── 1. Geometric Wireframe Sphere (Decoherence style) ── */}
        <mesh>
          <sphereGeometry args={[2, 30, 22]} />
          <meshBasicMaterial
            color={gridColor}
            wireframe={true}
            transparent={true}
            opacity={isLight ? 0.28 : 0.16}
            blending={isLight ? THREE.NormalBlending : THREE.AdditiveBlending}
          />
        </mesh>

        {/* ── 2. Frosted Inner Glass Core ── */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            if (activeModule === 'bit-vs-qubit' || (activeModule === 'superposition' && superpositionStep === 3)) {
              if (measuredValue === null) {
                const currentRotX = vectorRef.current ? vectorRef.current.rotation.x : Math.PI / 2;
                const prob1 = Math.pow(Math.sin(currentRotX / 2), 2);
                setMeasuredValue(Math.random() < prob1 ? 1 : 0);
                flashTrigger.current = true; // trigger white flash
                if (onMeasure) onMeasure();
              } else {
                setMeasuredValue(null);
                collapseTime.current = -1;
                flashStartTime.current = 0;
                if (onMeasure) onMeasure();
              }
            }
          }}
          onPointerOver={(e) => { e.stopPropagation(); setHoveredState('qubit'); if (onDomainHover) onDomainHover(); }}
          onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}
        >
          <sphereGeometry args={[1.96, 32, 32]} />
          <meshPhysicalMaterial
            ref={glassCoreRef}
            color={isLight ? "#e2e8f0" : "#ffffff"}
            transparent={true}
            opacity={0.06}
            transmission={0.95}
            roughness={0.1}
            clearcoat={1}
            ior={1.2}
            depthWrite={false}
          />
        </mesh>

        {/* ── 3. Depth Rings (Equator, Upper/Lower Parallels, Vertical Meridian) ── */}
        <group onPointerOver={(e) => { e.stopPropagation(); setHoveredState('equator'); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}>
          {/* Main Equatorial Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2, 0.016, 12, 90]} />
            <meshBasicMaterial color={attemptCopy ? "#ef4444" : ringColor} transparent opacity={0.35} />
          </mesh>
          {/* Upper Latitudinal Parallel (y = +1.0, radius = 1.732) */}
          <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.732, 0.012, 10, 80]} />
            <meshBasicMaterial color={ringColor} transparent opacity={0.22} />
          </mesh>
          {/* Lower Latitudinal Parallel (y = -1.0, radius = 1.732) */}
          <mesh position={[0, -1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.732, 0.012, 10, 80]} />
            <meshBasicMaterial color={ringColor} transparent opacity={0.22} />
          </mesh>
          {/* Vertical Meridian Ring */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[2, 0.014, 12, 90]} />
            <meshBasicMaterial color={ringColor} transparent opacity={0.25} />
          </mesh>
          {/* Invisible hit area for equator hover */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2, 0.15, 8, 64]} />
            <meshBasicMaterial visible={false} />
          </mesh>
          {hoveredState === 'equator' && activeModule !== 'superposition' && (
            <Html position={[2.2, 0, 0]} center zIndexRange={[100, 0]}>
              <div
                className="glass-tooltip purple-glow"
                style={activeModule === 'entanglement' ? {
                  width: '185px',
                  padding: '8px 14px',
                  borderRadius: '18px',
                  textAlign: 'center',
                  background: 'rgba(10, 18, 30, 0.72)',
                  backdropFilter: 'blur(25px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                  border: '1.5px solid rgba(240, 147, 251, 0.65)',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 22px rgba(240, 147, 251, 0.25)'
                } : {}}
              >
                <h4 style={activeModule === 'entanglement' ? { margin: '0 0 2px 0', fontSize: '11px', color: '#f093fb' } : {}}>
                  {getTooltipContent('equator').title}
                </h4>
                <div style={activeModule === 'entanglement' ? { margin: 0, fontSize: '9.5px', color: '#cbd5e1', lineHeight: '1.35' } : { margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {getTooltipContent('equator').text}
                </div>
              </div>
            </Html>
          )}
        </group>

        {/* ── 4. Coordinate Axes (Green Z, Red X, Depth Y) ── */}
        <group rotation={[0, -Math.PI / 8, 0]}>
          {/* Z, X, Y Coordinate Axes (Hidden in error-correction to prioritize CNOT beams) */}
          {activeModule !== 'error-correction' && (
            <>
              {/* Z Axis (Green Vertical) */}
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.016, 0.016, 4.5, 8]} />
                <meshBasicMaterial color="#22c55e" transparent opacity={0.32} />
              </mesh>
              {/* X Axis (Red Horizontal) */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.016, 0.016, 4.5, 8]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.32} />
              </mesh>
              {/* Y Axis (Depth Axis) */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.014, 0.014, 4.5, 8]} />
                <meshBasicMaterial color={isLight ? "#94a3b8" : "#64748b"} transparent opacity={0.22} />
              </mesh>
            </>
          )}

          {/* Axis Labels (Gates & Multi-Gates modules) */}
          {(activeModule === 'gates' || activeModule === 'multi-qubit-gates') && (
            <group>
              <Html position={[0, 0, 2.25]} center>
                <div className={fadeExtras ? 'mq-extra' : undefined} style={{ color: '#ef4444', fontFamily: "'Fira Code', monospace", fontWeight: 'bold', fontSize: '14px', textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>X</div>
              </Html>
              <Html position={[2.25, 0, 0]} center>
                <div className={fadeExtras ? 'mq-extra' : undefined} style={{ color: axisColor, fontFamily: "'Fira Code', monospace", fontWeight: 'bold', fontSize: '14px', textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>Y</div>
              </Html>
              <Html position={[0, 2.25, 0]} center>
                <div className={fadeExtras ? 'mq-extra' : undefined} style={{ color: '#22c55e', fontFamily: "'Fira Code', monospace", fontWeight: 'bold', fontSize: '14px', textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>Z</div>
              </Html>
            </group>
          )}

          {/* ── 5. Bold Pointed State Vector Arrow ── */}
          {/* 'YXZ' euler order: phi (rotation.y) rotates about world Y after theta (rotation.x) tips the +Y-aligned arrow */}
          <group ref={(el) => { vectorRef.current = el; if (el) el.rotation.order = 'YXZ'; }} position={[0, 0, 0]}>
            <group position={[0, 0, 0]}>
              {/* Solid Vector Shaft */}
              <mesh position={[0, 0.88, 0]}>
                <cylinderGeometry args={[0.034, 0.034, 1.76, 12]} />
                <meshStandardMaterial
                  ref={lockedGlowRef}
                  color={vectorColor}
                  emissive={vectorColor}
                  emissiveIntensity={activeModule === 'superposition' && superpositionStep === 0 ? 3.5 : (isLight ? 2 : 0.85)}
                />
              </mesh>
              {/* Pointed Cone Arrowhead */}
              <mesh position={[0, 1.88, 0]}>
                <coneGeometry args={[0.15, 0.34, 16]} />
                <meshStandardMaterial
                  color={vectorColor}
                  emissive={vectorColor}
                  emissiveIntensity={2.2}
                />
              </mesh>
            </group>

            {/* Icy shimmer particles (Step 0 only) */}
            {activeModule === 'superposition' && superpositionStep === 0 && [0, 1, 2, 3, 4].map((idx) => (
              <mesh
                key={'shimmer-' + idx}
                ref={(el) => { shimmerRefs.current[idx] = el; }}
                position={[0, 0, 0]}
              >
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial
                  color="#a8f0ff"
                  emissive="#00f2fe"
                  emissiveIntensity={3}
                  transparent
                  opacity={0}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        </group>

        {/* ── 6. Freeze crystalline ring at North Pole (Step 0 only) ── */}
        {activeModule === 'superposition' && superpositionStep === 0 && (
          <group ref={freezeRingRef} position={[0, 2.1, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.35, 0.015, 6, 6]} />
              <meshStandardMaterial color="#a8f0ff" emissive="#00f2fe" emissiveIntensity={5} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.55, 0.008, 6, 6]} />
              <meshStandardMaterial color="#a8f0ff" emissive="#00f2fe" emissiveIntensity={3} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.18, 32, 32]} />
              <meshStandardMaterial
                ref={iceCapRef}
                color="#a8f0ff" emissive="#00f2fe" emissiveIntensity={2}
                transparent opacity={0.65} blending={THREE.AdditiveBlending}
              />
            </mesh>
          </group>
        )}

        {/* ── 7. North & South Pole Interactive Nodes and Standardized Labels ── */}
        <group position={[0, 2.1, 0]} ref={northPoleRef} onPointerOver={(e) => { e.stopPropagation(); setHoveredState('north'); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}>
          <mesh><sphereGeometry args={[0.15, 16, 16]} /><meshBasicMaterial visible={false} /></mesh>
          <mesh><sphereGeometry args={[0.03, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh><sphereGeometry args={[0.08, 32, 32]} /><meshPhysicalMaterial color={vectorColor} transmission={1} roughness={0} clearcoat={1} emissive={vectorColor} emissiveIntensity={hoveredState === 'north' ? 3 : 1} /></mesh>
          {hoveredState === 'north' && activeModule !== 'superposition' && (
            <Html position={[0, 0.4, 0]} center zIndexRange={[100, 0]}>
              <div
                className="glass-tooltip cyan-glow"
                style={activeModule === 'entanglement' ? {
                  width: '165px',
                  padding: '7px 12px',
                  borderRadius: '18px',
                  textAlign: 'center',
                  background: 'rgba(10, 18, 30, 0.72)',
                  backdropFilter: 'blur(25px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                  border: '1.5px solid rgba(0, 242, 254, 0.65)',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 22px rgba(0, 242, 254, 0.25)'
                } : {}}
              >
                <h4 style={activeModule === 'entanglement' ? { margin: '0 0 2px 0', fontSize: '11px', color: '#00f2fe' } : {}}>
                  {getTooltipContent('north').title}
                </h4>
                <p style={activeModule === 'entanglement' ? { margin: 0, fontSize: '9.5px', color: '#cbd5e1', lineHeight: '1.35' } : {}}>
                  {getTooltipContent('north').text}
                </p>
              </div>
            </Html>
          )}
        </group>
        <Html position={[0, 2.34, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', fontFamily: 'Inter, sans-serif' }}>|0⟩</span>
        </Html>

        <group position={[0, -2.1, 0]} ref={southPoleRef} onPointerOver={(e) => { e.stopPropagation(); setHoveredState('south'); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}>
          <mesh><sphereGeometry args={[0.15, 16, 16]} /><meshBasicMaterial visible={false} /></mesh>
          <mesh><sphereGeometry args={[0.03, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh><sphereGeometry args={[0.08, 32, 32]} /><meshPhysicalMaterial color="#f093fb" transmission={1} roughness={0} clearcoat={1} emissive="#f093fb" emissiveIntensity={hoveredState === 'south' ? 3 : 1} /></mesh>
          {hoveredState === 'south' && activeModule !== 'superposition' && (
            <Html position={[0, -0.4, 0]} center zIndexRange={[100, 0]}>
              <div
                className="glass-tooltip purple-glow"
                style={activeModule === 'entanglement' ? {
                  width: '165px',
                  padding: '7px 12px',
                  borderRadius: '18px',
                  textAlign: 'center',
                  background: 'rgba(10, 18, 30, 0.72)',
                  backdropFilter: 'blur(25px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                  border: '1.5px solid rgba(240, 147, 251, 0.65)',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 22px rgba(240, 147, 251, 0.25)'
                } : {}}
              >
                <h4 style={activeModule === 'entanglement' ? { margin: '0 0 2px 0', fontSize: '11px', color: '#f093fb' } : {}}>
                  {getTooltipContent('south').title}
                </h4>
                <p style={activeModule === 'entanglement' ? { margin: 0, fontSize: '9.5px', color: '#cbd5e1', lineHeight: '1.35' } : {}}>
                  {getTooltipContent('south').text}
                </p>
              </div>
            </Html>
          )}
        </group>
        <Html position={[0, -2.40, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', fontFamily: 'Inter, sans-serif' }}>|1⟩</span>
        </Html>

        {hoveredState === 'qubit' && activeModule === 'bit-vs-qubit' && measuredValue !== null && (
          <Html position={[-2.5, 2.2, 0]} center zIndexRange={[50, 0]}>
            <div className={'glass-tooltip ' + (measuredValue === 0 ? 'cyan-glow' : 'purple-glow')} style={{ width: '220px' }}>
              <h4>🎯 Collapsed State {measuredValue}</h4>
              <p>The state vector was forced to collapse into a single deterministic reality upon measurement.</p>
            </div>
          </Html>
        )}

          {/* ── STEP 1: Hadamard energy pulse ring falling from north pole ── */}
          {activeModule === 'superposition' && superpositionStep === 1 && (
            <group ref={hadamardPulseRef} position={[0, 2.1, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.6, 0.04, 8, 32]} />
                <meshStandardMaterial
                  ref={hadamardPulseMatRef}
                  color="#f093fb" emissive="#f093fb" emissiveIntensity={8}
                  transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false}
                />
              </mesh>
              {/* Inner bright spark */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.3, 0.025, 6, 16]} />
                <meshStandardMaterial color="#ffffff" emissive="#f093fb" emissiveIntensity={12} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
            </group>
          )}

          {/* ── STEP 2: Orbital trail particles along equator ── */}
          {activeModule === 'superposition' && superpositionStep === 2 && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((idx) => (
            <mesh
              key={`trail-${idx}`}
              ref={(el) => { trailMeshRefs.current[idx] = el; }}
              position={[2, 0, 0]}
            >
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial
                color="#00f2fe" emissive="#00f2fe" emissiveIntensity={2}
                transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false}
              />
            </mesh>
          ))}

          {/* ── STEP 3: Expanding click-invitation ripple ring ── */}
          {activeModule === 'superposition' && superpositionStep === 3 && measuredValue === null && (
            <mesh ref={clickRippleRef} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.2, 0.04, 8, 64]} />
              <meshStandardMaterial
                ref={clickRippleMatRef}
                color="#ffffff" emissive="#f093fb" emissiveIntensity={6}
                transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false}
              />
            </mesh>
          )}

          {/* ── ALL STEPS: White flash overlay on measurement ── */}
          {activeModule === 'superposition' && (
            <mesh>
              <sphereGeometry args={[2.1, 32, 32]} />
              <meshBasicMaterial
                ref={flashMatRef}
                color="#ffffff"
                transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide}
              />
            </mesh>
          )}

          {/* ── POST-COLLAPSE: Victory beacon at measured pole ── */}
          {activeModule === 'superposition' && measuredValue !== null && (
            <group
              ref={beaconRef}
              position={[0, measuredValue === 0 ? 2.1 : -2.1, 0]}
              scale={[0, 0, 0]}
            >
              {/* pulsing outer glow halo */}
              <mesh>
                <sphereGeometry args={[0.45, 32, 32]} />
                <meshStandardMaterial
                  ref={beaconMatRef}
                  color={measuredValue === 0 ? '#00f2fe' : '#f093fb'}
                  emissive={measuredValue === 0 ? '#00f2fe' : '#f093fb'}
                  emissiveIntensity={3}
                  transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false}
                />
              </mesh>
              {/* solid bright core */}
              <mesh>
                <sphereGeometry args={[0.18, 32, 32]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={measuredValue === 0 ? '#00f2fe' : '#f093fb'}
                  emissiveIntensity={8}
                />
              </mesh>
            </group>
          )}

          {/* ── CINEMATIC: Quantum atmosphere sphere (all superposition steps) ── */}
          {activeModule === 'superposition' && (
            <mesh>
              <sphereGeometry args={[3.2, 32, 32]} />
              <meshStandardMaterial
                ref={atmosphereMatRef}
                color="#00f2fe"
                emissive="#00f2fe"
                emissiveIntensity={0.5}
                transparent opacity={0.03}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.BackSide}
              />
            </mesh>
          )}

          {/* ── CINEMATIC Step 1: Hadamard shockwave rings (sonic boom) ── */}
          {activeModule === 'superposition' && superpositionStep === 1 && [0, 1, 2].map((idx) => (
            <mesh
              key={`shockwave-${idx}`}
              ref={(el) => { shockwaveRefs.current[idx] = el; }}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[0, 0, 0]}
            >
              <torusGeometry args={[2, 0.03, 8, 64]} />
              <meshStandardMaterial
                ref={(el) => { shockwaveMatRefs.current[idx] = el; }}
                color="#f093fb"
                emissive={idx === 0 ? '#ffffff' : idx === 1 ? '#f093fb' : '#ff6ec7'}
                emissiveIntensity={10}
                transparent opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ))}

          {/* ── CINEMATIC Step 2: Companion electron orbs orbiting equator ── */}
          {activeModule === 'superposition' && superpositionStep === 2 && [0, 1, 2].map((idx) => (
            <group
              key={`companion-${idx}`}
              ref={(el) => { companionRefs.current[idx] = el; }}
            >
              <mesh>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshStandardMaterial
                  color={idx === 0 ? '#00f2fe' : idx === 1 ? '#f093fb' : '#ffffff'}
                  emissive={idx === 0 ? '#00f2fe' : idx === 1 ? '#f093fb' : '#a8f0ff'}
                  emissiveIntensity={8}
                  transparent opacity={0.8}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={15} />
              </mesh>
            </group>
          ))}

          {/* ── CINEMATIC Step 3: Ghost vector smear (quantum uncertainty blur) ── */}
          {activeModule === 'superposition' && superpositionStep === 3 && measuredValue === null && (
            <>
              <group ref={(el) => { ghostVec1Ref.current = el; if (el) el.rotation.order = 'YXZ'; }} position={[0, 0, 0]}>
                <group position={[0, 1, 0]}>
                  <mesh>
                    <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
                    <meshStandardMaterial
                      ref={ghostVec1MatRef}
                      color="#f093fb" emissive="#f093fb" emissiveIntensity={4}
                      transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false}
                    />
                  </mesh>
                  <mesh position={[0, 1, 0]}>
                    <coneGeometry args={[0.08, 0.25, 8]} />
                    <meshStandardMaterial color="#f093fb" emissive="#f093fb" emissiveIntensity={4} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
                  </mesh>
                </group>
              </group>
              <group ref={(el) => { ghostVec2Ref.current = el; if (el) el.rotation.order = 'YXZ'; }} position={[0, 0, 0]}>
                <group position={[0, 1, 0]}>
                  <mesh>
                    <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
                    <meshStandardMaterial
                      ref={ghostVec2MatRef}
                      color="#00f2fe" emissive="#00f2fe" emissiveIntensity={4}
                      transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false}
                    />
                  </mesh>
                  <mesh position={[0, 1, 0]}>
                    <coneGeometry args={[0.08, 0.25, 8]} />
                    <meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={4} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
                  </mesh>
                </group>
              </group>
            </>
          )}

          {/* ── CINEMATIC: Collapse explosion rings from measured pole ── */}
          {activeModule === 'superposition' && measuredValue !== null && [0, 1, 2].map((idx) => (
            <mesh
              key={`collapsering-${idx}`}
              ref={(el) => { collapseRingRefs.current[idx] = el; }}
              position={[0, measuredValue === 0 ? 2.1 : -2.1, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[0, 0, 0]}
            >
              <torusGeometry args={[1, 0.025, 8, 64]} />
              <meshStandardMaterial
                ref={(el) => { collapseRingMatRefs.current[idx] = el; }}
                color={measuredValue === 0 ? '#00f2fe' : '#f093fb'}
                emissive={measuredValue === 0 ? '#00f2fe' : '#f093fb'}
                emissiveIntensity={12}
                transparent opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ))}
      </a.group>
    </group>
  );
};

export default function BlochSphere({ theme, activeModule, qubitCount, isDecohering, attemptCopy, isSidebarOpen, setIsSidebarOpen, interferenceStep, interferencePhase, isGlobalMuted = false, vanishing = false, multi = null, handoverTarget, centerOnly = false }) {
  const isLight = theme === 'light';
  const tetherRef = useRef();
  const controlsRef = useRef();
  const cameraStepTime = useRef(0);
  const prevCameraStep = useRef(-1);
  const light1Ref = useRef();
  const light2Ref = useRef();
  const { size, camera, clock } = useThree();
  const { initAudio, stopCurrentAudio, toggleMute, playGroundState, playHadamard, playInfinitePossibilities, playCollapseAnticipation, playMeasurement } = useQuantumAudio();

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

  const [hoveredDomain, setHoveredDomain] = useState(null);
  const [leftScale, setLeftScale] = useState(1);
  const [rightScale, setRightScale] = useState(1);
  const [hoverTether, setHoverTether] = useState(false);
  const [superpositionStep, setSuperpositionStep] = useState(0);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [globalMeasuredValue, setGlobalMeasuredValue] = useState(null);
  const hoverTimeouts = useRef({});
  const rigRef = useRef();
  const leftRig = useRef();
  const [bitOn, setBitOn] = useState(true);
  const rightRig = useRef();
  const targetRig = useRef();
  const bloomRef = useRef(null);
  const bloomSet = useRef(false);
  const ctlLabel = useRef();
  const tgtLabel = useRef();
  const isMulti = activeModule === 'multi-qubit-gates'; // the hub's scene standing in for Multi Qubit Gates
  const isEnt = activeModule === 'entanglement';        // ... or for Entanglement (Alice and Bob)
  const isDec = activeModule === 'decoherence';        // ... or for Decoherence (the pure and the noisy qubit)
  const isPair = isMulti || isEnt || isDec;
  const isExp = activeModule === 'exponential';        // ... or for Exponential State Space (the lone qubit zooms in)
  const isRig = isPair || isExp;                       // the rig takes the module's size when zoomed
  const entX0 = handoff.entPairX || 4.6;
  const targetX = useRef(multi === 'zoom' ? (isEnt ? entX0 : isDec ? 5.8 : 2) : multi === 'split' ? 2.4 : 0);
  const targetY = useRef(multi === 'zoom' && !isEnt ? (isDec ? 1.65 : 1.2) : 0);
  const targetS = useRef(multi === 'zoom' ? (isEnt ? 1.15 : isDec ? 1.375 : 1) : 1.2);
  const [targetOn, setTargetOn] = useState(multi === 'split' || multi === 'zoom');
  // The pair's poses: 'center' (one qubit, hub size), 'split' (two, hub size), 'zoom' (two, the
  // module's size and places). Positions are in the rig's units: spheres touch at 2.4 (hub) / 2 (module).
  // (Entanglement's zoom: Alice and Bob stand 4.6 either side of the middle at 1.15 size, on the axis.)
  const mz = isRig && multi === 'zoom';
  const mSplit = isPair && (multi === 'split' || multi === 'zoom');
  const zoomY = isEnt ? 0 : isDec ? 1.65 : isExp ? 0.6 : 1.2;                      // the pair's height in the zoomed pose (rig units)
  const zoomS = isEnt || isExp ? 1.15 / 1.2 : isDec ? 1.375 / 1.2 : 1 / 1.2;         // the first qubit's scale there (relative to its 1.2)
  const zoomT = isEnt ? 1.15 : isDec ? 1.375 : 1;                     // the second qubit's scale there
  const settleCam = useRef(0);
  const centerD0 = useRef(null);
  // Entanglement lights its pair from a little higher; the lights glide there as the pair zooms in
  // (and back as it zooms out). They start where the scene was handing over.
  const lightStart = useMemo(() => (isEnt && multi === 'zoom' ? _LIGHTS_ENT : isExp && multi === 'zoom' ? _LIGHTS_EXP : isDec && multi === 'zoom' ? _LIGHTS_DEC : _LIGHTS_HUB), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lightInit = useMemo(() => (isExp && multi === 'zoom' ? _EXP_LIGHT : isDec && multi === 'zoom' ? _DEC_LIGHT : _HUB_LIGHT), []); // eslint-disable-line react-hooks/exhaustive-deps
  const ambRef = useRef();
  // Closing Decoherence: the pair takes the scene's arrows over as they were (not the opening's start state).
  const decClosing = useRef(isDec && multi === 'zoom').current;
  // The pair's arrows, as world directions: held still while the pair moves (from wherever the lone qubit's
  // arrow was when it was clicked; on a close, from where the module's were).
  const vecOut = useRef(null);
  const decDir = useRef({ a: new THREE.Vector3(0, 1, 0), b: new THREE.Vector3(0, 1, 0), closed: false });
  // The same arrows as seen from the camera: the hub's camera slowly orbits and then settles as the pair moves,
  // so the arrows are held still on screen (not in the world), whatever the camera does.
  const decView = useRef({ a: new THREE.Vector3(0, 1, 0), b: new THREE.Vector3(0, 1, 0) });
  const wasDec = useRef(false);
  if (decClosing && !decDir.current.closed) {
    // (at the first render, so the spheres' first frame already has the module's arrows)
    decDir.current.closed = true;
    decDir.current.a.copy(_UPV).applyQuaternion(handoff.decQ.pure);
    decDir.current.b.copy(_UPV).applyQuaternion(handoff.decQ.noisy);
    _tmpQ2.copy(camera.quaternion).invert();
    decView.current.a.copy(decDir.current.a).applyQuaternion(_tmpQ2);
    decView.current.b.copy(decDir.current.b).applyQuaternion(_tmpQ2);
  }
  if (isDec) wasDec.current = true;
  useEffect(() => { if (isDec && !decClosing) { arrowGrow.p = 0; arrowGrow.target = 1; } }, [isDec]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    // First paint at the right size (no growth on a direct load).
    const rig = rigRef.current;
    const zoomed = isRig && multi === 'zoom';
    if (rig) {
      rig.scale.setScalar(!activeModule ? 0.7 : isRig ? (zoomed ? 1 : 0.7) : 1);
      rig.position.y = !activeModule ? -0.8 : isMulti ? (zoomed ? -0.5 : -0.8) : isEnt || isExp || isDec ? (zoomed ? 0 : -0.8) : activeModule === 'gates' ? -0.5 : 0;
    }
    const solo = activeModule === 'superposition' || activeModule === 'interference' || isRig || centerOnly;
    if (leftRig.current) leftRig.current.scale.setScalar(solo ? 0.0001 : 1);
    if (solo) setBitOn(false);
    if (rightRig.current) {
      rightRig.current.position.x = isPair ? (zoomed ? -(isEnt ? entX0 : isDec ? 5.8 : 2) : multi === 'split' ? -2.4 : 0) : isExp ? 0 : solo ? 0 : 4.2;
      rightRig.current.position.y = zoomed ? zoomY : 0;
      rightRig.current.scale.setScalar(zoomed ? zoomS : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeouts = hoverTimeouts.current;
    return () => {
      Object.values(timeouts).forEach(t => clearTimeout(t));
    };
  }, []);


  // Keep master gain in sync with the app-wide mute toggle
  const isGlobalMutedRef = useRef(isGlobalMuted);
  useEffect(() => {
    isGlobalMutedRef.current = isGlobalMuted;
    toggleMute(isGlobalMuted);
  }, [isGlobalMuted, toggleMute]);

  // Module enter/leave
  useEffect(() => {
    if (activeModule === 'superposition') {
      setSuperpositionStep(0);
      setHasMeasured(false);
      // Initialize audio context if user has interacted with document, and play the ground state
      try {
        initAudio();
        toggleMute(isGlobalMutedRef.current);
        playGroundState();
      } catch (e) {
        console.log("Audio init blocked before first interaction", e);
      }
    } else {
      setSuperpositionStep(-1);
      setHasMeasured(false);
      stopCurrentAudio();
    }
  }, [activeModule, initAudio, playGroundState, stopCurrentAudio, toggleMute]);

  // Opening a module: a first load starts at the module's view; moving
  // between the modules of this scene eases the camera there (superposition
  // runs its own cinematic camera).
  useEffect(() => {
    if (activeModule !== 'superposition' && activeModule !== 'interference') setBitOn(true);
  }, [activeModule]);
  useEffect(() => { if (mSplit) setTargetOn(true); }, [mSplit]);
  const camReady = useRef(false);
  useEffect(() => {
    const first = !camReady.current;
    camReady.current = true;
    if (!activeModule || !controlsRef.current || !camera) return;
    if (first && (activeModule === 'gates' || activeModule === 'multi-qubit-gates' || activeModule === 'interference' || activeModule === 'entanglement' || activeModule === 'exponential' || activeModule === 'decoherence')) {
      // Standing in for a module's scene: the camera is where that module left it.
    } else if (first) {
      camera.position.set(0, 0, 13);
      camera.rotation.set(0, 0, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    } else if (activeModule !== 'superposition') {
      settleCam.current = 1.6;
    }
  }, [activeModule, camera]);

  const handleHoverDomain = (domain) => {
    if (hoverTimeouts.current[domain]) clearTimeout(hoverTimeouts.current[domain]);
    setHoveredDomain(domain);
  };

  const handleUnhoverDomain = (domain) => {
    hoverTimeouts.current[domain] = setTimeout(() => {
      setHoveredDomain((prev) => (prev === domain ? null : prev));
    }, 50);
  };

  const SCENES = [
    { step: 0, title: '⚛️ The Ground State', text: <>A Quantum Bit begins here — locked at <InlineMath math={String.raw`|0\rangle`} />, identical to a classical zero. Rigid. Deterministic.</>, pos: 'top-left' },
    { step: 1, title: '❌ Classical Limit', text: <>A classical bit can jump to <InlineMath math={String.raw`|1\rangle`} />, but it MUST travel instantly. It can never stop between 0 and 1.</>, pos: 'bottom-left' },
    { step: 2, title: '🌊 Infinite Possibilities', text: <>It is simultaneously <InlineMath math={String.raw`|0\rangle`} /> and <InlineMath math={String.raw`|1\rangle`} />! The vector sweeps the equator — a continuous wave of probability amplitudes.</>, pos: 'top-right' },
    { step: 3, title: '🎯 Collapse: Your Turn', text: 'The quantum state holds every possibility at once... until observed. Click the sphere to force a measurement and collapse the wave function!', pos: 'bottom-right' },
  ];

  const handleWheelLeft = (e) => {
    e.stopPropagation();
    if (hoveredDomain === 'left') {
      setLeftScale(s => Math.min(Math.max(s - e.deltaY * 0.001, 0.5), 2.0));
    }
  };

  const handleWheelRight = (e) => {
    e.stopPropagation();
    if (hoveredDomain === 'right') {
      setRightScale(s => Math.min(Math.max(s - e.deltaY * 0.001, 0.5), 2.0));
    }
  };

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    // Follow the lone qubit's arrow (world direction) until the flow starts; then hold it.
    if (!isDec && vecOut.current) {
      vecOut.current.getWorldQuaternion(_tmpQ);
      decDir.current.a.copy(_UPV).applyQuaternion(_tmpQ);
      decDir.current.b.copy(decDir.current.a);
      _tmpQ2.copy(state.camera.quaternion).invert();
      decView.current.a.copy(decDir.current.a).applyQuaternion(_tmpQ2);
      decView.current.b.copy(decView.current.a);
    }
    // Decoherence's view is driven here, with the very glide the pair uses (not by a separate tween), so the
    // camera and the models arrive together and the hand-over finds them exactly where the module has them.
    if (isDec && controlsRef.current) {
      const goalDec = mz ? (decClosing ? null : 'module') : (decClosing && (multi === 'split' || multi === 'merge') ? 'hub' : null);
      if (goalDec) {
        const kc = 1 - Math.exp(-GLIDE * Math.min(delta, 0.1));
        const c = controlsRef.current;
        c.object.position.lerp(goalDec === 'module' ? _DEC_CAM : _HUB_CAM, kc);
        c.target.lerp(goalDec === 'module' ? _DEC_LOOK : _ORIGIN_BS, kc);
        c.update();
        settleCam.current = 0;
      }
    }
    if (isDec) {
      const dd = decDir.current;
      dd.a.copy(decView.current.a).applyQuaternion(state.camera.quaternion);
      dd.b.copy(decView.current.b).applyQuaternion(state.camera.quaternion);
      handoff.decStart.pure.copy(dd.a);
      handoff.decStart.noisy.copy(dd.b);
      // The arrows grow slowly before the pair splits and zooms; on a close they shrink back once it has zoomed out.
      const ak = 1 - Math.exp(-GLIDE * (2.2 / 2.6) * Math.min(delta, 0.1));
      const goal = decClosing && (multi === 'split' || multi === 'merge') ? 0 : 1;
      arrowGrow.p += (goal - arrowGrow.p) * ak;
    }

    // The lone qubit's depth at the moment it starts coming to the middle (before it has
    // moved at all this frame): the size it will hold is measured against this.
    if (centerOnly && centerD0.current === null && rightRig.current) {
      rightRig.current.getWorldPosition(_tmpV);
      state.camera.updateMatrixWorld();
      _tmpM.copy(state.camera.matrixWorld).invert();
      centerD0.current = -_tmpV.applyMatrix4(_tmpM).z;
    }

    // ── Hub <-> module: the two bits stay and grow to the module's size ──
    if (rigRef.current) {
      const rig = rigRef.current;
      const k = 1 - Math.exp(-(vanishing ? 7 : GLIDE * (2.5 / 2.6)) * Math.min(delta, 0.1));
      const ts = vanishing ? 0.0001 : !activeModule ? 0.7 : isRig ? (mz ? 1 : 0.7) : 1;
      const ty = !activeModule ? -0.8 : isMulti ? (mz ? -0.5 : -0.8) : isEnt || isExp || isDec ? (mz ? 0 : -0.8) : activeModule === 'gates' ? -0.5 : 0;
      rig.scale.setScalar(rig.scale.x + (ts - rig.scale.x) * k);
      rig.position.y += (ty - rig.position.y) * k;
    }
    // Superposition is the qubit alone: the classical bit shrinks away and the qubit slides to the middle.
    {
      const solo = activeModule === 'superposition' || activeModule === 'interference' || isRig || centerOnly;
      const k = 1 - Math.exp(-(centerOnly ? 7 : solo ? 4.2 : 2.5) * Math.min(delta, 0.1));
      const l = leftRig.current;
      if (l) {
        const s = Math.max(0.0001, l.scale.x + ((solo ? 0 : 1) - l.scale.x) * k);
        l.scale.setScalar(s);
        const host = state.gl.domElement.parentElement;
        if (host) host.style.setProperty('--bit-fade', String(Math.min(1, Math.max(0, (s - 0.1) / 0.4))));
        if (solo && s < 0.06) setBitOn(false);
      }
      const r = rightRig.current;
      const km = 1 - Math.exp(-GLIDE * Math.min(delta, 0.1)); // the move / split / zoom glide
      // Each module's glow, eased in with the move (set outright on the first frame).
      const bloom = bloomRef.current;
      if (bloom) {
        const th = isExp ? 0.25 : isDec ? 0.16 : 0.3;
        const it = activeModule === 'gates' || activeModule === 'multi-qubit-gates' ? 0.4 : isEnt ? 0.45 : isExp || isDec ? 0.65 : 0.6;
        const kb = bloomSet.current ? km : 1;
        bloomSet.current = true;
        bloom.intensity += (it - bloom.intensity) * kb;
        bloom.luminanceMaterial.threshold += (th - bloom.luminanceMaterial.threshold) * kb;
      }
      const pairX = mz ? (isEnt ? (handoff.entPairX || 4.6) : isDec ? 5.8 : 2) : 2.4; // half the gap between the pair
      if (isEnt && !mz) handoff.entPairX = 4.6; // a fresh open starts from the module's default spacing
      const lg = isEnt && mz ? _LIGHTS_ENT : isExp && mz ? _LIGHTS_EXP : isDec && mz ? _LIGHTS_DEC : _LIGHTS_HUB;
      if (light1Ref.current) light1Ref.current.position.lerp(_tmpL.set(...lg[0]), km);
      if (light2Ref.current) light2Ref.current.position.lerp(_tmpL.set(...lg[1]), km);
      if (isExp || isDec) {
        // Through the whole move the lights glide between the hub's and the module's, so nothing jumps at the hand-over.
        const lt = mz ? (isDec ? _DEC_LIGHT : _EXP_LIGHT) : _HUB_LIGHT;
        const l1 = light1Ref.current, l2 = light2Ref.current;
        if (ambRef.current) ambRef.current.intensity += (lt.amb - ambRef.current.intensity) * km;
        if (l1) { l1.color.lerp(lt.c1, km); l1.intensity += (lt.i1 - l1.intensity) * km; l1.distance += (lt.dist - l1.distance) * km; }
        if (l2) { l2.color.lerp(lt.c2, km); l2.intensity += (lt.i2 - l2.intensity) * km; l2.distance += (lt.dist - l2.distance) * km; }
      }
      if (r) {
        const goalX = isPair ? (mSplit ? -pairX : 0) : solo ? 0 : 4.2;
        r.position.x += (goalX - r.position.x) * (isRig ? km : k);
        // (Exponential's qubit floats a little in its own scene; the same bob here keeps the hand-over exact.)
        const goalY = isExp && mz ? 0.6 + Math.sin(state.clock.getElapsedTime() * 1.2) * 0.06 : mz ? zoomY : 0;
        r.position.y += (goalY - r.position.y) * km;
        r.scale.setScalar(r.scale.x + ((mz ? zoomS : 1) - r.scale.x) * km);
      }
      // The second qubit of the pair splits off the first and glides to its place.
      targetX.current += ((mSplit ? pairX : 0) - targetX.current) * km;
      targetY.current += ((mz ? zoomY : 0) - targetY.current) * km;
      targetS.current += ((mz ? zoomT : 1.2) - targetS.current) * km;
      if (targetRig.current) { targetRig.current.position.set(targetX.current, targetY.current, 0); targetRig.current.scale.setScalar(targetS.current); }
      if (r && ctlLabel.current) { ctlLabel.current.position.set(r.position.x, r.position.y, 0); ctlLabel.current.scale.setScalar(r.scale.x * 1.2); }
      if (tgtLabel.current) { tgtLabel.current.position.set(targetX.current, targetY.current, 0); tgtLabel.current.scale.setScalar(targetS.current); }
      if (targetOn && !mSplit && targetX.current < 0.04) setTargetOn(false);

    }
    // The hub's slow orbit leaves the camera anywhere; ease it back to the module's view.
    if (settleCam.current > 0 && controlsRef.current) {
      settleCam.current -= delta;
      const k = 1 - Math.exp(-4 * Math.min(delta, 0.1));
      controlsRef.current.object.position.lerp(_DEFAULT_CAM_BS, k);
      controlsRef.current.target.lerp(_ORIGIN_BS, k);
      controlsRef.current.update();
    }

    // The hub's camera has been slowly orbiting, so the qubit may be nearer or farther than
    // it will be once the camera settles. While it comes to the middle alone, scale it with
    // its depth from the camera (measured after the camera has moved this frame) so it holds
    // the size it had when you clicked (no shrink before the module's zoom); the module's
    // intro starts from that same size.
    if (centerOnly && rightRig.current) {
      const r = rightRig.current;
      r.getWorldPosition(_tmpV);
      state.camera.updateMatrixWorld();
      _tmpM.copy(state.camera.matrixWorld).invert();
      const d = -_tmpV.applyMatrix4(_tmpM).z; // depth along the view axis
      if (centerD0.current === null) centerD0.current = d;
      const sc = Math.min(2, Math.max(0.5, d / centerD0.current));
      r.scale.setScalar(sc);
      handoff.qubitScale = sc;
    }

    // ── Dynamic lights per superposition step ──
    if (activeModule === 'superposition') {
      const sc = _STEP_COLORS_BS[superpositionStep] || _STEP_COLORS_BS[0];
      if (light1Ref.current) {
        _tempColor1_BS.set(sc.c1);
        light1Ref.current.color.lerp(_tempColor1_BS, 0.05);
        const targetIntensity =
          superpositionStep === 0 ? 6
          : superpositionStep === 1 ? 18
          : superpositionStep === 2 ? 10 + Math.sin(time * 2) * 4
          : superpositionStep === 3 ? 8 + Math.sin(time * 6) * 6
          : 8;
        light1Ref.current.intensity = THREE.MathUtils.lerp(light1Ref.current.intensity, targetIntensity, 0.05);
      }
      if (light2Ref.current) {
        _tempColor2_BS.set(sc.c2);
        light2Ref.current.color.lerp(_tempColor2_BS, 0.05);
      }
    } else {
      if (light1Ref.current && !isExp && !isDec) light1Ref.current.intensity = THREE.MathUtils.lerp(light1Ref.current.intensity, isLight ? 12 : 8, 0.05);
    }

    // ── Cinematic camera per superposition step ──
    if (activeModule === 'superposition' && controlsRef.current) {
      if (prevCameraStep.current !== superpositionStep) {
        cameraStepTime.current = time;
        prevCameraStep.current = superpositionStep;
      }
      const elapsed = time - cameraStepTime.current;
      const lerpSpeed = Math.max(0.008, 0.05 * (1 - elapsed / 2.5)); // fast at start, slows to stop
      if (elapsed < 3.5) {
        const target = _CAM_TARGETS_BS[superpositionStep] || _DEFAULT_CAM_BS;
        controlsRef.current.object.position.lerp(target, lerpSpeed);
        controlsRef.current.target.lerp(_ORIGIN_BS, lerpSpeed);
        controlsRef.current.update();
      }
    } else if (activeModule !== 'superposition') {
      prevCameraStep.current = -1;
    }

    if (tetherRef.current) {
      if (activeModule === 'nocloning') {
        tetherRef.current.color.setHex(0xef4444); tetherRef.current.emissive.setHex(0xef4444);
        tetherRef.current.emissiveIntensity = attemptCopy ? 4 : 0; tetherRef.current.opacity = attemptCopy ? 0.8 : 0;
      } else {
        tetherRef.current.color.setHex(0xf093fb); tetherRef.current.emissive.setHex(0xf093fb);
        tetherRef.current.emissiveIntensity = 2 + Math.sin(time * 5) * 1.5; tetherRef.current.opacity = 0.6;
      }
    }
  });

  return (
    <>
      <QualityComposer disableNormalPass>
        {/* Fixed props: a new threshold or intensity would rebuild the effect and recompile its
            shaders on the spot (the very frame a module starts opening). bloomGlow sets them. */}
        <Bloom ref={bloomRef} luminanceThreshold={0.3} mipmapBlur intensity={0.6} />
      </QualityComposer>
      <ambientLight ref={ambRef} intensity={isLight ? 0.8 : lightInit.amb} />
      <pointLight ref={light1Ref} position={lightStart[0]} color={lightInit.c1} intensity={isLight ? 12 : lightInit.i1} distance={lightInit.dist} />
      <pointLight ref={light2Ref} position={lightStart[1]} color={lightInit.c2} intensity={isLight ? 12 : lightInit.i2} distance={lightInit.dist} />

      {activeModule !== 'interference' && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={handoverTarget || [0, 0, 0]}
          enabled={hoveredDomain === null}
          enableZoom={true}
          enablePan={false}
          minDistance={5}
          maxDistance={20}
          autoRotate={!activeModule && !centerOnly}
          autoRotateSpeed={0.5}
        />
      )}


      <group ref={rigRef}>
        <group ref={leftRig} position={[-4.2, 0, 0]} onWheel={handleWheelLeft}>

        <mesh position={[0, 0, -2.5]} onPointerOver={(e) => { e.stopPropagation(); handleHoverDomain('left'); }} onPointerOut={() => handleUnhoverDomain('left')} visible={false}>
          <planeGeometry args={[6, 6]} />
        </mesh>

        <PresentationControls global={false} cursor={true} snap={true} speed={2.5} polar={[-Math.PI / 3, Math.PI / 3]}>
          <group scale={leftScale}>
            {activeModule === 'nocloning' ? (
              <group>
                <ClassicalBit position={[-1, 0, 0]} scale={0.8} theme={theme} flipMode="slow" onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
                <ClassicalBit position={[1, 0, 0]} scale={0.8} theme={theme} attemptCopy={attemptCopy} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
                {attemptCopy && <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 2, 16]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={3} /></mesh>}
              </group>
            ) : activeModule === 'error-correction' ? (
              <group>
                <ClassicalBit position={[-1.2, 0, 0]} scale={0.6} theme={theme} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
                <ClassicalBit position={[0, 0, 0]} scale={0.6} theme={theme} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
                <ClassicalBit position={[1.2, 0, 0]} scale={0.6} theme={theme} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
              </group>
            ) : !bitOn ? null : (
                <ClassicalBit position={[0, 0, 0]} scale={1.1} theme={theme} activeModule={activeModule} isDecohering={isDecohering} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
              )}
          </group>
        </PresentationControls>
      </group>

      {activeModule === 'bit-vs-qubit' && (
        <Html position={[0, 0, 0]} center zIndexRange={[100, 0]}>
          <div className="vs-badge" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: isLight ? 'rgba(255,255,255,0.4)' : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.0))',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.18)', borderRadius: '50%',
            width: '80px', height: '80px', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)',
            animation: 'pulseVS 3s infinite alternate, moduleFade 0.7s ease-out 0.5s both'
          }}>
            <span style={{ fontSize: '32px', fontWeight: '900', background: 'linear-gradient(to right, #00f2fe, #f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Inter', sans-serif" }}>VS</span>
          </div>
          <style>
            {`
              @keyframes pulseVS {
                0% { box-shadow: 0 0 15px 0 rgba(0, 242, 254, 0.4); transform: scale(1); }
                100% { box-shadow: 0 0 35px 0 rgba(240, 147, 251, 0.6); transform: scale(1.05); }
              }
            `}
          </style>
        </Html>
      )}

      {isPair && (
        <>
          {isMulti && (
            <group ref={ctlLabel}>
              <Html position={[0, -2.6, 0]} center>
                <div className="mq-extra" style={{ color: '#eab308', fontWeight: 'bold', fontSize: '15px', textShadow: '0 0 10px #eab30880', whiteSpace: 'nowrap', letterSpacing: '1px', opacity: multi === 'merge' ? 0 : 1, transition: 'opacity 0.35s' }}>Control</div>
              </Html>
            </group>
          )}
          {targetOn && (
            <>
              <group ref={targetRig} position={[targetX.current, targetY.current, 0]} scale={targetS.current}>
                {isEnt ? (
                  <QubitCore activeModule="entanglement" theme={theme} customVectorQuat={_Q_UP} showCustomVector={true} emissiveColor="#00f2fe" />
                ) : isDec ? (
                  <group scale={_DEC_UNIT_SECOND}>
                    <BlochSphereUnit posArr={[0, 0, 0]} color={CA} label="" isPure={false} noiseLevel={0} activeNoise={null} entranceRef={DEC_STATIC_ENTRANCE} posKey="noisy" step="intro" tempK={300} showLabels={false} dirOverride={decDir.current.b} />
                  </group>
                ) : (
                  <QubitCore
                    activeModule="multi-qubit-gates"
                    theme={theme}
                    customVectorQuat={_Q_UP}
                    showCustomVector={true}
                    customGridColor="#0284c7"
                    customRingColor="#38bdf8"
                    emissiveColor="#0ea5e9"
                    fadeExtras
                  />
                )}
              </group>
              {isMulti && (
                <group ref={tgtLabel} position={[targetX.current, targetY.current, 0]} scale={targetS.current}>
                  <Html position={[0, -2.6, 0]} center>
                    <div className="mq-extra" style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '15px', textShadow: '0 0 10px #38bdf880', whiteSpace: 'nowrap', letterSpacing: '1px', opacity: mSplit ? 1 : 0, transition: 'opacity 0.35s' }}>Target</div>
                  </Html>
                </group>
              )}
            </>
          )}
        </>
      )}

      <group ref={rightRig} onWheel={handleWheelRight}>

        <mesh position={[0, 0, -2.5]} onPointerOver={(e) => { e.stopPropagation(); handleHoverDomain('right'); }} onPointerOut={() => handleUnhoverDomain('right')} visible={false}>
          <planeGeometry args={[6, 6]} />
        </mesh>

        <PresentationControls global={false} cursor={true} snap={true} speed={1.5} polar={[-Math.PI / 3, Math.PI / 3]}>
          <group scale={rightScale}>
            {activeModule === 'superposition' ? (
              <>
                <QubitCore
                  position={[0, 0, 0]}
                  scale={1.2}
                  theme={theme}
                  activeModule={activeModule}
                  superpositionStep={superpositionStep}
                  onMeasure={() => {
                    initAudio();
                    playMeasurement();
                    setHasMeasured(true);
                    setSuperpositionStep(4);
                  }}
                  onMeasuredValueChange={setGlobalMeasuredValue}
                  onDomainHover={() => handleHoverDomain('right')}
                  onDomainUnhover={() => handleUnhoverDomain('right')}
                />
              </>
            ) : activeModule === 'error-correction' ? (
              <group>
                <QubitCore position={[0, 0, 0]} scale={0.9} theme={theme} activeModule={activeModule} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
                <QubitCore position={[-2.2, 0, 0]} scale={0.4} theme={theme} activeModule={activeModule} isAncilla={true} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
                <QubitCore position={[2.2, 0, 0]} scale={0.4} theme={theme} activeModule={activeModule} isAncilla={true} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
                <QubitCore position={[0, 2.2, 0]} scale={0.4} theme={theme} activeModule={activeModule} isAncilla={true} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
                <QubitCore position={[0, -2.2, 0]} scale={0.4} theme={theme} activeModule={activeModule} isAncilla={true} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
              </group>
            ) : activeModule === 'nocloning' ? (
              <group>
                <QubitCore position={[-1.8, 0, 0]} scale={0.8} theme={theme} activeModule={activeModule} attemptCopy={attemptCopy} isEntangled={false} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
                <QubitCore position={[1.8, 0, 0]} scale={0.8} theme={theme} activeModule={activeModule} attemptCopy={attemptCopy} isEntangled={false} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />

                <group onPointerOver={(e) => { e.stopPropagation(); setHoverTether(true); }} onPointerOut={() => setHoverTether(false)}>
                  <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 3.6, 16]} /><meshStandardMaterial ref={tetherRef} transparent blending={THREE.AdditiveBlending} /></mesh>
                  <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}><cylinderGeometry args={[0.3, 0.3, 3.6, 16]} /><meshBasicMaterial visible={false} /></mesh>
                  {hoverTether && (
                    <Html position={[0, 0.5, 0]} center zIndexRange={[100, 0]}>
                      <div className={`glass-tooltip ${attemptCopy ? 'red-glow' : 'purple-glow'}`} >
                        <h4>{attemptCopy ? "Violation: State Collapsed" : "Data Transfer Channel"}</h4>
                        <p>{attemptCopy ? "The No-Cloning theorem was triggered!" : "Represents the CNOT entanglement link."}</p>
                      </div>
                    </Html>
                  )}
                </group>
              </group>
            ) : activeModule === 'interference' ? (
              <QubitCore 
                position={[0, 0, 0]} 
                scale={1.2} 
                theme={theme} 
                activeModule={activeModule} 
                interferenceStep={interferenceStep}
                interferencePhase={interferencePhase}
                onDomainHover={() => handleHoverDomain('right')} 
                onDomainUnhover={() => handleUnhoverDomain('right')} 
              />
            ) : isDec ? (
              <group scale={_DEC_UNIT_FIRST}>
                <BlochSphereUnit posArr={[0, 0, 0]} color={CT} label="" isPure={true} noiseLevel={0} activeNoise={null} entranceRef={DEC_STATIC_ENTRANCE} posKey="pure" step="intro" tempK={300} showLabels={false} dirOverride={decDir.current.a} />
              </group>
            ) : (
              <QubitCore position={[0, 0, 0]} scale={1.2} theme={theme} activeModule={activeModule} isDecohering={isDecohering} vectorOut={vecOut} startDir={wasDec.current ? _decStartLocal.copy(decDir.current.a).applyAxisAngle(_AXIS_Y, -clock.getElapsedTime() * 0.04) : undefined} customVectorQuat={isRig || centerOnly ? _Q_UP : undefined} showCustomVector={isRig || centerOnly || undefined} emissiveColor={isMulti ? '#eab308' : isEnt || isExp ? '#00f2fe' : isDec ? '#14b8a6' : undefined} fadeExtras={isMulti} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
            )}
          </group>
        </PresentationControls>
      </group>
      </group>

      {activeModule === 'superposition' && superpositionStep >= 0 && (
        <>
          <Html 
            fullscreen 
            zIndexRange={[200, 0]} 
            style={{ pointerEvents: 'none' }}
            calculatePosition={(el, camera, size) => [size.width / 2, size.height / 2]}
          >
            <div style={uiBoundsStyle}>
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
                <defs>
                  <marker id="arrowhead-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#00f2fe" />
                  </marker>
                  <marker id="arrowhead-purple" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#f093fb" />
                  </marker>
                  <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ff0844" />
                  </marker>
                </defs>
                {SCENES.map((scene, i) => {
                  if (i > superpositionStep || (hasMeasured && i !== 3)) return null;

                  const sidebarWidth = isSidebarOpen ? 420 : 112;
                  const cw = size.width - sidebarWidth;
                  const ch = size.height;

                  const startCoords = {
                    'top-left': { x1: 380, y1: 130 },
                    'top-right': { x1: cw - 380, y1: 130 },
                    'bottom-left': { x1: 380, y1: ch - 130 },
                    'bottom-right': { x1: cw - 380, y1: ch - 130 },
                  }[scene.pos];

                  const targetCoords = {
                    'top-left': { x2: cw / 2 - 20, y2: ch / 2 - 170 },
                    'top-right': { x2: cw / 2 + 170, y2: ch / 2 - 20 },
                    'bottom-left': { x2: cw / 2 - 170, y2: ch / 2 + 20 },
                    'bottom-right': { x2: cw / 2 + 50, y2: ch / 2 + 170 },
                  }[scene.pos];

                  const color = i === 0 || i === 2 ? '#00f2fe' : i === 1 ? '#f093fb' : '#ff0844';
                  const marker = i === 0 || i === 2 ? 'url(#arrowhead-cyan)' : i === 1 ? 'url(#arrowhead-purple)' : 'url(#arrowhead-red)';

                return (
                  <g key={`arrow-${i}`}>
                    <line
                      x1={startCoords.x1}
                      y1={startCoords.y1}
                      x2={targetCoords.x2}
                      y2={targetCoords.y2}
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      markerEnd={marker}
                    />
                    <circle cx={startCoords.x1} cy={startCoords.y1} r="3" fill={color} />
                  </g>
                );
              })}
            </svg>

            {/* 4 Corner Subtitle Cards */}
            {SCENES.map((scene, i) => {
              const isVisible = i <= superpositionStep;
              if (!isVisible || (hasMeasured && i !== 3)) return null;

              const posStyles = {
                'top-left': { top: '80px', left: '50px' },
                'top-right': { top: '80px', right: '50px' },
                'bottom-left': { bottom: '50px', left: '50px' },
                'bottom-right': { bottom: '50px', right: '50px' },
              }[scene.pos];

              return (
                <div key={i} style={{
                  position: 'absolute',
                  ...posStyles,
                  width: '320px',
                  zIndex: 201,
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
                  transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  pointerEvents: 'none',
                }}>
                  <div data-jelly className={`glass-tooltip glass-tooltip-corner ${hasMeasured && i === 3
                      ? (globalMeasuredValue === 0 ? 'cyan-glow' : 'purple-glow')
                      : (i === 0 ? 'cyan-glow' : i === 1 ? 'purple-glow' : i === 2 ? 'cyan-glow' : 'red-glow')
                    }`} style={{
                      background: isLight ? 'rgba(255,255,255,0.85)' : 'var(--glass-bg)',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                    <h4>
                      {hasMeasured && i === 3 ? '🎯 Wave Function Collapsed' : scene.title}
                    </h4>
                    <p>
                      {hasMeasured && i === 3 ? <>The observation forced the superposition to snap into a rigid state (either <InlineMath math={String.raw`|0\rangle`} /> or <InlineMath math={String.raw`|1\rangle`} />). The infinite possibilities are gone, leaving a single deterministic reality.</> : scene.text}
                    </p>

                    {i === 3 && !hasMeasured && (
                      <div style={{
                        marginTop: '8px', padding: '8px 16px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(0,242,254,0.1), rgba(79,172,254,0.1))',
                        border: '1px solid rgba(0,242,254,0.3)',
                        fontSize: '12px', color: '#00f2fe', fontWeight: '600',
                        fontFamily: "'Inter', monospace", width: '100%', boxSizing: 'border-box',
                        animation: 'pulsePrompt 2s ease-in-out infinite', textAlign: 'center'
                      }}>
                        👆 Click sphere to measure!
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <style>{`
            @keyframes dash { to { stroke-dashoffset: -100; } }
            @keyframes pulsePrompt { 0%,100%{box-shadow:0 0 0 0 rgba(0,242,254,0);} 50%{box-shadow:0 0 15px 2px rgba(0,242,254,0.25);} }
            @keyframes subtitleIn { from{opacity:0;transform:translateX(-50%) translateY(16px);} to{opacity:1;transform:translateX(-50%) translateY(0);} }
            @keyframes waveBar { from{transform:scaleY(0.25);} to{transform:scaleY(1);} }
            @keyframes tooltipPop { 0%{opacity:0;transform:translateY(6px);} 100%{opacity:1;transform:translateY(0);} }
            @keyframes pulseRing { 0%{box-shadow:0 0 0 0 rgba(0,242,254,0.5);} 70%{box-shadow:0 0 0 14px rgba(0,242,254,0);} 100%{box-shadow:0 0 0 0 rgba(0,242,254,0);} }
            @keyframes wordPopIn { 0%{opacity:0;transform:scale(0.55) translateY(10px);} 60%{opacity:1;transform:scale(1.07) translateY(-2px);} 100%{opacity:1;transform:scale(1) translateY(0);} }
          `}</style>
            </div>
          </Html>
        </>
      )}

      {/* Manual Interactive Controls */}
      {activeModule === 'superposition' && (
        <Html 
          fullscreen 
          zIndexRange={[300, 0]}
          calculatePosition={(el, camera, size) => [size.width / 2, size.height / 2]}
        >
          <div style={uiBoundsStyle}>
            <QuantumNavButtons
              canPrev={superpositionStep > 0}
              onPrev={() => {
                initAudio();
                setSuperpositionStep(s => Math.max(0, s - 1));
                setHasMeasured(false);
              }}
              onNext={() => {
                initAudio();
                if (superpositionStep < 3) {
                  setSuperpositionStep(s => {
                    const nextStep = s + 1;
                    if (nextStep === 1) playHadamard();
                    if (nextStep === 2) playInfinitePossibilities();
                    if (nextStep === 3) playCollapseAnticipation();
                    return nextStep;
                  });
                } else if (!hasMeasured) {
                  playMeasurement();
                  setHasMeasured(true);
                  setSuperpositionStep(4);
                } else {
                  playGroundState();
                  setSuperpositionStep(0);
                  setHasMeasured(false);
                }
              }}
              prevLabel="Prev"
              nextLabel={
                superpositionStep === 0
                  ? "Apply Hadamard Gate"
                  : superpositionStep === 1
                  ? "Enter Superposition"
                  : superpositionStep === 2
                  ? "Observe State"
                  : !hasMeasured
                  ? "🎯 Measure State"
                  : "↺ Reset State"
              }
              accentColor="#00f2fe"
              containerStyle={{
                position: 'absolute',
                bottom: '40px',
                left: '50%',
                transform: 'translateX(-50%)',
                right: 'auto',
              }}
            />
          </div>
        </Html>
      )}
    </>
  );
}
