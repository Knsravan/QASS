import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { GlassPill, GlassMaterial, Metal, GrowIn } from './PremiumBitQubit';
import { diracLive } from './diracLive';
import { motionReduced } from './quality';

/*
 * Dirac Notation's 3D scene: the qubit's state space, drawn as what the notation
 * literally says.
 *
 * - Two steel axes at right angles, |0> up and |1> across: the basis kets are
 *   perpendicular (orthogonal), not opposite as on a Bloch sphere.
 * - The ket |ψ> is a metal arrow on a steel unit circle. Its shadows on the two
 *   axes are the amplitudes α and β (glowing bars), and the glass squares built
 *   on them have areas |α|² and |β|²: the odds, which always fill one unit square.
 * - Beside it, the same ket as a column vector: two glass tiles whose liquid
 *   rises to each amplitude, in steel brackets. A dial on a tile shows a complex
 *   amplitude's phase.
 * - For the bra, a copy of the column turns into a row (transpose) and passes
 *   through a glass mirror that reflects its phase dials (complex conjugate), then
 *   meets the ket: ⟨ψ|ψ> = 1.
 *
 * The camera makes one move per step and stops the moment the viewer takes over.
 * Colours: |0> and α cyan, |1> and β purple, as everywhere in the app.
 */

const R = 2.2; // the unit circle's radius in scene units
const C0 = new THREE.Color('#00f2fe');
const C1 = new THREE.Color('#f093fb');
const GREEN = '#43e97b';
const TILE = 0.95;
const PITCH = 1.08; // tile centre to tile centre
const COL_X = R + 2.1; // the column vector, from the state space's centre
const MIRROR_DX = -1.1; // the mirror, from the column
const ROW_FAR = -2.3; // the bra's flight takes it past the mirror...
const ROW_DX = -(TILE / 2 + 0.13) - 0.1 - PITCH / 2 - TILE / 2; // ...then back, snug against the ket's bracket
const DIAG_SHIFT = -1.7; // the state space steps aside (and back) for the bra
const DIAG_SCALE = 0.7;
const DIAG_DROP = -0.35; // and a little down, clear of the title card
const BASE_X = -1.1;

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const damp = (cur, goal, k, dt) => cur + (goal - cur) * (1 - Math.exp(-k * Math.min(dt, 0.1)));
const pct = (p) => `${Math.round(p * 100)}%`;
const _col = new THREE.Color();

function Glow({ color, opacity = 1, matRef }) {
  return <meshBasicMaterial ref={matRef} color={color} transparent opacity={opacity} toneMapped={false} depthWrite={false} />;
}

// ── Camera ──────────────────────────────────────────────────────────────────

const CAM = [
  { pos: [2.2, 1.2, 10.2], target: [1.0, 0.15, 0] }, // |0>: the whole instrument
  { pos: [-1.6, 0.9, 9.9], target: [1.0, 0.1, 0] }, // |1>: from the other side, so the quarter turn reads
  { pos: [1.2, 0.45, 9.6], target: [0.9, 0.0, 0] }, // α, β: square on, so the areas read true
  { pos: [2.2, 0.9, 8.6], target: [1.2, -0.15, 0] }, // the bra: in on the bracket
];
const INTRO = { pos: [-0.5, 2.7, 4.4], target: [-1.1, 1.7, 0] }; // close on the arrow's tip

