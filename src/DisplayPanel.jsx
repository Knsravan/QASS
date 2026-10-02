import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuality } from './QualityScene';
import { PARTS, qualityInfo, setDisplayLevel, setDisplayPart } from './quality';

/*
 * Display & Accessibility: how the simulator looks and runs, chosen by the
 * person instead of (or on top of) the device test.
 *
 * - Quality: Recommended (the level the device test chose) or High, Medium,
 *   Low outright.
 * - Single parts over that level: glow, frame rate, sharpness, liquid glass,
 *   stars, motion and solid surfaces.
 *
 * Every choice applies at once, so the view behind the panel shows what it
 * does, with the frame rate read live at the top. Choices are saved for the
 * device (quality.js).
 */

const LEVEL_NAME = { high: 'High', medium: 'Medium', low: 'Low' };
const HINT = {
  glow: 'The neon light on lines, rings and particles',
  fps: 'How often the 3D scenes redraw; lower is lighter on battery',
  sharp: 'How many pixels the 3D scenes draw',
  lens: 'Whether the glass bends what is behind it',
  stars: 'How many stars fill the background',
  motion: 'Interface animations; the 3D scenes keep moving',
  surface: 'Solid surfaces are easier to read',
};

function Fps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let since = performance.now();
    const tick = (now) => {
      frames++;
      if (now - since >= 500) { setFps(Math.round((frames * 1000) / (now - since))); frames = 0; since = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span className="dp-fps" aria-live="off">{fps ? `${fps} fps` : '… fps'}</span>;
}

function Segmented({ label, value, options, onPick, hint }) {
  const id = useId();
  return (
    <div className="dp-row">
      <div className="dp-row-head">
        <span id={id} className="dp-label">{label}</span>
        {hint && <span className="dp-hint">{hint}</span>}
      </div>
      <div className="dp-seg" role="radiogroup" aria-labelledby={id}>
        {Object.entries(options).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            className={value === key ? 'is-on' : ''}
            onClick={() => onPick(key)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DisplayPanelIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </svg>
  );
}

export default function DisplayPanel({ open, anchor, onClose }) {
  const q = useQuality();
  const info = qualityInfo();
  const ref = useRef(null);
  const titleId = useId();
  const [pos, setPos] = useState({ top: 76, left: 0 });

  // Sits under its button, kept on screen.
  useEffect(() => {
    if (!open || !anchor) return undefined;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = Math.min(380, window.innerWidth - 24);
      setPos({ top: r.bottom + 12, left: Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w + 24)), width: w });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchor]);

  // Escape or a click outside closes it; focus moves in when it opens.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !anchor?.contains(e.target)) onClose(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    requestAnimationFrame(() => ref.current?.querySelector('button.is-on, button')?.focus());
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown, true); };
  }, [open, onClose, anchor]);

  if (!open) return null;
  const custom = Object.keys(info.parts).length > 0;
  const level = info.level;
  const recommended = LEVEL_NAME[info.deviceTier];

  return createPortal(
    <div
      ref={ref}
      className="dp glass-panel"
      role="dialog"
      aria-labelledby={titleId}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {/* The content scrolls inside the glass, so the glass (and its blur)
          stays put. */}
      <div className="dp-scroll">
      <div className="dp-head">
        <h2 id={titleId}>Display &amp; accessibility</h2>
        <Fps />
        <button type="button" className="dp-close" aria-label="Close" onClick={onClose}>×</button>
      </div>

      <div className="dp-section">
        <Segmented
          label="Quality"
          hint={`The device test chose ${recommended} for this device`}
          value={custom ? '' : level}
          options={{ auto: `Recommended (${recommended})`, high: 'High', medium: 'Medium', low: 'Low' }}
          onPick={setDisplayLevel}
        />
        {custom && (
          <p className="dp-note">
            Your own choices below are applied on top of {LEVEL_NAME[q.tier]}.{' '}
            <button type="button" className="dp-link" onClick={() => setDisplayLevel(level)}>Clear them</button>
          </p>
        )}
      </div>

      <div className="dp-section dp-parts">
        {Object.entries(PARTS).map(([part, def]) => (
          <Segmented
            key={part}
            label={def.label}
            hint={HINT[part]}
            value={def.of(q)}
            options={def.options}
            onPick={(v) => setDisplayPart(part, v)}
          />
        ))}
      </div>

      <div className="dp-foot">
        <button type="button" className="dp-reset" onClick={() => setDisplayLevel('auto')}>Reset to recommended</button>
        <span>Saved on this device</span>
      </div>
      </div>
    </div>,
    document.body,
  );
}
