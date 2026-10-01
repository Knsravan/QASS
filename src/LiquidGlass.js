/*
 * Liquid Glass material for the web.
 *
 * The optics are a port of Kyant0/backdrop (Apache-2.0) as configured by
 * BitChord's LiquidGlass.kt: saturation ×1.5 → blur → an edge lens driven by a
 * rounded-rect signed distance field, a 0.5px rim lit at 45°, a soft drop
 * shadow and a translucent surface tint.
 *
 * AGSL runtime shaders have no web equivalent, so the two shaders are turned
 * into assets per element shape:
 *   - the lens is evaluated on the CPU into a displacement map consumed by an
 *     SVG feDisplacementMap inside `backdrop-filter` (Chromium renders SVG
 *     backdrop filters; other engines keep the blur, vibrancy and rim, just
 *     without refraction). Maps are baked in idle time so they never compete
 *     with a scene's first frames;
 *   - the highlight is emitted as a vector SVG rim, so it costs no raster work.
 */

const LENS_HEIGHT = 24;   // LENS_HEIGHT (0.5) × LENS_MAX_DP (48)
const LENS_AMOUNT = 24;   // LENS_AMOUNT (0.5) × LENS_MAX_DP (48)
const DISPERSION = 0.07;  // spread between the red and blue passes of the lens
const MAP_SCALE = 0.25;   // the displacement field is smooth and bilinearly upscaled
const RIM_WIDTH = 0.5;    // Highlight.width
const RIM_ALPHA = 0.5;    // HighlightStyle.Default color alpha

export const GLASS_VARIANTS = {
  // BitChord's exact nav bar material.
  regular: { blur: 8, saturation: 1.5 },
  // Large text-bearing surfaces read as thicker glass (Apple: bigger surfaces
  // carry a heavier material so their content stays legible).
  thick: { blur: 18, saturation: 1.5 },
};

// Elements that sit on the floating functional layer. Content inside them is
// deliberately not listed: glass never stacks on glass.
export const LIQUID_GLASS_TARGETS = [
  ['.lg-nav-pill, .lg-nav-circle', 'regular'],
  ['.quantum-nav-btn, .action-btn, .glass-btn, .quantum-pill-btn, .ctrl-btn, .gate-action-btn, .step-nav-btn', 'regular'],
  ['.hero-badge, .start-btn, .sidebar-toggle-btn, .section-title, .measurement-dial-btn', 'regular'],
  ['.sidebar-panel, .idle-fact-ticker, .idle-hud-cta, .feature-card, .mobile-blocker-card', 'thick'],
  ['.glass-tooltip, .glass-card, .glass-panel, .glass-panel-thick, .compact-hud-card', 'thick'],
];

const ALL_TARGETS = LIQUID_GLASS_TARGETS.map(([selector]) => selector).join(', ');

const PRESSABLE = 'button, [role="button"], .feature-card, .idle-fact-ticker';

// ─── Shader math (straight from backdrop's RoundedRectSDF) ──────────────────

function sdRoundedRect(px, py, hx, hy, r) {
  const cx = Math.abs(px) - (hx - r);
  const cy = Math.abs(py) - (hy - r);
  const outside = Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) - r;
  const inside = Math.min(Math.max(cx, cy), 0);
  return outside + inside;
}

function gradSdRoundedRect(px, py, hx, hy, r) {
  const cx = Math.abs(px) - (hx - r);
  const cy = Math.abs(py) - (hy - r);
  const sx = px < 0 ? -1 : 1;
  const sy = py < 0 ? -1 : 1;
  if (cx >= 0 || cy >= 0) {
    const mx = Math.max(cx, 0);
    const my = Math.max(cy, 0);
    const len = Math.hypot(mx, my) || 1;
    return [sx * (mx / len), sy * (my / len)];
  }
  const gx = cy <= cx ? 1 : 0;
  return [sx * gx, sy * (1 - gx)];
}

const circleMap = (x) => 1 - Math.sqrt(Math.max(0, 1 - x * x));

// ─── Lens: RoundedRectRefractionShader baked to a displacement map ──────────

// Only the rim band and the rounded corners can differ from the neutral value,
// so interior rows are visited at their two edge strips alone.
function forEachEdgePixel(cols, rows, toX, toY, hx, hy, radius, reach, visit) {
  const cornerRows = radius + reach;
  const pxPerCol = (hx * 2) / cols;
  const strip = Math.min(Math.ceil(cols / 2), Math.ceil(reach / pxPerCol) + 1);
  for (let j = 0; j < rows; j++) {
    const py = toY(j);
    if (hy - Math.abs(py) <= cornerRows) {
      for (let i = 0; i < cols; i++) visit(i, j, toX(i), py);
    } else {
      for (let i = 0; i < strip; i++) visit(i, j, toX(i), py);
      for (let i = Math.max(strip, cols - strip); i < cols; i++) visit(i, j, toX(i), py);
    }
  }
}

