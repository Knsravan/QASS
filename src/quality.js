/*
 * Quality governor: keeps QASS smooth on every machine.
 *
 * Four tiers, each a set of knobs the scenes and the glass read:
 *
 *   high     sharp (up to 1.5x pixels), bloom, the colour fringe, every lens
 *   medium   1x pixels, bloom, small lenses only, fewer stars
 *   low      0.75x pixels, no bloom, no lenses, fewer stars still
 *   minimal  0.5x pixels and solid glass (no frosted blur): only if low is
 *            still too slow
 *
 * The first tier is a guess from the device (CPU cores, memory, the GPU's
 * name, a software renderer, a high-resolution touch screen). From then on
 * the frame times decide: frames that keep missing the display's refresh
 * step the tier down; a long stretch of easy frames steps it back up, but
 * never back into a tier that has already failed twice. Steady 30 fps counts
 * as slow too: smooth matters more than the last bit of sharpness.
 *
 * The tier is remembered for the tab (sessionStorage). `?quality=low`,
 * `medium`, `high` or `minimal` in the address pins it, for testing.
 */

const KEY = 'quantumUI_quality';
export const TIERS = ['minimal', 'low', 'medium', 'high'];

const deviceDpr = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

export const SETTINGS = {
  high: { dpr: () => Math.min(deviceDpr(), 1.5), bloom: true, aberration: true, msaa: 4, stars: 1, lens: 'all', beamMs: 200, bgFps: 60 },
  medium: { dpr: () => Math.min(deviceDpr(), 1), bloom: true, aberration: false, msaa: 0, stars: 0.6, lens: 'small', beamMs: 400, bgFps: 30 },
  low: { dpr: () => Math.min(deviceDpr(), 0.75), bloom: false, aberration: false, msaa: 0, stars: 0.35, lens: 'none', beamMs: 800, bgFps: 20 },
  minimal: { dpr: () => Math.min(deviceDpr(), 0.5), bloom: false, aberration: false, msaa: 0, stars: 0.2, lens: 'none', beamMs: 1000, bgFps: 10 },
};

const WINDOW_MS = 1000;   // frame times are judged a second at a time
const SETTLE_MS = 3000;   // ignore this long after start, a tier change or a new scene
const SLOW_STRIKES = 2;   // slow seconds in a row before stepping down
const FAST_STREAK = 10;   // easy seconds in a row before trying a step up
const SLOW_MS = 22;       // a median frame slower than this (~45 fps) is slow
const HITCH_MS = 50;      // a frame this long is a visible hitch
const HITCH_SHARE = 0.1;  // this share of hitches in a second is slow too

// ─── Device guess ───────────────────────────────────────────────────────────

function gpuName() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) return { name: 'none', software: true };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { name, software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) };
  } catch {
    return { name: 'unknown', software: false };
  }
}

// Integrated or older mobile GPUs that struggle with full-screen bloom at
// high resolution.
const MODEST_GPU = /Mali-[GT]?\d{2}\b|Mali-4|Adreno \(TM\) [2-6]\d\d|PowerVR|Intel\(R\) (HD|UHD) Graphics|Intel HD|Mesa Intel|Apple A(9|10|11|12)\b/i;

function guessTier() {
  const gpu = gpuName();
  if (gpu.software) return { tier: 'low', why: `software renderer (${gpu.name})` };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  if (cores <= 2 || memory <= 2) return { tier: 'low', why: `${cores} cores, ${memory} GB` };
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  const pixels = window.screen.width * window.screen.height * deviceDpr() ** 2;
  if (cores <= 4 || memory <= 4) return { tier: 'medium', why: `${cores} cores, ${memory} GB` };
  if (MODEST_GPU.test(gpu.name)) return { tier: 'medium', why: gpu.name };
  if (touch && pixels > 3.5e6) return { tier: 'medium', why: 'high-resolution touch screen' };
  if (navigator.connection?.saveData) return { tier: 'medium', why: 'data saver' };
  return { tier: 'high', why: gpu.name };
}

// ─── State ──────────────────────────────────────────────────────────────────

const pinned = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    return TIERS.includes(q) ? q : null;
  } catch { return null; }
})();

