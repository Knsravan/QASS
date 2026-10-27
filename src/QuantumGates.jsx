import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BlockMath, InlineMath } from './KatexMath';
import './styles/gates.css';
import { ClassicalBit, QubitCore } from './BlochSphere';
import { Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { GATE_ROTATIONS } from './quantumMath';
import { QuantumNavButtons } from './QuantumNavButtons';
import { QualityComposer } from './QualityScene';
import { MathChip } from './MathChip';
import { motionReduced } from './quality';

// --- DATA DEFINITION ---
const q0 = new THREE.Quaternion().identity(); 
const qPlus = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // Rotates +Y to +Z

function getQuat(startQ, axis, angle) {
  const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), angle);
  return rot.multiply(startQ);
}

// A step's rotation fields, from its gate's rotation (GATE_ROTATIONS in quantumMath.js).
function rotationFields(id) {
  const { axis, angle, startsAtPlus } = GATE_ROTATIONS[id];
  const start = startsAtPlus ? qPlus : q0;
  return { startQuat: start.clone(), endQuat: getQuat(start, axis, angle), axis, angle, startsAtPlus };
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
    ...rotationFields('pauli-x'), angleText: '180°', endTex: String.raw`\lvert 1\rangle`,
    reversibility: 'Both are reversible (NOT NOT = original).',
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
    ...rotationFields('pauli-y'), angleText: '180°', endTex: String.raw`i\lvert 1\rangle`,
    reversibility: 'Every quantum gate must be reversible (unitary). Classical bits cannot hold imaginary phase.',
    animationTooltip: "Notice the 180° swing around the Y-axis? It flips the probabilities exactly like the X-gate, but by a different route: the arrow passes through |+⟩, where both amplitudes are real. The complex part is the phase it leaves behind: Y|0⟩ = i|1⟩."
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
    ...rotationFields('pauli-z'), angleText: '180°', endTex: String.raw`\lvert -\rangle`,
    reversibility: 'A classical bit is just 0 or 1. It has no "phase" to flip, making this uniquely quantum.',
    animationTooltip: "The vector spins 180° around the pole! The probability of 0 or 1 doesn't change at all, but the 'phase' direction is now pointing backwards."
  },
  {
    id: 'hadamard', title: 'Hadamard (Superposition)', color: '#ec4899', gate: 'H',
    definition: <>Transforms definite basis states into balanced 50/50 quantum superpositions.</>,
    understanding: <>The Hadamard (H) gate performs a 180° rotation about a diagonal axis (X+Z). It is the most important quantum gate, as it forces a definite basis state (<InlineMath math={String.raw`|0\rangle`} /> or <InlineMath math={String.raw`|1\rangle`} />) into a perfectly balanced quantum superposition (<InlineMath math={String.raw`|0\rangle + |1\rangle`} />).</>,
    stateMapping: [
      { in: '|0\\rangle', out: '\\frac{|0\\rangle + |1\\rangle}{\\sqrt{2}}', note: 'Creates symmetric |+⟩ superposition' },
      { in: '|1\\rangle', out: '\\frac{|0\\rangle - |1\\rangle}{\\sqrt{2}}', note: 'Creates antisymmetric |-⟩ superposition' },
      { in: '|+\\rangle', out: '|0\\rangle', note: 'The |1⟩ parts cancel, leaving |0⟩' },
      { in: '|-\\rangle', out: '|1\\rangle', note: 'The |0⟩ parts cancel, leaving |1⟩' }
    ],
    comparison: 'A classical coin flip randomizes a bit to 0 or 1, losing all previous information. The Hadamard gate creates superposition without destroying information (applying it twice yields the original state).',
    desc: '180° rotation about the diagonal axis. Creates superposition.', classical: 'None (Superposition)', hasClassicalEquivalent: false,
    math: 'H = \\frac{1}{\\sqrt{2}}\\begin{bmatrix} 1 & 1 \\\\ 1 & -1 \\end{bmatrix}', truthTable: 'N/A',
    ...rotationFields('hadamard'), angleText: '180°', endTex: String.raw`\lvert +\rangle`,
    reversibility: 'H is its own inverse (H H = I). A classical coin flip destroys information, H does not.',
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
    ...rotationFields('s-gate'), angleText: '90°', endTex: String.raw`\lvert i\rangle`,
    reversibility: 'S is the square root of Z. It requires two S gates to make a full Z phase flip.',
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
    ...rotationFields('t-gate'), angleText: '45°', endTex: String.raw`\tfrac{\lvert 0\rangle + e^{i\pi/4}\lvert 1\rangle}{\sqrt2}`,
    reversibility: 'T is the square root of S. Essential for universal fault-tolerant quantum computing.',
    animationTooltip: "A tiny 45° step around the equator! This tiny eighth-turn of phase is the secret ingredient needed to run any complex quantum algorithm."
  }
];

