import { test, expect } from '@playwright/test';

// Every module in the curriculum (src/curriculum.jsx), in order, with the
// title the tab shows while it is open.
const MODULES = {
  'bit-vs-qubit': 'Classical Bit vs Qubit',
  'dirac-notation': 'Dirac Notation (Math)',
  superposition: 'Superposition & Measurement',
  gates: 'Classical Gates vs Quantum Gates',
  'multi-qubit-gates': 'Multi Qubit Gates',
  interference: 'Quantum Interference',
  entanglement: 'Entanglement',
  exponential: 'Exponential State Space',
  nocloning: 'No-Cloning Theorem',
  decoherence: 'Decoherence and Noise',
  'error-correction': 'Quantum Error Correction',
};
const MODULE_COUNT = Object.keys(MODULES).length;

// Errors the page reports while the test drives it. Audio can't start without a
// real gesture in a headless browser; that is expected and not a failure.
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/AudioContext|autoplay/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function expectModuleRendered(page, id) {
  await expect(page.locator('[data-module-load-error]')).toHaveCount(0);
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await expect(page).toHaveTitle(`${MODULES[id]} · QASS`);
  expect(await page.locator('canvas').count()).toBeGreaterThan(0);
}

test('the landing page boots into the hub', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/QASS/);
  await page.getByText('Initialize Simulator').click();
  // The device test runs, then the hub's sidebar lists every module.
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  expect(errors).toEqual([]);
});

test('every module opens from the hub and closes back to it', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByText('Initialize Simulator').click();
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });

  for (const id of Object.keys(MODULES)) {
    await test.step(id, async () => {
      // Open it the way a link or the Back button would (the URL's hash).
      await page.evaluate((m) => { window.location.hash = m; }, id);
      await page.waitForTimeout(6000); // the opening move and the cards' pop
      await expectModuleRendered(page, id);
      await page.evaluate(() => { window.location.hash = ''; });
      await page.waitForTimeout(5000); // the closing move
      await expect(page.locator('[data-module-load-error]')).toHaveCount(0);
      await expect(page).toHaveTitle('QASS · Quantum Algorithm State Simulator');
    });
  }
  expect(errors).toEqual([]);
});

test('a module named in the URL opens directly after the device test', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('quantumUI_initialized', 'true'));
  await page.goto('/#entanglement');
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await page.waitForTimeout(4000);
  await expectModuleRendered(page, 'entanglement');
  expect(errors).toEqual([]);
});

// The software renderer the tests run on always picks the Low level, where
// the WebGL glass (glassGL.js, GlassLayer in QualityScene.jsx) is off. Pinning
// High runs it: every scene draws the glass of the elements over it, and
// marks them [data-gl].
test('at High quality the scenes draw the glass, and modules open and close', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('quantumUI_initialized', 'true'));
  await page.goto('/?quality=high');
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'high');
  const drawnGlass = () => page.locator('[data-gl]').count();
  await expect.poll(drawnGlass, { timeout: 30_000 }).toBeGreaterThan(0);

  // The sidebar is the biggest piece of glass: it keeps its WebGL glass open and closed.
  await page.locator('.sidebar-toggle-btn').click();
  await expect(page.locator('.sidebar-panel[data-gl]')).toHaveCount(1, { timeout: 15_000 });
  await page.locator('.sidebar-toggle-btn').click();

  // One module of each kind: the hub's own scene, a module loaded on demand, and a scene of its own.
  for (const id of ['gates', 'entanglement', 'superposition']) {
    await test.step(id, async () => {
      await page.evaluate((m) => { window.location.hash = m; }, id);
      await page.waitForTimeout(6000);
      await expectModuleRendered(page, id);
      await expect.poll(drawnGlass, { timeout: 15_000 }).toBeGreaterThan(0);
      await page.evaluate(() => { window.location.hash = ''; });
      await page.waitForTimeout(5000);
      await expect(page).toHaveTitle('QASS · Quantum Algorithm State Simulator');
    });
  }
  expect(errors).toEqual([]);
});

