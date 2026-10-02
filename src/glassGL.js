/*
 * Liquid glass drawn in WebGL, inside the 3D scenes themselves.
 *
 * Apple's material, as approved on the test page: a rounded bevel at the
 * rim bends what is behind the glass (refraction, with a slight colour
 * split), Clear frost, a thin veil, specular light on the rim (from the
 * top-left, swaying slowly, moved by device tilt), a soft shadow, touch light
 * from the finger, light/dark adaptation, and glass pieces that flow into each
 * other like drops when they come close.
 *
 * How: every scene canvas carries a GlassLayer (QualityScene.jsx). After the
 * scene (and its glow) has drawn, the layer copies the frame into a texture
 * and draws, over the same frame, the glass of every glass element that sits
 * on that canvas. The DOM element then only holds its text and icons
 * ([data-gl] in App.css takes its CSS glass away). Everything stays on the
 * GPU in the scene's own context: nothing is read back.
 *
 * Which canvas draws which glass: the topmost scene canvas that covers it
 * (the module's scene over the star field). Glass over no scene keeps the
 * CSS glass (LiquidGlass.js), as do Solid surfaces, reduced transparency and
 * the Frosted glass setting.
 */

import { LIQUID_GLASS_TARGETS } from './LiquidGlass';
import { getQuality, motionReduced } from './quality';
import { lightTilt } from './glassLight';

export const MAX_GLASS = 16;
const SELECTOR = LIQUID_GLASS_TARGETS.map((t) => t.selector).join(', ');
const COVER = 0.8;            // a canvas must cover this share of the glass
const FROST_PX = 1.2;         // Clear glass
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

/** Whether the WebGL glass runs at all, for this level and these settings. */
export function glassEnabled(q = getQuality()) {
  return q.surface === 'glass' && q.lens !== 'none';
}

export function registerGlassCanvas(canvas) {
  canvases.add(canvas);
  watchPress();
  return () => {
    canvases.delete(canvas);
    if (!canvases.size) clearMarks();
  };
}

function clearMarks() {
  for (const el of marked) el.removeAttribute('data-gl');
  marked.clear();
  frame = null;
}

// ─── Touch light ────────────────────────────────────────────────────────────

let pressWatched = false;
let pressed = null;
function watchPress() {
  if (pressWatched) return;
  pressWatched = true;
  const glassOf = (e) => e.target?.closest?.('[data-gl]');
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

const later = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? b : a);

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
    list.push({ el, r, s, opacity, radii: radiiOf(el, s, r.width, r.height) });
    byCanvas.set(best.c, list);
    keep.add(el);
  }
  for (const el of marked) if (!keep.has(el)) el.removeAttribute('data-gl');
  for (const el of keep) if (!marked.has(el)) el.setAttribute('data-gl', '');
  marked.clear();
  keep.forEach((el) => marked.add(el));

  let deg = LIGHT_DEG + lightTilt() * 1.5;
  if (!motionReduced()) deg += Math.sin(now / 1000 * 1.1) * SWAY_DEG;
  const a = (deg * Math.PI) / 180;
  frame = { byCanvas, light: [Math.cos(a), Math.sin(a)], lens: q.lens };
  return frame;
}

// ─── The shader ─────────────────────────────────────────────────────────────

