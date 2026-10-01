import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import BlochSphere from './BlochSphere';
import { DiracScene, DiracOverlay } from './DiracNotation';
import { GatesScene, GatesOverlay, GATES_STEPS } from './QuantumGates';
import { MultiGatesScene, MultiGatesOverlay, MULTI_GATES_STEPS, isResultEntangled } from './MultiQubitGates';
import CameraShifter from './CameraShifter';
import GlassNavBar from './GlassNavBar';
import ModuleErrorBoundary from './ModuleErrorBoundary';
import { startLiquidGlass } from './LiquidGlass';
import { mountLiquidGlass } from './liquid-glass/liquid-glass';
import { useDiracAudio } from './useDiracAudio';
import { useGatesAudio } from './useGatesAudio';
import { useIdleAudio } from './useIdleAudio';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';
import {
  QuantumModuleIcon,
  MorphAudioIcon,
  MorphSidebarTabIcon,
  MorphCircuitToggleIcon,
  MorphIcon,
  Atom,
  Variable,
  Zap,
  Compass,
  ArrowRight
} from './QuantumMorphIcons';
import './liquid-glass/liquid-glass.css';
import './App.css';

// Self-contained modules are split into their own chunks so the landing page
// and hub don't pay for every module's scene up front. The loaders are also
// used to prefetch the chunks once the hub is idle, so opening one is instant.
const MODULE_LOADERS = {
  interference: () => import('./InterferenceModule'),
  entanglement: () => import('./EntanglementModule'),
  exponential: () => import('./ExponentialModule'),
  nocloning: () => import('./NoCloning'),
  decoherence: () => import('./Decoherence'),
  errorCorrection: () => import('./QuantumErrorCorrection'),
};
const InterferenceModule = lazy(MODULE_LOADERS.interference);
const EntanglementModule = lazy(MODULE_LOADERS.entanglement);
const ExponentialModule = lazy(MODULE_LOADERS.exponential);
const NoCloningModule = lazy(MODULE_LOADERS.nocloning);
const DecoherenceModule = lazy(MODULE_LOADERS.decoherence);
const QuantumErrorCorrectionModule = lazy(MODULE_LOADERS.errorCorrection);

// Storage can be unavailable (privacy modes, blocked site data); the app must
// still load, it just won't remember that the intro was seen.
const readStorage = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* not persisted */ }
};

// Each module has its own URL (#entanglement, ...) so it can be shared,
// bookmarked and reloaded, and the browser's Back button moves between
// modules instead of leaving the site.
const isModuleId = (id) => curriculumData.some(m => m.id === id);
const moduleFromHash = () => {
  try {
    const id = decodeURIComponent(window.location.hash.slice(1));
    return isModuleId(id) ? id : null;
  } catch {
    return null; // a malformed link (e.g. a stray "%") just opens the hub
  }
};
const readModuleSetting = (key) => {
  const id = readStorage(key);
  return isModuleId(id) ? id : null;
};
const BASE_TITLE = 'QASS · Quantum Algorithm State Simulator';

// ==========================================
// 11-MODULE CURRICULUM DATA STRUCTURE
// ==========================================
const curriculumData = [
  { id: 'bit-vs-qubit', title: 'Classical Bit vs Qubit', accent: '#38bdf8', definition: 'A qubit is the fundamental unit of quantum information, capable of existing in multiple states simultaneously.', comparison: 'A classical bit is a coin sitting flat on a table (Heads or Tails). A qubit is a coin spinning in the air.', math: '|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle', misconception: 'A qubit is not "a little bit of 0 and a little bit of 1". It is a fluid geometric vector.' },
  { id: 'dirac-notation', title: 'Dirac Notation (Math)', accent: '#c084fc', definition: <>A standardized notation in quantum mechanics using "Kets" <InlineMath math={String.raw`|\psi\rangle`} /> and "Bras" <InlineMath math={String.raw`\langle\psi|`} /> to represent quantum states as vectors in a complex Hilbert space.</>, comparison: <>Just like we use (x, y) to describe a point in 2D space, we use <InlineMath math={String.raw`|\psi\rangle = \alpha|0\rangle + \beta|1\rangle`} /> to describe a quantum state in a 2D complex vector space.</>, math: '|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle, \\quad |\\alpha|^2 + |\\beta|^2 = 1', misconception: <>The Bra <InlineMath math={String.raw`\langle\psi|`} /> is not a separate state — it is simply the same Ket transposed and complex-conjugated.</> },
  { id: 'superposition', title: 'Superposition & Measurement', accent: '#ec4899', definition: 'Superposition is the ability to exist in multiple states at once, while Measurement is the irreversible collapse of that fluid state into a rigid classical 0 or 1.', comparison: 'Listening to a complex musical chord (superposition), then forcing it to instantly become a single piano note (measurement).', math: 'H|0\\rangle = \\frac{1}{\\sqrt{2}}(|0\\rangle + |1\\rangle) \\xrightarrow{M} p(0) = 0.5', misconception: 'Qubits do not rapidly switch between 0 and 1; they exist as both simultaneously until observation violently forces them to choose.' },
  { id: 'gates', title: 'Classical Gates vs Quantum Gates', accent: '#fbbf24', definition: 'Reversible mathematical matrices that rotate the state vector around the Bloch sphere.', comparison: 'Like classical AND/OR logic gates, but they can be run perfectly in reverse (uncomputed).', math: 'X\\begin{bmatrix} \\alpha \\\\ \\beta \\end{bmatrix} = \\begin{bmatrix} 0 & 1 \\\\ 1 & 0 \\end{bmatrix}\\begin{bmatrix} \\alpha \\\\ \\beta \\end{bmatrix} = \\begin{bmatrix} \\beta \\\\ \\alpha \\end{bmatrix}', misconception: 'Unlike classical gates, every quantum gate (except measurement) must be mathematically reversible.' },
  { id: 'multi-qubit-gates', title: 'Multi Qubit Gates', accent: '#818cf8', definition: 'Quantum logic operations that act on multiple qubits simultaneously, creating entanglement and complex correlations.', comparison: 'Classical multi-bit gates (like AND or XOR) combine inputs to produce an output. Quantum multi-qubit gates entangle inputs so they can no longer be described independently.', math: '\\text{CNOT} = |0\\rangle\\langle0| \\otimes I + |1\\rangle\\langle1| \\otimes X', misconception: 'Multi-qubit gates don\'t just run two single-qubit gates in parallel; they create fundamental quantum correlations between the qubits.' },
  { id: 'interference', title: 'Quantum Interference', accent: '#10b981', definition: 'In quantum mechanics, a particle travels all possible paths at once as a probability wave. When two paths converge, their amplitudes either add together or cancel out — that\'s Quantum Interference.', comparison: 'Noise-canceling headphones generating an inverse soundwave to eliminate background noise.', math: 'H(H|0\\rangle) = H|+\\rangle = |0\\rangle', misconception: 'Quantum computers do not "try all answers at once". They use interference to cancel wrong answers out. See it in action ↓' },
  { id: 'entanglement', title: 'Entanglement', accent: '#f43f5e', definition: 'A quantum correlation where the state of one qubit cannot be described independently of another.', comparison: 'Two magic dice. No matter how far apart they are thrown, if one rolls a 6, the other instantly rolls a 6.', math: '|\\Phi^+\\rangle = \\frac{1}{\\sqrt{2}}(|00\\rangle + |11\\rangle)', misconception: 'You cannot use entanglement to send information faster than light (No-Communication Theorem).' },
  { id: 'exponential', title: 'Exponential State Space', accent: '#a855f7', definition: <>The mathematical reality that adding 1 physical qubit doubles the computational basis space (<InlineMath math={String.raw`2^N`} />).</>, comparison: <>Adding a classical bit gives you +1 state. Adding a qubit multiplies the entire universe of states by 2 (<InlineMath math={String.raw`\times 2`} />).</>, math: '\\text{Basis States} = 2^N', misconception: <>Quantum computers do not check all <InlineMath math={String.raw`2^N`} /> answers simultaneously to find the correct one; they shift amplitudes via interference.</> },
  { id: 'nocloning', title: 'No-Cloning Theorem', accent: '#06b6d4', definition: 'A fundamental law of physics stating that an unknown quantum state cannot be perfectly duplicated.', comparison: 'You can photocopy a physical document, but you cannot perfectly clone a living cell without altering it.', math: 'U(|\\psi\\rangle \\otimes |e\\rangle) \\neq |\\psi\\rangle \\otimes |\\psi\\rangle', misconception: 'While you cannot clone an unknown state, you CAN teleport it (moving it while destroying the original).' },
  { id: 'decoherence', title: 'Decoherence and Noise', accent: '#14b8a6', definition: 'The rapid decay of a quantum state back into classical noise due to environmental interaction.', comparison: 'Trying to build a delicate house of cards on a constantly vibrating table.', math: '\\rho(t) = e^{-t/T_2}\\rho(0)', misconception: 'Decoherence isn’t a hardware flaw; it is a fundamental thermodynamic reality of interacting with the universe.' },
  { id: 'error-correction', title: 'Quantum Error Correction', accent: '#6366f1', definition: 'Encoding a single "logical" qubit into the entangled states of multiple "physical" qubits to protect data.', comparison: 'Having 5 people memorize a password so if 1 person forgets, the other 4 can instantly correct them.', math: '|0_L\\rangle = |000\\rangle, \\quad |1_L\\rangle = |111\\rangle', misconception: 'Error correction requires measuring the qubits, but doing so carefully (parity checks) avoids collapsing the actual data.' }
];

const IDLE_FACTS = [
  { text: "A qubit can be both 0 and 1 until measured", moduleId: "superposition" },
  { text: "CNOT is quantum computing's most important building block", moduleId: "multi-qubit-gates" },
  { text: "Adding 1 physical qubit doubles the entire computational space", moduleId: "exponential" },
  { text: "Entanglement means two qubits cannot be described independently", moduleId: "entanglement" },
  { text: "Quantum computers don't try all answers at once; they use interference", moduleId: "interference" },
  { text: <>The Bra <InlineMath math={String.raw`\langle\psi|`} /> is just the Ket <InlineMath math={String.raw`|\psi\rangle`} /> transposed and conjugated</>, moduleId: "dirac-notation" },
  { text: "An unknown quantum state cannot be perfectly cloned", moduleId: "nocloning" },
  { text: "Decoherence is the rapid decay of a quantum state back into classical noise", moduleId: "decoherence" }
];

// ==========================================
// 3D CSS CIRCUIT VISUALIZER ENGINE
// ==========================================

