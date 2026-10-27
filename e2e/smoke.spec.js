import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

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

// Waits until the stage rests on `id` (a module, or 'hub'): the move between
// the hub and the module has ended and the cards are in or popping
// (.canvas-container's data-stage and data-jelly-state, Simulator.jsx).
async function waitForStage(page, id) {
  const stage = page.locator('.canvas-container');
  await expect(stage).toHaveAttribute('data-stage', id, { timeout: 60_000 });
  await expect(stage).not.toHaveAttribute('data-jelly-state', /^(wait|out)$/, { timeout: 30_000 });
}

// Opens a module the way a link or the Back button would (the URL's hash), or the hub with ''.
async function goTo(page, id) {
  await page.evaluate((m) => { window.location.hash = m; }, id);
  await waitForStage(page, id || 'hub');
}

// A returning visitor: no landing page, and the device test is skipped when
// `tier` is given (it is saved for this runner's GPU, which quality.js checks).
async function returningVisitor(page, tier) {
  await page.addInitScript((t) => {
    localStorage.setItem('quantumUI_initialized', 'true');
    if (!t) return;
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl ? String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'none';
    localStorage.setItem('quantumUI_device', JSON.stringify({ tier: t, why: 'test', gpu, at: Date.now() }));
  }, tier);
}

async function expectModuleRendered(page, id) {
  await expect(page.locator('[data-module-load-error]')).toHaveCount(0);
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await expect(page).toHaveTitle(`${MODULES[id]} · QASS`);
  // The module's own scene, not the star field behind the page.
  await expect(page.locator('.canvas-container canvas').first()).toBeAttached();
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
      await goTo(page, id);
      await expectModuleRendered(page, id);
      await goTo(page, '');
      await expect(page.locator('[data-module-load-error]')).toHaveCount(0);
      await expect(page).toHaveTitle('QASS · Quantum Algorithm State Simulator');
    });
  }
  expect(errors).toEqual([]);
});

test('a module named in the URL opens directly after the device test', async ({ page }) => {
  const errors = collectErrors(page);
  await returningVisitor(page);
  await page.goto('/#entanglement');
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await waitForStage(page, 'entanglement');
  await expectModuleRendered(page, 'entanglement');
  expect(errors).toEqual([]);
});

// The software renderer the tests run on always picks the Low level, where
// the WebGL glass (glassGL.js, GlassLayer in QualityScene.jsx) is off. Pinning
// High runs it: every scene draws the glass of the elements over it, and
// marks them [data-gl].
test('at High quality the scenes draw the glass, and modules open and close', async ({ page }) => {
  const errors = collectErrors(page);
  await returningVisitor(page);
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
      await goTo(page, id);
      await expectModuleRendered(page, id);
      await expect.poll(drawnGlass, { timeout: 15_000 }).toBeGreaterThan(0);
      await goTo(page, '');
      await expect(page).toHaveTitle('QASS · Quantum Algorithm State Simulator');
    });
  }
  expect(errors).toEqual([]);
});