export const GLASS_VERTEX = /* glsl */`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Works in drawing-buffer pixels, origin bottom-left (gl_FragCoord).
export const GLASS_FRAGMENT = /* glsl */`
#define MAX ${MAX_GLASS}
uniform sampler2D uFrame;
uniform vec2 uSize;        // drawing buffer, px
uniform float uScale;      // drawing-buffer px per CSS px
uniform float uMorph;
uniform float uDisperse;
uniform vec2 uLight;       // toward the light, y up
uniform int uN;
uniform vec4 uBox[MAX];    // centre x, y, half width, half height
uniform vec4 uRad[MAX];    // corner radii: top-right, bottom-right, top-left, bottom-left
uniform vec4 uA[MAX];      // bevel, frost, light/dark (0..1), dim (0..1)
uniform vec4 uB[MAX];      // touch x, y, touch light, opacity
uniform vec4 uC[MAX];      // lens gain

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
float scene(vec2 p, out int idx) {
  float d = 1e5; float best = 1e5; idx = 0;
  for (int i = 0; i < MAX; i++) {
    if (i >= uN) break;
    float di = sdRound(p - uBox[i].xy, uBox[i].zw, uRad[i]);
    d = smin(d, di, uMorph);
    if (di < best) { best = di; idx = i; }
  }
  return d;
}
float sd(vec2 p) { int k; return scene(p, k); }
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
  int idx; float d = scene(p, idx);
  float s = uScale;
  if (d > 30.0 * s) { gl_FragColor = src; return; }

  // Soft shadow a little below the glass, outside it (premultiplied black).
  float ds = sd(p + vec2(0.0, 7.0 * s));
  float lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
  float shadow = (0.07 + 0.09 * lum) * (ds < 0.0 ? 1.0 : exp(-ds / (9.0 * s))) * smoothstep(-1.0, 1.0, d);
  vec4 col = vec4(src.rgb * (1.0 - shadow), src.a * (1.0 - shadow) + shadow);

  if (d < 1.0) {
    vec4 A = uA[idx]; vec4 B = uB[idx]; vec4 C = uC[idx];
    float e = 0.7 * s;
    vec2 n = normalize(vec2(sd(p + vec2(e, 0.0)) - sd(p - vec2(e, 0.0)), sd(p + vec2(0.0, e)) - sd(p - vec2(0.0, e))) + 1e-6);
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
    // Specular: a crisp line and a soft glow along the rim, brightest where
    // the edge faces the light and again on the far edge.
    float facing = pow(max(dot(n, uLight), 0.0), 1.4);
    float back = pow(max(dot(n, -uLight), 0.0), 1.4);
    float rim = exp(-din / (0.9 * s)) * 0.9 + exp(-din / (5.0 * s)) * 0.3;
    float spec = rim * (facing + 0.55 * back) + 0.05 * pow(1.0 - t, 3.0);
    // Touch light from the finger.
    if (B.z > 0.001) {
      float r = length(p - B.xy) / s;
      spec += B.z * (0.32 * exp(-r * r / 5000.0) + 0.06);
    }
    g.rgb += vec3(spec);
    g.a = max(g.a, min(1.0, spec));
    // Edge antialiasing, and the element's own opacity.
    float cover = clamp(0.5 - d / s, 0.0, 1.0) * B.w;
    col = mix(col, g, cover);
  }
  gl_FragColor = col;
}
`;

/** Fills the uniforms for one canvas. Returns how many pieces were set. */
export function fillGlassUniforms(u, pieces, canvasRect, bufW, bufH, lens) {
  const s = bufW / canvasRect.width;
  const box = u.uBox.value; const rad = u.uRad.value; const A = u.uA.value; const B = u.uB.value; const C = u.uC.value;
  let n = 0;
  for (const g of pieces) {
    const { r, radii, s: st, el } = g;
    const cx = (r.left + r.width / 2 - canvasRect.left) * s;
    const cy = bufH - (r.top + r.height / 2 - canvasRect.top) * s;
    box[n].set(cx, cy, (r.width / 2) * s, (r.height / 2) * s);
    rad[n].set(radii[0] * s, radii[1] * s, radii[2] * s, radii[3] * s);
    const big = Math.min(r.width, r.height) > 140;
    const bevel = Math.max(6, Math.min(Math.min(r.width, r.height) * 0.42, 24));
    A[n].set(bevel, FROST_PX, el._glLight ? 1 : 0, el._glDim || 0);
    // Touch light only on glass that is pressed.
    B[n].set((st.gx - canvasRect.left) * s, bufH - (st.gy - canvasRect.top) * s, st.glow, g.opacity);
    // "Small lens": big glass bends less on the medium level.
    C[n].set(lens === 'small' && big ? 0.6 : 1, 0, 0, 0);
    n++;
  }
  u.uN.value = n;
  u.uScale.value = s;
  u.uMorph.value = MORPH_PX * s;
  u.uDisperse.value = lens === 'all' ? 0.07 : 0;
  u.uSize.value.set(bufW, bufH);
  return n;
}
