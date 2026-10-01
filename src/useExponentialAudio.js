// ==========================================
// EXPONENTIAL STATE SPACE AUDIO SYNTHESIZER
// High-tech harmonic chords, drone sweeps, and quantum soundscapes
// ==========================================

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput } from './sharedAudio';

export function useExponentialAudio() {
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const activeNodesRef = useRef([]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      if (AudioContext) {
        audioCtxRef.current = acquireAudioContext();
        const master = audioCtxRef.current.createGain();
        master.gain.value = 1;
        master.connect(audioCtxRef.current.destination);
        masterGainRef.current = master;
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    if (audioCtxRef.current && masterGainRef.current) {
      // Restore the master chain in case a previous stopAll faded it out
      const now = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setValueAtTime(1, now);
    }
    return audioCtxRef.current;
  }, []);

  const trackSource = useCallback((node) => {
    activeNodesRef.current.push(node);
    node.onended = () => {
      activeNodesRef.current = activeNodesRef.current.filter(n => n !== node);
    };
  }, []);

  const stopAll = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (masterGainRef.current) {
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setTargetAtTime(0, now, 0.05);
    }
    activeNodesRef.current.forEach(node => {
      try { node.stop(now + 0.3); } catch (e) {}
    });
    activeNodesRef.current = [];
  }, []);

  // 1. Ascending Harmonic Chord when Qubit Count Changes
  const playQubitAdded = useCallback((n = 1) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Base fundamental frequency
      const baseFreq = 160;
      // Musical interval ratios for expanding state space
      const intervals = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4];
      const ratio = intervals[(n - 1) % intervals.length];
      const targetFreq = baseFreq * ratio;

      // Main chime tone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(targetFreq, now);
      osc2.frequency.setValueAtTime(targetFreq * 2.01, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.6);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainRef.current);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.75);
      osc2.stop(now + 0.75);
      trackSource(osc1);
      trackSource(osc2);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [getAudioContext, trackSource]);

  // 2. Hadamard Parallel Superposition Explosion Sound
  const playHadamardExplosion = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Multi-layer resonant sweep
      const freqs = [220, 330, 440, 550, 660, 880];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const delay = idx * 0.03;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * 0.8, now + delay);
        osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + delay + 0.35);

        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(0.09 / freqs.length, now + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.2);

        osc.connect(gain);
        gain.connect(masterGainRef.current);

        osc.start(now + delay);
        osc.stop(now + delay + 1.3);
        trackSource(osc);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [getAudioContext, trackSource]);

  // 3. Cinematic Camera Drone Whoosh
  const playDroneWhoosh = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Stereo low-pass filtered noise + sub-bass swoop
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.5);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.2, now + 0.1);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      sub.connect(subGain);
      subGain.connect(masterGainRef.current);

      sub.start(now);
      sub.stop(now + 0.65);
      trackSource(sub);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [getAudioContext, trackSource]);

  // 4. Stage Transition Glass Click
  const playStageTransition = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      osc.connect(gain);
      gain.connect(masterGainRef.current);

      osc.start(now);
      osc.stop(now + 0.08);
      trackSource(osc);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [getAudioContext, trackSource]);

  // 5. Interference Pulse (Constructive / Destructive Wave)
  const playInterferencePulse = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.2);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(5.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainRef.current);

      osc.start(now);
      osc.stop(now + 0.85);
      trackSource(osc);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [getAudioContext, trackSource]);

  // 6. Reset Tone
  const playReset = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(gain);
      gain.connect(masterGainRef.current);

      osc.start(now);
      osc.stop(now + 0.25);
      trackSource(osc);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [getAudioContext, trackSource]);

  useEffect(() => {
    return () => {
      stopAll();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        releaseAudioOutput(masterGainRef.current);
      }
    };
  }, [stopAll]);

  return useMemo(() => ({
    playQubitAdded,
    playHadamardExplosion,
    playDroneWhoosh,
    playStageTransition,
    playInterferencePulse,
    playReset,
    stopAll
  }), [playQubitAdded, playHadamardExplosion, playDroneWhoosh,
    playStageTransition, playInterferencePulse, playReset, stopAll]);
}
