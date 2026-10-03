/*
 * Liquid glass drawn in WebGL, inside the 3D scenes themselves.
 *
 * Apple's material, as approved on the test page: a rounded bevel at the
 * rim bends what is behind the glass (refraction, with a slight colour
 * split), Clear frost, a soft blur inside big glass that carries text
 * (CSS, see below), a thin veil, specular light on the rim (from the
 * top-left, swaying slowly, moved by device tilt), a soft shadow, touch light
 * from the finger, light/dark adaptation, and glass pieces that flow into each
 * other like drops when they come close (the top bar's pieces).
 *
 * How: every scene canvas carries a GlassLayer (QualityScene.jsx). After the
 * scene (and its glow) has drawn, the layer copies the frame into a texture
 * and draws, over the same frame, the glass of every glass element that sits
 * on that canvas. The DOM element then only holds its text and icons
 * ([data-gl] in App.css takes its CSS glass away). Big glass that carries
 * text ([data-gl-big]) also gets a soft CSS blur inside its rim band, which
 * frosts page elements under it too; the rim stays the WebGL bend and light. Everything stays on the
 * GPU in the scene's own context: nothing is read back.
 *
 * Which canvas draws which glass: the topmost scene canvas that covers it
 * (the module's scene over the star field). Glass over no scene keeps the
 * CSS glass (LiquidGlass.js), as do Solid surfaces, reduced transparency and
 * the Frosted glass setting.
 */

import * as THREE from 'three';
import { LIQUID_GLASS_TARGETS, canBendBackdrop, clearLens } from './LiquidGlass';
import { getQuality, motionReduced } from './quality';
import { lightTilt } from './glassLight';

export const MAX_GLASS = 16;
/** While `off`, the glass pass draws nothing (a picture of the bare scene is being taken). */
export const glassHold = { off: false };
export const MAX_EDGE = 24;   // pieces the edge layer lights, over all canvases
// .lg-lensed too: LiquidGlass.js sets the lensed element's own
// backdrop-filter to none (the lens is its ::before), which takes glass
// styled inline in a module out of its target selector.
const SELECTOR = [...LIQUID_GLASS_TARGETS.map((t) => t.selector), '.lg-lensed'].join(', ');
const COVER = 0.8;            // a canvas must cover this share of the glass
const FROST_PX = 1.2;         // Clear glass
const BIG = 140;              // shorter side above this: big glass (Medium's small lens)
const TEXT_GLASS = 60;        // shorter side above this: glass that carries text
                              // (cards, panels, tooltips) gets the soft inner blur
const BIG_EDGE = 10;          // that blur starts this far inside the rim
const PRESSABLE = 'button, [role="button"], [role="tab"], a[href]';
const MORPH_GROUP = '.lg-nav'; // only these pieces flow together
const MORPH_PX = 5;           // pieces closer than this flow together
const LIGHT_DEG = 225;        // light from the top-left (screen angle)
const SWAY_DEG = 35;

const canvases = new Set();   // registered scene canvases
const glassState = new WeakMap(); // element -> { glow, gx, gy, glowT, radii, radiiKey, opacity, opacityAt }
let frameKey = -1;
let frame = null;             // { byCanvas: Map(canvas -> pieces[]), light: [x, y] }
const marked = new Set();     // elements carrying data-gl

const stateOf = (el) => {
  let s = glassState.get(el);
  if (!s) { s = { glow: 0, glowT: 0, gx: 0, gy: 0, radii: null, radiiKey: '', opacity: 1, opacityAt: -1 }; glassState.set(el, s); }
  return s;
};

/** How many glass pieces this canvas drew in the last frame. */
export function glassDrawnOn(canvas) {
  return frame?.byCanvas.get(canvas)?.length || 0;
}

/** Whether the WebGL glass runs at all, for this level and these settings. */
export function glassEnabled(q = getQuality()) {
  return q.surface === 'glass' && q.lens !== 'none';
}

export function registerGlassCanvas(canvas) {
  canvases.add(canvas);
  watchPress();
  watchContent();
  startEdges();
  return () => {
    canvases.delete(canvas);
    if (!canvases.size) { clearMarks(); stopEdges(); }
  };
}

