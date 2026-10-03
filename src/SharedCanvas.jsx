import React, { Component, Fragment, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { useFrame, useThree } from '@react-three/fiber';
import { QualityCanvas, useQuality } from './QualityScene';
import { SCENE_GL } from './sceneGl';
import { glassHold } from './glassGL';

/*
 * One 3D canvas for all the modules.
 *
 * Each module used to mount its own <Canvas>: leaving a module destroyed its
 * WebGL context and opening the next built a new one. Now a single canvas
 * (renderer, context and glass layer) lives in its own React root and is
 * moved into the slot that the active module renders (<SharedCanvas>, a
 * drop-in for <QualityCanvas>). The module's scene is handed to that root
 * through a small store, so it draws in the same renderer and the module
 * itself stays an ordinary component.
 *
 * What a switch still pays: building the new module's scene. What it no
 * longer pays: a new WebGL context, a new renderer and the glass pass.
 */

const listeners = new Set();
let scene = null; // { id, camera, children, fail } of the module on screen
let attached = false;
let host = null;

const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => scene;
const attachedSnapshot = () => attached;

// An error inside the shared scene goes back to the module that owns it, so
// that module's own error boundary shows it (as it did with its own canvas).
class SceneBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { scene?.fail?.(error); }
  componentDidUpdate(prev) { if (prev.id !== this.props.id && this.state.error) this.setState({ error: null }); }
  render() { return this.state.error ? null : this.props.children; }
}

// Puts the camera where the module that just arrived wants it (what
// <Canvas camera={...}> did when each module had its own).
function CameraRig({ camera }) {
  const cam = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const [x, y, z] = camera?.position || [0, 0, 5];
    cam.position.set(x, y, z);
    cam.quaternion.identity();
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    if (cam.isPerspectiveCamera) cam.fov = camera?.fov ?? 75;
    cam.near = camera?.near ?? 0.1;
    cam.far = camera?.far ?? 1000;
    cam.zoom = 1;
    cam.clearViewOffset?.();
    cam.updateProjectionMatrix();
    // Once per module: the camera object is new on every render of the module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam]);
  return null;
}

// Moving between modules: the outgoing scene is copied to a flat picture that
// stays on screen and dissolves (zooming and softening away) while the new
// scene builds behind it, then fades in with a gentle push-in. The canvas
// keeps its last picture and shows a blank frame when resized, so the new
// scene stays hidden until it has drawn a few frames.
const wrapperOf = () => host && host.el.querySelector(':scope > div');

function hideHost() {
  if (!host) return;
  clearTimeout(host.reveal);
  const w = wrapperOf();
  if (w) { w.style.transition = 'none'; w.style.opacity = '0'; w.style.filter = 'blur(10px)'; }
  host.reveal = setTimeout(showHost, 2500); // never stay hidden if frames stall
}
function showHost() {
  if (!host) return;
  clearTimeout(host.reveal);
  const w = wrapperOf();
  if (w) {
    w.style.transition = 'opacity 0.8s ease-out, filter 0.8s ease-out';
    w.style.opacity = '1';
    w.style.filter = 'blur(0px)';
    host.reveal = setTimeout(() => { w.style.transition = ''; w.style.opacity = ''; w.style.filter = ''; }, 900);
  }
  dissolveSnap();
  revealed.forEach((cb) => cb());
}
/** Fades the shared canvas out (the scene leaving before another comes in). */
export function fadeOutSharedCanvas(ms) {
  if (!host) return;
  clearTimeout(host.reveal);
  const w = wrapperOf();
  if (w) { w.style.transition = `opacity ${ms}ms ease-in, filter ${ms}ms ease-in`; w.style.opacity = '0'; w.style.filter = 'blur(8px)'; }
}
export const showSharedCanvas = () => showHost();
/** The next scene to come in arrives without a dissolving picture of the last. */
export function skipNextSnapshot() { if (host) host.skipSnap = true; }
const revealed = new Set();
/** Called whenever a scene has faded in on the shared canvas. */
export function onSharedCanvasRevealed(cb) { revealed.add(cb); return () => revealed.delete(cb); }

