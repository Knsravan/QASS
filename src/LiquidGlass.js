/*
 * Liquid Glass material for the web.
 *
 * Surfaces on the floating layer get frosted glass: blur, saturation, a
 * translucent tint and a lit rim (a port of Kyant0/backdrop as configured by
 * BitChord's LiquidGlass.kt). The top bar, the sidebar and the buttons also
 * get a real lens (src/glassLens.js): the backdrop bends at the rim, the middle
 * stays frosted and a fixed top-left light catches the curved edge.
 *
 * How the lens is attached matters, and was measured in Chrome:
 *   - the lens map is generated inside the filter (Chrome loads no images
 *     inside backdrop-filter), and
 *   - it runs on the element's ::before, never on the element: Chrome measures
 *     a backdrop filter's coordinates from the outer edge of the element's
 *     box-shadow, which would shift the lens off the element. ::before carries
 *     no shadow, and `background: inherit` repaints the element's tint and rim
 *     above the bent backdrop.
 * Refraction is Chromium-only; other engines keep the blur, tint and rim.
 * If frames drop below FPS_FLOOR while lenses are on, they fall back to plain
 * frosted glass for the rest of the session.
 */

import { buildLensFilter } from './glassLens';

const RIM_WIDTH = 0.5;    // Highlight.width
const RIM_ALPHA = 0.5;    // HighlightStyle.Default color alpha

export const GLASS_VARIANTS = {
  // BitChord's exact nav bar material.
  regular: { blur: 8, saturation: 1.5 },
  // Large text-bearing surfaces read as thicker glass (Apple: bigger surfaces
  // carry a heavier material so their content stays legible).
  thick: { blur: 18, saturation: 1.5 },
};

// Elements on the floating functional layer. `lens`: bend the backdrop at the
// rim. `skin`: the engine paints the tint and lit rim; the Liquid Glass skill's
// surfaces (.lg-bar, .lg-pane) bring their own and take only the lens.
// Content inside a glass surface is never glass itself.
export const LIQUID_GLASS_TARGETS = [
  { selector: '.lg-bar', variant: 'regular', lens: true, skin: false },   // top bar capsule, mute button
  { selector: '.lg-pane', variant: 'thick', lens: true, skin: false },    // sidebar and its tab
  { selector: '.quantum-nav-btn, .action-btn, .glass-btn, .quantum-pill-btn, .ctrl-btn, .gate-action-btn, .step-nav-btn, .measurement-dial-btn, .start-btn', variant: 'regular', lens: true, skin: true },
  { selector: '.idle-hud-cta', variant: 'thick', lens: true, skin: true },
  { selector: '.feature-card', variant: 'thick', lens: true, skin: true },     // landing page cards
  { selector: '.hero-badge, .section-title', variant: 'regular', lens: true, skin: true },
  { selector: '.idle-fact-ticker, .mobile-blocker-card', variant: 'thick', lens: true, skin: true },
  { selector: '.glass-tooltip, .glass-card, .glass-panel, .glass-panel-thick, .compact-hud-card', variant: 'thick', lens: true, skin: true },
];

const ALL_TARGETS = LIQUID_GLASS_TARGETS.map((t) => t.selector).join(', ');

const PRESSABLE = 'button, [role="button"], .feature-card, .idle-fact-ticker';

const FPS_FLOOR = 40;        // below this, lenses are too costly for this machine
const FPS_WINDOW = 2000;     // ms per frame-rate sample
const FPS_STRIKES = 3;       // consecutive slow samples before falling back
const FPS_WARMUP = 5000;     // ignore start-up (shader compiles, first bakes)
const LENS_OFF_KEY = 'quantumUI_lensOff'; // '1': every lens off; 'large': big glass only
const DISPERSION = 0.06;     // colour split at the rim (see glassLens.js)
const LARGE_GLASS = 140;     // shorter side above this: the costly lenses to drop first