// ─── The edge layer ─────────────────────────────────────────────────────────
// One transparent canvas over the whole page, below only the app's modal
// layers, that draws the rim light of every piece of glass (GLASS_EDGE_FRAGMENT).

const EDGE_PAD = 8;           // px around a piece the edge layer may draw in
let edges = null;
function startEdges() {
  if (edges) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl-edges';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  } catch {
    canvas.remove();
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const vec4s = () => Array.from({ length: MAX_EDGE }, () => new THREE.Vector4());
  const uniforms = {
    uSize: { value: new THREE.Vector2() }, uScale: { value: 1 }, uMorph: { value: 0 },
    uLight: { value: new THREE.Vector2(-0.7, 0.7) }, uN: { value: 0 },
    uBox: { value: vec4s() }, uRad: { value: vec4s() }, uA: { value: vec4s() }, uB: { value: vec4s() }, uC: { value: vec4s() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: GLASS_VERTEX, fragmentShader: GLASS_EDGE_FRAGMENT,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const state = { raf: 0, blank: false, w: 0, h: 0, dpr: 0 };

  const tick = () => {
    state.raf = requestAnimationFrame(tick);
    const f = glassFrame();
    const list = f?.all;
    if (!list?.length) {
      if (!state.blank) { renderer.clear(); state.blank = true; }
      return;
    }
    state.blank = false;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== state.w || h !== state.h || dpr !== state.dpr) {
      state.w = w; state.h = h; state.dpr = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
    }
    const bufW = renderer.domElement.width;
    const bufH = renderer.domElement.height;
    fillGlassUniforms(uniforms, list, { left: 0, top: 0, width: w, height: h }, bufW, bufH, f.lens);
    uniforms.uLight.value.set(f.light[0], -f.light[1]); // the shader's y runs up
    // Each piece's own box only (every box draws the whole glass field, so
    // where boxes overlap they draw the same pixels twice, identically).
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const g of list) {
      const r = g.r;
      renderer.setScissor(r.left - EDGE_PAD, h - r.bottom - EDGE_PAD, r.width + 2 * EDGE_PAD, r.height + 2 * EDGE_PAD);
      renderer.render(scene, camera);
    }
  };
  state.raf = requestAnimationFrame(tick);
  edges = { canvas, renderer, material, quad, state };
}

function stopEdges() {
  if (!edges) return;
  cancelAnimationFrame(edges.state.raf);
  edges.material.dispose();
  edges.quad.geometry.dispose();
  edges.renderer.dispose();
  edges.canvas.remove();
  edges = null;
}

function clearMarks() {
  for (const el of marked) { el.removeAttribute('data-gl'); el.removeAttribute('data-gl-big'); }
  marked.clear();
  frame = null;
}

// ─── Touch light ────────────────────────────────────────────────────────────

let pressWatched = false;
let pressed = null;
function watchPress() {
  if (pressWatched) return;
  pressWatched = true;
  // Touch light is for buttons only, not cards or panels.
  const glassOf = (e) => {
    const el = e.target?.closest?.('[data-gl]');
    return el && el.matches(PRESSABLE) ? el : null;
  };
  window.addEventListener('pointerdown', (e) => {
    const el = glassOf(e);
    if (!el) return;
    pressed = el;
    const s = stateOf(el);
    s.glowT = 1; s.gx = e.clientX; s.gy = e.clientY;
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!pressed) return;
    const s = stateOf(pressed);
    s.gx = e.clientX; s.gy = e.clientY;
  }, true);
  const release = () => { if (pressed) stateOf(pressed).glowT = 0; pressed = null; };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
}

// ─── Per-frame glass list ───────────────────────────────────────────────────

function radiiOf(el, s, w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  if (s.radiiKey === key && s.radii) return s.radii;
  const cs = getComputedStyle(el);
  const px = (v) => {
    const n = parseFloat(v) || 0;
    return String(v).trim().endsWith('%') ? (n / 100) * Math.min(w, h) : n;
  };
  const m = Math.min(w, h) / 2;
  // [top-right, bottom-right, top-left, bottom-left], CSS px
  s.radii = [cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderTopLeftRadius, cs.borderBottomLeftRadius].map((v) => Math.min(px(v), m));
  s.radiiKey = key;
  return s.radii;
}

