/*
 * The loading screen's drawing test: how fast this device draws a scene like
 * the simulator's, at each quality tier.
 *
 * An off-screen canvas draws a stand-in scene (a shell of glowing points, a
 * wireframe Bloch sphere, rings and bright beads, through the same bloom and
 * edge smoothing the scenes use) at a tier's pixel ratio and glow settings.
 * Each frame is timed until the GPU has finished it (a one-pixel read waits
 * for it), so the result is the drawing cost itself, not the display's
 * refresh. Tiers are tried from high down; the first whose frames fit the
 * budget wins. A tier whose first frames are clearly fast or clearly slow is
 * decided early, so a quick device finishes in well under a second.
 */

import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, FXAAEffect } from 'postprocessing';
import { SETTINGS } from './quality';

// Drawing budget per frame for the 3D scene alone, in ms. The rest of a 60 Hz
// frame (16.7 ms) goes to the glass, the page and the browser.
const BUDGET = { high: 7, medium: 7.5, low: 8.5 };
const WARM = 5;       // untimed frames first (shader compiles, first uploads)
const EARLY = 8;      // timed frames before an early decision
const FULL = 18;      // timed frames at most

const frame = () => new Promise((r) => requestAnimationFrame(r));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function buildScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 0, 14);
  const add = (o) => { scene.add(o); return o; };
  const glowing = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

  const n = 9000;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = i * 2.399963;
    pos.set([Math.cos(t) * r * 4.2, y * 4.2, Math.sin(t) * r * 4.2], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const shell = add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x3ee6ff, size: 0.06, ...glowing })));

  const sphere = add(new THREE.Mesh(new THREE.SphereGeometry(3, 32, 24), new THREE.MeshBasicMaterial({ color: 0x14b8a6, wireframe: true, transparent: true, opacity: 0.5 })));
  const rings = [0, 1, 2].map((i) => {
    const m = add(new THREE.Mesh(new THREE.TorusGeometry(4.6 + i * 0.7, 0.05, 12, 220), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xb06cff : 0xf0abfc, ...glowing })));
    m.rotation.set(1.1 + i * 0.5, i * 0.7, 0);
    return m;
  });
  for (let i = 0; i < 40; i++) {
    const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x3ee6ff : 0xffffff })));
    const a = (i / 40) * Math.PI * 2;
    b.position.set(Math.cos(a) * 5, Math.sin(a * 3) * 1.5, Math.sin(a) * 5);
  }
  return { scene, camera, tick: (t) => { shell.rotation.y = t * 0.3; sphere.rotation.y = t * 0.5; rings.forEach((r, i) => { r.rotation.z = t * (0.3 + i * 0.1); }); } };
}

// Median drawing time (ms) of one tier, or Infinity if it can't run.
async function timeTier(tier, onFrame) {
  const k = SETTINGS[tier];
  const canvas = document.createElement('canvas');
  let renderer = null;
  let composer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'high', powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(k.dpr());
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    const { scene, camera, tick } = buildScene();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    composer = new EffectComposer(renderer, { multisampling: k.msaa });
    composer.addPass(new RenderPass(scene, camera));
    const effects = [];
    if (k.bloom) {
      const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.3, intensity: 0.6, levels: k.bloomLevels });
      if (k.bloomScale < 1) {
        // The same shrink QualityComposer applies to the scenes' glow.
        const setSize = bloom.setSize.bind(bloom);
        bloom.setSize = (w, h) => setSize(Math.max(1, Math.round(w * k.bloomScale)), Math.max(1, Math.round(h * k.bloomScale)));
      }
      effects.push(bloom);
    }
    if (k.fxaa) effects.push(new FXAAEffect());
    if (effects.length) composer.addPass(new EffectPass(camera, ...effects));
    composer.setSize(window.innerWidth, window.innerHeight, false);
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    const times = [];
    for (let i = 0; i < WARM + FULL; i++) {
      await frame();
      const t0 = performance.now();
      tick(t0 / 1000);
      composer.render(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the GPU
      const dt = performance.now() - t0;
      onFrame?.();
      if (i < WARM) continue;
      times.push(dt);
      if (times.length === EARLY) {
        const m = median(times);
        if (m < BUDGET[tier] * 0.6 || m > BUDGET[tier] * 1.6) break;
      }
    }
    return median(times);
  } catch {
    return Infinity;
  } finally {
    composer?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss?.();
  }
}

/**
 * Runs the test. onStep(tier, ms) reports each tier tried.
 * Resolves to { tier, why }.
 */
export async function benchDevice(onStep) {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) return { tier: 'minimal', why: 'no WebGL 2' };
  for (const tier of ['high', 'medium', 'low']) {
    const ms = await timeTier(tier);
    onStep?.(tier, ms);
    if (ms <= BUDGET[tier]) return { tier, why: `${tier} scene drawn in ${ms.toFixed(1)} ms` };
  }
  return { tier: 'minimal', why: 'low scene over budget' };
}
