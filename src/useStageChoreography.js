import { useState, useEffect } from 'react';
import { MODULE_LOADERS } from './moduleLoaders';
import { MULTI_GATES_STEPS, multiGatesPose } from './MultiQubitGates';
import { fadeOutSharedCanvas, showSharedCanvas, skipNextSnapshot, settleSharedCamera, getSharedCameraPose, onSharedCanvasRevealed } from './SharedCanvas';
import { glideMs } from './handoff';

/**
 * The stage: which module's scene and overlay are on screen, and the
 * choreographed moves between the hub and a module. `activeModuleId` is the
 * module the person opened; the stage follows it, through a move when there is
 * one. Each move is a chain of phases (`stagePhase`), and `jellyState` says
 * when the module's cards pop in or spring out.
 *
 * `isSidebarOpen` and `multiGatesStep` are read when a move starts (where
 * Entanglement's and Multi Qubit Gates' cameras rest).
 */
export function useStageChoreography({ activeModuleId, isSidebarOpen, multiGatesStep }) {
  // What the stage (3D scene and its overlay) shows. It follows the open
  // module, except in the choreographed moves:
  //  - hub -> Dirac Notation: the hub's scene vanishes, Dirac's comes in, its cards pop;
  //  - any module -> hub: the reverse (cards out, scene out, hub scene in, hub pops);
  //  - hub -> Superposition: the shared scene morphs in place, then the cards pop.
  const [stageId, setStageId] = useState(activeModuleId);
  const [stagePhase, setStagePhase] = useState('idle'); // 'vanish' | 'enter' | 'morph' | 'idle'
  const [jellyState, setJellyState] = useState('');     // '' | 'wait' | 'run' | 'out'
  // The orbit target a scene takes over with: the module's, after the pair has zoomed in;
  // the hub's, right after a module closes (it then eases back to the middle).
  const [InterferenceLoaded, setInterferenceLoaded] = useState(null); // Quantum Interference, once its code is in
  const [EntanglementLoaded, setEntanglementLoaded] = useState(null); // Entanglement, once its code is in (same reason)
  const [NoCloningLoaded, setNoCloningLoaded] = useState(null); // No-Cloning, once its code is in
  const [ncFromHub, setNcFromHub] = useState(false); // No-Cloning opens from the hub (its models bounce in after the hub's have gone)
  const [DecoherenceLoaded, setDecoherenceLoaded] = useState(null); // Decoherence, once its code is in
  const [decFromHub, setDecFromHub] = useState(false); // Decoherence opens from the hub's qubit (its qubits arrive in place)
  const [ExponentialLoaded, setExponentialLoaded] = useState(null);   // Exponential State Space, likewise
  const [expFromHub, setExpFromHub] = useState(false); // Exponential State Space opens from the hub's lone qubit (its ring draws on)
  const [interferenceFromHub, setInterferenceFromHub] = useState(false); // Quantum Interference opens from the hub's lone qubit
  const [moduleTarget, setModuleTarget] = useState([0, 0, 0]);
  const [hubTarget, setHubTarget] = useState([0, 0, 0]);
  const [stageSeq, setStageSeq] = useState(0);           // counts the choreographed moves (so a repeat phase restarts its timers)
  // The two modules that open from the hub's lone qubit splitting into a pair (Multi Qubit Gates, Entanglement).
  const [pairModule, setPairModule] = useState('multi-qubit-gates');
  useEffect(() => {
    if (activeModuleId === stageId) return undefined;
    if (stageId === null && (activeModuleId === 'dirac-notation' || activeModuleId === 'superposition')) {
      let done = false;
      setStagePhase('vanish');
      fadeOutSharedCanvas(520);
      const t = setTimeout(() => {
        done = true;
        skipNextSnapshot();
        setJellyState('wait');
        setStagePhase('enter');
        setStageSeq((n) => n + 1);
        setStageId(activeModuleId);
      }, 600);
      return () => { clearTimeout(t); if (!done) { setStagePhase('idle'); showSharedCanvas(); } };
    }
    if (stageId === null && activeModuleId === 'exponential') {
      // Hub -> Exponential State Space: all but the qubit vanishes; it moves to the middle, then
      // zooms to the module's size and place (camera and lights glide to the module's); the module
      // takes over in place, its ring draws on from a point, and then its cards pop.
      let done = false;
      setPairModule('exponential');
      MODULE_LOADERS.exponential().then((mod) => setExponentialLoaded(() => mod.default)).catch(() => {});
      // The zoom starts while the qubit is still on its way to the middle, so the two moves
      // run on as one (stage lengths in glideMs: see handoff.js).
      setStagePhase('multi-center');
      const zoomAt = glideMs(1000);
      const t1 = setTimeout(() => {
        setStagePhase('multi-zoom');
        settleSharedCamera([0, 1.4, 13], [0, 0, 0], glideMs(1700));
      }, zoomAt);
      const t2 = setTimeout(() => {
        done = true;
        setExpFromHub(true);
        setModuleTarget([0, 0, 0]);
        setJellyState('wait');
        setStagePhase('ring');
        setStageSeq((n) => n + 1);
        setStageId(activeModuleId);
      }, zoomAt + glideMs(1800));
      return () => { clearTimeout(t1); clearTimeout(t2); if (!done) setStagePhase('idle'); };
    }
    if (stageId === 'exponential' && activeModuleId === null) {
      // Exponential State Space -> hub: cards out, the ring draws back off to a point, then the
      // qubit (in place) zooms out to the hub's size and the hub's text pops.
      let done = false;
      setPairModule('exponential');
      setStagePhase('closing');
      setJellyState('out');
      setHubTarget(getSharedCameraPose()?.target || [0, 0, 0]);
      // The hand-back waits for the ring to be fully drawn off (and for the cards to be out).
      let ready = false, gone = false;
      const go = () => {
        if (done) return;
        done = true;
        setExpFromHub(false);
        setJellyState('wait');
        setStagePhase('multi-unzoom');
        setStageSeq((n) => n + 1);
        setStageId(null);
      };
      const onGone = () => { gone = true; if (ready) go(); };
      window.addEventListener('qass-ring-gone', onGone);
      const t = setTimeout(() => { ready = true; if (gone) go(); }, 700);
      const tMax = setTimeout(go, 4500); // never hang
      return () => { clearTimeout(t); clearTimeout(tMax); window.removeEventListener('qass-ring-gone', onGone); if (!done) { setStagePhase('idle'); setJellyState(''); } };
    }
    if (stageId === null && (activeModuleId === 'multi-qubit-gates' || activeModuleId === 'entanglement' || activeModuleId === 'decoherence')) {
      // Hub -> Multi Qubit Gates / Entanglement: all but the qubit vanishes; the qubit moves to the
      // middle; it splits in two; the pair then zooms into the module's size and places; the
      // module's scene takes over in place and its cards pop.
      let done = false;
      setPairModule(activeModuleId);
      if (activeModuleId === 'entanglement') MODULE_LOADERS.entanglement().then((mod) => setEntanglementLoaded(() => mod.default)).catch(() => {});
      if (activeModuleId === 'decoherence') MODULE_LOADERS.decoherence().then((mod) => setDecoherenceLoaded(() => mod.default)).catch(() => {});
      // Each stage starts while the one before is still easing out, so the qubit flows from
      // the move into the split and on into the zoom without stopping in between; the
      // hand-over waits until the zoom has landed (stage lengths in glideMs: see handoff.js).
      setStagePhase('multi-center');
      const splitAt = glideMs(900);
      const zoomAt = splitAt + glideMs(1000);
      const t1 = setTimeout(() => setStagePhase('multi-split'), splitAt);
      const pose = activeModuleId === 'entanglement'
        ? { cam: [isSidebarOpen ? 0.6 : 0, 0.2, 14.2], target: [0, 0, 0] } // where the Entanglement scene rests
        : activeModuleId === 'decoherence'
          ? { cam: [0, 2.25, 20], target: [0, 1.65, 0] }                  // and Decoherence's
          : multiGatesPose(MULTI_GATES_STEPS[multiGatesStep]);
      const t1b = setTimeout(() => {
        setStagePhase('multi-zoom');
        // The camera goes to the module's resting view as the pair zooms in, so the
        // models land exactly where the module has them (and its own camera move
        // has nowhere left to go).
        // (Decoherence's hub scene drives its own camera with the pair's glide.)
        if (activeModuleId !== 'decoherence') settleSharedCamera(pose.cam, pose.target, glideMs(1500));
      }, zoomAt);
      const t2 = setTimeout(() => {
        done = true;
        setModuleTarget(pose.target);
        if (activeModuleId === 'decoherence') setDecFromHub(true);
        setJellyState('wait');
        setStagePhase('morph');
        setStageSeq((n) => n + 1);
        setStageId(activeModuleId);
      }, zoomAt + glideMs(1600));
      return () => { clearTimeout(t1); clearTimeout(t1b); clearTimeout(t2); if (!done) setStagePhase('idle'); };
    }
    if ((stageId === 'multi-qubit-gates' || stageId === 'entanglement' || stageId === 'decoherence') && activeModuleId === null) {
      // Multi Qubit Gates / Entanglement -> hub: cards out, the pair takes over in place (camera and
      // all), zooms out and merges into one qubit, which becomes the hub's; then the
      // hub's text pops.
      let done = false;
      setPairModule(stageId);
      setStagePhase('closing');
      setJellyState('out');
      setHubTarget(getSharedCameraPose()?.target || [0, 0, 0]);
      const t = setTimeout(() => {
        done = true;
        setJellyState('wait');
        setStagePhase('multi-unzoom');
        setStageSeq((n) => n + 1);
        setStageId(null);
      }, 700);
      return () => { clearTimeout(t); if (!done) { setStagePhase('idle'); setJellyState(''); } };
    }
    if (stageId === null && activeModuleId === 'interference') {
      // Hub -> Quantum Interference: all but the qubit vanishes (the camera settles, the
      // qubit rests at |0>); then the module's intro plays from exactly that view: the
      // qubit zooms in and the camera strafes right.
      let done = false;
      // Load its code during the vanish and render it directly (not through React.lazy,
      // which would suspend for a tick and drop the canvas), so the hand-over is one commit.
      MODULE_LOADERS.interference().then((mod) => setInterferenceLoaded(() => mod.default)).catch(() => {});
      setStagePhase('solo-center');
      const t = setTimeout(() => {
        done = true;
        setInterferenceFromHub(true);
        setJellyState('wait');
        setStagePhase('morph');
        setStageSeq((n) => n + 1);
        setStageId(activeModuleId);
      }, 900);
      return () => { clearTimeout(t); if (!done) setStagePhase('idle'); };
    }
    if (stageId === 'interference' && activeModuleId === null) {
      // Quantum Interference -> hub: cards out while the camera eases back to the hub's
      // view; the hub's scene takes over with the lone qubit where it is, then the qubit
      // shrinks and slides to its hub place, the bit returns, and the hub's text pops.
      let done = false;
      setStagePhase('closing');
      setJellyState('out');
      settleSharedCamera([0, 0, 13], [0, 0, 0], 1100);
      const t = setTimeout(() => {
        done = true;
        setInterferenceFromHub(false);
        setJellyState('wait');
        setStagePhase('solo-unsolo');
        setStageSeq((n) => n + 1);
        setStageId(null);
      }, 1250);
      return () => { clearTimeout(t); if (!done) { setStagePhase('idle'); setJellyState(''); } };
    }
    if (stageId === null && activeModuleId === 'gates') {
      // Hub -> Classical Gates: the hub's text goes, the two bits grow to the
      // module's size and pose, then the module's scene takes over unseen.
      let done = false;
      setStagePhase('grow');
      const t = setTimeout(() => {
        done = true;
        setJellyState('wait');
        setStagePhase('morph');
        setStageSeq((n) => n + 1);
        setStageId(activeModuleId);
      }, glideMs(1400));
      return () => { clearTimeout(t); if (!done) setStagePhase('idle'); };
    }
    if (stageId === 'gates' && activeModuleId === null) {
      // Classical Gates -> hub: cards spring out, the hub's bits take over at the
      // module's size, shrink to the hub's, and the hub's text pops.
      let done = false;
      setStagePhase('closing');
      setJellyState('out');
      settleSharedCamera([0, 0, 13], [0, 0, 0], 650);
      const t = setTimeout(() => {
        done = true;
        setJellyState('wait');
        setStagePhase('shrink');
        setStageSeq((n) => n + 1);
        setStageId(null);
      }, 700);
      return () => { clearTimeout(t); if (!done) { setStagePhase('idle'); setJellyState(''); } };
    }
    if (stageId === null && activeModuleId === 'nocloning') {
      // Hub -> No-Cloning: the hub's models and text vanish completely first; then the module's
      // scene comes in empty, its models bounce in, and its cards and buttons pop.
      let done = false;
      setStagePhase('vanish');
      fadeOutSharedCanvas(520);
      MODULE_LOADERS.nocloning().then((mod) => setNoCloningLoaded(() => mod.default)).catch(() => {});
      const t = setTimeout(() => {
        done = true;
        skipNextSnapshot();
        setNcFromHub(true);
        setJellyState('wait');
        setStagePhase('bounce');
        setStageSeq((n) => n + 1);
        setStageId(activeModuleId);
      }, 650);
      return () => { clearTimeout(t); if (!done) { setStagePhase('idle'); showSharedCanvas(); } };
    }
    if (stageId === 'nocloning' && activeModuleId === null) {
      // No-Cloning -> hub (the opening in reverse): cards spring out, the models bounce back down
      // and shrink away, and then the hub's scene comes in and its text pops.
      let done = false;
      setStagePhase('closing');
      setJellyState('out');
      const go = () => {
        if (done) return;
        done = true;
        skipNextSnapshot();
        setNcFromHub(false);
        setJellyState('wait');
        setStagePhase('enter');
        setStageSeq((n) => n + 1);
        setStageId(null);
      };
      window.addEventListener('qass-nc-gone', go);
      const tMax = setTimeout(go, 4500); // never hang
      return () => { clearTimeout(tMax); window.removeEventListener('qass-nc-gone', go); if (!done) { setStagePhase('idle'); setJellyState(''); } };
    }
    if (stageId !== null && activeModuleId === null) {
      // Closing, any module: the opening in reverse. Its cards spring out; then
      // either the shared scene morphs back (the bit-and-qubit scene), or the
      // scene fades out and the hub's fades in; then the hub's text pops.
      let done = false;
      const shared = stageId === 'bit-vs-qubit';
      setStagePhase('closing');
      setJellyState('out');
      const t1 = shared ? 0 : setTimeout(() => fadeOutSharedCanvas(450), 550);
      const t2 = setTimeout(() => {
        done = true;
        if (!shared) skipNextSnapshot();
        setJellyState('wait');
        setStagePhase(shared ? 'morph' : 'enter');
        setStageSeq((n) => n + 1);
        setStageId(null);
      }, shared ? 600 : 1050);
      return () => { clearTimeout(t1); clearTimeout(t2); if (!done) { setStagePhase('idle'); setJellyState(''); showSharedCanvas(); } };
    }
    setStagePhase('idle');
    setJellyState('');
    setStageId(activeModuleId);
    return undefined;
    // Runs only when the module changes: the sidebar or step read above is where the move
    // starts from, and re-running on them would cancel the move's timers halfway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModuleId, stageId]);
  useEffect(() => { if (stageId !== 'exponential') setExpFromHub(false); }, [stageId]);
  useEffect(() => { if (stageId !== 'nocloning') setNcFromHub(false); }, [stageId]);
  useEffect(() => { if (stageId !== 'decoherence') setDecFromHub(false); }, [stageId]);
  // Things inside a scene that fade with the cards (Decoherence's particles) listen for these.
  useEffect(() => {
    if (jellyState === 'run') window.dispatchEvent(new Event('qass-jelly-run'));
    else if (jellyState === 'out') window.dispatchEvent(new Event('qass-jelly-out'));
  }, [jellyState]);
  // The pop starts once the new scene is in: after it has faded in, or after the morph.
  useEffect(() => {
    if (stagePhase === 'enter') {
      let t2 = 0;
      const off = onSharedCanvasRevealed(() => { t2 = setTimeout(() => setJellyState('run'), 420); });
      const t3 = setTimeout(() => setJellyState('run'), 4000); // never leave the cards hidden
      return () => { off(); clearTimeout(t2); clearTimeout(t3); };
    }
    if (stagePhase === 'morph') {
      // The module's scene has taken over in place, so its cards can pop almost at once;
      // Quantum Interference's intro move plays first.
      const t = setTimeout(() => setJellyState('run'), stageId === 'interference' ? 1000 : 350);
      return () => clearTimeout(t);
    }
    if (stagePhase === 'bounce') {
      // Cards pop once the models have bounced in (the module starts them when its scene shows).
      let t2 = 0;
      const off = onSharedCanvasRevealed(() => { off(); t2 = setTimeout(() => setJellyState('run'), 1150); });
      const t3 = setTimeout(() => setJellyState('run'), 6000); // never leave the cards hidden
      return () => { off(); clearTimeout(t2); clearTimeout(t3); };
    }
    if (stagePhase === 'ring') {
      // The module's ring draws on first; its cards pop as it closes (it says when).
      const run = () => setJellyState('run');
      window.addEventListener('qass-ring-done', run);
      const t = setTimeout(run, 5000); // never leave the cards hidden
      return () => { clearTimeout(t); window.removeEventListener('qass-ring-done', run); };
    }
    if (stagePhase === 'solo-unsolo') {
      const t = setTimeout(() => setStagePhase('morph'), 250);
      return () => clearTimeout(t);
    }
    if (stagePhase === 'multi-unzoom') {
      const t = setTimeout(() => setStagePhase('multi-unsplit'), 200);
      return () => clearTimeout(t);
    }
    if (stagePhase === 'multi-unsplit') {
      // The zoom-out: the models shrink to the hub's size while the camera eases back.
      // (A lone qubit has no second one to merge in, so it goes straight on to its hub place.)
      const lone = pairModule === 'exponential';
      const dec = pairModule === 'decoherence';
      if (!dec) settleSharedCamera([0, 0, 13], [0, 0, 0], glideMs(lone ? 1100 : 1500));
      const t = setTimeout(() => { setHubTarget([0, 0, 0]); setStagePhase(lone ? 'morph' : 'multi-merge'); }, glideMs(lone ? 1100 : dec ? 1250 : 1500));
      return () => clearTimeout(t);
    }
    if (stagePhase === 'multi-merge') {
      const t = setTimeout(() => setStagePhase('morph'), glideMs(1500));
      return () => clearTimeout(t);
    }
    if (stagePhase === 'shrink') {
      // The hub's bits take over in place (same scene) at the module's size, then shrink.
      const t = setTimeout(() => setStagePhase('morph'), 150);
      return () => clearTimeout(t);
    }
    return undefined;
    // Runs only when the phase changes: pairModule and stageId say which move is playing,
    // and re-running on them would restart its timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagePhase, stageSeq]);
  return {
    stageId, stagePhase, jellyState, InterferenceLoaded, EntanglementLoaded, NoCloningLoaded, ncFromHub, DecoherenceLoaded,
    decFromHub, ExponentialLoaded, expFromHub, interferenceFromHub, moduleTarget, hubTarget, pairModule,
  };
}
