import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createSuperpositionStory } from './superpositionStory';
import { InlineMath, BlockMath } from './KatexMath';
import { QuantumNavButtons } from './QuantumNavButtons';
import { useQuantumAudio } from './useQuantumAudio';
import { motionReduced } from './quality';

// Superposition & Measurement: the 3D scene (superpositionStory.js) and, outside the
// canvas, the module's four corner cards (each joined to the sphere by a dashed arrow),
// its Back / Next buttons and the hover hints. The two talk through `bus`.

const bus = {
  story: null,
  hover: null,
  lift: 0,
  listeners: new Set(),
  emit() { this.listeners.forEach((fn) => fn()); },
};

const NEXT = ['Apply Hadamard Gate', 'Enter Superposition', 'Observe State', '🎯 Measure State'];
const deg = (r) => Math.round((((r * 180) / Math.PI) % 360 + 360) % 360);
const f2 = (x) => x.toFixed(2);
const pct = (p) => `${Math.round(p * 100)}%`;

// ─── The 3D scene ────────────────────────────────────────────────────────────
export function SuperpositionScene() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const story = useMemo(() => createSuperpositionStory(gl, {
    onChange: () => bus.emit(),
    onHover: (h) => { bus.hover = h; bus.emit(); },
    onEvent: (kind) => { bus.event = { kind, at: performance.now() }; bus.emit(); },
  }), [gl]);

  useEffect(() => {
    const prevEnv = scene.environment;
    scene.add(story.root);
    scene.environment = story.environment;
    bus.story = story;
    bus.emit();
    // lets a browser test reach the scene
    window.__qassSuperposition = { story, camera: () => bus.camera };
    return () => {
      scene.remove(story.root);
      if (scene.environment === story.environment) scene.environment = prevEnv;
      if (bus.story === story) bus.story = null;
      if (window.__qassSuperposition?.story === story) delete window.__qassSuperposition;
      bus.hover = null;
      story.dispose();
    };
  }, [scene, story]);

  useFrame((state, dt) => {
    bus.camera = state.camera;
    story.frame(Math.min(dt, 0.05), state.camera, { reduced: motionReduced(), lift: bus.lift });
  });
  return null;
}

// ─── Hover hints: how to work with what is under the pointer ─────────────────
function hintFor(kind, step, done) {
  if (kind === 'pearl') return [
    ['Locked at |0⟩', 'Drag me away from |0⟩. Let go and I spring straight back: the ground state is rigid.', 'cyan'],
    ['The qubit', 'Drag me anywhere. Unlike the bit beside me, I can rest between |0⟩ and |1⟩.', 'purple'],
    ['Grab the state', 'Move me anywhere on the sphere. The gauges and the card show the amplitudes and the odds.', 'cyan'],
    done ? ['Collapsed', 'Tap again: the same answer every time. Prepare |ψ⟩ again in the card to start over.', 'red'] : ['Tap to measure', 'Observe the state: it must choose |0⟩ or |1⟩, with the odds shown in the card.', 'red'],
  ][step];
  if (kind === 'shell') return [
    ['Measure |0⟩', 'Tap the sphere to measure. The ground state reads 0 every time.', 'cyan'],
    ['Bloch sphere', 'Drag the glowing pearl, or tap the gold H to apply the gate again.', 'purple'],
    ['Bloch sphere', 'Grab the glowing pearl and move the state anywhere.', 'cyan'],
    done ? ['Collapsed', 'Tap again: the same answer every time. Prepare |ψ⟩ again in the card to start over.', 'red'] : ['Tap to measure', 'Click the sphere to force a measurement and collapse the state.', 'red'],
  ][step];
  if (kind === 'bead' || kind === 'capsule') return ['Classical bit', 'Drag the bead and let go halfway: it can’t stop there, it jumps to 0 or 1. Tap to flip it.', 'purple'];
  if (kind === 'h') return ['Hadamard gate', 'Tap to apply H again. H twice brings the qubit back: H·H = I.', 'gold'];
  if (kind === 'tube') return step === 2 ? ['Probability gauge', 'Each gauge fills to |amplitude|². The two always add up to 100%.', 'cyan'] : ['Results', 'Each measurement drops a pearl into the tube of its result.', 'cyan'];
  return null;
}