// --- 3D COMPONENTS ---

function ClassicalPipeStage({ stepData, applied, bitFollow }) {
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
          activeModule="gates"
          flipMode={gate === 'X' && !applied ? 'slow' : (applied && hasClassicalEquivalent ? 'force-1' : 'force-0')}
          follow={hasClassicalEquivalent ? bitFollow : undefined}
          attemptCopy={false}
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
          <div data-jelly style={{ '--j': 1 }}><div className="glass-tooltip" style={{
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
          </div></div>
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

// ─── Apply Gate: the choreography ────────────────────────────────────────────
// One continuous move, in seconds at full speed (the timeline is driven frame by
// frame, with no React render per frame):
//   Focus   0 – 1.5   the camera swings round the sphere to a view of this gate's axis
//   Axis    0.45 – 1  the rotation axis draws in, then the path ahead shows, dashed
//   Rotate  1.05 –    the arrow turns about the axis, exactly (no easing toward it),
//                     drawing its arc and the swept angle; it starts while the camera
//                     is still settling, so nothing waits
//   Result            a pulse at the arrival, the end state named, the card in the overlay
// Reset plays the turn backwards, then brings the camera home.
const CAM_SECS = 1.5;
const AXIS_IN = [0.45, 1.0];
const PREVIEW_IN = [0.75, 1.15];
const ROT_START = 1.05;
const rotSecs = (angle) => (angle > Math.PI * 0.99 ? 1.7 : angle > Math.PI * 0.49 ? 1.3 : 1.0);
const RESET_TURN = 0.95;
const RESET_CAM = [0.15, 1.55];
const HOME_SECS = 2.0;
/** When the gate's rotation ends, in seconds after Apply (its sound lands then: Simulator.jsx). */
export const gateArrival = (step) => ROT_START + rotSecs(GATES_STEPS[step].angle);

// What the overlay reads (GateLiveReadout): the rotation's progress, the step it is in.
export const gateLive = { p: 0, phase: -1, done: false };

// The arrow's frame (QubitCore, BlochSphere.jsx): the pearl's distance from the centre
// and the sphere's radius, in the sphere's own units.
const TIP = 1.86;
const SURF = 2;
const OVERVIEW_CAM = new THREE.Vector3(0, 0, 13);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const SPHERE_CENTRE = new THREE.Vector3(4.2, -0.5, 0); // GatesScene's group + this stage's

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10); // eases in and out with no jerk
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

const _up = new THREE.Vector3(0, 1, 0);
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _m = new THREE.Matrix4();

// The camera from one pose to another: the target moves straight, the camera swings round
// it (its direction turns on a great circle, its distance eases), so it arcs rather than
// cutting across the scene.
function placeCamera(camera, controls, from, to, e) {
  const target = _va.copy(from.target).lerp(to.target, e);
  const oa = from.pos.clone().sub(from.target);
  const ob = to.pos.clone().sub(to.target);
  const la = oa.length(), lb = ob.length();
  _qa.setFromUnitVectors(oa.normalize(), ob.normalize());
  _qb.identity().slerp(_qa, e);
  camera.position.copy(target).add(_vb.copy(oa).applyQuaternion(_qb).multiplyScalar(la + (lb - la) * e));
  if (controls) controls.target.copy(target);
  camera.lookAt(target);
}

// A view about 57° off the gate's axis, from the front-right and a little above: the
// arrow's circle shows as a wide ellipse, so the whole turn reads in depth.
function gatePose(worldAxis) {
  const front = new THREE.Vector3(0.35, 0.5, 1).normalize();
  const side = front.clone().sub(worldAxis.clone().multiplyScalar(front.dot(worldAxis)));
  if (side.length() < 0.2) side.set(1, 0.4, 0);
  side.normalize();
  const sign = worldAxis.dot(front) >= 0 ? 1 : -1;
  const dir = worldAxis.clone().multiplyScalar(0.55 * sign).add(side.multiplyScalar(0.83)).normalize();
  const target = SPHERE_CENTRE.clone().add(new THREE.Vector3(-0.7, 0.45, 0));
  return { pos: target.clone().add(dir.multiplyScalar(12)), target };
}

let glowTexture = null;
function glow() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

// The pieces drawn for one gate, in the arrow's frame: the path ahead (dashed), the arc
// drawn so far (a tube revealed segment by segment), the swept fan, and chevrons turning
// round the axis the way the gate turns.
function buildGateFx(stepData) {
  const axis = new THREE.Vector3(...stepData.axis).normalize();
  const startV = _up.clone().applyQuaternion(stepData.startQuat);
  const color = new THREE.Color(stepData.color);
  const N = 96;
  const pts = [];
  for (let k = 0; k <= N; k++) pts.push(startV.clone().applyAxisAngle(axis, (stepData.angle * k) / N).multiplyScalar(TIP));

  const preview = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color, dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  );
  preview.computeLineDistances();

  const RADIAL = 10;
  const arc = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.035, RADIAL, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  arc.geometry.setDrawRange(0, 0);

  const centre = axis.clone().multiplyScalar(startV.dot(axis) * TIP);
  const fanPos = [];
  for (let k = 0; k < N; k++) fanPos.push(centre.x, centre.y, centre.z, pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(fanPos, 3));
  fanGeo.setDrawRange(0, 0);
  const fan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));

  const ref = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = ref.sub(axis.clone().multiplyScalar(ref.dot(axis))).normalize();
  const w = axis.clone().cross(u);
  const at = axis.clone().multiplyScalar(SURF * 1.22);
  const chev = [];
  for (let k = 0; k < 3; k++) {
    for (let s = 0; s < 14; s++) {
      for (const a of [(k * 2 * Math.PI) / 3 + (s / 14) * 1.5, (k * 2 * Math.PI) / 3 + ((s + 1) / 14) * 1.5]) {
        const p = at.clone().add(u.clone().multiplyScalar(Math.cos(a) * 0.34)).add(w.clone().multiplyScalar(Math.sin(a) * 0.34));
        chev.push(p.x, p.y, p.z);
      }
    }
  }
  const chevGeo = new THREE.BufferGeometry();
  chevGeo.setAttribute('position', new THREE.Float32BufferAttribute(chev, 3));
  const chevrons = new THREE.LineSegments(chevGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));

  const ends = startV.clone().applyAxisAngle(axis, stepData.angle);
  return {
    axis, startV, centre, preview, arc, fan, chevrons, N, perSegment: RADIAL * 6,
    // the state it lands on, named at the arrow's pearl (lifted above it in CSS), where
    // none of the sphere's fixed labels sit
    endLabel: ends.clone().multiplyScalar(TIP),
    badgeAt: axis.clone().multiplyScalar(SURF * 1.45 + 0.4),
    dispose() { for (const o of [preview, arc, fan, chevrons]) { o.geometry.dispose(); o.material.dispose(); } },
  };
}

