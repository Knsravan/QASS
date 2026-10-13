// Self-contained modules are split into their own chunks so the landing page
// and hub don't pay for every module's scene up front. App.jsx also uses these
// loaders to prefetch the chunks once the hub is idle, so opening one is
// instant, and the stage choreography (useStageChoreography.js) loads a
// module's code during its opening move.
// A failed load needs no handling where they're called: the module then renders
// through its lazy() fallback, whose error reaches ModuleErrorBoundary.
export const MODULE_LOADERS = {
  interference: () => import('./InterferenceModule'),
  entanglement: () => import('./EntanglementModule'),
  exponential: () => import('./ExponentialModule'),
  nocloning: () => import('./NoCloning'),
  decoherence: () => import('./Decoherence'),
  errorCorrection: () => import('./QuantumErrorCorrection'),
};
