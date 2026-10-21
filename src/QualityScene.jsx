import React, { Children, cloneElement, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { getQuality, subscribeQuality } from './quality';
import { GLASS_FRAGMENT, GLASS_VERTEX, MAX_GLASS, glassHold, fillGlassUniforms, glassEnabled, glassFrame, registerGlassCanvas } from './glassGL';

/*
 * The scenes' side of the quality levels (quality.js).
 *
 * - QualityCanvas: a <Canvas> whose pixel ratio follows the level and which
 *   keeps to a chosen frame-rate limit. With `background`, it draws only as
 *   often as the level allows (the slow star field doesn't need 60 frames a
 *   second).
 * - QualityComposer: a multisampled <EffectComposer> that works the glow out
 *   at the tier's size, leaves the colour fringe to the high level and drops
 *   out when glow is off.
 * - useQuality(): the current tier's settings, re-rendering on a change.
 * - GlassLayer (in every QualityCanvas): draws the liquid glass of the
 *   glass elements sitting on this scene, over the finished frame (glassGL.js).
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

// The drawing-buffer rectangle [x, y, width, height] (y from the bottom) around the glass
// pieces, `reach` CSS px beyond their boxes. The glass changes pixels up to 30 px out (its
// shadow) and reads the frame a little further (the rim's bend): it draws inside
// GLASS_DRAWS and copies GLASS_READS.
const GLASS_DRAWS = 40;
const GLASS_READS = 96;
function glassRegion(pieces, rect, w, h, reach) {
  const s = w / rect.width;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { r } of pieces) {
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  }
  const left = Math.max(0, Math.floor((x0 - rect.left - reach) * s));
  const right = Math.min(w, Math.ceil((x1 - rect.left + reach) * s));
  const bottom = Math.max(0, Math.floor(h - (y1 - rect.top + reach) * s));
  const top = Math.min(h, Math.ceil(h - (y0 - rect.top - reach) * s));
  if (right <= left || top <= bottom) return null;
  return [left, bottom, right - left, top - bottom];
}

// Draws the glass over this canvas's finished frame. Runs after the scene
// (and the glow composer, which renders at priority 1). A priority above 0
// stops the canvas drawing itself, so when nothing else renders, this does.
function GlassLayer() {
  const gl = useThree((s) => s.gl);
  const parts = useMemo(() => {
    const vec4s = () => Array.from({ length: MAX_GLASS }, () => new THREE.Vector4());
    const uniforms = {
      uFrame: { value: null }, uSize: { value: new THREE.Vector2() }, uScale: { value: 1 }, uMorph: { value: 0 },
      uDisperse: { value: 0 }, uLight: { value: new THREE.Vector2(-0.7, 0.7) }, uN: { value: 0 },
      uBox: { value: vec4s() }, uRad: { value: vec4s() }, uA: { value: vec4s() }, uB: { value: vec4s() }, uC: { value: vec4s() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: GLASS_VERTEX, fragmentShader: GLASS_FRAGMENT,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    return { uniforms, material, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), texture: null };
  }, []);

  useEffect(() => {
    const stop = registerGlassCanvas(gl.domElement);
    // Compile the glass shader now, not on its first use (the first glass over this scene,
    // often just as a module starts opening, would otherwise wait for it mid-move).
    gl.compile(parts.scene, parts.camera);
    return () => {
      stop();
      parts.material.dispose();
      parts.scene.children[0].geometry.dispose();
      parts.texture?.dispose();
    };
  }, [gl, parts]);

  useFrame((state) => {
    // Nothing else draws this canvas: draw the scene first.
    if (state.internal.priority <= 1) gl.render(state.scene, state.camera);
    if (glassHold.off) return;
    const frame = glassFrame();
    const pieces = frame?.byCanvas.get(gl.domElement);
    if (!pieces?.length) return;
    const w = gl.domElement.width;
    const h = gl.domElement.height;
    let fresh = false;
    if (!parts.texture || parts.texture.image.width !== w || parts.texture.image.height !== h) {
      parts.texture?.dispose();
      parts.texture = new THREE.FramebufferTexture(w, h);
      parts.texture.minFilter = THREE.LinearFilter;
      parts.texture.magFilter = THREE.LinearFilter;
      fresh = true;
    }
    const u = parts.uniforms;
    const rect = gl.domElement.getBoundingClientRect();
    fillGlassUniforms(u, pieces, rect, w, h, frame.lens);
    u.uLight.value.set(frame.light[0], -frame.light[1]); // the shader's y runs up
    gl.setRenderTarget(null);
    // The glass only reads the frame under and just around itself: copy that region
    // instead of the whole frame (about 19 MB a frame at 2880 x 1620), and draw only
    // inside a smaller one, so no pixel outside the copy is written from the texture.
    // The texture stays full size, so the shader's coordinates are the frame's. (The
    // first copy into a new texture is a full one.)
    const region = !fresh && glassRegion(pieces, rect, w, h, GLASS_READS);
    const draws = region && glassRegion(pieces, rect, w, h, GLASS_DRAWS);
    if (region) {
      const ctx = gl.getContext();
      gl.state.bindTexture(ctx.TEXTURE_2D, gl.properties.get(parts.texture).__webglTexture);
      ctx.copyTexSubImage2D(ctx.TEXTURE_2D, 0, region[0], region[1], region[0], region[1], region[2], region[3]);
      gl.state.unbindTexture();
    } else {
      gl.copyFramebufferToTexture(parts.texture);
    }
    u.uFrame.value = parts.texture;
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    if (draws) {
      const pr = gl.getPixelRatio();
      gl.setScissor(draws[0] / pr, draws[1] / pr, draws[2] / pr, draws[3] / pr);
      gl.setScissorTest(true);
    }
    gl.render(parts.scene, parts.camera);
    if (draws) gl.setScissorTest(false);
    gl.autoClear = autoClear;
  }, 2);
  return null;
}

export function QualityCanvas({ background = false, children, ...props }) {
  const q = useQuality();
  return (
    <Canvas
      {...props}
      className={[props.className, background && 'scene-bg'].filter(Boolean).join(' ') || undefined}
      // The 3D is antialiased at every level (a canvas that asks for none,
      // like the star field, keeps it off).
      gl={{ ...props.gl, antialias: props.gl?.antialias !== false }}
      dpr={q.dpr}
      // The scenes fill a fixed stage that never scrolls, so the canvas needn't
      // be measured again on every scroll in the page (by default it is: each
      // sidebar scroll then re-reads every canvas, and resizes the renderer and
      // its glow buffers whenever the reading differs). The size is taken
      // without CSS transforms, so a module opened mid scale-in animation still
      // gets its full size rather than the scaled-down one.
      resize={{ scroll: false, offsetSize: true, ...props.resize }}
      // A frame-rate limit (Display & Accessibility) draws on a timer instead
      // of every display frame; the star field always does.
      frameloop={background || q.fpsCap ? 'demand' : props.frameloop}
    >
      {(background || q.fpsCap > 0) && <Ticker fps={background ? q.bgFps : q.fpsCap} />}
      {children}
      {glassEnabled(q) && <GlassLayer />}
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

// The caller's own ref on a <Bloom> still gets the effect (QualityComposer sets one too).
const setRef = (ref, value) => {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
};

// @react-three/postprocessing never disposes its composer, and the shared canvas's
// renderer outlives every scene, so each composer's render targets (64 MB at 1440 x 900
// with 4x multisampling) stayed on the GPU after its scene left. This one frees them:
// when the composer is replaced (a new camera or setting) and when it unmounts.
function DisposingComposer(props) {
  const ref = useRef(null);
  const last = useRef(null);
  useEffect(() => {
    if (last.current && last.current !== ref.current) last.current.dispose();
    last.current = ref.current;
  });
  useEffect(() => () => { last.current?.dispose(); last.current = null; }, []);
  return <EffectComposer ref={ref} {...props} />;
}

export function QualityComposer({ children, ...props }) {
  const q = useQuality();
  if (!q.bloom) return null;
  const passes = Children.toArray(children)
    .filter((c) => q.aberration || c.type !== ChromaticAberration)
    .map((c) => (c.type === Bloom
      ? cloneElement(c, { levels: Math.min(c.props.levels ?? 8, q.bloomLevels), ref: (e) => { scaleBloom(e, q.bloomScale); setRef(c.props.ref, e); } })
      : c));
  return (
    <DisposingComposer multisampling={q.msaa} {...props} key={q.tier}>
      {passes}
    </DisposingComposer>
  );
}
