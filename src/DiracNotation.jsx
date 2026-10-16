import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createDiracStory } from './diracStory';
import { motionReduced } from './quality';

// ─── The four steps' captions ────────────────────────────────────────────────
// The 3D story (diracStory.js) does the explaining; one glass caption under it
// carries a sentence and the formula for each step.
const Z = ({ children }) => <span className="dirac-z">{children}</span>;
const O = ({ children }) => <span className="dirac-o">{children}</span>;
const P = ({ children }) => <span className="dirac-p">{children}</span>;
const Note = ({ children }) => <span className="dirac-note">{children}</span>;
const Col = ({ top, bottom }) => <span className="dirac-col"><span>{top}</span><span>{bottom}</span></span>;
const Row = ({ children }) => <span className="dirac-row">{children}</span>;

export const DIRAC_STEPS = [
  {
    title: 'The ket',
    accent: '#00f2fe',
    text: 'A ket, written | ⟩, holds a quantum state. Fold its two sides square and it becomes a column of two numbers: how much of |0⟩ and how much of |1⟩.',
    formula: <><Z>|0⟩</Z> = <Col top={<Z>1</Z>} bottom="0" /> <Note>all of it is |0⟩</Note></>,
  },
  {
    title: 'The ket |1⟩',
    accent: '#f093fb',
    text: 'Now all of the state moves to the bottom entry. |0⟩ and |1⟩ share nothing, so a qubit in |1⟩ never reads 0.',
    formula: <><O>|1⟩</O> = <Col top="0" bottom={<O>1</O>} /> <Note>⟨0|1⟩ = 0</Note></>,
  },
  {
    title: 'Superposition',
    accent: '#f7971e',
    text: 'A qubit can hold both at once. α and β are amplitudes, and the light in each slot is the chance of reading that result: |α|² and |β|². The column is just α of |0⟩ plus β of |1⟩.',
    formula: <><P>|ψ⟩</P> = <Z>α</Z>|0⟩ + <O>β</O>|1⟩ = <Col top={<Z>α</Z>} bottom={<O>β</O>} /> <Note>α = β ≈ 0.71 → 50% each</Note></>,
  },
  {
    title: 'The bra ⟨ψ|',
    accent: '#43e97b',
    text: 'Mirror a ket and flip its phases (the complex conjugate, *) and you get the bra ⟨ψ|, a row. Joined bar to bar, bra and ket make a bracket: the state compared with itself, which is always 1.',
    formula: <><P>⟨ψ|</P> = <Row><Z>α*</Z><O>β*</O></Row> <span className="dirac-gap" /> <P>⟨ψ|ψ⟩</P> = |α|² + |β|² = 1</>,
  },
];

// Replay is pressed in the caption (outside the canvas) and heard by the scene.
const replayListeners = new Set();
const requestReplay = () => replayListeners.forEach((fn) => fn());

// ─── The 3D scene ────────────────────────────────────────────────────────────
export function DiracScene({ step }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const story = useMemo(() => createDiracStory(gl), [gl]);
  const capFrac = useRef(0.25);
  const topFrac = useRef(0.08); // the header pills along the top
  const sinceMeasure = useRef(1);

  useEffect(() => {
    const prevEnv = scene.environment;
    scene.add(story.root);
    scene.environment = story.environment;
    // Lets a browser test hold any moment of any shot.
    window.__qassDiracSeek = (n, at) => story.seek(n, at);
    return () => {
      scene.remove(story.root);
      if (scene.environment === story.environment) scene.environment = prevEnv;
      if (window.__qassDiracSeek) delete window.__qassDiracSeek;
      story.dispose();
    };
  }, [scene, story]);

  useEffect(() => { story.goTo(step, motionReduced()); }, [story, step]);
  useEffect(() => {
    const replay = () => story.replay(motionReduced());
    replayListeners.add(replay);
    return () => replayListeners.delete(replay);
  }, [story]);

  useFrame((state, dt) => {
    // Where the caption's top is, now and then (it changes height between steps), and the header's bottom.
    sinceMeasure.current += dt;
    if (sinceMeasure.current > 0.25) {
      sinceMeasure.current = 0;
      const cap = document.querySelector('.dirac-caption');
      const h = state.gl.domElement.clientHeight || window.innerHeight;
      if (cap && h) {
        const box = cap.getBoundingClientRect();
        const canvasBox = state.gl.domElement.getBoundingClientRect();
        capFrac.current = Math.min(0.5, Math.max(0, (canvasBox.bottom - box.top) / h));
        topFrac.current = Math.min(0.2, 72 / h);
      }
    }
    story.frame(Math.min(dt, 0.05), state.clock.elapsedTime, state.camera, capFrac.current, topFrac.current, motionReduced());
  });

  return null;
}

// ─── The caption (rendered outside the canvas) ───────────────────────────────
export function DiracOverlay({ step, onNext, onPrev }) {
  const s = DIRAC_STEPS[step];
  const isLast = step === DIRAC_STEPS.length - 1;
  return (
    <section
      data-jelly
      className="dirac-caption glass-card"
      style={{ '--j': 0, '--tx': '-50%', '--dirac-accent': s.accent }}
      aria-label="Dirac notation"
      aria-live="polite"
    >
      <div className="dirac-cap-top">
        <span className="dirac-eyebrow">Step {step + 1} of {DIRAC_STEPS.length} · {s.title}</span>
        <span className="dirac-dots" aria-hidden="true">
          {DIRAC_STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />)}
        </span>
      </div>
      <div className="dirac-cap-body" key={step}>
        <p className="dirac-text">{s.text}</p>
        <div className="dirac-formula">{s.formula}</div>
      </div>
      <div className="dirac-controls">
        <button type="button" className="dirac-btn glass-btn glass-interactive" onClick={onPrev} disabled={step === 0}>Back</button>
        <button type="button" className="dirac-btn glass-btn glass-interactive" onClick={requestReplay}>Replay</button>
        <button type="button" className="dirac-btn dirac-btn-primary glass-btn glass-interactive" onClick={onNext}>{isLast ? 'Start over' : 'Next'}</button>
      </div>
    </section>
  );
}

export default DiracScene;
