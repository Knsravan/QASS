import { useRef, useEffect, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, createOutputChain, easeMasterGain } from './sharedAudio';

export function useQuantumAudio() {
  const audioCtxRef = useRef(null);
  const activeNodesRef = useRef([]);
  const masterGainRef = useRef(null);
  const reverbRef = useRef(null);
  const masterFilterRef = useRef(null);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = acquireAudioContext();
      audioCtxRef.current = ctx;
      
      // The master chain: quiet overall, a warm, dark low-pass and a four-second reverb.
      const chain = createOutputChain(ctx, { volume: 0.5, lowpass: 1500, reverb: { key: 'useQuantumAudio:impulse', seconds: 4.0, decay: 0.8 } });
      masterGainRef.current = chain.master;
      masterFilterRef.current = chain.filter;
      reverbRef.current = chain.reverb;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const toggleMute = useCallback((isMuted) => {
    easeMasterGain(audioCtxRef.current, masterGainRef.current, isMuted, 0.5, { ramp: 1.0 });
  }, []);

  const stopCurrentAudio = useCallback(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    
    activeNodesRef.current.forEach(node => {
      if (node.gainNode) {
        try {
          node.gainNode.gain.cancelScheduledValues(now);
          node.gainNode.gain.linearRampToValueAtTime(0.001, now + 2.0); // 2 second crossfade
        } catch (e) {}
      }
      if (node.oscillator) {
        try {
          node.oscillator.stop(now + 2.0);
        } catch (e) {}
      }
    });
    activeNodesRef.current = [];
  }, []);

  const playGroundState = useCallback(() => {
    if (!audioCtxRef.current) return;
    stopCurrentAudio();
    const ctx = audioCtxRef.current;
    const dest = reverbRef.current; // Send to reverb
    
    // Very quiet, warm, deep presence
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.type = 'sine'; osc1.frequency.value = 55; // A1
    osc2.type = 'sine'; osc2.frequency.value = 110; // A2
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3.0); // Extremely soft
    
    osc1.start(); osc2.start();
    
    activeNodesRef.current.push({ oscillator: osc1, gainNode: gain });
    activeNodesRef.current.push({ oscillator: osc2, gainNode: null });
  }, [stopCurrentAudio]);

  const playHadamard = useCallback(() => {
    if (!audioCtxRef.current) return;
    stopCurrentAudio();
    const ctx = audioCtxRef.current;
    const dest = reverbRef.current;
    
    // An ethereal, swelling breath of energy instead of a laser sweep
    const freqs = [164.81, 246.94, 329.63]; // E3, B3, E4 chord
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      // Slight pitch bend up for "energizing" feel
      osc.frequency.setValueAtTime(freq * 0.95, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + 3.0);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      // Swell up, then settle
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.5);
      gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 4.0);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      
      activeNodesRef.current.push({ oscillator: osc, gainNode: gain });
    });
  }, [stopCurrentAudio]);

  const playInfinitePossibilities = useCallback(() => {
    if (!audioCtxRef.current) return;
    stopCurrentAudio();
    const ctx = audioCtxRef.current;
    const dest = reverbRef.current;
    
    // Retaining the user's favorite A-major swirling pad, but routed through reverb to make it sound incredibly spatial and natural
    const freqs = [220, 277.18, 329.63, 659.25]; // A3, C#4, E4, E5
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const panner = ctx.createStereoPanner();
      const gain = ctx.createGain();
      
      osc.type = i === 3 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 1.0 + (i * 0.3); // Slower, calmer swirl
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1;
      lfo.connect(lfoGain);
      lfoGain.connect(panner.pan);
      lfo.start();

      gain.gain.setValueAtTime(0, ctx.currentTime);
      // Volume reduced by 50% so it's not piercing
      gain.gain.linearRampToValueAtTime(i === 3 ? 0.02 : 0.05, ctx.currentTime + 2.0); 
      
      osc.connect(panner);
      panner.connect(gain);
      gain.connect(dest);
      osc.start();
      
      activeNodesRef.current.push({ oscillator: osc, gainNode: gain });
      activeNodesRef.current.push({ oscillator: lfo, gainNode: null });
    });
  }, [stopCurrentAudio]);

  const playCollapseAnticipation = useCallback(() => {
    if (!audioCtxRef.current) return;
    stopCurrentAudio();
    const ctx = audioCtxRef.current;
    const dest = reverbRef.current;
    
    // Shimmering, tense but harmonious aura (A3 + E4) with very slow LFO breathing
    const freqs = [220, 329.63];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const breathLfo = ctx.createOscillator();
      const breathGain = ctx.createGain();
      breathLfo.type = 'sine';
      breathLfo.frequency.value = 0.2; // 1 breath every 5 seconds
      breathGain.gain.value = 0.02; // Modulate volume gently
      
      breathLfo.connect(breathGain);
      breathGain.connect(gain.gain);
      breathLfo.start();
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.0);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      
      activeNodesRef.current.push({ oscillator: osc, gainNode: gain });
      activeNodesRef.current.push({ oscillator: breathLfo, gainNode: null });
    });
  }, [stopCurrentAudio]);

  const playMeasurement = useCallback(() => {
    if (!audioCtxRef.current) return;
    stopCurrentAudio();
    const ctx = audioCtxRef.current;
    const dest = reverbRef.current;
    
    // Celestial, very soft, non-looping bell echoing in the massive reverb space
    const baseFreq = 440; // A4
    const ratios = [1, 1.5, 2.0, 2.5]; // More harmonious ratios
    ratios.forEach((ratio) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * ratio;
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      // Extremely soft attack
      gain.gain.linearRampToValueAtTime(0.03 / ratios.length, ctx.currentTime + 0.5);
      // Deep 10-second fade out into the reverb
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 10.0);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 10.0);
    });
  }, [stopCurrentAudio]);

  const playGateSequence = useCallback((gateId, delay = 0) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const dest = reverbRef.current;
    
    // Sub-bass whoosh
    const whooshOsc = ctx.createOscillator();
    const whooshGain = ctx.createGain();
    whooshOsc.type = 'sine';
    whooshOsc.frequency.setValueAtTime(60, ctx.currentTime + delay);
    whooshOsc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + delay + 1.0);
    
    whooshGain.gain.setValueAtTime(0, ctx.currentTime + delay);
    whooshGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.1);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 1.0);
    
    whooshOsc.connect(whooshGain);
    whooshGain.connect(dest);
    whooshOsc.start(ctx.currentTime + delay);
    whooshOsc.stop(ctx.currentTime + delay + 1.0);

    // Subtle reverse swoosh right at the end to signal state lock
    const swoopOsc = ctx.createOscillator();
    const swoopGain = ctx.createGain();
    swoopOsc.type = 'sine';
    swoopOsc.frequency.setValueAtTime(200, ctx.currentTime + delay + 1.2);
    swoopOsc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + delay + 1.5);
    
    swoopGain.gain.setValueAtTime(0, ctx.currentTime + delay + 1.2);
    swoopGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + delay + 1.5);
    swoopGain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 1.6);
    
    swoopOsc.connect(swoopGain);
    swoopGain.connect(dest);
    swoopOsc.start(ctx.currentTime + delay + 1.2);
    swoopOsc.stop(ctx.currentTime + delay + 1.6);
  }, []);

  useEffect(() => {
    return () => {
      stopCurrentAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        releaseAudioOutput(masterGainRef.current);
      }
    };
  }, [stopCurrentAudio]);

  return useMemo(() => ({
    initAudio, stopCurrentAudio, toggleMute, playGateSequence,
    playGroundState, playHadamard, playInfinitePossibilities, playCollapseAnticipation, playMeasurement,
  }), [initAudio, stopCurrentAudio, toggleMute, playGateSequence,
    playGroundState, playHadamard, playInfinitePossibilities, playCollapseAnticipation, playMeasurement]);
}


