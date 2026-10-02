/*
 * Liquid glass light: two ways the glass reacts to light.
 *
 * - Tilt (phones and tablets): tilting the device moves the rim's light and
 *   the top-left sheen across the glass, the way it moves on real glass. The
 *   light follows the device, never the cursor. iOS asks for permission, so
 *   the request rides on the first tap.
 * - Bright beams (inside the app, not the landing page): several times a
 *   second the 3D scene behind each piece of glass is sampled. When a bright
 *   beam passes behind one, the glass darkens what shows through it and its
 *   text gets a dark glow, easing in and out, so white text stays readable.
 *   The glass stays dark; the text stays white. The scenes keep their
 *   drawing buffer (SCENE_GL) so they can be read between frames.
 */

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
    root.style.setProperty('--tilt-x', `${(25 + x * 1.2).toFixed(1)}%`);
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
    root.style.removeProperty('--tilt-x');
  };
}

// Every piece of glass in the app: the lensed surfaces, the glass skin
// (buttons, pills, cards, panels, tooltips) and the skill's panes and bars.
// Not the landing page's (sampling pauses while it is shown).
const DIM_TARGETS = '.lg-lensed, .lg, .lg-pane, .lg-bar';
const BRIGHT = 0.55;     // a backdrop pixel this bright counts as a beam
const PROBE = 20;        // each piece's backdrop is sampled at 20 x 20
const FULL_AT = 0.3;     // this share of bright pixels: fully dimmed
const EASE = 0.35;       // per sample, how far the dimming moves toward its target

const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function watchBeams() {
  const probe = document.createElement('canvas');
  probe.width = probe.height = PROBE;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const dim = new WeakMap(); // piece -> current dimming, 0..1
  const timer = setInterval(() => {
    if (document.hidden || document.querySelector('.landing-container')) return;
    const pieces = document.querySelectorAll(DIM_TARGETS);
    if (!pieces.length) return;
    const scenes = [...document.querySelectorAll('canvas')]
      .map((c) => ({ c, box: c.getBoundingClientRect() }))
      .filter(({ c, box }) => c.width && box.width > 200 && box.height > 200);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const piece of pieces) {
      const r = piece.getBoundingClientRect();
      // Skip glass that is hidden or off screen.
      if (!r.width || !r.height || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
      // The scene it overlaps most; on a tie the later canvas, drawn on top.
      let best = null;
      let bestArea = 0;
      for (const s of scenes) {
        const a = overlap(r, s.box);
        if (a > 0 && a >= bestArea) { bestArea = a; best = s; }
      }
      let share = 0;
      if (best) {
        const { c, box } = best;
        const kx = c.width / box.width;
        const ky = c.height / box.height;
        const sx = Math.max(0, (r.left - box.left) * kx);
        const sy = Math.max(0, (r.top - box.top) * ky);
        const sw = Math.min(c.width - sx, r.width * kx);
        const sh = Math.min(c.height - sy, r.height * ky);
        if (sw >= 1 && sh >= 1) {
          ctx.clearRect(0, 0, PROBE, PROBE);
          try {
            ctx.drawImage(c, sx, sy, sw, sh, 0, 0, PROBE, PROBE);
            const data = ctx.getImageData(0, 0, PROBE, PROBE).data;
            let bright = 0;
            for (let i = 0; i < data.length; i += 4) {
              if ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255 > BRIGHT) bright++;
            }
            share = bright / (PROBE * PROBE);
          } catch { /* unreadable canvas: leave it undimmed */ }
        }
      }
      const target = clamp(share / FULL_AT, 0, 1);
      const now = (dim.get(piece) || 0) + (target - (dim.get(piece) || 0)) * EASE;
      dim.set(piece, now);
      if (now < 0.01) {
        piece.style.removeProperty('--lg-dim');
        piece.style.removeProperty('--lg-see');
        piece.removeAttribute('data-lg-dim');
      } else {
        if (!piece.hasAttribute('data-lg-dim')) piece.setAttribute('data-lg-dim', '');
        piece.style.setProperty('--lg-dim', now.toFixed(3));
        piece.style.setProperty('--lg-see', (1 - now * 0.55).toFixed(3)); // brightness of what shows through
      }
    }
  }, 120);
  return () => clearInterval(timer);
}

export function mountGlassLight() {
  const stops = [watchTilt(), watchBeams()];
  return () => stops.forEach((stop) => stop());
}
