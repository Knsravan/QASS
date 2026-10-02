import React, { useEffect, useRef } from 'react';
import { motionReduced } from './quality';

/*
 * Glass slider (the iOS 26 capsule): a glass track with a glowing fill and a
 * clear capsule lens on top that bends the fill under it. Grabbing the
 * capsule swells it, dragging stretches it along the drag, and a small glass
 * bubble shows the value while it is held.
 *
 * The browser's own range input stays on top, invisible, with a thumb the
 * size of the capsule: dragging, the keyboard and screen readers work exactly
 * as before, and the capsule sits where the browser puts the thumb.
 *
 * Props: the input's own (min, max, step, value, onChange, ...), plus
 * `color` for the fill, `track` to paint the whole track instead of a fill
 * (a colour scale such as the interference phase), and `format` to show the
 * value in the bubble.
 */

const KNOB_W = 44;
const GROW = 0.3;       // how much the capsule swells while held
const STRETCH = 0.8;    // how far it stretches with the drag speed

const reduced = motionReduced;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function spring(k, zeta) {
  return {
    x: 0, v: 0, t: 0, k, c: 2 * zeta * Math.sqrt(k),
    step(dt) {
      for (let h = dt; h > 1e-6; h -= 1 / 240) {
        const s = Math.min(h, 1 / 240);
        this.v += (-this.k * (this.x - this.t) - this.c * this.v) * s;
        this.x += this.v * s;
      }
    },
    still() { return Math.abs(this.x - this.t) < 0.002 && Math.abs(this.v) < 0.02; },
  };
}

export default function GlassSlider({ color = '#38bdf8', track, format, className = '', style, ...input }) {
  const rail = useRef(null);
  const knob = useRef(null);
  const fill = useRef(null);
  const bubble = useRef(null);
  const state = useRef(null);
  if (!state.current) {
    state.current = { press: spring(320, 0.5), stretch: spring(260, 0.42), vel: 0, lastX: null, raf: 0, last: 0, wake: null };
  }

  const min = Number(input.min ?? 0);
  const max = Number(input.max ?? 100);
  const value = Number(input.value ?? min);

  useEffect(() => {
    const s = state.current;
    const position = () => {
      const w = rail.current?.clientWidth || 0;
      const p = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;
      return KNOB_W / 2 + p * Math.max(0, w - KNOB_W);
    };
    s.position = position;
    const frame = (now) => {
      s.raf = 0;
      const dt = Math.min(0.05, (now - s.last) / 1000) || 1 / 60;
      s.last = now;
      const x = s.position();
      if (s.lastX == null) s.lastX = x;
      s.vel += ((x - s.lastX) / dt - s.vel) * 0.35;
      s.lastX = x;
      const still = reduced();
      s.stretch.t = still ? 0 : clamp(s.vel / 1800, -0.45, 0.45) * STRETCH;
      if (still) { s.press.x = s.press.t; s.stretch.x = 0; }
      s.press.step(dt);
      s.stretch.step(dt);
      const st = s.stretch.x;
      const base = 1 + GROW * s.press.x;
      const sx = base * (1 + Math.abs(st));
      const sy = base * (1 - Math.abs(st) * 0.45);
      if (fill.current) fill.current.style.width = `${x}px`;
      if (knob.current) knob.current.style.transform = `translate(${(x - st * 10).toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      if (bubble.current) {
        bubble.current.style.left = `${x}px`;
        bubble.current.style.scale = String(clamp(s.press.x, 0, 1.15));
      }
      if (!s.press.still() || !s.stretch.still() || Math.abs(s.vel) > 2) s.raf = requestAnimationFrame(frame);
    };
    s.wake = () => {
      if (!s.raf) { s.last = performance.now(); s.raf = requestAnimationFrame(frame); }
    };
    s.wake();
    return () => { cancelAnimationFrame(s.raf); s.raf = 0; };
  }, [value, min, max]);

  useEffect(() => {
    const s = state.current;
    const ro = new ResizeObserver(() => { s.lastX = null; s.wake?.(); });
    if (rail.current) ro.observe(rail.current);
    const release = () => { s.press.t = 0; s.wake?.(); };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      ro.disconnect();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      clearTimeout(s.keyTimer);
    };
  }, []);

  const press = (amount) => { const s = state.current; s.press.t = amount; s.wake?.(); };
  const onKeyDown = (e) => {
    input.onKeyDown?.(e);
    if (/^(Arrow|Page|Home|End)/.test(e.key)) {
      const s = state.current;
      press(0.6);
      clearTimeout(s.keyTimer);
      s.keyTimer = setTimeout(() => press(0), 260);
    }
  };

  return (
    <div ref={rail} className={`gs-rail ${className}`} style={{ '--gs-c': color, '--gs-kw': `${KNOB_W}px`, ...style }}>
      <div className="gs-track" style={track ? { background: track } : undefined}>
        {!track && <div ref={fill} className="gs-fill" />}
      </div>
      <div ref={knob} className="gs-knob"><span className="gs-spec" /></div>
      {format && <div ref={bubble} className="gs-bubble">{format(value)}</div>}
      <input
        {...input}
        type="range"
        className="gs-input"
        onPointerDown={(e) => { input.onPointerDown?.(e); press(1); }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
