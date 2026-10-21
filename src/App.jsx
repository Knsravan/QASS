import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Bloom } from '@react-three/postprocessing';
import LandingOrbitalCloud from './LandingOrbitalCloud';
import { startLiquidGlass } from './LiquidGlass';
import { mountLiquidGlass } from './liquid-glass/liquid-glass';
import { mountGlassMotion } from './glassMotion';
import { mountGlassLight } from './glassLight';
import { mountGlassDebug } from './glassDebug';
import { MorphIcon, Atom, Variable, Zap } from './QuantumMorphIcons';
// The app's stylesheets, in cascade order (later files win ties). They all
// load with the landing page, so the simulator's chunk changes none of it.
import './styles/math-chip.css';
import './liquid-glass/liquid-glass.css';
import './styles/base.css';
import './styles/layout-sidebar.css';
import './styles/module-panels.css';
import './styles/landing.css';
import './styles/circuits.css';
import './styles/glass-material.css';
import './styles/controls-accessibility.css';
import './styles/boot.css';
import './styles/display-panel.css';
import './styles/webgl-glass.css';
import './styles/bit-vs-qubit.css';
import './styles/dirac.css';
import './styles/superposition.css';
import { QualityCanvas, QualityComposer, useCount } from './QualityScene';
import { setLandingMode, deviceProfile, motionReduced } from './quality';
import { glassDrawnOn } from './glassGL';
import { startBoot } from './BootLoader';
import QassLogo from './QassLogo';
import MobileBlocker from './MobileBlocker';
import ModuleErrorBoundary from './ModuleErrorBoundary';
import { MODULE_LOADERS } from './moduleLoaders';
import { readStorage, writeStorage } from './storage';

/*
 * The app's root: the landing page, the loading screen and the mobile
 * blocker. The simulator itself (the hub, every module, the course text and
 * KaTeX) is its own chunk (Simulator.jsx), so the landing page doesn't wait
 * for any of it; the loading screen fetches it, with the modules, while it
 * tests the device.
 */
const STAY_KEY = 'quantumUI_smallScreenOk';
const isSmallTouchScreen = () =>
  !!window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600;

const loadSimulator = () => import('./Simulator');
const Simulator = lazy(loadSimulator);
// The simulator and every module's code; a failed download is handled where
// they render (ModuleErrorBoundary).
const preloadSimulator = () => Promise.all([loadSimulator, ...Object.values(MODULE_LOADERS)].map((load) => load().catch(() => null)));
const SIMULATOR_BOUNDS = { position: 'fixed', inset: 0, zIndex: 10 };

// Keeps every floating-layer element in Liquid Glass (see LiquidGlass.js),
// on every screen.
const LiquidGlassEffects = () => {
  useEffect(() => startLiquidGlass(document.body), []);
  // The Liquid Glass skill supplies the sidebar and top bar's look and the
  // magnetic mute button. Its own lens is off: LiquidGlass.js lenses those
  // surfaces (the skill's image-based map doesn't load in Chrome's
  // backdrop-filter). The scroll-lean loop is off: the app never scrolls.
  useEffect(() => mountLiquidGlass({ magnetic: '.lg-magnetic', glide: false, lens: false }), []);
  // Jelly press, drag stretch, reactive rims and the top bar's droplet merge.
  useEffect(() => mountGlassMotion(), []);
  // Shine that follows a phone's tilt.
  useEffect(() => mountGlassLight(), []);
  // ?glassdebug in the address shows the frame rate and lens state.
  useEffect(() => mountGlassDebug(), []);
  return null;
};