function QuantumSphereStage({ stepData, applied, setAberrationOffset, bitFollow }) {
  const { camera, controls } = useThree();
  const currentQuat = useRef(new THREE.Quaternion().copy(stepData.startQuat));
  const vectorOut = useRef(null);  // QubitCore's arrow: its parent is the frame the effects ride in
  const fxRef = useRef();
  const axisRef = useRef();
  const ghostRef = useRef();
  const pulseRef = useRef();
  const badgeRef = useRef();
  const angleRef = useRef();
  const angleTextRef = useRef();
  const endRef = useRef();
  const axisLineRef = useRef();
  const axisAlpha = useRef(0);
  const fx = useMemo(() => buildGateFx(stepData), [stepData]);
  useEffect(() => () => fx.dispose(), [fx]);
  const pulseMat = useMemo(() => new THREE.SpriteMaterial({ map: glow(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  useEffect(() => () => pulseMat.dispose(), [pulseMat]);

  // The run: 'home' (camera to the overview), 'apply', 'held' (applied, at rest),
  // 'reset' (the turn backwards, then home), 'idle'.
  const run = useRef({ mode: 'idle', t: 0, from: null, to: null, p: 0, fromP: 0 });
  const startRun = (mode) => {
    const r = run.current;
    r.mode = mode;
    r.t = 0;
    r.fromP = r.p;
    r.from = { pos: camera.position.clone(), target: (controls?.target || OVERVIEW_TARGET).clone() };
    if (mode === 'apply') {
      // the gate's axis as it stands in the world now (the sphere's frame turns slowly)
      const frame = vectorOut.current?.parent;
      const worldAxis = fx.axis.clone();
      if (frame) worldAxis.applyQuaternion(frame.getWorldQuaternion(_qa)).normalize();
      r.to = gatePose(worldAxis);
    } else {
      r.to = { pos: OVERVIEW_CAM.clone(), target: OVERVIEW_TARGET.clone() };
    }
  };

  // A new gate: start from its state, camera home. (Layout effects: a frame can be drawn
  // before passive effects run, and it would find no run to follow.)
  useLayoutEffect(() => {
    run.current.p = 0;
    currentQuat.current.copy(stepData.startQuat);
    if (!applied) startRun('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepData]);

  useLayoutEffect(() => {
    const mode = run.current.mode;
    if (applied) startRun('apply');
    else if (mode === 'apply' || mode === 'held') startRun('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  useEffect(() => () => { gateLive.p = 0; gateLive.phase = -1; gateLive.done = false; if (setAberrationOffset) setAberrationOffset([0, 0]); }, [setAberrationOffset]);

  const setOpacity = (el, o) => {
    if (!el) return;
    const v = o < 0.005 ? '0' : o.toFixed(3);
    if (el.style.opacity !== v) el.style.opacity = v;
  };

  useFrame((state, delta) => {
    const r = run.current;
    const dt = Math.min(delta, 0.05);
    const reduced = motionReduced();
    r.t += dt;
    const t = r.t;
    const rotEnd = ROT_START + rotSecs(stepData.angle);

    // the effects ride in the arrow's own frame (turned and slowly spinning with the sphere)
    const frame = vectorOut.current?.parent;
    const fxg = fxRef.current;
    if (frame && fxg?.parent) {
      frame.updateWorldMatrix(true, false);
      fxg.matrix.copy(_m.copy(fxg.parent.matrixWorld).invert().multiply(frame.matrixWorld));
      fxg.matrixWorldNeedsUpdate = true;
    }

    let ax = 0, pv = 0, arrive = 0, endShown = 0, phase = -1, done = false;
    if (r.mode !== 'idle' && (!r.from || !r.to)) r.mode = 'idle';
    if (r.mode === 'home') {
      placeCamera(camera, controls, r.from, r.to, reduced ? 1 : smoother(span(t, 0, HOME_SECS)));
      if (t >= HOME_SECS) r.mode = 'idle';
    } else if (r.mode === 'apply' || r.mode === 'held') {
      if (r.mode === 'apply') placeCamera(camera, controls, r.from, r.to, reduced ? 1 : smoother(span(t, 0, CAM_SECS)));
      ax = smoother(span(t, ...AXIS_IN));
      pv = smoother(span(t, ...PREVIEW_IN)) * (1 - 0.6 * span(t, rotEnd, rotEnd + 0.6));
      r.p = smoother(span(t, ROT_START, rotEnd));
      arrive = span(t, rotEnd - 0.05, rotEnd + 0.75);
      endShown = t > rotEnd - 0.05 ? 1 : 0;
      phase = t < AXIS_IN[0] ? 0 : t < ROT_START ? 1 : t < rotEnd ? 2 : 3;
      done = t > rotEnd + 0.2;
      if (setAberrationOffset && r.flash !== (t > rotEnd - 0.02 && t < rotEnd + 0.1)) {
        r.flash = !r.flash;
        setAberrationOffset(r.flash ? [0.006, 0.006] : [0, 0]);
      }
      if (r.mode === 'apply' && t > Math.max(CAM_SECS, rotEnd + 0.8)) r.mode = 'held';
    } else if (r.mode === 'reset') {
      r.p = r.fromP * (1 - smoother(span(t, 0, RESET_TURN)));
      placeCamera(camera, controls, r.from, r.to, reduced ? 1 : smoother(span(t, ...RESET_CAM)));
      ax = 1 - smoother(span(t, 0.3, 1.1));
      pv = 0.4 * ax;
      if (t >= RESET_CAM[1]) r.mode = 'idle';
    }

    currentQuat.current.setFromAxisAngle(fx.axis, stepData.angle * r.p).multiply(stepData.startQuat);
    if (bitFollow) {
      bitFollow.active = stepData.hasClassicalEquivalent && r.mode !== 'idle' && r.mode !== 'home';
      bitFollow.value = r.p;
    }
    gateLive.p = r.p;
    gateLive.phase = phase;
    gateLive.done = done;

    // the axis grows out of the centre
    if (axisRef.current) {
      axisRef.current.scale.set(1, Math.max(0.001, ax), 1);
      axisRef.current.visible = ax > 0.002;
      axisRef.current.children.forEach((m, i) => { m.material.opacity = (i === 1 ? 0.2 : 0.9) * ax; });
    }
    fx.preview.material.opacity = 0.6 * pv;
    fx.chevrons.material.opacity = 0.9 * pv;
    fx.chevrons.quaternion.setFromAxisAngle(fx.axis, state.clock.elapsedTime * 1.4);
    // the arc and the fan, as far as the arrow has come
    const k = Math.floor(r.p * fx.N + 1e-6);
    fx.arc.geometry.setDrawRange(0, k * fx.perSegment);
    fx.fan.geometry.setDrawRange(0, k * 3);
    if (ghostRef.current) ghostRef.current.visible = r.mode !== 'idle' && r.mode !== 'home' && (r.p > 0.01 || r.mode === 'apply');
    // the arrival pulse at the tip
    if (pulseRef.current) {
      _va.copy(_up).applyQuaternion(currentQuat.current).multiplyScalar(TIP);
      pulseRef.current.position.copy(_va);
      pulseMat.opacity = arrive > 0 && arrive < 1 ? 0.9 * (1 - arrive) : 0;
      pulseRef.current.scale.setScalar(0.25 + 2.2 * outExpo(arrive));
    }
    // labels: the gate's badge on its axis, the swept angle, the state it lands on
    setOpacity(badgeRef.current, ax > 0.3 ? ax : 0);
    if (angleRef.current) {
      const half = fx.startV.clone().applyAxisAngle(fx.axis, (stepData.angle * r.p) / 2).multiplyScalar(TIP);
      angleRef.current.position.copy(fx.centre).lerp(half, 0.62);
    }
    setOpacity(angleTextRef.current, r.p > 0.02 && r.mode !== 'idle' ? 1 : 0);
    if (angleTextRef.current) {
      const deg = `${Math.round((stepData.angle * r.p * 180) / Math.PI)}°`;
      if (angleTextRef.current.textContent !== deg) angleTextRef.current.textContent = deg;
    }
    setOpacity(endRef.current, endShown);

    // the module's own axis line fades in on arrival from the hub, out when it hands back
    const m = axisLineRef.current?.material;
    if (m) {
      const closing = document.querySelector('.canvas-container')?.dataset.jellyState === 'out';
      axisAlpha.current += ((closing ? 0 : 0.35) - axisAlpha.current) * 0.08;
      m.opacity = axisAlpha.current;
    }
  });

  const axisStart = fx.axis.clone().multiplyScalar(-SURF * 1.45);
  const axisEnd = fx.axis.clone().multiplyScalar(SURF * 1.45);
  const axisQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(_up, fx.axis), [fx]);

  return (
    <group position={[4.2, 0, 0]}>
      <ambientLight intensity={0.5} />
      <pointLight position={[8, 8, 8]} color="#00f2fe" intensity={8} distance={30} />
      <pointLight position={[-8, -8, -8]} color="#f093fb" intensity={8} distance={30} />

      {/* The 3D Model from BlochSphere: its arrow shows currentQuat exactly */}
      <QubitCore
        position={[0, 0, 0]}
        scale={1.2}
        activeModule="gates"
        customVectorQuat={currentQuat.current}
        exactVector
        vectorOut={vectorOut}
        sphereRotation={[0, Math.atan2(4.2, 13), 0]}
      />

      {/* Everything below rides in the arrow's frame (its matrix is set each frame) */}
      <group ref={fxRef} matrixAutoUpdate={false}>
        {/* Labels (the poles' |0> and |1> chips come with the sphere) */}
        <Html position={[0, 0, SURF + 0.3]} center><MathChip className="gates-extra" tex={String.raw`\lvert +\rangle`} small /></Html>
        <Html position={[SURF + 0.3, 0, 0]} center><MathChip className="gates-extra" tex={String.raw`\lvert i\rangle`} small /></Html>

        <Line ref={axisLineRef} points={[axisStart, axisEnd]} color={stepData.color} lineWidth={2} transparent opacity={0} dashed dashScale={5} />

        {/* The rotation axis, drawn in when the gate is applied */}
        <group ref={axisRef} quaternion={axisQuat} visible={false}>
          <mesh raycast={() => null}>
            <cylinderGeometry args={[0.02, 0.02, SURF * 2.9, 12]} />
            <meshBasicMaterial color={stepData.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh raycast={() => null}>
            <cylinderGeometry args={[0.075, 0.075, SURF * 2.9, 12]} />
            <meshBasicMaterial color={stepData.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[0, SURF * 1.45 + 0.11, 0]} raycast={() => null}>
            <coneGeometry args={[0.08, 0.22, 16]} />
            <meshBasicMaterial color={stepData.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>

        <primitive object={fx.preview} />
        <primitive object={fx.fan} />
        <primitive object={fx.arc} />
        <primitive object={fx.chevrons} />

        {/* Where the arrow started, left behind faintly */}
        <group ref={ghostRef} quaternion={stepData.startQuat} visible={false}>
          <mesh position={[0, 0.86, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.03, 0.03, 1.72, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
          </mesh>
          <mesh position={[0, TIP, 0]} raycast={() => null}>
            <sphereGeometry args={[0.12, 20, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
          </mesh>
        </group>

        <sprite ref={pulseRef} material={pulseMat} raycast={() => null} />

        <Html position={fx.badgeAt} center zIndexRange={[60, 0]}>
          <div ref={badgeRef} className="gate-axis-badge" style={{ '--g': stepData.color, opacity: 0 }}>{stepData.gate}</div>
        </Html>
        <group ref={angleRef}>
          <Html center zIndexRange={[60, 0]}>
            <div ref={angleTextRef} className="angle-pill" style={{ '--g': stepData.color, opacity: 0 }}>0°</div>
          </Html>
        </group>
        <Html position={fx.endLabel} center zIndexRange={[60, 0]}>
          <div ref={endRef} className="gate-end-chip" style={{ '--g': stepData.color, opacity: 0 }}>
            <InlineMath math={stepData.endTex} />
          </div>
        </Html>
      </group>
    </group>
  );
}

export function GatesScene({ step, applied }) {
  const stepData = GATES_STEPS[step];
  const [aberrationOffset, setAberrationOffset] = useState([0, 0]);
  // The classical bit follows the gate while X turns the qubit (BlochSphere.jsx ClassicalBit `follow`).
  const bitFollow = useMemo(() => ({ active: false, value: 0 }), []);

  return (
    <>
      <QualityComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.4} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={aberrationOffset} />
      </QualityComposer>
      <group position={[0, -0.5, 0]}>
        <ClassicalPipeStage stepData={stepData} applied={applied} bitFollow={bitFollow} />
        
        <Html position={[0, 0, 0]} center zIndexRange={[100, 0]} style={{ opacity: applied ? 0 : 1, transition: 'opacity 0.5s' }}>
          <div className="gates-extra"><div className="vs-badge" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--glass-bg-base)',
            backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
            border: 'var(--glass-border-base)', borderRadius: '50%',
            width: '80px', height: '80px',
            boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
            animation: 'pulseVS 3s infinite alternate'
          }}>
            <span style={{ fontSize: '30px', fontWeight: '900', background: 'linear-gradient(to right, #00f2fe, #f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Inter', sans-serif" }}>VS</span>
          </div></div>
          <style>
            {`
              @keyframes pulseVS {
                0% { box-shadow: 0 0 15px 0 rgba(0, 242, 254, 0.4); transform: scale(1); }
                100% { box-shadow: 0 0 35px 0 rgba(240, 147, 251, 0.6); transform: scale(1.05); }
              }
            `}
          </style>
        </Html>

        <QuantumSphereStage stepData={stepData} applied={applied} setAberrationOffset={setAberrationOffset} bitFollow={bitFollow} />
      </group>
    </>
  );
}

// --- 2D HTML OVERLAY ---

const PHASES = ['Focus', 'Axis', 'Rotate', 'Result'];

// The qubit as the gate turns it, read from gateLive each frame and written straight to
// the DOM: the state, P(0) and P(1), and the relative phase (all Z, S and T change).
// Then the result card, and the strip naming the step the animation is in.
function GateLiveReadout({ stepData }) {
  const refs = useRef({});
  const set = (k) => (el) => { refs.current[k] = el; };
  useEffect(() => {
    const axis = new THREE.Vector3(...stepData.axis).normalize();
    const start = new THREE.Vector3(0, 1, 0).applyQuaternion(stepData.startQuat);
    const v = new THREE.Vector3();
    const last = {};
    const put = (k, prop, val) => {
      const el = refs.current[k];
      if (!el || last[k + prop] === val) return;
      last[k + prop] = val;
      if (prop === 'text') el.textContent = val;
      else if (prop === 'html') el.innerHTML = val;
      else el.style[prop] = val;
    };
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // Bloch (x, y, z) from the scene's axes: x toward you (three z), y right (three x), z up (three y)
      v.copy(start).applyAxisAngle(axis, stepData.angle * gateLive.p);
      const bz = Math.max(-1, Math.min(1, v.y));
      const th = Math.acos(bz);
      const pole = Math.sin(th) < 0.03;
      let phi = pole ? 0 : Math.atan2(v.x, v.z);
      if (phi < -1e-6) phi += 2 * Math.PI;
      const a = Math.cos(th / 2), b = Math.sin(th / 2);
      const deg = Math.round((phi * 180) / Math.PI) % 360;
      put('f0', 'width', `${(a * a * 100).toFixed(1)}%`);
      put('f1', 'width', `${(b * b * 100).toFixed(1)}%`);
      put('v0', 'text', `${Math.round(a * a * 100)}%`);
      put('v1', 'text', `${Math.round(b * b * 100)}%`);
      put('ket', 'html', b < 0.005 ? '<b class="gl-c0">|0⟩</b>'
        : a < 0.005 ? '<b class="gl-c1">|1⟩</b>'
        : `<b class="gl-c0">${a.toFixed(2)}</b>|0⟩ + <b class="gl-c1">${b.toFixed(2)}</b>${deg ? `·e<sup>i${deg}°</sup>` : ''}|1⟩`);
      put('phi', 'text', pole ? 'undefined at a pole' : `${deg}°`);
      put('theta', 'text', `${Math.round((th * 180) / Math.PI)}°`);
      put('needle', 'transform', `rotate(${-deg}deg)`);
      put('needle', 'opacity', pole ? '0.25' : '1');
      put('result', 'opacity', gateLive.done ? '1' : '0');
      put('result', 'transform', gateLive.done ? 'none' : 'translateY(8px)');
      put('phases', 'opacity', gateLive.phase >= 0 ? '1' : '0');
      PHASES.forEach((_, i) => {
        const el = refs.current[`ph${i}`];
        const cls = i === gateLive.phase ? 'gl-phase on' : gateLive.phase > i ? 'gl-phase done' : 'gl-phase';
        if (el && el.className !== cls) el.className = cls;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stepData]);

  return (
    <>
      <div className="gates-live" style={{ '--g': stepData.color }} data-jelly-fade>
        <section className="gl-card glass-card" aria-label="The qubit's state, live">
          <span className="gl-label">Qubit state, live</span>
          <div className="gl-ket" ref={set('ket')} />
          <div className="gl-bar"><span className="gl-c0">P(0)</span><span className="gl-track"><span className="gl-fill gl-f0" ref={set('f0')} /></span><span className="gl-v" ref={set('v0')} /></div>
          <div className="gl-bar"><span className="gl-c1">P(1)</span><span className="gl-track"><span className="gl-fill gl-f1" ref={set('f1')} /></span><span className="gl-v" ref={set('v1')} /></div>
          <div className="gl-dialrow">
            <svg width="56" height="56" viewBox="-30 -30 60 60" aria-hidden="true">
              <circle r="25" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
              <line x1="-25" y1="0" x2="25" y2="0" stroke="rgba(255,255,255,0.08)" />
              <line x1="0" y1="-25" x2="0" y2="25" stroke="rgba(255,255,255,0.08)" />
              <line ref={set('needle')} className="gl-needle" x1="0" y1="0" x2="23" y2="0" />
              <circle r="2.6" fill="var(--g)" />
            </svg>
            <div className="gl-dialtext">
              <span>relative phase φ <b ref={set('phi')} /></span>
              <span>polar angle θ <b ref={set('theta')} /></span>
            </div>
          </div>
        </section>
        <section className="gl-card gl-result glass-card" ref={set('result')} aria-live="polite" style={{ opacity: 0 }}>
          <span className="gl-label">What just happened?</span>
          <p>{stepData.animationTooltip}</p>
          <div className="gl-op"><BlockMath math={stepData.math} /></div>
        </section>
      </div>
      <div className="gl-phases" ref={set('phases')} style={{ '--g': stepData.color, opacity: 0 }} aria-hidden="true">
        {PHASES.map((name, i) => (
          <span key={name} ref={set(`ph${i}`)} className="gl-phase"><i>{i + 1}</i>{name}</span>
        ))}
      </div>
    </>
  );
}

export function GatesOverlay({ step, applied, onToggleApply, onNext, onPrev }) {
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
      }} data-jelly-fade>
        {GATES_STEPS.map((s, i) => (
          <div key={i} style={{
            width: i === step ? '24px' : '7px', height: '7px', borderRadius: '4px',
            background: i === step ? stepData.color : (i < step ? `${stepData.color}70` : 'rgba(255,255,255,0.18)'),
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: i === step ? `0 0 12px ${stepData.color}` : 'none',
          }} />
        ))}
      </div>

      <GateLiveReadout stepData={stepData} />

      {/* Bottom Center: Apply Gate Button */}
      <div data-jelly style={{ '--j': 0, '--tx': '-50%', position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 300, pointerEvents: 'auto' }}>
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
