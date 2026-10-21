import { describe, test, expect, beforeAll } from 'vitest';

// The state mappings the Gates module prints (GATES_STEPS' stateMapping, KaTeX),
// checked against the gates' matrices: a typo in a sign or a phase there is a
// wrong lesson, and nothing else would catch it.
const c = (re, im = 0) => [re, im];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const r = Math.SQRT1_2;
const KETS = {
  '0': [c(1), c(0)], '1': [c(0), c(1)],
  '+': [c(r), c(r)], '-': [c(r), c(-r)],
  'i': [c(r), c(0, r)], '-i': [c(r), c(0, -r)],
};
const T_PHASE = c(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4));
const MATRICES = {
  X: [[c(0), c(1)], [c(1), c(0)]],
  Y: [[c(0), c(0, -1)], [c(0, 1), c(0)]],
  Z: [[c(1), c(0)], [c(0), c(-1)]],
  H: [[c(r), c(r)], [c(r), c(-r)]],
  S: [[c(1), c(0)], [c(0), c(0, 1)]],
  T: [[c(1), c(0)], [c(0), T_PHASE]],
};
const apply = (m, v) => m.map((row) => row.reduce((s, x, j) => add(s, mul(x, v[j])), c(0)));
const COEFS = { '': c(1), '-': c(-1), 'i': c(0, 1), '-i': c(0, -1), 'e^{i\\pi/4}': T_PHASE, '-e^{i\\pi/4}': mul(c(-1), T_PHASE) };

// "|0\rangle", "-i|1\rangle", "e^{i\pi/4}|1\rangle", "\frac{|0\rangle - |1\rangle}{\sqrt{2}}", ...
function parse(tex) {
  const t = tex.replace(/\s+/g, '');
  const frac = t.match(/^\\frac\{(.*)\}\{\\sqrt\{2\}\}$/);
  if (frac) {
    // Split at the + and - between terms (not inside braces or a ket).
    const terms = [];
    let cur = '', depth = 0, inKet = false;
    for (let k = 0; k < frac[1].length; k++) {
      const ch = frac[1][k];
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (ch === '|') inKet = true;
      if (frac[1].startsWith('\\rangle', k)) inKet = false;
      if ((ch === '+' || ch === '-') && depth === 0 && !inKet && cur) { terms.push(cur); cur = ''; }
      cur += ch;
    }
    terms.push(cur);
    return terms.map(parse).reduce((s, v) => s.map((x, k) => add(x, mul(c(r), v[k]))), [c(0), c(0)]);
  }
  const m = t.match(/^\+?(.*?)\|(-?i|[01+-])\\rangle$/);
  if (!m || !(m[1] in COEFS) || !(m[2] in KETS)) throw new Error(`can't read ${tex}`);
  return KETS[m[2]].map((x) => mul(COEFS[m[1]], x));
}

let GATES_STEPS;
beforeAll(async () => {
  // The module comes with its scene; a few browser globals let it load in Node.
  globalThis.window = { matchMedia: () => ({ matches: false }), location: { search: '' }, devicePixelRatio: 1, screen: { width: 1, height: 1 }, addEventListener() {}, navigator: globalThis.navigator };
  ({ GATES_STEPS } = await import('./QuantumGates'));
});

describe('the Gates module\'s state mappings', () => {
  test('every printed mapping is what the gate\'s matrix does (phases included)', () => {
    let checked = 0;
    for (const step of GATES_STEPS) {
      const m = MATRICES[step.gate];
      expect(m, step.id).toBeDefined();
      for (const { in: from, out: to } of step.stateMapping) {
        const got = apply(m, parse(from));
        const want = parse(to);
        got.forEach((z, k) => {
          expect(z[0], `${step.gate}${from} = ${to}`).toBeCloseTo(want[k][0], 12);
          expect(z[1], `${step.gate}${from} = ${to}`).toBeCloseTo(want[k][1], 12);
        });
        checked++;
      }
    }
    expect(checked).toBe(GATES_STEPS.length * 4);
  });
});
