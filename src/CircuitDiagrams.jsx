import React, { useState, useEffect, useRef } from 'react';
import { MULTI_GATES_STEPS } from './MultiQubitGates';
import { InlineMath } from './KatexMath';

// The circuit diagram each module shows in the sidebar ("Circuit Diagram"),
// with its step-by-step flow. ModuleSidebarContent.jsx renders CircuitVisualizer.

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
      { text: <>H gives <InlineMath math={String.raw`|0\rangle`} /> and <InlineMath math={String.raw`|1\rangle`} /> equal amplitudes, <InlineMath math={String.raw`1/\sqrt{2}`} /> each: a 50% chance of each.</> },
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
      { text: 'Measured, each qubit gives a random bit, and the two bits always agree.' },
    ],
  },
  exponential: {
    title: '📈 Exponential State Space Scaling',
    steps: [
      { text: <>H on every qubit turns <InlineMath math={String.raw`|0\dots0\rangle`} /> into an equal superposition of all <InlineMath math={String.raw`2^N`} /> basis states.</> },
      { text: 'Each qubit you add doubles the number of amplitudes the state vector holds.' },
      { text: 'A measurement still returns a single N-bit answer: any speed-up has to come from interference.' },
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
      { text: <>CNOTs copy the parities <InlineMath math={String.raw`D_1 \oplus D_2`} /> and <InlineMath math={String.raw`D_2 \oplus D_3`} /> onto two ancillas, never a data qubit&apos;s own value.</> },
      { text: <>Measuring the ancillas reads the syndrome; α and β in <InlineMath math={String.raw`\alpha|000\rangle + \beta|111\rangle`} /> stay untouched.</> },
      { text: 'The syndrome names the flipped qubit, and an X on it restores the code.' },
    ],
  },
};

// ==========================================
// INTEGRATED NON-OVERLAPPING STEP GUIDE
// ==========================================
// The clickable parts of a circuit (a gate, an input) work from the keyboard
// too: Tab reaches them, Enter or Space presses them, and screen readers hear
// what pressing does.
const pressable = (onPress, label) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onPress,
  onKeyDown: (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onPress();
  },
});

