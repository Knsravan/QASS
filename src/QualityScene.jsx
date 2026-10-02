import React, { Children, cloneElement, useEffect, useSyncExternalStore } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, FXAA } from '@react-three/postprocessing';
import { getQuality, subscribeQuality } from './quality';

/*
 * The scenes' side of the quality levels (quality.js).
 *
 * - QualityCanvas: a <Canvas> whose pixel ratio follows the level and which
 *   keeps to a chosen frame-rate limit. With `background`, it draws only as
 *   often as the level allows (the slow star field doesn't need 60 frames a
 *   second).
 * - QualityComposer: an <EffectComposer> that works the glow out at the
 *   tier's size, adds edge smoothing (FXAA) where there's no multisampling,
 *   leaves the colour fringe to the high level and drops out when glow is off.
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
      // A frame-rate limit (Display & Accessibility) draws on a timer instead
      // of every display frame; the star field always does.
      frameloop={background || q.fpsCap ? 'demand' : props.frameloop}
    >
      {(background || q.fpsCap > 0) && <Ticker fps={background ? q.bgFps : q.fpsCap} />}
      {children}
    </Canvas>
  );
}

// The glow's own passes (finding the bright pixels and blurring them) run at
// the tier's fraction of the screen size. The bloom effect sizes those passes
// in setSize(); scaling the size it is given there shrinks them, and the
// final pass still reads the small glow texture across the whole screen.
function scaleBloom(effect, scale) {
  if (!effect || scale >= 1 || effect._qScale === scale) return;
  const setSize = effect._qSetSize || effect.setSize.bind(effect);
  effect._qSetSize = setSize;
  effect._qScale = scale;
  effect.setSize = (w, h) => setSize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
  const { baseWidth, baseHeight } = effect.resolution || {};
  if (baseWidth > 1 && baseHeight > 1) setSize(Math.max(1, Math.round(baseWidth * scale)), Math.max(1, Math.round(baseHeight * scale)));
}

export function QualityComposer({ children, ...props }) {
  const q = useQuality();
  if (!q.bloom) return null;
  const passes = Children.toArray(children)
    .filter((c) => q.aberration || c.type !== ChromaticAberration)
    .map((c) => (c.type === Bloom
      ? cloneElement(c, { levels: Math.min(c.props.levels ?? 8, q.bloomLevels), ref: (e) => scaleBloom(e, q.bloomScale) })
      : c));
  return (
    <EffectComposer multisampling={q.msaa} {...props} key={q.tier}>
      {passes}
      {q.fxaa && <FXAA />}
    </EffectComposer>
  );
}