// The element's own opacity times its ancestors' (a fading panel fades its
// glass too); refreshed every few frames.
function opacityOf(el, s, now) {
  if (now - s.opacityAt < 120) return s.opacity;
  let o = 1;
  for (let n = el, i = 0; n && n !== document.body && i < 8; n = n.parentElement, i++) {
    o *= parseFloat(getComputedStyle(n).opacity) || 0;
    if (o < 0.01) break;
  }
  s.opacity = o;
  s.opacityAt = now;
  return o;
}

// Overlap by more than a hair (pieces that merely touch don't count).
const OVERLAP_PX = 4;
const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP_PX && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OVERLAP_PX;

// ─── Page content behind glass ──────────────────────────────────────────────
// The WebGL glass bends what the scene draws; plain page content (a badge,
// a label, loose text, an icon) is not in the scene. Glass with such content
// behind it keeps its CSS glass instead, whose lens bends everything behind
// it. Text and icons that are inside glass are left out here: glass over glass
// is handled by the overlap rule.
const CONTENT_PX = 3;
const IN_GLASS = '.lg-lensed, .lg, .lg-pane, .lg-bar, [data-gl]';
// What is on the page is scanned when the DOM changes (at most every 80 ms)
// and every 1.5 s; where each piece of it is, is read again every frame, so a
// label moving under glass (or glass moving over a label) is seen at once.
let content = [];            // { el, node, range, r }
let contentDirty = true;
let contentScanAt = -1e9;
let contentWatched = false;
function watchContent() {
  if (contentWatched) return;
  contentWatched = true;
  new MutationObserver(() => { contentDirty = true; }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
function scanContent() {
  content = [];
  const add = (el, node, range) => content.push({ el, node, range, r: null });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => {
      if (n.nodeType === 1) {
        const t = n.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'CANVAS' || n.classList.contains('visually-hidden')) return NodeFilter.FILTER_REJECT;
        return t === 'svg' || t === 'IMG' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      if (n.closest(IN_GLASS) || n.closest('svg') !== n) continue;
      const r = n.getBoundingClientRect();
      if (r.width <= 160 && r.height <= 160) { add(n, n, null); continue; }
      // A big drawing layer: what it draws counts, not its box.
      let k = 0;
      for (const shape of n.querySelectorAll('path, line, circle, ellipse, rect, polyline, polygon')) {
        if (++k > 80) break;
        const cs = getComputedStyle(shape);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
        add(shape, shape, null);
      }
    } else {
      const el = n.parentElement;
      if (!el || el.closest(IN_GLASS)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      add(el, n, range);
    }
  }
}
function contentBehind(now) {
  if ((contentDirty && now - contentScanAt > 80) || now - contentScanAt > 1500) {
    contentDirty = false;
    contentScanAt = now;
    scanContent();
  }
  const live = [];
  for (const c of content) {
    if (!c.el.isConnected) continue;
    const r = c.range ? c.range.getBoundingClientRect() : c.node.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) continue;
    c.r = r;
    live.push(c);
  }
  content = live;
  return live;
}
const zCache = new WeakMap(); // el -> { z, at }
const zOf = (el) => {
  const hit = zCache.get(el);
  const now = performance.now();
  if (hit && now - hit.at < 500) return hit.z;
  const z = zChain(el);
  zCache.set(el, { z, at: now });
  return z;
};
const zChain = (el) => {
  const chain = [];
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.position !== 'static' && cs.zIndex !== 'auto') chain.unshift(parseInt(cs.zIndex, 10) || 0);
  }
  return chain;
};
// Whether plain content sits under this glass piece (kept for a moment after
// it was last seen, so a piece doesn't flip between the two looks).
function hasContentBehind(g, now) {
  const { r, s } = g;
  for (const c of contentBehind(now)) {
    if (g.el.contains(c.el)) continue;
    if (Math.min(r.right, c.r.right) - Math.max(r.left, c.r.left) <= CONTENT_PX) continue;
    if (Math.min(r.bottom, c.r.bottom) - Math.max(r.top, c.r.top) <= CONTENT_PX) continue;
    if (paintOrder({ el: c.el, z: zOf(c.el) }, g) < 0) { s.behindAt = now; break; }
  }
  return !!s.behindAt && now - s.behindAt < 700;
}

