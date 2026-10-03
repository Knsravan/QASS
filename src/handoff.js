import * as THREE from 'three';

// What one scene hands to the next when they swap in place (see SharedCanvas `sceneId`).
export const handoff = {
  // The hub's lone qubit's scale relative to the hub's own size, as it was when the
  // module took over (Quantum Interference starts its intro from this size).
  qubitScale: 1,
  // Half the gap between Alice and Bob in the Entanglement scene (the distance slider moves it);
  // the hub's pair starts a close from there.
  entPairX: 4.6,
  // Decoherence's two arrows (pure, noisy) as the scene last drew them; the hub's pair takes them over on a close.
  decQ: { pure: new THREE.Quaternion(), noisy: new THREE.Quaternion() },
};
