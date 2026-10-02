import React from 'react';
import ReactDOM from 'react-dom/client';
import { gsap } from 'gsap';
import { WebGLRenderer } from 'three';
import './index.css';
import App from './App';
import { startQuality } from './quality';

// Animations must stay truthful to wall-clock time: after a background-tab
// stall, jump state to where it should be rather than replaying it slowly.
gsap.ticker.lagSmoothing(0);

// With checkShaderErrors on, three.js reads compile logs on a program's first
// use, which blocks until the GPU finishes compiling it (hundreds of ms when a
// module's scene first appears). Off, programs compile in parallel via
// KHR_parallel_shader_compile. Every renderer assigns `this.debug` in its
// constructor, so a prototype setter covers all canvases. Development builds
// keep the checks so shader errors are still reported.
if (import.meta.env.PROD) {
  Object.defineProperty(WebGLRenderer.prototype, 'debug', {
    configurable: true,
    get() { return this._qsDebug; },
    set(value) { this._qsDebug = { ...value, checkShaderErrors: false }; },
  });
}

// Sets up this device's quality level (quality.js) before the first scene
// is made.
startQuality();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
