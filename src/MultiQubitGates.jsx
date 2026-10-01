import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Line, Html, InstancedMesh, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { BlockMath, InlineMath } from 'react-katex';
import { QubitCore, ClassicalBit } from './BlochSphere';
import gsap from 'gsap';
import { getInitialState, GATES_MATRICES, applyMatrix, calculateProbabilities } from './quantumMath';
import { QuantumNavButtons } from './QuantumNavButtons';

// --- DATA DEFINITION ---
export const MULTI_GATES_STEPS = [
  {
    id: 'cnot', title: 'CNOT (Controlled-NOT)', color: '#00f2fe', gate: 'CNOT', name: 'CNOT (CX)', numQubits: 2,
    definition: <>Flips a target qubit if and only if the control qubit is in the <InlineMath math={String.raw`|1\rangle`} /> state.</>,
    understanding: <>The CNOT (Controlled-NOT) gate is the fundamental building block for quantum entanglement. It establishes a conditional relationship between two qubits. If the first qubit (Control) is <InlineMath math={String.raw`|0\rangle`} />, the second qubit (Target) is left alone. If the Control is <InlineMath math={String.raw`|1\rangle`} />, an X gate (NOT) is applied to the Target.</>,
    stateMapping: [
      { in: '|00\\rangle', out: '|00\\rangle', note: 'Control is 0, Target unchanged' },
      { in: '|01\\rangle', out: '|01\\rangle', note: 'Control is 0, Target unchanged' },
      { in: '|10\\rangle', out: '|11\\rangle', note: 'Control is 1, Target flipped' },
      { in: '|11\\rangle', out: '|10\\rangle', note: 'Control is 1, Target flipped' }
    ],
    comparison: 'Analogous to a classical XOR gate or a reversible conditional-flip circuit.',
    desc: <>Flips target if control is <InlineMath math={String.raw`|1\rangle`} />.</>, classical: 'Reversible XOR', hasClassicalEquivalent: true,
    math: 'CNOT = \\begin{bmatrix} 1 & 0 & 0 & 0 \\\\ 0 & 1 & 0 & 0 \\\\ 0 & 0 & 0 & 1 \\\\ 0 & 0 & 1 & 0 \\end{bmatrix}', truthTable: '00 → 00\n01 → 01\n10 → 11\n11 → 10',
    reversibility: 'CNOT is its own inverse (CNOT CNOT = I).',
    camPos: [0, 2, 10]
  },
  {
    id: 'swap', title: 'SWAP Gate', color: '#f7971e', gate: 'SWAP', name: 'SWAP', numQubits: 2,
    definition: 'Exchanges the quantum states of two distinct qubits.',
    understanding: 'The SWAP gate perfectly swaps the states of two qubits. In physical quantum computers where qubits can only interact with their immediate neighbors, SWAP gates are essential for moving quantum information across the chip to allow distant qubits to interact.',
    stateMapping: [
      { in: '|00\\rangle', out: '|00\\rangle', note: 'States are identical' },
      { in: '|01\\rangle', out: '|10\\rangle', note: '0 and 1 are swapped' },
      { in: '|10\\rangle', out: '|01\\rangle', note: '1 and 0 are swapped' },
      { in: '|11\\rangle', out: '|11\\rangle', note: 'States are identical' }
    ],
    comparison: 'Analogous to a classical bit-exchange circuit.',
    desc: 'Exchanges the states of two qubits.', classical: 'Reversible Bit-Exchange', hasClassicalEquivalent: true,
    math: 'SWAP = \\begin{bmatrix} 1 & 0 & 0 & 0 \\\\ 0 & 0 & 1 & 0 \\\\ 0 & 1 & 0 & 0 \\\\ 0 & 0 & 0 & 1 \\end{bmatrix}', truthTable: '00 → 00\n01 → 10\n10 → 01\n11 → 11',
    reversibility: 'SWAP is its own inverse.',
    camPos: [0, 2, 10]
  },
  {
    id: 'toffoli', title: 'Toffoli (CCNOT)', color: '#ec4899', gate: 'Toffoli', name: 'Toffoli (CCX)', numQubits: 3,
    definition: <>Flips a target qubit if and only if BOTH control qubits are <InlineMath math={String.raw`|1\rangle`} />.</>,
    understanding: <>The Toffoli gate (Controlled-Controlled-NOT) requires two controls. It only applies the NOT operation to the target if Control 1 AND Control 2 are strictly <InlineMath math={String.raw`|1\rangle`} />. Any quantum circuit can be constructed using only Toffoli and Hadamard gates, making it a universal gate.</>,
    stateMapping: [
      { in: '|011\\rangle', out: '|011\\rangle', note: 'Control 1 is 0, Target unchanged' },
      { in: '|101\\rangle', out: '|101\\rangle', note: 'Control 2 is 0, Target unchanged' },
      { in: '|110\\rangle', out: '|111\\rangle', note: 'Both controls are 1, Target flipped' },
      { in: '|111\\rangle', out: '|110\\rangle', note: 'Both controls are 1, Target flipped' }
    ],
    comparison: 'Historically the first universal reversible classical gate. It acts as a reversible AND gate.',
    desc: <>Flips target if both controls are <InlineMath math={String.raw`|1\rangle`} />.</>, classical: 'Reversible Toffoli (CCNOT)', hasClassicalEquivalent: true,
    math: 'CCNOT = \\text{diag}(I_6, X)', truthTable: '011 → 011\n110 → 111\n111 → 110',
    reversibility: 'Toffoli is its own inverse.',
    camPos: [0, 4, 12]
  },
  {
    id: 'cz', title: 'CZ (Controlled-Z)', color: '#a855f7', gate: 'CZ', name: 'Controlled-Z (CZ)', numQubits: 2,
    definition: <>Applies a phase flip (-1) to the target qubit if both qubits are <InlineMath math={String.raw`|1\rangle`} />.</>,
    understanding: <>Unlike CNOT which flips the amplitude (0 to 1), CZ flips the phase of the quantum state. It rotates the target qubit 180° around the Z-axis, but only if the control is <InlineMath math={String.raw`|1\rangle`} />. Interestingly, CZ is symmetric: it does not matter which qubit is the control and which is the target!</>,
    stateMapping: [
      { in: '|00\\rangle', out: '|00\\rangle', note: 'No phase flip' },
      { in: '|01\\rangle', out: '|01\\rangle', note: 'No phase flip' },
      { in: '|10\\rangle', out: '|10\\rangle', note: 'No phase flip' },
      { in: '|11\\rangle', out: '-|11\\rangle', note: 'Both are 1, state gets inverted (phase -1)' }
    ],
    comparison: 'There is no classical equivalent because classical bits cannot hold imaginary or negative phases.',
    desc: <>Applies phase flip if both are <InlineMath math={String.raw`|1\rangle`} />. No classical equivalent.</>, classical: 'None', hasClassicalEquivalent: false,
    math: 'CZ = \\text{diag}(1, 1, 1, -1)', truthTable: 'N/A',
    reversibility: 'CZ is its own inverse.',
    camPos: [0, 2, 10]
  },
  {
    id: 'bell', title: 'H + CNOT (Bell State)', color: '#10b981', gate: 'BELL', name: 'Bell State', numQubits: 2,
    definition: 'A circuit combination that produces maximum entanglement between two qubits.',
    understanding: 'This is not a single gate, but the most famous 2-qubit circuit. First, a Hadamard (H) gate puts the control qubit into a 50/50 superposition. Then, the CNOT gate entangles the target qubit with the control. The result is a Bell State, where measuring one qubit instantaneously determines the state of the other.',
    stateMapping: [
      { in: '|00\\rangle', out: '\\frac{|00\\rangle + |11\\rangle}{\\sqrt{2}}', note: 'Creates the Φ⁺ Bell state' },
      { in: '|01\\rangle', out: '\\frac{|01\\rangle + |10\\rangle}{\\sqrt{2}}', note: 'Creates the Ψ⁺ Bell state' },
      { in: '|10\\rangle', out: '\\frac{|00\\rangle - |11\\rangle}{\\sqrt{2}}', note: 'Creates the Φ⁻ Bell state' },
      { in: '|11\\rangle', out: '\\frac{|01\\rangle - |10\\rangle}{\\sqrt{2}}', note: 'Creates the Ψ⁻ Bell state' }
    ],
    comparison: 'This is purely quantum. The qubits become perfectly correlated and can no longer be described individually.',
    desc: 'Creates quantum entanglement.', classical: 'None (Entanglement)', hasClassicalEquivalent: false,
    math: '|\\Phi^+\\rangle = \\frac{1}{\\sqrt{2}}(|00\\rangle + |11\\rangle)', truthTable: 'N/A',
    reversibility: 'Requires applying CNOT then H to reverse.',
    camPos: [0, 2, 10]
  }
];

