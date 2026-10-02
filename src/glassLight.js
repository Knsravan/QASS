/*
 * Liquid glass light: two ways the glass reacts to its surroundings.
 *
 * - Tilt (phones and tablets): tilting the device moves the rim's light and
 *   the top-left sheen across the glass, the way it moves on real glass. The
 *   light follows the device, never the cursor. iOS asks for permission, so
 *   the request rides on the first tap.
 * - Tone: about four times a second the 3D scene is sampled behind the
 *   landing cards, the top bar and the modules' info cards; when something
 *   bright passes behind one, it turns lighter with dark text
 *   (data-lg-tone="light") so it stays readable, then switches back. The
 *   scenes keep their drawing buffer (SCENE_GL) so they can be read.
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

// Glass whose text should stay readable over bright 3D: the landing cards,
// the top bar, and the info cards inside modules.
const TONE_TARGETS = '.landing-overlay .feature-card, .lg-nav-pill, .lg-nav-circle, .compact-hud-card, .glass-card';
// Share of the backdrop that is bright (luminance above BRIGHT) that turns a
// piece light, and the share that turns it back; the gap stops flicker.
const BRIGHT = 0.55;
const LIGHT_AT = 0.3;
const DARK_AT = 0.15;
const PROBE = 24; // each piece's backdrop is sampled at 24 x 24

const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function watchTone() {
  const probe = document.createElement('canvas');
  probe.width = probe.height = PROBE;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const timer = setInterval(() => {
    if (document.hidden) return;
    const pieces = document.querySelectorAll(TONE_TARGETS);
    if (!pieces.length) return;
    // The 3D scenes on screen (skip small inline canvases).
    const scenes = [...document.querySelectorAll('canvas')]
      .map((c) => ({ c, box: c.getBoundingClientRect() }))
      .filter(({ c, box }) => c.width && box.width > 200 && box.height > 200);
    for (const piece of pieces) {
      const r = piece.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      let best = null;
      let bestArea = 0;
      // On a tie the later canvas wins: it is drawn on top.
      for (const s of scenes) {
        const a = overlap(r, s.box);
        if (a > 0 && a >= bestArea) { bestArea = a; best = s; }
      }
      if (!best) continue;
      const { c, box } = best;
      const kx = c.width / box.width;
      const ky = c.height / box.height;
      const sx = Math.max(0, (r.left - box.left) * kx);
      const sy = Math.max(0, (r.top - box.top) * ky);
      const sw = Math.min(c.width - sx, r.width * kx);
      const sh = Math.min(c.height - sy, r.height * ky);
      if (sw < 1 || sh < 1) continue;
      ctx.clearRect(0, 0, PROBE, PROBE);
      try { ctx.drawImage(c, sx, sy, sw, sh, 0, 0, PROBE, PROBE); } catch { continue; }
      const data = ctx.getImageData(0, 0, PROBE, PROBE).data;
      let bright = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255 > BRIGHT) bright++;
      }
      const share = bright / (PROBE * PROBE);
      const tone = piece.dataset.lgTone || 'dark';
      if (tone === 'dark' && share > LIGHT_AT) piece.dataset.lgTone = 'light';
      else if (tone === 'light' && share < DARK_AT) piece.dataset.lgTone = 'dark';
    }
  }, 250);
  return () => clearInterval(timer);
}

export function mountGlassLight() {
  const stops = [watchTilt(), watchTone()];
  return () => stops.forEach((stop) => stop());
}
