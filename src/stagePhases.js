import { glideMs } from './handoff';

/*
 * The stage's phases, in one table. useStageChoreography.js runs the moves
 * between the hub and a module as a chain of these phases; Simulator.jsx
 * reads from here what the hub's shared scene (BlochSphere) shows during
 * each one.
 *
 * For each phase:
 *   hub    what the hub's scene shows meanwhile: which module its models
 *          stand in for (`stands`; 'pair' is the module the lone qubit
 *          splits into a pair for), the pair's pose (`multi`), whether the
 *          scene is vanishing, and whether the lone qubit glides to the middle
 *          on its own (`centerOnly`). A phase without `stands` shows the
 *          stage's own module (or the hub).
 *   next   the phase that simply follows `after` ms later. Phases without one
 *          end on an event (the scene revealed, a ring drawn, a timer the
 *          move itself set) handled in the hook.
 */
export const STAGE_PHASES = {
  // Resting: the stage shows its module, or the hub.
  idle: { hub: {} },
  // Hub -> Dirac Notation / Superposition / No-Cloning: the hub's scene fades out first.
  vanish: { hub: { vanishing: true } },
  // A new scene fades in on the shared canvas; its cards pop once it has been revealed.
  enter: { hub: {} },
  // The scene taking over looks the same as the one leaving: the cards pop almost at once.
  morph: { hub: {} },
  // No-Cloning opens: its models bounce in, then its cards pop.
  bounce: { hub: {} },
  // Exponential State Space opens: its ring draws on, then its cards pop (it says when).
  ring: { hub: {} },
  // Any module -> hub: the cards spring out first.
  closing: { hub: {} },
  // Hub <-> Classical Gates: the hub's two bits grow to the module's size, or shrink back.
  grow: { hub: { stands: 'gates' } },
  shrink: { hub: { stands: 'gates' }, next: 'morph', after: 150 },
  // Hub <-> Quantum Interference: the lone qubit comes to the middle, or goes back.
  'solo-center': { hub: { centerOnly: true } },
  'solo-unsolo': { hub: { stands: 'interference' }, next: 'morph', after: 250 },
  // Hub <-> Multi Qubit Gates, Entanglement, Decoherence and Exponential State Space:
  // the lone qubit comes to the middle, splits in two and zooms in, or the reverse.
  'multi-center': { hub: { stands: 'pair', multi: 'center' } },
  'multi-split': { hub: { stands: 'pair', multi: 'split' } },
  'multi-zoom': { hub: { stands: 'pair', multi: 'zoom' } },
  'multi-unzoom': { hub: { stands: 'pair', multi: 'zoom' }, next: 'multi-unsplit', after: 200 },
  // (Zooming out; the camera settles and what follows depends on the pair: see the hook.)
  'multi-unsplit': { hub: { stands: 'pair', multi: 'split' } },
  'multi-merge': { hub: { stands: 'pair', multi: 'merge' }, next: 'morph', after: glideMs(1500) },
};

/** The props the hub's scene takes for a phase: { activeModule, multi, vanishing, centerOnly }. */
export function hubScenePose(phase, stageId, pairModule) {
  const hub = STAGE_PHASES[phase]?.hub || {};
  return {
    activeModule: hub.stands === 'pair' ? pairModule : hub.stands || stageId,
    multi: hub.multi || null,
    vanishing: !!hub.vanishing,
    centerOnly: !!hub.centerOnly,
  };
}

// The modules whose scene takes over from the hub's in place (one scene,
// 'bit-scene', on the shared canvas): moving between them and the hub morphs
// that scene instead of swapping it, and they share one error boundary.
export const SHARED_SCENE_STAGES = new Set(['bit-vs-qubit', 'gates', 'multi-qubit-gates', 'interference', 'entanglement', 'exponential', 'decoherence']);

// The modules that label their two sides above the scene, and how far from
// the middle the labels sit.
export const SIDE_TITLES = {
  'bit-vs-qubit': { classical: 'CLASSICAL BIT', quantum: 'QUBIT', offset: '33.5vh' },
  gates: { classical: 'CLASSICAL PHYSICS', quantum: 'QUANTUM PHYSICS', offset: '39vh' },
};

// The window events the stage and the scenes signal each other with.
export const STAGE_EVENTS = {
  ringDone: 'qass-ring-done',       // Exponential State Space's ring has drawn on (its cards can pop)
  ringGone: 'qass-ring-gone',       // ... and drawn off again (the hub can take over)
  noCloningGone: 'qass-nc-gone',    // No-Cloning's models have bounced away (the hub can come in)
  cardsIn: 'qass-jelly-run',        // the module's cards pop in (Decoherence's particles follow)
  cardsOut: 'qass-jelly-out',       // the module's cards spring out
};
