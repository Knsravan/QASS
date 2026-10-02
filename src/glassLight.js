/*
 * Liquid glass light: two ways the glass reacts to its surroundings.
 *
 * - Tilt (phones and tablets): tilting the device moves the rim's light and
 *   the top-left sheen across the glass, the way it moves on real glass. The
 *   light follows the device, never the cursor. iOS asks for permission, so
 *   the request rides on the first tap.
 * - Tone (landing page): about four times a second the 3D scene is sampled
 *   behind each feature card; when something bright passes behind one, the
 *   card turns lighter with dark text (data-lg-tone="light") so it stays
 *   readable, then switches back. The landing Canvas keeps its drawing buffer
 *   (preserveDrawingBuffer) so it can be read between frames.
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

const TONE_TARGETS = '.landing-overlay .feature-card';
// Share of the card's backdrop that is bright (luminance above BRIGHT) that
// turns it light, and the share that turns it back; the gap stops flicker.
const BRIGHT = 0.55;
const LIGHT_AT = 0.3;
const DARK_AT = 0.15;

function watchTone() {
  const probe = document.createElement('canvas');
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const timer = setInterval(() => {
    const cards = document.querySelectorAll(TONE_TARGETS);
    const scene = document.querySelector('.landing-container canvas');
    if (!cards.length || !scene || !scene.width || document.hidden) return;
    const sw = 96;
    const sh = Math.max(1, Math.round((sw * scene.height) / scene.width));
    probe.width = sw;
    probe.height = sh;
    try { ctx.drawImage(scene, 0, 0, sw, sh); } catch { return; }
    const data = ctx.getImageData(0, 0, sw, sh).data;
    const box = scene.getBoundingClientRect();
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      const x0 = clamp(Math.floor(((r.left - box.left) / box.width) * sw), 0, sw - 1);
      const x1 = clamp(Math.ceil(((r.right - box.left) / box.width) * sw), x0 + 1, sw);
      const y0 = clamp(Math.floor(((r.top - box.top) / box.height) * sh), 0, sh - 1);
      const y1 = clamp(Math.ceil(((r.bottom - box.top) / box.height) * sh), y0 + 1, sh);
      let bright = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * sw + x) * 4;
          if ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255 > BRIGHT) bright++;
          n++;
        }
      }
      const share = n ? bright / n : 0;
      const tone = card.dataset.lgTone || 'dark';
      if (tone === 'dark' && share > LIGHT_AT) card.dataset.lgTone = 'light';
      else if (tone === 'light' && share < DARK_AT) card.dataset.lgTone = 'dark';
    }
  }, 250);
  return () => clearInterval(timer);
}

export function mountGlassLight() {
  const stops = [watchTilt(), watchTone()];
  return () => stops.forEach((stop) => stop());
}