// --- HELPERS ---
const q0 = new THREE.Quaternion().identity();
const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
const qPlus = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const qMinus = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

const BASIS_QUATS = { '0': q0, '1': q1, '+': qPlus, '-': qMinus };

function gateNumQubits(gateId) {
  return gateId === 'toffoli' ? 3 : 2;
}

function getFinalState(gateId, inputs) {
  const activeInputs = inputs.slice(0, gateNumQubits(gateId));
  const initialState = getInitialState(activeInputs);
  const matrix = GATES_MATRICES[gateId];
  return matrix ? applyMatrix(matrix, initialState) : initialState;
}

// A pure state is entangled iff it is not a full tensor product of single-qubit
// states, i.e. some qubit-vs-rest bipartition of the amplitude vector, reshaped
// into a 2 x 2^(n-1) matrix, has rank > 1 (some 2x2 minor is nonzero).
export function isResultEntangled(gateId, inputs) {
  const n = gateNumQubits(gateId);
  const state = getFinalState(gateId, inputs);
  const eps = 1e-9;
  for (let k = 0; k < n; k++) {
    const shift = n - 1 - k; // qubit 0 is the most significant bit
    const rows = [[], []];
    for (let i = 0; i < state.length; i++) {
      rows[(i >> shift) & 1].push(state[i]);
    }
    const [u, v] = rows;
    for (let a = 0; a < u.length; a++) {
      for (let b = a + 1; b < u.length; b++) {
        const mr = (u[a].r * v[b].r - u[a].i * v[b].i) - (u[b].r * v[a].r - u[b].i * v[a].i);
        const mi = (u[a].r * v[b].i + u[a].i * v[b].r) - (u[b].r * v[a].i + u[b].i * v[a].r);
        if (mr * mr + mi * mi > eps) return true;
      }
    }
  }
  return false;
}

function flipBasis(b) {
  if (b === '0') return '1';
  if (b === '1') return '0';
  return b; // |+> and |-> are eigenstates of X
}