function Bar({ label, p, color }) {
  return (
    <div className="sp-bar">
      <span>{label}</span>
      <span className="sp-track"><span className="sp-fill" style={{ width: `${(p * 100).toFixed(1)}%`, background: color, boxShadow: `0 0 8px ${color}` }} /></span>
      <span className="sp-v">{pct(p)}</span>
    </div>
  );
}

function ketNow(s) {
  const a = Math.sqrt(1 - s.p1), b = Math.sqrt(s.p1);
  const phase = b > 0.005 && a > 0.005 ? `\\,e^{i\\,${deg(s.phi)}^\\circ}` : '';
  return `|\\psi\\rangle = ${f2(a)}\\,|0\\rangle + ${f2(b)}${phase}\\,|1\\rangle`;
}

// ─── The cards, arrows, buttons and hints (rendered outside the canvas) ──────
export function SuperpositionOverlay({ isGlobalMuted }) {
  const [, setTick] = useState(0);
  const [s, setS] = useState(null);
  const host = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const lineRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const dotRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const audio = useQuantumAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // the story's state: on every change, and ten times a second for the live numbers
  useEffect(() => {
    const read = () => { if (bus.story) setS(bus.story.state()); setTick((n) => n + 1); };
    bus.listeners.add(read);
    const iv = setInterval(read, 100);
    read();
    return () => { bus.listeners.delete(read); clearInterval(iv); };
  }, []);

  // sound: the ground state on arrival; a sound for each step, the gate and each measurement
  useEffect(() => {
    const a = audioRef.current;
    try { a.initAudio(); a.toggleMute(isGlobalMuted); a.playGroundState(); } catch { /* audio waits for a first interaction */ }
    return () => { try { a.stopCurrentAudio(); } catch { /* nothing playing */ } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { audioRef.current.toggleMute(isGlobalMuted); } catch { /* not started */ } }, [isGlobalMuted]);
  const lastEvent = useRef(null);
  useEffect(() => {
    const ev = bus.event;
    if (!ev || ev === lastEvent.current) return;
    lastEvent.current = ev;
    const a = audioRef.current;
    try { a.initAudio(); if (ev.kind === 'measure') a.playMeasurement(); if (ev.kind === 'h') a.playHadamard(); } catch { /* silent */ }
  });
  const stepNow = s?.step ?? 0;
  const prevStep = useRef(stepNow);
  useEffect(() => {
    if (prevStep.current === stepNow) return;
    prevStep.current = stepNow;
    const a = audioRef.current;
    try { a.initAudio(); if (stepNow === 2) a.playInfinitePossibilities(); if (stepNow === 3) a.playCollapseAnticipation(); } catch { /* silent */ }
  }, [stepNow]);

  // the arrows, from each shown card to the sphere's edge (and, on a narrow screen, how high the scene sits)
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const story = bus.story, h = host.current;
      if (!story || !h) return;
      const cam = bus.camera;
      const box = h.getBoundingClientRect();
      const narrow = box.width <= 760;
      const sphere = cam ? story.sphereOnScreen(cam) : null;
      cardRefs.forEach((ref, i) => {
        const line = lineRefs[i].current, dot = dotRefs[i].current, card = ref.current;
        if (!line || !dot) return;
        const show = card && !card.hidden && !narrow && sphere && sphere.visible;
        line.style.display = dot.style.display = show ? '' : 'none';
        if (!show) return;
        const b = card.getBoundingClientRect();
        const x1 = (i === 0 || i === 1 ? b.right + 6 : b.left - 6) - box.left;
        const y1 = (i === 0 || i === 2 ? b.bottom - 24 : b.top + 24) - box.top;
        const cx = sphere.x - box.left, cy = sphere.y - box.top;
        const dx = x1 - cx, dy = y1 - cy, d = Math.hypot(dx, dy) || 1;
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', cx + (dx / d) * (sphere.r + 14)); line.setAttribute('y2', cy + (dy / d) * (sphere.r + 14));
        dot.setAttribute('cx', x1); dot.setAttribute('cy', y1);
      });
      if (narrow) {
        const shown = cardRefs.map((r) => r.current).filter((c) => c && !c.hidden && !c.classList.contains('sp-prior'));
        const top = shown.length ? Math.min(...shown.map((c) => c.getBoundingClientRect().top)) : box.bottom - 120;
        bus.lift = Math.min(0.62, Math.max(0, (box.bottom - top + 40) / box.height));
      } else bus.lift = 0;
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); bus.lift = 0; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;
  const { step, collapsed } = s;
  const done = step === 3 && collapsed !== null;
  const shown = (i) => (done ? i === 3 : i <= step);
  const hover = bus.hover;
  const hint = hover ? hintFor(hover.kind, step, done) : null;
  const box = host.current?.getBoundingClientRect();
  const P0 = 1 - s.p1, q0 = 1 - s.prepared1, n3 = s.observed[0] + s.observed[1];

  const card = (i, pos, glow, children) => (
    <section
      ref={cardRefs[i]}
      className={`sp-card sp-${pos}${shown(i) && i < step && !done ? ' sp-prior' : ''}`}
      hidden={!shown(i)}
      aria-hidden={!shown(i)}
    >
      <div className={`glass-tooltip glass-tooltip-corner ${glow}`}>{children}</div>
    </section>
  );

  return (
    <div ref={host} className="sp-overlay">
      <svg className="sp-arrows" aria-hidden="true">
        <defs>
          <marker id="sp-ah-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00f2fe" /></marker>
          <marker id="sp-ah-purple" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#f093fb" /></marker>
          <marker id="sp-ah-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ff0844" /></marker>
        </defs>
        {['#00f2fe', '#f093fb', '#00f2fe', '#ff0844'].map((c, i) => (
          <g key={i}>
            <line ref={lineRefs[i]} stroke={c} markerEnd={`url(#sp-ah-${['cyan', 'purple', 'cyan', 'red'][i]})`} />
            <circle ref={dotRefs[i]} r="3" fill={c} />
          </g>
        ))}
      </svg>

      {card(0, 'tl', 'cyan-glow', (
        <>
          <h4>⚛️ The Ground State</h4>
          <p>A Quantum Bit begins here — locked at <InlineMath math={String.raw`|0\rangle`} />, identical to a classical zero. Rigid. Deterministic.</p>
          <div className="sp-eq"><BlockMath math={String.raw`|\psi\rangle = 1\,|0\rangle + 0\,|1\rangle = \begin{pmatrix}1\\0\end{pmatrix}`} /></div>
          <div className="sp-live">
            {s.pulling
              ? <span className="sp-r"><InlineMath math={String.raw`|\psi\rangle`} /> pulled away… it springs back to <InlineMath math={String.raw`|0\rangle`} /></span>
              : <>
                  <span><InlineMath math={String.raw`P(0) = |1|^2 = 100\%`} /></span>
                  <span className="sp-m">{s.ground[0] ? `measured ${s.ground[0]}× → 0 every time` : 'tap the sphere to measure'}</span>
                </>}
          </div>
        </>
      ))}

      {card(1, 'bl', 'purple-glow', (
        <>
          <h4>❌ Classical Limit</h4>
          <p>A classical bit can jump to <InlineMath math={String.raw`|1\rangle`} />, but it MUST travel instantly. It can never stop between 0 and 1. The Hadamard gate takes the qubit somewhere no bit can go.</p>
          <div className="sp-eq"><BlockMath math={String.raw`H|0\rangle = \tfrac{1}{\sqrt2}\begin{pmatrix}1&1\\1&-1\end{pmatrix}\begin{pmatrix}1\\0\end{pmatrix} = \tfrac{|0\rangle + |1\rangle}{\sqrt2}`} /></div>
          <div className="sp-live">
            <span>bit: {s.bitBetween ? <span className="sp-r"><InlineMath math={String.raw`b = \,?`} /> not allowed</span> : <InlineMath math={`b = ${s.bit}`} />}</span>
            <span>qubit: <InlineMath math={ketNow(s)} /></span>
          </div>
        </>
      ))}

      {card(2, 'tr', 'cyan-glow', (
        <>
          <h4>🌊 Infinite Possibilities</h4>
          <p>It is simultaneously <InlineMath math={String.raw`|0\rangle`} /> and <InlineMath math={String.raw`|1\rangle`} />! The vector sweeps the equator — a continuous wave of probability amplitudes.</p>
          <div className="sp-eq"><BlockMath math={String.raw`|\psi\rangle = \cos\tfrac{\theta}{2}\,|0\rangle + e^{i\varphi}\sin\tfrac{\theta}{2}\,|1\rangle`} /></div>
          <div className="sp-live">
            <span><InlineMath math={`\\theta = ${deg(s.theta)}^\\circ,\\; \\varphi = ${deg(s.phi)}^\\circ`} /></span>
            <span><InlineMath math={ketNow(s)} /></span>
            <Bar label={<InlineMath math="P(0)" />} p={P0} color="#00f2fe" />
            <Bar label={<InlineMath math="P(1)" />} p={s.p1} color="#f093fb" />
          </div>
        </>
      ))}

      {card(3, 'br', done ? (collapsed ? 'purple-glow' : 'cyan-glow') : 'red-glow', (
        <>
          <h4>{done ? '🎯 Wave Function Collapsed' : '🎯 Collapse: Your Turn'}</h4>
          {done
            ? <p>The observation forced the superposition to snap into a rigid state (either <InlineMath math={String.raw`|0\rangle`} /> or <InlineMath math={String.raw`|1\rangle`} />). The infinite possibilities are gone, leaving a single deterministic reality.</p>
            : <p>The quantum state holds every possibility at once... until observed. Click the sphere to force a measurement and collapse the wave function!</p>}
          <div className="sp-eq">
            {done
              ? <BlockMath math={`\\begin{aligned} |\\psi\\rangle &\\;\\longrightarrow\\; |${collapsed}\\rangle \\\\ P(${collapsed}) &= 100\\% \\end{aligned}`} />
              : <BlockMath math={`\\begin{aligned} P(0) &= |\\alpha|^2 = ${Math.round(q0 * 100)}\\% \\\\ P(1) &= |\\beta|^2 = ${Math.round(s.prepared1 * 100)}\\% \\end{aligned}`} />}
          </div>
          <div className="sp-live">
            <span className="sp-m">predicted</span>
            <Bar label={<InlineMath math={String.raw`|0\rangle`} />} p={q0} color="#00f2fe" />
            <Bar label={<InlineMath math={String.raw`|1\rangle`} />} p={s.prepared1} color="#f093fb" />
            {n3 > 0 && <>
              <span className="sp-m">observed: 0 × {s.observed[0]} · 1 × {s.observed[1]}</span>
              <Bar label={<InlineMath math={String.raw`|0\rangle`} />} p={s.observed[0] / n3} color="#00f2fe" />
              <Bar label={<InlineMath math={String.raw`|1\rangle`} />} p={s.observed[1] / n3} color="#f093fb" />
            </>}
          </div>
          {done
            ? <button type="button" className="sp-again" onClick={() => bus.story?.prepareAgain()}>Prepare |ψ⟩ again</button>
            : <div className="sp-prompt">👆 Click sphere to measure!</div>}
        </>
      ))}

      {hint && box && (
        <div className="sp-tip" style={{ left: Math.min(box.width - 252, hover.x - box.left + 18), top: Math.min(box.height - 140, hover.y - box.top + 18) }}>
          <div className={`glass-tooltip ${hint[2]}-glow`}><h4>{hint[0]}</h4><p>{hint[1]}</p></div>
        </div>
      )}

      <QuantumNavButtons
        canPrev={step > 0}
        onPrev={() => bus.story?.prev()}
        onNext={() => bus.story?.next()}
        prevLabel="Prev"
        nextLabel={step < 3 ? NEXT[step] : done ? '↺ Reset State' : NEXT[3]}
        accentColor="#00f2fe"
        containerStyle={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', right: 'auto' }}
      />
    </div>
  );
}

export default SuperpositionScene;
