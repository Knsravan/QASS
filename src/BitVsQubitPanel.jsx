import React, { useEffect, useRef } from 'react';
import { bvqLive } from './bitVsQubitLive';

// Classical Bit vs Qubit's readout, under the scene: the bit's value and its
// (certain) odds next to the qubit's live odds, with Flip / Measure / New qubit
// and a tally of the qubit's measurements.

const C0 = '#00f2fe'; // 0 and |0>, as the scene draws them
const C1 = '#f093fb'; // 1 and |1>

const pct = (p) => `${Math.round(p * 100)}%`;

function OddsRow({ label, color, barRef, valueRef, value }) {
  return (
    <div className="bvq-odds-row">
      <span className="bvq-odds-label" style={{ color }}>{label}</span>
      <span className="bvq-odds-track">
        <span ref={barRef} className="bvq-odds-fill" style={{ background: color, width: value === undefined ? undefined : pct(value), boxShadow: `0 0 10px ${color}` }} />
      </span>
      <span ref={valueRef} className="bvq-odds-value">{value === undefined ? '' : pct(value)}</span>
    </div>
  );
}

export default function BitVsQubitPanel({ bit, onFlip, result, onMeasure, onNewQubit, counts }) {
  // The qubit's odds follow its arrow every frame; written straight to the DOM.
  // Once measured, the odds are certain: the result's, not the arrow's on its way there.
  const resultRef = useRef(result);
  resultRef.current = result;
  const bar0 = useRef(null);
  const bar1 = useRef(null);
  const val0 = useRef(null);
  const val1 = useRef(null);
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = () => {
      const r = resultRef.current;
      const p1 = r === null ? Math.min(1, Math.max(0, bvqLive.p1)) : r;
      const shown = Math.round(p1 * 100);
      if (shown !== last) {
        last = shown;
        if (bar0.current) bar0.current.style.width = `${100 - shown}%`;
        if (bar1.current) bar1.current.style.width = `${shown}%`;
        if (val0.current) val0.current.textContent = `${100 - shown}%`;
        if (val1.current) val1.current.textContent = `${shown}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = counts[0] + counts[1];
  const bitColor = bit === 0 ? C0 : C1;
  const resultColor = result === 0 ? C0 : result === 1 ? C1 : '#94a3b8';

  return (
    <div className="bvq-panel">
      <section data-jelly className="bvq-card glass-card" style={{ '--j': 0 }} aria-label="Classical bit">
        <div className="bvq-card-head">
          <span className="bvq-card-title" style={{ color: C0 }}>Classical bit</span>
          <span className="bvq-big" style={{ color: bitColor, textShadow: `0 0 18px ${bitColor}` }} aria-live="polite">{bit}</span>
        </div>
        <OddsRow label="reads 0" color={C0} value={bit === 0 ? 1 : 0} />
        <OddsRow label="reads 1" color={C1} value={bit === 1 ? 1 : 0} />
        <button type="button" className="bvq-btn glass-btn glass-interactive" style={{ '--bvq-accent': C0 }} onClick={onFlip}>
          Flip it (NOT gate)
        </button>
      </section>

      <section data-jelly className="bvq-card bvq-hint glass-card" style={{ '--j': 1 }} aria-label="Try it">
        <span className="bvq-card-title bvq-hint-title">Try it</span>
        <p>
          A bit always reads exactly what it holds. A qubit gives <strong style={{ color: C0 }}>0</strong> or <strong style={{ color: C1 }}>1</strong> at
          random when you measure it, with odds set by where its arrow points. Measure a few fresh qubits and watch the tally.
        </p>
      </section>

      <section data-jelly className="bvq-card glass-card" style={{ '--j': 2 }} aria-label="Qubit">
        <div className="bvq-card-head">
          <span className="bvq-card-title" style={{ color: C1 }}>Qubit</span>
          <span className="bvq-big" style={{ color: resultColor, textShadow: result === null ? 'none' : `0 0 18px ${resultColor}` }} aria-live="polite">
            {result === null ? '?' : `|${result}⟩`}
          </span>
        </div>
        <OddsRow label="reads 0" color={C0} barRef={bar0} valueRef={val0} />
        <OddsRow label="reads 1" color={C1} barRef={bar1} valueRef={val1} />
        {result === null ? (
          <button type="button" className="bvq-btn glass-btn glass-interactive" style={{ '--bvq-accent': C1 }} onClick={onMeasure}>
            Measure it
          </button>
        ) : (
          <button type="button" className="bvq-btn glass-btn glass-interactive" style={{ '--bvq-accent': C1 }} onClick={onNewQubit}>
            New qubit
          </button>
        )}
        <div className="bvq-tally" aria-live="polite">
          {total === 0
            ? 'No measurements yet'
            : <>Measured {total} {total === 1 ? 'time' : 'times'}: <span style={{ color: C0 }}>0 × {counts[0]}</span> · <span style={{ color: C1 }}>1 × {counts[1]}</span></>}
        </div>
      </section>
    </div>
  );
}