let state = null;
const listeners = new Set();

function init() {
  if (state) return state;
  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { /* fresh */ }
  if (pinned) {
    state = { tier: pinned, why: 'pinned by ?quality', ceiling: pinned, failed: {} };
  } else if (stored && TIERS.includes(stored.tier)) {
    state = { ...stored, why: `remembered: ${stored.why}` };
  } else {
    const g = guessTier();
    state = { tier: g.tier, why: g.why, ceiling: 'high', failed: {} };
  }
  mark();
  return state;
}

// CSS reads the tier too (App.css: solid glass on minimal).
function mark() {
  try { document.documentElement.dataset.quality = state.tier; } catch { /* no DOM */ }
}

function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify({ tier: state.tier, why: state.why, ceiling: state.ceiling, failed: state.failed })); } catch { /* this page only */ }
}

let snapshot = null;
export function getQuality() {
  const s = init();
  if (!snapshot || snapshot.tier !== s.tier) {
    const k = SETTINGS[s.tier];
    snapshot = { tier: s.tier, ...k, dpr: k.dpr() };
  }
  return snapshot;
}

export function qualityInfo() {
  const s = init();
  return { tier: s.tier, why: s.why, pinned: !!pinned, refreshMs: refreshMs };
}

export function subscribeQuality(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setTier(tier, why) {
  if (tier === state.tier) return;
  state.tier = tier;
  state.why = why;
  save();
  mark();
  settleUntil = performance.now() + SETTLE_MS;
  listeners.forEach((fn) => fn(getQuality()));
}

/** A new scene is loading: ignore the next few seconds of frames. */
export function settleQuality(ms = SETTLE_MS) {
  settleUntil = Math.max(settleUntil, performance.now() + ms);
}

export function resetQuality() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing stored */ }
}

// ─── Frame-time governor ────────────────────────────────────────────────────

let refreshMs = 1000 / 60; // the display's refresh: 60 Hz, or faster if seen
let settleUntil = 0;
let started = false;

export function startQualityGovernor() {
  init();
  if (started || pinned) return () => {};
  started = true;
  const frames = [];
  let windowStart = 0;
  let last = 0;
  let slow = 0;
  let fast = 0;
  let raf = 0;
  settleUntil = performance.now() + SETTLE_MS;

  const onVisible = () => { last = 0; settleQuality(1000); };
  document.addEventListener('visibilitychange', onVisible);

  const judge = () => {
    const sorted = [...frames].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const median = sorted[Math.floor(sorted.length / 2)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const hitches = frames.filter((t) => t > HITCH_MS).length / frames.length;
    // A second with only a handful of frames is slow whatever its spread.
    const few = frames.length < 5;
    if (!few) refreshMs = Math.min(refreshMs, Math.max(4, p10));
    const isSlow = few || median > SLOW_MS || hitches > HITCH_SHARE;
    const isEasy = median <= refreshMs * 1.12 && p90 <= refreshMs * 1.6 && hitches === 0;
    const i = TIERS.indexOf(state.tier);

    if (isSlow) {
      fast = 0;
      if (++slow < SLOW_STRIKES || i === 0) return;
      slow = 0;
      state.failed[state.tier] = (state.failed[state.tier] || 0) + 1;
      if (state.failed[state.tier] >= 2) state.ceiling = TIERS[Math.max(0, i - 1)];
      setTier(TIERS[i - 1], `frames ~${Math.round(1000 / median)} fps on ${state.tier}`);
    } else {
      slow = 0;
      if (!isEasy) { fast = 0; return; }
      if (++fast < FAST_STREAK) return;
      fast = 0;
      const up = TIERS[i + 1];
      if (up && TIERS.indexOf(up) <= TIERS.indexOf(state.ceiling)) setTier(up, `steady ${Math.round(1000 / median)} fps on ${state.tier}`);
    }
  };

  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (document.hidden || now < settleUntil || !last) {
      last = now;
      windowStart = now;
      frames.length = 0;
      return;
    }
    frames.push(now - last);
    last = now;
    if (now - windowStart < WINDOW_MS) return;
    judge();
    frames.length = 0;
    windowStart = now;
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisible);
    started = false;
  };
}
