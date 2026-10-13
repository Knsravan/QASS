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