function CameraRig({ step }) {
  const { camera, controls } = useThree();
  const moving = useRef(true);
  const intro = useRef(true);
  const gp = useMemo(() => new THREE.Vector3(), []);
  const gt = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => { moving.current = true; }, [step]);
  // The viewer's own orbit or zoom ends the move where it is.
  useEffect(() => {
    if (!controls) return undefined;
    const stop = () => { moving.current = false; intro.current = false; };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame((_, dt) => {
    if (!controls || !moving.current) return;
    const g = CAM[step];
    gp.set(...g.pos);
    gt.set(...g.target);
    if (intro.current) {
      intro.current = false;
      if (!motionReduced()) {
        camera.position.set(...INTRO.pos);
        controls.target.set(...INTRO.target);
      }
    }
    if (motionReduced()) {
      camera.position.copy(gp);
      controls.target.copy(gt);
      moving.current = false;
      return;
    }
    const k = 1 - Math.exp(-2.4 * Math.min(dt, 0.1));
    camera.position.lerp(gp, k);
    controls.target.lerp(gt, k);
    if (camera.position.distanceTo(gp) < 0.004 && controls.target.distanceTo(gt) < 0.004) moving.current = false;
  });
  return null;
}

// ── The state space ─────────────────────────────────────────────────────────

function Axis({ along, label, state, active }) {
  const x = along === 'x';
  return (
    <>
      <group rotation={[0, 0, x ? -Math.PI / 2 : 0]}>
        <mesh position={[0, 0.125, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.022, 0.022, 2 * R + 0.55, 16]} />
          <Metal shade="#c8d2e0" />
        </mesh>
        <mesh position={[0, R + 0.5, 0]} raycast={() => null}>
          <coneGeometry args={[0.07, 0.2, 24]} />
          <Metal />
        </mesh>
        {/* where the unit circle crosses the axis: a steel collar */}
        <mesh position={[0, R, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.05, 0.05, 0.08, 20]} />
          <Metal />
        </mesh>
      </group>
      <GlassPill text={label} state={state} active={active} position={x ? [R + 0.95, 0, 0] : [0, R + 0.95, 0]} />
    </>
  );
}

// A glass square on an amplitude's bar: its area is that outcome's odds.
function OddsSquare({ squareRef, color, sign }) {
  const pts = sign > 0
    ? [[-1, 0, 0], [0, 0, 0], [0, 1, 0], [-1, 1, 0], [-1, 0, 0]]
    : [[0, 0, 0], [1, 0, 0], [1, -1, 0], [0, -1, 0], [0, 0, 0]];
  return (
    <group ref={squareRef}>
      <mesh position={sign > 0 ? [-0.5, 0.5, -0.03] : [0.5, -0.5, -0.03]} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.17} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={pts} color={color} lineWidth={1.6} transparent opacity={0.9} />
    </group>
  );
}

