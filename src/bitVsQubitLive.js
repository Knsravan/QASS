// Classical Bit vs Qubit: the qubit's live odds. The scene writes them every
// frame (from where its arrow points); the readout under the qubit reads them
// on its own animation frame, so neither re-renders React 60 times a second.
export const bvqLive = {
  p1: 0.5, // P(1) = sin²(θ/2), θ the arrow's angle from |0⟩
};
