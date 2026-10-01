import { useEffect, useRef, useCallback, useMemo } from 'react';
import { acquireAudioContext, releaseAudioOutput, sharedBuffer } from './sharedAudio';

// ==========================================================
// QUANTUM ERROR CORRECTION AUDIO SYNTHESIZER
// Deep indigo shield-drone, violent noise crack, triumphant restoration chord
// Inspired by useNoCloningAudio.js — same master chain architecture
// ==========================================================
export function useQECAudio(isMuted) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const masterFilterRef = useRef(null);
  const reverbRef = useRef(null);
  const ambientNodesRef = useRef([]);
  const activeNodesRef = useRef([]);

  // ─── Audio Context Init ────────────────────────────────────────────────
  const initAudio = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = acquireAudioContext();
      ctxRef.current = ctx;

      // Master Gain
      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : 0.7;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // Warm lowpass filter — eliminates harsh highs
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 2400;
      masterFilter.connect(masterGain);
      masterFilterRef.current = masterFilter;

      // Lush spatial reverb
      const length = ctx.sampleRate * 3.5;
      const impulse = sharedBuffer('useQECAudio:impulse', () => {
        const built = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const channel = built.getChannelData(c);
          for (let i = 0; i < length; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.52));
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

  // Mute control
  useEffect(() => {
    if (masterGainRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setTargetAtTime(isMuted ? 0 : 0.7, now, 0.12);
    }
  }, [isMuted]);

  // ─── Helper: track an oscillator with its gain so stopAll can fade it ──
  const track = useCallback((osc, gain) => {
    activeNodesRef.current.push({ osc, gain });
    return osc;
  }, []);

  const getOut = useCallback(() => reverbRef.current || masterFilterRef.current, []);

  // ─── AMBIENT DRONE ─────────────────────────────────────────────────────
  // Low indigo shield-hum, steady heartbeat pulse
  const playAmbient = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ambientNodesRef.current.length > 0) return;

    // Deep root drone — B1 (61.7 Hz)
    const droneFreqs = [61.7, 92.5, 123.5]; // B1, F#2, B2
    droneFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320 + i * 80;
      filter.Q.value = 2;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(getOut());
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.045 - i * 0.01, ctx.currentTime + 2.5);
      osc.start();
      ambientNodesRef.current.push({ osc, gain });
    });

    // Heartbeat pulse — 60bpm thud
    let beat = 0;
    const beatInterval = setInterval(() => {
      if (!ctxRef.current || ambientNodesRef.current.length === 0) { clearInterval(beatInterval); return; }
      const c = ctxRef.current;
      const buf = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.exp(-i / (c.sampleRate * 0.035));
        data[i] = (Math.random() * 2 - 1) * env * 0.5;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const bGain = c.createGain();
      const bFilter = c.createBiquadFilter();
      bFilter.type = 'bandpass';
      bFilter.frequency.value = beat % 4 === 0 ? 55 : 70;
      bFilter.Q.value = 1.5;
      src.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(getOut());
      bGain.gain.value = beat % 4 === 0 ? 0.28 : 0.14;
      src.start();
      beat++;
    }, 1000);
    ambientNodesRef.current.push({ interval: beatInterval });
  }, [getOut]);

  const stopAmbient = useCallback(() => {
    const ctx = ctxRef.current;
    ambientNodesRef.current.forEach(n => {
      if (n.osc) {
        try {
          n.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
          n.osc.stop(ctx.currentTime + 1.0);
        } catch(e) {}
      }
      if (n.interval) clearInterval(n.interval);
    });
    ambientNodesRef.current = [];
  }, []);

  // ─── ENCODE BEAM (called 3 times: i=0,1,2) ─────────────────────────────
  // Rising crystalline tone — C4, E4, G4
  const playEncodeBeam = useCallback((i) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const freqs = [261.6, 329.6, 392.0]; // C4, E4, G4
    const freq = freqs[i] || 261.6;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * 2;
    filter.Q.value = 8;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.5, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.45);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(getOut());
    osc.start(now);
    osc.stop(now + 0.75);
    track(osc, gain);
  }, [getOut, track]);

  // ─── NOISE BURST ───────────────────────────────────────────────────────
  // Violent, short, scary — cosmic ray strike
  const playNoiseBurst = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    // Harsh white noise crack
    const bufLen = ctx.sampleRate * 0.18;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.04)) * 1.4;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1800;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterFilterRef.current);
    noiseSrc.start(now);

    // Dissonant impact tone
    const impactFreqs = [233, 247, 220]; // A♯3, B3, A3 — dissonant cluster
    impactFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + i * 0.05);
      osc.connect(g);
      g.connect(getOut());
      osc.start(now);
      osc.stop(now + 0.45);
      track(osc, g);
    });
  }, [getOut, track]);

  // ─── ANCILLA ACTIVATE ──────────────────────────────────────────────────
  // Soft confirming chime — "connecting" feel
  const playAncillaActivate = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = 523.25; // C5 — clean, soft

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.setValueAtTime(freq * 1.5, now + 0.15);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(getOut());
    osc.start(now);
    osc.stop(now + 0.65);
    track(osc, gain);
  }, [getOut, track]);

  // ─── SYNDROME BIT REVEAL ───────────────────────────────────────────────
  // bit=0: low soft ping, bit=1: high alert ping
  const playSyndromeReveal = useCallback((bit) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = bit === 1 ? 880 : 440; // A5 vs A4 — high=error, low=ok

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(bit === 1 ? 0.22 : 0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = bit === 1 ? 1400 : 900;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(getOut());
    osc.start(now);
    osc.stop(now + 0.4);
    track(osc, gain);
  }, [getOut, track]);

  // ─── ERROR LOCATED ─────────────────────────────────────────────────────
  // Tense dissonant chord — the "uh-oh, we found it" moment
  const playErrorLocated = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [220, 261.6, 311.1]; // A3, C4, Eb4 — minor chord = tension
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.05);
      gain.gain.setValueAtTime(0.18, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(gain);
      gain.connect(getOut());
      osc.start(now + i * 0.08);
      osc.stop(now + 1.2);
      track(osc, gain);
    });
  }, [getOut, track]);

  // ─── CORRECTION ARPEGGIO ───────────────────────────────────────────────
  // Rising arpeggio — the X gate firing like a digital pulse
  const playCorrection = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.25]; // C4-E4-G4-C5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = now + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(getOut());
      osc.start(t);
      osc.stop(t + 0.35);
      track(osc, gain);
    });
  }, [getOut, track]);

  // ─── RESTORATION CHORD ─────────────────────────────────────────────────
  // Triumphant Cmaj resolution — full harmonic warmth
  const playRestored = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    // C major chord — C4, E4, G4, C5, E5
    const freqs = [261.6, 329.6, 392.0, 523.25, 659.25];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.06;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22 - i * 0.02, t + 0.1);
      gain.gain.setValueAtTime(0.22 - i * 0.02, t + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
      osc.connect(gain);
      gain.connect(getOut());
      osc.start(t);
      osc.stop(t + 2.4);
      track(osc, gain);
    });

    // Victory shimmer — high bell overtone
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.value = 2093; // C7
    bellGain.gain.setValueAtTime(0, now);
    bellGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    bell.connect(bellGain);
    bellGain.connect(getOut());
    bell.start(now);
    bell.stop(now + 2.0);
    track(bell, bellGain);
  }, [getOut, track]);

  // ─── CAMERA PAN WHOOSH ─────────────────────────────────────────────────
  const playCameraPan = useCallback((duration = 1.5) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.sin((i / data.length) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.15;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 400;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(f);
    f.connect(g);
    g.connect(getOut());
    src.start(now);
  }, [getOut]);

  // ─── STOP ALL ──────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    stopAmbient();
    const ctx = ctxRef.current;
    const now = ctx ? ctx.currentTime : 0;
    activeNodesRef.current.forEach(n => {
      try {
        if (n.gain) {
          n.gain.gain.cancelScheduledValues(now);
          n.gain.gain.setTargetAtTime(0, now, 0.05);
        }
        n.osc.stop(now + 0.3);
      } catch(e) {}
    });
    activeNodesRef.current = [];
  }, [stopAmbient]);

  // Cleanup on unmount
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
    playAmbient,
    stopAmbient,
    playEncodeBeam,
    playNoiseBurst,
    playAncillaActivate,
    playSyndromeReveal,
    playErrorLocated,
    playCorrection,
    playRestored,
    playCameraPan,
    stopAll,
  }), [initAudio, playAmbient, stopAmbient, playEncodeBeam, playNoiseBurst,
    playAncillaActivate, playSyndromeReveal, playErrorLocated, playCorrection,
    playRestored, playCameraPan, stopAll]);
}