// ==========================================
// CINEMATIC LANDING BACKGROUND
// ==========================================
function LandingBackground({ exiting = false }) {
  const starsRef = useRef();
  const cloudRef = useRef();
  const exitStart = useRef(0);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const starCount = useCount(3000);
  // The orbital cloud sits at the right edge of the screen, clear of the
  // headline, copy and cards in the middle: 38% of the visible width (at its
  // depth) from the centre, whatever the window's shape.
  const viewportWidth = useThree((state) => state.viewport.width);
  const cloudX = viewportWidth * 0.38;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, 14 + (motionReduced() ? 0 : Math.sin(t * 0.5) * 1.5), 0.05);
    state.camera.lookAt(0, 0, 0);

    if (starsRef.current) { starsRef.current.rotation.y += 0.0005; starsRef.current.rotation.x += 0.0002; }

    // Leaving: the orbital cloud and its ribbons collapse into their centre
    // while turning; only the stars stay. Once gone, the scene stops drawing
    // so the loading screen's device test has the GPU to itself. It stops
    // only once a frame has drawn no glass: the cards' glass is drawn by this
    // scene, and its last frame stays on screen.
    const cloud = cloudRef.current;
    if (!exiting || !cloud) return;
    if (!exitStart.current) exitStart.current = t;
    const p = Math.min(1, (t - exitStart.current) / 1.1);
    const e = p * p * (3 - 2 * p);
    cloud.scale.setScalar(0.85 * (1 - e));
    cloud.rotation.y += 0.02 * e;
    if (p >= 1) {
      cloud.visible = false;
      if (!glassDrawnOn(state.gl.domElement)) setFrameloop('never');
    }
  });

  return (
    <>
      <QualityComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.4} />
      </QualityComposer>

      <group ref={starsRef}>
        <Stars radius={100} depth={50} count={starCount} factor={4} saturation={1} fade speed={1.5} />
      </group>

      <group ref={cloudRef} position={[cloudX, 0, 0]} scale={0.85}>
        <LandingOrbitalCloud />
      </group>
    </>
  );
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(() => {
    const started = readStorage('quantumUI_initialized') === 'true';
    // The landing page always shows everything at the high tier; set before
    // its scene is made (a canvas's antialiasing is fixed at creation).
    if (!started) setLandingMode(true);
    return started;
  });

  // ==========================================
  // MOBILE DEVICE BLOCKER
  // ==========================================
  // Phones: a touch screen too small for the sidebar and the scene side by side. Not the
  // window's width: zooming a desktop browser in narrows it too, and a low-vision visitor
  // at 200% must still get in. The blocker offers a way past it anyway.
  const [smallScreen, setSmallScreen] = useState(isSmallTouchScreen);
  const [stayAnyway, setStayAnyway] = useState(() => { try { return sessionStorage.getItem(STAY_KEY) === '1'; } catch { return false; } });
  const isMobile = smallScreen && !stayAnyway;
  const continueAnyway = () => {
    setStayAnyway(true);
    try { sessionStorage.setItem(STAY_KEY, '1'); } catch { /* this visit only */ }
  };
  useEffect(() => {
    const handleResize = () => setSmallScreen(isSmallTouchScreen());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Simulator: the landing page vanishes, its badge's mark glides
  // to the loading screen, the device is tested (or its saved result
  // restored), and the simulator is mounted underneath (BootLoader.jsx).
  const [leavingLanding, setLeavingLanding] = useState(false);
  const handleInitialize = () => {
    if (leavingLanding) return;
    setLeavingLanding(true);
    const from = document.querySelector('.hero-badge .qass-logo')?.getBoundingClientRect() || null;
    startBoot({
      from,
      mode: deviceProfile() ? 'restore' : 'full',
      preload: preloadSimulator,
      onSwitch: () => {
        writeStorage('quantumUI_initialized', 'true');
        setHasStarted(true);
      },
    });
  };

  // A returning visitor who skips the landing page but has never had the
  // device test gets the loading screen and the full test first.
  const [booting, setBooting] = useState(() => hasStarted && !isMobile && !deviceProfile());
  const finishBoot = useCallback(() => setBooting(false), []);
  useEffect(() => {
    if (!booting || window.__qassBootStarted) return;
    window.__qassBootStarted = true;
    startBoot({ from: null, mode: 'full', preload: preloadSimulator, onSwitch: finishBoot });
  }, [booting, finishBoot]);

  let screen;
  if (hasStarted && !booting) {
    // The simulator keeps its state while the window is too narrow (it shows the blocker itself).
    // If its code can't be downloaded, say so and offer a reload (the page is otherwise blank).
    screen = (
      <ModuleErrorBoundary moduleTitle="The simulator" boundsStyle={SIMULATOR_BOUNDS} onRetry={() => window.location.reload()}>
        <Suspense fallback={<div className="boot-hold" />}>
          <Simulator isMobile={isMobile} onContinueAnyway={continueAnyway} />
        </Suspense>
      </ModuleErrorBoundary>
    );
  } else if (isMobile) {
    screen = <MobileBlocker onContinue={continueAnyway} />;
  } else if (booting) {
    screen = <div className="boot-hold" />;
  } else {
    // ==========================================
    // GATEWAY: CINEMATIC LANDING PAGE
    // ==========================================
    screen = (
      <div className={`landing-container ${leavingLanding ? 'landing-exit' : ''}`}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
          <QualityCanvas
            gl={{ powerPreference: 'high-performance', alpha: true }}
            camera={{ position: [0, 0, 15], fov: 45 }}
          >
            <LandingBackground exiting={leavingLanding} />
          </QualityCanvas>
        </div>

        <div className="landing-overlay">
          <div className="hero-badge"><QassLogo size={22} intro title="" />QASS · Quantum Algorithm State Simulator</div>
          <h1 className="hero-title">Quantum Reality. <span>Decoded.</span></h1>
          <p className="hero-subtitle">
            Step out of the textbook. Experience the profound mechanics of quantum computing through beautiful, real-time, interactive 3D simulations.
          </p>

          <div className="feature-grid">
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Atom} spring="smooth" strokeWidth={1} size={32} color="#00e5ff" />
              </div>
              <h2>Dual Reality Engine</h2>
              <p>Compare silicon Classical Bits against fluid Quantum Qubits in real-time, side-by-side.</p>
            </div>
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Zap} spring="smooth" strokeWidth={1} size={32} color="#f59e0b" />
              </div>
              <h2>Interactive Physics</h2>
              <p>Manipulate superposition, trigger decoherence noise, and violate the no-cloning theorem yourself.</p>
            </div>
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Variable} spring="smooth" strokeWidth={1} size={32} color="#c084fc" />
              </div>
              <h2>Math Made Visual</h2>
              <p>Watch Dirac notation and probability amplitudes mathematically react as you interact with the hardware.</p>
            </div>
          </div>

          <button className="start-btn lg-magnetic" onClick={handleInitialize}>
            Initialize Simulator
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <LiquidGlassEffects />
      {screen}
    </>
  );
}
