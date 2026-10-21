import { describe, test, expect, beforeEach, vi } from 'vitest';

// Just enough of a browser for quality.js: a GPU with a name, storage, media
// queries and the address bar. Each test loads the module fresh (it keeps state).
function fakeBrowser({ gpu = 'NVIDIA GeForce RTX 3070', search = '', stored = {}, media = {}, cores = 8, memory = 16 } = {}) {
  const store = new Map(Object.entries(stored).map(([k, v]) => [k, JSON.stringify(v)]));
  const gl = {
    getExtension: (n) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1 } : n === 'WEBGL_lose_context' ? { loseContext() {} } : null),
    getParameter: () => gpu,
  };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.document = { createElement: () => ({ getContext: () => gl }), documentElement: { dataset: {} } };
  globalThis.window = {
    location: { search },
    devicePixelRatio: 1,
    screen: { width: 1920, height: 1080 },
    matchMedia: (q) => ({ matches: !!media[q], addEventListener() {} }),
  };
  vi.stubGlobal('navigator', { hardwareConcurrency: cores, deviceMemory: memory });
  return store;
}
const load = async () => { vi.resetModules(); return import('./quality'); };

describe('the quality level', () => {
  beforeEach(() => { delete globalThis.window; });

  test('a fast GPU with no saved test guesses high; a software renderer guesses low', async () => {
    fakeBrowser();
    expect((await load()).getQuality().tier).toBe('high');
    fakeBrowser({ gpu: 'Google SwiftShader' });
    expect((await load()).getQuality().tier).toBe('low');
    fakeBrowser({ gpu: 'Intel(R) UHD Graphics 620' });
    expect((await load()).getQuality().tier).toBe('medium');
  });

  test('the saved device test wins, but only on the GPU it was made on', async () => {
    const test = { tier: 'low', why: 'test', gpu: 'NVIDIA GeForce RTX 3070', at: 1 };
    fakeBrowser({ stored: { quantumUI_device: test } });
    expect((await load()).getQuality().tier).toBe('low');
    fakeBrowser({ gpu: 'Apple M2', stored: { quantumUI_device: test } });
    expect((await load()).getQuality().tier).toBe('high');
    // The retired "minimal" level reads as low.
    fakeBrowser({ stored: { quantumUI_device: { ...test, tier: 'minimal' } } });
    expect((await load()).getQuality().tier).toBe('low');
  });

  test('?quality= pins a level over the device test, and the test cannot change it', async () => {
    fakeBrowser({ search: '?quality=medium', stored: { quantumUI_device: { tier: 'low', gpu: 'NVIDIA GeForce RTX 3070' } } });
    const q = await load();
    expect(q.getQuality().tier).toBe('medium');
    q.applyDeviceTest('high', 'fast');
    expect(q.getQuality().tier).toBe('medium');
  });

  test('the person\'s level and single-part choices apply, are saved, and a level clears the parts', async () => {
    const store = fakeBrowser();
    const q = await load();
    const seen = [];
    q.subscribeQuality((k) => seen.push(k.tier));
    q.setDisplayPart('glow', 'off');
    expect(q.getQuality().bloom).toBe(false);
    q.setDisplayPart('fps', '30');
    expect(q.getQuality().fpsCap).toBe(30);
    expect(q.getQuality().bgFps).toBeLessThanOrEqual(30);
    q.setDisplayLevel('low');
    expect(q.getQuality()).toMatchObject({ tier: 'low', bloom: true, fpsCap: 0 });
    expect(JSON.parse(store.get('quantumUI_display'))).toEqual({ level: 'low', parts: {} });
    expect(seen).toEqual(['high', 'high', 'low']);
  });

  test('solid surfaces turn the lens off; the system\'s reduced motion is followed', async () => {
    fakeBrowser({ media: { '(prefers-reduced-motion: reduce)': true } });
    const q = await load();
    expect(q.getQuality().motion).toBe('reduced');
    expect(q.motionReduced()).toBe(true);
    q.setDisplayPart('surface', 'solid');
    expect(q.getQuality().lens).toBe('none');
  });

  test('the landing page shows everything at high, then the level returns', async () => {
    fakeBrowser({ gpu: 'Google SwiftShader' });
    const q = await load();
    q.setLandingMode(true);
    expect(q.getQuality().tier).toBe('high');
    q.setLandingMode(false);
    expect(q.getQuality().tier).toBe('low');
  });
});