// --- Per-module step flow & explanation data ---
const tooltipData = {
  'bit-vs-qubit': {
    title: '⚡ Classical NOT vs Quantum H Gate',
    steps: [
      { text: 'Classical Bit → NOT gate flips 0 ↔ 1 deterministically.' },
      { text: <><InlineMath math={String.raw`|0\rangle`} /> → H gate creates equal superposition <InlineMath math={String.raw`|+\rangle = \frac{|0\rangle+|1\rangle}{\sqrt{2}}`} />.</> },
      { text: 'Classical is discrete (0 OR 1); Quantum is a continuous wave vector.' },
    ],
  },
  'dirac-notation': {
    title: '📐 State Vector & Duality Flow',
    steps: [
      { text: <><InlineMath math={String.raw`|\psi\rangle`} /> represents the quantum state as a 2D complex column vector.</> },
      { text: <><InlineMath math={String.raw`\alpha, \beta \in \mathbb{C}`} /> are probability amplitudes with <InlineMath math={String.raw`|\alpha|^2 + |\beta|^2 = 1`} />.</> },
      { text: <><InlineMath math={String.raw`\langle\psi|`} /> is the conjugate-transpose dual row vector (Bra).</> },
    ],
  },
  superposition: {
    title: '🌊 Superposition & Measurement Collapse',
    steps: [
      { text: <>Input <InlineMath math={String.raw`|0\rangle`} /> enters the Hadamard (H) gate.</> },
      { text: <>H splits amplitudes equally: 50% <InlineMath math={String.raw`|0\rangle`} />, 50% <InlineMath math={String.raw`|1\rangle`} />.</> },
      { text: 'Measurement [M] forces irreversible collapse into classical 0 or 1.' },
    ],
  },
  'gates-pauli-x': {
    title: '🔀 Pauli-X (Quantum NOT) Flow',
    steps: [
      { text: <><InlineMath math={String.raw`|0\rangle`} /> enters the X gate.</> },
      { text: 'X rotates 180° around the Bloch sphere X-axis.' },
      { text: <>Output <InlineMath math={String.raw`|1\rangle`} /> — fully reversible matrix operation.</> },
    ],
  },
  'gates-pauli-y': {
    title: '🌀 Pauli-Y Gate Flow',
    steps: [
      { text: 'Input state enters the Y gate.' },
      { text: 'Applies both a bit flip and a phase flip (180° Y-rotation).' },
      { text: 'Outputs with an imaginary phase factor i.' },
    ],
  },
  'gates-pauli-z': {
    title: '🔄 Pauli-Z (Phase Flip) Flow',
    steps: [
      { text: <>Input state enters the Z gate.</> },
      { text: 'Z rotates 180° around the Z-axis, inverting relative phase.' },
      { text: <>Output state becomes <InlineMath math={String.raw`|\text{-}\rangle`} />.</> },
    ],
  },
  'gates-hadamard': {
    title: '⚖️ Hadamard Gate Flow',
    steps: [
      { text: <>Input state <InlineMath math={String.raw`|0\rangle`} /> enters the Hadamard gate.</> },
      { text: 'H rotates into a perfectly balanced superposition.' },
      { text: <>Output state is <InlineMath math={String.raw`|+\rangle`} /> (50/50 probability).</> },
    ],
  },
  'gates-s-gate': {
    title: '📐 S Gate (Phase) Flow',
    steps: [
      { text: 'Input state enters the S gate.' },
      { text: 'S applies a 90° Z-rotation (quarter turn).' },
      { text: 'Phase is rotated by i (square root of Z gate).' },
    ],
  },
  'gates-t-gate': {
    title: '⏱️ T Gate (π/4 Phase) Flow',
    steps: [
      { text: <>Input state enters the T gate.</> },
      { text: 'T rotates 45° (π/4) around the Z-axis.' },
      { text: 'Outputs with a 45° phase shift (e^(iπ/4)).' },
    ],
  },
  'multi-qubit-gates-cnot': {
    title: '🔗 CNOT (Controlled-NOT) Flow',
    steps: [
      { text: 'Control Qubit determines the conditional flip.' },
      { text: 'If Control is 1, Target Qubit flips (NOT).' },
      { text: 'If Control is in Superposition, Entanglement is created.' },
    ],
  },
  'multi-qubit-gates-swap': {
    title: '🔀 SWAP Gate Flow',
    steps: [
      { text: 'Exchanges the states of two qubits.' },
      { text: 'Useful for routing qubits across physical hardware constraints.' },
      { text: 'Equivalent to 3 alternating CNOT gates.' },
    ],
  },
  'multi-qubit-gates-toffoli': {
    title: '🧠 Toffoli (CCNOT) Flow',
    steps: [
      { text: 'Requires TWO Control Qubits to be 1.' },
      { text: 'Flips Target Qubit only if BOTH controls are 1.' },
      { text: 'Universal for classical reversible computing.' },
    ],
  },
  'multi-qubit-gates-cz': {
    title: '🌑 CZ (Controlled-Z) Flow',
    steps: [
      { text: 'Control Qubit determines the phase flip.' },
      { text: 'If Control is 1, applies a Z phase flip to Target.' },
      { text: 'Symmetric gate: Target and Control are interchangeable.' },
    ],
  },
  'multi-qubit-gates-bell': {
    title: '🔔 Bell State Preparation Flow',
    steps: [
      { text: 'Applies Hadamard to Qubit 0 to create Superposition.' },
      { text: 'Applies CNOT to entangle the superposition with Qubit 1.' },
      { text: 'Creates maximally entangled Bell pair (|00⟩+|11⟩)/√2.' },
    ],
  },
  interference: {
    title: '🎵 Quantum Interference Sequence',
    steps: [
      { text: <><InlineMath math={String.raw`|0\rangle`} /> → First H creates equal wavepaths <InlineMath math={String.raw`|+\rangle`} />.</> },
      { text: 'Phase shifter R(θ) rotates relative path angle.' },
      { text: <>Second H cancels wrong paths out (Destructive Interference).</> },
    ],
  },
  entanglement: {
    title: '🔗 Bell Pair Entanglement Flow',
    steps: [
      { text: 'H gate superimposes Qubit 0.' },
      { text: 'CNOT links both qubits into a shared non-separable state.' },
      { text: 'Measuring one qubit instantly determines the other.' },
    ],
  },
  exponential: {
    title: '📈 Exponential State Space Scaling',
    steps: [
      { text: '3 qubits → Parallel H gates process 2³ = 8 states simultaneously.' },
      { text: 'Adding 1 qubit doubles the entire computational universe.' },
      { text: 'Exponential capacity without exponential physical volume.' },
    ],
  },
  nocloning: {
    title: '🚫 No-Cloning Theorem Flow',
    steps: [
      { text: <><InlineMath math={String.raw`|\psi\rangle`} /> is an unknown quantum state to be "copied".</> },
      { text: 'Unitary copy attempt via CNOT creates entanglement instead.' },
      { text: <>Output is entangled, NOT a duplicate <InlineMath math={String.raw`|\psi\rangle \otimes |\psi\rangle`} />.</> },
    ],
  },
  decoherence: {
    title: '🌫️ Environmental Decoherence Flow',
    steps: [
      { text: <><InlineMath math={String.raw`|\psi\rangle`} /> enters as a pure coherent quantum state.</> },
      { text: 'Thermal and magnetic noise injects phase fluctuations.' },
      { text: 'Coherence leaks away — pure state decays into classical mixture.' },
    ],
  },
  'error-correction': {
    title: '🛡️ Parity Check Recovery Flow',
    steps: [
      { text: 'Data qubit is entangled with Ancilla via CNOT.' },
      { text: 'Ancilla measured — reveals error syndrome without collapsing data.' },
      { text: 'Syndrome triggers corrective X-flip to restore data.' },
    ],
  },
};

const LEARNING_MODE_TABS = [
  {
    key: 'beginner',
    label: 'Beginner',
    icon: () => <MorphIcon icon={Compass} spring="smooth" strokeWidth={1.8} size={22} color="currentColor" />,
  },
  {
    key: 'advanced',
    label: 'Advanced',
    icon: () => <MorphIcon icon={Atom} spring="smooth" strokeWidth={1.8} size={22} color="currentColor" />,
  },
];

// ==========================================
// LIQUID GLASS MATERIAL
// Keeps every floating-layer element in Liquid Glass (see LiquidGlass.js).
// ==========================================
const LiquidGlassEffects = () => {
  useEffect(() => startLiquidGlass(document.body), []);
  // The sidebar and the top bar use the Liquid Glass skill's material instead:
  // the lens on the top bar (Chromium) and a magnetic mute button. The
  // scroll-lean loop is off: the app never scrolls.
  useEffect(() => mountLiquidGlass({ magnetic: '.lg-magnetic', glide: false }), []);
  return null;
};

