import { useEffect, useRef, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, sharedBuffer } from './sharedAudio';

// ==========================================================
// NO-CLONING THEOREM AUDIO SYNTHESIZER (PEACEFUL & HARMONIC)
// Crystalline harmonic chords, ethereal camera swooshes, and peaceful resonant tethers
// ==========================================================
export function useNoCloningAudio(isMuted) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const masterFilterRef = useRef(null);
  const reverbRef = useRef(null);
  const activeNodesRef = useRef([]);
  const ambientNodesRef = useRef([]);

  const initAudio = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = acquireAudioContext();
      ctxRef.current = ctx;

      // Master Gain
      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : 0.75;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // Warm Master Lowpass Filter to eliminate any harsh piercing highs
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 2200;
      masterFilter.connect(masterGain);
      masterFilterRef.current = masterFilter;

      // Deep, airy convolution impulse response for lush spatial reverb
      const length = ctx.sampleRate * 3.2;
      const impulse = sharedBuffer('useNoCloningAudio:impulse', () => {
        const built = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const channel = built.getChannelData(c);
          for (let i = 0; i < length; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.48));
          }
        }
        return built;
      });
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      reverb.connect(masterFilter);
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
      masterGainRef.current.gain.setTargetAtTime(isMuted ? 0 : 0.75, now, 0.1);
    }
  }, [isMuted]);

  const toggleMute = useCallback((muted) => {
    if (masterGainRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setTargetAtTime(muted ? 0 : 0.75, now, 0.1);
    }
  }, []);

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

  // 1. Serene Ambient Drone Camera Pan / Waypoint Swoosh (100% Pure Sine Waves - Zero Noise)
  const playCameraPan = useCallback((duration = 1.8) => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    // Deep, velvety low-frequency sine swell
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, now);
    osc1.frequency.exponentialRampToValueAtTime(95, now + duration * 0.5);
    osc1.frequency.exponentialRampToValueAtTime(60, now + duration);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.05, now + duration * 0.4);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain1);
    gain1.connect(masterGainRef.current);
    if (reverbRef.current) gain1.connect(reverbRef.current);

    // Gentle ethereal harmonic breath (soft mid-sine)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(220, now);
    osc2.frequency.exponentialRampToValueAtTime(293.66, now + duration * 0.5);
    osc2.frequency.exponentialRampToValueAtTime(220, now + duration);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.015, now + duration * 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc2.connect(gain2);
    if (reverbRef.current) gain2.connect(reverbRef.current);
    else gain2.connect(masterGainRef.current);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.1);
    osc2.stop(now + duration + 0.1);

    activeNodesRef.current.push(osc1, gain1, osc2, gain2);
  }, [isMuted]);

  // 2. Peaceful, Soft Resonant Button Tap (Pure Sine Vector Shift - Identical to Entanglement)
  const playButtonClick = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(masterGainRef.current);
    if (reverbRef.current) gain.connect(reverbRef.current);

    osc.start(now);
    osc.stop(now + 0.35);
    activeNodesRef.current.push(osc, gain);
  }, [isMuted]);

  // 3. Serene, Celestial Crystal Harpshimmer for Quantum Tether Appearance (C5, E5, G5, B5, C6)
  const playTetherIgnite = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    const chord = [
      { freq: 523.25, delay: 0.00, gain: 0.024 }, // C5
      { freq: 659.25, delay: 0.09, gain: 0.022 }, // E5
      { freq: 783.99, delay: 0.18, gain: 0.020 }, // G5
      { freq: 987.77, delay: 0.27, gain: 0.016 }, // B5
      { freq: 1046.50, delay: 0.36, gain: 0.014 }  // C6
    ];

    chord.forEach((n, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      const startTime = now + n.delay;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(n.gain, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.2);

      if (panner) {
        panner.pan.setValueAtTime(((idx / (chord.length - 1)) * 1.0 - 0.5), startTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(masterGainRef.current);
        if (reverbRef.current) panner.connect(reverbRef.current);
      } else {
        osc.connect(gain);
        gain.connect(masterGainRef.current);
        if (reverbRef.current) gain.connect(reverbRef.current);
      }

      osc.start(startTime);
      osc.stop(startTime + 2.4);
      activeNodesRef.current.push(osc, gain);
    });
  }, [isMuted]);

  // Safe peaceful tether hum (Zero noise drone)
  const startTetherHum = useCallback(() => {}, []);
  const stopTetherHum = useCallback(() => {}, []);

  // 5. Peaceful Measurement Collapse Harmonic Resolution
  const playCollapseResolved = useCallback((outcome = '0') => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    // Gentle sub-harmonic swell
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(65, now + 0.35);

    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.04, now + 0.04);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    subOsc.connect(subGain);
    subGain.connect(masterGainRef.current);
    if (reverbRef.current) subGain.connect(reverbRef.current);

    subOsc.start(now);
    subOsc.stop(now + 0.45);

    // Crystalline resolution bell (C5 for 0, E5 for 1)
    const baseFreq = outcome === '0' ? 523.25 : 659.25;
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(baseFreq, now + 0.04);

    bellGain.gain.setValueAtTime(0, now + 0.04);
    bellGain.gain.linearRampToValueAtTime(0.035, now + 0.08);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    bellOsc.connect(bellGain);
    bellGain.connect(masterGainRef.current);
    if (reverbRef.current) bellGain.connect(reverbRef.current);

    bellOsc.start(now + 0.04);
    bellOsc.stop(now + 2.5);

    activeNodesRef.current.push(subOsc, subGain, bellOsc, bellGain);
  }, [isMuted]);

  // 6. Classical Scan / Copy Success Chime
  const playScanSuccess = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(260, now);
    sweep.frequency.exponentialRampToValueAtTime(523.25, now + 0.35);

    sweepGain.gain.setValueAtTime(0, now);
    sweepGain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    sweep.connect(sweepGain);
    sweepGain.connect(masterGainRef.current);
    if (reverbRef.current) sweepGain.connect(reverbRef.current);

    sweep.start(now);
    sweep.stop(now + 0.42);

    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1046.5, now + 0.35); // C6 bell

    bellGain.gain.setValueAtTime(0, now + 0.35);
    bellGain.gain.linearRampToValueAtTime(0.035, now + 0.38);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    bell.connect(bellGain);
    bellGain.connect(masterGainRef.current);
    if (reverbRef.current) bellGain.connect(reverbRef.current);

    bell.start(now + 0.35);
    bell.stop(now + 2.1);

    activeNodesRef.current.push(sweep, sweepGain, bell, bellGain);
  }, [isMuted]);

  // 7. Peaceful, Serene 3D Model Entrance Bloom (D-Major 9th Aura Chord: D3, A3, D4, F#4, A4, D5)
  // Swells softly as models rise and settle, then smoothly melts into background music before "Do You Know" appears
  const playModuleEntranceBloom = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    const notes = [
      { freq: 146.83, delay: 0.00, duration: 2.8, gain: 0.036 }, // D3 (warm foundational bass)
      { freq: 220.00, delay: 0.12, duration: 2.6, gain: 0.030 }, // A3 (5th)
      { freq: 293.66, delay: 0.26, duration: 2.4, gain: 0.026 }, // D4 (Octave bloom / VS badge)
      { freq: 369.99, delay: 0.42, duration: 2.2, gain: 0.022 }, // F#4 (Major 3rd / Qubit A)
      { freq: 440.00, delay: 0.56, duration: 2.0, gain: 0.020 }, // A4 (5th / Qubit B)
      { freq: 587.33, delay: 0.70, duration: 1.8, gain: 0.016 }, // D5 (Air shimmer / All settled)
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      const startTime = now + n.delay;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(n.gain, startTime + 0.22); // Soft graceful swell
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + n.duration); // Serene decay into reverb

      if (panner) {
        panner.pan.setValueAtTime(((n.freq % 100) / 100) * 0.8 - 0.4, startTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(masterGainRef.current);
        if (reverbRef.current) panner.connect(reverbRef.current);
      } else {
        osc.connect(gain);
        gain.connect(masterGainRef.current);
        if (reverbRef.current) gain.connect(reverbRef.current);
      }

      osc.start(startTime);
      osc.stop(startTime + n.duration + 0.1);
      activeNodesRef.current.push(osc, gain);
    });
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
    toggleMute,
    stopAll,
    playCameraPan,
    playStageTransition: playButtonClick,
    playButtonClick,
    playReset: playButtonClick,
    playTetherIgnite,
    startTetherHum,
    playTetherHum: startTetherHum,
    stopTetherHum,
    playTetherSnap: playCollapseResolved,
    playCollapseResolved,
    playScanSuccess,
    playModuleEntranceBloom,
  }), [initAudio, toggleMute, stopAll, playCameraPan, playButtonClick,
    playTetherIgnite, startTetherHum, stopTetherHum, playCollapseResolved,
    playScanSuccess, playModuleEntranceBloom]);
}
