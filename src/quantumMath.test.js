import { describe, test, expect } from 'vitest';
import { getInitialState, GATES_MATRICES, applyMatrix, calculateProbabilities, kroneckerProduct } from './quantumMath';

const probs = (state) => calculateProbabilities(state).map(p => p.prob);
const expectProbs = (state, expected) => {
  probs(state).forEach((p, i) => expect(p).toBeCloseTo(expected[i], 10));
};

describe('getInitialState', () => {
  test('builds computational basis states in big-endian order', () => {
    expectProbs(getInitialState(['0', '0']), [1, 0, 0, 0]);
    expectProbs(getInitialState(['1', '0']), [0, 0, 1, 0]);
    expectProbs(getInitialState(['1', '1', '0']), [0, 0, 0, 0, 0, 0, 1, 0]);
  });

  test('|+> inputs give a uniform, normalised superposition', () => {
    expectProbs(getInitialState(['+', '+']), [0.25, 0.25, 0.25, 0.25]);
  });
});

describe('kroneckerProduct', () => {
  test('multiplies complex amplitudes', () => {
    const i = [{ r: 0, i: 1 }];
    expect(kroneckerProduct(i, i)).toEqual([{ r: -1, i: 0 }]);
  });
});

describe('gate matrices', () => {
  test('CNOT flips the target only when the control is 1', () => {
    expectProbs(applyMatrix(GATES_MATRICES.cnot, getInitialState(['0', '1'])), [0, 1, 0, 0]);
    expectProbs(applyMatrix(GATES_MATRICES.cnot, getInitialState(['1', '0'])), [0, 0, 0, 1]);
  });

  test('SWAP exchanges the two qubits', () => {
    expectProbs(applyMatrix(GATES_MATRICES.swap, getInitialState(['1', '0'])), [0, 1, 0, 0]);
  });

  test('CZ adds a pi phase to |11> only', () => {
    const out = calculateProbabilities(applyMatrix(GATES_MATRICES.cz, getInitialState(['1', '1'])));
    expect(out[3].prob).toBeCloseTo(1, 10);
    expect(out[3].phase).toBeCloseTo(Math.PI, 10);
  });

  test('Toffoli flips the target only when both controls are 1', () => {
    expectProbs(applyMatrix(GATES_MATRICES.toffoli, getInitialState(['1', '0', '0'])), [0, 0, 0, 0, 1, 0, 0, 0]);
    expectProbs(applyMatrix(GATES_MATRICES.toffoli, getInitialState(['1', '1', '0'])), [0, 0, 0, 0, 0, 0, 0, 1]);
  });

  test('the H + CNOT step turns |00> into the Bell state (|00> + |11>)/sqrt2', () => {
    const out = applyMatrix(GATES_MATRICES.bell, getInitialState(['0', '0']));
    expectProbs(out, [0.5, 0, 0, 0.5]);
    expect(out[0].r).toBeCloseTo(Math.SQRT1_2, 10);
    expect(out[3].r).toBeCloseTo(Math.SQRT1_2, 10);
  });

  test.each(Object.keys(GATES_MATRICES))('%s preserves normalisation', (gate) => {
    const n = Math.log2(GATES_MATRICES[gate].length);
    const out = applyMatrix(GATES_MATRICES[gate], getInitialState(Array(n).fill('+')));
    expect(probs(out).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});
