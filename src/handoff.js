import * as THREE from 'three';

// How fast the hub's models glide between the hub and a module: the lone qubit's move to the
// middle, the pair's split and zoom, the lights, the bits growing to Classical Gates' size and
// Decoherence's camera all ease toward their goal at this rate (1 - e^(-GLIDE·t) of the way
// after t seconds). The stage (useStageChoreography.js) times its moves from it (glideMs), so
// each hand-over still finds the models as close to the module's places as before, whatever
// the speed.
export const GLIDE = 4;
const GLIDE_BEFORE = 2.6; // the rate the stage timings were first tuned at
/** A stage length tuned at the old rate, at the current one. */
export const glideMs = (ms) => Math.round((ms * GLIDE_BEFORE) / GLIDE);

// Where things rest, for the modules that take over the hub's scene in place: the hub's
// models glide to the module's places and its camera to the module's view, then the module
// draws the same thing from there. Both sides read these numbers, so they can't drift apart.
// Sizes are scales of the hub's qubit, whose sphere has radius QUBIT_R.
export const QUBIT_R = 2;
export const HUB_CAMERA = { cam: [0, 0, 13], target: [0, 0, 0] };
export const REST = {
  // Two qubits, pairX either side of the middle, at height y.
  'multi-qubit-gates': { pairX: 2, y: 1.2, scale: 1 },
  // Alice and Bob (the distance slider spreads them from pairX); the view leans right with the sidebar open.
  entanglement: { pairX: 4.6, y: 0, scale: 1.15, camera: (sidebarOpen) => ({ cam: [sidebarOpen ? 0.6 : 0, 0.2, 14.2], target: [0, 0, 0] }) },
  // The pure and the noisy qubit, spheres of radius 2.75.
  decoherence: { pairX: 5.8, y: 1.65, scale: 2.75 / QUBIT_R, camera: { cam: [0, 2.25, 20], target: [0, 1.65, 0] } },
  // One qubit, in the middle; the view of a 1-qubit register.
  exponential: { y: 0.6, scale: 1.15, camera: { cam: [0, 1.4, 13], target: [0, 0, 0] } },
};

// What one scene hands to the next when they swap in place (see SharedCanvas `sceneId`).
export const handoff = {
  // The hub's lone qubit's scale relative to the hub's own size, as it was when the
  // module took over (Quantum Interference starts its intro from this size).
  qubitScale: 1,
  // Half the gap between Alice and Bob in the Entanglement scene (the distance slider moves it);
  // the hub's pair starts a close from there.
  entPairX: REST.entanglement.pairX,
  // Decoherence's two arrows (pure, noisy) as the scene last drew them; the hub's pair takes them over on a close.
  // Where the hub's pair held its arrows when Decoherence took over (the module starts them there).
  decStart: { pure: new THREE.Vector3(1, 0, 0), noisy: new THREE.Vector3(1, 0, 0) },
  decQ: { pure: new THREE.Quaternion(), noisy: new THREE.Quaternion() },
};