test("if the simulator's code can't be downloaded, the page says so and offers a reload", async ({ page }) => {
  // A returning visitor whose device test is saved (for this runner's GPU) goes straight to the simulator.
  await page.addInitScript(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl ? String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'none';
    localStorage.setItem('quantumUI_initialized', 'true');
    localStorage.setItem('quantumUI_device', JSON.stringify({ tier: 'low', why: 'test', gpu, at: Date.now() }));
  });
  await page.route(/\/assets\/Simulator-[^/]*\.js$/, (route) => route.abort());
  await page.goto('/');
  const alert = page.locator('[data-module-load-error]');
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toContainText("The simulator didn't load");
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Back to hub' })).toHaveCount(0);
});

test('Classical Bit vs Qubit: flip the bit, measure the qubit, count the results', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByText('Initialize Simulator').click();
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await page.evaluate(() => { window.location.hash = 'bit-vs-qubit'; });
  await page.waitForTimeout(6000);

  const bit = page.getByRole('region', { name: 'Classical bit' });
  const qubit = page.getByRole('region', { name: 'Qubit' });
  await expect(bit.locator('.bvq-big')).toHaveText('0');
  await bit.getByRole('button', { name: 'Flip it (NOT gate)' }).click();
  await expect(bit.locator('.bvq-big')).toHaveText('1');

  await expect(qubit.locator('.bvq-big')).toHaveText('?');
  await expect(qubit).toContainText('No measurements yet');
  for (let i = 1; i <= 3; i++) {
    await qubit.getByRole('button', { name: 'Measure it' }).click();
    await expect(qubit.locator('.bvq-big')).toHaveText(/^\|[01]⟩$/);
    await expect(qubit).toContainText(`Measured ${i} ${i === 1 ? 'time' : 'times'}`);
    // Once measured, the odds are certain: one side reads 100%.
    await expect(qubit.locator('.bvq-odds-value').filter({ hasText: '100%' })).toHaveCount(1);
    await qubit.getByRole('button', { name: 'New qubit' }).click();
    await expect(qubit.locator('.bvq-big')).toHaveText('?');
  }
  expect(errors).toEqual([]);
});

test('Dirac Notation: the caption walks the four shots, replays and starts over', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('quantumUI_initialized', 'true'));
  await page.goto('/#dirac-notation');
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await page.waitForTimeout(4000);

  const caption = page.getByRole('region', { name: 'Dirac notation' });
  const titles = ['The ket', 'The ket |1⟩', 'Superposition', 'The bra ⟨ψ|'];
  await expect(caption.getByRole('button', { name: 'Back' })).toBeDisabled();
  for (let i = 0; i < titles.length; i++) {
    await expect(caption).toContainText(`Step ${i + 1} of 4 · ${titles[i]}`);
    await caption.getByRole('button', { name: 'Replay' }).click();
    if (i < titles.length - 1) await caption.getByRole('button', { name: 'Next' }).click();
  }
  await caption.getByRole('button', { name: 'Start over' }).click();
  await expect(caption).toContainText('Step 1 of 4 · The ket');
  expect(errors).toEqual([]);
});

test('Superposition: the cards build up, the sphere measures, and the state can be prepared again', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.setItem('quantumUI_initialized', 'true'));
  await page.goto('/#superposition');
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await page.waitForTimeout(4000);

  const next = page.locator('.quantum-nav-btn.next-btn');
  await expect(page.locator('.sp-card.sp-tl')).toContainText('The Ground State');
  await expect(page.locator('.sp-card.sp-bl')).toBeHidden();
  await next.click();
  await expect(page.locator('.sp-card.sp-bl')).toBeVisible();
  await expect(page.locator('.sp-card.sp-bl')).toContainText('Classical Limit');
  await next.click();
  await expect(page.locator('.sp-card.sp-tr')).toContainText('Infinite Possibilities');
  await next.click();
  await expect(page.locator('.sp-card.sp-br')).toContainText('Collapse: Your Turn');
  // Measure State: the state collapses to |0> or |1>
  await next.click();
  await expect(page.locator('.sp-card.sp-br')).toContainText('Wave Function Collapsed', { timeout: 15_000 });
  await page.locator('.sp-again').click();
  await expect(page.locator('.sp-card.sp-br')).toContainText('Collapse: Your Turn');
  expect(errors).toEqual([]);
});