function StateSpace({ step, theta, shiftRef, controls }) {
  const a = theta / 2;
  const alpha = Math.cos(a);
  const beta = Math.sin(a);
  const p0 = alpha * alpha;
  const p1 = beta * beta;
  const draggable = step === 2;

  const arrow = useRef();
  const tipMat = useRef();
  const coreMat = useRef();
  const aBar = useRef();
  const bBar = useRef();
  const aSq = useRef();
  const bSq = useRef();
  const vLine = useRef();
  const hLine = useRef();
  const aSqPill = useRef();
  const bSqPill = useRef();
  const aPill = useRef();
  const bPill = useRef();
  const tipPill = useRef();
  const ring = useRef();
  const ringMat = useRef();
  const cur = useRef(a);
  const dragging = useRef(false);

  useFrame((state, dt) => {
    cur.current = dragging.current || motionReduced() ? a : damp(cur.current, a, 5, dt);
    const c = cur.current;
    const ca = Math.cos(c);
    const sb = Math.sin(c);
    const ax = sb * R; // the tip
    const ay = ca * R;
    if (arrow.current) arrow.current.rotation.z = -c;
    _col.copy(C0).lerp(C1, sb * sb);
    if (tipMat.current) tipMat.current.color.copy(_col);
    if (coreMat.current) coreMat.current.color.copy(_col);
    if (aBar.current) { aBar.current.scale.y = Math.max(ay, 1e-3); aBar.current.position.y = ay / 2; aBar.current.visible = ay > 0.01; }
    if (bBar.current) { bBar.current.scale.y = Math.max(ax, 1e-3); bBar.current.position.x = ax / 2; bBar.current.visible = ax > 0.01; }
    if (aSq.current) { aSq.current.scale.set(Math.max(ay, 1e-3), Math.max(ay, 1e-3), 1); aSq.current.visible = ay > 0.01; }
    if (bSq.current) { bSq.current.scale.set(Math.max(ax, 1e-3), Math.max(ax, 1e-3), 1); bSq.current.visible = ax > 0.01; }
    // the shadows' guide lines, from the tip down to |1>'s axis and across to |0>'s
    if (vLine.current) { vLine.current.position.set(ax, ay / 2, 0); vLine.current.scale.y = Math.max(ay, 1e-3); vLine.current.visible = ax > 0.05 && ay > 0.05; }
    if (hLine.current) { hLine.current.position.set(ax / 2, ay, 0); hLine.current.scale.x = Math.max(ax, 1e-3); hLine.current.visible = ax > 0.05 && ay > 0.05; }
    if (aSqPill.current) aSqPill.current.position.set(-ay / 2, ay / 2, 0.05);
    if (bSqPill.current) bSqPill.current.position.set(ax / 2, -ax / 2, 0.05);
    if (aPill.current) aPill.current.position.set(0.32, ay / 2, 0.08);
    if (bPill.current) bPill.current.position.set(ax / 2, 0.3, 0.08);
    if (tipPill.current) tipPill.current.position.set(sb * (R + 0.5), ca * (R + 0.5), 0);
    // the grab ring breathes while the tip can be dragged
    if (ring.current) ring.current.rotation.z = state.clock.getElapsedTime() * 0.8;
    if (ringMat.current) ringMat.current.opacity = draggable ? 0.45 + 0.35 * Math.sin(state.clock.getElapsedTime() * 3) : 0;
  });

  // Dragging the tip around the quarter circle (the α & β step only).
  const plane = useMemo(() => new THREE.Plane(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const n = useMemo(() => new THREE.Vector3(), []);
  const o = useMemo(() => new THREE.Vector3(), []);
  const space = useRef();
  const setControls = (on) => { if (controls) controls.enabled = on; };
  const onOver = () => { if (!draggable) return; setControls(false); document.body.style.cursor = 'grab'; };
  const onOut = () => { if (dragging.current) return; setControls(true); document.body.style.cursor = ''; };
  const onDown = (e) => {
    if (!draggable) return;
    e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    dragging.current = true;
    setControls(false);
    document.body.style.cursor = 'grabbing';
  };
  const onMove = (e) => {
    if (!dragging.current || !space.current) return;
    e.stopPropagation();
    space.current.updateWorldMatrix(true, false);
    n.set(0, 0, 1).transformDirection(space.current.matrixWorld);
    space.current.getWorldPosition(o);
    plane.setFromNormalAndCoplanarPoint(n, o);
    if (!e.ray.intersectPlane(plane, hit)) return;
    space.current.worldToLocal(hit);
    let ang = Math.min(Math.PI / 2, Math.max(0, Math.atan2(hit.x, hit.y)));
    if (Math.abs(ang - Math.PI / 4) < 0.035) ang = Math.PI / 4; // a light detent at |+>
    diracLive.set(2 * ang);
  };
  const onUp = (e) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.target.releasePointerCapture?.(e.pointerId);
    setControls(true);
    document.body.style.cursor = '';
  };
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  const tipText = step === 3 ? '|ψ⟩' : step === 2 ? (Math.abs(theta - Math.PI / 2) < 1e-6 ? '|+⟩' : '|ψ⟩') : null;

  return (
    <group ref={shiftRef}>
      <group ref={space}>
        <Axis along="y" label="|0⟩" state="zero" active={p0 >= 0.5} />
        <Axis along="x" label="|1⟩" state="one" active={p1 >= 0.5} />

        {/* the unit circle: every state's arrow ends on it */}
        <mesh raycast={() => null}>
          <torusGeometry args={[R, 0.03, 16, 160]} />
          <Metal shade="#dfe7f2" />
        </mesh>
        <mesh position={[0, 0, 0.01]} raycast={() => null}>
          <torusGeometry args={[R, 0.009, 8, 160]} />
          <Glow color="#7dd3fc" opacity={0.55} />
        </mesh>
        <mesh position={[0, 0, -0.06]} raycast={() => null}>
          <circleGeometry args={[R, 96]} />
          <meshBasicMaterial color="#9bd8ff" transparent opacity={0.035} depthWrite={false} />
        </mesh>

        {/* the odds: glass squares on the shadows */}
        <OddsSquare squareRef={aSq} color="#00f2fe" sign={1} />
        <OddsSquare squareRef={bSq} color="#f093fb" sign={-1} />

        {/* the amplitudes: the arrow's shadows on the axes */}
        <mesh ref={aBar} position={[0, 0, 0.05]} raycast={() => null}>
          <cylinderGeometry args={[0.055, 0.055, 1, 16]} />
          <Glow color="#00f2fe" />
        </mesh>
        <mesh ref={bBar} position={[0, 0, 0.05]} rotation-z={-Math.PI / 2} raycast={() => null}>
          <cylinderGeometry args={[0.055, 0.055, 1, 16]} />
          <Glow color="#f093fb" />
        </mesh>
        <mesh ref={vLine} raycast={() => null}>
          <boxGeometry args={[0.014, 1, 0.014]} />
          <Glow color="#ffffff" opacity={0.4} />
        </mesh>
        <mesh ref={hLine} raycast={() => null}>
          <boxGeometry args={[1, 0.014, 0.014]} />
          <Glow color="#ffffff" opacity={0.4} />
        </mesh>

        {/* the ket: a steel arrow from the hub to the circle */}
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.13, 32, 16]} />
          <Metal />
        </mesh>
        <group ref={arrow}>
          <mesh position={[0, (R - 0.3) / 2, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.045, 0.045, R - 0.3, 20]} />
            <Metal />
          </mesh>
          <mesh position={[0, (R - 0.3) / 2, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.06, 0.06, R - 0.3, 20]} />
            <Glow color="#00f2fe" opacity={0.18} matRef={coreMat} />
          </mesh>
          <mesh position={[0, R - 0.15, 0]} raycast={() => null}>
            <coneGeometry args={[0.12, 0.3, 32]} />
            <Glow color="#00f2fe" matRef={tipMat} />
          </mesh>
          <mesh ref={ring} position={[0, R - 0.1, 0]} raycast={() => null}>
            <torusGeometry args={[0.26, 0.014, 8, 48, Math.PI * 1.5]} />
            <Glow color="#ffffff" opacity={0} matRef={ringMat} />
          </mesh>
          {/* the tip's grab handle: invisible, generous */}
          <mesh
            position={[0, R - 0.1, 0]}
            onPointerOver={onOver}
            onPointerOut={onOut}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <sphereGeometry args={[0.38, 16, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>

        {/* names and numbers, on glass */}
        {tipText && <group ref={tipPill}><GlassPill text={tipText} state={p1 > p0 ? 'one' : 'zero'} active /></group>}
        {p0 >= 0.06 && <group ref={aSqPill}><GlassPill text={`|α|² ${pct(p0)}`} state="zero" /></group>}
        {p1 >= 0.06 && <group ref={bSqPill}><GlassPill text={`|β|² ${pct(p1)}`} state="one" /></group>}
        {alpha >= 0.12 && <group ref={aPill}><GlassPill text="α" state="zero" round active /></group>}
        {beta >= 0.12 && <group ref={bPill}><GlassPill text="β" state="one" round active /></group>}

        {/* |1>: a quarter turn from |0>, not a half — the two share nothing */}
        {step === 1 && (
          <GrowIn>
            <mesh position={[0, (R - 0.3) / 2, -0.02]} raycast={() => null}>
              <cylinderGeometry args={[0.04, 0.04, R - 0.3, 16]} />
              <Glow color="#00f2fe" opacity={0.22} />
            </mesh>
            <Line points={[[0, 0.42, 0.06], [0.42, 0.42, 0.06], [0.42, 0, 0.06]]} color="#ffffff" lineWidth={2} transparent opacity={0.85} />
            <GlassPill text="90°" state="zero" position={[0.82, 0.82, 0.05]} />
          </GrowIn>
        )}
        {step === 2 && (
          <GlassPill text="|α|² + |β|² = 1" state="zero" active position={[0, -R - 0.62, 0]} label="The two squares always add up to one" />
        )}
        {draggable && <GlassPill text="Drag the tip" state="one" position={[R * 0.85 + 0.55, R * 0.85 + 0.55, 0]} />}
      </group>
    </group>
  );
}

// ── The column vector ───────────────────────────────────────────────────────

function PhaseDial({ phase, color, dialRef }) {
  return (
    <group position={[0, -0.22, 0.15]}>
      <group ref={dialRef}>
        <mesh raycast={() => null}>
          <torusGeometry args={[0.15, 0.016, 10, 48]} />
          <Metal />
        </mesh>
        <mesh raycast={() => null}>
          <circleGeometry args={[0.15, 40]} />
          <meshBasicMaterial color="#05070d" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        {/* where phase 0 (a real, positive amplitude) points */}
        <mesh position={[0.15, 0, 0]} raycast={() => null}>
          <sphereGeometry args={[0.03, 12, 8]} />
          <Metal />
        </mesh>
        <group rotation-z={phase}>
          <mesh position={[0.065, 0, 0.01]} raycast={() => null}>
            <boxGeometry args={[0.13, 0.032, 0.03]} />
            <Glow color={color} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Tile({ y = 0, amp, color, state, text, phase = 0, dialRef }) {
  const fill = useRef();
  const f = useRef(amp);
  const H = TILE - 0.16;
  const hasDial = phase !== 0 || !!dialRef;
  useFrame((_, dt) => {
    f.current = motionReduced() ? amp : damp(f.current, amp, 4, dt);
    const h = Math.max(f.current, 0.001) * H;
    if (fill.current) { fill.current.scale.y = h; fill.current.position.y = -H / 2 + h / 2; }
  });
  return (
    <group position={[0, y, 0]}>
      <RoundedBox args={[TILE, TILE, 0.24]} radius={0.09} smoothness={4} raycast={() => null}>
        <GlassMaterial />
      </RoundedBox>
      <mesh ref={fill} raycast={() => null}>
        <boxGeometry args={[H, 1, 0.12]} />
        <Glow color={color} opacity={0.5} />
      </mesh>
      <GlassPill text={text} state={state} active position={[0, hasDial ? 0.17 : 0.03, 0.16]} />
      {hasDial && <PhaseDial phase={phase} color={color} dialRef={dialRef} />}
    </group>
  );
}

function Brackets() {
  const h = 2 * PITCH + 0.06;
  const w = TILE / 2 + 0.13;
  return [-1, 1].map((s) => (
    <group key={s} position={[s * w, 0, 0]}>
      <mesh raycast={() => null}>
        <cylinderGeometry args={[0.024, 0.024, h, 12]} />
        <Metal />
      </mesh>
      {[1, -1].map((v) => (
        <mesh key={v} position={[-s * 0.07, (v * h) / 2, 0]} rotation-z={Math.PI / 2} raycast={() => null}>
          <cylinderGeometry args={[0.024, 0.024, 0.16, 12]} />
          <Metal />
        </mesh>
      ))}
    </group>
  ));
}

function Column({ name, alpha, beta, phase, star = false, dialRef }) {
  return (
    <>
      <Tile y={PITCH / 2} amp={alpha} color="#00f2fe" state="zero" text={`${star ? 'α*' : 'α'} ${alpha.toFixed(2)}`} />
      <Tile y={-PITCH / 2} amp={beta} color="#f093fb" state="one" text={`${star ? 'β*' : 'β'} ${beta.toFixed(2)}`} phase={phase} dialRef={dialRef} />
      {name && <GlassPill text={name} state={beta * beta > 0.5 ? 'one' : 'zero'} active position={[0, PITCH + 0.62, 0]} />}
    </>
  );
}

// The bra: a copy of the column lifts out, turns into a row (transpose), flies
// through the mirror (which reflects its phase dial: the complex conjugate),
// and once the mirror has gone, settles against the ket, closing the bracket.
function BraFlight({ alpha, beta, phase, run, onReplay }) {
  const outer = useRef();
  const inner = useRef();
  const label = useRef();
  const dial = useRef();
  const mirror = useRef();
  const t = useRef(-0.2);
  const flags = useRef({ conj: false, gone: false, done: false });
  const [conj, setConj] = useState(false);
  const [mirrorGone, setMirrorGone] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    t.current = motionReduced() ? 1 : -0.2; // a beat for the camera first
    flags.current = { conj: false, gone: false, done: false };
    setConj(false);
    setMirrorGone(false);
    setDone(false);
  }, [run]);

  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt / 4.4);
    const tt = Math.max(0, t.current);
    const x = ROW_FAR * ss(0.2, 0.6, tt) + (ROW_DX - ROW_FAR) * ss(0.72, 0.92, tt);
    const z = 0.85 * ss(0, 0.15, tt) * (1 - ss(0.72, 0.95, tt));
    const rot = (Math.PI / 2) * ss(0.06, 0.32, tt);
    if (outer.current) outer.current.position.set(x, 0, z);
    if (inner.current) inner.current.rotation.z = rot;
    if (label.current) label.current.position.set(0, PITCH + 0.62 - 0.6 * ss(0.06, 0.32, tt), 0);
    const flip = ss(0.38, 0.46, tt); // while the row is inside the mirror
    if (dial.current) {
      dial.current.rotation.z = -rot; // keep the dial upright while the row turns
      dial.current.scale.y = 1 - 2 * flip; // the mirror's reflection: phase → −phase
    }
    const m = ss(0, 0.1, tt) * (1 - ss(0.62, 0.72, tt));
    if (mirror.current) {
      mirror.current.scale.setScalar(Math.max(m, 1e-3));
      mirror.current.visible = m > 0.002;
    }
    if (!flags.current.conj && flip > 0.5) { flags.current.conj = true; setConj(true); }
    if (!flags.current.gone && tt > 0.66) { flags.current.gone = true; setMirrorGone(true); }
    if (!flags.current.done && tt >= 0.97) { flags.current.done = true; setDone(true); }
  });

  return (
    <>
      <group ref={outer}>
        <group ref={inner}>
          <Column alpha={alpha} beta={beta} phase={phase} star={conj} dialRef={dial} />
        </group>
        <group ref={label}><GlassPill text="⟨ψ|" state="zero" active /></group>
      </group>

      {/* the mirror: reflects each amplitude's phase */}
      <group ref={mirror} position={[MIRROR_DX, 0, 0.5]} scale={0.001}>
        <RoundedBox args={[0.05, 1.9, 1.7]} radius={0.02} smoothness={2} raycast={() => null}>
          <GlassMaterial tint="#d9ffe8" />
        </RoundedBox>
        <Line
          points={[[0, -0.95, -0.85], [0, 0.95, -0.85], [0, 0.95, 0.85], [0, -0.95, 0.85], [0, -0.95, -0.85]]}
          color={GREEN}
          lineWidth={1.6}
          transparent
          opacity={0.85}
        />
        {!mirrorGone && <GlassPill text="* conjugate" state="zero" position={[0, 1.3, 0]} label="The mirror takes the complex conjugate" />}
      </group>

      {done && (
        <>
          <GlassPill text="= 1" state="zero" active position={[TILE / 2 + 0.7, 0, 0]} />
          <GlassPill text="⟨ψ|ψ⟩ = |α|² + |β|² = 1" state="zero" active position={[ROW_DX / 2, -1.6, 0]} />
          <GlassPill text="↻ Replay" state="one" position={[ROW_DX / 2, -2.15, 0]} onClick={onReplay} label="Play the bra animation again" />
        </>
      )}
    </>
  );
}

