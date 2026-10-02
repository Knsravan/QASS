/*
 * Liquid glass light: two ways the glass reacts to light.
 *
 * - Tilt (phones and tablets): tilting the device moves the light along the
 *   rim, the way it moves on real glass. The
 *   light follows the device, never the cursor. iOS asks for permission, so
 *   the request rides on the first tap.
 * - Bright beams (inside the app, not the landing page): a few times a
 *   second each 3D scene is shrunk to a small thumbnail and read once, and
 *   every piece of glass checks its patch of that thumbnail. When a bright
 *   beam passes behind one, the glass darkens what shows through it and its
 *   text gets a dark glow, easing in and out, so white text stays readable.
 *   The glass stays dark; the text stays white.
 *
 *   Reading a WebGL canvas directly makes the page wait for the GPU, which
 *   is what made frames stutter. sceneProbe.js shrinks and copies each scene
 *   on the GPU and hands the thumbnail over a frame or so later, without
 *   waiting; once per sample, at the quality tier's pace (quality.js). The
 *   copy starts in an animation frame queued after the scene's own, so the
 *   scene has just drawn and needs no preserved drawing buffer.
 */

import { getQuality, subscribeQuality, motionReduced } from './quality';
import { probeScene } from './sceneProbe';

const reduced = motionReduced;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function watchTilt() {
  if (!window.matchMedia?.('(pointer: coarse)').matches || reduced() || !('DeviceOrientationEvent' in window)) return () => {};
  const root = document.documentElement;
  let target = 0;
  let x = 0;
  let raf = 0;
  const step = () => {
    raf = 0;
    x += (target - x) * 0.12;
    root.style.setProperty('--tilt-shift', `${(x * 2).toFixed(1)}deg`);
    if (Math.abs(target - x) > 0.05) raf = requestAnimationFrame(step);
  };
  const onTilt = (e) => {
    if (e.gamma == null) return;
    target = clamp(e.gamma, -30, 30); // left-right tilt, degrees
    if (!raf) raf = requestAnimationFrame(step);
  };
  const listen = () => window.addEventListener('deviceorientation', onTilt);
  let ask = null;
  if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
    ask = () => {
      window.DeviceOrientationEvent.requestPermission().then((s) => { if (s === 'granted') listen(); }).catch(() => {});
    };
    window.addEventListener('click', ask, { once: true });
  } else {
    listen();
  }
  return () => {
    window.removeEventListener('deviceorientation', onTilt);
    if (ask) window.removeEventListener('click', ask);
    if (raf) cancelAnimationFrame(raf);
    root.style.removeProperty('--tilt-shift');
  };
}

// Every piece of glass in the app: the lensed surfaces, the glass skin
// (buttons, pills, cards, panels, tooltips) and the skill's panes and bars.
// Not the landing page's (sampling pauses while it is shown).
const DIM_TARGETS = '.lg-lensed, .lg, .lg-pane, .lg-bar';
const BRIGHT = 0.55;     // a backdrop pixel this bright counts as a beam
const THUMB = 96;        // each scene is read as a thumbnail this wide
const FULL_AT = 0.3;     // this share of bright pixels: fully dimmed
const EASE = 0.35;       // per sample, how far the dimming moves toward its target

const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function watchBeams() {
  const dim = new WeakMap(); // piece -> current dimming, 0..1
  let timer = 0;
  let raf = 0;
  let busy = false;

  const sample = async () => {
    raf = 0;
    if (!document.querySelector(DIM_TARGETS)) return;
    // The scenes (not the slow star field behind them, which may not have
    // drawn this frame).
    const scenes = [...document.querySelectorAll('canvas')]
      .filter((c) => !c.closest('.scene-bg'))
      .map((c) => ({ c, box: c.getBoundingClientRect() }))
      .filter(({ c, box }) => c.width && box.width > 200 && box.height > 200);
    if (!scenes.length) return;
    busy = true;
    const reads = await Promise.all(scenes.map(({ box, c }) => {
      const tw = THUMB;
      const th = Math.max(1, Math.round((THUMB * box.height) / box.width));
      return probeScene(c, tw, th).then((pixels) => pixels && { pixels, tw, th });
    }));
    busy = false;
    scenes.forEach((s, k) => { s.read = reads[k]; });

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const piece of document.querySelectorAll(DIM_TARGETS)) {
      const r = piece.getBoundingClientRect();
      // Skip glass that is hidden or off screen.
      if (!r.width || !r.height || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
      // The scene it overlaps most; on a tie the later canvas, drawn on top.
      let best = null;
      let bestArea = 0;
      for (const s of scenes) {
        if (!s.read) continue;
        const a = overlap(r, s.box);
        if (a > 0 && a >= bestArea) { bestArea = a; best = s; }
      }
      let share = 0;
      if (best) {
        const { box, read: { pixels, tw, th } } = best;
        const x0 = clamp(Math.floor(((r.left - box.left) / box.width) * tw), 0, tw);
        const x1 = clamp(Math.ceil(((r.right - box.left) / box.width) * tw), 0, tw);
        const y0 = clamp(Math.floor(((r.top - box.top) / box.height) * th), 0, th);
        const y1 = clamp(Math.ceil(((r.bottom - box.top) / box.height) * th), 0, th);
        let bright = 0;
        let total = 0;
        for (let y = y0; y < y1; y++) {
          const row = th - 1 - y; // GL rows run bottom to top
          for (let x = x0; x < x1; x++) {
            const i = (row * tw + x) * 4;
            if ((0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255 > BRIGHT) bright++;
            total++;
          }
        }
        share = total ? bright / total : 0;
      }
      const target = clamp(share / FULL_AT, 0, 1);
      const now = (dim.get(piece) || 0) + (target - (dim.get(piece) || 0)) * EASE;
      dim.set(piece, now);
      if (now < 0.01) {
        if (piece.hasAttribute('data-lg-dim')) {
          piece.style.removeProperty('--lg-dim');
          piece.style.removeProperty('--lg-see');
          piece.removeAttribute('data-lg-dim');
        }
      } else {
        if (!piece.hasAttribute('data-lg-dim')) piece.setAttribute('data-lg-dim', '');
        piece.style.setProperty('--lg-dim', now.toFixed(3));
        piece.style.setProperty('--lg-see', (1 - now * 0.55).toFixed(3)); // brightness of what shows through
      }
    }
  };

  const start = (ms) => {
    clearInterval(timer);
    timer = ms ? setInterval(() => {
      if (raf || busy || document.hidden || document.querySelector('.landing-container')) return;
      // Queued now, this frame callback runs after the scenes' own in the
      // next frame: their pixels are fresh.
      raf = requestAnimationFrame(sample);
    }, ms) : 0;
  };
  start(getQuality().beamMs);
  const stop = subscribeQuality((q) => start(q.beamMs));
  return () => { clearInterval(timer); cancelAnimationFrame(raf); stop(); };
}

export function mountGlassLight() {
  const stops = [watchTilt(), watchBeams()];
  return () => stops.forEach((stop) => stop());
}