// Inside the rim band the backdrop is sampled from further in, by an amount
// that follows a circular (convex lens) profile, along the SDF normal blended
// with a pull toward the centre (depthEffect). feDisplacementMap reads
// P + scale·(C − 0.5), so offsets are stored around 0.5.
function bakeLensMap(w, h, radius) {
  const mw = Math.max(2, Math.round(w * MAP_SCALE));
  const mh = Math.max(2, Math.round(h * MAP_SCALE));
  const canvas = document.createElement('canvas');
  canvas.width = mw;
  canvas.height = mh;
  // CPU-backed: encoding a GPU canvas forces a slow readback.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(mw, mh);
  const data = img.data;
  new Uint32Array(data.buffer).fill(0xff808080); // neutral: no displacement
  const hx = w / 2;
  const hy = h / 2;
  const band = Math.min(LENS_HEIGHT, Math.min(hx, hy));
  const gradRadius = Math.min(radius * 1.5, Math.min(hx, hy));
  const range = LENS_AMOUNT * 2;

  const toX = (i) => ((i + 0.5) / mw) * w - hx;
  const toY = (j) => ((j + 0.5) / mh) * h - hy;
  forEachEdgePixel(mw, mh, toX, toY, hx, hy, radius, band + 4, (i, j, px, py) => {
    const sd = Math.min(sdRoundedRect(px, py, hx, hy, radius), 0);
    if (-sd >= band) return;
    const d = circleMap(1 - -sd / band) * LENS_AMOUNT;
    const [gx, gy] = gradSdRoundedRect(px, py, hx, hy, gradRadius);
    const cl = Math.hypot(px, py) || 1;
    let nx = gx + px / cl;
    let ny = gy + py / cl;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    // refractionAmount is passed negative in Lens.kt: sample inward.
    const k = (j * mw + i) * 4;
    data[k] = Math.round((0.5 - (d * nx) / range) * 255);
    data[k + 1] = Math.round((0.5 - (d * ny) / range) * 255);
  });
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

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

function svgNode(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
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

// Three displaced passes at slightly different strengths, one per channel,
// recombined: the lens' chromatic aberration.
function lensFilterId(w, h, radius) {
  const key = `${w}x${h}r${radius}`;
  const hit = filterCache.get(key);
  if (hit) return hit;
  const id = `lg-lens-${++filterCount}`;
  const scale = LENS_AMOUNT * 2;
  const filter = svgNode('filter', {
    id,
    x: '0', y: '0', width: String(w), height: String(h),
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  filter.appendChild(svgNode('feImage', {
    href: bakeLensMap(w, h, radius),
    x: '0', y: '0', width: String(w), height: String(h),
    preserveAspectRatio: 'none',
    result: 'map',
  }));
  const channels = [
    ['r', 1 + DISPERSION, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
    ['g', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
    ['b', 1 - DISPERSION, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'],
  ];
  for (const [name, factor, matrix] of channels) {
    filter.appendChild(svgNode('feDisplacementMap', {
      in: 'SourceGraphic', in2: 'map',
      scale: String(scale * factor),
      xChannelSelector: 'R', yChannelSelector: 'G',
      result: `d${name}`,
    }));
    filter.appendChild(svgNode('feColorMatrix', { in: `d${name}`, type: 'matrix', values: matrix, result: name }));
  }
  filter.appendChild(svgNode('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' }));
  filter.appendChild(svgNode('feBlend', { in: 'rg', in2: 'b', mode: 'screen' }));
  ensureDefs().appendChild(filter);
  return remember(filterCache, key, id, (oldId) => document.getElementById(oldId)?.remove());
}

function rimImage(w, h, radius) {
  const key = `${w}x${h}r${radius}`;
  return rimCache.get(key) || remember(rimCache, key, rimSvg(w, h, radius));
}

// ─── Idle-time lens baking ──────────────────────────────────────────────────

const lensQueue = new Map(); // node → shape key it was queued for
let lensHandle = 0;
const idle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 400 })
  : (fn) => setTimeout(() => fn({ timeRemaining: () => 8, didTimeout: true }), 60);

function drainLensQueue(deadline) {
  lensHandle = 0;
  let baked = 0;
  for (const [node, key] of lensQueue) {
    // Never more than one bake per slice when the slice is tight or overdue:
    // a queue of new surfaces must not become one long task.
    if (baked > 0 && deadline.timeRemaining() < 8) break;
    lensQueue.delete(node);
    if (!node.isConnected || node.dataset.lgShape !== key) continue;
    const { w, h, radius, base } = node._lgPending;
    node.style.backdropFilter = `${base} url(#${lensFilterId(w, h, radius)})`;
    baked++;
  }
  if (lensQueue.size && !lensHandle) lensHandle = idle(drainLensQueue);
}

function queueLens(node, key) {
  lensQueue.set(node, key);
  if (!lensHandle) lensHandle = idle(drainLensQueue);
}

// ─── Applying the material ──────────────────────────────────────────────────

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

function cornerRadius(node, w, h) {
  const raw = getComputedStyle(node).borderTopLeftRadius;
  const value = raw.endsWith('%') ? (parseFloat(raw) / 100) * Math.min(w, h) : parseFloat(raw) || 0;
  return Math.min(value, Math.min(w, h) / 2);
}

function measureGlass(node) {
  const w = Math.round(node.offsetWidth);
  const h = Math.round(node.offsetHeight);
  if (w < 4 || h < 4) return null;
  return { w, h, radius: Math.round(cornerRadius(node, w, h)), pressable: node.matches(PRESSABLE) };
}

export function applyLiquidGlass(node, variant = 'regular', geometry = measureGlass(node)) {
  if (!geometry) return;
  const { w, h, radius, pressable } = geometry;
  const shapeKey = `${w}x${h}r${radius}`;
  if (node.dataset.lgShape === shapeKey) return;

  const wanted = ['lg', `lg--${variant}`];
  if (pressable) wanted.push('lg--press');
  node._lgClasses = wanted;
  const missing = wanted.filter((c) => !node.classList.contains(c));
  if (missing.length) node.classList.add(...missing);
  node.dataset.lgShape = shapeKey;
  node.style.setProperty('--lg-rim', rimImage(w, h, radius));

  if (reducedTransparency()) {
    node.style.backdropFilter = 'none';
    return;
  }
  const { blur, saturation } = GLASS_VARIANTS[variant] || GLASS_VARIANTS.regular;
  const base = `saturate(${saturation}) blur(${blur}px)`;
  node._lgBase = base;
  node.style.webkitBackdropFilter = base;
  // Tint, blur and rim show at once; the refraction joins when the browser is
  // idle (or immediately if this exact shape has been baked before).
  if (supportsRefraction() && w * h < 2_000_000) {
    const cached = filterCache.get(shapeKey);
    if (cached) {
      node.style.backdropFilter = `${base} url(#${cached})`;
    } else {
      node.style.backdropFilter = base;
      node._lgPending = { w, h, radius, base };
      queueLens(node, shapeKey);
    }
  } else {
    node.style.backdropFilter = base;
  }
}

// Watches the document and keeps every floating-layer element in glass,
// re-baking when an element's size or shape changes.
export function startLiquidGlass(root = document.body) {
  const variantOf = new WeakMap();
  const pending = new Set();
  let frame = 0;

  const flush = () => {
    frame = 0;
    // All reads, then all writes: interleaving them forces a layout per element.
    const measured = [...pending].filter((n) => n.isConnected).map((n) => [n, measureGlass(n)]);
    for (const [node, geometry] of measured) applyLiquidGlass(node, variantOf.get(node), geometry);
    pending.clear();
  };
  const schedule = (node) => {
    pending.add(node);
    if (!frame) frame = requestAnimationFrame(flush);
  };

  // A resizing element (e.g. the sidebar's width transition) is re-baked once
  // its size has settled, not on every frame of the animation; meanwhile the
  // previous rim simply stretches with it.
  const settleTimers = new WeakMap();
  const sizedOnce = new WeakSet();
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const node = entry.target;
      // While a surface is resizing (the sidebar's width animation) its lens,
      // baked for the old size, no longer covers it. The surface keeps its own
      // tint and blur without refraction until the size settles, then the lens
      // for the new size returns. The first notification is just the initial
      // size, not motion.
      if (sizedOnce.has(node)) {
        if (node._lgBase && node.style.backdropFilter !== node._lgBase) {
          node.style.backdropFilter = node._lgBase;
          delete node.dataset.lgShape;
        }
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
    for (const [selector, variant] of LIQUID_GLASS_TARGETS) {
      if (!node.matches(selector)) continue;
      handled.add(node);
      if (node.parentElement?.closest(ALL_TARGETS)) {
        // Glass never stacks on glass: nested surfaces become plain sheets.
        node._lgClasses = ['lg-inset'];
        if (!node.classList.contains('lg-inset')) node.classList.add('lg-inset');
        return;
      }
      variantOf.set(node, variant);
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

  return () => {
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
