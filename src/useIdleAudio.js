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

      // Low-pass filter for the pad sound
      filter.current = audioCtx.current.createBiquadFilter();
      filter.current.type = 'lowpass';
      filter.current.frequency.value = 200;
      filter.current.Q.value = 1;
      filter.current.connect(masterGain.current);

      // LFO for filter sweep
      lfo.current = audioCtx.current.createOscillator();
      lfo.current.type = 'sine';
      lfo.current.frequency.value = 0.05; // Very slow sweep (20 seconds)

      lfoGain.current = audioCtx.current.createGain();
      lfoGain.current.gain.value = 300; // Sweep range

      lfo.current.connect(lfoGain.current);
      lfoGain.current.connect(filter.current.frequency);
      lfo.current.start();

      // Osc 1 (Root)
      osc1.current = audioCtx.current.createOscillator();
      osc1.current.type = 'sine';
      osc1.current.frequency.value = 110; // A2
      osc1.current.connect(filter.current);
      osc1.current.start();

      // Osc 2 (Detuned 5th)
      osc2.current = audioCtx.current.createOscillator();
      osc2.current.type = 'triangle';
      osc2.current.frequency.value = 165.2; // slightly detuned E3

      // Lower volume for the triangle wave
      const osc2Gain = audioCtx.current.createGain();
      osc2Gain.gain.value = 0.4;
      osc2.current.connect(osc2Gain);
      osc2Gain.connect(filter.current);
      osc2.current.start();

    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(fadeInterval.current);
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        releaseAudioOutput(masterGain.current);
      }
    };
  }, []);

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
  }, [isMuted, initAudio]);

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
      }
    }, stepTime);
  }, []);

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
