/*
 * Quality: how the simulator looks and runs on this device.
 *
 * Three levels, each a set of knobs the scenes and the glass read:
 *
 *   high    sharp (up to 1.5x pixels, antialiased), full glow, the colour
 *           fringe, every liquid glass lens
 *   medium  1x pixels with edge smoothing, glow worked out at half size,
 *           a small lens on big glass, fewer stars
 *   low     0.85x pixels with edge smoothing, glow at a third of the size,
 *           frosted glass without bending, fewer stars still
 *
 * The level is chosen once, by the loading screen's device test (BootLoader,
 * deviceBench.js), and saved with the device's GPU name (localStorage). It
 * never changes by itself afterwards. Until a test has run, a guess from the
 * device stands.
 *
 * On top of it, the Display & Accessibility panel (DisplayPanel.jsx) lets
 * people pick another level, or set single parts (glow, frame rate,
 * sharpness, glass, stars, motion, solid surfaces); those choices are saved
 * too and win over the level.
 *
 * The landing page always shows everything at high (setLandingMode). The
 * address can pin a level for testing: `?quality=high`, `medium` or `low`.
 */

const DEVICE_KEY = 'quantumUI_device';   // the device test's result
const DISPLAY_KEY = 'quantumUI_display'; // the person's own display choices
export const TIERS = ['low', 'medium', 'high'];

const deviceDpr = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

export const SETTINGS = {
  high: { dpr: () => Math.min(deviceDpr(), 1.5), bloom: true, bloomScale: 1, bloomLevels: 8, fxaa: false, aberration: true, msaa: 4, stars: 1, lens: 'all', beamMs: 200, bgFps: 60 },
  medium: { dpr: () => Math.min(deviceDpr(), 1), bloom: true, bloomScale: 0.5, bloomLevels: 6, fxaa: true, aberration: false, msaa: 0, stars: 0.6, lens: 'small', beamMs: 400, bgFps: 30 },
  low: { dpr: () => Math.min(deviceDpr(), 0.85), bloom: true, bloomScale: 0.34, bloomLevels: 5, fxaa: true, aberration: false, msaa: 0, stars: 0.35, lens: 'none', beamMs: 800, bgFps: 20 },
};

// The single parts the panel can set, and what each choice means.
export const PARTS = {
  glow: { label: 'Glow', options: { full: 'Full', soft: 'Soft', off: 'Off' }, of: (k) => (!k.bloom ? 'off' : k.bloomScale >= 1 ? 'full' : 'soft') },
  fps: { label: 'Frame rate', options: { max: 'Display', 60: '60 fps', 30: '30 fps' }, of: (k) => (k.fpsCap ? String(k.fpsCap) : 'max') },
  sharp: { label: 'Sharpness', options: { sharp: 'Sharp', standard: 'Standard', light: 'Light' }, of: (k) => (k.msaa ? 'sharp' : k.dprScale >= 1 ? 'standard' : 'light') },
  lens: { label: 'Liquid glass', options: { all: 'Full lens', small: 'Small lens', none: 'Frosted' }, of: (k) => k.lens },
  stars: { label: 'Stars', options: { many: 'Many', some: 'Fewer', few: 'Few' }, of: (k) => (k.stars >= 1 ? 'many' : k.stars >= 0.6 ? 'some' : 'few') },
  motion: { label: 'Motion', options: { full: 'Full', reduced: 'Reduced' }, of: (k) => k.motion },
  surface: { label: 'Glass surfaces', options: { glass: 'See-through', solid: 'Solid' }, of: (k) => k.surface },
};

const reducedMotionMedia = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const reducedTransparencyMedia = () => !!window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;

// Applies the person's single-part choices over a level's settings.
function withParts(base, parts) {
  const k = { ...base, dprScale: base.dpr() / Math.min(deviceDpr(), 1), fpsCap: 0, motion: reducedMotionMedia() ? 'reduced' : 'full', surface: reducedTransparencyMedia() ? 'solid' : 'glass' };
  const p = parts || {};
  if (p.glow === 'full') Object.assign(k, { bloom: true, bloomScale: 1, bloomLevels: 8 });
  if (p.glow === 'soft') Object.assign(k, { bloom: true, bloomScale: 0.34, bloomLevels: 5 });
  if (p.glow === 'off') Object.assign(k, { bloom: false, aberration: false });
  if (p.fps === '60') k.fpsCap = 60;
  if (p.fps === '30') k.fpsCap = 30;
  if (p.fps === 'max') k.fpsCap = 0;
  if (p.sharp === 'sharp') Object.assign(k, { dpr: () => Math.min(deviceDpr(), 1.5), msaa: 4, fxaa: false });
  if (p.sharp === 'standard') Object.assign(k, { dpr: () => Math.min(deviceDpr(), 1), msaa: 0, fxaa: true });
  if (p.sharp === 'light') Object.assign(k, { dpr: () => Math.min(deviceDpr(), 0.85), msaa: 0, fxaa: true });
  if (p.lens) k.lens = p.lens;
  if (p.stars) k.stars = { many: 1, some: 0.6, few: 0.35 }[p.stars] ?? k.stars;
  if (p.motion) k.motion = p.motion;
  if (p.surface) k.surface = p.surface;
  if (k.surface === 'solid') k.lens = 'none';
  if (k.fpsCap) k.bgFps = Math.min(k.bgFps, k.fpsCap);
  k.dprScale = k.dpr() / Math.min(deviceDpr(), 1);
  return k;
}

