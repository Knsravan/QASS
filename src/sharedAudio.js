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

// ─── A module's output chain ────────────────────────────────────────────────
// Every module's sound runs through the same chain on the shared context;
// only the numbers differ. These build it and drive it.

// A reverb's impulse: stereo noise `seconds` long, falling by 1/e every
// `decay` seconds. Built once per context under `key`.
export function noiseImpulse(ctx, key, seconds, decay) {
  return sharedBuffer(key, () => {
    const length = ctx.sampleRate * seconds;
    const built = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = built.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
    }
    return built;
  });
}

/**
 * A master gain at `volume` (silent if it starts `muted`), optionally behind a
 * warm low-pass at `lowpass` Hz, and optionally a reverb
 * (`reverb: { key, seconds, decay }`) feeding the filter, or else the master.
 * Returns { master, filter, reverb } (null for the parts not asked for).
 */
export function createOutputChain(ctx, { volume, muted = false, lowpass, reverb }) {
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(ctx.destination);
  let filter = null;
  if (lowpass) {
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    filter.connect(master);
  }
  let convolver = null;
  if (reverb) {
    convolver = ctx.createConvolver();
    convolver.buffer = noiseImpulse(ctx, reverb.key, reverb.seconds, reverb.decay);
    convolver.connect(filter || master);
  }
  return { master, filter, reverb: convolver };
}

/**
 * Takes a master gain to `volume`, or to silence when `muted`: an ease with
 * `timeConstant` (s), or with `ramp` a straight ramp over that many seconds
 * from where the gain is now.
 */
export function easeMasterGain(ctx, master, muted, volume, { timeConstant = 0.1, ramp } = {}) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const target = muted ? 0 : volume;
  master.gain.cancelScheduledValues(now);
  if (ramp) {
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + ramp);
  } else {
    master.gain.setTargetAtTime(target, now, timeConstant);
  }
}

// Silences a module's playing nodes: gains fade out, sources stop `stopAfter`
// seconds from now.
export function fadeOutNodes(ctx, nodes, stopAfter = 0.1) {
  if (!ctx) return;
  const now = ctx.currentTime;
  nodes.forEach((node) => {
    try {
      if (node.gain) {
        node.gain.cancelScheduledValues(now);
        node.gain.setTargetAtTime(0, now, 0.05);
      } else if (node.stop) {
        node.stop(now + stopAfter);
      }
    } catch {
      // Already stopped.
    }
  });
}
