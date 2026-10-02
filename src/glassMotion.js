/*
 * Liquid glass motion: makes the glass move like liquid.
 *
 * - Jelly press: pressed glass squashes under the finger (the press point is
 *   the origin) and springs back with a small wobble.
 * - Drag stretch: dragging while pressed pulls the glass after the pointer
 *   with a rubber band and stretches it along the drag; on release it springs
 *   home carrying the drag's momentum.
 * - Reactive rim: the rim's light still comes from the top-left, but as a
 *   surface moves its shine sloshes behind the motion, the rim brightens with
 *   speed, and a press flashes it. Nothing follows the cursor.
 * - Droplet merge (top bar): the mute circle reaches toward the
 *   Beginner/Advanced capsule on hover and melts into it when pressed; a
 *   "neck" of glass (.lg-nav-neck) fills the gap between them.
 *
 * Springs drive CSS `scale` and `translate`, which compose with the
 * `transform` that hover lifts and the magnetic lean already use. One rAF loop
 * runs only while something is moving and sleeps otherwise. Reduced motion
 * turns all of it off.
 */

import { motionReduced } from './quality';

const PRESS_SEL = '.lg.lg--press, .lg-nav-circle, .sidebar-toggle-btn';
const RIM_SEL = '.lg-pane, .lg-bar, .landing-overlay .feature-card.lg, .landing-overlay .start-btn.lg';
const SKILL_RIM = '.lg-pane, .lg-bar'; // rim colour comes from --lgs-rim / sheen from --lgs-sheen

