import { useSyncExternalStore } from 'react';

// Dirac Notation's draggable state, shared by the scene (which drags it) and the
// overlay's matrix card (which reads it), without re-rendering the whole app on
// every pointer move. `theta` is the Bloch angle: the state is cos(θ/2)|0> + sin(θ/2)|1>.
let theta = Math.PI / 2;
const listeners = new Set();

export const diracLive = {
  get: () => theta,
  set(next) {
    if (next === theta) return;
    theta = next;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useDiracTheta() {
  return useSyncExternalStore(diracLive.subscribe, diracLive.get, diracLive.get);
}
