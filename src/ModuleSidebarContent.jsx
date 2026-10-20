import React, { useId } from 'react';
import { BlockMath, InlineMath } from './KatexMath';
import { MorphCircuitToggleIcon } from './QuantumMorphIcons';
import { CircuitVisualizer } from './CircuitDiagrams';
import { GATES_STEPS } from './QuantumGates';
import { MULTI_GATES_STEPS } from './MultiQubitGates';

/*
 * The open module's page in the sidebar. Most modules show the curriculum's
 * four cards (curriculum.jsx) and their circuit; Classical vs Quantum Gates and
 * Multi Qubit Gates show the cards of the gate on stage instead, with the
 * row and matrix column for the current input lit once the gate has been
 * applied (`synced`, which waits for the 3D animation).
 */

// Lights the matrix column that the input state picks out (column index =
// basis-state index), so the reader sees which column produced the output.
export function getHighlightedMatrix(matrixStr, inputIndex, color, isSynced) {
  if (!isSynced || !matrixStr.includes('\\begin{bmatrix}')) return matrixStr;

  // Extract everything between \begin{bmatrix} and \end{bmatrix}
  const match = matrixStr.match(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/s);
  if (!match) return matrixStr;

  const rows = match[1].split('\\\\').map(row => row.split('&').map(cell => cell.trim()));

  const highlightedRows = rows.map(row => {
    return row.map((cell, colIndex) => {
      if (colIndex === inputIndex && cell !== '0') {
        return `\\textcolor{${color}}{${cell}}`;
      }
      return cell;
    }).join(' & ');
  }).join(' \\\\ ');

  return matrixStr.replace(match[1], ` ${highlightedRows} `);
}

// The "Circuit Diagram" card: a button that opens and closes the module's circuit.
function CircuitCard({ open, onToggle, children }) {
  const contentId = useId();
  return (
    <div className="circuit-diagram-card">
      <button
        type="button"
        className="circuit-header"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
      >
        <span className="pillar-label">Circuit Diagram</span>
        <span className={`circuit-toggle-icon ${open ? 'open' : ''}`} aria-hidden="true">
          <MorphCircuitToggleIcon isOpen={open} size={14} color="currentColor" />
        </span>
      </button>
      {open && (
        <div className="circuit-content" id={contentId}>
          {children}
        </div>
      )}
    </div>
  );
}

// One gate's page: its definition, its state mappings (the current input's row
// lit), the classical comparison, its matrix and circuit, and why it matters.
function GatePage({ step, activeIn, inputIdx, synced, showCircuit, onToggleCircuit, circuit }) {
  return (
    <div className="multi-gates-sidebar stagger-enter" style={{ '--gate-accent-color': step.color }}>
      <div className="sidebar-title-wrapper">
        <h3 style={{ marginTop: '-5px', fontSize: '18px', fontWeight: '700' }}>
          {step.title}
        </h3>
        <div className="title-underline-sweep" />
      </div>

      <div className="data-card">
        <span className="pillar-label">1-Line Definition</span>
        <p className="pillar-text">{step.definition}</p>
      </div>

      <div className="data-card">
        <span className="pillar-label">Deep Understanding</span>
        <p className="pillar-text">{step.understanding}</p>
      </div>

      {step.stateMapping && (
        <div className="data-card">
          <span className="pillar-label">State Mappings</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {step.stateMapping.map((map, i) => {
              let rowClass = 'mapping-row';
              if (synced) rowClass += map.in === activeIn ? ' active' : ' dimmed';
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
        <p className="pillar-text" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{step.comparison}"</p>
      </div>

      <div className="data-card">
        <span className="pillar-label">Quantum Unitary Matrix</span>
        <div className="math-box-fluid">
          <BlockMath math={getHighlightedMatrix(step.math, inputIdx, step.color, synced)} />
        </div>
      </div>

      <CircuitCard open={showCircuit} onToggle={onToggleCircuit}>{circuit}</CircuitCard>

      <div className="data-card" style={{ borderLeft: `3px solid var(--gate-accent-color)`, paddingLeft: '12px' }}>
        <span className="pillar-label" style={{ color: 'var(--gate-accent-color)' }}>Why Quantum Needs This</span>
        <p className="pillar-text">{step.reversibility}</p>
      </div>
    </div>
  );
}

// Any other module: the curriculum's cards and the module's circuit.
function ModuleCards({ mod, showCircuit, onToggleCircuit, circuit }) {
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
      <CircuitCard open={showCircuit} onToggle={onToggleCircuit}>{circuit}</CircuitCard>
      <div className="data-card" style={{ borderLeft: '3px solid #ef4444', paddingLeft: '12px' }}>
        <span className="pillar-label" style={{ color: '#ef4444' }}>Common Misconception</span>
        <p className="pillar-text">{mod.misconception}</p>
      </div>
    </>
  );
}

/**
 * The page for module `mod`. `gatesStep` / `multiGatesStep` and
 * `multiGatesInputs` say which gate (and input) the two gate modules show;
 * `expRegister` is Exponential State Space's register, for its circuit.
 */
export default function ModuleSidebarContent({ mod, gatesStep, multiGatesStep, multiGatesInputs, synced, showCircuit, onToggleCircuit, expRegister }) {
  if (mod.id === 'gates') {
    const step = GATES_STEPS[gatesStep];
    return (
      <GatePage
        key={gatesStep}
        step={step}
        activeIn={step.startsAtPlus ? '|+\\rangle' : '|0\\rangle'}
        inputIdx={step.startsAtPlus ? -1 : 0}
        synced={synced}
        showCircuit={showCircuit}
        onToggleCircuit={onToggleCircuit}
        circuit={<CircuitVisualizer moduleId={mod.id} gateId={step.id} />}
      />
    );
  }
  if (mod.id === 'multi-qubit-gates') {
    const step = MULTI_GATES_STEPS[multiGatesStep];
    const input = multiGatesInputs.slice(0, step.numQubits).join('');
    return (
      <GatePage
        key={multiGatesStep}
        step={step}
        activeIn={`|${input}\\rangle`}
        inputIdx={input.includes('+') ? -1 : parseInt(input, 2)}
        synced={synced}
        showCircuit={showCircuit}
        onToggleCircuit={onToggleCircuit}
        circuit={<CircuitVisualizer moduleId={mod.id} gateId={step.id} multiGatesStep={multiGatesStep} />}
      />
    );
  }
  return (
    <ModuleCards
      mod={mod}
      showCircuit={showCircuit}
      onToggleCircuit={onToggleCircuit}
      circuit={<CircuitVisualizer moduleId={mod.id} multiGatesStep={multiGatesStep} register={expRegister} />}
    />
  );
}
