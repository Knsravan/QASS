// One AudioContext for the whole app. Creating a context costs tens of
// milliseconds and browsers cap how many can be open, so modules share this
// one and, when they unmount, disconnect their own output instead of closing it.

let context = null;
const bufferCache = new Map(); // key → AudioBuffer (valid for `context` only)

export function acquireAudioContext() {
  if (!context || context.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    context = new AudioContextClass();
    bufferCache.clear();
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

export function releaseAudioOutput(node) {
  try {
    node?.disconnect();
  } catch {
    // Already disconnected.
  }
}

// Noise impulses and similar generated buffers are identical on every visit;
// build each once per context instead of on every module mount.
export function sharedBuffer(key, build) {
  let buffer = bufferCache.get(key);
  if (!buffer) {
    buffer = build();
    bufferCache.set(key, buffer);
  }
  return buffer;
}
