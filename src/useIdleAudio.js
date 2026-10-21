import { useRef, useEffect, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput } from './sharedAudio';

export const useIdleAudio = (isMuted) => {
  const audioCtx = useRef(null);
  const masterGain = useRef(null);
  const osc1 = useRef(null);
  const osc2 = useRef(null);
  const filter = useRef(null);
  const lfo = useRef(null);
  const lfoGain = useRef(null);
  const fadeInterval = useRef(null);
  const isPlaying = useRef(false);
  const wantsAmbient = useRef(false);

  // Deferred until the first playAmbient() call (reachable from a user
  // gesture) so the AudioContext isn't created before autoplay is allowed
  const initAudio = useCallback(() => {
    if (audioCtx.current) return;
    try {
      audioCtx.current = acquireAudioContext();
      masterGain.current = audioCtx.current.createGain();
      masterGain.current.gain.value = 0; // Start silent
      masterGain.current.connect(audioCtx.current.destination);
    } catch (e) {
      if (import.meta.env.DEV) console.warn("AudioContext not supported", e);
    }
  }, []);

  // The pad's voices run only while it plays: they are built when it starts and
  // stopped once it has faded out (they used to run for the rest of the visit,
  // muted, inside modules and in hidden tabs).
  const startVoices = useCallback(() => {
    const ctx = audioCtx.current;
    if (!ctx || osc1.current) return;
    // Low-pass filter for the pad sound
    filter.current = ctx.createBiquadFilter();
    filter.current.type = 'lowpass';
    filter.current.frequency.value = 200;
    filter.current.Q.value = 1;
    filter.current.connect(masterGain.current);

    // LFO for filter sweep
    lfo.current = ctx.createOscillator();
    lfo.current.type = 'sine';
    lfo.current.frequency.value = 0.05; // Very slow sweep (20 seconds)
    lfoGain.current = ctx.createGain();
    lfoGain.current.gain.value = 300; // Sweep range
    lfo.current.connect(lfoGain.current);
    lfoGain.current.connect(filter.current.frequency);
    lfo.current.start();

    // Osc 1 (Root)
    osc1.current = ctx.createOscillator();
    osc1.current.type = 'sine';
    osc1.current.frequency.value = 110; // A2
    osc1.current.connect(filter.current);
    osc1.current.start();

    // Osc 2 (Detuned 5th), quieter (a triangle wave)
    osc2.current = ctx.createOscillator();
    osc2.current.type = 'triangle';
    osc2.current.frequency.value = 165.2; // slightly detuned E3
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.4;
    osc2.current.connect(osc2Gain);
    osc2Gain.connect(filter.current);
    osc2.current.start();
  }, []);
  const stopVoices = useCallback(() => {
    [osc1, osc2, lfo].forEach((r) => { try { r.current?.stop(); } catch { /* already stopped */ } r.current?.disconnect(); r.current = null; });
    lfoGain.current?.disconnect(); lfoGain.current = null;
    filter.current?.disconnect(); filter.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(fadeInterval.current);
      stopVoices();
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        releaseAudioOutput(masterGain.current);
      }
    };
  }, [stopVoices]);

  const playAmbient = useCallback(() => {
    wantsAmbient.current = true;
    if (isMuted || isPlaying.current) return;
    initAudio();
    if (!audioCtx.current) return;
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }

    clearInterval(fadeInterval.current);
    isPlaying.current = true;
    startVoices();
    
    // Smooth fade in over 2 seconds to max ambient volume (very quiet)
    const targetGain = 0.04;
    const steps = 20;
    const stepTime = 100;
    const gainStep = targetGain / steps;
    
    fadeInterval.current = setInterval(() => {
      if (masterGain.current.gain.value < targetGain) {
        masterGain.current.gain.value = Math.min(targetGain, masterGain.current.gain.value + gainStep);
      } else {
        clearInterval(fadeInterval.current);
      }
    }, stepTime);
  }, [isMuted, initAudio, startVoices]);

  const stopAmbient = useCallback(() => {
    wantsAmbient.current = false;
    if (!audioCtx.current || !isPlaying.current) return;
    
    clearInterval(fadeInterval.current);
    isPlaying.current = false;
    
    // Smooth fade out over 1 second
    const steps = 10;
    const stepTime = 100;
    const currentGain = masterGain.current.gain.value;
    const gainStep = currentGain / steps;
    
    fadeInterval.current = setInterval(() => {
      if (masterGain.current.gain.value > 0.001) {
        masterGain.current.gain.value = Math.max(0, masterGain.current.gain.value - gainStep);
      } else {
        masterGain.current.gain.value = 0;
        clearInterval(fadeInterval.current);
        if (!isPlaying.current) stopVoices();
      }
    }, stepTime);
  }, [stopVoices]);

  useEffect(() => {
    if (isMuted && isPlaying.current) {
      // Fade out but remember the intent so unmuting can resume the pad
      stopAmbient();
      wantsAmbient.current = true;
    } else if (!isMuted && wantsAmbient.current) {
      // Re-trigger play to fade back in if it was active
      isPlaying.current = false;
      playAmbient();
    }
  }, [isMuted, playAmbient, stopAmbient]);

  return useMemo(() => ({ playAmbient, stopAmbient }), [playAmbient, stopAmbient]);
};
