import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Bloom } from '@react-three/postprocessing';
import BlochSphere from './BlochSphere';
import { DiracScene, DiracOverlay } from './DiracNotation';
import { SuperpositionScene, SuperpositionOverlay } from './Superposition';
import { GatesScene, GatesOverlay, GATES_STEPS } from './QuantumGates';
import { MultiGatesScene, MultiGatesOverlay, MULTI_GATES_STEPS } from './MultiQubitGates';
import { isResultEntangled } from './quantumMath';
import CameraShifter from './CameraShifter';
import { SharedCanvas } from './SharedCanvas';
import { useExitPresence } from './useExitPresence';
import LandingOrbitalCloud from './LandingOrbitalCloud';
import GlassNavBar from './GlassNavBar';
import DisplayPanel, { DisplayPanelIcon } from './DisplayPanel';
import SidebarPages from './SidebarPages';
import ModuleErrorBoundary from './ModuleErrorBoundary';
import { startLiquidGlass } from './LiquidGlass';
import { mountLiquidGlass } from './liquid-glass/liquid-glass';
import { mountGlassMotion } from './glassMotion';
import { mountGlassLight } from './glassLight';
import { mountGlassDebug } from './glassDebug';
import { useDiracAudio } from './useDiracAudio';
import { useGatesAudio } from './useGatesAudio';
import { useIdleAudio } from './useIdleAudio';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from './KatexMath';
import {
  QuantumModuleIcon,
  MorphAudioIcon,
  MorphSidebarTabIcon,
  MorphCircuitToggleIcon,
  MorphIcon,
  Atom,
  Variable,
  Zap,
  Compass,
  ArrowRight
} from './QuantumMorphIcons';
import './liquid-glass/liquid-glass.css';
// The app's stylesheets, in cascade order (later files win ties).
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
import { SCENE_GL } from './sceneGl';
import { QualityCanvas, QualityComposer, useCount } from './QualityScene';
import { setLandingMode, deviceProfile } from './quality';
import { glassDrawnOn } from './glassGL';
import { startBoot } from './BootLoader';
import QassLogo from './QassLogo';
import { curriculumData, IDLE_FACTS } from './curriculum';
import { CircuitVisualizer } from './CircuitDiagrams';
import { MODULE_LOADERS } from './moduleLoaders';
import { useStageChoreography } from './useStageChoreography';
import BitVsQubitPanel from './BitVsQubitPanel';
import { bvqLive } from './bitVsQubitLive';

const InterferenceModule = lazy(MODULE_LOADERS.interference);
const EntanglementModule = lazy(MODULE_LOADERS.entanglement);
const ExponentialModule = lazy(MODULE_LOADERS.exponential);
const NoCloningModule = lazy(MODULE_LOADERS.nocloning);
const DecoherenceModule = lazy(MODULE_LOADERS.decoherence);
const QuantumErrorCorrectionModule = lazy(MODULE_LOADERS.errorCorrection);

// Storage can be unavailable (privacy modes, blocked site data); the app must
// still load, it just won't remember that the intro was seen.
const readStorage = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* not persisted */ }
};

// Each module has its own URL (#entanglement, ...) so it can be shared,
// bookmarked and reloaded, and the browser's Back button moves between
// modules instead of leaving the site.
const isModuleId = (id) => curriculumData.some(m => m.id === id);
const moduleFromHash = () => {
  try {
    const id = decodeURIComponent(window.location.hash.slice(1));
    return isModuleId(id) ? id : null;
  } catch {
    return null; // a malformed link (e.g. a stray "%") just opens the hub
  }
};
const readModuleSetting = (key) => {
  const id = readStorage(key);
  return isModuleId(id) ? id : null;
};
const BASE_TITLE = 'QASS · Quantum Algorithm State Simulator';

const LEARNING_MODE_TABS = [
  {
    key: 'beginner',
    label: 'Beginner',
    icon: () => <MorphIcon icon={Compass} spring="smooth" strokeWidth={1.8} size={22} color="currentColor" />,
  },
  {
    key: 'advanced',
    label: 'Advanced',
    icon: () => <MorphIcon icon={Atom} spring="smooth" strokeWidth={1.8} size={22} color="currentColor" />,
  },
];

// ==========================================
// LIQUID GLASS MATERIAL
// Keeps every floating-layer element in Liquid Glass (see LiquidGlass.js).
// ==========================================
// The app's star field. It turns as slowly as OrbitControls' autoRotate at
// 0.3 did, but by elapsed time, so it keeps its pace when the background
// canvas draws fewer frames (QualityCanvas \`background\`).
const BackgroundStars = () => {
  const ref = useRef();
  const count = useCount(2200);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = -state.clock.getElapsedTime() * ((2 * Math.PI) / 60) * 0.3;
  });
  return (
    <group ref={ref}>
      <Stars radius={100} depth={50} count={count} factor={4} saturation={1} fade speed={1.2} />
    </group>
  );
};

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

    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, 14 + Math.sin(t * 0.5) * 1.5, 0.05);
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

// ==========================================
// HELPER: HIGHLIGHT MATRIX COLUMN
// ==========================================
function getHighlightedMatrix(matrixStr, inputIndex, color, isSynced) {
  if (!isSynced || !matrixStr.includes('\\begin{bmatrix}')) return matrixStr;
  
  // Extract everything between \begin{bmatrix} and \end{bmatrix}
  const match = matrixStr.match(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/s);
  if (!match) return matrixStr;
  
  const rows = match[1].split('\\\\').map(row => row.split('&').map(cell => cell.trim()));
  
  const highlightedRows = rows.map(row => {
    return row.map((cell, colIndex) => {
      // Input index corresponds exactly to the column that transforms it!
      if (colIndex === inputIndex && cell !== '0') {
        return `\\textcolor{${color}}{${cell}}`;
      }
      return cell;
    }).join(' & ');
  }).join(' \\\\ ');
  
  return matrixStr.replace(match[1], ` ${highlightedRows} `);
}

