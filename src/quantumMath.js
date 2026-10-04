export function kroneckerProduct(A, B) {
  let result = [];
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      result.push({
        r: A[i].r * B[j].r - A[i].i * B[j].i,
        i: A[i].r * B[j].i + A[i].i * B[j].r
      });
    }
  }
  return result;
}

export function getInitialState(inputs) {
  const map = {
    '0': [{r: 1, i: 0}, {r: 0, i: 0}],
    '1': [{r: 0, i: 0}, {r: 1, i: 0}],
    '+': [{r: 1/Math.SQRT2, i: 0}, {r: 1/Math.SQRT2, i: 0}]
  };
  let state = map[inputs[0]];
  for (let i = 1; i < inputs.length; i++) {
    state = kroneckerProduct(state, map[inputs[i]]);
  }
  return state;
}

export const GATES_MATRICES = {
  cnot: [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}]
  ],
  swap: [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}]
  ],
  cz: [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:-1,i:0}]
  ],
  bell: [ 
    [{r:1/Math.SQRT2,i:0}, {r:0,i:0}, {r:1/Math.SQRT2,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1/Math.SQRT2,i:0}, {r:0,i:0}, {r:1/Math.SQRT2,i:0}],
    [{r:0,i:0}, {r:1/Math.SQRT2,i:0}, {r:0,i:0}, {r:-1/Math.SQRT2,i:0}],
    [{r:1/Math.SQRT2,i:0}, {r:0,i:0}, {r:-1/Math.SQRT2,i:0}, {r:0,i:0}]
  ],
  toffoli: [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}]
  ]
};

export function applyMatrix(matrix, state) {
  let out = [];
  for (let i = 0; i < matrix.length; i++) {
    let sumR = 0;
    let sumI = 0;
    for (let j = 0; j < state.length; j++) {
      sumR += matrix[i][j].r * state[j].r - matrix[i][j].i * state[j].i;
      sumI += matrix[i][j].r * state[j].i + matrix[i][j].i * state[j].r;
    }
    out.push({ r: sumR, i: sumI });
  }
  return out;
}

export function calculateProbabilities(state) {
  return state.map((c, i) => {
    const prob = c.r * c.r + c.i * c.i;
    let phase = Math.atan2(c.i, c.r);
    if (phase < 0) phase += 2 * Math.PI;
    return { 
      index: i,
      prob: prob,
      phase: phase
    };
  });
}

// ─── Multi-Qubit Gates ───────────────────────────────────────────────────────

export function gateNumQubits(gateId) {
  return gateId === 'toffoli' ? 3 : 2;
}

export function getFinalState(gateId, inputs) {
  const activeInputs = inputs.slice(0, gateNumQubits(gateId));
  const initialState = getInitialState(activeInputs);
  const matrix = GATES_MATRICES[gateId];
  return matrix ? applyMatrix(matrix, initialState) : initialState;
}

// A pure state is entangled iff it is not a full tensor product of single-qubit
// states, i.e. some qubit-vs-rest bipartition of the amplitude vector, reshaped
// into a 2 x 2^(n-1) matrix, has rank > 1 (some 2x2 minor is nonzero).
export function isResultEntangled(gateId, inputs) {
  const n = gateNumQubits(gateId);
  const state = getFinalState(gateId, inputs);
  const eps = 1e-9;
  for (let k = 0; k < n; k++) {
    const shift = n - 1 - k; // qubit 0 is the most significant bit
    const rows = [[], []];
    for (let i = 0; i < state.length; i++) {
      rows[(i >> shift) & 1].push(state[i]);
    }
    const [u, v] = rows;
    for (let a = 0; a < u.length; a++) {
      for (let b = a + 1; b < u.length; b++) {
        const mr = (u[a].r * v[b].r - u[a].i * v[b].i) - (u[b].r * v[a].r - u[b].i * v[a].i);
        const mi = (u[a].r * v[b].i + u[a].i * v[b].r) - (u[b].r * v[a].i + u[b].i * v[a].r);
        if (mr * mr + mi * mi > eps) return true;
      }
    }
  }
  return false;
}

function flipBasis(b) {
  if (b === '0') return '1';
  if (b === '1') return '0';
  return b; // |+> and |-> are eigenstates of X
}

// What each qubit shows after the gate: the basis state its sphere points to
// (when the result is separable), and whether the result is entangled.
export function calculateGateLogic(gateId, inputs) {
  const isEntangled = isResultEntangled(gateId, inputs);
  let outputs = [...inputs];

  if (!isEntangled) {
    if (gateId === 'cnot') {
      if (inputs[0] === '1') outputs[1] = flipBasis(inputs[1]);
    } else if (gateId === 'swap') {
      outputs[0] = inputs[1]; outputs[1] = inputs[0];
    } else if (gateId === 'toffoli') {
      if (inputs[0] === '1' && inputs[1] === '1') outputs[2] = flipBasis(inputs[2]);
    } else if (gateId === 'cz') {
      // Phase kickback: CZ maps |+>|1> to |->|1> (and symmetrically)
      if (inputs[0] === '+' && inputs[1] === '1') outputs[0] = '-';
      else if (inputs[1] === '+' && inputs[0] === '1') outputs[1] = '-';
    } else if (gateId === 'bell') {
      // The H maps the control first: |0> -> |+>, |1> -> |->, |+> -> |0>
      outputs[0] = inputs[0] === '0' ? '+' : (inputs[0] === '1' ? '-' : '0');
    }
  }

  return { outputs, isEntangled };
}

