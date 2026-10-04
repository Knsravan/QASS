import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import {
  getInitialState, GATES_MATRICES, applyMatrix, calculateProbabilities,
  gateNumQubits, getFinalState, isResultEntangled, calculateGateLogic, formatStateKet,
  GATE_ROTATIONS, BELL_OUTCOMES, interferenceProbabilities, stateVectorRAM,
  densityMatrix, SYNDROME_TABLE, bornProbabilities,
} from './quantumMath';

// The module math, checked against the textbook: gate matrices, partial traces
// and parity checks computed here from scratch rather than read back from the app.

// ─── Complex helpers ─────────────────────────────────────────────────────────

const c = (r, i = 0) => ({ r, i });
const mul = (a, b) => c(a.r * b.r - a.i * b.i, a.r * b.i + a.i * b.r);
const add = (a, b) => c(a.r + b.r, a.i + b.i);
const conj = (a) => c(a.r, -a.i);
const abs2 = (a) => a.r * a.r + a.i * a.i;
const expi = (t) => c(Math.cos(t), Math.sin(t));
const s = Math.SQRT1_2;

// |<a|b>|: 1 when two states are equal up to a global phase.
const overlap = (a, b) => {
  let acc = c(0);
  a.forEach((x, k) => { acc = add(acc, mul(conj(x), b[k])); });
  return Math.sqrt(abs2(acc));
};

const BASIS = {
  '0': [c(1), c(0)],
  '1': [c(0), c(1)],
  '+': [c(s), c(s)],
  '-': [c(s), c(-s)],
};

const kron = (...vs) => vs.reduce((acc, v) => acc.flatMap((a) => v.map((b) => mul(a, b))));

// All input combinations the module offers (each qubit |0>, |1> or |+>).
const inputCombos = (n) => (n === 0 ? [[]] : inputCombos(n - 1).flatMap((rest) => ['0', '1', '+'].map((b) => [b, ...rest])));

const MULTI_GATES = ['cnot', 'swap', 'cz', 'bell', 'toffoli'];

// ─── Dirac Notation ──────────────────────────────────────────────────────────

describe('the Born rule', () => {
  test('the odds are |α|² and |β|² of the state the vector points to, whatever its phase', () => {
    for (let theta = 0; theta <= Math.PI; theta += Math.PI / 20) {
      [0, 1.1, Math.PI * 1.25].forEach((phi) => {
        const [alpha, beta] = [c(Math.cos(theta / 2)), mul(expi(phi), c(Math.sin(theta / 2)))];
        const { p0, p1 } = bornProbabilities(theta);
        expect(p0).toBeCloseTo(abs2(alpha), 12);
        expect(p1).toBeCloseTo(abs2(beta), 12);
        expect(p0 + p1).toBeCloseTo(1, 12);
      });
    }
  });

  test('the module\'s four steps: |0>, |1>, |+> and the bra example', () => {
    expect(bornProbabilities(0)).toEqual({ p0: 1, p1: 0 });
    expect(bornProbabilities(Math.PI).p1).toBeCloseTo(1, 12);
    expect(bornProbabilities(Math.PI / 2).p0).toBeCloseTo(0.5, 12);
    // 54° from |0> leans toward 0: about 79% / 21%, not the 30% / 70% it once listed.
    expect(bornProbabilities(Math.PI * 0.3).p0).toBeCloseTo(0.794, 3);
  });
});

// ─── Classical vs Quantum Gates ──────────────────────────────────────────────