// ==========================================
// GATES MODULE VIEW
// ==========================================
// Owns the per-frame gate animation progress so gsap ticks only
// re-render this small subtree instead of the whole App.
const GatesModuleView = ({ step, applied, theme, isSidebarOpen, uiBoundsStyle, onToggleApply, onNext, onPrev }) => {
  const [progress, setProgress] = useState(0);

  return (
    <>
      <SharedCanvas
        sceneId="bit-scene"
        camera={{ position: [0, 0, 13], fov: 45 }}
        gl={SCENE_GL}
        style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
      >
        <CameraShifter isSidebarOpen={isSidebarOpen} />
        <OrbitControls makeDefault enableZoom={true} enablePan={true} />
        <GatesScene step={step} applied={applied} theme={theme} setProgress={setProgress} />
      </SharedCanvas>
      <div style={uiBoundsStyle}>
        <GatesOverlay
          step={step}
          applied={applied}
          theme={theme}
          onToggleApply={onToggleApply}
          onNext={onNext}
          onPrev={onPrev}
          progress={progress}
        />
      </div>
    </>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function App() {
  const [hasStarted, setHasStarted] = useState(() => {
    const started = readStorage('quantumUI_initialized') === 'true';
    // The landing page always shows everything at the high tier; set before
    // its scene is made (a canvas's antialiasing is fixed at creation).
    if (!started) setLandingMode(true);
    return started;
  });

  const [theme] = useState('dark');
  const [learningMode, setLearningMode] = useState(() => readStorage('quantumUI_learningMode') === 'advanced' ? 'advanced' : 'beginner');
  const [activeModuleId, setActiveModuleId] = useState(moduleFromHash); // the hub unless the URL names a module
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [multiGatesStep, setMultiGatesStep] = useState(0);
  const {
    stageId, stagePhase, jellyState, InterferenceLoaded, EntanglementLoaded, NoCloningLoaded, ncFromHub, DecoherenceLoaded,
    decFromHub, ExponentialLoaded, expFromHub, interferenceFromHub, moduleTarget, hubTarget, pairModule,
  } = useStageChoreography({ activeModuleId, isSidebarOpen, multiGatesStep });
  // The hub's text stays mounted while it fades out after a module opens.
  const hubShown = useExitPresence(!stageId, 650);
  const [listFor, setListFor] = useState(null); // the module the sidebar went "back" from
  const openModulePage = useCallback((id) => { setListFor(null); setActiveModuleId(id); }, []);
  const [lastClosedModuleId, setLastClosedModuleId] = useState(() => readModuleSetting('quantumUI_lastModule'));

  // Classical Bit vs Qubit: the bit, the qubit's last measurement (null until
  // measured) and the tally of measurements, shared by its scene and readout.
  const [bvqBit, setBvqBit] = useState(0);
  const [bvqResult, setBvqResult] = useState(null);
  const [bvqCounts, setBvqCounts] = useState({ 0: 0, 1: 0 });
  const flipBvqBit = useCallback(() => setBvqBit((b) => 1 - b), []);
  const measureBvqQubit = useCallback(() => {
    // The odds the qubit's arrow gives right now (Born rule: P(1) = sin²(θ/2)).
    const outcome = Math.random() < bvqLive.p1 ? 1 : 0;
    setBvqResult(outcome);
    setBvqCounts((c) => ({ ...c, [outcome]: c[outcome] + 1 }));
  }, []);
  const newBvqQubit = useCallback(() => setBvqResult(null), []);
  const clickBvqQubit = useCallback(() => {
    if (bvqResult === null) measureBvqQubit(); else newBvqQubit();
  }, [bvqResult, measureBvqQubit, newBvqQubit]);
  useEffect(() => {
    if (stageId === 'bit-vs-qubit') return;
    setBvqBit(0);
    setBvqResult(null);
    setBvqCounts({ 0: 0, 1: 0 });
  }, [stageId]);
  const bvqScene = useMemo(
    () => ({ bit: bvqBit, onBitToggle: flipBvqBit, result: bvqResult, onQubitClick: clickBvqQubit }),
    [bvqBit, flipBvqBit, bvqResult, clickBvqQubit],
  );

  const [qubitCount, setQubitCount] = useState(1);
  const [attemptCopy, setAttemptCopy] = useState(false);
  const [isDecohering, setIsDecohering] = useState(false);
  const [noiseTimer, setNoiseTimer] = useState(0);


  // Dirac Notation module step
  const [diracStep, setDiracStep] = useState(0);

  // ── Dirac audio (Web Audio API) ──
  const diracAudio = useDiracAudio();
  // ── Gates module state ──
  const [gatesStep, setGatesStep] = useState(0);
  const [gateApplied, setGateApplied] = useState(false);

  const [multiGateApplied, setMultiGateApplied] = useState(false);
  const [multiGatesInputs, setMultiGatesInputs] = useState(['0', '0', '0']);
  const gatesAudio = useGatesAudio();

  // ── Global Background & Ambient Audio State ──
  const [isGlobalMuted, setIsGlobalMuted] = useState(() => readStorage('quantumUI_muted') === 'true');
  const idleAudio = useIdleAudio(isGlobalMuted);

  const [idleFactIdx, setIdleFactIdx] = useState(0);
  const [isFactFading, setIsFactFading] = useState(false);

  // ==========================================
  // MOBILE DEVICE BLOCKER
  // ==========================================
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep the URL in step with the open module. Each change is a history
  // entry, so Back returns to the previous module or the hub.
  const urlSyncedRef = useRef(false);
  useEffect(() => {
    const hash = activeModuleId ? `#${activeModuleId}` : '';
    const firstSync = !urlSyncedRef.current;
    urlSyncedRef.current = true;
    if (window.location.hash === hash) return;
    // On load, only tidy an unknown #hash away; don't add a history entry.
    const update = firstSync ? 'replaceState' : 'pushState';
    window.history[update](null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }, [activeModuleId]);
  useEffect(() => {
    const syncFromUrl = () => {
      const id = moduleFromHash();
      // A hand-typed hash that names no module: show the hub and tidy the URL.
      if (!id && window.location.hash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      setActiveModuleId(id);
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);
  useEffect(() => {
    const title = curriculumData.find(m => m.id === activeModuleId)?.title;
    document.title = title ? `${title} · QASS` : BASE_TITLE;
  }, [activeModuleId]);

  // Remember the visitor's choices between visits. "Continue" offers the
  // module they were last in.
  useEffect(() => {
    if (activeModuleId) setLastClosedModuleId(activeModuleId);
  }, [activeModuleId]);
  useEffect(() => { writeStorage('quantumUI_lastModule', lastClosedModuleId || ''); }, [lastClosedModuleId]);
  useEffect(() => { writeStorage('quantumUI_muted', String(isGlobalMuted)); }, [isGlobalMuted]);
  useEffect(() => { writeStorage('quantumUI_learningMode', learningMode); }, [learningMode]);

  // Warm the module chunks once the hub is showing and the browser is idle.
  useEffect(() => {
    if (!hasStarted || isMobile) return;
    const prefetch = () => Object.values(MODULE_LOADERS).forEach((load) => load().catch(() => {}));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000);
    return () => clearTimeout(id);
  }, [hasStarted, isMobile]);

  // Background audio engine for ALL active modules
  const { initAudio: initGatesAudio, toggleMute: toggleGatesMute, stopAll: stopGatesAudio } = gatesAudio;
  useEffect(() => {
    let isCancelled = false;
    if (hasStarted && activeModuleId && !isMobile) {
      initGatesAudio().then(() => {
        if (!isCancelled) {
          toggleGatesMute(isGlobalMuted);
        }
      }).catch(() => {});
    } else {
      stopGatesAudio();
    }
    return () => { isCancelled = true; };
  }, [activeModuleId, isGlobalMuted, hasStarted, isMobile, initGatesAudio, toggleGatesMute, stopGatesAudio]);

  const handleToggleGlobalAudio = () => {
    const nextMuted = !isGlobalMuted;
    setIsGlobalMuted(nextMuted);
    gatesAudio.toggleMute(nextMuted);
    diracAudio.toggleMute(nextMuted);
  };

  const { playAmbient: playIdleAmbient, stopAmbient: stopIdleAmbient } = idleAudio;
  useEffect(() => {
    let interval;
    let fadeTimeout;
    if (hasStarted && !activeModuleId && !isMobile) {
      if (!isGlobalMuted) playIdleAmbient();
      interval = setInterval(() => {
        setIsFactFading(true);
        fadeTimeout = setTimeout(() => {
          setIdleFactIdx((prev) => (prev + 1) % IDLE_FACTS.length);
          setIsFactFading(false);
        }, 600);
      }, 7000);
    } else {
      stopIdleAmbient();
      setIsFactFading(false);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout);
      stopIdleAmbient();
    };
  }, [activeModuleId, hasStarted, isGlobalMuted, isMobile, playIdleAmbient, stopIdleAmbient]);

  // Gates & Multi-Gates Sync State (delays highlight to match 3D stage animation)
  const [showResultSync, setShowResultSync] = useState(false);
  useEffect(() => {
    let timer;
    if (multiGateApplied || gateApplied) {
      timer = setTimeout(() => setShowResultSync(true), 1800);
    } else {
      setShowResultSync(false);
    }
    return () => clearTimeout(timer);
  }, [multiGateApplied, gateApplied]);


  // Circuit Diagram Accordion State
  const [showCircuit, setShowCircuit] = useState(false);

  // Initialize Simulator: the landing page vanishes, its badge's mark glides
  // to the loading screen, the device is tested (or its saved result
  // restored), and the simulator is mounted underneath (BootLoader.jsx).
  const [leavingLanding, setLeavingLanding] = useState(false);
  const preloadModules = useCallback(() => Promise.all(Object.values(MODULE_LOADERS).map((load) => load().catch(() => null))), []);
  const handleInitialize = () => {
    if (leavingLanding) return;
    setLeavingLanding(true);
    const from = document.querySelector('.hero-badge .qass-logo')?.getBoundingClientRect() || null;
    startBoot({
      from,
      mode: deviceProfile() ? 'restore' : 'full',
      preload: preloadModules,
      onSwitch: () => {
        writeStorage('quantumUI_initialized', 'true');
        setHasStarted(true);
      },
    });
  };

  // Display & Accessibility (DisplayPanel.jsx): a page of the sidebar, opened
  // from the button in its header.
  const [displayOpen, setDisplayOpen] = useState(false);
  const closeDisplay = useCallback(() => setDisplayOpen(false), []);
  useEffect(() => { if (!isSidebarOpen) setDisplayOpen(false); }, [isSidebarOpen]);

  // A returning visitor who skips the landing page but has never had the
  // device test gets the loading screen and the full test first.
  const [booting, setBooting] = useState(() => hasStarted && !isMobile && !deviceProfile());
  useEffect(() => {
    if (!booting || window.__qassBootStarted) return;
    window.__qassBootStarted = true;
    startBoot({ from: null, mode: 'full', preload: preloadModules, onSwitch: () => setBooting(false) });
  }, [booting, preloadModules]);

  useEffect(() => {
    setQubitCount(1); setIsDecohering(false); setAttemptCopy(false); setNoiseTimer(0);
    setShowCircuit(false); // Reset to closed when switching modules
  }, [activeModuleId]);

  useEffect(() => {
    let timer;
    if (isDecohering && noiseTimer > 0) timer = setTimeout(() => setNoiseTimer(noiseTimer - 1), 1000);
    else if (noiseTimer === 0) setIsDecohering(false);
    return () => clearTimeout(timer);
  }, [isDecohering, noiseTimer]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    let isCancelled = false;
    // Reset dirac step when leaving dirac module
    if (activeModuleId !== 'dirac-notation') {
      setDiracStep(0);
      diracAudio.stopAll();
    } else {
      // Entering dirac module — init audio graph + preload buffers + play step 0
      diracAudio.initAudio().then(() => {
        if (!isCancelled) {
          diracAudio.toggleMute(isGlobalMuted);
          diracAudio.playStep(0);
        }
      }).catch(() => {});
    }
    // Sidebar: keep open unless superposition module controls it
    
    // Reset gate steps when leaving their respective modules
    if (activeModuleId !== 'gates') {
      setGatesStep(0);
      setGateApplied(false);
    }
    if (activeModuleId !== 'multi-qubit-gates') {
      setMultiGatesStep(0);
      setMultiGateApplied(false);
      setMultiGatesInputs(['0', '0', '0']);
    }
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModuleId]);

  // Fire matching ElevenLabs sound whenever the dirac step changes
  const prevDiracStepRef = useRef(-1);
  useEffect(() => {
    if (activeModuleId !== 'dirac-notation') return;
    if (prevDiracStepRef.current === diracStep) return;
    prevDiracStepRef.current = diracStep;
    diracAudio.initAudio().then(() => {
      diracAudio.toggleMute(isGlobalMuted);
      diracAudio.playStep(diracStep);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diracStep]);

  const triggerNoise = () => { setIsDecohering(true); setNoiseTimer(4); };

  // ==========================================
  // MOBILE DEVICE BLOCKER
  // ==========================================
  if (isMobile) {
    return (
      <div className="mobile-blocker-overlay">
        <LiquidGlassEffects />
        <div className="glass-card mobile-blocker-card">
          <QassLogo size={84} style={{ marginBottom: '20px' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px', color: 'var(--text-primary)' }}>QASS</h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
            This immersive 3D quantum experience requires a larger screen to run properly.
          </p>
          <p style={{ fontSize: '16px', color: '#4facfe', fontWeight: '600' }}>
            Please experience it in a Desktop or Tablet Browser.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // GATEWAY: CINEMATIC LANDING PAGE
  // ==========================================
  if (booting) return <div className="boot-hold" />;

  if (!hasStarted) {
    return (
      <div className={`landing-container ${leavingLanding ? 'landing-exit' : ''}`}>
        <LiquidGlassEffects />
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
              <h4>Dual Reality Engine</h4>
              <p>Compare silicon Classical Bits against fluid Quantum Qubits in real-time, side-by-side.</p>
            </div>
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Zap} spring="smooth" strokeWidth={1} size={32} color="#f59e0b" />
              </div>
              <h4>Interactive Physics</h4>
              <p>Manipulate superposition, trigger decoherence noise, and violate the no-cloning theorem yourself.</p>
            </div>
            <div className="feature-card glass-interactive">
              <div className="feature-icon">
                <MorphIcon icon={Variable} spring="smooth" strokeWidth={1} size={32} color="#c084fc" />
              </div>
              <h4>Math Made Visual</h4>
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

  // ==========================================
  // MAIN SIMULATOR UI
  // ==========================================
  const renderModuleContent = (mod) => {
    if (mod.id === 'gates') {
      const currentGateData = GATES_STEPS[gatesStep];
      const initialInputState = currentGateData.startsAtPlus ? '|+\\rangle' : '|0\\rangle';
      const inputIdx = currentGateData.startsAtPlus ? -1 : 0;

      return (
        <div className="multi-gates-sidebar stagger-enter" style={{ '--gate-accent-color': currentGateData.color }} key={gatesStep}>
          <div className="sidebar-title-wrapper">
            <h3 style={{ marginTop: '-5px', fontSize: '18px', fontWeight: '700' }}>
              {currentGateData.title}
            </h3>
            <div className="title-underline-sweep" />
          </div>

          <div className="data-card">
            <span className="pillar-label">1-Line Definition</span>
            <p className="pillar-text">{currentGateData.definition}</p>
          </div>

          <div className="data-card">
            <span className="pillar-label">Deep Understanding</span>
            <p className="pillar-text">{currentGateData.understanding}</p>
          </div>

          {currentGateData.stateMapping && (
            <div className="data-card">
              <span className="pillar-label">State Mappings</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {currentGateData.stateMapping.map((map, i) => {
                  const isActiveMatch = map.in === initialInputState;
                  let rowClass = "mapping-row";
                  if (showResultSync) {
                    rowClass += isActiveMatch ? " active" : " dimmed";
                  }

                  return (
                    <div key={i} className={rowClass} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: 'var(--gate-accent-color)', fontSize: '14px', width: '160px', flexShrink: 0 }}>
                        <InlineMath math={`${map.in} \\rightarrow ${map.out}`} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {map.note}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="data-card">
            <span className="pillar-label">Classical Comparison</span>
            <p className="pillar-text" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{currentGateData.comparison}"</p>
          </div>

          <div className="data-card">
            <span className="pillar-label">Quantum Unitary Matrix</span>
            <div className="math-box-fluid">
              <BlockMath math={getHighlightedMatrix(
                currentGateData.math,
                inputIdx,
                currentGateData.color,
                showResultSync
              )} />
            </div>
          </div>

          <div className="circuit-diagram-card">
            <div
              className="circuit-header"
              onClick={() => setShowCircuit(!showCircuit)}
            >
              <span className="pillar-label">Circuit Diagram</span>
              <span className={`circuit-toggle-icon ${showCircuit ? 'open' : ''}`}>
                <MorphCircuitToggleIcon isOpen={showCircuit} size={14} color="currentColor" />
              </span>
            </div>

            {showCircuit && (
              <div className="circuit-content">
                <CircuitVisualizer moduleId={mod.id} gateId={currentGateData.id} />
              </div>
            )}
          </div>

          <div className="data-card" style={{ borderLeft: `3px solid var(--gate-accent-color)`, paddingLeft: '12px' }}>
            <span className="pillar-label" style={{ color: 'var(--gate-accent-color)' }}>Why Quantum Needs This</span>
            <p className="pillar-text">{currentGateData.reversibility}</p>
          </div>
        </div>
      );
    } else if (mod.id === 'multi-qubit-gates') {
      return (
        <div className="multi-gates-sidebar stagger-enter" style={{ '--gate-accent-color': MULTI_GATES_STEPS[multiGatesStep].color }} key={multiGatesStep}>
          <div className="sidebar-title-wrapper">
            <h3 style={{ marginTop: '-5px', fontSize: '18px', fontWeight: '700' }}>
              {MULTI_GATES_STEPS[multiGatesStep].title}
            </h3>
            <div className="title-underline-sweep" />
          </div>
          <div className="data-card">
            <span className="pillar-label">1-Line Definition</span>
            <p className="pillar-text">{MULTI_GATES_STEPS[multiGatesStep].definition}</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Deep Understanding</span>
            <p className="pillar-text">{MULTI_GATES_STEPS[multiGatesStep].understanding}</p>
          </div>
          
          {MULTI_GATES_STEPS[multiGatesStep].stateMapping && (
            <div className="data-card">
              <span className="pillar-label">State Mappings</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {MULTI_GATES_STEPS[multiGatesStep].stateMapping.map((map, i) => {
                  const numQubits = MULTI_GATES_STEPS[multiGatesStep].numQubits;
                  const currentInputState = `|${multiGatesInputs.slice(0, numQubits).join('')}\\rangle`;
                  const isActiveMatch = map.in === currentInputState;
                  
                  let rowClass = "mapping-row";
                  if (showResultSync) {
                    rowClass += isActiveMatch ? " active" : " dimmed";
                  }

                  return (
                    <div key={i} className={rowClass} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: 'var(--gate-accent-color)', fontSize: '14px', width: '160px', flexShrink: 0 }}>
                        <InlineMath math={`${map.in} \\rightarrow ${map.out}`} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {map.note}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="data-card">
            <span className="pillar-label">Classical Comparison</span>
            <p className="pillar-text" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{MULTI_GATES_STEPS[multiGatesStep].comparison}"</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Quantum Unitary Matrix</span>
            <div className="math-box-fluid">
              <BlockMath math={(() => {
                const numQubits = MULTI_GATES_STEPS[multiGatesStep].numQubits;
                const _mqInputStr = multiGatesInputs.slice(0, numQubits).join('');
                const inputIdx = _mqInputStr.includes('+') ? -1 : parseInt(_mqInputStr, 2);
                return getHighlightedMatrix(
                  MULTI_GATES_STEPS[multiGatesStep].math, 
                  inputIdx, 
                  MULTI_GATES_STEPS[multiGatesStep].color, 
                  showResultSync
                );
              })()} />
            </div>
          </div>
          <div className="circuit-diagram-card">
            <div
              className="circuit-header"
              onClick={() => setShowCircuit(!showCircuit)}
            >
              <span className="pillar-label">Circuit Diagram</span>
              <span className={`circuit-toggle-icon ${showCircuit ? 'open' : ''}`}>
                <MorphCircuitToggleIcon isOpen={showCircuit} size={14} color="currentColor" />
              </span>
            </div>

            {showCircuit && (
              <div className="circuit-content">
                <CircuitVisualizer moduleId={mod.id} gateId={MULTI_GATES_STEPS[multiGatesStep].id} multiGatesStep={multiGatesStep} />
              </div>
            )}
          </div>
          <div className="data-card" style={{ borderLeft: `3px solid var(--gate-accent-color)`, paddingLeft: '12px' }}>
            <span className="pillar-label" style={{ color: 'var(--gate-accent-color)' }}>Why Quantum Needs This</span>
            <p className="pillar-text">{MULTI_GATES_STEPS[multiGatesStep].reversibility}</p>
          </div>
        </div>
      );
    } else {
      return (
        <>
          <div className="data-card">
            <span className="pillar-label">1-Line Definition</span>
            <p className="pillar-text">{mod.definition}</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Classical Comparison</span>
            <p className="pillar-text" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{mod.comparison}"</p>
          </div>
          <div className="data-card">
            <span className="pillar-label">Mathematical Representation</span>
            <div className="math-box-fluid">
              <BlockMath math={mod.math} />
            </div>
          </div>
          <div className="circuit-diagram-card">
            <div
              className="circuit-header"
              onClick={() => setShowCircuit(!showCircuit)}
            >
              <span className="pillar-label">Circuit Diagram</span>
              <span className={`circuit-toggle-icon ${showCircuit ? 'open' : ''}`}>
                <MorphCircuitToggleIcon isOpen={showCircuit} size={14} color="currentColor" />
              </span>
            </div>
            {showCircuit && (
              <div className="circuit-content">
                <CircuitVisualizer moduleId={mod.id} multiGatesStep={multiGatesStep} qubitCount={qubitCount} />
              </div>
            )}
          </div>
          <div className="data-card" style={{ borderLeft: '3px solid #ef4444', paddingLeft: '12px' }}>
            <span className="pillar-label" style={{ color: '#ef4444' }}>Common Misconception</span>
            <p className="pillar-text">{mod.misconception}</p>
          </div>

          {mod.id === 'decoherence' && (
            <div className="interactive-panel">
              <h4>Thermal Noise Injection</h4>
              <button className={`glass-btn ${isDecohering ? 'danger' : ''}`} onClick={triggerNoise} disabled={isDecohering}>
                {isDecohering ? `⚠️ QUANTUM NOISE ACTIVE (${noiseTimer}s)` : "Apply Noise Pulse"}
              </button>
            </div>
          )}

          {mod.id === 'nocloning' && (
            <div className="interactive-panel">
              <h4>Copy Operation</h4>
              <button className={`glass-btn ${attemptCopy ? 'danger' : ''}`} onClick={() => { setAttemptCopy(true); setTimeout(() => setAttemptCopy(false), 4000); }} disabled={attemptCopy}>
                {attemptCopy ? "ERROR: QUANTUM COLLAPSE TRIGGERED" : "Execute Copy Sequence"}
              </button>
            </div>
          )}
        </>
      );
    }
  };

  // The open module's page shows in the sidebar until "back" (which keeps the
  // module open); opening any module, from anywhere, shows its page again.
  const activeModule = curriculumData.find((m) => m.id === activeModuleId) || null;
  const pageModule = isSidebarOpen ? activeModule : null;
  const modulePage = pageModule && listFor !== pageModule.id ? pageModule : null;

  const currentSidebarWidth = isSidebarOpen ? 420 : 112;
  const uiBoundsStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: `${currentSidebarWidth}px`,
    transition: 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    pointerEvents: 'none',
    zIndex: 10
  };

  return (
    <div className="app-container">
      <LiquidGlassEffects />

      {/* ── Unified Single 3D Universe Background (100vw x 100vh) ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', willChange: 'transform', transform: 'translateZ(0)' }}>
        <QualityCanvas
          background
          gl={{ ...SCENE_GL, antialias: false }}
        >
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <ambientLight intensity={0.4} />
          <pointLight position={[-15, 10, 10]} color="#38bdf8" intensity={2.5} distance={45} />
          <pointLight position={[15, -10, 10]} color="#c084fc" intensity={2.5} distance={45} />
          <BackgroundStars />
        </QualityCanvas>
      </div>

      <main className="main-content">
        {/* ── Sidebar Column ── */}
        <div className="sidebar-wrapper">
          <div className={`sidebar-panel lg-pane ${isSidebarOpen ? '' : 'collapsed'}`}>
            <div className="sidebar-branding">
              <button
                type="button"
                className="sidebar-home"
                onClick={() => { setListFor(null); setDisplayOpen(false); setActiveModuleId(null); }}
                aria-label="QASS home: back to the start"
                title="Back to the start"
              >
                <QassLogo size={34} />
                <div className="sidebar-branding-text">
                  <span className="sidebar-branding-title">QASS</span>
                  <span className="sidebar-branding-tag">Interactive Suite</span>
                </div>
              </button>
              {isSidebarOpen && (
                <button
                  type="button"
                  className={`sidebar-display-btn${displayOpen ? ' is-active' : ''}`}
                  onClick={() => setDisplayOpen((o) => !o)}
                  aria-label="Display & accessibility"
                  aria-expanded={displayOpen}
                  title="Display & accessibility"
                >
                  <DisplayPanelIcon />
                </button>
              )}
            </div>

            <div className="sidebar-body">

            {learningMode === 'beginner' ? (
              <SidebarPages
                pushed={!!modulePage}
                page={pageModule && {
                  mod: pageModule,
                  prev: curriculumData[curriculumData.indexOf(pageModule) - 1],
                  next: curriculumData[curriculumData.indexOf(pageModule) + 1],
                  content: renderModuleContent(pageModule),
                }}
                icon={(mod) => <QuantumModuleIcon moduleId={mod.id} isActive color={mod.accent || '#38bdf8'} size={22} />}
                onBack={() => setListFor(activeModuleId)}
                onGo={openModulePage}
                list={curriculumData.map((mod) => {
                  const isActive = activeModuleId === mod.id;
                  const accent = mod.accent || '#38bdf8';
                  return (
                    <div 
                      key={mod.id} 
                      className={`glass-chip-group ${isActive ? 'active' : ''}`}
                      style={{ '--module-accent': accent }}
                    >
                      <button
                        type="button"
                        className="glass-chip"
                        data-module={mod.id}
                        aria-label={mod.title}
                        aria-pressed={isActive}
                        title={isSidebarOpen ? undefined : mod.title}
                        // Open: the module's page. Collapsed: the icon turns the module on or off.
                        onClick={() => (isSidebarOpen ? openModulePage(mod.id) : setActiveModuleId(isActive ? null : mod.id))}
                      >
                        <div className="chip-indicator" />
                        <div className="chip-content-wrap">
                          <div 
                            className="chip-icon" 
                            style={{ color: isActive ? accent : 'rgba(255, 255, 255, 0.75)' }}
                          >
                            <QuantumModuleIcon
                              moduleId={mod.id}
                              isActive={isActive}
                              color={isActive ? accent : 'rgba(255, 255, 255, 0.75)'}
                              size={isSidebarOpen ? 20 : 22}
                            />
                          </div>
                          {isSidebarOpen && <span className="chip-title">{mod.title}</span>}
                          {isSidebarOpen && <span className="chip-go" aria-hidden="true">›</span>}
                        </div>
                      </button>
                    </div>
                  );
                })}
              />
            ) : (
              <div className="sidebar-scrollable-content">
                <div
                  className="sidebar-badge sidebar-advanced-placeholder"
                  title={isSidebarOpen ? undefined : 'Advanced Sandbox Loading...'}
                >
                  {isSidebarOpen ? 'Advanced Sandbox Loading...' : (
                    <>
                      {/* The collapsed sidebar is too narrow for the text: show the
                          Advanced tab's icon, keeping the words for screen readers. */}
                      <MorphIcon icon={Atom} spring="smooth" strokeWidth={1.8} size={22} color="currentColor" />
                      <span className="visually-hidden">Advanced Sandbox Loading...</span>
                    </>
                  )}
                </div>
              </div>
            )}
            <DisplayPanel open={displayOpen} onClose={closeDisplay} />
            </div>
          </div>

          <button
            className="sidebar-toggle-btn lg-pane"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={isSidebarOpen}
          >
            <MorphSidebarTabIcon isCollapsed={!isSidebarOpen} size={16} color="#ffffff" />
          </button>
        </div>

        {/* ── Right Content & 3D Canvas (flex-grow: 1, naturally centered) ── */}
        <div className="canvas-container" data-jelly-state={jellyState || undefined}>

          {/* Floating chrome sits above every module's overlay layer (those use
              uiBoundsStyle's z-index 10 too, and render later in the DOM). */}
          <div style={{ ...uiBoundsStyle, zIndex: 40 }}>
            {/* Liquid Glass tab bar: learning mode tabs + standalone audio circle */}
            <GlassNavBar
              ariaLabel="Learning mode"
              tabs={LEARNING_MODE_TABS}
              selectedIndex={learningMode === 'advanced' ? 1 : 0}
              onSelect={(index) => setLearningMode(LEARNING_MODE_TABS[index].key)}
              standalone={{
                label: isGlobalMuted ? 'Unmute Audio' : 'Mute Audio',
                active: !isGlobalMuted,
                onClick: handleToggleGlobalAudio,
                icon: <MorphAudioIcon isMuted={isGlobalMuted} size={22} color="currentColor" />,
              }}
            />

            {stageId && stageId !== 'superposition' && stageId !== 'dirac-notation' && stageId !== 'multi-qubit-gates' && stageId !== 'interference' && stageId !== 'entanglement' && stageId !== 'exponential' && stageId !== 'nocloning' && stageId !== 'decoherence' && stageId !== 'error-correction' && (
              <div className="module-appear" style={{ position: 'absolute', top: '80px', left: '50%', width: '0px', display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
                <div className="section-title classical" style={{ position: 'absolute', left: stageId === 'bit-vs-qubit' ? '-33.5vh' : '-39vh', transform: 'translateX(-50%)' }}>
                  <div className="section-title-dot" />
                  <span>{stageId === 'bit-vs-qubit' ? 'CLASSICAL BIT' : 'CLASSICAL PHYSICS'}</span>
                </div>
                <div className="section-title quantum" style={{ position: 'absolute', left: stageId === 'bit-vs-qubit' ? '33.5vh' : '39vh', transform: 'translateX(-50%)' }}>
                  <div className="section-title-dot" />
                  <span>{stageId === 'bit-vs-qubit' ? 'QUBIT' : 'QUANTUM PHYSICS'}</span>
                </div>
              </div>
            )}
          </div>

          <ModuleErrorBoundary
            // The hub and the first module share one scene (the
            // bit and the qubit), so moving between them morphs it in place.
            key={!stageId || stageId === 'bit-vs-qubit' || stageId === 'gates' || stageId === 'multi-qubit-gates' || stageId === 'interference' || stageId === 'entanglement' || stageId === 'exponential' || stageId === 'decoherence' ? 'bit-scene' : stageId}
            moduleTitle={curriculumData.find(m => m.id === stageId)?.title}
            boundsStyle={uiBoundsStyle}
            onRetry={() => window.location.reload()}
            onBackToHub={() => setActiveModuleId(null)}
          >
          <Suspense fallback={null}>
          {stageId === 'gates' ? (
            <GatesModuleView
              step={gatesStep}
              applied={gateApplied}
              theme={theme}
              isSidebarOpen={isSidebarOpen}
              uiBoundsStyle={uiBoundsStyle}
              onToggleApply={() => {
                if (!gateApplied) {
                  setGateApplied(true);
                  gatesAudio.playGateSequence(GATES_STEPS[gatesStep].id, 2.0);
                } else {
                  setGateApplied(false);
                  gatesAudio.playGateSequence('reset');
                }
              }}
              onNext={() => {
                setGatesStep(s => Math.min(s + 1, GATES_STEPS.length - 1));
                setGateApplied(false);
              }}
              onPrev={() => {
                setGatesStep(s => Math.max(s - 1, 0));
                setGateApplied(false);
              }}
            />
          ) : stageId === 'multi-qubit-gates' ? (
            <>
              <SharedCanvas
                sceneId="bit-scene"
                camera={{ position: [0, 0, 15], fov: 45 }}
                gl={SCENE_GL}
                style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
              >
                <CameraShifter isSidebarOpen={isSidebarOpen} />
                <OrbitControls makeDefault enableZoom={true} enablePan={true} target={moduleTarget} />
                <MultiGatesScene
                  step={multiGatesStep}
                  applied={multiGateApplied}
                  theme={theme}
                  inputs={multiGatesInputs}
                />
              </SharedCanvas>
              <div style={uiBoundsStyle}>
                <MultiGatesOverlay
                  step={multiGatesStep}
                  setStep={setMultiGatesStep}
                  applied={multiGateApplied}
                  setApplied={setMultiGateApplied}
                  theme={theme}
                  inputs={multiGatesInputs}
                  setInputs={setMultiGatesInputs}
                  onToggleApply={() => {
                    if (!multiGateApplied) {
                      setMultiGateApplied(true);
                      const stepData = MULTI_GATES_STEPS[multiGatesStep];
                      const gateId = stepData.id;
                      const inputs = multiGatesInputs;
                      const isEntangled = isResultEntangled(gateId, inputs);
                      if (isEntangled) {
                         gatesAudio.playEntanglement();
                      } else if (gateId === 'cnot') {
                         if (inputs[0] === '1') gatesAudio.playConditionalFire();
                         else gatesAudio.playFizzle();
                      } else if (gateId === 'cz') {
                         if (inputs[0] === '1' && inputs[1] === '1') gatesAudio.playConditionalFire();
                         else gatesAudio.playFizzle();
                      } else if (gateId === 'toffoli') {
                         gatesAudio.playToffoliKey(0);
                         setTimeout(() => gatesAudio.playToffoliKey(1), 500);
                         if (inputs[0] === '1' && inputs[1] === '1') {
                           setTimeout(() => gatesAudio.playToffoliKey(2), 1000);
                         } else {
                           setTimeout(() => gatesAudio.playFizzle(), 1000);
                         }
                      } else if (gateId === 'swap') {
                         gatesAudio.playGateSequence('pauli-x');
                      }
                    } else {
                      setMultiGateApplied(false);
                      gatesAudio.playGateSequence('reset');
                    }
                  }}
                  onNext={() => {
                    setMultiGatesStep(s => {
                      const next = Math.min(s + 1, MULTI_GATES_STEPS.length - 1);
                      setMultiGatesInputs(Array(MULTI_GATES_STEPS[next].numQubits).fill('0'));
                      return next;
                    });
                    setMultiGateApplied(false);
                  }}
                  onPrev={() => {
                    setMultiGatesStep(s => {
                      const prev = Math.max(s - 1, 0);
                      setMultiGatesInputs(Array(MULTI_GATES_STEPS[prev].numQubits).fill('0'));
                      return prev;
                    });
                    setMultiGateApplied(false);
                  }}
                />
              </div>
            </>
          ) : stageId === 'superposition' ? (
            <>
              <SharedCanvas
                camera={{ position: [2.8, 1.7, 12.6], fov: 42 }}
                gl={SCENE_GL}
                style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
              >
                <CameraShifter isSidebarOpen={isSidebarOpen} />
                <SuperpositionScene />
              </SharedCanvas>
              <div style={uiBoundsStyle}>
                <SuperpositionOverlay isGlobalMuted={isGlobalMuted} />
              </div>
            </>
          ) : stageId === 'dirac-notation' ? (
            <>
              <SharedCanvas
                camera={{ position: [2.5, 1.2, 9.5], fov: 50 }}
                gl={SCENE_GL}
                style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
              >
                <CameraShifter isSidebarOpen={isSidebarOpen} />
                <DiracScene step={diracStep} theme={theme} />
              </SharedCanvas>
              <div style={uiBoundsStyle}>
                <DiracOverlay
                  step={diracStep}
                  theme={theme}
                  onNext={() => setDiracStep(s => (s + 1) % 4)}
                  onPrev={() => setDiracStep(s => Math.max(s - 1, 0))}
                />
              </div>
            </>
          ) : stageId === 'interference' ? (
            (InterferenceLoaded
              ? <InterferenceLoaded theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={interferenceFromHub} />
              : <InterferenceModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={interferenceFromHub} />)
          ) : stageId === 'entanglement' ? (
            (EntanglementLoaded
              ? <EntanglementLoaded theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />
              : <EntanglementModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />)
          ) : stageId === 'exponential' ? (
            (ExponentialLoaded
              ? <ExponentialLoaded theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={expFromHub} closing={stagePhase === 'closing'} />
              : <ExponentialModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={expFromHub} closing={stagePhase === 'closing'} />)
          ) : stageId === 'nocloning' ? (
            (NoCloningLoaded
              ? <NoCloningLoaded theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={ncFromHub} closing={stagePhase === 'closing'} />
              : <NoCloningModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={ncFromHub} closing={stagePhase === 'closing'} />)
          ) : stageId === 'decoherence' ? (
            (DecoherenceLoaded
              ? <DecoherenceLoaded theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={decFromHub} onNavigateToModule={(moduleId) => setActiveModuleId(moduleId)} />
              : <DecoherenceModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} fromHub={decFromHub} onNavigateToModule={(moduleId) => setActiveModuleId(moduleId)} />)
          ) : stageId === 'error-correction' ? (
            <QuantumErrorCorrectionModule theme={theme} isSidebarOpen={isSidebarOpen} isGlobalMuted={isGlobalMuted} />
          ) : (
            <SharedCanvas
              sceneId="bit-scene"
              camera={{ position: [0, 0, 13], fov: 45 }}
              gl={SCENE_GL}
              style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
            >
              <CameraShifter isSidebarOpen={isSidebarOpen} />
              <BlochSphere
                theme={theme}
                activeModule={stagePhase === 'grow' || stagePhase === 'shrink' ? 'gates' : stagePhase.startsWith('multi-') ? pairModule : stagePhase === 'solo-unsolo' ? 'interference' : stageId}
                multi={stagePhase === 'multi-center' ? 'center' : stagePhase === 'multi-merge' ? 'merge' : stagePhase === 'multi-split' || stagePhase === 'multi-unsplit' ? 'split' : stagePhase === 'multi-zoom' || stagePhase === 'multi-unzoom' ? 'zoom' : null}
                vanishing={stagePhase === 'vanish'}
                handoverTarget={hubTarget}
                centerOnly={stagePhase === 'solo-center'}
                qubitCount={qubitCount}
                isDecohering={isDecohering}
                attemptCopy={attemptCopy}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                isGlobalMuted={isGlobalMuted}
                bvq={bvqScene}
              />
            </SharedCanvas>
          )}
          </Suspense>
          </ModuleErrorBoundary>

          {stageId === 'bit-vs-qubit' && (
            <div style={uiBoundsStyle}>
              <BitVsQubitPanel
                bit={bvqBit}
                onFlip={flipBvqBit}
                result={bvqResult}
                onMeasure={measureBvqQubit}
                onNewQubit={newBvqQubit}
                counts={bvqCounts}
              />
            </div>
          )}

          {hubShown && (
            <div style={uiBoundsStyle} className={`idle-hud ${activeModuleId ? 'idle-hud-leaving' : ''}`}>
              {/* Welcoming Headline + Call-to-Action */}
              <div style={{
                position: 'absolute', top: '130px', left: '0', right: '0',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: 'idleFadeIn 1s ease-out 0.4s both', pointerEvents: 'none',
                zIndex: 100
              }} data-jelly-host>
                <h1 data-jelly style={{ '--j': 0, fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', textShadow: theme === 'light' ? '0 2px 10px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.5)', margin: '0 0 16px 0', fontFamily: "'Deltha', 'Inter', sans-serif", letterSpacing: '0.8px' }}>Where do you want to start today?</h1>
                <div data-jelly style={{ '--j': 1, display: 'flex', alignItems: 'center', gap: '8px', color: '#0ea5e9', fontWeight: 600, fontSize: '16px', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                  <span style={{ animation: 'pulseHint 2s infinite ease-in-out' }}>◀</span>
                  <span>Pick a concept to explore</span>
                </div>
                {/* Contextual Smart Default CTA */}
                <div data-jelly style={{ '--j': 2, marginTop: '24px', pointerEvents: 'auto' }}>
                  <div
                    className="idle-hud-cta glass-interactive"
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveModuleId(lastClosedModuleId || 'bit-vs-qubit')}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                      e.preventDefault();
                      setActiveModuleId(lastClosedModuleId || 'bit-vs-qubit');
                    }}
                  >
                    <MorphIcon icon={Compass} spring="smooth" strokeWidth={1.5} size={16} color="#38bdf8" />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13.5px', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                      {lastClosedModuleId ? `Continue: ${curriculumData.find(m => m.id === lastClosedModuleId)?.title}` : 'New here? Start with Classical Bit vs Qubit'}
                    </span>
                    {lastClosedModuleId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLastClosedModuleId(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 2px 0 6px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        title="Dismiss"
                        aria-label="Dismiss"
                      >×</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Fact Ticker */}
              <div className={`idle-fact-ticker glass-interactive ${isFactFading ? 'fading' : ''}`} data-jelly style={{ '--j': 3, '--tx': '-50%' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.4px', color: 'var(--text-tertiary)', marginBottom: '10px', fontWeight: 800, fontFamily: "'Deltha', 'Inter', sans-serif" }}>Did You Know?</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '16px', minHeight: '42px', fontWeight: 500, fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                  {IDLE_FACTS[idleFactIdx].text}
                </div>
                <button
                  type="button"
                  className="fact-jump-link"
                  onClick={() => setActiveModuleId(IDLE_FACTS[idleFactIdx].moduleId)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#38bdf8', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s ease', fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', 'Inter', sans-serif" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#7dd3fc'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#38bdf8'}
                >
                  <span>Jump to {curriculumData.find(m => m.id === IDLE_FACTS[idleFactIdx].moduleId)?.title.split(' ')[0]}</span>
                  <MorphIcon icon={ArrowRight} spring="smooth" strokeWidth={1} size={14} color="#38bdf8" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );


}

export default App;