test("if the simulator's code can't be downloaded, the page says so and offers a reload", async ({ page }) => {
  // A returning visitor whose device test is saved goes straight to the simulator.
  await returningVisitor(page, 'low');
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
  await goTo(page, 'bit-vs-qubit');

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
  await returningVisitor(page);
  await page.goto('/#dirac-notation');
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await waitForStage(page, 'dirac-notation');

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
  await returningVisitor(page);
  await page.goto('/#superposition');
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  await waitForStage(page, 'superposition');

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
  // The sphere now holds a superposition: measuring it is the Collapse card's, not the Ground State's.
  await expect(page.locator('.sp-card.sp-tl').getByRole('button', { name: 'Measure it' })).toHaveCount(0);
  // Measure State: the state collapses to |0> or |1>. The collapse is an animation
  // in the scene's own time, which runs slowly at a software renderer's frame rate.
  await next.click();
  await expect(page.locator('.sp-card.sp-br')).toContainText('Wave Function Collapsed', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Prepare |ψ⟩ again' }).click();
  await expect(page.locator('.sp-card.sp-br')).toContainText('Collapse: Your Turn');
  expect(errors).toEqual([]);
});

test("the sidebar: the circuit opens from the keyboard and draws the module's register; Advanced says it's coming", async ({ page }) => {
  const errors = collectErrors(page);
  await returningVisitor(page, 'low');
  await page.goto('/#exponential');
  await waitForStage(page, 'exponential');
  await page.locator('.sidebar-toggle-btn').click();
  const sidebar = page.locator('.sidebar-panel');

  // The circuit card is a real button: Enter opens it, Space closes it.
  const header = sidebar.getByRole('button', { name: 'Circuit Diagram' });
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await header.focus();
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  const summary = sidebar.locator('.liquid-exp-summary');
  await expect(summary).toContainText('1 Qubit = 2¹ Basis States');

  // It draws the register the module has: pick 3 qubits, then put them all in superposition.
  await page.locator('.quantum-pill-btn', { hasText: /^3Q/ }).click();
  await expect(summary).toContainText('3 Qubits = 2³ Basis States');
  await expect(summary).toContainText('1 of 8 basis states');
  await expect(sidebar.locator('.liquid-multi-row')).toHaveCount(3);
  await page.getByRole('button', { name: '2. Superposition Explosion' }).click();
  await page.getByRole('button', { name: /Apply Hadamard to All/ }).click();
  await expect(summary).toContainText('8 amplitudes, all equal');
  await expect(sidebar.locator('.liquid-gate-h')).toHaveCount(3);

  await header.focus();
  await page.keyboard.press(' ');
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toHaveCount(0);

  // Advanced isn't built yet: the tab says so and offers the way back.
  await page.getByRole('tab', { name: 'Advanced' }).click();
  await expect(sidebar.locator('.sidebar-advanced')).toContainText('Advanced mode is coming soon');
  await sidebar.getByRole('button', { name: 'Back to Beginner' }).click();
  await expect(page.getByRole('tab', { name: 'Beginner' })).toHaveAttribute('aria-selected', 'true');
  await expect(header).toBeVisible();

  // Decoherence's and No-Cloning's pages carry no buttons for scenes that ignored them.
  for (const [id, gone] of [['decoherence', 'Thermal Noise Injection'], ['nocloning', 'Copy Operation']]) {
    await goTo(page, id);
    await expect(sidebar.getByRole('button', { name: 'Circuit Diagram' })).toBeVisible();
    await expect(sidebar.getByText(gone)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

// Moves cut short: the stage must always come to rest with its cards in.
test('moves cancelled part-way leave the hub and the modules whole', async ({ page }) => {
  const errors = collectErrors(page);
  await returningVisitor(page, 'low');
  await page.goto('/');
  await waitForStage(page, 'hub');
  const headline = page.getByRole('heading', { name: 'Where do you want to start today?' });
  const hash = (m) => page.evaluate((h) => { window.location.hash = h; }, m);

  // Close a module, start opening another while the hub's text waits to pop, then go back.
  await goTo(page, 'dirac-notation');
  await hash('');
  await expect(page.locator('.canvas-container')).toHaveAttribute('data-stage', 'hub', { timeout: 60_000 });
  await hash('superposition');
  await page.waitForTimeout(150);
  await hash('');
  await waitForStage(page, 'hub');
  await expect(headline).toBeVisible({ timeout: 15_000 });

  // Back while the hub's qubit is on its way to Interference: the hub is whole again.
  await hash('interference');
  await page.waitForTimeout(400);
  await hash('');
  await waitForStage(page, 'hub');
  await expect(headline).toBeVisible({ timeout: 15_000 });

  // Open a module again while it is closing: its cards come back.
  await goTo(page, 'decoherence');
  await hash('');
  await page.waitForTimeout(300);
  await hash('decoherence');
  await waitForStage(page, 'decoherence');
  await expect(page.locator('.canvas-container')).toHaveAttribute('data-jelly-state', 'run');
  await expect(page).toHaveTitle(`${MODULES.decoherence} · QASS`);
  expect(errors).toEqual([]);
});

test("a module that can't load lets you back to the hub", async ({ page }) => {
  await returningVisitor(page, 'low');
  await page.route(/\/assets\/EntanglementModule-[^/]*\.js$/, (route) => route.abort());
  await page.goto('/');
  await waitForStage(page, 'hub');
  await page.evaluate(() => { window.location.hash = 'entanglement'; });
  const alert = page.locator('[data-module-load-error]');
  await expect(alert).toBeVisible({ timeout: 60_000 });
  await alert.getByRole('button', { name: 'Back to hub' }).click();
  await waitForStage(page, 'hub');
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Where do you want to start today?' })).toBeVisible();
});

test('accessibility: the Interference lesson works from the keyboard, results are announced, focus is kept', async ({ page }) => {
  const errors = collectErrors(page);
  await returningVisitor(page, 'low');
  await page.goto('/#interference');
  await waitForStage(page, 'interference');

  // Stage 2's gates, without dragging anything.
  await page.getByRole('button', { name: /Explore Quantum Interference/ }).click();
  for (const name of ['Apply the H gate', 'Apply the Z gate', 'Apply the second H gate']) {
    const apply = page.getByRole('button', { name });
    await apply.focus();
    await page.keyboard.press('Enter');
    await expect(apply).toHaveCount(0, { timeout: 20_000 });
  }
  await expect(page.getByText('What Just Happened?')).toBeVisible({ timeout: 20_000 });

  // Entanglement: a measurement is read out, and focus moves to the button that replaces Measure.
  await goTo(page, '');
  await goTo(page, 'entanglement');
  await page.getByRole('button', { name: '3. Spooky Action Lab' }).click();
  const measure = page.getByRole('button', { name: /Measure Alice/ });
  await measure.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: /Measured: Alice [01], Bob [01]\./ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Re-Entangle/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Measure Alice/ })).toBeFocused();

  // Display & accessibility opens from the top bar with the sidebar collapsed; Escape returns focus.
  const display = page.locator('.lg-nav').getByRole('button', { name: 'Display & accessibility' });
  await display.click();
  await expect(page.locator('.sidebar-panel')).not.toHaveClass(/collapsed/);
  await page.keyboard.press('Escape');
  await expect(display).toBeFocused();
  expect(errors).toEqual([]);
});

test('a phone gets the larger-screen message and can go on; a zoomed-in desktop is let in', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await phone.newPage();
  await page.goto('/');
  await expect(page.getByText('requires a larger screen')).toBeVisible();
  await page.getByRole('button', { name: 'Continue anyway' }).click();
  await expect(page.getByText('Initialize Simulator')).toBeVisible();
  await phone.close();

  // 1440 px at 200% zoom is a 720 px window.
  const desktop = await browser.newContext({ viewport: { width: 720, height: 450 } });
  const zoomed = await desktop.newPage();
  await zoomed.goto('/');
  await expect(zoomed.getByText('Initialize Simulator')).toBeVisible();
  await expect(zoomed.getByText('requires a larger screen')).toHaveCount(0);
  await desktop.close();
});

// The Content-Security-Policy that vercel.json sends: the app works under it
// (vite preview doesn't send it, so the test adds it to the page itself).
test('the app runs under its Content-Security-Policy, with no violations', async ({ page }) => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')); // tests run from the repository root
  const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value
    .replace('; upgrade-insecure-requests', ''); // the test server is plain http
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByText('Initialize Simulator').click();
  await expect(page.locator('[data-module]')).toHaveCount(MODULE_COUNT, { timeout: 120_000 });
  for (const id of ['superposition', 'entanglement', 'error-correction']) {
    await goTo(page, id);
    await expectModuleRendered(page, id);
  }
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the collapsed sidebar names the icon the keyboard is on', async ({ page }) => {
  await returningVisitor(page, 'low');
  await page.goto('/');
  await waitForStage(page, 'hub');
  const chip = page.locator('[data-module="entanglement"]');
  await chip.focus(); // a programmatic focus counts as keyboard focus (:focus-visible)
  await expect(page.locator('.sidebar-focus-tip')).toHaveText(MODULES.entanglement);
  const tip = await page.locator('.sidebar-focus-tip').boundingBox();
  const icon = await chip.boundingBox();
  expect(tip.x).toBeGreaterThan(icon.x + icon.width); // beside the icon, not clipped by the sidebar
  await page.keyboard.press('Tab');
  await expect(page.locator('.sidebar-focus-tip')).not.toHaveText(MODULES.entanglement);
});