// ==========================================
// INTEGRATED NON-OVERLAPPING STEP GUIDE
// ==========================================
const LiquidCircuitStepGuide = ({ tip }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  if (!tip) return null;

  return (
    <div className="circuit-steps-panel">
      <div 
        className="circuit-steps-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Click to toggle step-by-step flow"
      >
        <span className="circuit-steps-title">
          <span className="circuit-steps-pulse" />
          {tip.title}
        </span>
        <span className="circuit-steps-chevron" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div className="circuit-steps-list">
          {tip.steps.map((s, i) => (
            <div key={i} className="circuit-step-item">
              <span className="step-pill">STEP {i + 1}</span>
              <span className="step-text">{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 1. CLASSICAL BIT VS QUANTUM QUBIT CIRCUIT
// ==========================================
const BitVsQubitLiquidCircuit = ({ tooltipData }) => {
  const [cBit, setCBit] = useState(0);
  const [qBit, setQBit] = useState(0);
  const tip = tooltipData['bit-vs-qubit'];

  return (
    <div className="glass-card" style={{ padding: '20px 16px', position: 'relative' }}>
      {/* Classical Row */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#facc15', letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' }}>
          Classical Domain
        </div>
        <div className="circuit-timeline-container" style={{ height: '50px' }}>
          <div 
            className="circuit-state-label" 
            style={{ left: 0, color: '#facc15', cursor: 'pointer', border: '1px solid rgba(250, 204, 21, 0.4)' }}
            onClick={() => setCBit(b => 1 - b)}
            title="Click to toggle input bit"
          >
            Bit {cBit}
          </div>
          <div className="qubit-wire-timeline" style={{ background: 'linear-gradient(90deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.8) 50%, rgba(250, 204, 21, 0.2))' }}>
            <div className="wire-flow-indicator" style={{ background: 'linear-gradient(90deg, transparent, rgba(250, 204, 21, 0.9), transparent)' }} />
          </div>
          <div className="gate-wrapper" style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
            <div 
              className="liquid-gate-box liquid-gate-classical"
              onClick={() => setCBit(b => 1 - b)}
              title="Classical NOT Gate (Click to flip)"
            >
              NOT
            </div>
          </div>
          <div className="circuit-state-label" style={{ right: 0, color: '#facc15' }}>
            Bit {1 - cBit}
          </div>
        </div>
      </div>

      {/* VS Divider */}
      <div className="liquid-vs-pill">
        <span>VS</span>
      </div>

      {/* Quantum Row */}
      <div style={{ marginTop: '6px' }}>
        <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#38bdf8', letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' }}>
          Quantum Domain
        </div>
        <div className="circuit-timeline-container" style={{ height: '50px' }}>
          <div 
            className="circuit-state-label" 
            style={{ left: 0, color: '#38bdf8', cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.4)' }}
            onClick={() => setQBit(b => 1 - b)}
            title="Click to toggle input qubit"
          >
            {qBit === 0 ? <InlineMath math={String.raw`|0\rangle`} /> : <InlineMath math={String.raw`|1\rangle`} />}
          </div>
          <div className="qubit-wire-timeline">
            <div className="wire-flow-indicator" />
          </div>
          <div className="gate-wrapper" style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
            <div 
              className="liquid-gate-box liquid-gate-h"
              style={{ width: '44px', height: '44px', fontSize: '18px' }}
              onClick={() => setQBit(b => 1 - b)}
              title="Quantum Hadamard Gate (Superposition)"
            >
              H
            </div>
          </div>
          <div className="circuit-state-label" style={{ right: 0, color: '#38bdf8' }}>
            {qBit === 0 ? <InlineMath math={String.raw`|+\rangle`} /> : <InlineMath math={String.raw`|\text{-}\rangle`} />}
          </div>
        </div>
      </div>

      <div className="circuit-interactive-hint">
        Click <strong>Bit</strong> or <strong>Gate</strong> to flip states in real time
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 2. DIRAC NOTATION LIQUID CIRCUIT
// ==========================================
const DiracNotationLiquidCircuit = ({ tooltipData }) => {
  const [isBraMode, setIsBraMode] = useState(false);
  const tip = tooltipData['dirac-notation'];

  return (
    <div className="glass-card" style={{ padding: '24px 16px', position: 'relative' }}>
      <div className="circuit-timeline-container" style={{ height: '60px' }}>
        <div 
          className="circuit-state-label" 
          style={{ left: 0, color: '#c084fc', cursor: 'pointer' }}
          onClick={() => setIsBraMode(!isBraMode)}
          title="Click to toggle Ket/Bra"
        >
          {isBraMode ? <InlineMath math={String.raw`\langle\psi|`} /> : <InlineMath math={String.raw`|\psi\rangle`} />}
        </div>
        <div className="qubit-wire-timeline" style={{ background: 'linear-gradient(90deg, rgba(192, 132, 252, 0.2), rgba(192, 132, 252, 0.8) 50%, rgba(192, 132, 252, 0.2))' }}>
          <div className="wire-flow-indicator" style={{ background: 'linear-gradient(90deg, transparent, rgba(192, 132, 252, 0.9), transparent)' }} />
        </div>
        <div className="gate-wrapper" style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
          <div 
            className="liquid-gate-box liquid-gate-dirac"
            onClick={() => setIsBraMode(!isBraMode)}
            title="Vector Decomposition (Click to toggle Ket ⇄ Bra)"
          >
            {isBraMode ? '⟨·|' : '|·⟩'}
          </div>
        </div>
        <div className="circuit-state-label" style={{ right: 0, color: '#c084fc', fontSize: '13px' }}>
          {isBraMode ? (
            <InlineMath math={String.raw`\alpha^*\langle 0| + \beta^*\langle 1|`} />
          ) : (
            <><span style={{ color: '#00f2fe' }}><InlineMath math={String.raw`\alpha|0\rangle`} /></span> + <span style={{ color: '#f7971e' }}><InlineMath math={String.raw`\beta|1\rangle`} /></span></>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <button 
          className="liquid-toggle-btn"
          onClick={() => setIsBraMode(!isBraMode)}
        >
          ⇄ Switch to {isBraMode ? "Ket |ψ⟩ (Column Vector)" : "Bra ⟨ψ| (Row Vector)"}
        </button>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 3. SUPERPOSITION & MEASUREMENT CIRCUIT
// ==========================================
const SuperpositionLiquidCircuit = ({ tooltipData }) => {
  const [measured, setMeasured] = useState(null);
  const tip = tooltipData['superposition'];

  const handleMeasure = () => {
    const outcome = Math.random() < 0.5 ? 0 : 1;
    setMeasured(outcome);
  };

  return (
    <div className="glass-card" style={{ padding: '24px 16px', position: 'relative' }}>
      <div className="circuit-timeline-container" style={{ height: '60px' }}>
        <div className="circuit-state-label" style={{ left: 0 }}>
          <InlineMath math={String.raw`|0\rangle`} />
        </div>
        
        <div className="qubit-wire-timeline">
          <div className="wire-flow-indicator" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 10 }}>
          <div className="liquid-gate-box liquid-gate-h" style={{ width: '42px', height: '42px' }} title="Hadamard (Creates Superposition)">
            H
          </div>

          <div 
            className={`measurement-dial-btn ${measured !== null ? 'active' : ''}`}
            onClick={handleMeasure}
            title="Click to Measure / Collapse State"
            style={{ width: '38px', height: '38px' }}
          >
            <div className="measurement-dial-icon" style={{ width: '18px', height: '18px' }} />
          </div>
        </div>

        <div className="circuit-state-label" style={{ right: 0, color: measured !== null ? '#facc15' : '#ec4899', minWidth: '55px' }}>
          {measured !== null ? (
            `|${measured}⟩ (100%)`
          ) : (
            <InlineMath math={String.raw`|+\rangle`} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
          {measured !== null ? `Collapsed into |${measured}⟩` : 'In 50/50 Superposition'}
        </span>
        <button 
          className="liquid-mini-btn"
          onClick={handleMeasure}
        >
          🎲 {measured !== null ? "Re-Measure" : "Measure [M]"}
        </button>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 4. QUANTUM INTERFERENCE CIRCUIT
// ==========================================
const InterferenceLiquidCircuit = ({ tooltipData }) => {
  const [phasePi, setPhasePi] = useState(false);
  const tip = tooltipData['interference'];

  return (
    <div className="glass-card" style={{ padding: '24px 14px', position: 'relative' }}>
      <div className="circuit-timeline-container" style={{ height: '65px' }}>
        <div className="circuit-state-label" style={{ left: 0 }}>
          <InlineMath math={String.raw`|0\rangle`} />
        </div>
        
        <div className="qubit-wire-timeline" style={{ background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.8) 50%, rgba(16, 185, 129, 0.2))' }}>
          <div className="wire-flow-indicator" style={{ background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.9), transparent)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
          <div className="liquid-gate-box liquid-gate-h" style={{ width: '38px', height: '38px', fontSize: '16px' }} title="H (Split wavepaths)">
            H
          </div>
          <div 
            className="liquid-gate-box liquid-gate-param" 
            onClick={() => setPhasePi(!phasePi)}
            style={{ height: '38px', fontSize: '13px', cursor: 'pointer', border: phasePi ? '1px solid #f43f5e' : '1px solid #06b6d4' }}
            title="Click to toggle phase shift R(θ)"
          >
            {phasePi ? 'R(π)' : 'R(0)'}
          </div>
          <div className="liquid-gate-box liquid-gate-h" style={{ width: '38px', height: '38px', fontSize: '16px' }} title="H (Interference recombination)">
            H
          </div>
        </div>

        <div className="circuit-state-label" style={{ right: 0, color: '#10b981' }}>
          {phasePi ? <InlineMath math={String.raw`|1\rangle`} /> : <InlineMath math={String.raw`|0\rangle`} />}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11.5px', color: '#94a3b8' }}>
        <span>{phasePi ? 'Constructive on |1⟩' : 'Constructive on |0⟩'}</span>
        <button 
          className="liquid-mini-btn"
          onClick={() => setPhasePi(!phasePi)}
        >
          ⚡ Phase: {phasePi ? "π (Flip to 0)" : "0 (Shift to π)"}
        </button>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 5. ENTANGLEMENT (BELL STATE) CIRCUIT
// ==========================================
const EntanglementLiquidCircuit = ({ tooltipData }) => {
  const [measuredPair, setMeasuredPair] = useState(null);
  const tip = tooltipData['entanglement'];

  const handleMeasurePair = () => {
    const pair = Math.random() < 0.5 ? '00' : '11';
    setMeasuredPair(pair);
  };

  return (
    <div className="glass-card" style={{ padding: '24px 16px', position: 'relative' }}>
      <div className="liquid-multi-circuit">
        <div className="liquid-multi-row">
          <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|0\rangle_A`} /></div>
          <div className="qubit-wire-timeline"><div className="wire-flow-indicator" /></div>
          <div className="liquid-multi-gate-col" style={{ left: '38%' }}>
            <div className="liquid-gate-box liquid-gate-h" style={{ width: '36px', height: '36px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12 }}>H</div>
          </div>
          <div className="liquid-multi-gate-col" style={{ left: '68%' }}>
            <div className="liquid-control-dot" />
          </div>
          <div className="circuit-state-label" style={{ right: 0, color: '#f43f5e' }}>
            {measuredPair ? `|${measuredPair[0]}⟩` : <InlineMath math={String.raw`|\Phi^+\rangle`} />}
          </div>
        </div>

        <div className="liquid-multi-row">
          <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|0\rangle_B`} /></div>
          <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.5s' }} /></div>
          <div className="liquid-multi-gate-col" style={{ left: '68%' }}>
            <div className="liquid-target-xor" />
          </div>
          <div className="circuit-state-label" style={{ right: 0, color: '#f43f5e' }}>
            {measuredPair ? `|${measuredPair[1]}⟩` : <InlineMath math={String.raw`|\Phi^+\rangle`} />}
          </div>
        </div>

        <div className="liquid-v-line bell-line" style={{ top: '30px', height: '60px', left: '68%' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
          {measuredPair ? `Correlated Outcome: |${measuredPair}⟩` : 'Maximally Entangled Bell State'}
        </span>
        <button
          className="liquid-mini-btn"
          onClick={measuredPair ? () => setMeasuredPair(null) : handleMeasurePair}
        >
          🔗 {measuredPair ? "Re-Entangle" : "Measure Pair"}
        </button>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 6. EXPONENTIAL STATE SPACE CIRCUIT
// ==========================================
const ExponentialLiquidCircuit = ({ tooltipData, qubitCount = 3 }) => {
  const tip = tooltipData['exponential'];

  return (
    <div className="glass-card" style={{ padding: '20px 14px', position: 'relative' }}>
      <div className="liquid-multi-circuit" style={{ gap: '8px' }}>
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="liquid-multi-row" style={{ height: '38px' }}>
            <div className="circuit-state-label" style={{ left: 0, fontSize: '12px' }}>
              <InlineMath math={`|0\\rangle_{q_${idx}}`} />
            </div>
            <div className="qubit-wire-timeline" style={{ top: '50%' }}>
              <div className="wire-flow-indicator" style={{ animationDelay: `${idx * 0.3}s` }} />
            </div>
            <div className="liquid-multi-gate-col">
              <div className="liquid-gate-box liquid-gate-h" style={{ width: '30px', height: '30px', fontSize: '13px', zIndex: 12 }}>H</div>
            </div>
            <div className="circuit-state-label" style={{ right: 0, fontSize: '12px', color: '#a855f7' }}>
              <InlineMath math={String.raw`|+\rangle`} />
            </div>
          </div>
        ))}
      </div>

      <div className="liquid-exp-summary">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#a855f7', fontSize: '12px' }}>3 Qubits = 2³ Basis States</span>
          <span className="liquid-badge-accent">8 States in Parallel</span>
        </div>
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#cbd5e1' }}>
          <InlineMath math={String.raw`|\psi\rangle = \frac{1}{\sqrt{8}}(|000\rangle + |001\rangle + \dots + |111\rangle)`} />
        </div>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 7. NO-CLONING THEOREM CIRCUIT
// ==========================================
const NoCloningLiquidCircuit = ({ tooltipData }) => {
  const tip = tooltipData['nocloning'];

  return (
    <div className="glass-card" style={{ padding: '24px 16px', position: 'relative' }}>
      <div className="liquid-multi-circuit">
        <div className="liquid-multi-row">
          <div className="circuit-state-label" style={{ left: 0, color: '#06b6d4' }}>
            <InlineMath math={String.raw`|\psi\rangle`} />
          </div>
          <div className="qubit-wire-timeline"><div className="wire-flow-indicator" /></div>
          <div className="liquid-multi-gate-col">
            <div className="liquid-control-dot" />
          </div>
          <div className="circuit-state-label" style={{ right: 0, color: '#06b6d4' }}>
            <InlineMath math={String.raw`|\psi'\rangle`} />
          </div>
        </div>

        <div className="liquid-multi-row">
          <div className="circuit-state-label" style={{ left: 0, color: '#94a3b8' }}>
            <InlineMath math={String.raw`|0\rangle`} /> <span style={{ fontSize: '9px', color: '#64748b' }}>Anc</span>
          </div>
          <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.4s' }} /></div>
          <div className="liquid-multi-gate-col">
            <div className="liquid-target-xor" />
          </div>
          <div className="circuit-state-label" style={{ right: 0, color: '#ef4444', fontSize: '13px' }}>
            <InlineMath math={String.raw`\neq |\psi\rangle`} />
          </div>
        </div>

        <div className="liquid-v-line" style={{ top: '30px', height: '60px' }} />
      </div>

      <div className="nocloning-alert-badge">
        <span>🚫 Entanglement Created: <InlineMath math={String.raw`\alpha|00\rangle + \beta|11\rangle \neq |\psi\rangle \otimes |\psi\rangle`} /></span>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 8. DECOHERENCE & NOISE CIRCUIT
// ==========================================
const DecoherenceLiquidCircuit = ({ tooltipData }) => {
  const [noiseActive, setNoiseActive] = useState(false);
  const noiseTimeoutRef = useRef(null);
  const tip = tooltipData['decoherence'];

  useEffect(() => () => clearTimeout(noiseTimeoutRef.current), []);

  const handlePulseNoise = () => {
    setNoiseActive(true);
    clearTimeout(noiseTimeoutRef.current);
    noiseTimeoutRef.current = setTimeout(() => setNoiseActive(false), 3000);
  };

  return (
    <div className="glass-card" style={{ padding: '24px 16px', position: 'relative' }}>
      <div className="circuit-timeline-container" style={{ height: '60px' }}>
        <div className="circuit-state-label" style={{ left: 0, color: '#14b8a6' }}>
          <InlineMath math={String.raw`|\psi\rangle`} />
        </div>
        
        <div className="qubit-wire-timeline" style={{ background: noiseActive ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.4), rgba(245, 158, 11, 0.8) 50%, rgba(239, 68, 68, 0.4))' : undefined }}>
          <div className="wire-flow-indicator" style={{ background: noiseActive ? 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.9), transparent)' : undefined }} />
        </div>

        <div className="gate-wrapper" style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
          <div 
            className={`liquid-gate-box liquid-gate-noise ${noiseActive ? 'pulsing' : ''}`}
            onClick={handlePulseNoise}
            title="Environmental Thermal Noise Channel (Click to inject)"
          >
            ⚡ E
          </div>
        </div>

        <div className="circuit-state-label" style={{ right: 0, color: noiseActive ? '#ef4444' : '#14b8a6', fontSize: '13px' }}>
          {noiseActive ? <InlineMath math={String.raw`\rho(t)`} /> : <InlineMath math={String.raw`|\psi\rangle`} />}
        </div>
      </div>

      <div className="liquid-coherence-bar-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
          <span>Phase Coherence T₂</span>
          <span style={{ color: noiseActive ? '#ef4444' : '#14b8a6', fontWeight: 700 }}>{noiseActive ? '18% (Decohered)' : '98% (Coherent)'}</span>
        </div>
        <div className="liquid-coherence-track">
          <div 
            className="liquid-coherence-fill" 
            style={{ width: noiseActive ? '18%' : '98%', background: noiseActive ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : 'linear-gradient(90deg, #14b8a6, #06b6d4)' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <button 
          className={`liquid-mini-btn ${noiseActive ? 'danger' : ''}`}
          onClick={handlePulseNoise}
          disabled={noiseActive}
        >
          {noiseActive ? "⚠️ Noise Active..." : "⚡ Inject Thermal Noise"}
        </button>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 9. QUANTUM ERROR CORRECTION CIRCUIT
// ==========================================
const ErrorCorrectionLiquidCircuit = ({ tooltipData }) => {
  const [hasError, setHasError] = useState(true);
  const tip = tooltipData['error-correction'];

  return (
    <div className="glass-card" style={{ padding: '24px 14px', position: 'relative' }}>
      <div className="liquid-multi-circuit">
        <div className="liquid-multi-row">
          <div className="circuit-state-label" style={{ left: 0, color: '#6366f1' }}>
            <InlineMath math={String.raw`|\psi\rangle_D`} />
          </div>
          <div className="qubit-wire-timeline"><div className="wire-flow-indicator" /></div>
          
          <div className="liquid-multi-gate-col" style={{ left: '32%' }}>
            <div 
              className={`liquid-gate-box ${hasError ? 'liquid-gate-x' : ''}`}
              onClick={() => setHasError(!hasError)}
              style={{ width: '34px', height: '34px', fontSize: '11px', zIndex: 12, cursor: 'pointer' }}
              title="Error channel (Click to toggle)"
            >
              {hasError ? 'X_err' : 'I'}
            </div>
          </div>

          <div className="liquid-multi-gate-col" style={{ left: '55%' }}>
            <div className="liquid-control-dot" />
          </div>

          <div className="liquid-multi-gate-col" style={{ left: '78%' }}>
            <div 
              className="liquid-gate-box liquid-gate-x" 
              style={{ width: '34px', height: '34px', fontSize: '11px', zIndex: 12, opacity: hasError ? 1 : 0.4 }}
              title="Syndrome recovery correction"
            >
              {hasError ? 'X_corr' : 'I'}
            </div>
          </div>

          <div className="circuit-state-label" style={{ right: 0, color: '#10b981' }}>
            <InlineMath math={String.raw`|\psi\rangle`} />
          </div>
        </div>

        <div className="liquid-multi-row">
          <div className="circuit-state-label" style={{ left: 0, color: '#94a3b8' }}>
            <InlineMath math={String.raw`|0\rangle_A`} />
          </div>
          <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.4s' }} /></div>
          
          <div className="liquid-multi-gate-col" style={{ left: '55%' }}>
            <div className="liquid-target-xor" />
          </div>

          <div className="liquid-multi-gate-col" style={{ left: '78%' }}>
            <div className="measurement-dial-btn active" style={{ width: '30px', height: '30px' }}>
              <div className="measurement-dial-icon" style={{ width: '15px', height: '15px' }} />
            </div>
          </div>

          <div className="circuit-state-label" style={{ right: 0, color: hasError ? '#f59e0b' : '#64748b', fontSize: '12px' }}>
            {hasError ? 's=1' : 's=0'}
          </div>
        </div>

        <div className="liquid-v-line" style={{ top: '30px', height: '60px', left: '55%' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
          {hasError ? "⚡ Error (s=1) → Corrected" : "✓ No Error (s=0) → Intact"}
        </span>
        <button 
          className="liquid-mini-btn"
          onClick={() => setHasError(!hasError)}
        >
          {hasError ? "Clear Error" : "⚡ Inject Error"}
        </button>
      </div>

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 10. GLASS CIRCUIT (GATES MODULE)
// ==========================================
const GlassCircuit = ({ gateId, progress }) => {
  const [measureActive, setMeasureActive] = useState(false);
  const [xStyle, setXStyle] = useState('box');
  
  const gateProps = {
    'pauli-x': { name: 'X', symbol: xStyle === 'box' ? 'X' : '⊕', class: 'liquid-gate-x', init: <InlineMath math={String.raw`|0\rangle`} />, out: <InlineMath math={String.raw`|1\rangle`} />, axis: 'X', angle: '180°' },
    'pauli-y': { name: 'Y', symbol: 'Y', class: 'liquid-gate-y', init: <InlineMath math={String.raw`|0\rangle`} />, out: <InlineMath math={String.raw`i|1\rangle`} />, axis: 'Y', angle: '180°' },
    'pauli-z': { name: 'Z', symbol: 'Z', class: 'liquid-gate-z', init: <InlineMath math={String.raw`|+\rangle`} />, out: <InlineMath math={String.raw`|\text{-}\rangle`} />, axis: 'Z', angle: '180°' },
    'hadamard': { name: 'H', symbol: 'H', class: 'liquid-gate-h', init: <InlineMath math={String.raw`|0\rangle`} />, out: <InlineMath math={String.raw`|+\rangle`} />, axis: 'X+Z', angle: '180°' },
    's-gate': { name: 'S', symbol: 'S', class: 'liquid-gate-s', init: <InlineMath math={String.raw`|+\rangle`} />, out: <InlineMath math={String.raw`|i\rangle`} />, axis: 'Z', angle: '90°' },
    't-gate': { name: 'T', symbol: 'T', class: 'liquid-gate-t', init: <InlineMath math={String.raw`|+\rangle`} />, out: <InlineMath math={String.raw`|e^{i\pi/4}\rangle`} />, axis: 'Z', angle: '45°' },
  }[gateId] || { name: '?', symbol: '?', class: '', init: <InlineMath math={String.raw`|0\rangle`} />, out: <InlineMath math={String.raw`|?\rangle`} />, axis: '?', angle: '?°' };

  const showOutput = progress > 0.95;

  let finalOutputStr = gateProps.out;
  let finalOutputColor = '#e2e8f0';
  if (measureActive) {
    finalOutputColor = '#facc15';
    if (gateId === 'pauli-x' || gateId === 'pauli-y') finalOutputStr = '1';
    else finalOutputStr = '0/1';
  }

  const tip = tooltipData[`gates-${gateId}`];

  return (
    <div className="glass-card">
      <div className="circuit-timeline-container">
        <div className="circuit-state-label" style={{ left: 0 }}>
          {gateProps.init}
        </div>
        
        <div className="qubit-wire-timeline">
          <div className="wire-flow-indicator" />
        </div>

        <div className="gate-wrapper" style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
          <div 
            className={`liquid-gate-box ${gateProps.class}`}
            onClick={() => gateId === 'pauli-x' && setXStyle(s => s === 'box' ? 'plus' : 'box')}
            style={progress > 0.1 && progress < 0.9 ? { filter: 'brightness(1.5) drop-shadow(0 0 10px rgba(255,255,255,0.8))', transform: 'scale(1.1)' } : {}}
            title="Click gate to toggle notation (X ↔ ⊕)"
          >
            {gateProps.symbol}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2, justifyContent: 'flex-end' }}>
          <div 
            className={`measurement-dial-btn ${measureActive ? 'active' : ''}`}
            onClick={() => setMeasureActive(!measureActive)}
            title="Toggle Measurement"
          >
            <div className="measurement-dial-icon" />
          </div>

          <div className="circuit-state-label" style={{ opacity: showOutput ? 1 : 0.3, color: finalOutputColor, transition: 'all 0.3s ease' }}>
            {finalOutputStr}
          </div>
        </div>
      </div>

      {gateId === 'pauli-x' && (
        <div style={{ marginTop: '16px', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', textAlign: 'center' }}>
          <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Notation Note:</span> <strong>X</strong> box and <strong>⊕</strong> target symbol are used interchangeably. Click gate to toggle.
        </div>
      )}

      <LiquidCircuitStepGuide tip={tip} />
    </div>
  );
};

// ==========================================
// 11. MULTI-QUBIT GLASS CIRCUIT
// ==========================================
const GlassMultiCircuit = ({ gateId, tooltipData }) => {
  const multiTip = tooltipData[`multi-qubit-gates-${gateId}`];

  return (
    <div className="glass-card" style={{ padding: '24px 18px', position: 'relative' }}>
      <div className="liquid-multi-circuit">
        
        {gateId === 'cnot' && (
          <>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|C\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-control-dot" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|C\rangle`} /></div>
            </div>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|T\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.5s' }} /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-target-xor" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|C \oplus T\rangle`} /></div>
            </div>
            <div className="liquid-v-line" style={{ top: '30px', height: '60px' }} />
          </>
        )}

        {gateId === 'swap' && (
          <>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|q_0\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-swap-cross" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|q_1\rangle`} /></div>
            </div>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|q_1\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.5s' }} /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-swap-cross" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|q_0\rangle`} /></div>
            </div>
            <div className="liquid-v-line swap-line" style={{ top: '30px', height: '60px' }} />
          </>
        )}

        {gateId === 'cz' && (
          <>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|C\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-control-dot" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|C\rangle`} /></div>
            </div>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|T\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.5s' }} /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-control-dot" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|T\rangle \cdot Z`} /></div>
            </div>
            <div className="liquid-v-line cz-line" style={{ top: '30px', height: '60px' }} />
          </>
        )}

        {gateId === 'bell' && (
          <>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|0\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" /></div>
              <div className="liquid-multi-gate-col" style={{ left: '35%' }}>
                <div className="liquid-gate-box liquid-gate-h" style={{ width: '36px', height: '36px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12 }}>H</div>
              </div>
              <div className="liquid-multi-gate-col" style={{ left: '65%' }}>
                <div className="liquid-control-dot" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|\Phi^+\rangle`} /></div>
            </div>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|0\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.5s' }} /></div>
              <div className="liquid-multi-gate-col" style={{ left: '65%' }}>
                <div className="liquid-target-xor" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|\Phi^+\rangle`} /></div>
            </div>
            <div className="liquid-v-line bell-line" style={{ top: '30px', height: '60px', left: '65%' }} />
          </>
        )}

        {gateId === 'toffoli' && (
          <>
            <div className="liquid-multi-row" style={{ height: '40px' }}>
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|C_1\rangle`} /></div>
              <div className="qubit-wire-timeline" style={{ top: '50%' }}><div className="wire-flow-indicator" /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-control-dot" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|C_1\rangle`} /></div>
            </div>
            <div className="liquid-multi-row" style={{ height: '40px' }}>
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|C_2\rangle`} /></div>
              <div className="qubit-wire-timeline" style={{ top: '50%' }}><div className="wire-flow-indicator" style={{ animationDelay: '0.3s' }} /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-control-dot" />
              </div>
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`|C_2\rangle`} /></div>
            </div>
            <div className="liquid-multi-row" style={{ height: '40px' }}>
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|T\rangle`} /></div>
              <div className="qubit-wire-timeline" style={{ top: '50%' }}><div className="wire-flow-indicator" style={{ animationDelay: '0.6s' }} /></div>
              <div className="liquid-multi-gate-col">
                <div className="liquid-target-xor" />
              </div>
              <div className="circuit-state-label" style={{ right: 0, fontSize: '13px', letterSpacing: '-0.5px', padding: '2px 4px' }}><InlineMath math={String.raw`|T \oplus C_1 C_2\rangle`} /></div>
            </div>
            <div className="liquid-v-line toffoli-line" style={{ top: '20px', height: '80px' }} />
          </>
        )}

      </div>

      <LiquidCircuitStepGuide tip={multiTip} />
    </div>
  );
};

// ==========================================
// UNIFIED CIRCUIT VISUALIZER DISPATCHER
// ==========================================
const CircuitVisualizer = ({ moduleId, gateId, multiGatesStep = 0, qubitCount = 3 }) => {
  switch (moduleId) {
    case 'bit-vs-qubit':
      return <BitVsQubitLiquidCircuit tooltipData={tooltipData} />;
    case 'dirac-notation':
      return <DiracNotationLiquidCircuit tooltipData={tooltipData} />;
    case 'superposition':
      return <SuperpositionLiquidCircuit tooltipData={tooltipData} />;
    case 'gates':
      return <GlassCircuit key={gateId} gateId={gateId} progress={1} />;
    case 'multi-qubit-gates': {
      const stepData = MULTI_GATES_STEPS[multiGatesStep];
      return <GlassMultiCircuit key={stepData.id} gateId={stepData.id} tooltipData={tooltipData} />;
    }
    case 'interference':
      return <InterferenceLiquidCircuit tooltipData={tooltipData} />;
    case 'entanglement':
      return <EntanglementLiquidCircuit tooltipData={tooltipData} />;
    case 'exponential':
      return <ExponentialLiquidCircuit tooltipData={tooltipData} qubitCount={qubitCount} />;
    case 'nocloning':
      return <NoCloningLiquidCircuit tooltipData={tooltipData} />;
    case 'decoherence':
      return <DecoherenceLiquidCircuit tooltipData={tooltipData} />;
    case 'error-correction':
      return <ErrorCorrectionLiquidCircuit tooltipData={tooltipData} />;
    default:
      return null;
  }
};

// ==========================================
// CINEMATIC LANDING BACKGROUND
// ==========================================
function LandingBackground() {
  const coreRef = useRef();
  const glassShellRef = useRef();
  const wireframeRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const ring3Ref = useRef();
  const starsRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, 14 + Math.sin(t * 0.5) * 1.5, 0.05);
    state.camera.lookAt(0, 0, 0);

    if (coreRef.current) { coreRef.current.rotation.y = t * 0.4; coreRef.current.rotation.x = t * 0.2; }
    if (glassShellRef.current) { glassShellRef.current.rotation.y = t * 0.1; glassShellRef.current.rotation.z = Math.sin(t * 0.2) * 0.2; }
    if (wireframeRef.current) { wireframeRef.current.rotation.y = -t * 0.05; wireframeRef.current.rotation.x = -t * 0.02; }
    if (ring1Ref.current) { ring1Ref.current.rotation.x = t * 0.3; ring1Ref.current.rotation.y = Math.sin(t * 0.5) * 0.5; }
    if (ring2Ref.current) { ring2Ref.current.rotation.y = -t * 0.2; ring2Ref.current.rotation.z = Math.cos(t * 0.4) * 0.5; }
    if (ring3Ref.current) { ring3Ref.current.rotation.z = t * 0.15; ring3Ref.current.rotation.x = Math.sin(t * 0.3) * 0.8; }
    if (starsRef.current) { starsRef.current.rotation.y += 0.0005; starsRef.current.rotation.x += 0.0002; }
  });

  return (
    <>
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.4} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0, 0]} />
      </EffectComposer>
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} color="#00f2fe" intensity={8} distance={50} />
      <pointLight position={[-10, -10, -10]} color="#f093fb" intensity={8} distance={50} />
      <pointLight position={[0, 0, 0]} color="#ffffff" intensity={2} distance={10} />

      <group ref={starsRef}>
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={1} fade speed={1.5} />
      </group>

      <group position={[4, 0, 0]}>
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[1.5, 0]} />
          <meshStandardMaterial color="#ffffff" emissive="#00f2fe" emissiveIntensity={4} wireframe={false} />
        </mesh>
        <mesh ref={glassShellRef}>
          <icosahedronGeometry args={[3.8, 4]} />
          <meshPhysicalMaterial color="#020813" transparent transmission={0.95} roughness={0.05} metalness={0.5} clearcoat={1} ior={1.6} />
        </mesh>
        <mesh ref={wireframeRef}>
          <icosahedronGeometry args={[4.2, 4]} />
          <meshBasicMaterial color="#00f2fe" wireframe={true} transparent opacity={0.08} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[5.5, 0.02, 16, 100]} />
          <meshBasicMaterial color="#00f2fe" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={ring2Ref} rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
          <torusGeometry args={[6.5, 0.015, 16, 100]} />
          <meshBasicMaterial color="#f093fb" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={ring3Ref} rotation={[0, Math.PI / 2, Math.PI / 6]}>
          <torusGeometry args={[7.5, 0.05, 16, 100]} />
          <meshBasicMaterial color="#4facfe" transparent opacity={0.2} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </>
  );
}

// ==========================================
// HELPER: HIGHLIGHT MATRIX COLUMN
// ==========================================
function getHighlightedMatrix(matrixStr, inputIndex, color, isSynced) {
  if (!isSynced || !matrixStr.includes('\\begin{bmatrix}')) return matrixStr;
  
  // Extract everything between \begin{bmatrix} and \end{bmatrix}
  const match = matrixStr.match(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/s);
  if (!match) return matrixStr;
  
  const rows = match[1].split('\\\\').map(row => row.split('&').map(cell => cell.trim()));
  
  const highlightedRows = rows.map(row => {
    return row.map((cell, colIndex) => {
      // Input index corresponds exactly to the column that transforms it!
      if (colIndex === inputIndex && cell !== '0') {
        return `\\textcolor{${color}}{${cell}}`;
      }
      return cell;
    }).join(' & ');
  }).join(' \\\\ ');
  
  return matrixStr.replace(match[1], ` ${highlightedRows} `);
}

// ==========================================
// GATES MODULE VIEW
// ==========================================
// Owns the per-frame gate animation progress so gsap ticks only
// re-render this small subtree instead of the whole App.
const GatesModuleView = ({ step, applied, theme, isSidebarOpen, uiBoundsStyle, onToggleApply, onNext, onPrev }) => {
  const [progress, setProgress] = useState(0);

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 13], fov: 45 }}
        gl={{ powerPreference: 'high-performance', alpha: true, antialias: true }}
        style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
      >
        <CameraShifter isSidebarOpen={isSidebarOpen} />
        <OrbitControls makeDefault enableZoom={true} enablePan={true} />
        <GatesScene step={step} applied={applied} theme={theme} setProgress={setProgress} />
      </Canvas>
      <div style={uiBoundsStyle}>
        <GatesOverlay
          step={step}
          applied={applied}
          theme={theme}
          onToggleApply={onToggleApply}
          onNext={onNext}
          onPrev={onPrev}
          progress={progress}
        />
      </div>
    </>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function App() {
  const [hasStarted, setHasStarted] = useState(() => {
    return readStorage('quantumUI_initialized') === 'true';
  });

  const [theme] = useState('dark');
  const [learningMode, setLearningMode] = useState(() => readStorage('quantumUI_learningMode') === 'advanced' ? 'advanced' : 'beginner');
  const [activeModuleId, setActiveModuleId] = useState(moduleFromHash); // the hub unless the URL names a module
  const [lastClosedModuleId, setLastClosedModuleId] = useState(() => readModuleSetting('quantumUI_lastModule'));

  const [qubitCount, setQubitCount] = useState(1);
  const [attemptCopy, setAttemptCopy] = useState(false);
  const [isDecohering, setIsDecohering] = useState(false);
  const [noiseTimer, setNoiseTimer] = useState(0);

  // Sidebar Toggle State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dirac Notation module step
  const [diracStep, setDiracStep] = useState(0);

  // ── Dirac audio (Web Audio API) ──
  const diracAudio = useDiracAudio();
  // ── Gates module state ──
  const [gatesStep, setGatesStep] = useState(0);
  const [gateApplied, setGateApplied] = useState(false);

  const [multiGatesStep, setMultiGatesStep] = useState(0);
  const [multiGateApplied, setMultiGateApplied] = useState(false);
  const [multiGatesInputs, setMultiGatesInputs] = useState(['0', '0', '0']);
  const gatesAudio = useGatesAudio();

  // ── Global Background & Ambient Audio State ──
  const [isGlobalMuted, setIsGlobalMuted] = useState(() => readStorage('quantumUI_muted') === 'true');
  const idleAudio = useIdleAudio(isGlobalMuted);

  const [idleFactIdx, setIdleFactIdx] = useState(0);
  const [isFactFading, setIsFactFading] = useState(false);

  // ==========================================
  // MOBILE DEVICE BLOCKER
  // ==========================================
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep the URL in step with the open module. Each change is a history
  // entry, so Back returns to the previous module or the hub.
  const urlSyncedRef = useRef(false);
  useEffect(() => {
    const hash = activeModuleId ? `#${activeModuleId}` : '';
    const firstSync = !urlSyncedRef.current;
    urlSyncedRef.current = true;
    if (window.location.hash === hash) return;
    // On load, only tidy an unknown #hash away; don't add a history entry.
    const update = firstSync ? 'replaceState' : 'pushState';
    window.history[update](null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }, [activeModuleId]);
  useEffect(() => {
    const syncFromUrl = () => {
      const id = moduleFromHash();
      // A hand-typed hash that names no module: show the hub and tidy the URL.
      if (!id && window.location.hash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      setActiveModuleId(id);
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);
  useEffect(() => {
    const title = curriculumData.find(m => m.id === activeModuleId)?.title;
    document.title = title ? `${title} · QASS` : BASE_TITLE;
  }, [activeModuleId]);

  // Remember the visitor's choices between visits. "Continue" offers the
  // module they were last in.
  useEffect(() => {
    if (activeModuleId) setLastClosedModuleId(activeModuleId);
  }, [activeModuleId]);
  useEffect(() => { writeStorage('quantumUI_lastModule', lastClosedModuleId || ''); }, [lastClosedModuleId]);
  useEffect(() => { writeStorage('quantumUI_muted', String(isGlobalMuted)); }, [isGlobalMuted]);
  useEffect(() => { writeStorage('quantumUI_learningMode', learningMode); }, [learningMode]);

  // Warm the module chunks once the hub is showing and the browser is idle.
  useEffect(() => {
    if (!hasStarted || isMobile) return;
    const prefetch = () => Object.values(MODULE_LOADERS).forEach((load) => load().catch(() => {}));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000);
    return () => clearTimeout(id);
  }, [hasStarted, isMobile]);

  // Background audio engine for ALL active modules
  const { initAudio: initGatesAudio, toggleMute: toggleGatesMute, stopAll: stopGatesAudio } = gatesAudio;
  useEffect(() => {
    let isCancelled = false;
    if (hasStarted && activeModuleId && !isMobile) {
      initGatesAudio().then(() => {
        if (!isCancelled) {
          toggleGatesMute(isGlobalMuted);
        }
      }).catch(() => {});
    } else {
      stopGatesAudio();
    }
    return () => { isCancelled = true; };
  }, [activeModuleId, isGlobalMuted, hasStarted, isMobile, initGatesAudio, toggleGatesMute, stopGatesAudio]);

  const handleToggleGlobalAudio = () => {
    const nextMuted = !isGlobalMuted;
    setIsGlobalMuted(nextMuted);
    gatesAudio.toggleMute(nextMuted);
    diracAudio.toggleMute(nextMuted);
  };

  const { playAmbient: playIdleAmbient, stopAmbient: stopIdleAmbient } = idleAudio;
  useEffect(() => {
    let interval;
    let fadeTimeout;
    if (hasStarted && !activeModuleId && !isMobile) {
      if (!isGlobalMuted) playIdleAmbient();
      interval = setInterval(() => {
        setIsFactFading(true);
        fadeTimeout = setTimeout(() => {
          setIdleFactIdx((prev) => (prev + 1) % IDLE_FACTS.length);
          setIsFactFading(false);
        }, 600);
      }, 7000);
    } else {
      stopIdleAmbient();
      setIsFactFading(false);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout);
      stopIdleAmbient();
    };
  }, [activeModuleId, hasStarted, isGlobalMuted, isMobile, playIdleAmbient, stopIdleAmbient]);

  // Gates & Multi-Gates Sync State (delays highlight to match 3D stage animation)
  const [showResultSync, setShowResultSync] = useState(false);
  useEffect(() => {
    let timer;
    if (multiGateApplied || gateApplied) {
      timer = setTimeout(() => setShowResultSync(true), 1800);
    } else {
      setShowResultSync(false);
    }
    return () => clearTimeout(timer);
  }, [multiGateApplied, gateApplied]);


  // Circuit Diagram Accordion State
  const [showCircuit, setShowCircuit] = useState(false);

  const handleInitialize = () => {
    writeStorage('quantumUI_initialized', 'true');
    setHasStarted(true);
  };

  useEffect(() => {
    setQubitCount(1); setIsDecohering(false); setAttemptCopy(false); setNoiseTimer(0);
    setShowCircuit(false); // Reset to closed when switching modules
  }, [activeModuleId]);

  useEffect(() => {
    let timer;
    if (isDecohering && noiseTimer > 0) timer = setTimeout(() => setNoiseTimer(noiseTimer - 1), 1000);
    else if (noiseTimer === 0) setIsDecohering(false);
    return () => clearTimeout(timer);
  }, [isDecohering, noiseTimer]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    let isCancelled = false;
    // Reset dirac step when leaving dirac module
    if (activeModuleId !== 'dirac-notation') {
      setDiracStep(0);
      diracAudio.stopAll();
    } else {
      // Entering dirac module — init audio graph + preload buffers + play step 0
      diracAudio.initAudio().then(() => {
        if (!isCancelled) {
          diracAudio.toggleMute(isGlobalMuted);
          diracAudio.playStep(0);
        }
      }).catch(() => {});
    }
    // Sidebar: keep open unless superposition module controls it
    
    // Reset gate steps when leaving their respective modules
    if (activeModuleId !== 'gates') {
      setGatesStep(0);
      setGateApplied(false);
    }
    if (activeModuleId !== 'multi-qubit-gates') {
      setMultiGatesStep(0);
      setMultiGateApplied(false);
      setMultiGatesInputs(['0', '0', '0']);
    }
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModuleId]);

  // Fire matching ElevenLabs sound whenever the dirac step changes
  const prevDiracStepRef = useRef(-1);
  useEffect(() => {
    if (activeModuleId !== 'dirac-notation') return;
    if (prevDiracStepRef.current === diracStep) return;
    prevDiracStepRef.current = diracStep;
    diracAudio.initAudio().then(() => {
      diracAudio.toggleMute(isGlobalMuted);
      diracAudio.playStep(diracStep);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diracStep]);

  const triggerNoise = () => { setIsDecohering(true); setNoiseTimer(4); };

  // ==========================================
  // MOBILE DEVICE BLOCKER
  // ==========================================
  if (isMobile) {
    return (
      <div className="mobile-blocker-overlay">
        <LiquidGlassEffects />
        <div className="glass-card mobile-blocker-card">
          <img src="/logo.jpg" alt="QASS logo" style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'cover', marginBottom: '24px', boxShadow: '0 8px 32px rgba(79, 172, 254, 0.3)' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px', color: 'var(--text-primary)' }}>QASS</h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
            This immersive 3D quantum experience requires a larger screen to run properly.
          </p>
          <p style={{ fontSize: '16px', color: '#4facfe', fontWeight: '600' }}>
            Please experience it in a Desktop or Tablet Browser.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // GATEWAY: CINEMATIC LANDING PAGE
  // ==========================================
  if (!hasStarted) {
    return (
      <div className="landing-container">
        <LiquidGlassEffects />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
          <Canvas
            dpr={[1, 1.5]}
            gl={{ powerPreference: 'high-performance', alpha: true }}
            camera={{ position: [0, 0, 15], fov: 45 }}
          >
            <LandingBackground />
          </Canvas>
        </div>

        <div className="landing-overlay">
          <div className="hero-badge">QASS · Quantum Algorithm State Simulator</div>
          <h1 className="hero-title">Quantum Reality. <span>Decoded.</span></h1>
          <p className="hero-subtitle">
            Step out of the textbook. Experience the profound mechanics of quantum computing through beautiful, real-time, interactive 3D simulations.
          </p>

          <div className="feature-grid">
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Atom} spring="smooth" strokeWidth={1} size={32} color="#00e5ff" />
              </div>
              <h4>Dual Reality Engine</h4>
              <p>Compare silicon Classical Bits against fluid Quantum Qubits in real-time, side-by-side.</p>
            </div>
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Zap} spring="smooth" strokeWidth={1} size={32} color="#f59e0b" />
              </div>
              <h4>Interactive Physics</h4>
              <p>Manipulate superposition, trigger decoherence noise, and violate the no-cloning theorem yourself.</p>
            </div>
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Variable} spring="smooth" strokeWidth={1} size={32} color="#c084fc" />
              </div>
              <h4>Math Made Visual</h4>
              <p>Watch Dirac notation and probability amplitudes mathematically react as you interact with the hardware.</p>
            </div>
          </div>

          <button className="start-btn" onClick={handleInitialize}>
            Initialize Simulator
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN SIMULATOR UI
  // ==========================================
  const renderModuleContent = (mod) => {
    if (mod.id === 'gates') {
      const currentGateData = GATES_STEPS[gatesStep];
      const initialInputState = currentGateData.startsAtPlus ? '|+\\rangle' : '|0\\rangle';
      const inputIdx = currentGateData.startsAtPlus ? -1 : 0;

      return (
        <div className="multi-gates-sidebar stagger-enter" style={{ '--gate-accent-color': currentGateData.color }} key={gatesStep}>
          <div className="sidebar-title-wrapper">
            <h3 style={{ marginTop: '-5px', fontSize: '18px', fontWeight: '700' }}>
              {currentGateData.title}
            </h3>
            <div className="title-underline-sweep" />
          </div>

          <div className="data-card">
            <span className="pillar-label">1-Line Definition</span>
            <p className="pillar-text">{currentGateData.definition}</p>
          </div>

          <div className="data-card">
            <span className="pillar-label">Deep Understanding</span>
            <p className="pillar-text">{currentGateData.understanding}</p>
          </div>

          {currentGateData.stateMapping && (
            <div className="data-card">
              <span className="pillar-label">State Mappings</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {currentGateData.stateMapping.map((map, i) => {
                  const isActiveMatch = map.in === initialInputState;
                  let rowClass = "mapping-row";
                  if (showResultSync) {
                    rowClass += isActiveMatch ? " active" : " dimmed";
                  }

                  return (
                    <div key={i} className={rowClass} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: 'var(--gate-accent-color)', fontSize: '14px', width: '160px', flexShrink: 0 }}>
                        <InlineMath math={`${map.in} \\rightarrow ${map.out}`} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {map.note}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="data-card">
            <span className="pillar-label">Classical Comparison</span>
            <p className="pillar-text" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{currentGateData.comparison}"</p>
          </div>

          <div className="data-card">
            <span className="pillar-label">Quantum Unitary Matrix</span>
            <div className="math-box-fluid">
              <BlockMath math={getHighlightedMatrix(
                currentGateData.math,
                inputIdx,
                currentGateData.color,
                showResultSync
              )} />
            </div>
          </div>

          <div className="circuit-diagram-card">
            <div
              className="circuit-header"
              onClick={() => setShowCircuit(!showCircuit)}
            >
              <span className="pillar-label">Circuit Diagram</span>
              <span className={`circuit-toggle-icon ${showCircuit ? 'open' : ''}`}>
                <MorphCircuitToggleIcon isOpen={showCircuit} size={14} color="currentColor" />
              </span>
            </div>

            {showCircuit && (
              <div className="circuit-content">
                <CircuitVisualizer moduleId={mod.id} gateId={currentGateData.id} />
              </div>
            )}
          </div>

          <div className="data-card" style={{ borderLeft: `3px solid var(--gate-accent-color)`, paddingLeft: '12px' }}>
            <span className="pillar-label" style={{ color: 'var(--gate-accent-color)' }}>Why Quantum Needs This</span>
            <p className="pillar-text">{currentGateData.reversibility}</p>
          </div>
        </div>
      );
    } else if (mod.id === 'multi-qubit-gates') {
      return (
        <div className="multi-gates-sidebar stagger-enter" style={{ '--gate-accent-color': MULTI_GATES_STEPS[multiGatesStep].color }} key={multiGatesStep}>
          <div className="sidebar-title-wrapper">
            <h3 style={{ marginTop: '-5px', fontSize: '18px', fontWeight: '700' }}>
              {MULTI_GATES_STEPS[multiGatesStep].title}
            </h3>
            <div className="title-underline-sweep" />
          </div>
          <div className="data-card">
            <span className="pillar-label">1-Line Definition</span>
            <p className="pillar-text">{MULTI_GATES_STEPS[multiGatesStep].definition}</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Deep Understanding</span>
            <p className="pillar-text">{MULTI_GATES_STEPS[multiGatesStep].understanding}</p>
          </div>
          
          {MULTI_GATES_STEPS[multiGatesStep].stateMapping && (
            <div className="data-card">
              <span className="pillar-label">State Mappings</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {MULTI_GATES_STEPS[multiGatesStep].stateMapping.map((map, i) => {
                  const numQubits = MULTI_GATES_STEPS[multiGatesStep].numQubits;
                  const currentInputState = `|${multiGatesInputs.slice(0, numQubits).join('')}\\rangle`;
                  const isActiveMatch = map.in === currentInputState;
                  
                  let rowClass = "mapping-row";
                  if (showResultSync) {
                    rowClass += isActiveMatch ? " active" : " dimmed";
                  }

                  return (
                    <div key={i} className={rowClass} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: 'var(--gate-accent-color)', fontSize: '14px', width: '160px', flexShrink: 0 }}>
                        <InlineMath math={`${map.in} \\rightarrow ${map.out}`} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {map.note}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="data-card">
            <span className="pillar-label">Classical Comparison</span>
            <p className="pillar-text" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{MULTI_GATES_STEPS[multiGatesStep].comparison}"</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Quantum Unitary Matrix</span>
            <div className="math-box-fluid">
              <BlockMath math={(() => {
                const numQubits = MULTI_GATES_STEPS[multiGatesStep].numQubits;
                const _mqInputStr = multiGatesInputs.slice(0, numQubits).join('');
                const inputIdx = _mqInputStr.includes('+') ? -1 : parseInt(_mqInputStr, 2);
                return getHighlightedMatrix(
                  MULTI_GATES_STEPS[multiGatesStep].math, 
                  inputIdx, 
                  MULTI_GATES_STEPS[multiGatesStep].color, 
                  showResultSync
                );
              })()} />
            </div>
          </div>
          <div className="circuit-diagram-card">
            <div
              className="circuit-header"
              onClick={() => setShowCircuit(!showCircuit)}
            >
              <span className="pillar-label">Circuit Diagram</span>
              <span className={`circuit-toggle-icon ${showCircuit ? 'open' : ''}`}>
                <MorphCircuitToggleIcon isOpen={showCircuit} size={14} color="currentColor" />
              </span>
            </div>

            {showCircuit && (
              <div className="circuit-content">
                <CircuitVisualizer moduleId={mod.id} gateId={MULTI_GATES_STEPS[multiGatesStep].id} multiGatesStep={multiGatesStep} />
              </div>
            )}
          </div>
          <div className="data-card" style={{ borderLeft: `3px solid var(--gate-accent-color)`, paddingLeft: '12px' }}>
            <span className="pillar-label" style={{ color: 'var(--gate-accent-color)' }}>Why Quantum Needs This</span>
            <p className="pillar-text">{MULTI_GATES_STEPS[multiGatesStep].reversibility}</p>
          </div>
        </div>
      );
    } else {
      return (
        <>
          <div className="data-card">
            <span className="pillar-label">1-Line Definition</span>
            <p className="pillar-text">{mod.definition}</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Classical Comparison</span>
            <p className="pillar-text" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{mod.comparison}"</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Mathematical Representation</span>
            <div className="math-box-fluid">
              <BlockMath math={mod.math} />
            </div>
          </div>
          <div className="circuit-diagram-card">
            <div
              className="circuit-header"
              onClick={() => setShowCircuit(!showCircuit)}
            >
              <span className="pillar-label">Circuit Diagram</span>
              <span className={`circuit-toggle-icon ${showCircuit ? 'open' : ''}`}>
                <MorphCircuitToggleIcon isOpen={showCircuit} size={14} color="currentColor" />
              </span>
            </div>
            {showCircuit && (
              <div className="circuit-content">
                <CircuitVisualizer moduleId={mod.id} multiGatesStep={multiGatesStep} qubitCount={qubitCount} />
              </div>
            )}
          </div>
          <div className="data-card" style={{ borderLeft: '3px solid #ef4444', paddingLeft: '12px' }}>
            <span className="pillar-label" style={{ color: '#ef4444' }}>Common Misconception</span>
            <p className="pillar-text">{mod.misconception}</p>
          </div>

          {mod.id === 'decoherence' && (
            <div className="interactive-panel">
              <h4>Thermal Noise Injection</h4>
              <button className={`glass-btn ${isDecohering ? 'danger' : ''}`} onClick={triggerNoise} disabled={isDecohering}>
                {isDecohering ? `⚠️ QUANTUM NOISE ACTIVE (${noiseTimer}s)` : "Apply Noise Pulse"}
              </button>
            </div>
          )}

          {mod.id === 'nocloning' && (
            <div className="interactive-panel">
              <h4>Copy Operation</h4>
              <button className={`glass-btn ${attemptCopy ? 'danger' : ''}`} onClick={() => { setAttemptCopy(true); setTimeout(() => setAttemptCopy(false), 4000); }} disabled={attemptCopy}>
                {attemptCopy ? "ERROR: QUANTUM COLLAPSE TRIGGERED" : "Execute Copy Sequence"}
              </button>
            </div>
          )}
        </>
      );
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
    zIndex: 10
  };

  return (
    <div className="app-container">
      <LiquidGlassEffects />

      {/* ── Unified Single 3D Universe Background (100vw x 100vh) ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', willChange: 'transform', transform: 'translateZ(0)' }}>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ powerPreference: 'high-performance', alpha: true }}
        >
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <ambientLight intensity={0.4} />
          <pointLight position={[-15, 10, 10]} color="#38bdf8" intensity={2.5} distance={45} />
          <pointLight position={[15, -10, 10]} color="#c084fc" intensity={2.5} distance={45} />
          <Stars radius={100} depth={50} count={2200} factor={4} saturation={1} fade speed={1.2} />
          <OrbitControls autoRotate autoRotateSpeed={0.3} enableZoom={false} enablePan={false} enableRotate={false} />
        </Canvas>
      </div>

      <main className="main-content">
        {/* ── Sidebar Column ── */}
        <div className="sidebar-wrapper">
          <div className={`sidebar-panel lg-pane ${isSidebarOpen ? '' : 'collapsed'}`}>
            <div className="sidebar-branding">
              <img src="/logo.jpg" alt="Logo" />
              <div className="sidebar-branding-text">
                <span className="sidebar-branding-title">QASS</span>
                <span className="sidebar-branding-tag">Interactive Suite</span>
              </div>
            </div>

            <div className="sidebar-scrollable-content">
              {learningMode === 'beginner' ? (
                curriculumData.map((mod) => {
                  const isActive = activeModuleId === mod.id;
                  const accent = mod.accent || '#38bdf8';
                  return (
                    <div 
                      key={mod.id} 
                      className={`glass-chip-group ${isActive ? 'active' : ''}`}
                      style={{ '--module-accent': accent }}
                    >
                      <button
                        type="button"
                        className="glass-chip"
                        aria-label={mod.title}
                        aria-pressed={isActive}
                        title={isSidebarOpen ? undefined : mod.title}
                        onClick={() => setActiveModuleId(isActive ? null : mod.id)}
                      >
                        <div className="chip-indicator" />
                        <div className="chip-content-wrap">
                          <div 
                            className="chip-icon" 
                            style={{ color: isActive ? accent : 'rgba(255, 255, 255, 0.75)' }}
                          >
                            <QuantumModuleIcon
                              moduleId={mod.id}
                              isActive={isActive}
                              color={isActive ? accent : 'rgba(255, 255, 255, 0.75)'}
                              size={isSidebarOpen ? 20 : 22}
                            />
                          </div>
                          {isSidebarOpen && <span className="chip-title">{mod.title}</span>}
                        </div>
                      </button>
                      <div className={`chip-content-drawer ${isActive && isSidebarOpen ? 'open' : ''}`}>
                        <div className="drawer-inner">
                          <div className="drawer-content-wrapper">
                            {isActive && isSidebarOpen && renderModuleContent(mod)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="sidebar-badge sidebar-advanced-placeholder"
                  title={isSidebarOpen ? undefined : 'Advanced Sandbox Loading...'}
                >
                  {isSidebarOpen ? 'Advanced Sandbox Loading...' : (
                    <>
                      {/* The collapsed sidebar is too narrow for the text: show the
                          Advanced tab's icon, keeping the words for screen readers. */}
                      <MorphIcon icon={Atom} spring="smooth" strokeWidth={1.8} size={22} color="currentColor" />
                      <span className="visually-hidden">Advanced Sandbox Loading...</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            className="sidebar-toggle-btn lg-pane"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={isSidebarOpen}
          >
            <MorphSidebarTabIcon isCollapsed={!isSidebarOpen} size={16} color="#ffffff" />
          </button>
        </div>

        {/* ── Right Content & 3D Canvas (flex-grow: 1, naturally centered) ── */}
        <div className="canvas-container">

          {/* Floating chrome sits above every module's overlay layer (those use
              uiBoundsStyle's z-index 10 too, and render later in the DOM). */}
          <div style={{ ...uiBoundsStyle, zIndex: 40 }}>
            {/* Liquid Glass tab bar: learning mode tabs + standalone audio circle */}
            <GlassNavBar
              ariaLabel="Learning mode"
              tabs={LEARNING_MODE_TABS}
              selectedIndex={learningMode === 'advanced' ? 1 : 0}
              onSelect={(index) => setLearningMode(LEARNING_MODE_TABS[index].key)}
              standalone={{
                label: isGlobalMuted ? 'Unmute Audio' : 'Mute Audio',
                active: !isGlobalMuted,
                onClick: handleToggleGlobalAudio,
                icon: <MorphAudioIcon isMuted={isGlobalMuted} size={22} color="currentColor" />,
              }}
            />

            {activeModuleId && activeModuleId !== 'superposition' && activeModuleId !== 'dirac-notation' && activeModuleId !== 'multi-qubit-gates' && activeModuleId !== 'interference' && activeModuleId !== 'entanglement' && activeModuleId !== 'exponential' && activeModuleId !== 'nocloning' && activeModuleId !== 'decoherence' && activeModuleId !== 'error-correction' && (
              <div style={{ position: 'absolute', top: '80px', left: '50%', width: '0px', display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
                <div className="section-title classical" style={{ position: 'absolute', left: '-39vh', transform: 'translateX(-50%)' }}>
                  <div className="section-title-dot" />
                  <span>CLASSICAL PHYSICS</span>
                </div>
                <div className="section-title quantum" style={{ position: 'absolute', left: '39vh', transform: 'translateX(-50%)' }}>
                  <div className="section-title-dot" />
                  <span>QUANTUM PHYSICS</span>
                </div>
              </div>
            )}
          </div>

          <ModuleErrorBoundary
            key={activeModuleId || 'hub'}
            moduleTitle={curriculumData.find(m => m.id === activeModuleId)?.title}
            boundsStyle={uiBoundsStyle}
            onRetry={() => window.location.reload()}
            onBackToHub={() => setActiveModuleId(null)}
          >
          <Suspense fallback={null}>
          {activeModuleId === 'gates' ? (
            <GatesModuleView
              step={gatesStep}
              applied={gateApplied}
              theme={theme}
              isSidebarOpen={isSidebarOpen}
              uiBoundsStyle={uiBoundsStyle}
              onToggleApply={() => {
                if (!gateApplied) {
                  setGateApplied(true);
                  gatesAudio.playGateSequence(GATES_STEPS[gatesStep].id, 2.0);
                } else {
                  setGateApplied(false);
                  gatesAudio.playGateSequence('reset');
                }
              }}
              onNext={() => {
                setGatesStep(s => Math.min(s + 1, GATES_STEPS.length - 1));
                setGateApplied(false);
              }}
              onPrev={() => {
                setGatesStep(s => Math.max(s - 1, 0));
                setGateApplied(false);
              }}
            />
          ) : activeModuleId === 'multi-qubit-gates' ? (
            <>
              <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, 15], fov: 45 }}
                gl={{ powerPreference: 'high-performance', alpha: true, antialias: true }}
                style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
              >
                <CameraShifter isSidebarOpen={isSidebarOpen} />
                <OrbitControls makeDefault enableZoom={true} enablePan={true} />
                <MultiGatesScene
                  step={multiGatesStep}
                  applied={multiGateApplied}
                  theme={theme}
                  inputs={multiGatesInputs}
                />
              </Canvas>
              <div style={uiBoundsStyle}>
                <MultiGatesOverlay
                  step={multiGatesStep}
                  setStep={setMultiGatesStep}
                  applied={multiGateApplied}
                  setApplied={setMultiGateApplied}
                  theme={theme}
                  inputs={multiGatesInputs}
                  setInputs={setMultiGatesInputs}
                  onToggleApply={() => {
                    if (!multiGateApplied) {
                      setMultiGateApplied(true);
                      const stepData = MULTI_GATES_STEPS[multiGatesStep];
                      const gateId = stepData.id;
                      const inputs = multiGatesInputs;
                      const isEntangled = isResultEntangled(gateId, inputs);
                      if (isEntangled) {
                         gatesAudio.playEntanglement();
                      } else if (gateId === 'cnot') {
                         if (inputs[0] === '1') gatesAudio.playConditionalFire();
                         else gatesAudio.playFizzle();
                      } else if (gateId === 'cz') {
                         if (inputs[0] === '1' && inputs[1] === '1') gatesAudio.playConditionalFire();
                         else gatesAudio.playFizzle();
                      } else if (gateId === 'toffoli') {
                         gatesAudio.playToffoliKey(0);
                         setTimeout(() => gatesAudio.playToffoliKey(1), 500);
                         if (inputs[0] === '1' && inputs[1] === '1') {
                           setTimeout(() => gatesAudio.playToffoliKey(2), 1000);
                         } else {
                           setTimeout(() => gatesAudio.playFizzle(), 1000);
                         }
                      } else if (gateId === 'swap') {
                         gatesAudio.playGateSequence('pauli-x');
                      }
                    } else {
                      setMultiGateApplied(false);
                      gatesAudio.playGateSequence('reset');
                    }
                  }}
                  onNext={() => {
                    setMultiGatesStep(s => {
                      const next = Math.min(s + 1, MULTI_GATES_STEPS.length - 1);
                      setMultiGatesInputs(Array(MULTI_GATES_STEPS[next].numQubits).fill('0'));
                      return next;
                    });
                    setMultiGateApplied(false);
                  }}
                  onPrev={() => {
                    setMultiGatesStep(s => {
                      const prev = Math.max(s - 1, 0);
                      setMultiGatesInputs(Array(MULTI_GATES_STEPS[prev].numQubits).fill('0'));
                      return prev;
                    });
                    setMultiGateApplied(false);
                  }}
                />
              </div>
            </>
          ) : activeModuleId === 'dirac-notation' ? (
            <>
              <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [4, 3, 8], fov: 50 }}
                gl={{ powerPreference: 'high-performance', alpha: true, antialias: true }}
                style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
              >
                <CameraShifter isSidebarOpen={isSidebarOpen} />
                <DiracScene step={diracStep} theme={theme} />
              </Canvas>
              <div style={uiBoundsStyle}>
                <DiracOverlay
                  step={diracStep}
                  theme={theme}
                  onNext={() => setDiracStep(s => Math.min(s + 1, 3))}
                  onPrev={() => setDiracStep(s => Math.max(s - 1, 0))}
                />
              </div>
            </>
          ) : activeModuleId === 'interference' ? (
            <InterferenceModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />
          ) : activeModuleId === 'entanglement' ? (
            <EntanglementModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />
          ) : activeModuleId === 'exponential' ? (
            <ExponentialModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />
          ) : activeModuleId === 'nocloning' ? (
            <NoCloningModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />
          ) : activeModuleId === 'decoherence' ? (
            <DecoherenceModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} onNavigateToModule={(moduleId) => setActiveModuleId(moduleId)} />
          ) : activeModuleId === 'error-correction' ? (
            <QuantumErrorCorrectionModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />
          ) : (
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 13], fov: 45 }}
              gl={{ powerPreference: 'high-performance', alpha: true, antialias: true }}
              style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
            >
              <CameraShifter isSidebarOpen={isSidebarOpen} />
              <BlochSphere
                theme={theme}
                activeModule={activeModuleId}
                qubitCount={qubitCount}
                isDecohering={isDecohering}
                attemptCopy={attemptCopy}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                isGlobalMuted={isGlobalMuted}
              />
            </Canvas>
          )}
          </Suspense>
          </ModuleErrorBoundary>

          {!activeModuleId && (
            <div style={uiBoundsStyle}>
              {/* Welcoming Headline + Call-to-Action */}
              <div style={{
                position: 'absolute', top: '130px', left: '0', right: '0',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: 'idleFadeIn 1s ease-out 0.4s both', pointerEvents: 'none',
                zIndex: 100
              }}>
                <h1 style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', textShadow: theme === 'light' ? '0 2px 10px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.5)', margin: '0 0 16px 0', fontFamily: "'Deltha', 'Inter', sans-serif", letterSpacing: '0.8px' }}>Where do you want to start today?</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0ea5e9', fontWeight: 600, fontSize: '16px', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                  <span style={{ animation: 'pulseHint 2s infinite ease-in-out' }}>◀</span>
                  <span>Pick a concept to explore</span>
                </div>
                {/* Contextual Smart Default CTA */}
                <div style={{ marginTop: '24px', pointerEvents: 'auto' }}>
                  <div
                    className="idle-hud-cta glass-interactive"
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveModuleId(lastClosedModuleId || 'bit-vs-qubit')}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                      e.preventDefault();
                      setActiveModuleId(lastClosedModuleId || 'bit-vs-qubit');
                    }}
                  >
                    <MorphIcon icon={Compass} spring="smooth" strokeWidth={1.5} size={16} color="#38bdf8" />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13.5px', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                      {lastClosedModuleId ? `Continue: ${curriculumData.find(m => m.id === lastClosedModuleId)?.title}` : 'New here? Start with Classical Bit vs Qubit'}
                    </span>
                    {lastClosedModuleId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLastClosedModuleId(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 2px 0 6px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        title="Dismiss"
                        aria-label="Dismiss"
                      >×</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Fact Ticker */}
              <div className={`idle-fact-ticker glass-interactive ${isFactFading ? 'fading' : ''}`}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.4px', color: 'var(--text-tertiary)', marginBottom: '10px', fontWeight: 800, fontFamily: "'Deltha', 'Inter', sans-serif" }}>Did You Know?</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '16px', minHeight: '42px', fontWeight: 500, fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                  {IDLE_FACTS[idleFactIdx].text}
                </div>
                <button
                  type="button"
                  className="fact-jump-link"
                  onClick={() => setActiveModuleId(IDLE_FACTS[idleFactIdx].moduleId)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#38bdf8', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s ease', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#7dd3fc'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#38bdf8'}
                >
                  <span>Jump to {curriculumData.find(m => m.id === IDLE_FACTS[idleFactIdx].moduleId)?.title.split(' ')[0]}</span>
                  <MorphIcon icon={ArrowRight} spring="smooth" strokeWidth={1} size={14} color="#38bdf8" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );


}

export default App;