// Captures the README's screenshots (docs/screenshots) from the production
// build at High quality, 1440 x 900, in headless Chromium.
//
//   npm run screenshots                  all of them
//   npm run screenshots -- 03-quantum-gates 05-entanglement
//
// The scenes run on a software renderer here (a few frames a second), so the
// script waits on what the scene shows, not on fixed times, wherever an
// animation has to finish first.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const OUT = 'docs/screenshots';
const ONLY = process.argv.slice(2);
const PORT = 4175;

const server = await preview({ preview: { port: PORT, strictPort: true, open: false } });
const BASE = `http://localhost:${PORT}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// A returning visitor with a saved device test for this GPU, so the loading
// screen's benchmark doesn't run (quality.js matches it by the GPU's name).
const returning = () => {
  const gl = document.createElement('canvas').getContext('webgl');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  const gpu = gl ? String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'none';
  localStorage.setItem('quantumUI_initialized', 'true');
  localStorage.setItem('quantumUI_device', JSON.stringify({ tier: 'high', why: 'screenshots', gpu, at: Date.now() }));
};

const contexts = new Set();
async function open(hash, { fresh = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  contexts.add(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
  if (!fresh) await page.addInitScript(returning);
  await page.goto(`${BASE}/?quality=high${hash ? `#${hash}` : ''}`);
  if (!fresh) await page.locator('[data-module]').first().waitFor({ state: 'attached', timeout: 120_000 });
  return page;
}

async function shot(page, name, { freeze = false } = {}) {
  await page.mouse.move(4, 896); // clear of every hover effect
  await page.waitForTimeout(1500);
  const file = `${OUT}/${name}.jpg`;
  if (!freeze) {
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  } else {
    // The WebGL glass is drawn one frame behind labels that move: invisible at
    // 60 fps, tens of pixels at a few frames a second. Pause the page's time
    // (Chrome's virtual time) and let it run in 16 ms frames, each given time
    // to finish drawing, so the last one lags as little as on a real screen.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
    for (let i = 0; i < 4; i++) {
      const expired = new Promise((resolve) => cdp.once('Emulation.virtualTimeBudgetExpired', resolve));
      await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 16 });
      await expired;
      await page.waitForTimeout(1500);
    }
    // Playwright's screenshot waits for an animation frame, which paused time
    // never gives; Chrome's own capture takes the compositor's frame as it is.
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    writeFileSync(file, Buffer.from(data, 'base64'));
  }
  console.log(`saved ${file}`);
}

async function openSidebar(page) {
  await page.locator('.sidebar-toggle-btn').click();
  await page.waitForFunction(() => document.querySelector('.sidebar-panel')?.getBoundingClientRect().width > 370, null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

const SHOTS = {
  '01-landing': async () => {
    const page = await open('', { fresh: true });
    await page.getByText('Initialize Simulator').waitFor();
    await page.waitForTimeout(9000); // the badge's mark draws on, the cards' lenses build
    await shot(page, '01-landing');
  },
  '02-hub': async () => {
    const page = await open('');
    await page.waitForTimeout(6000);
    await openSidebar(page);
    await shot(page, '02-hub');
  },
  '03-quantum-gates': async () => {
    const page = await open('gates');
    await page.waitForTimeout(6000);
    await openSidebar(page);
    await page.getByRole('button', { name: 'Apply X Gate' }).click();
    await page.getByText('Watch the vector swing 180°').waitFor({ timeout: 30_000 });
    // The card fits itself inside the window once the camera has settled.
    await page.waitForFunction(() => {
      const card = [...document.querySelectorAll('.glass-interactive')].find((el) => /what just happened/i.test(el.textContent));
      if (!card || Number(getComputedStyle(card).opacity) < 0.99) return false;
      const r = card.getBoundingClientRect();
      return r.right <= window.innerWidth - 8 && r.left >= 0 && r.top >= 0;
    }, null, { timeout: 60_000, polling: 500 });
    await page.waitForTimeout(3000);
    await shot(page, '03-quantum-gates');
  },
  '04-superposition': async () => {
    const page = await open('superposition');
    await page.waitForTimeout(6000);
    const next = page.locator('.quantum-nav-btn.next-btn');
    await next.click();
    await page.waitForTimeout(3000);
    await next.click();
    await page.locator('.sp-card.sp-tr').waitFor({ timeout: 30_000 });
    // After H the vector swings down to the equator, then sweeps round it.
    await page.waitForFunction(() => {
      const s = window.__qassSuperposition?.story.state();
      return s && s.step === 2 && Math.abs(s.theta - Math.PI / 2) < 0.03;
    }, null, { timeout: 120_000, polling: 500 });
    await page.waitForTimeout(6000);
    await shot(page, '04-superposition');
  },
  '05-entanglement': async () => {
    const page = await open('entanglement');
    await page.waitForTimeout(7000);
    await page.getByRole('button', { name: '3. Spooky Action Lab' }).click();
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /Measure Alice/ }).click();
    await page.waitForTimeout(7000); // the collapse, the stats and the explanation
    await shot(page, '05-entanglement');
  },
  '06-exponential-state-space': async () => {
    const page = await open('exponential');
    await page.waitForTimeout(8000);
    await page.locator('.quantum-pill-btn', { hasText: /^5Q/ }).click();
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: '2. Superposition Explosion' }).click();
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /Apply Hadamard to All/ }).click();
    await page.waitForTimeout(20000); // the ring's labels draw on
    await shot(page, '06-exponential-state-space', { freeze: true }); // its labels never stop turning
  },
  '07-interference': async () => {
    const page = await open('interference');
    await page.getByText('Explore Quantum Interference').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(7000); // the intro move ends and the card settles
    await shot(page, '07-interference');
  },
};

for (const [name, run] of Object.entries(SHOTS)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try {
    await run();
  } catch (e) {
    console.log(`FAILED ${name}: ${e.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
  // A shot that failed part-way leaves its page drawing: close it before the next.
  for (const c of contexts) await c.close().catch(() => {});
  contexts.clear();
}
await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