// Formats the final state as a ket sum, e.g. \frac{|00\rangle + |11\rangle}{\sqrt{2}}.
// All reachable amplitudes are real with equal magnitudes (inputs are 0/1/+ and the
// gate matrices are real), so signs and the denominator follow from the term count.
export function formatStateKet(state, numQubits) {
  const terms = [];
  state.forEach((c, idx) => {
    if (c.r * c.r + c.i * c.i < 1e-6) return;
    terms.push({ label: idx.toString(2).padStart(numQubits, '0'), neg: c.r < 0 });
  });
  if (terms.length === 0) return '0';
  const numerator = terms
    .map((t, k) => `${k === 0 ? (t.neg ? '-' : '') : (t.neg ? ' - ' : ' + ')}|${t.label}\\rangle`)
    .join('');
  const denominators = { 2: '\\sqrt{2}', 4: '2', 8: '2\\sqrt{2}' };
  const d = denominators[terms.length];
  return d ? `\\frac{${numerator}}{${d}}` : numerator;
}

// ─── Classical vs Quantum Gates ──────────────────────────────────────────────
//
// Each single-qubit gate as the rotation the Bloch sphere shows. The scenes draw
// |0> at +Y, so a Bloch vector (x, y, z) sits at scene (y, z, x): |+> is +Z and
// |+i> is +X. `axis` is in scene coordinates; `startsAtPlus` starts the vector at
// |+> instead of |0> (a phase gate does nothing visible to |0>).

export const GATE_ROTATIONS = {
  'pauli-x': { axis: [0, 0, 1], angle: Math.PI, startsAtPlus: false },
  'pauli-y': { axis: [1, 0, 0], angle: Math.PI, startsAtPlus: false },
  'pauli-z': { axis: [0, 1, 0], angle: Math.PI, startsAtPlus: true },
  hadamard: { axis: [0, 1, 1], angle: Math.PI, startsAtPlus: false },
  's-gate': { axis: [0, 1, 0], angle: Math.PI / 2, startsAtPlus: true },
  't-gate': { axis: [0, 1, 0], angle: Math.PI / 4, startsAtPlus: true },
};

// ─── Entanglement ────────────────────────────────────────────────────────────

// The basis states each Bell state can be measured in.
export const BELL_OUTCOMES = {
  phi_plus: ['00', '11'],
  phi_minus: ['00', '11'],
  psi_plus: ['01', '10'],
  psi_minus: ['01', '10'],
};

// ─── Quantum Interference ────────────────────────────────────────────────────

// Mach-Zehnder: H, a relative phase on the |1> path, H. The detectors' odds.
export function interferenceProbabilities(phase) {
  return { p0: Math.pow(Math.cos(phase / 2), 2), p1: Math.pow(Math.sin(phase / 2), 2) };
}

// ─── Exponential State Space ─────────────────────────────────────────────────

// Memory to hold an n-qubit state vector: 2^n complex amplitudes of 16 bytes.
export function stateVectorRAM(n) {
  const bytes = Math.pow(2, n) * 16;
  if (bytes < 1024) return `${bytes} Bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (n <= 35) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB (PC limit)`;
  if (n === 50) return '16 Petabytes (Supercomputer Limit)';
  if (n >= 300) return 'Exceeds Atoms in Universe (~10⁸⁰)!';
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(0)} TB`;
}

// ─── Decoherence ─────────────────────────────────────────────────────────────

// The noisy qubit's density matrix ρ = [[1/2, r01], [r01, 1/2]]: an equal
// superposition whose coherence r01 decays with noise. Its purity Tr(ρ²) runs
// from 1 (pure) down to 1/2 (fully mixed), shown as 100% to 0%.
export function densityMatrix(noiseLevel) {
  const r01 = 0.5 * Math.exp(-noiseLevel * 4.8);
  const trSq = 0.5 + 2 * r01 * r01;
  const purity = Math.round(Math.max(0, Math.min(100, (trSq - 0.5) * 200)));
  return { r01, trSq, purity };
}

// ─── Quantum Error Correction ────────────────────────────────────────────────

// The 3-qubit bit-flip code: s1 = Q1 ⊕ Q2, s2 = Q2 ⊕ Q3 for a flip on each qubit.
export const SYNDROME_TABLE = {
  0: { s1: 1, s2: 0, label: 'Error on Q₁' },
  1: { s1: 1, s2: 1, label: 'Error on Q₂' },
  2: { s1: 0, s2: 1, label: 'Error on Q₃' },
};