// ── The scene's 3D content ──────────────────────────────────────────────────

export function DiracSpace({ step, theta, phase }) {
  const { controls } = useThree();
  const shift = useRef();
  const sx = useRef(step === 3 ? 1 : 0);
  const [run, setRun] = useState(0);
  const alpha = Math.cos(theta / 2);
  const beta = Math.sin(theta / 2);

  useFrame((_, dt) => {
    const goal = step === 3 ? 1 : 0;
    sx.current = motionReduced() ? goal : damp(sx.current, goal, 3, dt);
    if (shift.current) {
      shift.current.position.set(DIAG_SHIFT * sx.current, DIAG_DROP * sx.current, 0);
      shift.current.scale.setScalar(1 + (DIAG_SCALE - 1) * sx.current);
    }
  });

  const NAMES = ['|0⟩', '|1⟩', Math.abs(theta - Math.PI / 2) < 1e-6 ? '|+⟩' : '|ψ⟩', '|ψ⟩'];

  return (
    <>
      <group position={[BASE_X, 0, 0]}>
        <StateSpace step={step} theta={theta} shiftRef={shift} controls={controls} />
        <group position={[COL_X, 0, 0]}>
          <Brackets />
          <Column name={NAMES[step]} alpha={alpha} beta={beta} phase={phase} />
          {step === 3 && <BraFlight alpha={alpha} beta={beta} phase={phase} run={run} onReplay={() => setRun((r) => r + 1)} />}
        </group>
      </group>
      <CameraRig step={step} />
    </>
  );
}
