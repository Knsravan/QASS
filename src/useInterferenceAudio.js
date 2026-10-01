import { useEffect, useRef, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, sharedBuffer } from './sharedAudio';

export function useInterferenceAudio(isMuted) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const reverbRef = useRef(null);
  const activeNodesRef = useRef([]);

  const sliderOscRef = useRef(null);
  const sliderGainRef = useRef(null);

  const initAudio = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = acquireAudioContext();
      ctxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : 0.8;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;
      
      const length = ctx.sampleRate * 2.5; 
      const impulse = sharedBuffer('useInterferenceAudio:impulse', () => {
        const built = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const channel = built.getChannelData(c);
          for (let i = 0; i < length; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.3));
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
      activeNodesRef.current.forEach(node => {
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

      if (sliderOscRef.current) {
        try { sliderOscRef.current.stop(); } catch (e) {}
        sliderOscRef.current = null;
        sliderGainRef.current = null;
      }
    }
  }, []);

  const playHover = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }, [isMuted]);

  const playDragStart = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    
    // Just a clean, sharp UI click (no sweep)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, [isMuted]);

  const playDragDrop = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination); 
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }, [isMuted]);

  const playCameraPan = useCallback((duration, type = 'intro') => {
    if (!ctxRef.current || !reverbRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    
    if (type === 'zoom-in') {
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + duration);
    } else if (type === 'top-down') {
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + duration);
    } else if (type === 'strafe') {
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + duration);
      // add some subtle frequency modulation
      osc.frequency.linearRampToValueAtTime(125, now + duration * 0.5);
      osc.frequency.linearRampToValueAtTime(120, now + duration);
    } else {
      // Default intro sweep
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + duration * 0.8);
      osc.frequency.exponentialRampToValueAtTime(80, now + duration);
    }
    
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    if (type === 'zoom-in' || type === 'top-down') {
      filter.frequency.setValueAtTime(150, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + duration);
    } else if (type === 'strafe') {
      filter.frequency.setValueAtTime(150, now);
      filter.frequency.linearRampToValueAtTime(250, now + duration * 0.5);
      filter.frequency.linearRampToValueAtTime(150, now + duration);
    } else {
      filter.frequency.setValueAtTime(100, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + duration * 0.8);
      filter.frequency.exponentialRampToValueAtTime(100, now + duration);
    }

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(type === 'intro' ? 0.3 : 0.15, now + duration * 0.5); 
    oscGain.gain.linearRampToValueAtTime(0, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(type === 'intro' ? 0.1 : 0.05, now + duration * 0.5); 
    noiseGain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(oscGain);
    oscGain.connect(reverbRef.current);
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(reverbRef.current);
    
    osc.start(now);
    noiseSource.start(now);
    osc.stop(now + duration + 0.1);
    activeNodesRef.current.push(osc, oscGain, noiseSource, noiseGain);
  }, [isMuted]);

  const playHGateSplit = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    const freqs = [880, 1320]; // Splitting into a perfect fifth
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const panner = ctx.createStereoPanner();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 2, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.4);

      panner.pan.setValueAtTime(0, now);
      panner.pan.linearRampToValueAtTime(i === 0 ? -0.8 : 0.8, now + 0.4); // Pan out to sides

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(panner);
      panner.connect(gain);
      gain.connect(reverbRef.current);

      osc.start(now);
      osc.stop(now + 1.5);
      activeNodesRef.current.push(osc, gain);
    });
  }, [isMuted]);

  const playZGateInversion = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.8); // Deep phase shift sweep

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    osc.connect(gain);
    gain.connect(reverbRef.current);
    
    osc.start(now);
    osc.stop(now + 1.2);
    activeNodesRef.current.push(osc, gain);
  }, [isMuted]);

  const playHGateResolve = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    // Vacuum suction
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.5);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.4);
    gain.gain.setTargetAtTime(0.001, now + 0.5, 0.1);

    // Impact
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(150, now + 0.5);
    impact.frequency.exponentialRampToValueAtTime(40, now + 1.0);
    
    impactGain.gain.setValueAtTime(0, now + 0.5);
    impactGain.gain.linearRampToValueAtTime(0.5, now + 0.52);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain);
    gain.connect(reverbRef.current);
    impact.connect(impactGain);
    impactGain.connect(masterGainRef.current); // Direct punch

    osc.start(now);
    osc.stop(now + 0.7);
    impact.start(now + 0.5);
    impact.stop(now + 1.6);
    activeNodesRef.current.push(osc, gain, impact, impactGain);
  }, [isMuted]);

  const playConstructive = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    // Peaceful, warm sine swell like Dirac step 3
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    
    const gainNode = ctx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'sine';
    
    // A2, E3, A3 warm chord
    osc1.frequency.setValueAtTime(110.00, now);
    osc2.frequency.setValueAtTime(164.81, now);
    osc3.frequency.setValueAtTime(220.00, now);
    
    gainNode.gain.setValueAtTime(0, now);
    // Slow blooming attack
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.8);
    // Very slow peaceful decay
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    osc3.connect(gainNode);
    gainNode.connect(reverbRef.current);
    
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    
    osc1.stop(now + 3.1);
    osc2.stop(now + 3.1);
    osc3.stop(now + 3.1);
    
    activeNodesRef.current.push(osc1, osc2, osc3, gainNode);
  }, [isMuted]);

  const playDestructive = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    const noiseSize = ctx.sampleRate * 1.0;
    const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseSize; i++) output[i] = Math.random() * 2 - 1;
    
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.4);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(reverbRef.current);
    
    noiseSrc.start(now);
    
    activeNodesRef.current.push(noiseSrc, noiseFilter, noiseGain);
  }, [isMuted]);

  const startPhaseSlider = useCallback(() => {
    if (!ctxRef.current || isMuted || sliderOscRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
    
    osc.connect(gain);
    gain.connect(reverbRef.current);
    
    osc.start(now);
    sliderOscRef.current = osc;
    sliderGainRef.current = gain;
  }, [isMuted]);

  const updatePhaseSlider = useCallback((phase) => {
    if (!ctxRef.current || !sliderOscRef.current) return;
    const ctx = ctxRef.current;
    const normPhase = phase / Math.PI; 
    const freq = 200 + Math.abs(normPhase - 1) * 200; 
    sliderOscRef.current.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  }, []);

  const stopPhaseSlider = useCallback(() => {
    if (!ctxRef.current || !sliderGainRef.current) return;
    const now = ctxRef.current.currentTime;

    // Null the refs synchronously so a re-grab within the fade window
    // starts a fresh oscillator instead of driving this dying one
    const osc = sliderOscRef.current;
    const gain = sliderGainRef.current;
    sliderOscRef.current = null;
    sliderGainRef.current = null;

    gain.gain.setTargetAtTime(0, now, 0.1);
    setTimeout(() => {
      try { osc.stop(); } catch (e) {}
    }, 200);
  }, []);

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
    playHover,
    playDragStart,
    playDragDrop,
    playCameraPan,
    playHGateSplit,
    playZGateInversion,
    playHGateResolve,
    playConstructive,
    playDestructive,
    startPhaseSlider,
    updatePhaseSlider,
    stopPhaseSlider
  }), [initAudio, stopAll, playHover, playDragStart, playDragDrop, playCameraPan,
    playHGateSplit, playZGateInversion, playHGateResolve, playConstructive,
    playDestructive, startPhaseSlider, updatePhaseSlider, stopPhaseSlider]);
}
