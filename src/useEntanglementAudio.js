import { useEffect, useRef, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, sharedBuffer } from './sharedAudio';

export function useEntanglementAudio(isMuted) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const reverbRef = useRef(null);
  const activeNodesRef = useRef([]);
  const ambientNodesRef = useRef([]);

  const initAudio = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = acquireAudioContext();
      ctxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : 0.8;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // Create warm, airy convolution impulse for rich spatial reverb
      const length = ctx.sampleRate * 3.0;
      const impulse = sharedBuffer('useEntanglementAudio:impulse', () => {
        const built = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const channel = built.getChannelData(c);
          for (let i = 0; i < length; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.45));
          }
        }
        return built;
      });
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      reverb.connect(masterGain);
      reverbRef.current = reverb;
    }
    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
    }
  }, [isMuted]);

  useEffect(() => {
    if (masterGainRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setTargetAtTime(isMuted ? 0 : 0.8, now, 0.1);
    }
  }, [isMuted]);

  const stopAll = useCallback(() => {
    if (ctxRef.current) {
      const now = ctxRef.current.currentTime;
      [...activeNodesRef.current, ...ambientNodesRef.current].forEach(node => {
        try {
          if (node.gain) {
            node.gain.cancelScheduledValues(now);
            node.gain.setTargetAtTime(0, now, 0.05);
          } else if (node.stop) {
            node.stop(now + 0.1);
          }
        } catch (e) {}
      });
      activeNodesRef.current = [];
      ambientNodesRef.current = [];
    }
  }, []);

  // Ambient Peaceful Quantum Tether Hum
  const startAmbientTether = useCallback(() => {
    if (!ctxRef.current || isMuted || ambientNodesRef.current.length > 0) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110, now); // A2 fundamental
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(110.4, now); // Subtle binaural chorus

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, now); // A1 deep warm base

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 2.5);

    osc1.connect(filter);
    osc2.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);
    if (reverbRef.current) filter.connect(reverbRef.current);

    osc1.start(now);
    osc2.start(now);
    subOsc.start(now);

    ambientNodesRef.current = [osc1, osc2, subOsc, gain];
  }, [isMuted]);

  const stopAmbientTether = useCallback(() => {
    if (!ctxRef.current) return;
    const now = ctxRef.current.currentTime;
    ambientNodesRef.current.forEach(node => {
      try {
        if (node.gain) {
          node.gain.cancelScheduledValues(now);
          node.gain.setTargetAtTime(0, now, 1.0);
        } else if (node.stop) {
          node.stop(now + 1.2);
        }
      } catch (e) {}
    });
    ambientNodesRef.current = [];
  }, []);

  // Entanglement Ignite Chime (Celestial harmonic chord)
  const playEntangleIgnite = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    // Frequencies for a crystalline open 5th & octave chord (A3, E4, A4, C#5, E5)
    const chord = [220, 329.63, 440, 554.37, 659.25];

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      const delay = idx * 0.08;
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.06 / chord.length, now + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 2.4);

      if (panner) {
        panner.pan.setValueAtTime((idx / (chord.length - 1)) * 1.2 - 0.6, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(masterGainRef.current);
        if (reverbRef.current) panner.connect(reverbRef.current);
      } else {
        osc.connect(gain);
        gain.connect(masterGainRef.current);
        if (reverbRef.current) gain.connect(reverbRef.current);
      }

      osc.start(now + delay);
      osc.stop(now + delay + 2.5);
      activeNodesRef.current.push(osc, gain);
    });
  }, [isMuted]);

  // Measurement Collapse Soft Harmonic Chime
  const playMeasurementCollapse = useCallback((outcomeState = '00') => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    // 1. Soft Sub-Harmonic Wave Swell (deep, gentle low-frequency breath)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(70, now + 0.35);

    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.06, now + 0.04);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    subOsc.connect(subGain);
    subGain.connect(masterGainRef.current);
    if (reverbRef.current) subGain.connect(reverbRef.current);

    subOsc.start(now);
    subOsc.stop(now + 0.45);

    // 2. Harmonic crystalline resolution bell
    const isGround = outcomeState === '00' || outcomeState === '0';
    const isExcited = outcomeState === '11' || outcomeState === '1';
    const baseFreq = isGround ? 523.25 : (isExcited ? 659.25 : 587.33); // C5, E5, or D5

    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(baseFreq, now + 0.04);

    bellGain.gain.setValueAtTime(0, now + 0.04);
    bellGain.gain.linearRampToValueAtTime(0.05, now + 0.08);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    bellOsc.connect(bellGain);
    bellGain.connect(masterGainRef.current);
    if (reverbRef.current) bellGain.connect(reverbRef.current);

    bellOsc.start(now + 0.04);
    bellOsc.stop(now + 2.3);

    activeNodesRef.current.push(subOsc, subGain, bellOsc, bellGain);
  }, [isMuted]);

  // Subtle UI Hover Sound / Stage Pill Click
  const playHover = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.04);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    if (masterGainRef.current) gain.connect(masterGainRef.current);
    if (reverbRef.current) gain.connect(reverbRef.current);
    osc.start(now);
    osc.stop(now + 0.08);
    activeNodesRef.current.push(osc, gain);
  }, [isMuted]);

  // Dedicated Stage Transition Click Sound (Next, Prev, Stage Stepper)
  const playStageTransition = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.04);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    if (masterGainRef.current) gain.connect(masterGainRef.current);
    if (reverbRef.current) gain.connect(reverbRef.current);
    osc.start(now);
    osc.stop(now + 0.08);
    activeNodesRef.current.push(osc, gain);
  }, [isMuted]);

  // Bell State Pill Switch Sound
  const playBellStateSelect = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain);
    gain.connect(masterGainRef.current);
    if (reverbRef.current) gain.connect(reverbRef.current);
    osc.start(now);
    osc.stop(now + 0.45);
  }, [isMuted]);

  // Distance Slider Pitch Shift
  const playDistanceShift = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(330, now + 0.15);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    gain.connect(masterGainRef.current);
    osc.start(now);
    osc.stop(now + 0.25);
  }, [isMuted]);

  // Soft Reset / Vector Shift Resonance Whoosh
  const playReset = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.32);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(gain);
    if (masterGainRef.current) gain.connect(masterGainRef.current);
    if (reverbRef.current) gain.connect(reverbRef.current);
    osc.start(now);
    osc.stop(now + 0.42);
    activeNodesRef.current.push(osc, gain);
  }, [isMuted]);

  // Exact Dirac Notation Step 1 Gravity Drop / Flip Sound
  const playGravityDrop = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const time = ctx.currentTime;

    // 1. The Whoosh / Swoop
    const swoop = ctx.createOscillator();
    swoop.type = 'sine';
    swoop.frequency.setValueAtTime(800, time);
    swoop.frequency.exponentialRampToValueAtTime(80, time + 0.15); // very fast downward swoop

    const swoopGain = ctx.createGain();
    swoopGain.gain.setValueAtTime(0, time);
    swoopGain.gain.linearRampToValueAtTime(0.3, time + 0.05);
    swoopGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    swoop.connect(swoopGain);
    if (masterGainRef.current) swoopGain.connect(masterGainRef.current);
    if (reverbRef.current) swoopGain.connect(reverbRef.current);

    swoop.start(time);
    swoop.stop(time + 0.25);
    activeNodesRef.current.push(swoop, swoopGain);

    // 2. The Heavy Sub-Impact
    const impact = ctx.createOscillator();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(80, time + 0.1);
    impact.frequency.exponentialRampToValueAtTime(30, time + 0.5); // Drops to sub-bass

    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0, time + 0.1);
    impactGain.gain.linearRampToValueAtTime(1.2, time + 0.15); // satisfying heavy attack
    impactGain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);

    const impactFilter = ctx.createBiquadFilter();
    impactFilter.type = 'lowpass';
    impactFilter.frequency.value = 150; // keep it deep and heavy

    impact.connect(impactGain);
    impactGain.connect(impactFilter);
    if (masterGainRef.current) impactFilter.connect(masterGainRef.current);

    impact.start(time + 0.1);
    impact.stop(time + 1.6);
    activeNodesRef.current.push(impact, impactGain, impactFilter);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      stopAll();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        releaseAudioOutput(masterGainRef.current);
      }
    };
  }, [stopAll]);

  return useMemo(() => ({
    initAudio,
    stopAll,
    startAmbientTether,
    stopAmbientTether,
    playEntangleIgnite,
    playMeasurementCollapse,
    playHover,
    playStageTransition,
    playBellStateSelect,
    playDistanceShift,
    playReset,
    playGravityDrop
  }), [initAudio, stopAll, startAmbientTether, stopAmbientTether, playEntangleIgnite,
    playMeasurementCollapse, playHover, playStageTransition, playBellStateSelect,
    playDistanceShift, playReset, playGravityDrop]);
}
