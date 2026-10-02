import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QassLogo from './QassLogo';
import { benchDevice } from './deviceBench';
import { applyDeviceTest, gpuName, qualityInfo, setLandingMode } from './quality';

/*
 * The loading screen between the landing page and the simulator.
 *
 * The QASS mark glides from the landing badge to the middle of the screen and
 * keeps moving while the device is tested for real, one step at a time, with
 * a line under the mark saying what is happening:
 *
 *   graphics card, CPU and memory → browser features and the display →
 *   loading the simulator's code → a drawing test at each quality tier
 *   (deviceBench.js) → the tier chosen → the simulator built underneath.
 *
 * Each step takes as long as its work does (a message stays up just long
 * enough to read). The result is saved for the device (quality.js), so a
 * later visit only restores it. The simulator is mounted underneath while the
 * screen still covers it, and shows once it draws smoothly. The level chosen
 * here stays: it never changes by itself (people can change it in the
 * Display & Accessibility panel).
 *
 * It runs in its own React root, so it survives the switch from the landing
 * page to the simulator.
 */

const READ_MS = 650;   // the shortest time a message stays up
const TIER_NAME = { high: 'High', medium: 'Medium', low: 'Low' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(r));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function bendSupported() {
  const ua = navigator.userAgent;
  return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Mobile Safari/.test(ua.replace(/Chrome.*/, ''));
}

async function refreshRate() {
  const t = [];
  let last = await new Promise((r) => requestAnimationFrame(r));
  for (let i = 0; i < 20; i++) { const now = await new Promise((r) => requestAnimationFrame(r)); t.push(now - last); last = now; }
  t.sort((a, b) => a - b);
  return Math.round(1000 / t[Math.floor(t.length * 0.25)]);
}

// The simulator is ready once its scene is up and frames come steadily.
async function untilSmooth(maxMs = 7000) {
  const start = performance.now();
  while (!document.querySelector('.app-container canvas') && performance.now() - start < maxMs) await frame();
  let steady = 0;
  let last = await frame();
  while (steady < 10 && performance.now() - start < maxMs) {
    const now = await frame();
    steady = now - last < 40 ? steady + 1 : 0;
    last = now;
  }
}

function Loader({ from, mode, preload, onSwitch, onDone }) {
  const [msg, setMsg] = useState({ text: '', detail: '', n: 0 });
  const [progress, setProgress] = useState(0);
  const [cover, setCover] = useState(!from);
  const [leaving, setLeaving] = useState(false);
  const mark = useRef(null);

  // The mark glides from the landing badge to the middle.
  useEffect(() => {
    const el = mark.current;
    if (!el || !from || reduced() || !el.animate) return;
    const box = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (box.left + box.width / 2);
    const dy = from.top + from.height / 2 - (box.top + box.height / 2);
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${from.width / box.width})` },
      { transform: `translate(${dx}px, ${dy}px) scale(${from.width / box.width})`, offset: 0.3 },
      { transform: 'none' },
    ], { duration: 1500, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'backwards' });
  }, [from]);

  useEffect(() => {
    let cancelled = false;
    const say = async (text, detail, work, share) => {
      if (cancelled) return undefined;
      setMsg((m) => ({ text, detail, n: m.n + 1 }));
      const t0 = performance.now();
      const result = await work?.((d) => !cancelled && setMsg((m) => ({ ...m, detail: d })));
      const left = READ_MS - (performance.now() - t0);
      if (left > 0) await wait(left);
      if (!cancelled) setProgress((p) => Math.min(1, p + share));
      return result;
    };

    (async () => {
      await wait(from && !reduced() ? 1500 : 500);
      if (mode === 'full') {
        await say('Detecting your graphics card…', '', async (detail) => {
          const gpu = gpuName();
          const name = gpu.name.replace(/^ANGLE \((.*)\)$/, '$1').replace(/,? (Direct3D|OpenGL|Vulkan|Metal).*$/i, '').slice(0, 60);
          detail(`${name} · ${navigator.hardwareConcurrency || '?'} CPU cores${navigator.deviceMemory ? ` · ${navigator.deviceMemory} GB memory` : ''}`);
        }, 0.12);
        await say('Checking your browser and display…', '', async (detail) => {
          const hz = await refreshRate();
          const gl2 = !!document.createElement('canvas').getContext('webgl2');
          detail(`${gl2 ? 'WebGL 2' : 'No WebGL 2'} · glass lens ${bendSupported() ? 'supported' : 'not in this browser'} · ${screen.width}×${screen.height} at ${window.devicePixelRatio || 1}x · ${hz} Hz`);
        }, 0.12);
        await say('Loading the simulator…', 'The 3D modules and their scenes', () => preload?.(), 0.18);
        const result = await say('Measuring how fast this device draws…', 'Drawing a test scene at High quality', (detail) =>
          benchDevice((tier, ms) => detail(Number.isFinite(ms) ? `${TIER_NAME[tier]} quality: ${ms.toFixed(1)} ms per frame` : `${TIER_NAME[tier]} quality: not supported`)), 0.3);
        await say('Choosing the best look for this device…', `${TIER_NAME[result.tier]} quality`, async () => applyDeviceTest(result.tier, result.why), 0.08);
      } else {
        const info = qualityInfo();
        const level = info.level === 'auto' ? info.deviceTier : info.level;
        const custom = Object.keys(info.parts).length ? ' with your display choices' : '';
        await say('Restoring your setup for this device…', `${TIER_NAME[level]} quality${custom}, from your last visit`, null, 0.4);
        await say('Loading the simulator…', 'The 3D modules and their scenes', () => preload?.(), 0.3);
      }
      if (cancelled) return;
      // Cover the landing page, swap the simulator in underneath, and wait
      // until it draws smoothly.
      setCover(true);
      await wait(400);
      await say('Preparing the simulator…', '', async () => {
        setLandingMode(false);
        onSwitch?.();
        await untilSmooth();
      }, 1);
      if (cancelled) return;
      setLeaving(true);
      await wait(reduced() ? 200 : 900);
      onDone?.();
    })();
    return () => { cancelled = true; };
  }, [from, mode, preload, onSwitch, onDone]);

  return (
    <div className={`boot ${cover ? 'boot--cover' : ''} ${leaving ? 'boot--leaving' : ''}`} role="status" aria-live="polite">
      <div className="boot-bg" aria-hidden="true" />
      <div className="boot-center">
        <div className="boot-mark" ref={mark}><QassLogo size={132} title="QASS is loading" /></div>
        <div className="boot-text">
          <p key={msg.n} className="boot-msg">{msg.text}</p>
          <p className="boot-detail">{msg.detail}</p>
          <div className="boot-bar" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Shows the loading screen.
 * from: the landing badge's mark (DOMRect) to glide from, or null.
 * mode: 'full' (run the device test) or 'restore' (a saved result exists).
 * preload(): loads the simulator's code. onSwitch(): mounts the simulator.
 */
export function startBoot({ from = null, mode = 'full', preload, onSwitch }) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const done = () => { root.unmount(); host.remove(); };
  root.render(<Loader from={from} mode={mode} preload={preload} onSwitch={onSwitch} onDone={done} />);
}
