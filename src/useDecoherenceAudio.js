import { useEffect, useRef, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, sharedBuffer } from './sharedAudio';

// ==========================================================
// DECOHERENCE & QUANTUM NOISE AUDIO SYNTHESIZER
// Peaceful continuous particle stream + dynamic animation variants
// ==========================================================
export function useDecoherenceAudio(isMuted) {
  const ctxRef                 = useRef(null);
  const masterGainRef          = useRef(null);
  const masterFilterRef        = useRef(null);
  const reverbRef              = useRef(null);
  const activeNodesRef         = useRef([]);
  const particleStreamNodesRef = useRef(null);
  const pinkNoiseBufferRef     = useRef(null);

  const initAudio = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = acquireAudioContext();
      ctxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : 0.75;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 2400;
      masterFilter.connect(masterGain);
      masterFilterRef.current = masterFilter;

      const length = ctx.sampleRate * 3.5;
      const impulse = sharedBuffer('useDecoherenceAudio:impulse', () => {
        const built = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const ch = built.getChannelData(c);
          for (let i = 0; i < length; i++) {
            ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.55));
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

  const stopAll = useCallback(() => {
    if (ctxRef.current) {
      const now = ctxRef.current.currentTime;
      activeNodesRef.current.forEach(node => {
        try {
          if (node.gain) { node.gain.cancelScheduledValues(now); node.gain.setTargetAtTime(0, now, 0.05); }
          else if (node.stop) { node.stop(now + 0.1); }
        } catch (e) {}
      });
      activeNodesRef.current = [];
    }
  }, []);

  // ------------------------------------------------------------
  // CONTINUOUS PEACEFUL PARTICLE AMBIENT STREAM
  // ------------------------------------------------------------
  const startAmbientParticleStream = useCallback(() => {
    if (!ctxRef.current || isMuted || particleStreamNodesRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    // Organic Pink Noise Buffer (Natural continuous airflow) — synthesized
    // once per context and cached, it's ~384k samples of main-thread work
    if (!pinkNoiseBufferRef.current) {
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
      let b0_L = 0, b1_L = 0, b2_L = 0;
      let b0_R = 0, b1_R = 0, b2_R = 0;
      const dataL = noiseBuffer.getChannelData(0);
      const dataR = noiseBuffer.getChannelData(1);
      for (let i = 0; i < bufferSize; i++) {
        const whiteL = Math.random() * 2 - 1;
        b0_L = 0.99886 * b0_L + whiteL * 0.0555179;
        b1_L = 0.99332 * b1_L + whiteL * 0.0750759;
        b2_L = 0.96900 * b2_L + whiteL * 0.1538520;
        dataL[i] = (b0_L + b1_L + b2_L) * 0.35;

        const whiteR = Math.random() * 2 - 1;
        b0_R = 0.99886 * b0_R + whiteR * 0.0555179;
        b1_R = 0.99332 * b1_R + whiteR * 0.0750759;
        b2_R = 0.96900 * b2_R + whiteR * 0.1538520;
        dataR[i] = (b0_R + b1_R + b2_R) * 0.35;
      }
      pinkNoiseBufferRef.current = noiseBuffer;
    }
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = pinkNoiseBufferRef.current;
    noiseNode.loop = true;

    // Modulatable Lowpass Filter (Atmospheric cutoff)
    const filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(520, now);
    filterNode.Q.setValueAtTime(1.8, now);

    // Modulatable Peaking Filter (Resonant quantum flux harmonic)
    const peakFilter = ctx.createBiquadFilter();
    peakFilter.type = 'peaking';
    peakFilter.frequency.setValueAtTime(432, now);
    peakFilter.Q.setValueAtTime(2.4, now);
    peakFilter.gain.setValueAtTime(4.0, now);

    // Modulatable Stereo Panner
    const pannerNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    // Modulatable Master Particle Gain
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(isMuted ? 0 : 0.024, now + 1.2);

    // Sub-Harmonic Sine Drone (Warm soothing anchor)
    const droneOsc = ctx.createOscillator();
    const droneGain = ctx.createGain();
    droneOsc.type = 'sine';
    droneOsc.frequency.setValueAtTime(130.81, now); // C3
    droneGain.gain.setValueAtTime(0, now);
    droneGain.gain.linearRampToValueAtTime(isMuted ? 0 : 0.012, now + 1.2);

    // Connections
    noiseNode.connect(filterNode);
    filterNode.connect(peakFilter);
    peakFilter.connect(gainNode);

    droneOsc.connect(droneGain);
    droneGain.connect(gainNode);

    if (pannerNode) {
      gainNode.connect(pannerNode);
      pannerNode.connect(masterGainRef.current);
      if (reverbRef.current) pannerNode.connect(reverbRef.current);
    } else {
      gainNode.connect(masterGainRef.current);
      if (reverbRef.current) gainNode.connect(reverbRef.current);
    }

    noiseNode.start(now);
    droneOsc.start(now);

    particleStreamNodesRef.current = {
      noiseNode,
      filterNode,
      peakFilter,
      pannerNode,
      gainNode,
      droneOsc,
      droneGain,
    };
  }, [isMuted]);

  // ------------------------------------------------------------
  // DYNAMIC STATE-VARIANT MODULATION
  // ------------------------------------------------------------
  const updateAmbientParticleStream = useCallback(({ noiseLevel, activeNoise, tempK }) => {
    if (!ctxRef.current || isMuted || !particleStreamNodesRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const nodes = particleStreamNodesRef.current;

    const isCold = tempK != null && tempK < 1.0;
    const nl = noiseLevel || 0;

    // Base target parameters based on continuous particle agitation:
    let targetGain = isMuted ? 0 : isCold ? 0.007 : 0.020 + nl * 0.014;
    let targetCutoff = isCold ? 220 : 450 + nl * 650;
    let targetPan = 0;
    let targetDroneFreq = isCold ? 65.4 : 130.81;

    // Step 4 Noise Type Variants (without changing the underlying stream identity):
    if (activeNoise === 'bitflip') {
      // Bit Flip Laser Crossfire Variant
      targetCutoff = 1350;
      targetGain = 0.036;
    } else if (activeNoise === 'phaseflip') {
      // Phase Flip Equatorial Tornado Vortex Variant
      targetCutoff = 1050;
      targetPan = 0.55;
      nodes.peakFilter.frequency.setTargetAtTime(640, now, 0.1);
    } else if (activeNoise === 'damping') {
      // Amplitude Damping Downward Energy Waterfall Variant
      targetCutoff = 360;
      targetDroneFreq = 98.0;
      targetGain = 0.026;
    } else {
      nodes.peakFilter.frequency.setTargetAtTime(432, now, 0.2);
    }

    // Smooth exponential targeting prevents clicks/pops
    nodes.gainNode.gain.setTargetAtTime(targetGain, now, 0.18);
    nodes.filterNode.frequency.setTargetAtTime(targetCutoff, now, 0.18);
    nodes.droneOsc.frequency.setTargetAtTime(targetDroneFreq, now, 0.22);
    if (nodes.pannerNode) {
      nodes.pannerNode.pan.setTargetAtTime(targetPan, now, 0.25);
    }
  }, [isMuted]);

  const stopAmbientParticleStream = useCallback(() => {
    if (particleStreamNodesRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      const nodes = particleStreamNodesRef.current;
      try {
        nodes.gainNode.gain.setTargetAtTime(0, now, 0.3);
        nodes.droneGain.gain.setTargetAtTime(0, now, 0.3);
        setTimeout(() => {
          try {
            nodes.noiseNode.stop();
            nodes.droneOsc.stop();
          } catch (e) {}
        }, 350);
      } catch (e) {}
      particleStreamNodesRef.current = null;
    }
  }, []);

  const playCameraPan = useCallback((duration = 1.8) => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, now);
    osc1.frequency.exponentialRampToValueAtTime(95, now + duration * 0.5);
    osc1.frequency.exponentialRampToValueAtTime(60, now + duration);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.048, now + duration * 0.4);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc1.connect(g1); g1.connect(masterGainRef.current);
    if (reverbRef.current) g1.connect(reverbRef.current);

    const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(196.0, now);
    osc2.frequency.exponentialRampToValueAtTime(246.9, now + duration * 0.5);
    osc2.frequency.exponentialRampToValueAtTime(196.0, now + duration);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.016, now + duration * 0.35);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc2.connect(g2);
    if (reverbRef.current) g2.connect(reverbRef.current); else g2.connect(masterGainRef.current);

    osc1.start(now); osc2.start(now);
    osc1.stop(now + duration + 0.1); osc2.stop(now + duration + 0.1);
    activeNodesRef.current.push(osc1, g1, osc2, g2);
  }, [isMuted]);

  const playButtonClick = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.044, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain); gain.connect(masterGainRef.current);
    if (reverbRef.current) gain.connect(reverbRef.current);
    osc.start(now); osc.stop(now + 0.35);
    activeNodesRef.current.push(osc, gain);
  }, [isMuted]);

  const playBitFlip = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current; const now = ctx.currentTime;
    const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.26);
    g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.036, now + 0.014); g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    osc1.connect(g1); g1.connect(masterGainRef.current); if (reverbRef.current) g1.connect(reverbRef.current);
    osc1.start(now); osc1.stop(now + 0.33);
    const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(440, now + 0.24);
    g2.gain.setValueAtTime(0, now + 0.02); g2.gain.linearRampToValueAtTime(0.018, now + 0.034); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc2.connect(g2); g2.connect(masterGainRef.current); if (reverbRef.current) g2.connect(reverbRef.current);
    osc2.start(now + 0.02); osc2.stop(now + 0.30);
    activeNodesRef.current.push(osc1, g1, osc2, g2);
  }, [isMuted]);

  const playPhaseFlip = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current; const now = ctx.currentTime;
    [440, 445, 330, 333].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.020 - i * 0.004, now + 0.018); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
      osc.connect(gain); gain.connect(masterGainRef.current); if (reverbRef.current) gain.connect(reverbRef.current);
      osc.start(now); osc.stop(now + 0.57);
      activeNodesRef.current.push(osc, gain);
    });
  }, [isMuted]);

  const playAmplitudeDamping = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current; const now = ctx.currentTime;
    const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(330, now); osc1.frequency.exponentialRampToValueAtTime(82.5, now + 0.68);
    g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.038, now + 0.04); g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.74);
    osc1.connect(g1); g1.connect(masterGainRef.current); if (reverbRef.current) g1.connect(reverbRef.current);
    osc1.start(now); osc1.stop(now + 0.80);
    const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(165, now); osc2.frequency.exponentialRampToValueAtTime(41.25, now + 0.68);
    g2.gain.setValueAtTime(0, now); g2.gain.linearRampToValueAtTime(0.016, now + 0.04); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.74);
    osc2.connect(g2); g2.connect(masterGainRef.current); if (reverbRef.current) g2.connect(reverbRef.current);
    osc2.start(now); osc2.stop(now + 0.80);
    activeNodesRef.current.push(osc1, g1, osc2, g2);
  }, [isMuted]);

  const playTemperatureDrop = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;

    // 1. Icy Frost Wind Sweep
    const noiseLen = Math.floor(ctx.sampleRate * 2.5);
    const noiseBuffer = ctx.createBuffer(2, noiseLen, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = noiseBuffer.getChannelData(channel);
      for (let i = 0; i < noiseLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 1.2);
      }
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.Q.setValueAtTime(3.8, now);
    noiseFilter.frequency.setValueAtTime(4200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(320, now + 2.2);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.048, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGainRef.current);
    if (reverbRef.current) noiseGain.connect(reverbRef.current);
    noiseSource.start(now);
    noiseSource.stop(now + 2.5);
    activeNodesRef.current.push(noiseSource, noiseFilter, noiseGain);

    // 2. Ice Crystallization Crackle
    const crackleCount = 14;
    for (let c = 0; c < crackleCount; c++) {
      const crackleTime = now + 0.06 + Math.random() * 1.5;
      const crackleOsc = ctx.createOscillator();
      const crackleGain = ctx.createGain();
      const cracklePan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      crackleOsc.type = 'triangle';
      const cFreq = 2600 + Math.random() * 4400;
      crackleOsc.frequency.setValueAtTime(cFreq, crackleTime);
      crackleOsc.frequency.exponentialRampToValueAtTime(cFreq * 0.65, crackleTime + 0.045);

      crackleGain.gain.setValueAtTime(0, crackleTime);
      crackleGain.gain.linearRampToValueAtTime(0.016 + Math.random() * 0.014, crackleTime + 0.003);
      crackleGain.gain.exponentialRampToValueAtTime(0.0001, crackleTime + 0.065);

      if (cracklePan) {
        cracklePan.pan.setValueAtTime((Math.random() * 2 - 1) * 0.85, crackleTime);
        crackleOsc.connect(crackleGain);
        crackleGain.connect(cracklePan);
        cracklePan.connect(masterGainRef.current);
        if (reverbRef.current) cracklePan.connect(reverbRef.current);
      } else {
        crackleOsc.connect(crackleGain);
        crackleGain.connect(masterGainRef.current);
        if (reverbRef.current) crackleGain.connect(reverbRef.current);
      }

      crackleOsc.start(crackleTime);
      crackleOsc.stop(crackleTime + 0.08);
      activeNodesRef.current.push(crackleOsc, crackleGain);
    }

    // 3. Glacial Sub-Zero Sink
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 2.2);
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.032, now + 0.15);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    subOsc.connect(subGain);
    subGain.connect(masterGainRef.current);
    if (reverbRef.current) subGain.connect(reverbRef.current);
    subOsc.start(now);
    subOsc.stop(now + 2.6);
    activeNodesRef.current.push(subOsc, subGain);

    // 4. Frozen Glass Shimmer
    [2093.0, 3136.0, 4186.0].forEach((freq, idx) => {
      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = 'sine';
      const pingStart = now + 0.12 + idx * 0.10;
      pingOsc.frequency.setValueAtTime(freq, pingStart);
      pingGain.gain.setValueAtTime(0, pingStart);
      pingGain.gain.linearRampToValueAtTime(0.010, pingStart + 0.015);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, pingStart + 1.8);
      pingOsc.connect(pingGain);
      pingGain.connect(masterGainRef.current);
      if (reverbRef.current) pingGain.connect(reverbRef.current);
      pingOsc.start(pingStart);
      pingOsc.stop(pingStart + 1.9);
      activeNodesRef.current.push(pingOsc, pingGain);
    });
  }, [isMuted]);

  const playModuleEntranceBloom = useCallback(() => {
    if (!ctxRef.current || isMuted) return;
    const ctx = ctxRef.current; const now = ctx.currentTime;
    const notes = [
      { freq:  97.999, delay: 0.00, dur: 3.4, gain: 0.040 },
      { freq: 146.832, delay: 0.16, dur: 3.2, gain: 0.033 },
      { freq: 195.998, delay: 0.34, dur: 3.0, gain: 0.027 },
      { freq: 246.942, delay: 0.54, dur: 2.8, gain: 0.022 },
      { freq: 293.665, delay: 0.74, dur: 2.5, gain: 0.017 },
    ];
    notes.forEach(n => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      osc.type = 'sine';
      const st = now + n.delay;
      osc.frequency.setValueAtTime(n.freq, st);
      gain.gain.setValueAtTime(0, st); gain.gain.linearRampToValueAtTime(n.gain, st + 0.30); gain.gain.exponentialRampToValueAtTime(0.0001, st + n.dur);
      if (pan) {
        pan.pan.setValueAtTime(((n.freq % 85) / 85) * 1.1 - 0.55, st);
        osc.connect(gain); gain.connect(pan); pan.connect(masterGainRef.current);
        if (reverbRef.current) pan.connect(reverbRef.current);
      } else {
        osc.connect(gain); gain.connect(masterGainRef.current);
        if (reverbRef.current) gain.connect(reverbRef.current);
      }
      osc.start(st); osc.stop(st + n.dur + 0.1);
      activeNodesRef.current.push(osc, gain);
    });
  }, [isMuted]);

  useEffect(() => {
    return () => {
      stopAll();
      stopAmbientParticleStream();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        releaseAudioOutput(masterGainRef.current);
      }
    };
  }, [stopAll, stopAmbientParticleStream]);

  return useMemo(() => ({
    initAudio, stopAll,
    startAmbientParticleStream, updateAmbientParticleStream, stopAmbientParticleStream,
    playCameraPan,
    playButtonClick, playReset: playButtonClick,
    playBitFlip, playPhaseFlip, playAmplitudeDamping,
    playTemperatureDrop, playModuleEntranceBloom,
  }), [initAudio, stopAll, startAmbientParticleStream, updateAmbientParticleStream,
    stopAmbientParticleStream, playCameraPan, playButtonClick, playBitFlip,
    playPhaseFlip, playAmplitudeDamping, playTemperatureDrop, playModuleEntranceBloom]);
}
