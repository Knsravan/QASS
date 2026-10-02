import React, { Children, useEffect, useSyncExternalStore } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, ChromaticAberration } from '@react-three/postprocessing';
import { getQuality, subscribeQuality } from './quality';

/*
 * The scenes' side of the quality governor (quality.js).
 *
 * - QualityCanvas: a <Canvas> whose pixel ratio follows the tier. With
 *   `background`, it draws only as often as the tier allows (the slow star
 *   field doesn't need 60 frames a second).
 * - QualityComposer: an <EffectComposer> that drops out on the low tier,
 *   leaves the colour fringe to the high tier and uses the tier's
 *   multisampling.
 * - useQuality(): the current tier's settings, re-rendering on a change.
 */

export function useQuality() {
  return useSyncExternalStore(subscribeQuality, getQuality, getQuality);
}

/** A particle count scaled for the tier (never below a tenth). */
export function useCount(count) {
  const q = useQuality();
  return Math.max(Math.round(count * 0.1), Math.round(count * q.stars));
}

// Draws a demand-mode canvas `fps` times a second.
function Ticker({ fps }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const gap = 1000 / fps - 2;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < gap) return;
      last = now;
      invalidate();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);
  return null;
}

export function QualityCanvas({ background = false, children, ...props }) {
  const q = useQuality();
  return (
    <Canvas
      {...props}
      className={[props.className, background && 'scene-bg'].filter(Boolean).join(' ') || undefined}
      // Antialiasing is fixed when the canvas is made: only the high tier
      // pays for it (bloom scenes are drawn through the composer anyway).
      gl={{ ...props.gl, antialias: props.gl?.antialias !== false && q.tier === 'high' }}
      dpr={q.dpr}
      frameloop={background ? 'demand' : props.frameloop}
    >
      {background && <Ticker fps={q.bgFps} />}
      {children}
    </Canvas>
  );
}

export function QualityComposer({ children, ...props }) {
  const q = useQuality();
  if (!q.bloom) return null;
  const passes = Children.toArray(children).filter((c) => q.aberration || c.type !== ChromaticAberration);
  return (
    <EffectComposer multisampling={q.msaa} {...props} key={q.tier}>
      {passes}
    </EffectComposer>
  );
}
