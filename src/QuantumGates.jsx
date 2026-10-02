import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BlockMath } from 'react-katex';
import { ClassicalBit, QubitCore } from './BlochSphere';
import gsap from 'gsap';
import { Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { InlineMath } from 'react-katex';
import { QuantumNavButtons } from './QuantumNavButtons';
import { QualityComposer } from './QualityScene';

// --- DATA DEFINITION ---
const q0 = new THREE.Quaternion().identity(); 
const qPlus = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // Rotates +Y to +Z

function getQuat(startQ, axis, angle) {
  const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), angle);
  return rot.multiply(startQ);
}

// Scratch vector reused by the trail sampler to avoid per-tick allocations
const _trailVec = new THREE.Vector3();
const TRAIL_MAX_POINTS = 50;

// The trail writes into one preallocated buffer and draws only the used span;
// setFromPoints would need a larger buffer every time the trail grows.
function writeTrail(line, points) {
  const geometry = line.geometry;
  const attribute = geometry.getAttribute('position');
  for (let i = 0; i < points.length; i++) attribute.setXYZ(i, points[i].x, points[i].y, points[i].z);
  attribute.needsUpdate = true;
  geometry.setDrawRange(0, points.length);
  geometry.computeBoundingSphere();
}

// Note: ThreeJS axes: +Y is UP (Bloch Z). +Z is FRONT (Bloch X). +X is RIGHT (Bloch Y).
export const GATES_STEPS = [
  {
    id: 'pauli-x', title: 'Pauli-X (Quantum NOT)', color: '#00f2fe', gate: 'X',
    definition: <>Flips basis states <InlineMath math={String.raw`|0\rangle \leftrightarrow |1\rangle`} /> via 180° rotation around the Bloch sphere X-axis.</>,
    understanding: <>The Pauli-X gate acts mathematically as a 180° flip around the X-axis of the Bloch sphere. It swaps the probability amplitudes of the <InlineMath math={String.raw`|0\rangle`} /> and <InlineMath math={String.raw`|1\rangle`} /> states. If the qubit is purely in <InlineMath math={String.raw`|0\rangle`} />, it perfectly rotates to <InlineMath math={String.raw`|1\rangle`} />, and vice-versa.</>,
    stateMapping: [
      { in: '|0\\rangle', out: '|1\\rangle', note: 'Flips ground state 0 to excited state 1' },
      { in: '|1\\rangle', out: '|0\\rangle', note: 'Flips excited state 1 to ground state 0' },
      { in: '|+\\rangle', out: '|+\\rangle', note: 'Eigenstate of X (invariant)' },
      { in: '|-\\rangle', out: '-|-\\rangle', note: 'Eigenstate of X (phase flipped)' }
    ],
    comparison: 'This is the direct quantum analog to a classical NOT gate. Just like a NOT gate flips a 0 to a 1, the Pauli-X gate flips the primary basis states.',
    desc: '180° flip around X-axis. Direct classical equivalent.', classical: 'Classical NOT', hasClassicalEquivalent: true,
    math: 'X = \\begin{bmatrix} 0 & 1 \\\\ 1 & 0 \\end{bmatrix}', truthTable: '0 → 1\n1 → 0',
    startQuat: q0.clone(), endQuat: getQuat(q0, [0, 0, 1], Math.PI), axis: [0, 0, 1], angleText: '180°', startsAtPlus: false,
    reversibility: 'Both are reversible (NOT NOT = original).',
    camPos: [4.2, 8, 4],
    animationTooltip: "Watch the vector swing 180° perfectly upside-down! It passes right through the equator, instantly turning a 100% chance of 0 into a 100% chance of 1."
  },
  {
    id: 'pauli-y', title: 'Pauli-Y (Bit + Phase Flip)', color: '#f7971e', gate: 'Y',
    definition: <>Applies both a bit-flip and a complex phase factor <InlineMath math={String.raw`i`} /> via 180° rotation around the Y-axis.</>,
    understanding: <>The Pauli-Y gate performs a 180° rotation around the Y-axis. Mathematically, it applies a bit flip (like X) AND a complex phase flip (multiplying by <InlineMath math={String.raw`i`} />). It maps <InlineMath math={String.raw`|0\rangle`} /> to <InlineMath math={String.raw`i|1\rangle`} /> and <InlineMath math={String.raw`|1\rangle`} /> to <InlineMath math={String.raw`-i|0\rangle`} />.</>,
    stateMapping: [
      { in: '|0\\rangle', out: 'i|1\\rangle', note: 'Flips state 0 and adds +i phase' },
      { in: '|1\\rangle', out: '-i|0\\rangle', note: 'Flips state 1 and adds -i phase' },
      { in: '|i\\rangle', out: '|i\\rangle', note: 'Eigenstate of Y (invariant)' },
      { in: '|-i\\rangle', out: '-|-i\\rangle', note: 'Eigenstate of Y (phase inverted)' }
    ],
    comparison: 'Classical bits cannot hold imaginary or negative phases. Thus, there is no true classical equivalent. It roughly translates to "flip the bit, but also make its probability wave imaginary".',
    desc: '180° rotation around Y-axis. No classical analog (Y = X then Z combined).', classical: 'None (Bit+Phase Flip)', hasClassicalEquivalent: false,
    math: 'Y = \\begin{bmatrix} 0 & -i \\\\ i & 0 \\end{bmatrix}', truthTable: 'N/A',
    startQuat: q0.clone(), endQuat: getQuat(q0, [1, 0, 0], Math.PI), axis: [1, 0, 0], angleText: '180°', startsAtPlus: false,
    reversibility: 'Every quantum gate must be reversible (unitary). Classical bits cannot hold imaginary phase.',
    camPos: [4.2, 0, 11],
    animationTooltip: "Notice the 180° swing across the Y-axis? It flips the probabilities exactly like the X-gate, but it rotates through the imaginary plane, adding a complex phase!"
  },
  {
    id: 'pauli-z', title: 'Pauli-Z (Phase Flip)', color: '#a855f7', gate: 'Z',
    definition: <>Inverts the quantum phase of the <InlineMath math={String.raw`|1\rangle`} /> state without changing measurement probabilities.</>,
    understanding: <>The Pauli-Z gate acts as a 180° rotation around the Z-axis. It leaves the <InlineMath math={String.raw`|0\rangle`} /> state completely unchanged, but it flips the sign (phase) of the <InlineMath math={String.raw`|1\rangle`} /> state to <InlineMath math={String.raw`-|1\rangle`} />. It does not alter measurement probabilities, only interference behavior.</>,
    stateMapping: [
      { in: '|0\\rangle', out: '|0\\rangle', note: 'Ground state 0 is unchanged' },
      { in: '|1\\rangle', out: '-|1\\rangle', note: 'Excited state 1 is inverted by -1' },
      { in: '|+\\rangle', out: '|-\\rangle', note: 'Rotates |+⟩ on equator to |-⟩' },
      { in: '|-\\rangle', out: '|+\\rangle', note: 'Rotates |-⟩ on equator to |+⟩' }
    ],
    comparison: 'A classical bit is just a rigid 0 or 1. It has no "direction" or "phase" to flip. The Z gate is purely quantum, affecting how the qubit\'s wave function interferes with others.',
    desc: '180° rotation around Z-axis. Invisible in classical bits.', classical: 'None (Quantum Phase)', hasClassicalEquivalent: false,
    math: 'Z = \\begin{bmatrix} 1 & 0 \\\\ 0 & -1 \\end{bmatrix}', truthTable: 'N/A',
    startQuat: qPlus.clone(), endQuat: getQuat(qPlus, [0, 1, 0], Math.PI), axis: [0, 1, 0], angleText: '180°', startsAtPlus: true,
    reversibility: 'A classical bit is just 0 or 1. It has no "phase" to flip, making this uniquely quantum.',
    camPos: [4.2, 10, 5],
    animationTooltip: "The vector spins 180° around the pole! The probability of 0 or 1 doesn't change at all, but the 'phase' direction is now pointing backwards."
  },
  {
    id: 'hadamard', title: 'Hadamard (Superposition)', color: '#ec4899', gate: 'H',
    definition: <>Transforms definite basis states into balanced 50/50 quantum superpositions.</>,
    understanding: <>The Hadamard (H) gate performs a 180° rotation about a diagonal axis (X+Z). It is the most important quantum gate, as it forces a definite basis state (<InlineMath math={String.raw`|0\rangle`} /> or <InlineMath math={String.raw`|1\rangle`} />) into a perfectly balanced quantum superposition (<InlineMath math={String.raw`|0\rangle + |1\rangle`} />).</>,
    stateMapping: [
      { in: '|0\\rangle', out: '\\frac{|0\\rangle + |1\\rangle}{\\sqrt{2}}', note: 'Creates symmetric |+⟩ superposition' },
      { in: '|1\\rangle', out: '\\frac{|0\\rangle - |1\\rangle}{\\sqrt{2}}', note: 'Creates antisymmetric |-⟩ superposition' },
      { in: '|+\\rangle', out: '|0\\rangle', note: 'Interference collapses |+⟩ to |0⟩' },
      { in: '|-\\rangle', out: '|1\\rangle', note: 'Interference collapses |-⟩ to |1⟩' }
    ],
    comparison: 'A classical coin flip randomizes a bit to 0 or 1, losing all previous information. The Hadamard gate creates superposition without destroying information (applying it twice yields the original state).',
    desc: '180° rotation about the diagonal axis. Creates superposition.', classical: 'None (Superposition)', hasClassicalEquivalent: false,
    math: 'H = \\frac{1}{\\sqrt{2}}\\begin{bmatrix} 1 & 1 \\\\ 1 & -1 \\end{bmatrix}', truthTable: 'N/A',
    startQuat: q0.clone(), endQuat: getQuat(q0, [0, 1, 1], Math.PI), axis: [0, 1, 1], angleText: '180°', startsAtPlus: false,
    reversibility: 'H is its own inverse (H H = I). A classical coin flip destroys information, H does not.',
    camPos: [9.2, 5, 9],
    animationTooltip: "A massive 180° diagonal flip! It pulls the vector exactly onto the equator, leaving it perfectly balanced between 0 and 1 in a true quantum superposition."
  },
  {
    id: 's-gate', title: 'S Gate (Phase)', color: '#10b981', gate: 'S',
    definition: <>Applies a 90° (π/2) quarter-turn phase rotation around the Z-axis (square root of Z).</>,
    understanding: <>The S gate applies a 90° rotation around the Z-axis. It multiplies the <InlineMath math={String.raw`|1\rangle`} /> state by the imaginary unit <InlineMath math={String.raw`i`} />. Because it is a 90° rotation, it is mathematically the square root of the Pauli-Z gate.</>,
    stateMapping: [
      { in: '|0\\rangle', out: '|0\\rangle', note: 'Ground state 0 is unchanged' },
      { in: '|1\\rangle', out: 'i|1\\rangle', note: 'State 1 acquires +90° imaginary phase i' },
      { in: '|+\\rangle', out: '|i\\rangle', note: 'Rotates |+⟩ on equator to |i⟩' },
      { in: '|-\\rangle', out: '|-i\\rangle', note: 'Rotates |-⟩ on equator to |-i⟩' }
    ],
    comparison: 'Again, classical computing has no concept of imaginary phase or fractional state flips. This gate is used strictly in quantum mechanics to build complex interference patterns.',
    desc: '90° (quarter) turn around Z-axis.', classical: 'None', hasClassicalEquivalent: false,
    math: 'S = \\begin{bmatrix} 1 & 0 \\\\ 0 & i \\end{bmatrix}', truthTable: 'N/A',
    startQuat: qPlus.clone(), endQuat: getQuat(qPlus, [0, 1, 0], Math.PI/2), axis: [0, 1, 0], angleText: '90°', startsAtPlus: true,
    reversibility: 'S is the square root of Z. It requires two S gates to make a full Z phase flip.',
    camPos: [4.2, 8, 6],
    animationTooltip: "A quarter-turn (90°) around the equator. It doesn't change the probabilities, but it rotates the quantum phase sideways into the imaginary dimension."
  },
  {
    id: 't-gate', title: 'T Gate (π/4 Phase)', color: '#3b82f6', gate: 'T',
    definition: <>Applies a 45° (π/4) eighth-turn phase rotation around the Z-axis (square root of S).</>,
    understanding: 'The T gate applies a 45° rotation around the Z-axis. Mathematically, it is the square root of the S gate (and the fourth root of Z). It introduces a specific complex phase that is crucial for universal quantum algorithms.',
    stateMapping: [
      { in: '|0\\rangle', out: '|0\\rangle', note: 'Ground state 0 is unchanged' },
      { in: '|1\\rangle', out: 'e^{i\\pi/4}|1\\rangle', note: 'State 1 acquires a +45° phase shift (π/4)' },
      { in: '|+\\rangle', out: '\\frac{|0\\rangle + e^{i\\pi/4}|1\\rangle}{\\sqrt{2}}', note: 'Rotates relative phase by 45° on equator' },
      { in: '|-\\rangle', out: '\\frac{|0\\rangle - e^{i\\pi/4}|1\\rangle}{\\sqrt{2}}', note: 'Rotates negative superposition by 45°' }
    ],
    comparison: 'No classical analog exists. However, in quantum computing, the T gate is uniquely important because it is required to achieve universal computation, allowing quantum computers to approximate any unitary matrix.',
    desc: '45° (eighth) turn around Z-axis.', classical: 'None', hasClassicalEquivalent: false,
    math: 'T = \\begin{bmatrix} 1 & 0 \\\\ 0 & e^{i\\pi/4} \\end{bmatrix}', truthTable: 'N/A',
    startQuat: qPlus.clone(), endQuat: getQuat(qPlus, [0, 1, 0], Math.PI/4), axis: [0, 1, 0], angleText: '45°', startsAtPlus: true,
    reversibility: 'T is the square root of S. Essential for universal fault-tolerant quantum computing.',
    camPos: [4.2, 8, 6],
    animationTooltip: "A tiny 45° step around the equator! This tiny eighth-turn of phase is the secret ingredient needed to run any complex quantum algorithm."
  }
];

