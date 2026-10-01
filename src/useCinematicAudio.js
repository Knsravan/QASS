import { useRef, useEffect, useCallback, useMemo } from 'react';
import { acquireAudioContext } from './sharedAudio';

export default function useCinematicAudio(isMuted) {
  const audioCtx = useRef(null);

  const initAudio = useCallback(() => {
    if (!audioCtx.current) {
      audioCtx.current = acquireAudioContext();
    }
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }
  }, []);

  const playGateFire = useCallback(() => {
    if (isMuted || !audioCtx.current) return;
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }, [isMuted]);

  const stopAll = useCallback(() => {
    // stub for now
  }, []);

  useEffect(() => {
    if (isMuted && audioCtx.current) {
      stopAll();
    }
  }, [isMuted, stopAll]);

  useEffect(() => {
    return () => {
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        // Shared context stays open; this hook's one-shot nodes end on their own.
      }
    };
  }, []);

  return useMemo(() => ({ initAudio, playGateFire, stopAll }),
    [initAudio, playGateFire, stopAll]);
}