// An element that fades in (opacity, filter) can't backdrop-filter what is
// behind it until the fade ends, so glass that needs the CSS lens keeps its
// enter move but not its fade: the lens works from the first frame.
const unfaded = new WeakSet();
function releaseFades(el) {
  let n = el;
  for (let i = 0; n && n !== document.body && i < 6; i++, n = n.parentElement) {
    for (const a of n.getAnimations?.() || []) {
      if (unfaded.has(a)) continue;
      unfaded.add(a);
      const fx = a.effect;
      const t = fx?.getComputedTiming?.();
      if (!t || !Number.isFinite(t.iterations) || t.duration > 1500) continue;
      const frames = fx.getKeyframes();
      if (!frames.some((k) => 'opacity' in k || 'filter' in k)) continue;
      fx.setKeyframes(frames.map(({ opacity, filter, computedOffset, ...rest }) => rest));
    }
  }
}

const later = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? b : a);

// Paint order, roughly as CSS stacks it: the z-index of every positioned
// ancestor (outermost first), then document order. Overlapping glass draws
// only the top piece where they overlap.
function stackKey(el, s, now) {
  if (s.zAt && now - s.zAt < 1000) return s.z;
  const chain = [];
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.position !== 'static' && cs.zIndex !== 'auto') chain.unshift(parseInt(cs.zIndex, 10) || 0);
  }
  s.z = chain;
  s.zAt = now;
  return chain;
}
function paintOrder(a, b) {
  const za = a.z; const zb = b.z;
  for (let i = 0; i < Math.max(za.length, zb.length); i++) {
    const x = za[i] ?? 0; const y = zb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/** The glass to draw this frame, per canvas. Computed once per frame. */
export function glassFrame() {
  const now = document.timeline?.currentTime ?? performance.now();
  if (now === frameKey && frame) return frame;
  const dt = frameKey < 0 ? 0.016 : Math.min(0.1, Math.max(0, (now - frameKey) / 1000));
  frameKey = now;
  const q = getQuality();
  if (!glassEnabled(q) || !canvases.size) { clearMarks(); return null; }

  const boxes = [...canvases].filter((c) => c.isConnected).map((c) => ({ c, r: c.getBoundingClientRect() }));
  const byCanvas = new Map();
  const keep = new Set();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (el.classList.contains('lg-inset') || el.closest('.lg-solid')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
    // The topmost scene canvas that covers it (and isn't inside it).
    let best = null;
    for (const b of boxes) {
      if (el.contains(b.c)) continue;
      const ow = Math.max(0, Math.min(r.right, b.r.right) - Math.max(r.left, b.r.left));
      const oh = Math.max(0, Math.min(r.bottom, b.r.bottom) - Math.max(r.top, b.r.top));
      if (ow * oh < COVER * r.width * r.height) continue;
      best = best ? (later(best.c, b.c) === b.c ? b : best) : b;
    }
    if (!best) continue;
    const s = stateOf(el);
    const opacity = opacityOf(el, s, now);
    if (opacity < 0.02) continue;
    // Touch light: eases in fast, out slowly.
    s.glow += (s.glowT - s.glow) * Math.min(1, dt * (s.glowT > s.glow ? 14 : 4));
    const list = byCanvas.get(best.c) || [];
    if (list.length >= MAX_GLASS) continue;
    list.push({ el, r, s, opacity, radii: radiiOf(el, s, r.width, r.height), z: stackKey(el, s, now), group: el.closest(MORPH_GROUP) ? 1 : 0 });
    byCanvas.set(best.c, list);
  }
  // Glass with other glass or plain page content under it (a label, text, a
  // card): the scene's bend can't reach those, so such a piece gets the CSS
  // lens on top, which bends everything behind it, and the WebGL glass only
  // draws its body without a bend. The edge light is the same either way.
  for (const list of byCanvas.values()) list.sort(paintOrder);
  const all = [...byCanvas.values()].flat().sort(paintOrder);
  const canBend = canBendBackdrop();
  all.forEach((g, i) => {
    g.lens = canBend && (hasContentBehind(g, now) || all.slice(0, i).some((u) => !u.el.contains(g.el) && overlaps(u.r, g.r)));
    keep.add(g.el);
  });
  for (const el of marked) {
    if (keep.has(el)) continue;
    el.removeAttribute('data-gl');
    el.removeAttribute('data-gl-big');
    el.removeAttribute('data-gl-lens');
  }
  for (const el of keep) if (!marked.has(el)) el.setAttribute('data-gl', '');
  for (const g of all) {
    if (g.lens !== g.el.hasAttribute('data-gl-lens')) g.el.toggleAttribute('data-gl-lens', g.lens);
    if (g.lens) {
      releaseFades(g.el);
      const key = `${Math.round(g.r.width)}x${Math.round(g.r.height)}`;
      if (g.s.lensKey !== key) {
        const lens = clearLens(g.el);
        if (lens) g.el.style.setProperty('--gl-lens', lens); else g.el.style.removeProperty('--gl-lens');
        g.s.lensKey = key;
      }
    }
  }
  // Big glass: the soft inner blur, its corners following the glass's.
  for (const g of all) {
    const big = Math.min(g.r.width, g.r.height) > TEXT_GLASS;
    if (big !== g.el.hasAttribute('data-gl-big')) g.el.toggleAttribute('data-gl-big', big);
    if (big) {
      const ir = `${Math.max(0, g.radii[2] - BIG_EDGE).toFixed(1)}px`;
      if (g.s.ir !== ir) { g.el.style.setProperty('--gl-ir', ir); g.s.ir = ir; }
    }
  }
  marked.clear();
  keep.forEach((el) => marked.add(el));

  let deg = LIGHT_DEG + lightTilt() * 1.5;
  if (!motionReduced()) deg += Math.sin(now / 1000 * 1.1) * SWAY_DEG;
  const a = (deg * Math.PI) / 180;
  frame = { byCanvas, all: all.slice(0, MAX_EDGE), light: [Math.cos(a), Math.sin(a)], lens: q.lens };
  return frame;
}

// ─── The shaders ────────────────────────────────────────────────────────────

export const GLASS_VERTEX = /* glsl */`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// The glass shapes, shared by both passes. Works in drawing-buffer pixels,
// origin bottom-left (gl_FragCoord).
const shapes = (max) => /* glsl */`
#define MAX ${max}
uniform vec2 uSize;        // drawing buffer, px
uniform float uScale;      // drawing-buffer px per CSS px
uniform float uMorph;
uniform vec2 uLight;       // toward the light, y up
uniform int uN;
uniform vec4 uBox[MAX];    // centre x, y, half width, half height
uniform vec4 uRad[MAX];    // corner radii: top-right, bottom-right, top-left, bottom-left
uniform vec4 uA[MAX];      // bevel, frost, light/dark (0..1), dim (0..1)
uniform vec4 uB[MAX];      // touch x, y, touch light, opacity
uniform vec4 uC[MAX];      // lens gain, morph group (1: flows into the others in it)

float sdRound(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}
float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float piece(vec2 p, int i) { return sdRound(p - uBox[i].xy, uBox[i].zw, uRad[i]); }
// The glass field: pieces in a morph group flow together, the rest are
// separate. Pieces come in paint order; where pieces overlap, \`top\` is the
// uppermost one under p and \`inside\` how many contain it.
float scene(vec2 p, out int idx, out int top, out int inside) {
  float dg = 1e5; float dn = 1e5; float best = 1e5; idx = 0; top = -1; inside = 0;
  for (int i = 0; i < MAX; i++) {
    if (i >= uN) break;
    float di = piece(p, i);
    if (uC[i].y > 0.5) dg = smin(dg, di, uMorph); else dn = min(dn, di);
    if (di < best) { best = di; idx = i; }
    if (di < 0.0) { top = i; inside++; }
  }
  return min(dg, dn);
}
float sd(vec2 p) { int k; int t; int c; return scene(p, k, t, c); }
float sdTop(vec2 p, int top) {
  for (int i = 0; i < MAX; i++) { if (i == top) return piece(p, i); }
  return 1e5;
}
// The rim's outward normal at p (of the uppermost piece where pieces overlap).
vec2 rimNormal(vec2 p, bool own, int top, float e) {
  return own
    ? normalize(vec2(sdTop(p + vec2(e, 0.0), top) - sdTop(p - vec2(e, 0.0), top), sdTop(p + vec2(0.0, e), top) - sdTop(p - vec2(0.0, e), top)) + 1e-6)
    : normalize(vec2(sd(p + vec2(e, 0.0)) - sd(p - vec2(e, 0.0)), sd(p + vec2(0.0, e)) - sd(p - vec2(0.0, e))) + 1e-6);
}
`;

// The glass body, drawn into the scene canvas over the finished frame: the
// bend of whatever the scene draws behind it, Clear frost, the veil, the
// shadow. The edge light is not here: it is drawn above the page (below).
export const GLASS_FRAGMENT = /* glsl */`
uniform sampler2D uFrame;
uniform float uDisperse;
${shapes(MAX_GLASS)}
vec4 at(vec2 p) { return texture2D(uFrame, clamp(p / uSize, vec2(0.0), vec2(1.0))); }
vec4 frost(vec2 p, float px) {
  if (px < 0.6) return at(p);
  vec4 c = at(p) * 0.25;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472 + 0.5;
    c += at(p + vec2(cos(a), sin(a)) * px) * 0.125;
  }
  return c;
}
void main() {
  vec2 p = gl_FragCoord.xy;
  vec4 src = at(p);
  int idx; int top; int inside;
  float d = scene(p, idx, top, inside);
  // Overlapping glass: only the uppermost piece draws there.
  bool own = inside > 1;
  if (own) { idx = top; d = sdTop(p, top); }
  float s = uScale;
  if (d > 30.0 * s) { gl_FragColor = src; return; }

  // Soft shadow a little below the glass, outside it (premultiplied black).
  float ds = sd(p + vec2(0.0, 7.0 * s));
  float lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
  float shadow = (0.07 + 0.09 * lum) * (ds < 0.0 ? 1.0 : exp(-ds / (9.0 * s))) * smoothstep(-1.0, 1.0, d);
  vec4 col = vec4(src.rgb * (1.0 - shadow), src.a * (1.0 - shadow) + shadow);

  if (d < 1.0) {
    vec4 A = uA[idx]; vec4 B = uB[idx]; vec4 C = uC[idx];
    vec2 n = rimNormal(p, own, top, 0.7 * s);
    float din = max(-d, 0.0);
    float bev = A.x * s;
    float t = clamp(din / bev, 0.0, 1.0);
    // Rounded bevel: the bend is strongest at the very rim, gone where the
    // glass turns flat.
    float h = sqrt(1.0 - (1.0 - t) * (1.0 - t));
    float off = C.x * bev * (1.0 - h) * 1.6;
    float fr = A.y * s;
    vec4 g;
    if (uDisperse > 0.0 && off > 0.05) {
      vec4 gr = frost(p - n * off * (1.0 - uDisperse), fr);
      vec4 gg = frost(p - n * off, fr);
      vec4 gb = frost(p - n * off * (1.0 + uDisperse), fr);
      g = vec4(gr.r, gg.g, gb.b, gg.a);
    } else {
      g = frost(p - n * off, fr);
    }
    // A bright scene behind dims what shows through (adaptation).
    g.rgb *= 1.0 - A.w * 0.55;
    // Light / dark veil (premultiplied).
    float m = A.z;
    vec3 veil = mix(vec3(0.11, 0.12, 0.14), vec3(1.0), m);
    float va = mix(0.16, 0.22, m);
    g = vec4(g.rgb * (1.0 - va) + veil * va, g.a * (1.0 - va) + va);
    // Edge antialiasing, and the element's own opacity.
    float cover = clamp(0.5 - d / s, 0.0, 1.0) * B.w;
    col = mix(col, g, cover);
  }
  gl_FragColor = col;
}
`;

// The edge light, drawn on a transparent canvas ABOVE the page, so nothing
// the page puts between the scene and the glass (labels, other cards) can
// hide a rim: a crisp line and a soft glow along the edge, brightest where it
// faces the light and again on the far side; touch light from the finger; and
// a faint dark line just inside, so the edge still reads over a bright scene.
// Premultiplied alpha.
export const GLASS_EDGE_FRAGMENT = /* glsl */`
${shapes(MAX_EDGE)}
void main() {
  vec2 p = gl_FragCoord.xy;
  int idx; int top; int inside;
  float d = scene(p, idx, top, inside);
  bool own = inside > 1;
  if (own) { idx = top; d = sdTop(p, top); }
  float s = uScale;
  if (d > 1.0 * s) { gl_FragColor = vec4(0.0); return; }
  vec4 A = uA[idx]; vec4 B = uB[idx];
  vec2 n = rimNormal(p, own, top, 0.7 * s);
  float din = max(-d, 0.0);
  float bev = A.x * s;
  float t = clamp(din / bev, 0.0, 1.0);
  float facing = pow(max(dot(n, uLight), 0.0), 1.4);
  float back = pow(max(dot(n, -uLight), 0.0), 1.4);
  float rim = exp(-din / (0.9 * s)) * 0.9 + exp(-din / (5.0 * s)) * 0.3;
  float spec = rim * (facing + 0.55 * back) + 0.05 * pow(1.0 - t, 3.0);
  if (B.z > 0.001) {
    float r = length(p - B.xy) / s;
    spec += B.z * (0.32 * exp(-r * r / 5000.0) + 0.06);
  }
  float cover = clamp(0.5 - d / s, 0.0, 1.0) * B.w;
  float light = clamp(spec, 0.0, 1.0);
  float dark = 0.12 * exp(-din / (1.1 * s)) * (1.0 - light);
  gl_FragColor = vec4(vec3(light), light + dark * (1.0 - light)) * cover;
}
`;

/** Fills the uniforms for one canvas. Returns how many pieces were set. */
export function fillGlassUniforms(u, pieces, canvasRect, bufW, bufH, lens) {
  const s = bufW / canvasRect.width;
  const box = u.uBox.value; const rad = u.uRad.value; const A = u.uA.value; const B = u.uB.value; const C = u.uC.value;
  let n = 0;
  for (const g of pieces) {
    if (n >= box.length) break;
    const { r, radii, s: st, el } = g;
    const cx = (r.left + r.width / 2 - canvasRect.left) * s;
    const cy = bufH - (r.top + r.height / 2 - canvasRect.top) * s;
    box[n].set(cx, cy, (r.width / 2) * s, (r.height / 2) * s);
    rad[n].set(radii[0] * s, radii[1] * s, radii[2] * s, radii[3] * s);
    const big = Math.min(r.width, r.height) > BIG;
    const bevel = Math.max(6, Math.min(Math.min(r.width, r.height) * 0.42, 24));
    A[n].set(bevel, FROST_PX, el._glLight ? 1 : 0, el._glDim || 0);
    // Touch light only on glass that is pressed.
    B[n].set((st.gx - canvasRect.left) * s, bufH - (st.gy - canvasRect.top) * s, st.glow, g.opacity);
    // "Small lens": big glass bends less on the medium level.
    C[n].set(g.lens ? 0 : lens === 'small' && big ? 0.6 : 1, g.group, 0, 0);
    n++;
  }
  u.uN.value = n;
  u.uScale.value = s;
  u.uMorph.value = MORPH_PX * s;
  if (u.uDisperse) u.uDisperse.value = lens === 'all' ? 0.07 : 0;
  u.uSize.value.set(bufW, bufH);
  return n;
}