// ─── Device guess (before any test) ─────────────────────────────────────────

export function gpuName() {
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

function guessTier(gpu) {
  if (gpu.software) return { tier: 'low', why: `software renderer (${gpu.name})` };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  if (cores <= 2 || memory <= 2) return { tier: 'low', why: `${cores} cores, ${memory} GB` };
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  const pixels = window.screen.width * window.screen.height * deviceDpr() ** 2;
  if (cores <= 4 || memory <= 4) return { tier: 'medium', why: `${cores} cores, ${memory} GB` };
  if (MODEST_GPU.test(gpu.name)) return { tier: 'medium', why: gpu.name };
  if (touch && pixels > 3.5e6) return { tier: 'medium', why: 'high-resolution touch screen' };
  return { tier: 'high', why: gpu.name };
}

// ─── State ──────────────────────────────────────────────────────────────────

const pinned = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    return TIERS.includes(q) ? q : null;
  } catch { return null; }
})();

let gpu = null;
const thisGpu = () => (gpu ||= gpuName());
let state = null;         // { tier, why }: the device's level
let display = null;       // { level: 'auto' | tier, parts: {} }: the person's choices
let landing = false;
let version = 0;
const listeners = new Set();

const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* this visit only */ } };

/** The device test's saved result, if it was made on this device's GPU. */
export function deviceProfile() {
  const p = readJson(DEVICE_KEY);
  if (!p || p.gpu !== thisGpu().name) return null;
  // An older result may name the retired "minimal" level: that is low now.
  return TIERS.includes(p.tier) ? p : { ...p, tier: 'low' };
}

function init() {
  if (state) return state;
  const profile = deviceProfile();
  if (pinned) state = { tier: pinned, why: 'pinned by ?quality' };
  else if (profile) state = { tier: profile.tier, why: profile.why };
  else state = guessTier(thisGpu());
  const d = readJson(DISPLAY_KEY);
  display = { level: d && (d.level === 'auto' || TIERS.includes(d.level)) ? d.level : 'auto', parts: (d && d.parts) || {} };
  mark();
  return state;
}

function changed() {
  version++;
  mark();
  listeners.forEach((fn) => fn(getQuality()));
}

let snapshot = null;
let snapshotVersion = -1;
export function getQuality() {
  init();
  if (!snapshot || snapshotVersion !== version) {
    const tier = landing ? 'high' : pinned || (display.level === 'auto' ? state.tier : display.level);
    const k = landing ? withParts(SETTINGS.high, null) : withParts(SETTINGS[tier], display.parts);
    snapshot = { ...k, tier, dpr: k.dpr() };
    snapshotVersion = version;
  }
  return snapshot;
}

// CSS reads the level and two of the choices (App.css).
function mark() {
  try {
    const q = getQualityUnsafe();
    const root = document.documentElement;
    root.dataset.quality = q.tier;
    if (q.surface === 'solid') root.dataset.glass = 'solid'; else delete root.dataset.glass;
    if (q.motion === 'reduced') root.dataset.motion = 'reduced'; else delete root.dataset.motion;
  } catch { /* no DOM */ }
}
function getQualityUnsafe() { return state ? getQuality() : { tier: 'high' }; }

export function subscribeQuality(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** For the panel and the ?glassdebug readout. */
export function qualityInfo() {
  init();
  return { tier: getQuality().tier, deviceTier: state.tier, why: state.why, pinned: !!pinned, level: display.level, parts: { ...display.parts } };
}

/** Records the loading screen's device test. */
export function applyDeviceTest(tier, why) {
  init();
  if (!TIERS.includes(tier)) tier = 'low';
  writeJson(DEVICE_KEY, { tier, why, gpu: thisGpu().name, at: Date.now() });
  if (pinned) return;
  state = { tier, why };
  changed();
}

/** The person's level: 'auto' (the device test's) or a level. Clears single-part choices. */
export function setDisplayLevel(level) {
  init();
  display = { level, parts: {} };
  writeJson(DISPLAY_KEY, display);
  changed();
}

/** One single-part choice, e.g. setDisplayPart('glow', 'soft'). */
export function setDisplayPart(part, value) {
  init();
  display = { ...display, parts: { ...display.parts, [part]: value } };
  writeJson(DISPLAY_KEY, display);
  changed();
}

/** While the landing page shows, every scene and lens gets high. */
export function setLandingMode(on) {
  init();
  if (landing === on) return;
  landing = on;
  changed();
}
export const isLandingMode = () => landing;

/** Motion as the person (or their system) wants it. */
export const motionReduced = () => (state ? getQuality().motion === 'reduced' : reducedMotionMedia());

/** Forgets the device test and the display choices (?glassdebug's reset). */
export function resetQuality() {
  try { localStorage.removeItem(DEVICE_KEY); localStorage.removeItem(DISPLAY_KEY); } catch { /* nothing stored */ }
}

/** Sets up the level before the first scene is made. */
export function startQuality() {
  init();
  // Follow the system's motion and transparency settings when they change.
  const watch = (q) => window.matchMedia?.(q)?.addEventListener?.('change', changed);
  watch('(prefers-reduced-motion: reduce)');
  watch('(prefers-reduced-transparency: reduce)');
}