function snapEl() {
  if (!host.snap) {
    const c = document.createElement('canvas');
    c.dataset.snap = '';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;display:none;will-change:transform,opacity,filter';
    host.el.appendChild(c);
    host.snap = c;
  }
  return host.snap;
}
// Copies what the canvas is showing (one more frame, drawn now, without glass:
// the glass belongs to DOM that is about to go).
function captureSnap(gl, advance) {
  try {
    const src = gl.domElement;
    if (!src.width || !src.height) return;
    glassHold.off = true;
    advance(performance.now(), true);
    const c = snapEl();
    c.getAnimations().forEach((a) => a.cancel());
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.style.display = 'block';
  } catch (e) {
    /* no picture to dissolve: the new scene just fades in */
  } finally {
    glassHold.off = false;
  }
}
function dissolveSnap() {
  const c = host.snap;
  if (!c || c.style.display === 'none') return;
  const a = c.animate(
    [{ opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }, { opacity: 0, transform: 'scale(1.12)', filter: 'blur(14px)' }],
    { duration: 750, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
  );
  a.onfinish = () => { c.style.display = 'none'; a.cancel(); };
}
// Registers the picture-taker, and runs the reveal for a scene that just mounted.
function Intro() {
  const cam = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  const frames = useRef(0);
  const push = useRef(false);
  useLayoutEffect(() => {
    host.capture = () => captureSnap(gl, advance);
    return () => { host.capture = null; };
  }, [gl, advance]);
  useFrame((_, delta) => {
    if (++frames.current === 4) {
      showHost();
      if (host.snap?.style.display === 'block') { cam.zoom = 0.9; push.current = true; }
    }
    if (push.current) {
      cam.zoom += (1 - cam.zoom) * (1 - Math.exp(-3.4 * Math.min(delta, 0.1)));
      if (1 - cam.zoom < 0.0008) { cam.zoom = 1; push.current = false; }
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

function Stage() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const here = useSyncExternalStore(subscribe, attachedSnapshot, attachedSnapshot);
  const q = useQuality();
  return (
    // Antialiasing is chosen when a canvas is made, so a new level means a new canvas.
    <QualityCanvas key={q.tier} gl={SCENE_GL} camera={{ position: [0, 0, 5], fov: 75 }} frameloop={here && s ? 'always' : 'never'}>
      {s && (
        <SceneBoundary id={s.id}>
          {/* Keyed: a new module's scene must mount fresh, not reuse the last one's. */}
          <Fragment key={s.id}>
            <CameraRig camera={s.camera} />
            <Intro />
            {s.children}
          </Fragment>
        </SceneBoundary>
      )}
    </QualityCanvas>
  );
}

function ensureHost() {
  if (host) return host;
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  host = { el, root: createRoot(el) };
  host.root.render(<Stage />);
  return host;
}

/** Warms the renderer up before a module needs it (kept off screen). */
export function prepareSharedCanvas() {
  ensureHost();
}

/**
 * A drop-in for <QualityCanvas>: the scene given as children is drawn by the
 * shared canvas, which sits where this component is. `style` and `className`
 * apply to the slot, as they did to the canvas's own wrapper.
 */
export function SharedCanvas({ children, camera, style, className }) {
  const id = useId();
  const slot = useRef(null);
  const [failure, setFailure] = useState(null);
  if (failure) throw failure;

  useLayoutEffect(() => {
    const h = ensureHost();
    h.el.style.pointerEvents = '';
    slot.current.appendChild(h.el);
    attached = true;
    emit();
    return () => {
      if (scene?.id === id) {
        if (h.skipSnap) h.skipSnap = false; else h.capture?.();
        scene = null;
      }
      // Park it in the page's stage while the next module loads, so the
      // picture holds instead of the canvas going away.
      if (h.el.parentNode === slot.current) {
        const stage = document.querySelector('.canvas-container');
        if (stage) { h.el.style.pointerEvents = 'none'; stage.prepend(h.el); } else h.el.remove();
      }
      attached = false;
      emit();
    };
  }, [id]);

  // Hand the current scene over after every render (its props change).
  useLayoutEffect(() => {
    if (scene?.id !== id) hideHost();
    scene = { id, camera, children, fail: setFailure };
    emit();
  });

  return (
    <div
      ref={slot}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
      data-shared-canvas=""
    />
  );
}
