import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, PresentationControls } from '@react-three/drei';
import { useSpring, a } from '@react-spring/three';
import * as THREE from 'three';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { BlockMath, InlineMath } from 'react-katex';
import { useQuantumAudio } from './useQuantumAudio';
import { QuantumNavButtons } from './QuantumNavButtons';

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

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    if (activeModule !== 'bit-vs-qubit') {
      if (flipMode === 'slow') setValue(Math.floor(t * 0.8) % 2);
      else if (flipMode === 'fast') setValue(Math.floor(t * 2) % 2);
      else if (flipMode === 'async') setValue(Math.floor(t * 1.8) % 2);
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
            <div style={{ fontSize: '22px', fontFamily: "'Fira Code', monospace", fontWeight: '800', color: value === 0 ? "#00f2fe" : 'var(--text-secondary)', textShadow: value === 0 ? `0 0 15px #00f2fe` : 'none', transition: 'all 0.2s' }}>0</div>
          </Html>
          <Html position={[0.9, -1.1, 0]} center>
            <div style={{ fontSize: '22px', fontFamily: "'Fira Code', monospace", fontWeight: '800', color: value === 1 ? "#f093fb" : 'var(--text-secondary)', textShadow: value === 1 ? `0 0 15px #f093fb` : 'none', transition: 'all 0.2s' }}>1</div>
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
const _ORIGIN_BS = new THREE.Vector3(0, 0, 0);
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
export const QubitCore = ({ position, scale = 1, theme, activeModule, isAncilla, isEntangled, isDecohering, attemptCopy, onDomainHover, onDomainUnhover, superpositionStep, onMeasure, onMeasuredValueChange, customVectorQuat, showCustomVector, emissiveColor, customGridColor, customRingColor, sphereRotation, visible, interferenceStep = 0, interferencePhase = 0 }) => {
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
        // Fallback state-space sweep, only visible when no customVectorQuat is driving the vector
        targetX = Math.abs(Math.sin(time * 1.5)) * Math.PI;
        targetY = Math.cos(time) * Math.PI;
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

  const vectorColor = emissiveColor ? emissiveColor : (attemptCopy ? "#ef4444" : (isDecohering ? "#94a3b8" : (isAncilla ? "#a855f7" : (isLight ? "#0d9488" : "#14b8a6"))));

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
                <div style={{ color: '#ef4444', fontFamily: "'Fira Code', monospace", fontWeight: 'bold', fontSize: '14px', textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>X</div>
              </Html>
              <Html position={[2.25, 0, 0]} center>
                <div style={{ color: axisColor, fontFamily: "'Fira Code', monospace", fontWeight: 'bold', fontSize: '14px', textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>Y</div>
              </Html>
              <Html position={[0, 2.25, 0]} center>
                <div style={{ color: '#22c55e', fontFamily: "'Fira Code', monospace", fontWeight: 'bold', fontSize: '14px', textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>Z</div>
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

// =========================================
// 3. EXPONENTIAL ORBITAL GRAPH
// =========================================
const ExponentialStateOrbit = ({ qubitCount, theme, onDomainHover, onDomainUnhover }) => {
  const groupRef = useRef(); const isLight = theme === 'light';
  useFrame((state) => { groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.08; });
  const numStates = Math.pow(2, qubitCount); const radius = 3.5 + (qubitCount * 0.4);

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]} onPointerOver={(e) => { e.stopPropagation(); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { if (onDomainUnhover) onDomainUnhover(); }}>
        <torusGeometry args={[radius, 0.015, 16, numStates > 16 ? 128 : 64]} />
        <meshBasicMaterial color={isLight ? "#0284c7" : "#00f2fe"} transparent opacity={0.2} />
      </mesh>
      {[...Array(numStates)].map((_, i) => {
        const angle = (i / numStates) * Math.PI * 2;
        const x = Math.cos(angle) * radius; const z = Math.sin(angle) * radius; const y = (i % 2 === 0) ? 0.6 : -0.6;
        const binaryString = i.toString(2).padStart(qubitCount, '0');
        return (
          <group key={`node-${i}`} position={[x, y, z]} onPointerOver={(e) => { e.stopPropagation(); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { if (onDomainUnhover) onDomainUnhover(); }}>
            <mesh><sphereGeometry args={[0.08, 16, 16]} /><meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={isLight ? 2 : 4} /></mesh>
            <mesh position={[0, -y / 2, 0]}><cylinderGeometry args={[0.01, 0.01, Math.abs(y), 8]} /><meshBasicMaterial color={isLight ? "#0284c7" : "#00f2fe"} transparent opacity={0.3} /></mesh>
            <Html position={[0, 0.25, 0]} center zIndexRange={[100, 0]}>
              <div style={{ color: isLight ? '#0369a1' : '#7dd3fc', fontFamily: "'Fira Code', monospace", fontSize: '10px', fontWeight: '600', background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(10,11,18,0.7)', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${isLight ? 'rgba(3,105,161,0.2)' : 'rgba(0,242,254,0.2)'}` }}><InlineMath math={`|${binaryString}\\rangle`} /></div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
export default function BlochSphere({ theme, activeModule, qubitCount, isDecohering, attemptCopy, isSidebarOpen, setIsSidebarOpen, interferenceStep, interferencePhase, isGlobalMuted = false }) {
  const isLight = theme === 'light';
  const tetherRef = useRef();
  const controlsRef = useRef();
  const cameraStepTime = useRef(0);
  const prevCameraStep = useRef(-1);
  const light1Ref = useRef();
  const light2Ref = useRef();
  const { size, camera } = useThree();
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

  // Reset camera when opening a module
  useEffect(() => {
    if (activeModule && controlsRef.current && camera) {
      camera.position.set(0, 0, 13);
      camera.rotation.set(0, 0, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
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

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

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
      if (light1Ref.current) light1Ref.current.intensity = THREE.MathUtils.lerp(light1Ref.current.intensity, isLight ? 12 : 8, 0.05);
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
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.6} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0, 0]} />
      </EffectComposer>
      <ambientLight intensity={isLight ? 0.8 : 0.5} />
      <pointLight ref={light1Ref} position={[8, 8, 8]} color="#00f2fe" intensity={isLight ? 12 : 8} distance={30} />
      <pointLight ref={light2Ref} position={[-8, -8, -8]} color="#f093fb" intensity={isLight ? 12 : 8} distance={30} />

      {activeModule !== 'interference' && (
        <OrbitControls
          ref={controlsRef}
          enabled={hoveredDomain === null}
          enableZoom={true}
          enablePan={false}
          minDistance={5}
          maxDistance={20}
          autoRotate={!activeModule}
          autoRotateSpeed={0.5}
        />
      )}


      <group scale={!activeModule ? 0.70 : 1} position={[0, !activeModule ? -0.8 : 0, 0]}>
        <group position={[-4.2, 0, 0]} onWheel={handleWheelLeft}>

        <mesh position={[0, 0, -2.5]} onPointerOver={(e) => { e.stopPropagation(); handleHoverDomain('left'); }} onPointerOut={() => handleUnhoverDomain('left')} visible={false}>
          <planeGeometry args={[6, 6]} />
        </mesh>

        <PresentationControls global={false} cursor={true} snap={true} speed={2.5} polar={[-Math.PI / 3, Math.PI / 3]}>
          <group scale={leftScale}>
            {activeModule === 'exponential' ? (
              <ClassicalBit position={[0, 0, 0]} scale={0.7} theme={theme} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
            ) : activeModule === 'nocloning' ? (
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
            ) : (activeModule === 'superposition' || activeModule === 'interference') ? null : (
                <ClassicalBit position={[0, 0, 0]} scale={1.1} theme={theme} activeModule={activeModule} isDecohering={isDecohering} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
              )}
          </group>
        </PresentationControls>
      </group>

      {activeModule === 'bit-vs-qubit' && (
        <Html position={[0, 0, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: isLight ? 'rgba(255,255,255,0.4)' : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.0))',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.18)', borderRadius: '50%',
            width: '80px', height: '80px', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)',
            animation: 'pulseVS 3s infinite alternate'
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

      <group position={[(activeModule === 'superposition' || activeModule === 'interference') ? 0 : 4.2, 0, 0]} onWheel={handleWheelRight}>

        <mesh position={[0, 0, -2.5]} onPointerOver={(e) => { e.stopPropagation(); handleHoverDomain('right'); }} onPointerOut={() => handleUnhoverDomain('right')} visible={false}>
          <planeGeometry args={[6, 6]} />
        </mesh>

        <PresentationControls global={false} cursor={true} snap={true} speed={1.5} polar={[-Math.PI / 3, Math.PI / 3]}>
          <group scale={rightScale}>
            {activeModule === 'exponential' ? (
              <group>
                {[...Array(qubitCount)].map((_, i) => {
                  const startX = -((qubitCount - 1) * 2.4) / 2;
                  return <QubitCore key={`q-${i}`} position={[startX + (i * 2.4), 0, 0]} scale={0.55} theme={theme} activeModule={activeModule} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />;
                })}
                <ExponentialStateOrbit qubitCount={qubitCount} theme={theme} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
              </group>
            ) : activeModule === 'superposition' ? (
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
            ) : (
              <QubitCore position={[0, 0, 0]} scale={1.2} theme={theme} activeModule={activeModule} isDecohering={isDecohering} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
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
                  <div className={`glass-tooltip glass-tooltip-corner ${hasMeasured && i === 3
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