describe('single-qubit gates drawn on the Bloch sphere', () => {
  const UNITARIES = {
    'pauli-x': [[c(0), c(1)], [c(1), c(0)]],
    'pauli-y': [[c(0), c(0, -1)], [c(0, 1), c(0)]],
    'pauli-z': [[c(1), c(0)], [c(0), c(-1)]],
    hadamard: [[c(s), c(s)], [c(s), c(-s)]],
    's-gate': [[c(1), c(0)], [c(0), c(0, 1)]],
    't-gate': [[c(1), c(0)], [c(0), expi(Math.PI / 4)]],
  };

  // Bloch vector (x, y, z) of a qubit state, placed in the scene at (y, z, x)
  // (|0> up at +Y, |+> at +Z), as the module draws it.
  const sceneVector = ([a, b]) => {
    const ab = mul(conj(a), b);
    return new THREE.Vector3(2 * ab.i, abs2(a) - abs2(b), 2 * ab.r);
  };

  const rotate = (id, v) => {
    const { axis, angle } = GATE_ROTATIONS[id];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), angle);
    return v.clone().applyQuaternion(q);
  };

  // A spread of states: the poles, the equator, and a few in between.
  const STATES = [
    BASIS['0'], BASIS['1'], BASIS['+'], BASIS['-'],
    [c(s), c(0, s)],
    [c(Math.cos(0.4)), mul(expi(1.1), c(Math.sin(0.4)))],
    [c(Math.cos(1.2)), mul(expi(-2.3), c(Math.sin(1.2)))],
  ];

  test('every gate step has a rotation', () => {
    expect(Object.keys(GATE_ROTATIONS).sort()).toEqual(Object.keys(UNITARIES).sort());
  });

  test.each(Object.keys(UNITARIES))('%s: the sphere turns the vector where the gate matrix sends the state', (id) => {
    STATES.forEach((state) => {
      const expected = sceneVector(applyMatrix(UNITARIES[id], state));
      const drawn = rotate(id, sceneVector(state));
      expect(drawn.distanceTo(expected)).toBeLessThan(1e-9);
    });
  });

  test.each(Object.keys(UNITARIES))('%s: the shown start state is one the gate visibly moves', (id) => {
    const start = GATE_ROTATIONS[id].startsAtPlus ? BASIS['+'] : BASIS['0'];
    const before = sceneVector(start);
    expect(rotate(id, before).distanceTo(before)).toBeGreaterThan(0.5);
  });

  test('the step that matters for phase gates: |0> is unchanged by Z, S and T', () => {
    ['pauli-z', 's-gate', 't-gate'].forEach((id) => {
      const v = sceneVector(BASIS['0']);
      expect(rotate(id, v).distanceTo(v)).toBeLessThan(1e-9);
    });
  });
});

// ─── Multi-Qubit Gates ───────────────────────────────────────────────────────

