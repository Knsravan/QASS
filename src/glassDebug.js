/*
 * A small on-screen readout for checking the liquid glass on a real machine.
 * Open the app with ?glassdebug in the address (e.g. https://qass.vercel.app/?glassdebug)
 * to see the frame rate, the quality tier and why it was chosen, whether this
 * browser can bend, the lens state, and how many glass surfaces are bending
 * right now. "Reset" forgets this tab's tier and reloads.
 */
import { glassStats, resetLensFallback } from './LiquidGlass';

export function mountGlassDebug() {
  if (!new URLSearchParams(window.location.search).has('glassdebug')) return () => {};
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  box.style.cssText = [
    'position:fixed', 'left:12px', 'bottom:12px', 'z-index:2147483647', 'padding:10px 12px',
    'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace', 'color:#e8eef8',
    'background:rgba(5,7,13,.86)', 'border:1px solid rgba(200,225,255,.18)', 'border-radius:10px',
    'pointer-events:auto', 'min-width:220px', 'font-variant-numeric:tabular-nums',
  ].join(';');
  const text = document.createElement('div');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset quality and reload';
  reset.style.cssText = 'margin-top:6px;font:inherit;color:#3ee6ff;background:none;border:1px solid rgba(62,230,255,.4);border-radius:6px;padding:3px 8px;cursor:pointer';
  reset.addEventListener('click', () => { resetLensFallback(); window.location.reload(); });
  box.append(text, reset);
  document.body.appendChild(box);

  let frames = 0;
  let since = performance.now();
  let raf = 0;
  const tick = (now) => {
    frames++;
    if (now - since >= 1000) {
      const fps = Math.round((frames * 1000) / (now - since));
      const s = glassStats();
      text.innerHTML = [
        `<b>QASS performance</b>`,
        `${fps} fps`,
        `quality: ${s.tier} (${s.why.replace(/[<>&]/g, '')})`,
        `bend: ${s.supported ? 'supported' : 'not in this browser'}`,
        `lenses: ${s.mode}`,
        `bending now: ${s.bending} of ${s.lensed} glass surfaces`,
      ].join('<br>');
      frames = 0;
      since = now;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); box.remove(); };
}