const LiquidCircuitStepGuide = ({ tip }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  if (!tip) return null;

  return (
    <div className="circuit-steps-panel">
      <button
        type="button"
        className="circuit-steps-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        title="Click to toggle step-by-step flow"
      >
        <span className="circuit-steps-title">
          <span className="circuit-steps-pulse" />
          {tip.title}
        </span>
        <span className="circuit-steps-chevron" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} aria-hidden="true">
          ▼
        </span>
      </button>

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
            {...pressable(() => setCBit(b => 1 - b), `Input bit ${cBit}: flip it`)}
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
              {...pressable(() => setCBit(b => 1 - b), 'Classical NOT gate: flip the bit')}
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
            {...pressable(() => setQBit(b => 1 - b), `Input qubit |${qBit}⟩: switch it`)}
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
              {...pressable(() => setQBit(b => 1 - b), 'Hadamard gate: switch the input qubit')}
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
          {...pressable(() => setIsBraMode(!isBraMode), isBraMode ? 'Bra: switch to the ket' : 'Ket: switch to the bra')}
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
            {...pressable(() => setIsBraMode(!isBraMode), 'Vector decomposition: switch between ket and bra')}
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
            {...pressable(handleMeasure, measured !== null ? 'Reset the measurement' : 'Measure the qubit')}
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
            {...pressable(() => setPhasePi(!phasePi), `Phase shift ${phasePi ? 'π' : '0'}: switch it`)}
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
          {measuredPair && <div className="circuit-state-label" style={{ right: 0, color: '#f43f5e' }}>{`|${measuredPair[0]}⟩`}</div>}
        </div>

        <div className="liquid-multi-row">
          <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|0\rangle_B`} /></div>
          <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.5s' }} /></div>
          <div className="liquid-multi-gate-col" style={{ left: '68%' }}>
            <div className="liquid-target-xor" />
          </div>
          {measuredPair && <div className="circuit-state-label" style={{ right: 0, color: '#f43f5e' }}>{`|${measuredPair[1]}⟩`}</div>}
        </div>

        <div className="liquid-v-line bell-line" style={{ top: '30px', height: '60px', left: '68%' }} />
        {/* |Φ+⟩ is the pair's state: one label across both wires, not one per qubit. */}
        {!measuredPair && <div className="circuit-state-label" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', color: '#f43f5e' }}><InlineMath math={String.raw`|\Phi^+\rangle`} /></div>}
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
const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

// The register as the module has it: `qubits` (1 to 5) and whether H has been
// applied to every qubit.
const ExponentialLiquidCircuit = ({ tooltipData, qubits = 1, superposed = false }) => {
  const tip = tooltipData['exponential'];
  const states = 2 ** qubits;
  const zeros = '0'.repeat(qubits);
  const label = (i) => i.toString(2).padStart(qubits, '0');
  // 1/sqrt(2^N), written as a whole number when N is even.
  const norm = qubits % 2 === 0 ? `\\frac{1}{${2 ** (qubits / 2)}}` : `\\frac{1}{\\sqrt{${states}}}`;
  const terms = states <= 4
    ? Array.from({ length: states }, (_, i) => `|${label(i)}\\rangle`).join(' + ')
    : `|${label(0)}\\rangle + |${label(1)}\\rangle + \\dots + |${label(states - 1)}\\rangle`;
  const ket = superposed ? `|\\psi\\rangle = ${norm}(${terms})` : `|\\psi\\rangle = |${zeros}\\rangle`;

  return (
    <div className="glass-card" style={{ padding: '20px 14px', position: 'relative' }}>
      <div className="liquid-multi-circuit" style={{ gap: '8px' }}>
        {Array.from({ length: qubits }, (_, idx) => (
          <div key={idx} className="liquid-multi-row" style={{ height: '38px' }}>
            <div className="circuit-state-label" style={{ left: 0, fontSize: '12px' }}>
              <InlineMath math={`|0\\rangle_{q_${idx}}`} />
            </div>
            <div className="qubit-wire-timeline" style={{ top: '50%' }}>
              <div className="wire-flow-indicator" style={{ animationDelay: `${idx * 0.3}s` }} />
            </div>
            {superposed && (
              <div className="liquid-multi-gate-col">
                <div className="liquid-gate-box liquid-gate-h" style={{ width: '30px', height: '30px', fontSize: '13px', zIndex: 12 }}>H</div>
              </div>
            )}
            <div className="circuit-state-label" style={{ right: 0, fontSize: '12px', color: superposed ? '#a855f7' : undefined }}>
              <InlineMath math={superposed ? String.raw`|+\rangle` : String.raw`|0\rangle`} />
            </div>
          </div>
        ))}
      </div>

      <div className="liquid-exp-summary">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#a855f7', fontSize: '12px' }}>
            {qubits} {qubits === 1 ? 'Qubit' : 'Qubits'} = 2{SUPERSCRIPT[qubits]} Basis States
          </span>
          <span className="liquid-badge-accent">{superposed ? `${states} amplitudes, all equal` : `1 of ${states} basis states`}</span>
        </div>
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#cbd5e1' }}>
          <InlineMath math={ket} />
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
            <InlineMath math={String.raw`|0\rangle`} /> <span style={{ fontSize: '10px', color: '#8a9ab0' }}>Anc</span>
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
            {...pressable(handlePulseNoise, 'Noise channel: inject a noise pulse')}
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
          <span>Phase coherence (decays over T₂)</span>
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
  // The three-qubit bit-flip code, as the module plays it: |ψ⟩ is spread over three data
  // qubits (α|000⟩ + β|111⟩); two ancillas pick up the parities D1⊕D2 and D2⊕D3, never a
  // data qubit's own value, so measuring them leaves α and β alone.
  const [errorOn, setErrorOn] = useState(0); // 0: no error, 1-3: the data qubit that flips
  const tip = tooltipData['error-correction'];
  const s1 = errorOn === 1 || errorOn === 2 ? 1 : 0;
  const s2 = errorOn === 2 || errorOn === 3 ? 1 : 0;
  const ROW = 34, GAP = 6, PITCH = ROW + GAP;
  const center = (r) => ROW / 2 + r * PITCH;
  // Each check: two CNOTs, from a data qubit (row) onto an ancilla (row 3 or 4).
  const cnots = [[0, 3, 35], [1, 3, 46], [1, 4, 57], [2, 4, 68]];
  const rows = ['D_1', 'D_2', 'D_3', String.raw`|0\rangle_{A_1}`, String.raw`|0\rangle_{A_2}`];
  const next = () => setErrorOn((e) => (e + 1) % 4);
  const gate = { width: '26px', height: '26px', fontSize: '10px', zIndex: 12 };

  return (
    <div className="glass-card" style={{ padding: '20px 14px', position: 'relative' }}>
      <div className="liquid-multi-circuit" style={{ gap: `${GAP}px` }}>
        {rows.map((label, r) => (
          <div key={r} className="liquid-multi-row" style={{ height: `${ROW}px` }}>
            <div className="circuit-state-label" style={{ left: 0, fontSize: '11px', color: r < 3 ? '#6366f1' : '#94a3b8' }}>
              <InlineMath math={label} />
            </div>
            <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: `${r * 0.2}s` }} /></div>
            {r < 3 && (
              <div className="liquid-multi-gate-col" style={{ left: '24%' }}>
                <div
                  className={`liquid-gate-box ${errorOn === r + 1 ? 'liquid-gate-x' : ''}`}
                  {...pressable(next, errorOn === r + 1 ? `Error channel on D${r + 1}: flipped. Press to move the error on` : `Error channel on D${r + 1}: no error. Press to move the error on`)}
                  style={{ ...gate, cursor: 'pointer', opacity: errorOn === r + 1 ? 1 : 0.45 }}
                  title="Error channel (click to move the bit-flip)"
                >
                  {errorOn === r + 1 ? 'X' : 'I'}
                </div>
              </div>
            )}
            {cnots.map(([c, t, left]) => (r === c || r === t) && (
              <div key={left} className="liquid-multi-gate-col" style={{ left: `${left}%` }}>
                {r === c ? <div className="liquid-control-dot" style={{ width: '12px', height: '12px' }} /> : <div className="liquid-target-xor" style={{ width: '18px', height: '18px' }} />}
              </div>
            ))}
            {r >= 3 && (
              <div className="liquid-multi-gate-col" style={{ left: '78%' }}>
                <div className="measurement-dial-btn active" style={{ width: '24px', height: '24px' }}>
                  <div className="measurement-dial-icon" style={{ width: '12px', height: '12px' }} />
                </div>
              </div>
            )}
            {r < 3 && errorOn === r + 1 && (
              <div className="liquid-multi-gate-col" style={{ left: '78%' }}>
                <div className="liquid-gate-box liquid-gate-x" style={gate} title="Correction, chosen by the syndrome">X</div>
              </div>
            )}
            {r >= 3 && (
              <div className="circuit-state-label" style={{ right: 0, fontSize: '11px', color: (r === 3 ? s1 : s2) ? '#f59e0b' : '#8a9ab0' }}>
                {r === 3 ? `s₁=${s1}` : `s₂=${s2}`}
              </div>
            )}
          </div>
        ))}
        {cnots.map(([c, t, left]) => (
          <div key={left} className="liquid-v-line" style={{ top: `${center(c)}px`, height: `${center(t) - center(c) - 9}px`, left: `${left}%` }} />
        ))}
      </div>

      <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '11.5px', color: '#94a3b8' }}>
        <InlineMath math={String.raw`s_1 = D_1 \oplus D_2,\; s_2 = D_2 \oplus D_3`} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px' }}>
        <span style={{ fontSize: '11.5px', color: '#94a3b8' }} aria-live="polite">
          {errorOn ? `⚡ Syndrome ${s1}${s2} → flip D${errorOn} back` : '✓ Syndrome 00 → no error, nothing to do'}
        </span>
        <button className="liquid-mini-btn" onClick={next}>
          {errorOn === 3 ? 'Clear Error' : `⚡ Error on D${errorOn + 1}`}
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
    't-gate': { name: 'T', symbol: 'T', class: 'liquid-gate-t', init: <InlineMath math={String.raw`|+\rangle`} />, out: <InlineMath math={String.raw`\tfrac{|0\rangle + e^{i\pi/4}|1\rangle}{\sqrt{2}}`} />, axis: 'Z', angle: '45°' },
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
            {...(gateId === 'pauli-x' ? pressable(() => setXStyle(s => s === 'box' ? 'plus' : 'box'), 'X gate: switch between the box and ⊕ notation') : {})}
            style={progress > 0.1 && progress < 0.9 ? { filter: 'brightness(1.5) drop-shadow(0 0 10px rgba(255,255,255,0.8))', transform: 'scale(1.1)' } : {}}
            title="Click gate to toggle notation (X ↔ ⊕)"
          >
            {gateProps.symbol}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2, justifyContent: 'flex-end' }}>
          <div 
            className={`measurement-dial-btn ${measureActive ? 'active' : ''}`}
            {...pressable(() => setMeasureActive(!measureActive), measureActive ? 'Hide the measurement' : 'Measure the output')}
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
              <div className="circuit-state-label" style={{ right: 0 }}><InlineMath math={String.raw`Z^{C}|T\rangle`} /></div>
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
            </div>
            <div className="liquid-multi-row">
              <div className="circuit-state-label" style={{ left: 0 }}><InlineMath math={String.raw`|0\rangle`} /></div>
              <div className="qubit-wire-timeline"><div className="wire-flow-indicator" style={{ animationDelay: '0.5s' }} /></div>
              <div className="liquid-multi-gate-col" style={{ left: '65%' }}>
                <div className="liquid-target-xor" />
              </div>
            </div>
            <div className="liquid-v-line bell-line" style={{ top: '30px', height: '60px', left: '65%' }} />
            {/* The pair's joint state, labelled once across both wires. */}
            <div className="circuit-state-label" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}><InlineMath math={String.raw`|\Phi^+\rangle`} /></div>
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
export const CircuitVisualizer = ({ moduleId, gateId, multiGatesStep = 0, register }) => {
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
      return <ExponentialLiquidCircuit tooltipData={tooltipData} qubits={register?.qubits} superposed={register?.superposed} />;
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
