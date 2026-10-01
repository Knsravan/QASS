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