test('Superposition: in a short window, the cards on a side never overlap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await returningVisitor(page, 'low');
  await page.goto('/#superposition');
  await waitForStage(page, 'superposition');
  const next = page.locator('.quantum-nav-btn.next-btn');
  for (let i = 0; i < 3; i++) await next.click();
  await expect(page.locator('.sp-card.sp-br')).toContainText('Collapse: Your Turn');
  // The earlier card (Infinite Possibilities) folds to make room.
  await expect(page.locator('.sp-card.sp-tr')).toHaveAttribute('data-fit', 'fold');
  for (const [top, bottom] of [['tl', 'bl'], ['tr', 'br']]) {
    const a = await page.locator(`.sp-card.sp-${top}`).boundingBox();
    const b = await page.locator(`.sp-card.sp-${bottom}`).boundingBox();
    expect(a.y + a.height).toBeLessThanOrEqual(b.y);
  }
});

test('Classical Bit vs Qubit: in a narrow window, the readout stays clear of the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 657, height: 732 });
  await returningVisitor(page, 'low');
  await page.goto('/#bit-vs-qubit');
  await waitForStage(page, 'bit-vs-qubit');
  const bit = page.locator('.bvq-card-bit');
  const qubit = page.locator('.bvq-card-qubit');
  // Collapsed: both cards in view, beside the sidebar's icons rather than under them.
  const rail = await page.locator('.sidebar-panel').boundingBox();
  const b = await bit.boundingBox();
  const q = await qubit.boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(rail.x + rail.width);
  expect(q.x + q.width).toBeLessThanOrEqual(657);
  // Open: too narrow for the stage beside it, the sidebar opens over the stage, which
  // keeps its cards as they were (not squeezed into the strip beside the sidebar).
  await page.locator('.sidebar-toggle-btn').click();
  await expect(page.locator('.sidebar-panel')).toHaveClass(/over-stage/);
  await expect.poll(async () => (await bit.boundingBox()).width).toBe(b.width);
  expect((await qubit.boundingBox()).x).toBe(q.x);
});

test('Classical Gates vs Quantum Gates: Apply X turns |0⟩ into |1⟩, live, and Reset turns it back', async ({ page }) => {
  const errors = collectErrors(page);
  await returningVisitor(page, 'low');
  await page.goto('/#gates');
  await waitForStage(page, 'gates');
  const ket = page.locator('.gl-ket');
  await expect(ket).toHaveText('|0⟩');
  await page.getByRole('button', { name: 'Apply X Gate' }).click();
  // The readout follows the arrow through the turn and lands on |1⟩, P(1) = 100%; then the
  // card says what happened. The turn runs in the scene's own time: slow on a software renderer.
  await expect(ket).toHaveText('|1⟩', { timeout: 120_000 });
  await expect(page.locator('.gl-v').nth(1)).toHaveText('100%');
  await expect(page.locator('.gl-result')).toHaveCSS('opacity', '1', { timeout: 30_000 });
  await page.getByRole('button', { name: '↺ Reset State' }).click();
  await expect(ket).toHaveText('|0⟩', { timeout: 120_000 });
  expect(errors).toEqual([]);
});
