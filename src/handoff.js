import * as THREE from 'three';

// How fast the hub's models glide between the hub and a module: the lone qubit's move to the
// middle, the pair's split and zoom, the lights, the bits growing to Classical Gates' size and
// Decoherence's camera all ease toward their goal at this rate (1 - e^(-GLIDE·t) of the way
// after t seconds). App.jsx times its stages from it (glideMs), so each hand-over still finds
// the models as close to the module's places as before, whatever the speed.
export const GLIDE = 4;
const GLIDE_BEFORE = 2.6; // the rate the stage timings were first tuned at
/** A stage length tuned at the old rate, at the current one. */
export const glideMs = (ms) => Math.round((ms * GLIDE_BEFORE) / GLIDE);

// What one scene hands to the next when they swap in place (see SharedCanvas `sceneId`).
export const handoff = {
  // The hub's lone qubit's scale relative to the hub's own size, as it was when the
  // module took over (Quantum Interference starts its intro from this size).
  qubitScale: 1,
  // Half the gap between Alice and Bob in the Entanglement scene (the distance slider moves it);
  // the hub's pair starts a close from there.
  entPairX: 4.6,
  // Decoherence's two arrows (pure, noisy) as the scene last drew them; the hub's pair takes them over on a close.
  // Where the hub's pair held its arrows when Decoherence took over (the module starts them there).
  decStart: { pure: new THREE.Vector3(1, 0, 0), noisy: new THREE.Vector3(1, 0, 0) },
  decQ: { pure: new THREE.Quaternion(), noisy: new THREE.Quaternion() },
};
