import { useEffect, useRef, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, sharedBuffer } from './sharedAudio';

export function useGatesAudio() {
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
      masterGain.gain.value = 0.8;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;
      
      // Synthetic Reverb for massive space
      const length = ctx.sampleRate * 3.0; // 3 seconds tail
      const impulse = sharedBuffer('useGatesAudio:impulse', () => {
        const built = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const channel = built.getChannelData(c);
          for (let i = 0; i < length; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.5));
          }
        }
        return built;
      });
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      reverb.connect(masterGain);
      reverbRef.current = reverb;
    }

    if (ambientNodesRef.current.length === 0) {
      const ctx = ctxRef.current;
      // Start ambient background (Quantum Vacuum)
      const ambGain = ctx.createGain();
      
      // Vacuum Wind noise
      const noiseSize = ctx.sampleRate * 2.0;
      const ambNoiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
      const ambOutput = ambNoiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseSize; i++) ambOutput[i] = Math.random() * 2 - 1;
      
      const ambNoise = ctx.createBufferSource();
      ambNoise.buffer = ambNoiseBuffer;
      ambNoise.loop = true;
      
      const ambFilter = ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 150; // Smooth, deep rumble
      
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.05; // Extremely slow 20-second sweep
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 50; // Gentle sweep +-50Hz
      
      lfo.connect(lfoGain);
      lfoGain.connect(ambFilter.frequency);
      
      ambNoise.connect(ambFilter);
      ambFilter.connect(ambGain);
      
      ambGain.gain.value = 0;
      ambGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 4.0); // Very smooth fade in
      
      ambGain.connect(reverbRef.current);
      
      ambNoise.start();
      lfo.start();
      ambientNodesRef.current = [ambNoise, lfo, ambGain];
    }

    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
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
             node.stop(now + 0.5);
          }
        } catch (e) {}
      });
      activeNodesRef.current = [];
      ambientNodesRef.current = [];
    }
  }, []);

  // Track a group of nodes and prune them once their source finishes,
  // so activeNodesRef (and its noise buffers) don't grow for the whole session
  const trackNodes = useCallback((source, nodes) => {
    activeNodesRef.current.push(...nodes);
    source.onended = () => {
      activeNodesRef.current = activeNodesRef.current.filter(n => !nodes.includes(n));
    };
  }, []);

  const toggleMute = useCallback((isMuted) => {
    if (ctxRef.current && masterGainRef.current) {
      const now = ctxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, now);
      masterGainRef.current.gain.linearRampToValueAtTime(isMuted ? 0 : 0.8, now + 1.0);
    }
  }, []);

  const playCameraPan = useCallback((duration) => {
    if (!ctxRef.current || !reverbRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    // Smooth elegant sine wave sweep for camera
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + duration * 0.8);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);
    
    // Add a tiny bit of filtered noise to make it breathe smoothly
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + duration * 0.8);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.3, now + duration * 0.5); 
    oscGain.gain.linearRampToValueAtTime(0, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.1, now + duration * 0.5); 
    noiseGain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(oscGain);
    oscGain.connect(reverbRef.current);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(reverbRef.current);
    
    osc.start(now);
    noiseSource.start(now);
    osc.stop(now + duration + 0.1);
    trackNodes(osc, [osc, oscGain]);
    trackNodes(noiseSource, [noiseSource, noiseGain]);
  }, [trackNodes]);

  const playGateSequence = useCallback((gateId, delay = 0) => {
    if (!ctxRef.current || !reverbRef.current) return;
    const ctx = ctxRef.current;
    
    // 1. Play camera pan immediately
    if (delay > 0) playCameraPan(delay);
    
    const startTime = ctx.currentTime + delay;
    const dest = reverbRef.current;
    
    const playOsc = (type, freqStart, freqEnd, gMax, dur) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, startTime);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + dur);
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(gMax, startTime + dur * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.1);
      trackNodes(osc, [osc, g]);
    };

    switch (gateId) {
      case 'pauli-x':
        playOsc('sine', 60, 20, 0.4, 1.0); // Sub drop
        playOsc('triangle', 200, 400, 0.15, 0.8); // Smooth elegant sweep up
        break;
      case 'pauli-y':
        playOsc('sine', 60, 20, 0.4, 1.0); 
        playOsc('triangle', 400, 200, 0.15, 0.8); // Smooth sweep down
        break;
      case 'pauli-z':
        playOsc('sine', 100, 50, 0.4, 1.2); // Resonant thud
        playOsc('sine', 800, 400, 0.1, 0.8); // Ethereal chime
        break;
      case 'hadamard':
        playOsc('sine', 220, 222, 0.1, 1.5); // Root beating
        playOsc('sine', 330, 332, 0.08, 1.5); // Fifth beating
        playOsc('sine', 440, 442, 0.06, 1.5); // Octave beating
        playOsc('sine', 880, 440, 0.05, 1.2); // Shimmer bell
        break;
      case 's-gate':
        playOsc('triangle', 200, 300, 0.1, 0.6); // Sweep up
        playOsc('sine', 800, 800, 0.1, 0.3); // Tick
        break;
      case 't-gate':
        playOsc('triangle', 300, 450, 0.08, 0.4); // Quick swoop
        playOsc('sine', 1200, 1200, 0.1, 0.2); // High click
        break;
      case 'reset':
        playOsc('sine', 100, 400, 0.2, 0.5); // Smooth vacuum suction
        break;
      default:
        break;
    }
  }, [playCameraPan, trackNodes]);

  const playConditionalFire = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const dest = reverbRef.current;

    // Two oscillators a perfect fifth apart
    const playOsc = (freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.005); // 5ms attack
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.150); // 150ms decay
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.160);
      trackNodes(osc, [osc, gain]);
    };

    playOsc(440);
    playOsc(660);
  }, [trackNodes]);

  const playFizzle = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const dest = reverbRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    osc.start(now);
    osc.stop(now + 0.25);
    trackNodes(osc, [osc, gain, filter]);
  }, [trackNodes]);

  const playEntanglement = useCallback(() => {
    if (!ctxRef.current || !reverbRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const dest = reverbRef.current;

    // The visual animation is a 3.0 second timeline with a blast at exactly 1.5s (progress 0.5)

    // PART 1: The Shaking (0s to 1.5s) - Sci-Fi Reactor Spool Up
    // Low frequency triangle wave that pitches up, mimicking energy building
    const spoolOsc = ctx.createOscillator();
    const spoolGain = ctx.createGain();
    
    spoolOsc.type = 'triangle';
    spoolOsc.frequency.setValueAtTime(40, now);
    spoolOsc.frequency.exponentialRampToValueAtTime(100, now + 1.5); 
    
    spoolGain.gain.setValueAtTime(0, now);
    spoolGain.gain.linearRampToValueAtTime(0.12, now + 1.2);
    spoolGain.gain.setTargetAtTime(0.001, now + 1.5, 0.1); // Quick cut exactly at the blast

    spoolOsc.connect(spoolGain);
    spoolGain.connect(dest);
    
    spoolOsc.start(now);
    spoolOsc.stop(now + 1.6);

    trackNodes(spoolOsc, [spoolOsc, spoolGain]);

    // PART 2: The Blast / Shockwave (at exactly 1.5s) - Cinematic Sub-Drop & Vacuum Impact
    const blastTime = now + 1.5;
    
    // Sub-drop
    const dropOsc = ctx.createOscillator();
    const dropGain = ctx.createGain();
    dropOsc.type = 'sine';
    dropOsc.frequency.setValueAtTime(150, blastTime);
    dropOsc.frequency.exponentialRampToValueAtTime(20, blastTime + 0.6); // Massive cinematic pitch drop
    
    dropGain.gain.setValueAtTime(0, blastTime);
    dropGain.gain.linearRampToValueAtTime(0.3, blastTime + 0.02); // Punchy impact
    dropGain.gain.setTargetAtTime(0.001, blastTime + 0.2, 0.5);
    
    dropOsc.connect(dropGain);
    dropGain.connect(dest);
    dropOsc.start(blastTime);
    dropOsc.stop(blastTime + 1.5);
    
    // Vacuum airlock noise
    const bufferSize = ctx.sampleRate * 1.0;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, blastTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, blastTime + 0.4);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, blastTime);
    noiseGain.gain.linearRampToValueAtTime(0.15, blastTime + 0.05);
    noiseGain.gain.setTargetAtTime(0.001, blastTime + 0.1, 0.3);
    
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    
    noiseSrc.start(blastTime);
    trackNodes(dropOsc, [dropOsc, dropGain, noiseSrc, noiseFilter, noiseGain]);

    // PART 3: The Q-Sphere Entrance (1.5s to 3.0s) - Holographic Drone
    // Detuned sawtooths heavily filtered to sound like a massive, throbbing sci-fi structure, not musical
    const holoOsc1 = ctx.createOscillator();
    const holoOsc2 = ctx.createOscillator();
    const holoGain = ctx.createGain();
    const holoFilter = ctx.createBiquadFilter();

    holoOsc1.type = 'sawtooth';
    holoOsc2.type = 'sawtooth';
    
    holoOsc1.frequency.setValueAtTime(100, blastTime);
    holoOsc2.frequency.setValueAtTime(102, blastTime); // 2Hz detune creates a pulsing hologram feel
    
    // Slow sweeping rise mimicking the scale up
    holoOsc1.frequency.linearRampToValueAtTime(150, blastTime + 1.5);
    holoOsc2.frequency.linearRampToValueAtTime(153, blastTime + 1.5);

    holoFilter.type = 'lowpass';
    holoFilter.frequency.setValueAtTime(100, blastTime);
    holoFilter.frequency.exponentialRampToValueAtTime(600, blastTime + 1.5);
    holoFilter.frequency.exponentialRampToValueAtTime(100, blastTime + 4.0);

    holoGain.gain.setValueAtTime(0, blastTime);
    holoGain.gain.linearRampToValueAtTime(0.06, blastTime + 1.5); // Very soft!
    holoGain.gain.setTargetAtTime(0.001, blastTime + 1.5, 2.0); // Endless deep decay

    holoOsc1.connect(holoFilter);
    holoOsc2.connect(holoFilter);
    holoFilter.connect(holoGain);
    holoGain.connect(dest);

    holoOsc1.start(blastTime);
    holoOsc2.start(blastTime);
    holoOsc1.stop(blastTime + 5.0);
    holoOsc2.stop(blastTime + 5.0);
    
    trackNodes(holoOsc1, [holoOsc1, holoOsc2, holoFilter, holoGain]);

  }, [trackNodes]);

  const playToffoliKey = useCallback((step) => {
    if (!ctxRef.current || !reverbRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const dest = reverbRef.current;

    if (step === 0 || step === 1) {
      // Short click
      const bufferSize = ctx.sampleRate * 0.02; // 20ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      
      noise.connect(gain);
      gain.connect(dest);
      noise.start(now);
      trackNodes(noise, [noise, gain]);
    } else if (step === 2) {
      // Deeper confirming tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.5);
      trackNodes(osc, [osc, gain]);
    }
  }, [trackNodes]);

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
    playGateSequence,
    toggleMute,
    stopAll,
    playConditionalFire,
    playFizzle,
    playEntanglement,
    playToffoliKey
  }), [initAudio, playGateSequence, toggleMute, stopAll,
    playConditionalFire, playFizzle, playEntanglement, playToffoliKey]);
}