const STEP = 1 / 240;
const spring = (k, zeta, x = 0) => ({
  x, v: 0, t: x, k, c: 2 * zeta * Math.sqrt(k),
  step(dt) {
    for (let left = dt; left > 1e-6; left -= STEP) {
      const h = Math.min(left, STEP);
      this.v += (-this.k * (this.x - this.t) - this.c * this.v) * h;
      this.x += this.v * h;
    }
  },
  still(eps = 0.002) { return Math.abs(this.x - this.t) < eps && Math.abs(this.v) < eps * 20; },
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Rubber band: follows the pointer at first, then resists ever more.
const rubber = (d, max) => (max * d) / (Math.abs(d) + max * 2.4);

const reduced = motionReduced;

export function mountGlassMotion() {
  if (reduced()) return () => {};

  const states = new Map(); // element → motion state
  let raf = 0;
  let last = 0;
  let quiet = 0;
  let pressing = null;

  const stateOf = (el) => {
    let s = states.get(el);
    if (!s) {
      s = {
        sx: spring(420, 0.3, 1), sy: spring(420, 0.3, 1),   // jelly
        tx: spring(300, 0.38), ty: spring(300, 0.38),       // drag rubber band
        reach: spring(260, 0.42),                           // mute circle toward the capsule
        shift: spring(70, 0.55),                            // rim angle offset, degrees
        flare: 0, cx: null, cy: null, speed: 0,
        rim: el.matches(RIM_SEL), skill: el.matches(SKILL_RIM), circle: el.classList.contains('lg-nav-circle'),
        hover: false,
      };
      states.set(el, s);
    }
    return s;
  };

  const wake = () => {
    quiet = 0;
    if (!raf) {
      // Positions are stale after a sleep: measure afresh, no velocity spike.
      for (const s of states.values()) s.cx = null;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  // ── Input ────────────────────────────────────────────────────────────────
  const onDown = (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest?.(PRESS_SEL);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const r = el.getBoundingClientRect();
    const s = stateOf(el);
    el.style.transformOrigin = `${e.clientX - r.left}px ${e.clientY - r.top}px`;
    el.classList.add('lg-moving');
    s.sx.t = 1.06; s.sy.t = 0.92;
    s.flare = 1;
    pressing = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, max: Math.max(8, Math.min(16, Math.min(r.width, r.height) * 0.25)) };
    if (s.circle) s.reach.t = -6;
    wake();
  };
  const onMove = (e) => {
    if (!pressing || e.pointerId !== pressing.id) return;
    const s = stateOf(pressing.el);
    const dx = e.clientX - pressing.x0, dy = e.clientY - pressing.y0;
    s.tx.t = rubber(dx, pressing.max);
    s.ty.t = rubber(dy, pressing.max);
    // Stretch along the drag, give back half across it.
    const pull = Math.min(Math.hypot(dx, dy) / 600, 0.08);
    const horiz = Math.abs(dx) >= Math.abs(dy);
    s.sx.t = 1.06 + (horiz ? pull : -pull / 2);
    s.sy.t = 0.92 + (horiz ? -pull / 2 : pull);
    wake();
  };
  const onUp = (e) => {
    if (!pressing || e.pointerId !== pressing.id) return;
    const s = stateOf(pressing.el);
    s.sx.t = 1; s.sy.t = 1; s.tx.t = 0; s.ty.t = 0;
    s.sy.v += 1.4; s.sx.v -= 1.0; // the wobble as it lets go
    if (s.circle) s.reach.t = s.hover ? -3 : 0;
    pressing = null;
    wake();
  };
  const onOver = (e) => {
    const el = e.target.closest?.(`${RIM_SEL}, ${PRESS_SEL}`);
    if (!el) return;
    const s = stateOf(el);
    if (s.circle && !s.hover) { s.hover = true; if (!pressing) s.reach.t = -3; }
    wake();
  };
  const onOut = (e) => {
    const el = e.target.closest?.('.lg-nav-circle');
    if (el && !el.contains(e.relatedTarget)) {
      const s = stateOf(el);
      s.hover = false;
      if (!pressing || pressing.el !== el) s.reach.t = 0;
    }
    wake();
  };
  const onTransition = (e) => { if (e.target.matches?.(RIM_SEL)) wake(); };

  document.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  document.addEventListener('transitionrun', onTransition, true);
  window.addEventListener('resize', wake);

  // ── The neck of glass between the top bar's capsule and circle ──────────
  const neckKey = new WeakMap();
  const maskUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  function drawNeck(circle) {
    const nav = circle.closest('.lg-nav');
    const pill = nav?.querySelector('.lg-nav-pill');
    const neck = nav?.querySelector('.lg-nav-neck');
    const rim = nav?.querySelector('.lg-nav-neck-rim');
    if (!pill || !neck || !rim) return;
    const pad = 12;
    const n = nav.getBoundingClientRect(), p = pill.getBoundingClientRect(), c = circle.getBoundingClientRect();
    const W = Math.round(n.width + pad * 2), H = Math.round(n.height + pad * 2);
    const px = p.left - n.left + pad, py = p.top - n.top + pad;
    const cx = c.left - n.left + pad + c.width / 2, cy = c.top - n.top + pad + c.height / 2;
    const gap = c.left - p.right;
    const key = gap > 5.8 ? 'apart' : `${W}|${H}|${px.toFixed(1)}|${cx.toFixed(1)}|${(c.width / 2).toFixed(1)}`;
    if (neckKey.get(nav) === key) return;
    neckKey.set(nav, key);
    if (key === 'apart') { neck.style.visibility = rim.style.visibility = 'hidden'; return; }
    const shapes = `<rect x='${px.toFixed(1)}' y='${py.toFixed(1)}' width='${p.width.toFixed(1)}' height='${p.height.toFixed(1)}' rx='${(p.height / 2).toFixed(1)}'/>` +
      `<circle cx='${cx.toFixed(1)}' cy='${cy.toFixed(1)}' r='${(c.width / 2).toFixed(1)}'/>`;
    // Melt the two shapes together (blur, then a sharp alpha threshold), then
    // keep only what lies outside both: the neck.
    const svg = (edge) => `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
      `<filter id='n' x='0' y='0' width='100%' height='100%'><feGaussianBlur in='SourceGraphic' stdDeviation='7'/>` +
      `<feColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10' result='g'/>` +
      (edge ? `<feMorphology in='g' operator='erode' radius='1' result='e'/><feComposite in='g' in2='e' operator='out' result='g'/>` : '') +
      `<feMorphology in='SourceGraphic' operator='dilate' radius='1' result='d'/><feComposite in='g' in2='d' operator='out'/></filter>` +
      `<g filter='url(#n)' fill='#fff'>${shapes}</g></svg>`;
    for (const [el, edge] of [[neck, false], [rim, true]]) {
      const url = maskUrl(svg(edge));
      el.style.webkitMaskImage = url;
      el.style.maskImage = url;
      el.style.visibility = 'visible';
    }
  }

  // ── The loop ─────────────────────────────────────────────────────────────
  function tick(now) {
    raf = 0;
    // Up to 1/10 s per frame (sub-stepped), so slow machines keep real time.
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    let moving = !!pressing;

    // Reads first: where each rim surface is now.
    const rims = [...document.querySelectorAll(RIM_SEL)];
    const boxes = rims.map((el) => el.getBoundingClientRect());

    rims.forEach((el, i) => {
      const s = stateOf(el), b = boxes[i];
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      if (s.cx !== null) {
        const vx = (x - s.cx) / dt, vy = (y - s.cy) / dt;
        s.speed = s.speed * 0.6 + Math.hypot(vx, vy) * 0.4;
        s.shift.t = clamp(vx / 18 - vy / 30, -40, 40);
      }
      s.cx = x; s.cy = y;
    });

    for (const [el, s] of states) {
      if (!el.isConnected) { states.delete(el); continue; }
      s.sx.step(dt); s.sy.step(dt); s.tx.step(dt); s.ty.step(dt); s.reach.step(dt); s.shift.step(dt);
      s.flare = Math.max(0, s.flare - dt * 2.4);
      const settled = s.sx.still() && s.sy.still() && s.tx.still(0.05) && s.ty.still(0.05) && s.reach.still(0.05)
        && s.shift.still(0.2) && s.flare === 0 && s.speed < 4 && pressing?.el !== el;

      // Shape: jelly and drag (any pressable glass), reach (mute circle).
      const shaped = !(s.sx.still() && s.sy.still() && s.tx.still(0.05) && s.ty.still(0.05) && s.reach.still(0.05)
        && s.sx.t === 1 && s.tx.t === 0 && s.reach.t === 0) || pressing?.el === el;
      if (shaped) {
        el.style.scale = `${s.sx.x.toFixed(4)} ${s.sy.x.toFixed(4)}`;
        el.style.translate = `${(s.tx.x + s.reach.x).toFixed(2)}px ${s.ty.x.toFixed(2)}px`;
      } else if (el.style.scale || el.style.translate) {
        el.style.scale = ''; el.style.translate = ''; el.style.transformOrigin = '';
        el.classList.remove('lg-moving');
      }
      if (s.circle) drawNeck(el);

      // Rim: slosh with motion, brighten with speed, flash on press.
      if (s.rim) {
        const gain = 1 + Math.min(s.speed / 900, 0.6) + s.flare * 0.8;
        if (settled) {
          el.style.removeProperty('--rim-shift'); el.style.removeProperty('--rim-gain');
          el.style.removeProperty('--lgs-rim'); el.style.removeProperty('--lgs-sheen');
        } else {
          el.style.setProperty('--rim-shift', `${s.shift.x.toFixed(1)}deg`);
          el.style.setProperty('--rim-gain', gain.toFixed(3));
          if (s.skill) {
            el.style.setProperty('--lgs-rim', `rgba(255, 255, 255, ${Math.min(0.9, 0.3 * gain).toFixed(3)})`);
            el.style.setProperty('--lgs-sheen', `rgba(255, 255, 255, ${(0.13 + s.flare * 0.22).toFixed(3)})`);
          }
        }
      }
      if (!settled) moving = true;
    }

    quiet = moving ? 0 : quiet + dt;
    if (quiet < 0.4) raf = requestAnimationFrame(tick);
  }

  return () => {
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerout', onOut);
    document.removeEventListener('transitionrun', onTransition, true);
    window.removeEventListener('resize', wake);
  };
}