// --- 3D COMPONENTS ---

function ClassicalPipeStage({ stepData, applied, isLight }) {
  const { hasClassicalEquivalent, gate } = stepData;
  const pulseRef = useRef();

  useFrame((state) => {
    if (pulseRef.current && applied && hasClassicalEquivalent) {
      pulseRef.current.position.y = Math.sin(state.clock.elapsedTime * 5) * 1.0;
      pulseRef.current.material.opacity = 0.8;
    } else if (pulseRef.current) {
      pulseRef.current.material.opacity = 0;
    }
  });

  return (
    <group position={[-4.2, 0, 0]}>
      {/* The 3D Model */}
      <group position={[0, 0, 0]}>
        <ClassicalBit 
          position={[0, 0, 0]} 
          scale={1.1}
          theme={isLight ? 'light' : 'dark'}
          activeModule="gates"
          flipMode={gate === 'X' && !applied ? 'slow' : (applied && hasClassicalEquivalent ? 'force-1' : 'force-0')}
          attemptCopy={false}
          isDecohering={false}
        />
        {/* Travelling Pulse */}
        <mesh ref={pulseRef} position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.2, 32]} />
          <meshBasicMaterial color={stepData.color} transparent opacity={0} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {!hasClassicalEquivalent && applied && (
        <Html position={[0, 1.8, 0]} center zIndexRange={[100, 0]}>
          <div className="glass-tooltip" style={{
            color: '#ef4444',
            textAlign: 'center',
            width: '240px',
            boxShadow: `0 8px 30px rgba(0, 0, 0, 0.5), 0 0 15px ${stepData.color}40`,
            border: `1px solid ${stepData.color}80`,
            animation: 'popTooltip 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            fontWeight: '600'
          }}>
            There is no equivalent partial state or phase in classical bits!
          </div>
          <style>{`
            @keyframes popTooltip {
              0% { opacity: 0; transform: scale(0.5) translateY(20px); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </Html>
      )}

      {gate === 'X' && !applied && (
        <Html position={[0, 2.9, 0]} center zIndexRange={[100, 0]}>
          <div className="glass-tooltip" style={{
            textAlign: 'center',
            width: '280px',
            padding: '12px 16px',
            boxShadow: `0 8px 30px rgba(0, 0, 0, 0.5), 0 0 15px ${stepData.color}40`,
            border: `1px solid ${stepData.color}80`,
            animation: 'loopingPopTooltip 3s infinite'
          }}>
            <h4 style={{ color: stepData.color, margin: '0 0 6px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Classical NOT Gate</h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.4' }}>
              The Classical NOT gate simply flips a deterministic bit from 0 to 1, as shown here.
            </p>
            <p style={{ color: '#f093fb', fontWeight: 'bold', fontSize: '12px', margin: 0 }}>
              Click "Apply X Gate" to see the Quantum equivalent!
            </p>
          </div>
          <style>{`
            @keyframes loopingPopTooltip {
              0% { opacity: 0; transform: scale(0.5) translateY(20px); }
              10% { opacity: 1; transform: scale(1) translateY(0); }
              60% { opacity: 1; transform: scale(1) translateY(0); }
              70% { opacity: 0; transform: scale(0.8) translateY(-10px); }
              100% { opacity: 0; transform: scale(0.8) translateY(-10px); }
            }
          `}</style>
        </Html>
      )}
    </group>
  );
}

function QuantumSphereStage({ stepData, applied, isLight, setProgress, setAberrationOffset }) {
  const radius = 2.0;
  const trailRef = useRef();
  const currentQuat = useRef(new THREE.Quaternion().copy(stepData.startQuat));
  const { camera, controls } = useThree();
  
  const trailPoints = useRef([]);
  const trailBuffer = useMemo(() => new Float32Array(TRAIL_MAX_POINTS * 3), []);
  const shockwaveRef = useRef();
  const animTooltipRef = useRef();
  const tooltipFitRef = useRef();
  const tooltipFit = useRef({ frame: 0, x: 0, y: 0 });

  // The card is pinned to a point in the scene, so after the camera move it can
  // land partly off-screen. Every few frames, measure it and shift it back
  // inside the viewport (reading layout every frame would cost smoothness).
  useFrame(() => {
    const fit = tooltipFit.current;
    if (++fit.frame % 8 !== 0) return;
    const wrap = tooltipFitRef.current;
    const card = animTooltipRef.current;
    if (!wrap || !card || Number(getComputedStyle(card).opacity) < 0.01) return;
    const rect = card.getBoundingClientRect();
    const margin = 16;
    const left = rect.left - fit.x;
    const right = rect.right - fit.x;
    const top = rect.top - fit.y;
    const bottom = rect.bottom - fit.y;
    let x = 0;
    if (right > window.innerWidth - margin) x = window.innerWidth - margin - right;
    if (left + x < margin) x = margin - left;
    let y = 0;
    if (bottom > window.innerHeight - margin) y = window.innerHeight - margin - bottom;
    if (top + y < margin) y = margin - top;
    if (Math.abs(x - fit.x) > 0.5 || Math.abs(y - fit.y) > 0.5) {
      fit.x = x;
      fit.y = y;
      wrap.style.translate = `${x}px ${y}px`;
    }
  });
  const angleLabelRef = useRef();
  const animProxy = useRef({ progress: 0 });

  useEffect(() => {
    currentQuat.current.copy(stepData.startQuat);
    trailPoints.current = [];
    trailRef.current?.geometry.setDrawRange(0, 0);
    animProxy.current.progress = 0;
    
    if (!applied) {
      gsap.to(camera.position, { x: 0, y: 0, z: 13, duration: 2, ease: "power2.inOut" });
      if (controls) gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 2, ease: "power2.inOut" });
      if (trailRef.current) gsap.to(trailRef.current.material, { opacity: 0, duration: 0.5 });
      if (animTooltipRef.current) gsap.to(animTooltipRef.current, { opacity: 0, scale: 0.8, y: 20, duration: 0.3 });
    }
    
    return () => {
      gsap.killTweensOf(camera.position);
    };
  }, [stepData, camera.position, applied, controls]);

  useEffect(() => {
    let tl;
    if (applied) {
      tl = gsap.timeline({
        onUpdate: () => {
          // Mutate the quaternion in place: QubitCore's useFrame slerps the arrow
          // toward this exact object every frame, so no React state is needed here.
          const t = Math.max(0, animProxy.current.progress);
          currentQuat.current.copy(stepData.startQuat).slerp(stepData.endQuat, t);
          if (setProgress) setProgress(animProxy.current.progress);

          if (t > 0) {
            _trailVec.set(0, radius, 0).applyQuaternion(currentQuat.current);
            const pts = trailPoints.current;
            if (pts.length === 0 || _trailVec.distanceTo(pts[pts.length - 1]) > 0.05) {
              pts.push(_trailVec.clone());
              if (pts.length > TRAIL_MAX_POINTS) pts.shift();
            }
            if (trailRef.current && pts.length > 1) {
              writeTrail(trailRef.current, pts);
              // Fade in and stay visible instead of fading out
              trailRef.current.material.opacity = Math.min(t * 2, 1) * 0.8;
            }
          }
        }
      });

      animProxy.current.progress = 0;
      trailPoints.current = [];
      trailRef.current?.geometry.setDrawRange(0, 0);
      if (trailRef.current) trailRef.current.material.opacity = 1.0;

      tl.to(camera.position, {
        x: stepData.camPos[0], y: stepData.camPos[1], z: stepData.camPos[2],
        duration: 2.0, ease: "power2.inOut"
      }, 0);
      if (controls) {
        tl.to(controls.target, {
          x: 4.2, y: 0, z: 0,
          duration: 2.0, ease: "power2.inOut"
        }, 0);
      }

      // Rotation overlaps the tail of the camera move so the payoff lands quickly
      tl.to(animProxy.current, { progress: -0.05, duration: 0.15, ease: "power1.inOut" }, 1.0);
      tl.to(animProxy.current, { progress: 1.0, duration: 1.5, ease: "back.out(1.2)" }, 1.15);

      if (shockwaveRef.current) {
        shockwaveRef.current.scale.set(0.1, 0.1, 0.1);
        tl.to(shockwaveRef.current.scale, { x: 3, y: 3, z: 3, duration: 0.8, ease: "power2.out" }, 2.45);
        tl.to(shockwaveRef.current.material, { opacity: 0.8, duration: 0.1 }, 2.45);
        tl.to(shockwaveRef.current.material, { opacity: 0, duration: 0.7 }, 2.55);
      }

      if (setAberrationOffset) {
        tl.call(() => setAberrationOffset([0.008, 0.008]), null, 2.45);
        tl.call(() => setAberrationOffset([0, 0]), null, 2.55);
      }

      if (animTooltipRef.current) {
        gsap.set(animTooltipRef.current, { opacity: 0, scale: 0.8, y: 20 });
        tl.to(animTooltipRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" }, 2.9);
      }

      if (angleLabelRef.current) {
        gsap.set(angleLabelRef.current, { opacity: 0, scale: 0.5 });
        tl.to(angleLabelRef.current, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" }, 2.6);
      }

    } else {
      if (setProgress) setProgress(0);
      if (shockwaveRef.current) shockwaveRef.current.material.opacity = 0;
      if (setAberrationOffset) setAberrationOffset([0, 0]);
      if (animTooltipRef.current) gsap.set(animTooltipRef.current, { opacity: 0, scale: 0.8, y: 20 });
      if (angleLabelRef.current) gsap.set(angleLabelRef.current, { opacity: 0 });
    }

    return () => {
      gsap.killTweensOf(camera.position);
      if (tl) tl.kill();
    };
  }, [applied, stepData, camera, setProgress, controls, setAberrationOffset]);

  const ax = new THREE.Vector3(...stepData.axis).normalize();
  const axisStart = ax.clone().multiplyScalar(-radius * 1.5);
  const axisEnd = ax.clone().multiplyScalar(radius * 1.5);

  return (
    <group position={[4.2, 0, 0]}>
      <ambientLight intensity={isLight ? 0.8 : 0.5} />
      <pointLight position={[8, 8, 8]} color="#00f2fe" intensity={isLight ? 12 : 8} distance={30} />
      <pointLight position={[-8, -8, -8]} color="#f093fb" intensity={isLight ? 12 : 8} distance={30} />
      
      {/* The 3D Model from BlochSphere */}
      <QubitCore
        position={[0, 0, 0]}
        scale={1.2}
        theme={isLight ? 'light' : 'dark'}
        activeModule="gates"
        superpositionStep={-1}
        customVectorQuat={currentQuat.current}
        sphereRotation={[0, Math.atan2(4.2, 13), 0]}
      />

      {/* Labels */}
      <Html position={[0, radius + 0.35, 0]} center><div style={{ color: isLight ? '#334155' : '#cbd5e1', fontSize: '14px' }}><InlineMath math={String.raw`|0\rangle`} /></div></Html>
      <Html position={[0, -radius - 0.35, 0]} center><div style={{ color: isLight ? '#334155' : '#cbd5e1', fontSize: '14px' }}><InlineMath math={String.raw`|1\rangle`} /></div></Html>
      <Html position={[0, 0, radius + 0.35]} center><div style={{ color: isLight ? '#334155' : '#cbd5e1', fontSize: '14px' }}><InlineMath math={String.raw`|+\rangle`} /></div></Html>
      <Html position={[radius + 0.35, 0, 0]} center><div style={{ color: isLight ? '#334155' : '#cbd5e1', fontSize: '14px' }}><InlineMath math={String.raw`|i\rangle`} /></div></Html>

      {/* Rotation Axis Line */}
      <Line points={[axisStart, axisEnd]} position={[0, 0, 0]} color={stepData.color} lineWidth={2} transparent opacity={0.6} dashed dashScale={5} />

      {/* Arc Trail */}
      <line ref={trailRef} position={[0, 0, 0]}>
        <bufferGeometry drawRange={{ start: 0, count: 0 }}>
          <bufferAttribute attach="attributes-position" args={[trailBuffer, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={stepData.color} transparent opacity={0} linewidth={3} />
      </line>

      {/* Angle Label (Shows at end of animation) */}
      <Html position={[axisStart.x * 0.5, axisStart.y * 0.5 + 0.5, axisStart.z * 0.5]} center zIndexRange={[50, 0]}>
        <div ref={angleLabelRef} className="angle-pill" style={{ '--g': stepData.color, opacity: 0 }}>
          {stepData.angleText}
        </div>
      </Html>

      {/* Impact Shockwave */}
      <mesh ref={shockwaveRef} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[radius, 0.05, 16, 64]} />
        <meshBasicMaterial color={stepData.color} transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Animation Explanation Tooltip (pops up at the end) */}
      <Html position={[2.8, 1.2, 0]} center zIndexRange={[100, 0]}>
        <div ref={tooltipFitRef}>
        <div ref={animTooltipRef} className="glass-interactive" style={{
          background: 'var(--glass-bg-base)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : 'var(--glass-border-base)',
          borderRadius: '24px',
          padding: '20px 24px',
          width: '320px',
          color: isLight ? '#1e293b' : '#f8fafc',
          boxShadow: isLight
            ? `inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 20px 48px -10px rgba(0, 0, 0, 0.15)`
            : `var(--glass-highlight), var(--glass-shadow-base)`,
          pointerEvents: 'none',
          opacity: 0,
          transform: 'scale(0.8) translateY(20px)',
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px' }}>👀</span>
            <span style={{ fontWeight: '800', fontSize: '14px', letterSpacing: '0.05em', color: stepData.color, textTransform: 'uppercase' }}>What just happened?</span>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', lineHeight: '1.6', fontWeight: '500', opacity: 0.9 }}>
            {stepData.animationTooltip}
          </p>
          <div style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '14px', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6, marginBottom: '6px', textAlign: 'center', letterSpacing: '0.05em' }}>MATHEMATICAL OPERATOR</div>
            <BlockMath math={stepData.math} />
          </div>
        </div>
        </div>
      </Html>

    </group>
  );
}

export function GatesScene({ step, applied, theme, setProgress }) {
  const isLight = theme === 'light';
  const stepData = GATES_STEPS[step];
  const [aberrationOffset, setAberrationOffset] = useState([0, 0]);

  return (
    <>
      <QualityComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.4} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={aberrationOffset} />
      </QualityComposer>
      <group position={[0, -0.5, 0]}>
        <ClassicalPipeStage stepData={stepData} applied={applied} isLight={isLight} />
        
        <Html position={[0, 0, 0]} center zIndexRange={[100, 0]} style={{ opacity: applied ? 0 : 1, transition: 'opacity 0.5s' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--glass-bg-base)',
            backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
            border: isLight ? '1px solid rgba(0,0,0,0.1)' : 'var(--glass-border-base)', borderRadius: '50%',
            width: '80px', height: '80px',
            boxShadow: isLight
              ? 'inset 0 1.2px 1px rgba(255,255,255,0.9), 0 12px 32px rgba(0,0,0,0.15)'
              : 'var(--glass-highlight), var(--glass-shadow-base)',
            animation: 'pulseVS 3s infinite alternate'
          }}>
            <span style={{ fontSize: '30px', fontWeight: '900', background: 'linear-gradient(to right, #00f2fe, #f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Inter', sans-serif" }}>VS</span>
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

        <QuantumSphereStage stepData={stepData} applied={applied} isLight={isLight} setProgress={setProgress} setAberrationOffset={setAberrationOffset} />
      </group>
    </>
  );
}

// --- 2D HTML OVERLAY ---
export function GatesOverlay({ step, applied, onToggleApply, onNext, onPrev, theme, isMuted, onToggleMute, progress }) {
  const stepData = GATES_STEPS[step];

  return (
    <>
      <style>{`
        @keyframes gateFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Step Indicator */}
      <div style={{
        position: 'absolute', top: '64px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '6px', zIndex: 300, alignItems: 'center', pointerEvents: 'none',
      }}>
        {GATES_STEPS.map((s, i) => (
          <div key={i} style={{
            width: i === step ? '24px' : '7px', height: '7px', borderRadius: '4px',
            background: i === step ? stepData.color : (i < step ? `${stepData.color}70` : 'rgba(255,255,255,0.18)'),
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: i === step ? `0 0 12px ${stepData.color}` : 'none',
          }} />
        ))}
      </div>

      {/* Center Explanation Card is rendered via Html in GatesScene */}

      {/* Bottom Center: Apply Gate Button */}
      <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 300, pointerEvents: 'auto' }}>
        <button
          className="action-btn glass-btn glass-interactive"
          onClick={onToggleApply}
          style={{
            height: '52px',
            padding: '0 34px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            fontSize: '15px',
            fontWeight: '700',
            letterSpacing: '0.2px',
            cursor: 'pointer',
            backdropFilter: 'blur(40px) saturate(210%) brightness(110%)',
            WebkitBackdropFilter: 'blur(40px) saturate(210%) brightness(110%)',
            boxShadow: 'inset 0 1.2px 1.5px rgba(255,255,255,0.45), inset 0 -1px 1px rgba(255,255,255,0.08), 0 20px 48px -10px rgba(0,0,0,0.65), 0 0 24px rgba(56,189,248,0.25)',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Inter', sans-serif",
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          {applied ? '↺ Reset State' : `Apply ${stepData.gate} Gate`}
        </button>
      </div>

      {/* Bottom Right: Dynamic Navigation */}
      <QuantumNavButtons
        canPrev={step > 0}
        canNext={true}
        onPrev={onPrev}
        onNext={onNext}
        prevLabel="Prev"
        nextLabel={step < GATES_STEPS.length - 1 ? "Next Gate" : "Complete"}
        isLast={step === GATES_STEPS.length - 1}
        accentColor={stepData.color || "#00f2fe"}
        containerStyle={{
          position: 'absolute',
          bottom: '40px',
          right: '40px',
          zIndex: 300,
        }}
      />
    </>
  );
}