function calculateGateLogic(gateId, inputs) {
  const isEntangled = isResultEntangled(gateId, inputs);
  let outputs = [...inputs];

  if (!isEntangled) {
    if (gateId === 'cnot') {
      if (inputs[0] === '1') outputs[1] = flipBasis(inputs[1]);
    } else if (gateId === 'swap') {
      outputs[0] = inputs[1]; outputs[1] = inputs[0];
    } else if (gateId === 'toffoli') {
      if (inputs[0] === '1' && inputs[1] === '1') outputs[2] = flipBasis(inputs[2]);
    } else if (gateId === 'cz') {
      // Phase kickback: CZ maps |+>|1> to |->|1> (and symmetrically)
      if (inputs[0] === '+' && inputs[1] === '1') outputs[0] = '-';
      else if (inputs[1] === '+' && inputs[0] === '1') outputs[1] = '-';
    } else if (gateId === 'bell') {
      // The H maps the control first: |0> -> |+>, |1> -> |->, |+> -> |0>
      outputs[0] = inputs[0] === '0' ? '+' : (inputs[0] === '1' ? '-' : '0');
    }
  }

  return { outputs, isEntangled };
}

// Formats the final state as a ket sum, e.g. \frac{|00\rangle + |11\rangle}{\sqrt{2}}.
// All reachable amplitudes are real with equal magnitudes (inputs are 0/1/+ and the
// gate matrices are real), so signs and the denominator follow from the term count.
function formatStateKet(state, numQubits) {
  const terms = [];
  state.forEach((c, idx) => {
    if (c.r * c.r + c.i * c.i < 1e-6) return;
    terms.push({ label: idx.toString(2).padStart(numQubits, '0'), neg: c.r < 0 });
  });
  if (terms.length === 0) return '0';
  const numerator = terms
    .map((t, k) => `${k === 0 ? (t.neg ? '-' : '') : (t.neg ? ' - ' : ' + ')}|${t.label}\\rangle`)
    .join('');
  const denominators = { 2: '\\sqrt{2}', 4: '2', 8: '2\\sqrt{2}' };
  const d = denominators[terms.length];
  return d ? `\\frac{${numerator}}{${d}}` : numerator;
}

function getAnimationTooltip(gateId, inputs, logic) {
  const finalKet = formatStateKet(getFinalState(gateId, inputs), gateNumQubits(gateId));
  if (gateId === 'cnot') {
    if (logic.isEntangled) return { text: "Because the Control qubit is in superposition, applying CNOT entangles the qubits! They can no longer be described independently.", math: `|\\psi\\rangle = ${finalKet}` };
    if (inputs[0] === '0') return { text: <>The Control qubit is <InlineMath math={String.raw`|0\rangle`} />, so the CNOT gate leaves the Target qubit completely unchanged.</>, math: `|0${inputs[1]}\\rangle \\rightarrow |0${inputs[1]}\\rangle` };
    if (inputs[1] === '+') return { text: <>The Target qubit is <InlineMath math={String.raw`|+\rangle`} />, an eigenstate of X, so the conditional flip leaves it unchanged and the qubits stay separable.</>, math: `|${inputs[0]}+\\rangle \\rightarrow |${logic.outputs.join('')}\\rangle` };
    return { text: <>The Control qubit is <InlineMath math={String.raw`|1\rangle`} />, so the CNOT gate flips the Target qubit from <InlineMath math={`|${inputs[1]}\\rangle`} /> to <InlineMath math={`|${logic.outputs[1]}\\rangle`} />.</>, math: `|1${inputs[1]}\\rangle \\rightarrow |1${logic.outputs[1]}\\rangle` };
  } else if (gateId === 'swap') {
    return { text: <>The SWAP gate perfectly exchanges the states of Q0 (<InlineMath math={`|${inputs[0]}\\rangle`} />) and Q1 (<InlineMath math={`|${inputs[1]}\\rangle`} />). A SWAP of separate qubits never creates entanglement.</>, math: `|${inputs[0]}${inputs[1]}\\rangle \\rightarrow |${inputs[1]}${inputs[0]}\\rangle` };
  } else if (gateId === 'toffoli') {
    if (logic.isEntangled) return { text: "With a superposition on a Control qubit, the Toffoli gate creates an entangled multi-qubit state!", math: `|\\psi\\rangle = ${finalKet}` };
    if (inputs[0] === '1' && inputs[1] === '1') {
      if (inputs[2] === '+') return { text: <>Both Control qubits are <InlineMath math={String.raw`|1\rangle`} />, but the Target <InlineMath math={String.raw`|+\rangle`} /> is an eigenstate of X, so it passes through unchanged.</>, math: `|11+\\rangle \\rightarrow |11+\\rangle` };
      return { text: <>Both Control qubits are <InlineMath math={String.raw`|1\rangle`} />, so the Toffoli gate flips the Target qubit to <InlineMath math={`|${logic.outputs[2]}\\rangle`} />!</>, math: `|11${inputs[2]}\\rangle \\rightarrow |11${logic.outputs[2]}\\rangle` };
    }
    if (inputs[0] === '0' || inputs[1] === '0') return { text: <>At least one Control qubit is <InlineMath math={String.raw`|0\rangle`} />, so the Target qubit remains unchanged.</>, math: `|${inputs.join('')}\\rangle \\rightarrow |${inputs.join('')}\\rangle` };
    return { text: <>The Target qubit is <InlineMath math={String.raw`|+\rangle`} />, an eigenstate of X, so the Toffoli gate leaves the state unchanged.</>, math: `|${inputs.join('')}\\rangle \\rightarrow |${inputs.join('')}\\rangle` };
  } else if (gateId === 'cz') {
    if (logic.isEntangled) return { text: <>Both qubits are in superposition, so the phase flip (-1) on the <InlineMath math={String.raw`|11\rangle`} /> component creates entanglement!</>, math: `|\\psi\\rangle = ${finalKet}` };
    if (inputs[0] === '1' && inputs[1] === '1') return { text: <>Both qubits are <InlineMath math={String.raw`|1\rangle`} />, so the CZ gate applies a phase flip (-1) to the state. (Visually invisible on individual spheres).</>, math: "|11\\rangle \\rightarrow -|11\\rangle" };
    if ((inputs[0] === '+' && inputs[1] === '1') || (inputs[0] === '1' && inputs[1] === '+')) return { text: <>Phase kickback! The other qubit is <InlineMath math={String.raw`|1\rangle`} />, so the <InlineMath math={String.raw`|1\rangle`} /> component of the superposed qubit gains a -1 phase, rotating <InlineMath math={String.raw`|+\rangle`} /> to <InlineMath math={String.raw`|-\rangle`} />.</>, math: `|${inputs.join('')}\\rangle \\rightarrow |${logic.outputs.join('')}\\rangle` };
    return { text: <>The <InlineMath math={String.raw`|11\rangle`} /> component is absent, so the CZ gate does nothing.</>, math: `|${inputs.join('')}\\rangle \\rightarrow |${inputs.join('')}\\rangle` };
  } else if (gateId === 'bell') {
    if (logic.isEntangled) return { text: "A Hadamard gate creates superposition, and the CNOT gate entangles them into a Bell State!", math: `|\\psi\\rangle = ${finalKet}` };
    if (inputs[0] === '+') return { text: <>The Hadamard maps <InlineMath math={String.raw`|+\rangle`} /> back to <InlineMath math={String.raw`|0\rangle`} />, so the CNOT never fires and no entanglement is created.</>, math: `|\\psi\\rangle = |0${inputs[1]}\\rangle` };
    return { text: <>The Target qubit is <InlineMath math={String.raw`|+\rangle`} />, an eigenstate of X, so the CNOT leaves it unchanged and the qubits stay separable.</>, math: `|\\psi\\rangle = |${logic.outputs.join('')}\\rangle` };
  }
  return { text: "Gate applied. (Note: U stands for Unitary Matrix).", math: "U|\\psi\\rangle" };
}

