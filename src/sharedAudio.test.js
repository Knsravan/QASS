import { describe, test, expect, beforeEach } from 'vitest';
import { acquireAudioContext, createOutputChain, easeMasterGain, fadeOutNodes } from './sharedAudio';

// Just enough of the Web Audio API to see how the chain is wired and driven.
class FakeParam {
  constructor(value = 1) { this.value = value; this.calls = []; }
  cancelScheduledValues(t) { this.calls.push(['cancel', t]); }
  setValueAtTime(v, t) { this.calls.push(['set', v, t]); }
  setTargetAtTime(v, t, tc) { this.calls.push(['target', v, t, tc]); }
  linearRampToValueAtTime(v, t) { this.calls.push(['ramp', v, t]); }
}
class FakeNode {
  constructor(kind) { this.kind = kind; this.outputs = []; }
  connect(node) { this.outputs.push(node); return node; }
  disconnect() { this.outputs = []; }
}
class FakeContext {
  constructor() { this.state = 'running'; this.sampleRate = 100; this.currentTime = 2; this.destination = new FakeNode('destination'); }
  createGain() { const n = new FakeNode('gain'); n.gain = new FakeParam(1); return n; }
  createBiquadFilter() { const n = new FakeNode('filter'); n.frequency = new FakeParam(350); n.gain = new FakeParam(0); return n; }
  createConvolver() { return new FakeNode('convolver'); }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, getChannelData: (c) => data[c] };
  }
  resume() { return Promise.resolve(); }
}

describe('the shared output chain', () => {
  let ctx;
  beforeEach(() => {
    globalThis.window = { AudioContext: FakeContext };
    ctx = acquireAudioContext();
  });

  test('master -> speakers, filter -> master, reverb -> filter', () => {
    const chain = createOutputChain(ctx, { volume: 0.7, lowpass: 2400, reverb: { key: 't:filtered', seconds: 3.5, decay: 0.52 } });
    expect(chain.master.gain.value).toBe(0.7);
    expect(chain.master.outputs).toEqual([ctx.destination]);
    expect(chain.filter.frequency.value).toBe(2400);
    expect(chain.filter.outputs).toEqual([chain.master]);
    expect(chain.reverb.outputs).toEqual([chain.filter]);
    expect(chain.reverb.buffer.numberOfChannels).toBe(2);
    expect(chain.reverb.buffer.length).toBe(350); // 3.5 s at 100 Hz
  });

  test('without a filter the reverb feeds the master; a muted start is silent', () => {
    const chain = createOutputChain(ctx, { volume: 0.8, muted: true, reverb: { key: 't:plain', seconds: 2, decay: 0.3 } });
    expect(chain.filter).toBeNull();
    expect(chain.reverb.outputs).toEqual([chain.master]);
    expect(chain.master.gain.value).toBe(0);
  });

  test('the impulse is noise that decays by 1/e every `decay` seconds', () => {
    const { reverb } = createOutputChain(ctx, { volume: 1, reverb: { key: 't:decay', seconds: 10, decay: 1 } });
    const d = reverb.buffer.getChannelData(0);
    const peak = (from, to) => Math.max(...Array.from(d.slice(from, to), Math.abs));
    expect(peak(0, 100)).toBeLessThanOrEqual(1);
    expect(peak(500, 600)).toBeLessThanOrEqual(Math.exp(-5) + 1e-9);
  });

  test('a chain without a reverb is just the master', () => {
    const chain = createOutputChain(ctx, { volume: 1 });
    expect(chain.reverb).toBeNull();
    expect(chain.master.outputs).toEqual([ctx.destination]);
  });

  test('muting eases the master to 0, unmuting back to its volume', () => {
    const { master } = createOutputChain(ctx, { volume: 0.75 });
    easeMasterGain(ctx, master, true, 0.75);
    easeMasterGain(ctx, master, false, 0.75, { timeConstant: 0.12 });
    expect(master.gain.calls).toEqual([['cancel', 2], ['target', 0, 2, 0.1], ['cancel', 2], ['target', 0.75, 2, 0.12]]);
  });

  test('a ramped mute starts from where the gain is now', () => {
    const { master } = createOutputChain(ctx, { volume: 0.5 });
    easeMasterGain(ctx, master, true, 0.5, { ramp: 1 });
    expect(master.gain.calls).toEqual([['cancel', 2], ['set', 0.5, 2], ['ramp', 0, 3]]);
  });

  test('stopping fades gains out and stops sources', () => {
    const gain = ctx.createGain();
    const stops = [];
    const source = { stop: (t) => stops.push(t) };
    fadeOutNodes(ctx, [gain, source], 0.5);
    expect(gain.gain.calls).toEqual([['cancel', 2], ['target', 0, 2, 0.05]]);
    expect(stops).toEqual([2.5]);
    fadeOutNodes(ctx, [{ stop: () => { throw new Error('already stopped'); } }]); // never throws
  });
});
