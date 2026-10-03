import React, { Component, Fragment, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { useThree } from '@react-three/fiber';
import { QualityCanvas, useQuality } from './QualityScene';
import { SCENE_GL } from './sceneGl';

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
    slot.current.appendChild(h.el);
    attached = true;
    emit();
    return () => {
      if (h.el.parentNode === slot.current) h.el.remove();
      if (scene?.id === id) scene = null;
      attached = false;
      emit();
    };
  }, [id]);

  // Hand the current scene over after every render (its props change).
  useLayoutEffect(() => {
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