describe('multi-qubit gate results', () => {
  // Purity Tr(ρ_k²) of qubit k's reduced state (qubit 0 is the most significant bit).
  const qubitPurity = (state, n, k) => {
    const shift = n - 1 - k;
    const rho = [[c(0), c(0)], [c(0), c(0)]];
    for (let i = 0; i < state.length; i++) {
      for (let j = 0; j < state.length; j++) {
        if ((i & ~(1 << shift)) !== (j & ~(1 << shift))) continue; // trace out the rest
        const a = (i >> shift) & 1;
        const b = (j >> shift) & 1;
        rho[a][b] = add(rho[a][b], mul(state[i], conj(state[j])));
      }
    }
    return abs2(rho[0][0]) + abs2(rho[1][1]) + 2 * abs2(rho[0][1]);
  };

  // A pure state is a product of single-qubit states iff every qubit's reduced state is pure.
  const isEntangledByPartialTrace = (state, n) =>
    Array.from({ length: n }, (_, k) => qubitPurity(state, n, k)).some((p) => p < 1 - 1e-9);

  test.each(MULTI_GATES)('%s: entanglement is detected exactly when a qubit is left mixed', (gate) => {
    const n = gateNumQubits(gate);
    inputCombos(n).forEach((inputs) => {
      const expected = isEntangledByPartialTrace(getFinalState(gate, inputs), n);
      expect(isResultEntangled(gate, inputs), `${gate} |${inputs.join('')}>`).toBe(expected);
    });
  });

  test('known cases', () => {
    expect(isResultEntangled('cnot', ['+', '0'])).toBe(true);
    expect(isResultEntangled('cnot', ['1', '0'])).toBe(false);
    expect(isResultEntangled('cnot', ['+', '+'])).toBe(false); // |+> target is an X eigenstate
    expect(isResultEntangled('cz', ['+', '+'])).toBe(true);
    expect(isResultEntangled('cz', ['+', '1'])).toBe(false); // phase kickback only
    expect(isResultEntangled('bell', ['0', '0'])).toBe(true);
    expect(isResultEntangled('bell', ['+', '0'])).toBe(false); // H takes |+> back to |0>
    expect(isResultEntangled('toffoli', ['+', '+', '0'])).toBe(true);
    inputCombos(2).forEach((inputs) => expect(isResultEntangled('swap', inputs)).toBe(false));
  });

  test('a two-qubit gate ignores the third input the module always passes', () => {
    inputCombos(3).forEach((inputs) => {
      expect(getFinalState('cnot', inputs)).toEqual(getFinalState('cnot', inputs.slice(0, 2)));
    });
  });

  test.each(MULTI_GATES)('%s: each sphere shows the state its qubit is really in', (gate) => {
    const n = gateNumQubits(gate);
    inputCombos(n).forEach((inputs) => {
      const { outputs, isEntangled } = calculateGateLogic(gate, inputs);
      if (isEntangled) {
        // No qubit has a state of its own; the spheres keep their inputs.
        expect(outputs).toEqual(inputs);
        return;
      }
      const shown = kron(...outputs.slice(0, n).map((b) => BASIS[b]));
      expect(overlap(shown, getFinalState(gate, inputs)), `${gate} |${inputs.join('')}> -> |${outputs.join('')}>`).toBeCloseTo(1, 9);
    });
  });

  test.each(MULTI_GATES)('%s: preserves normalisation for every input', (gate) => {
    inputCombos(gateNumQubits(gate)).forEach((inputs) => {
      const total = calculateProbabilities(getFinalState(gate, inputs)).reduce((sum, p) => sum + p.prob, 0);
      expect(total).toBeCloseTo(1, 10);
    });
  });

  test('the result is written as the right ket', () => {
    expect(formatStateKet(getFinalState('bell', ['0', '0']), 2)).toBe('\\frac{|00\\rangle + |11\\rangle}{\\sqrt{2}}');
    expect(formatStateKet(getFinalState('bell', ['1', '0']), 2)).toBe('\\frac{|00\\rangle - |11\\rangle}{\\sqrt{2}}');
    expect(formatStateKet(getFinalState('cz', ['+', '+']), 2)).toBe('\\frac{|00\\rangle + |01\\rangle + |10\\rangle - |11\\rangle}{2}');
    expect(formatStateKet(getFinalState('toffoli', ['+', '+', '0']), 3)).toBe('\\frac{|000\\rangle + |010\\rangle + |100\\rangle + |111\\rangle}{2}');
    expect(formatStateKet(getFinalState('cnot', ['1', '0']), 2)).toBe('|11\\rangle');
    expect(formatStateKet([c(0), c(0)], 1)).toBe('0');
  });

  test.each(MULTI_GATES)('%s: every printed ket is the actual state', (gate) => {
    // Reads the ket back into amplitudes and compares it with the state.
    const n = gateNumQubits(gate);
    inputCombos(n).forEach((inputs) => {
      const state = getFinalState(gate, inputs);
      const ket = formatStateKet(state, n);
      const terms = [...ket.matchAll(/(^|[-+]) ?(?:\\frac\{)?(-?)\|([01]+)\\rangle/g)];
      const amp = 1 / Math.sqrt(terms.length);
      const parsed = Array.from({ length: 2 ** n }, () => c(0));
      terms.forEach(([, sign, lead, bits]) => { parsed[parseInt(bits, 2)] = c(sign === '-' || lead === '-' ? -amp : amp); });
      parsed.forEach((p, k) => expect(p.r, `${gate} |${inputs.join('')}> = ${ket}`).toBeCloseTo(state[k].r, 9));
    });
  });
});

// ─── Entanglement ────────────────────────────────────────────────────────────

describe('Bell states', () => {
  // H on qubit 0 then CNOT maps |00>, |01>, |10>, |11> to Φ+, Ψ+, Φ-, Ψ-.
  const CIRCUIT_INPUT = { phi_plus: ['0', '0'], psi_plus: ['0', '1'], phi_minus: ['1', '0'], psi_minus: ['1', '1'] };
  const SIGN = { phi_plus: 1, psi_plus: 1, phi_minus: -1, psi_minus: -1 };

  test.each(Object.keys(CIRCUIT_INPUT))('%s: measurement can only give its listed outcomes, equally often', (id) => {
    const probs = calculateProbabilities(applyMatrix(GATES_MATRICES.bell, getInitialState(CIRCUIT_INPUT[id])));
    const possible = probs.filter((p) => p.prob > 1e-9).map((p) => p.index.toString(2).padStart(2, '0'));
    expect([...BELL_OUTCOMES[id]].sort()).toEqual(possible.sort());
    probs.filter((p) => p.prob > 1e-9).forEach((p) => expect(p.prob).toBeCloseTo(0.5, 10));
  });

  test.each(Object.keys(CIRCUIT_INPUT))('%s: the relative phase matches its name', (id) => {
    const state = applyMatrix(GATES_MATRICES.bell, getInitialState(CIRCUIT_INPUT[id]));
    const [first, second] = BELL_OUTCOMES[id].map((bits) => state[parseInt(bits, 2)].r);
    expect(Math.sign(first * second)).toBe(SIGN[id]);
  });

  test('Φ outcomes always agree and Ψ outcomes always disagree', () => {
    ['phi_plus', 'phi_minus'].forEach((id) => BELL_OUTCOMES[id].forEach((o) => expect(o[0]).toBe(o[1])));
    ['psi_plus', 'psi_minus'].forEach((id) => BELL_OUTCOMES[id].forEach((o) => expect(o[0]).not.toBe(o[1])));
  });
});

// ─── Quantum Interference ────────────────────────────────────────────────────

describe('Mach-Zehnder interference', () => {
  const H = [[c(s), c(s)], [c(s), c(-s)]];
  const phaseShift = (phi) => [[c(1), c(0)], [c(0), expi(phi)]];

  test('the detector odds are those of H, phase, H on |0>', () => {
    for (let phi = -2 * Math.PI; phi <= 2 * Math.PI; phi += Math.PI / 12) {
      const out = applyMatrix(H, applyMatrix(phaseShift(phi), applyMatrix(H, BASIS['0'])));
      const { p0, p1 } = interferenceProbabilities(phi);
      expect(p0).toBeCloseTo(abs2(out[0]), 10);
      expect(p1).toBeCloseTo(abs2(out[1]), 10);
      expect(p0 + p1).toBeCloseTo(1, 10);
    }
  });

  test('in phase every photon reaches |0>; a π shift sends every photon to |1>', () => {
    expect(interferenceProbabilities(0)).toEqual({ p0: 1, p1: 0 });
    expect(interferenceProbabilities(Math.PI).p1).toBeCloseTo(1, 12);
    expect(interferenceProbabilities(Math.PI / 2).p0).toBeCloseTo(0.5, 12);
  });
});

// ─── Exponential State Space ─────────────────────────────────────────────────

describe('state-vector memory', () => {
  test('the slider range (1 to 5 qubits) shows 2^n amplitudes of 16 bytes', () => {
    expect([1, 2, 3, 4, 5].map(stateVectorRAM)).toEqual(['32 Bytes', '64 Bytes', '128 Bytes', '256 Bytes', '512 Bytes']);
  });

  test('larger registers move up the units', () => {
    expect(stateVectorRAM(6)).toBe('1 KB');
    expect(stateVectorRAM(20)).toBe('16 MB');
    expect(stateVectorRAM(30)).toBe('16 GB (PC limit)');
    expect(stateVectorRAM(40)).toBe('16 TB');
  });

  test('50 qubits really is 16 petabytes', () => {
    expect(2 ** 50 * 16).toBe(16 * 1024 ** 5);
    expect(stateVectorRAM(50)).toBe('16 Petabytes (Supercomputer Limit)');
  });

  test('300 qubits outnumber the ~10^80 atoms in the universe', () => {
    expect(300 * Math.log10(2)).toBeGreaterThan(80);
    expect(stateVectorRAM(300)).toBe('Exceeds Atoms in Universe (~10⁸⁰)!');
  });
});

// ─── Decoherence ─────────────────────────────────────────────────────────────

describe('the noisy qubit\'s density matrix', () => {
  const NOISE = Array.from({ length: 21 }, (_, k) => k / 20);

  test('with no noise it is the pure state |+><+|', () => {
    expect(densityMatrix(0)).toEqual({ r01: 0.5, trSq: 1, purity: 100 });
  });

  test('stays a valid density matrix: trace 1, eigenvalues 1/2 ± r01 both non-negative', () => {
    NOISE.forEach((nl) => {
      const { r01 } = densityMatrix(nl);
      expect(r01).toBeGreaterThanOrEqual(0);
      expect(0.5 - r01).toBeGreaterThanOrEqual(0);
    });
  });

  test('Tr(ρ²) is the trace of ρ times ρ', () => {
    NOISE.forEach((nl) => {
      const { r01, trSq } = densityMatrix(nl);
      const rho = [[0.5, r01], [r01, 0.5]];
      const sq00 = rho[0][0] * rho[0][0] + rho[0][1] * rho[1][0];
      const sq11 = rho[1][0] * rho[0][1] + rho[1][1] * rho[1][1];
      expect(trSq).toBeCloseTo(sq00 + sq11, 12);
    });
  });

  test('more noise never makes the qubit purer, and enough noise mixes it fully', () => {
    NOISE.slice(1).forEach((nl, k) => {
      expect(densityMatrix(nl).trSq).toBeLessThan(densityMatrix(NOISE[k]).trSq);
      expect(densityMatrix(nl).purity).toBeLessThanOrEqual(densityMatrix(NOISE[k]).purity);
    });
    expect(densityMatrix(5).purity).toBe(0);
    expect(densityMatrix(5).trSq).toBeCloseTo(0.5, 9);
  });
});

// ─── Quantum Error Correction ────────────────────────────────────────────────

describe('the 3-qubit bit-flip code', () => {
  const syndromeOf = (q) => ({ s1: q[0] ^ q[1], s2: q[1] ^ q[2] });

  test.each([0, 1, 2])('a flip on Q%# gives the parities in the table', (errorQubit) => {
    const qubits = [0, 0, 0];
    qubits[errorQubit] ^= 1;
    const { s1, s2 } = SYNDROME_TABLE[errorQubit];
    expect({ s1, s2 }).toEqual(syndromeOf(qubits));
    expect(SYNDROME_TABLE[errorQubit].label).toBe(`Error on Q${'₁₂₃'[errorQubit]}`);
  });

  test('each syndrome names one qubit, distinct from "no error", and fixing it restores |000>', () => {
    const seen = new Set([`${syndromeOf([0, 0, 0]).s1}${syndromeOf([0, 0, 0]).s2}`]);
    [0, 1, 2].forEach((errorQubit) => {
      const key = `${SYNDROME_TABLE[errorQubit].s1}${SYNDROME_TABLE[errorQubit].s2}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const qubits = [0, 0, 0];
      qubits[errorQubit] ^= 1; // the error
      const decoded = [0, 1, 2].find((q) => `${SYNDROME_TABLE[q].s1}${SYNDROME_TABLE[q].s2}` === key);
      qubits[decoded] ^= 1; // the correction
      expect(qubits).toEqual([0, 0, 0]);
    });
  });
});