// Cinematic VFX Components
function QuantumFlash({ progress }) {
  if (progress <= 0 || progress >= 1) return null;
  const scale = 1 + progress * 15; // Rapidly expands
  const opacity = 1 - Math.pow(progress, 2); // Fades out
  return (
    <mesh scale={[scale, scale, scale]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
      <pointLight color="#00f2fe" intensity={opacity * 5} distance={20} />
    </mesh>
  );
}

function Shockwave({ progress }) {
  if (progress <= 0 || progress >= 1) return null;
  const scale = progress * 20; // Ring expands outwards
  const opacity = 1 - progress;
  return (
    <mesh rotation={[Math.PI/2, 0, 0]} scale={[scale, scale, scale]}>
      <torusGeometry args={[1, 0.05, 16, 64]} />
      <meshBasicMaterial color="#00f2fe" transparent opacity={opacity} />
    </mesh>
  );
}

// Q-Sphere phase color mapping
function phaseToColor(phase) {
  let p = phase % (2 * Math.PI);
  if (p < 0) p += 2 * Math.PI;
  let h;
  if (p <= Math.PI / 2) h = 240 + (p / (Math.PI / 2)) * 120; // 0 to pi/2 -> 240(Blue) to 360(Red)
  else if (p <= Math.PI) h = ((p - Math.PI / 2) / (Math.PI / 2)) * 60; // pi/2 to pi -> 0(Red) to 60(Yellow)
  else if (p <= 3 * Math.PI / 2) h = 60 + ((p - Math.PI) / (Math.PI / 2)) * 60; // pi to 3pi/2 -> 60(Yellow) to 120(Green)
  else h = 120 + ((p - 3 * Math.PI / 2) / (Math.PI / 2)) * 120; // 3pi/2 to 2pi -> 120(Green) to 240(Blue)
  
  const color = new THREE.Color();
  color.setHSL(h / 360, 1.0, 0.5);
  return color;
}

const QSPHERE_RADIUS = 2.5;

export function QSphere({ visible, numQubits, gateId, inputs, progress }) {
  const meshRef = useRef();

  // Calculate final states
  const activeInputs = useMemo(() => inputs.slice(0, numQubits), [inputs, numQubits]);
  const initialState = useMemo(() => getInitialState(activeInputs), [activeInputs]);
  const finalState = useMemo(() => {
    const matrix = GATES_MATRICES[gateId];
    return matrix ? applyMatrix(matrix, initialState) : initialState;
  }, [gateId, initialState]);

  const probabilities = useMemo(() => calculateProbabilities(finalState), [finalState]);

  // Per-node layout (positions, colors, orientations) is progress-independent, so it
  // is computed once per state instead of on every animation frame
  const layout = useMemo(() => {
    const numStates = 1 << numQubits;

    // Group by Hamming weight
    const byWeight = {};
    for (let i = 0; i < numStates; i++) {
      const weight = i.toString(2).split('').filter(c => c === '1').length;
      if (!byWeight[weight]) byWeight[weight] = [];
      byWeight[weight].push(i);
    }

    const rings = Object.keys(byWeight).map((w) => {
      const weight = parseInt(w);
      const theta = (weight / numQubits) * Math.PI;
      return { key: `ring-${w}`, y: QSPHERE_RADIUS * Math.cos(theta), r: QSPHERE_RADIUS * Math.sin(theta) };
    }).filter((ring) => ring.r >= 0.01);

    const nodes = probabilities.filter((pState) => pState.prob >= 0.001).map((pState) => {
      const i = pState.index;
      const weight = i.toString(2).split('').filter(c => c === '1').length;
      const theta = (weight / numQubits) * Math.PI;

      const siblings = byWeight[weight];
      const indexInWeight = siblings.indexOf(i);
      const phi = (indexInWeight / siblings.length) * 2 * Math.PI;

      const x = QSPHERE_RADIUS * Math.sin(theta) * Math.cos(phi);
      const z = QSPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
      const y = QSPHERE_RADIUS * Math.cos(theta);

      let h;
      if (pState.phase <= Math.PI / 2) h = 240 + (pState.phase / (Math.PI / 2)) * 120;
      else if (pState.phase <= Math.PI) h = ((pState.phase - Math.PI / 2) / (Math.PI / 2)) * 60;
      else if (pState.phase <= 3 * Math.PI / 2) h = 60 + ((pState.phase - Math.PI) / (Math.PI / 2)) * 60;
      else h = 120 + ((pState.phase - 3 * Math.PI / 2) / (Math.PI / 2)) * 120;
      const color = new THREE.Color(`hsl(${Math.round(h)}, 100%, 50%)`);

      return {
        i, x, y, z, color,
        nodeScale: Math.sqrt(pState.prob) * 0.4,
        quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize())
      };
    });

    return { rings, nodes };
  }, [probabilities, numQubits]);

  useFrame(() => {
    if (meshRef.current) {
       meshRef.current.rotation.y += 0.005;
       // We don't scale the whole group anymore, we animate parts individually based on progress
    }
  });

  if (!visible) return null;

  const p = Math.max(0, progress); // progress goes from 0 to 1 during localProgress 0.5 to 1.0

  // Elastic out easing for the nodes shooting out
  const elasticOut = p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  const nodePop = Math.min(1, p * 2);

  return (
    <group ref={meshRef}>
      {/* Background wireframe sphere - pops in quickly */}
      <mesh>
        <sphereGeometry args={[QSPHERE_RADIUS, 32, 16]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.15 * Math.min(1, p * 3)} />
      </mesh>

      {/* Latitude rings - expand outwards along Y (geometry is constant, motion via position/scale) */}
      {layout.rings.map((ring) => (
        <mesh key={ring.key} position={[0, ring.y * elasticOut, 0]} rotation={[Math.PI/2, 0, 0]} scale={[p, p, p]}>
           <torusGeometry args={[ring.r, 0.01, 8, 32]} />
           <meshBasicMaterial color="#ffffff" transparent opacity={0.2 * nodePop} />
        </mesh>
      ))}

      {/* State nodes - shoot out from center */}
      {layout.nodes.map((node) => (
        <group key={node.i} position={[node.x * elasticOut, node.y * elasticOut, node.z * elasticOut]}>
          <mesh scale={[Math.max(0.001, nodePop), Math.max(0.001, nodePop), Math.max(0.001, nodePop)]}>
            <sphereGeometry args={[node.nodeScale, 32, 32]} />
            <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.5} roughness={0.2} />
            <pointLight color={node.color} intensity={0.5 * nodePop} distance={2} />
          </mesh>

          <mesh
            position={[-node.x*elasticOut/2, -node.y*elasticOut/2, -node.z*elasticOut/2]}
            quaternion={node.quaternion}
            scale={[1, Math.max(0.001, QSPHERE_RADIUS * elasticOut), 1]}
          >
            <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.4 * nodePop} />
          </mesh>

          <Html center position={[0, node.nodeScale + 0.2, 0]} style={{ opacity: Math.min(1, p * 3) }}>
            <div style={{ color: '#fff', fontSize: '15px', textShadow: '0 0 5px #000, 0 0 10px #000' }}>
              <InlineMath math={`|${node.i.toString(2).padStart(numQubits, '0')}\\rangle`} />
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

const _BEAM_UP = new THREE.Vector3(0, 1, 0);

function ControlBeam({ start, end, progress, isActive, isSuccess }) {
  // start/end are constant per gate step, so the orientation math is computed once
  const beam = useMemo(() => {
    const distance = start.distanceTo(end);
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    // Three.js lookAt points the -Z axis towards the target, cylinder is along Y
    const orientation = new THREE.Matrix4().lookAt(start, end, _BEAM_UP);
    orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(orientation);
    return { distance, midPoint, quaternion };
  }, [start, end]);

  if (progress <= 0 || !isActive) return null;
  // Animate pulse from start to end (progress 0 -> 0.5)
  const p = Math.min(progress * 2, 1);

  const color = isSuccess ? '#eab308' : '#ef4444';

  return (
    <group>
      <mesh position={beam.midPoint} quaternion={beam.quaternion}>
        <cylinderGeometry args={[0.02, 0.02, beam.distance, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </mesh>

      {p < 1 && (
        <mesh position={[
          THREE.MathUtils.lerp(start.x, end.x, p),
          THREE.MathUtils.lerp(start.y, end.y, p),
          THREE.MathUtils.lerp(start.z, end.z, p)
        ]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color={color} />
          <pointLight color={color} intensity={0.5} distance={2} />
        </mesh>
      )}
    </group>
  );
}

// --- MAIN 3D SCENE ---
export function MultiGatesScene({ step, applied, theme, setProgress, inputs }) {
  const stepData = MULTI_GATES_STEPS[step] || MULTI_GATES_STEPS[0];
  const isLight = theme === 'light';
  const { camera, controls } = useThree();
  
  const logic = useMemo(() => calculateGateLogic(stepData.id, inputs), [stepData.id, inputs]);
  const tooltipContent = useMemo(() => getAnimationTooltip(stepData.id, inputs, logic), [stepData.id, inputs, logic]);
  
  const proxy = useRef({ progress: 0 });
  const [localProgress, setLocalProgress] = useState(0);
  const animTooltipRef = useRef();
  // Stable per-qubit target quaternions: QubitCore's useFrame slerps toward these
  // exact objects every frame, so updating them in place moves the arrows without
  // depending on a React re-render.
  const qubitQuats = useRef([new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]);

  useEffect(() => {
    // Define Cinematic Angles with a -0.4 x-offset to pan left slightly, aligning perfectly with the Apply button
    // Also use an offsetY to pan down, pushing the scene UP away from the bottom UI panels
    const offsetX = -0.4;
    const offsetY = -1.0; 
    const defaultCam = { x: stepData.camPos[0] + offsetX, y: stepData.camPos[1], z: stepData.camPos[2] + 5 };
    const defaultTarget = stepData.numQubits === 2 ? { x: offsetX, y: 1.2 + offsetY, z: 0 } : { x: offsetX, y: 1.5 + offsetY, z: 0 };

    // Set initial position if not applied and just mounting
    if (!applied) {
      gsap.to(camera.position, { ...defaultCam, duration: 1.5, ease: "power2.out" });
      if (controls) gsap.to(controls.target, { ...defaultTarget, duration: 1.5, ease: "power2.out" });
    }

    let tl;
    if (applied) {
      tl = gsap.timeline({
        onUpdate: () => {
          const p = proxy.current.progress;
          if (!logic.isEntangled && p > 0.5) {
            for (let i = 0; i < stepData.numQubits; i++) {
              qubitQuats.current[i].copy(BASIS_QUATS[logic.outputs[i]] || q0);
            }
          }
          setLocalProgress(p);
          if (setProgress) setProgress(p);
        }
      });
      
      proxy.current.progress = 0;
      // Increased duration to 3.0s and softened ease for smoother, less glitchy feel
      tl.to(proxy.current, { progress: 1.0, duration: 3.0, ease: "power1.inOut" });

      // Cinematic Camera Motion
      if (logic.isEntangled) {
        // Entangled: Dramatic orbit left and swoop down, then pull back to reveal the massive Q-Sphere
        const entCam = stepData.numQubits === 2 ? { x: offsetX, y: 2, z: 18 } : { x: offsetX, y: 2.5, z: 20 };
        const entTarget = { x: offsetX, y: offsetY, z: 0 };
        
        tl.to(camera.position, { x: offsetX - 5, y: -1, z: 12, duration: 1.5, ease: "power1.inOut" }, 0);
        tl.to(camera.position, { ...entCam, duration: 1.5, ease: "power2.out" }, 1.5);
        
        if (controls) tl.to(controls.target, { ...entTarget, duration: 3.0, ease: "power2.inOut" }, 0);
      } else {
        // Separable: Aggressive swoop right and high, then dive down to focus on the gate action
        const sepCam = stepData.numQubits === 2 ? { x: offsetX + 1.5, y: 1.5, z: 12 } : { x: offsetX, y: 2, z: 15 };
        const sepTarget = stepData.numQubits === 2 ? { x: offsetX + 0.5, y: 1.2 + offsetY, z: 0 } : { x: offsetX, y: 1.5 + offsetY, z: 0 };
        
        tl.to(camera.position, { x: offsetX + 4, y: 4, z: 10, duration: 1.5, ease: "power1.inOut" }, 0);
        tl.to(camera.position, { ...sepCam, duration: 1.5, ease: "power2.out" }, 1.5);
        
        if (controls) tl.to(controls.target, { ...sepTarget, duration: 3.0, ease: "power2.inOut" }, 0);
      }
      
      if (animTooltipRef.current) {
        tl.to(animTooltipRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" }, 2.5);
      }
      
    } else {
      proxy.current.progress = 0;
      setLocalProgress(0);
      if (setProgress) setProgress(0);
      if (animTooltipRef.current) gsap.to(animTooltipRef.current, { opacity: 0, scale: 0.8, y: 20, duration: 0.3 });
    }

    return () => {
      if (tl) tl.kill();
      gsap.killTweensOf(camera.position);
    };
  }, [applied, setProgress, stepData, logic, camera, controls]);

  // Layout positions (shifted slightly up for better framing)
  const positions = useMemo(() => (
    stepData.numQubits === 2
      ? [[-2, 1.2, 0], [2, 1.2, 0]]
      : [[-2, 3.2, 0], [2, 3.2, 0], [0, -0.3, 0]] // Toffoli triangle
  ), [stepData.numQubits]);

  const beamStarts = useMemo(() => positions.map((pos) => new THREE.Vector3(...pos)), [positions]);

  const isEntanglingMorph = applied && logic.isEntangled && localProgress > 0.5;

  const targetIndex = positions.length - 1;
  const targetPos = beamStarts[targetIndex];

  return (
    <>
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.4} />
      </EffectComposer>
      <group position={[0, -0.5, 0]}>
        <ambientLight intensity={isLight ? 0.8 : 0.5} />
        <pointLight position={[8, 8, 8]} color="#00f2fe" intensity={isLight ? 12 : 8} distance={30} />
        <pointLight position={[-8, -8, -8]} color="#f093fb" intensity={isLight ? 12 : 8} distance={30} />


      {positions.map((pos, i) => {
        let currentPos = [...pos];
        let currentScale = 1.0;
        let opacity = 1.0;
        let groupRotation = [0, 0, 0];
        
        if (logic.isEntangled && applied) {
          if (localProgress <= 0.35) {
             // 0.0 to 0.35: Anticipation and Spin-up
             const intensity = localProgress / 0.35;
             groupRotation = [
                (Math.random() - 0.5) * 0.2 * intensity,
                localProgress * 15, // aggressive spin
                (Math.random() - 0.5) * 0.2 * intensity
             ];
             // Slight pull back for anticipation
             currentPos = [
                pos[0] * (1 + 0.1 * intensity),
                pos[1] * (1 + 0.1 * intensity),
                pos[2] * (1 + 0.1 * intensity)
             ];
          } else if (localProgress <= 0.5) {
             // 0.35 to 0.5: Aggressive Whip to center
             const whipProgress = (localProgress - 0.35) / 0.15; // maps to 0-1
             // Exponential ease-in for extreme acceleration
             const easeWhip = Math.pow(2, 10 * (whipProgress - 1));
             currentPos = [
               pos[0] * (1.1 - 1.1 * easeWhip),
               pos[1] * (1.1 - 1.1 * easeWhip),
               pos[2] * (1.1 - 1.1 * easeWhip)
             ];
             currentScale = Math.max(0.001, 1 - easeWhip * 0.5); // shrink slightly before collision
             opacity = 1 - whipProgress; // text fades out right before collision
          } else {
             // 0.5+: Collision happened, spheres disappear
             currentScale = 0;
             opacity = 0;
          }
        } else if (!logic.isEntangled && applied && localProgress > 0.5 && logic.outputs[i] !== inputs[i]) {
          // Normal gate state change
        }

        const shownBasis = applied && !logic.isEntangled && localProgress > 0.5 ? logic.outputs[i] : inputs[i];
        qubitQuats.current[i].copy(BASIS_QUATS[shownBasis] || q0);

        return (
          <group key={i} position={currentPos} scale={[currentScale, currentScale, currentScale]} rotation={groupRotation}>
             <QubitCore
                activeModule="multi-qubit-gates"
                theme={theme}
                customVectorQuat={qubitQuats.current[i]}
                showCustomVector={true}
                customGridColor={i === targetIndex ? (isLight ? '#0284c7' : '#0284c7') : undefined}
                customRingColor={i === targetIndex ? '#38bdf8' : undefined}
                emissiveColor={i === targetIndex ? '#0ea5e9' : '#eab308'}
                sphereRotation={[0, pos[0] < 0 ? -Math.atan2(Math.abs(pos[0]), 15) : Math.atan2(pos[0], 15), 0]}
             />
             <Html position={[0, -2.6, 0]} center style={{ opacity, transition: 'opacity 0.1s' }}>
               <div style={{ 
                 color: i === targetIndex ? '#38bdf8' : '#eab308', 
                 fontWeight: 'bold', fontSize: '15px', textShadow: `0 0 10px ${i === targetIndex ? '#38bdf8' : '#eab308'}80`,
                 whiteSpace: 'nowrap', letterSpacing: '1px'
               }}>
                 {i === targetIndex ? 'Target' : (positions.length === 2 ? 'Control' : `Control ${i + 1}`)}
               </div>
             </Html>
          </group>
        );
      })}

      {/* Control Beams */}
      {!isEntanglingMorph && positions.map((pos, i) => {
        if (i === targetIndex) return null;
        if (stepData.id === 'bell' && i === 0) return null;

        const isSuccess = inputs[i] !== '0';
        return (
          <ControlBeam
            key={`beam-${i}`}
            start={beamStarts[i]}
            end={targetPos}
            progress={localProgress}
            isActive={applied}
            isSuccess={isSuccess}
          />
        );
      })}

      {/* VFX: Quantum Flash and Shockwave at Collision (localProgress 0.5) */}
      {logic.isEntangled && applied && (
        <>
          <QuantumFlash progress={Math.max(0, Math.min(1, (localProgress - 0.5) * 5))} />
          <Shockwave progress={Math.max(0, Math.min(1, (localProgress - 0.5) * 3.33))} />
        </>
      )}

      <QSphere 
        visible={isEntanglingMorph} 
        numQubits={stepData.numQubits} 
        gateId={stepData.id} 
        inputs={inputs} 
        progress={(localProgress - 0.5) * 2} 
      />

      {/* Animation Explanation Tooltip (pops up at the end) */}
      <Html 
        fullscreen 
        zIndexRange={[100, 0]} 
        style={{ pointerEvents: 'none' }}
        calculatePosition={(el, camera, size) => [size.width / 2, size.height / 2]}
      >
        <div ref={animTooltipRef} className="glass-interactive" style={{
          position: 'absolute',
          top: '60px',
          right: '80px',
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
            {tooltipContent.text}
          </p>
          <div style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '14px', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6, marginBottom: '6px', textAlign: 'center', letterSpacing: '0.05em' }}>MATHEMATICAL OPERATOR</div>
            <BlockMath math={tooltipContent.math} />
          </div>
        </div>
      </Html>

      </group>
    </>
  );
}

export function MultiGatesOverlay({ step, setStep, applied, setApplied, theme, isMuted, onToggleMute, onToggleApply, onNext, onPrev, inputs, setInputs }) {
  const stepData = MULTI_GATES_STEPS[step] || MULTI_GATES_STEPS[0];
  const isLight = theme === 'light';

  // Calculate state vector and probabilities
  const activeInputs = useMemo(() => inputs.slice(0, stepData.numQubits), [inputs, stepData.numQubits]);
  const initialState = useMemo(() => getInitialState(activeInputs), [activeInputs]);
  const finalState = useMemo(() => {
    if (!applied) return initialState;
    const matrix = GATES_MATRICES[stepData.id];
    if (!matrix) return initialState; // Fallback
    return applyMatrix(matrix, initialState);
  }, [applied, initialState, stepData.id]);

  const probabilities = useMemo(() => calculateProbabilities(finalState), [finalState]);

  const handleToggleBasis = (index) => {
    if (applied) return;
    setInputs(prev => {
      const next = [...prev];
      if (next[index] === '0') next[index] = '1';
      else if (next[index] === '1') next[index] = '+';
      else next[index] = '0';
      return next;
    });
  };

  return (
    <>
      <style>{`
        @keyframes multiGateFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Step Indicator */}
      <div style={{
        position: 'absolute', top: '64px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '6px', zIndex: 300, alignItems: 'center', pointerEvents: 'none',
      }}>
        {MULTI_GATES_STEPS.map((s, i) => (
          <div key={i} style={{
            width: i === step ? '24px' : '7px', height: '7px', borderRadius: '4px',
            background: i === step ? stepData.color : (i < step ? `${stepData.color}70` : 'rgba(255,255,255,0.18)'),
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: i === step ? `0 0 12px ${stepData.color}` : 'none',
          }} />
        ))}
      </div>

      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        {/* Input Selectors */}
        <div style={{
          position: 'absolute', left: '40px', top: '150px',
          display: 'flex', flexDirection: 'column', gap: '16px', pointerEvents: 'auto', zIndex: 300
        }}>
          {Array(stepData.numQubits).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ color: 'var(--text-secondary)', fontWeight: '700', fontSize: '13px', fontFamily: "'Inter', sans-serif" }}>Q{i}</div>
              <button
                className="glass-btn glass-interactive"
                onClick={() => handleToggleBasis(i)}
                disabled={applied}
                style={{
                  width: '54px', height: '54px', borderRadius: '999px',
                  background: 'var(--glass-bg-pill)',
                  backdropFilter: 'var(--glass-blur)',
                  WebkitBackdropFilter: 'var(--glass-blur)',
                  border: isLight ? `1.5px solid ${stepData.color}60` : `1.5px solid ${stepData.color}80`,
                  color: isLight ? '#0f172a' : '#ffffff',
                  boxShadow: isLight
                    ? 'inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 8px 20px rgba(0,0,0,0.08)'
                    : `var(--glass-highlight), var(--glass-shadow-base)`,
                  fontSize: '18px', cursor: applied ? 'not-allowed' : 'pointer',
                  opacity: applied ? 0.5 : 1, transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <InlineMath math={`|${inputs[i]}\\rangle`} />
              </button>
            </div>
          ))}
        </div>

        {/* Probability Bar Chart */}
        <div className="glass-interactive" style={{
           position: 'absolute', bottom: '40px', left: '40px',
           width: '340px', height: '155px',
           background: 'var(--glass-bg-base)',
           borderRadius: '24px',
           border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : 'var(--glass-border-base)',
           display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '16px',
           pointerEvents: 'auto',
           backdropFilter: 'var(--glass-blur)',
           WebkitBackdropFilter: 'var(--glass-blur)',
           boxShadow: isLight
             ? 'inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 20px 48px -10px rgba(0, 0, 0, 0.12)'
             : 'var(--glass-highlight), var(--glass-shadow-base)',
           zIndex: 300,
           fontFamily: "'Inter', sans-serif",
        }}>
           <div style={{ position: 'absolute', top: 14, left: 18, color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: '800' }}>
             Probabilities & Phase
           </div>
           
           {probabilities.map((p, i) => {
             // Create binary string label like '00', '01'
             const label = i.toString(2).padStart(stepData.numQubits, '0');
             const barColor = stepData.color;
             const isEmpty = p.prob < 0.001;

             return (
               <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: `${100 / probabilities.length}%`, height: '100%' }}>
                 <div style={{ 
                   color: isEmpty ? '#64748b' : (isLight ? '#0f172a' : '#fff'), fontSize: '11px', marginBottom: '6px',
                   opacity: isEmpty ? 0 : 1, transition: 'opacity 0.3s', fontWeight: '700'
                 }}>
                   {Math.round(p.prob * 100)}%
                 </div>
                 
                 {/* Bar Track */}
                 <div style={{
                   width: '28px', height: '75px',
                   background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                   borderRadius: '6px',
                   position: 'relative',
                   overflow: 'visible',
                   boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
                 }}>
                   {/* Filled Bar */}
                   <div style={{
                     position: 'absolute', bottom: 0, left: 0, width: '100%',
                     height: `${p.prob * 100}%`,
                     background: isEmpty ? 'transparent' : `linear-gradient(to top, ${barColor}30, ${barColor})`,
                     borderRadius: '6px',
                     transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s, box-shadow 0.3s',
                     boxShadow: isEmpty ? 'none' : `0 0 16px ${barColor}80`
                   }} />
                 </div>

                  <div style={{
                    color: isEmpty ? '#64748b' : 'var(--text-primary)',
                    fontSize: '14px', marginTop: '8px',
                    transition: 'all 0.3s',
                    opacity: isEmpty ? 0.45 : 1,
                    fontWeight: '600',
                  }}>
                    <InlineMath math={`|${label}\\rangle`} />
                  </div>
               </div>
             );
           })}
        </div>
      </div>

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
        nextLabel={step < MULTI_GATES_STEPS.length - 1 ? "Next Gate" : "Complete"}
        isLast={step === MULTI_GATES_STEPS.length - 1}
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
