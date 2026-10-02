/*
 * Liquid glass light: on phones and tablets, tilting the device moves the
 * rim's light and the top-left sheen across the glass, the way it moves on
 * real glass. The light follows the device, never the cursor. iOS asks for
 * permission, so the request rides on the first tap.
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

export function mountGlassLight() {
  return watchTilt();
}