// ─── Rim: DefaultHighlightShader as vector strokes ──────────────────────────

// intensity = |dot(sdfNormal, light at 45°)|: constant cos 45° along straight
// edges, rising to 1 mid-way round the top-left and bottom-right corners and
// falling to 0 mid-way round the other two. Each corner arc carries that
// profile as a gradient along its chord.
function rimSvg(w, h, radius) {
  const inset = RIM_WIDTH / 2;
  const r = Math.max(0, radius - inset);
  const a = RIM_ALPHA * Math.SQRT1_2; // straight-edge intensity
  const lit = RIM_ALPHA;              // facing the light
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const f = (n) => Math.round(n * 100) / 100;

  const straight = [];
  if (x1 - r > x0 + r + 0.01) {
    straight.push(`M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}`, `M${f(x0 + r)} ${f(y1)}H${f(x1 - r)}`);
  }
  if (y1 - r > y0 + r + 0.01) {
    straight.push(`M${f(x0)} ${f(y0 + r)}V${f(y1 - r)}`, `M${f(x1)} ${f(y0 + r)}V${f(y1 - r)}`);
  }

  let defs = '';
  let arcs = '';
  if (r > 0.01) {
    const corners = [
      // [start, end, peak opacity]
      [[x0, y0 + r], [x0 + r, y0], lit],  // top-left faces the light
      [[x1 - r, y0], [x1, y0 + r], 0],    // top-right runs parallel to it
      [[x1, y1 - r], [x1 - r, y1], lit],  // bottom-right faces away (|dot|)
      [[x0 + r, y1], [x0, y1 - r], 0],    // bottom-left runs parallel
    ];
    corners.forEach(([[sx, sy], [ex, ey], peak], n) => {
      defs += `<linearGradient id="c${n}" gradientUnits="userSpaceOnUse" x1="${f(sx)}" y1="${f(sy)}" x2="${f(ex)}" y2="${f(ey)}">`
        + `<stop offset="0" stop-opacity="${f(a)}" stop-color="#fff"/>`
        + `<stop offset=".5" stop-opacity="${peak}" stop-color="#fff"/>`
        + `<stop offset="1" stop-opacity="${f(a)}" stop-color="#fff"/></linearGradient>`;
      arcs += `<path d="M${f(sx)} ${f(sy)}A${f(r)} ${f(r)} 0 0 1 ${f(ex)} ${f(ey)}" stroke="url(#c${n})"/>`;
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`
    + (defs ? `<defs>${defs}</defs>` : '')
    + `<g fill="none" stroke-width="${RIM_WIDTH}" stroke-linecap="butt">`
    + (straight.length ? `<path d="${straight.join('')}" stroke="#fff" stroke-opacity="${f(a)}"/>` : '')
    + arcs
    + '</g></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}


// ─── Filter registry ────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
let defs = null;
let filterCount = 0;
const filterCache = new Map(); // shape key → filter id
const rimCache = new Map();    // shape key → css url()
const MAX_CACHE = 160;

function ensureDefs() {
  if (defs && defs.isConnected) return defs;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none';
  defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

function remember(cache, key, value, onEvict) {
  cache.set(key, value);
  while (cache.size > MAX_CACHE) {
    const [oldKey, oldValue] = cache.entries().next().value;
    cache.delete(oldKey);
    if (onEvict) onEvict(oldValue);
  }
  return value;
}

function lensFilterId(w, h, frost) {
  const key = `${w}x${h}f${frost}`;
  const hit = filterCache.get(key);
  if (hit) return hit;
  const id = `lg-lens-${++filterCount}`;
  ensureDefs().appendChild(buildLensFilter(w, h, frost, id, DISPERSION));
  return remember(filterCache, key, id, (oldId) => document.getElementById(oldId)?.remove());
}

function rimImage(w, h, radius) {
  const key = `${w}x${h}r${radius}`;
  return rimCache.get(key) || remember(rimCache, key, rimSvg(w, h, radius));
}

// ─── Lens state: on, unless this machine can't keep up ──────────────────────

let lensOn = (() => {
  try { return sessionStorage.getItem(LENS_OFF_KEY) !== '1'; } catch { return true; }
})();
// First fallback step: only the big, costly lenses (the sidebar, large cards)
// go back to frost; buttons, the top bar and small cards keep bending.
let largeOff = (() => {
  try { return sessionStorage.getItem(LENS_OFF_KEY) === 'large'; } catch { return false; }
})();
const isLarge = (w, h) => Math.min(w, h) > LARGE_GLASS;
const lensAllowed = (w, h) => lensOn && !(largeOff && isLarge(w, h));
const lensed = new Set(); // elements currently carrying a lens layer

let refractionSupported = null;
function supportsRefraction() {
  if (refractionSupported === null) {
    const ua = navigator.userAgent;
    refractionSupported = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Mobile Safari/.test(ua.replace(/Chrome.*/, ''));
  }
  return refractionSupported;
}

const reducedTransparency = () =>
  window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;

function lensesOff() {
  if (!lensOn) return;
  lensOn = false;
  try { sessionStorage.setItem(LENS_OFF_KEY, '1'); } catch { /* this page only */ }
  lensQueue.clear();
  for (const node of lensed) {
    if (node._lgBase) node.style.setProperty('--lg-backdrop', node._lgBase);
  }
}

function largeLensesOff() {
  largeOff = true;
  try { sessionStorage.setItem(LENS_OFF_KEY, 'large'); } catch { /* this page only */ }
  for (const node of lensed) {
    if (!isLarge(node.offsetWidth, node.offsetHeight)) continue;
    lensQueue.delete(node);
    if (node._lgBase) node.style.setProperty('--lg-backdrop', node._lgBase);
  }
}

// Frame-rate guard: rAF frames are counted per window; hidden tabs don't count.
// Too slow once: the large lenses go; still too slow: every lens goes.
function watchFrameRate() {
  let frames = 0;
  let windowStart = 0;
  let strikes = 0;
  let raf = 0;
  const startedAt = performance.now();
  const tick = (now) => {
    if (!lensOn) return;
    raf = requestAnimationFrame(tick);
    if (document.hidden || now - startedAt < FPS_WARMUP || !lensed.size) {
      frames = 0;
      windowStart = now;
      return;
    }
    frames++;
    if (now - windowStart < FPS_WINDOW) return;
    const fps = (frames * 1000) / (now - windowStart);
    strikes = fps < FPS_FLOOR ? strikes + 1 : 0;
    frames = 0;
    windowStart = now;
    if (strikes < FPS_STRIKES) return;
    strikes = 0;
    const anyLarge = !largeOff && [...lensed].some((n) => isLarge(n.offsetWidth, n.offsetHeight));
    if (anyLarge) largeLensesOff();
    else lensesOff();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// ─── Idle-time lens building ────────────────────────────────────────────────

const lensQueue = new Map(); // node → shape key it was queued for
let lensHandle = 0;
const idle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 400 })
  : (fn) => setTimeout(() => fn({ timeRemaining: () => 8, didTimeout: true }), 60);

function drainLensQueue(deadline) {
  lensHandle = 0;
  let built = 0;
  for (const [node, key] of lensQueue) {
    // Never more than one build per slice when the slice is tight or overdue.
    if (built > 0 && deadline.timeRemaining() < 8) break;
    lensQueue.delete(node);
    if (!node.isConnected || node.dataset.lgShape !== key) continue;
    const { w, h, blur, saturation } = node._lgPending;
    if (!lensAllowed(w, h)) continue;
    node.style.setProperty('--lg-backdrop', `url(#${lensFilterId(w, h, blur)}) saturate(${saturation})`);
    built++;
  }
  if (lensQueue.size && !lensHandle) lensHandle = idle(drainLensQueue);
}

function queueLens(node, key) {
  lensQueue.set(node, key);
  if (!lensHandle) lensHandle = idle(drainLensQueue);
}

// ─── Applying the material ──────────────────────────────────────────────────

function cornerRadius(node, w, h) {
  const raw = getComputedStyle(node).borderTopLeftRadius;
  const value = raw.endsWith('%') ? (parseFloat(raw) / 100) * Math.min(w, h) : parseFloat(raw) || 0;
  return Math.min(value, Math.min(w, h) / 2);
}

function measureGlass(node) {
  const w = Math.round(node.offsetWidth);
  const h = Math.round(node.offsetHeight);
  if (w < 4 || h < 4) return null;
  const cs = getComputedStyle(node);
  return {
    w, h,
    radius: Math.round(cornerRadius(node, w, h)),
    pressable: node.matches(PRESSABLE),
    border: parseFloat(cs.borderTopWidth) || 0,
    staticPos: cs.position === 'static',
  };
}

export function applyLiquidGlass(node, target, geometry = measureGlass(node)) {
  if (!geometry) return;
  const { w, h, radius, pressable, border, staticPos } = geometry;
  const shapeKey = `${w}x${h}r${radius}`;
  if (node.dataset.lgShape === shapeKey) return;
  const { blur, saturation } = GLASS_VARIANTS[target.variant] || GLASS_VARIANTS.regular;
  const base = `blur(${blur}px) saturate(${saturation})`;
  const lens = target.lens && !reducedTransparency();

  const wanted = [];
  if (target.skin) {
    wanted.push('lg', `lg--${target.variant}`);
    if (pressable) wanted.push('lg--press');
    node.style.setProperty('--lg-rim', rimImage(w, h, radius));
  }
  if (lens) {
    wanted.push('lg-lensed');
    if (staticPos) wanted.push('lg-lensed--rel');
  }
  node._lgClasses = wanted;
  const missing = wanted.filter((c) => !node.classList.contains(c));
  if (missing.length) node.classList.add(...missing);
  node.dataset.lgShape = shapeKey;

  if (reducedTransparency()) {
    node.style.backdropFilter = 'none';
    node.style.webkitBackdropFilter = 'none';
    return;
  }
  node._lgBase = base;
  if (!lens) {
    node.style.webkitBackdropFilter = base;
    node.style.backdropFilter = base;
    return;
  }

  // The glass is drawn by ::before (see the header); the element itself must
  // not filter its backdrop, or ::before would only see the element.
  node.style.backdropFilter = 'none';
  node.style.webkitBackdropFilter = 'none';
  node.style.setProperty('--lg-backdrop-base', base);
  node.style.setProperty('--lg-bw', `${border}px`);
  node._lgVariant = { blur, saturation };
  lensed.add(node);
  const cached = filterCache.get(`${w}x${h}f${blur}`);
  if (lensAllowed(w, h) && supportsRefraction() && cached) {
    node.style.setProperty('--lg-backdrop', `url(#${cached}) saturate(${saturation})`);
  } else {
    // Frosted at once; the lens joins when the browser is idle.
    node.style.setProperty('--lg-backdrop', base);
    if (lensAllowed(w, h) && supportsRefraction()) {
      node._lgPending = { w, h, blur, saturation };
      queueLens(node, shapeKey);
    }
  }
}

// While a lensed element resizes (e.g. the sidebar's width transition), its
// lens is rebuilt for the new size on every frame, at most once per frame, so
// the bend follows the edge instead of dropping out until the size settles.
const liveNodes = new Set();
let liveFrame = 0;
function followResize(node) {
  liveNodes.add(node);
  if (liveFrame) return;
  liveFrame = requestAnimationFrame(() => {
    liveFrame = 0;
    const sizes = [...liveNodes].filter((n) => n.isConnected).map((n) => [n, Math.round(n.offsetWidth), Math.round(n.offsetHeight)]);
    liveNodes.clear();
    for (const [n, w, h] of sizes) {
      const v = n._lgVariant;
      if (!v || w < 4 || h < 4) continue;
      if (!lensAllowed(w, h)) { if (n._lgBase) n.style.setProperty('--lg-backdrop', n._lgBase); continue; }
      n.style.setProperty('--lg-backdrop', `url(#${lensFilterId(w, h, v.blur)}) saturate(${v.saturation})`);
    }
  });
}

// Watches the document and keeps every floating-layer element in glass,
// rebuilding when an element's size or shape changes.
export function startLiquidGlass(root = document.body) {
  const targetOf = new WeakMap();
  const pending = new Set();
  let frame = 0;

  const flush = () => {
    frame = 0;
    // All reads, then all writes: interleaving them forces a layout per element.
    const measured = [...pending].filter((n) => n.isConnected).map((n) => [n, measureGlass(n)]);
    for (const [node, geometry] of measured) applyLiquidGlass(node, targetOf.get(node), geometry);
    pending.clear();
  };
  const schedule = (node) => {
    pending.add(node);
    if (!frame) frame = requestAnimationFrame(flush);
  };

  // A resizing element (e.g. the sidebar's width transition) keeps its lens:
  // followResize() rebuilds it for each new size, every frame. The rest of
  // the glass (rim, classes) is redone once the size has settled.
  const settleTimers = new WeakMap();
  const sizedOnce = new WeakSet();
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const node = entry.target;
      if (sizedOnce.has(node)) {
        if (lensed.has(node) && node._lgBase) {
          lensQueue.delete(node);
          if (lensOn && supportsRefraction() && !reducedTransparency()) followResize(node);
          else node.style.setProperty('--lg-backdrop', node._lgBase);
        }
        delete node.dataset.lgShape;
      } else {
        sizedOnce.add(node);
      }
      clearTimeout(settleTimers.get(node));
      settleTimers.set(node, setTimeout(() => schedule(node), 150));
    }
  });

  // Elements already classified either way. Classifying must never write to
  // an element twice: every class write is itself a mutation this observer
  // sees, and re-handling it would loop forever.
  const handled = new WeakSet();

  const consider = (node) => {
    if (handled.has(node)) return;
    for (const target of LIQUID_GLASS_TARGETS) {
      if (!node.matches(target.selector)) continue;
      handled.add(node);
      if (node.parentElement?.closest(ALL_TARGETS)) {
        // Glass never stacks on glass: nested surfaces become plain sheets.
        node._lgClasses = ['lg-inset'];
        if (!node.classList.contains('lg-inset')) node.classList.add('lg-inset');
        return;
      }
      targetOf.set(node, target);
      resizeObserver.observe(node);
      schedule(node);
      return;
    }
  };

  const adoptSubtree = (scope) => {
    consider(scope);
    scope.querySelectorAll(ALL_TARGETS).forEach(consider);
  };

  adoptSubtree(root);
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach((n) => { if (n.nodeType === 1) adoptSubtree(n); });
        record.removedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          lensed.delete(n);
          n.querySelectorAll?.('.lg-lensed').forEach((c) => lensed.delete(c));
        });
      } else if (record.target.nodeType === 1) {
        const node = record.target;
        if (node._lgClasses) {
          // React rewrites className wholesale when an element's own classes
          // change, dropping the engine's. Put back only what is missing, so
          // this write cannot trigger another one.
          const missing = node._lgClasses.filter((c) => !node.classList.contains(c));
          if (missing.length) node.classList.add(...missing);
        } else {
          // A class change can only make this one element a target.
          consider(node);
        }
      }
    }
  });
  mutationObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  const stopWatching = watchFrameRate();

  return () => {
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    stopWatching();
    if (frame) cancelAnimationFrame(frame);
  };
}
