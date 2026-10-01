import { useRef, useEffect, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, sharedBuffer } from './sharedAudio';

/**
 * useDiracAudio — Deep Space / Sci-Fi Web Audio synthesizer.
 *
 * Sound Design Philosophy (v3 - Peaceful, Ambient, Grounded):
 *  - CONTINUOUS 40Hz SUB-BASS across all steps to feel the 3D Quantum world.
 *  - Step 0: Perfect initial ping, but the long-tail is a whisper-quiet, peaceful ambient shimmer (no annoying noise).
 *  - Step 1: Smooth drop, satisfying heavy sub-bass impact.
 *  - Step 2: Peaceful, wide, graceful swirling space pad (no harsh throbbing).
 *  - Step 3: Graceful, smooth, elegant rising resolution (no data blips).
 */
export function useDiracAudio() {
  const ctxRef         = useRef(null);
  const masterGainRef  = useRef(null);
  const reverbRef      = useRef(null);
  


  // Per-step nodes
  const activeRef      = useRef([]);   
  const fadeGainRef    = useRef(null); 

  const initAudio = useCallback(async () => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') await ctxRef.current.resume();
      return;
    }

    const ctx = acquireAudioContext();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // Massive, dark space reverb (6 seconds)
    const tailLen  = ctx.sampleRate * 6.0;
    const impulse = sharedBuffer('useDiracAudio:impulse', () => {
      const built  = ctx.createBuffer(2, tailLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = built.getChannelData(ch);
        for (let i = 0; i < tailLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 1.5));
        }
      }
      return built;
    });
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    reverb.connect(master);
    reverbRef.current = reverb;

    // The global ambient background music from App.js will handle the background layer.
  }, []);

  const stopCurrent = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || activeRef.current.length === 0) return;

    const now = ctx.currentTime;
    if (fadeGainRef.current) {
      try {
        fadeGainRef.current.gain.cancelScheduledValues(now);
        fadeGainRef.current.gain.setValueAtTime(fadeGainRef.current.gain.value, now);
        fadeGainRef.current.gain.exponentialRampToValueAtTime(0.001, now + 1.5); // Smooth 1.5s fade out
      } catch (e) {}
    }

    activeRef.current.forEach(node => {
      try { node.stop(now + 1.8); } catch (e) {}
    });
    activeRef.current = [];
    fadeGainRef.current = null;
  }, []);

  const playStep = useCallback((stepIndex) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    stopCurrent();

    const startAt = ctx.currentTime + 0.05;



    const stepGain = ctx.createGain();
    stepGain.gain.setValueAtTime(0.001, startAt);
    fadeGainRef.current = stepGain;

    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    stepGain.connect(dry);
    dry.connect(masterGainRef.current);

    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    stepGain.connect(wet);
    wet.connect(reverbRef.current);

    const playGravityDrop = (time) => {
      // 1. The Whoosh/Swoop
      const swoop = ctx.createOscillator();
      swoop.type = 'sine';
      swoop.frequency.setValueAtTime(800, time);
      swoop.frequency.exponentialRampToValueAtTime(80, time + 0.15); // very fast downward swoop
      
      const swoopGain = ctx.createGain();
      swoopGain.gain.setValueAtTime(0, time);
      swoopGain.gain.linearRampToValueAtTime(0.3, time + 0.05);
      swoopGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

      swoop.connect(swoopGain);
      swoopGain.connect(stepGain);
      swoop.start(time);
      activeRef.current.push(swoop);

      // 2. The Heavy Sub-Impact
      const impact = ctx.createOscillator();
      impact.type = 'sine';
      impact.frequency.setValueAtTime(80, time + 0.1); 
      impact.frequency.exponentialRampToValueAtTime(30, time + 0.5); // Drops to sub-bass
      
      // Add a tiny bit of saturation by overdriving the gain slightly, then filtering
      const impactGain = ctx.createGain();
      impactGain.gain.setValueAtTime(0, time + 0.1);
      impactGain.gain.linearRampToValueAtTime(1.5, time + 0.15); // hard attack
      impactGain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
      
      const impactFilter = ctx.createBiquadFilter();
      impactFilter.type = 'lowpass';
      impactFilter.frequency.value = 150; // keep it muddy and heavy

      impact.connect(impactGain);
      impactGain.connect(impactFilter);
      impactFilter.connect(masterGainRef.current); // skip reverb for punch
      
      impact.start(time + 0.1);
      activeRef.current.push(impact);
    };

    if (stepIndex === 0) {
      // ─── STEP 0: The Tuning Fork (Crystal Clear, Celestial) ───────────────────
      // Per user request, no sound effect for Step 0. The global ambient drone is enough.
      
    } else if (stepIndex === 1) {
      // ─── STEP 1: The Gravity Drop (Heavy, Grounded, Inversion) ────────────────
      playGravityDrop(startAt);
      
      stepGain.gain.setValueAtTime(0.001, startAt);
      stepGain.gain.linearRampToValueAtTime(1.0, startAt + 0.05);

    } else if (stepIndex === 2) {
      // ─── STEP 2: The Phasing Swirl (Superposition, Floating, Unstable) ──────────
      playGravityDrop(startAt);
      
      // Lush, detuned chord (C maj9 suspended)
      const freqs = [130.81, 196.00, 261.63, 293.66, 392.00]; // C3, G3, C4, D4, G4
      
      freqs.forEach((freq, i) => {
        // Two oscillators per note, slightly detuned for phasing/chorus effect
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'triangle'; // adds a bit of harmonic richness
        
        osc1.frequency.value = freq;
        osc2.frequency.value = freq + (Math.random() * 2 - 1); // Random detune +/- 1Hz
        
        // Lowpass filter to keep the triangle wave smooth and buttery
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400 + (i * 100), startAt);
        filter.frequency.exponentialRampToValueAtTime(800, startAt + 2.0); // opens up slowly
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, startAt);
        oscGain.gain.linearRampToValueAtTime(0.05 / freqs.length, startAt + 1.0 + (i * 0.2)); // swell
        
        // Auto-panner for the swirl effect
        const panner = ctx.createStereoPanner();
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.2 + (i * 0.1); // different rotation speed for each note
        
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.8;
        lfo.connect(lfoGain);
        lfoGain.connect(panner.pan);
        lfo.start(startAt);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(panner);
        panner.connect(oscGain);
        oscGain.connect(stepGain);
        
        osc1.start(startAt);
        osc2.start(startAt);
        activeRef.current.push(osc1, osc2, lfo);
      });

      wet.gain.value = 0.9; // heavy reverb space
      stepGain.gain.setValueAtTime(0.001, startAt);
      stepGain.gain.linearRampToValueAtTime(1.0, startAt + 1.0);

    } else if (stepIndex === 3) {
      // ─── STEP 3: The Conjugate Transpose (Peaceful, Warm Swell) ───────────────
      // A smooth, beep-free, warm pad that swells in and out, reflecting the "dual space".
      // No Gravity Drop, no arpeggios, no noise sweeps. Completely peaceful.
      
      const freqs = [110.00, 146.83, 164.81]; // A2, D3, E3 (suspended, warm)
      
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; // pure and smooth, no harshness
        osc.frequency.value = freq;
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, startAt);
        // Very slow attack, very slow decay for maximum peacefulness
        oscGain.gain.linearRampToValueAtTime(0.15, startAt + 1.5);
        oscGain.gain.setTargetAtTime(0.001, startAt + 2.5, 1.0);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, startAt);
        filter.frequency.linearRampToValueAtTime(600, startAt + 1.5); // gently opens up
        filter.frequency.setTargetAtTime(200, startAt + 2.5, 1.0);
        
        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(stepGain);
        
        osc.start(startAt);
        activeRef.current.push(osc);
      });

      wet.gain.value = 0.9; // bathed in reverb for deep space feel
      stepGain.gain.setValueAtTime(0.001, startAt);
      stepGain.gain.linearRampToValueAtTime(1.0, startAt + 0.1);
    }

  }, [stopCurrent]);

  const stopAll = useCallback(() => {
    stopCurrent();
    

  }, [stopCurrent]);

  const toggleMute = useCallback((isMuted) => {
    if (ctxRef.current && masterGainRef.current) {
      const now = ctxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, now);
      masterGainRef.current.gain.linearRampToValueAtTime(isMuted ? 0 : 0.75, now + 1.0);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        releaseAudioOutput(masterGainRef.current);
      }
    };
  }, [stopAll]);

  return useMemo(() => ({ initAudio, playStep, stopAll, toggleMute }),
    [initAudio, playStep, stopAll, toggleMute]);
}
