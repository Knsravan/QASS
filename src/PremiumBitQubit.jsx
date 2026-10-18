import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { InlineMath } from './KatexMath';
import { useQuality } from './QualityScene';
import { bvqLive } from './bitVsQubitLive';

/*
 * Classical Bit vs Qubit's two models, drawn as one set of instruments:
 *
 * - PremiumBlochSphere: a glass Bloch sphere held in a brushed-metal meridian
 *   ring, with latitude and longitude lines, the |0>/|1> axis, a glowing state
 *   vector and its shadow on the equatorial plane. The vector sweeps the sphere
 *   until it is measured, then snaps to |0> or |1> with a ring of light.
 * - PremiumBit: the same glass as a capsule with metal collars, and a bead
 *   that can only sit in its 0 seat or its 1 seat.
 *
 * The metal is a matcap (lit steel drawn once on a canvas) and the glass takes
 * its highlights from the scene's lights: no reflection map, whose highlights
 * overflowed the glow pass into black blots. Colours: 0 and |0> cyan, 1 and
 * |1> purple, as everywhere in the app.
 */

const C0 = new THREE.Color('#00f2fe');
const C1 = new THREE.Color('#f093fb');
const R = 2; // the sphere's radius (the scene's other qubits use 2 too)
const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _col = new THREE.Color();

// ── Shared looks ────────────────────────────────────────────────────────────

// The glass both models are made of: refracting where the tier allows, a
// clear-coated veil where it doesn't. Its finish is never mirror-smooth: a
// near-zero roughness concentrates the scene's point lights into highlights
// brighter than the glow pass can hold, which it then smears into black blots.
export function GlassMaterial({ tint = '#e6f7ff' }) {
  const q = useQuality();
  if (q.tier === 'low') {
    return <meshPhysicalMaterial color={tint} transparent opacity={0.14} roughness={0.16} metalness={0} clearcoat={1} clearcoatRoughness={0.2} depthWrite={false} />;
  }
  return (
    <meshPhysicalMaterial
      color={tint}
      transmission={1}
      thickness={0.35}
      roughness={0.14}
      ior={1.32}
      clearcoat={1}
      clearcoatRoughness={0.2}
      attenuationColor="#9be7ff"
      attenuationDistance={9}
     
      transparent
      depthWrite={false}
    />
  );
}

// Brushed steel, drawn as a matcap (a picture of a lit steel ball the surface
// looks itself up in): it reads as polished metal from every angle, costs
// nothing to light, and has none of the lighting maths that can go wrong on
// some GPUs at a thin ring's edges.
let metalMatcap = null;
function getMetalMatcap() {
  if (metalMatcap) return metalMatcap;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const base = g.createRadialGradient(size * 0.36, size * 0.3, size * 0.02, size * 0.5, size * 0.5, size * 0.5);
  base.addColorStop(0, '#ffffff');
  base.addColorStop(0.18, '#e6edf7');
  base.addColorStop(0.5, '#8a97ab');
  base.addColorStop(0.82, '#3a4354');
  base.addColorStop(1, '#141922');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // The studio's coloured side lights, caught near the rim: cyan on the left, magenta on the right.
  const tint = (x, color) => {
    const r = g.createRadialGradient(x, size * 0.55, 0, x, size * 0.55, size * 0.32);
    r.addColorStop(0, color);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'screen';
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'source-over';
  };
  tint(size * 0.08, 'rgba(56, 220, 255, 0.55)');
  tint(size * 0.92, 'rgba(240, 140, 250, 0.45)');
  metalMatcap = new THREE.CanvasTexture(c);
  metalMatcap.colorSpace = THREE.SRGBColorSpace;
  return metalMatcap;
}
export function Metal({ shade = '#ffffff' }) {
  return <meshMatcapMaterial matcap={getMetalMatcap()} color={shade} />;
}

// A soft glow at the glass's silhouette (Fresnel), cyan at the top fading to purple below.
const rimVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vY = normalize(position).y;
    gl_Position = projectionMatrix * mv;
  }`;
const rimFragment = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uBottom; uniform float uStrength; uniform vec3 uFlash; uniform float uFlashAmt;
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    // Clamped: a dot product a hair over 1 would make pow() NaN, which the glow pass smears into black blots.
    float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 2.6);
    vec3 c = mix(uBottom, uTop, smoothstep(-0.9, 0.9, vY));
    c = mix(c, uFlash, uFlashAmt);
    gl_FragColor = vec4(c, f * uStrength);
  }`;
export function useRimMaterial(strength = 0.85) {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader: rimVertex,
    fragmentShader: rimFragment,
    uniforms: {
      uTop: { value: C0.clone() },
      uBottom: { value: C1.clone() },
      uStrength: { value: strength },
      uFlash: { value: new THREE.Color('#ffffff') },
      uFlashAmt: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [strength]);
}

// A name plate pinned to a model: a pill of the app's own liquid glass (the
// same as the header pills: bent backdrop, rim light, press squash; see
// LiquidGlass.js and glassGL.js), held at the end of an arm or stalk. The
// plate for the model's current state glows in that state's colour. `onClick`
// makes it a button.
function GlassPill({ text, state, active, round = false, position, onClick, onPointerOver, onPointerOut, label }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Html position={position} center zIndexRange={[40, 0]}>
      <Tag
        type={onClick ? 'button' : undefined}
        className={`bvq-pill ${round ? 'bvq-pill-round' : ''} bvq-pill-${state}`}
        data-active={active ? '' : undefined}
        aria-label={label}
        aria-pressed={onClick ? active : undefined}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {text}
      </Tag>
    </Html>
  );
}

// A pole's crown: a steel collar around the pole's bead and a halo of light that
// slowly turns about the axis, bright when a measurement lands on this pole.
function PoleCrown({ y, color, active }) {
  const halo = useRef();
  const haloMat = useRef();
  const lit = useRef(active ? 1 : 0);
  useFrame((state, dt) => {
    lit.current += ((active ? 1 : 0) - lit.current) * (1 - Math.exp(-6 * Math.min(dt, 0.1)));
    if (halo.current) halo.current.rotation.z = state.clock.getElapsedTime() * 0.6;
    if (haloMat.current) haloMat.current.opacity = 0.45 + lit.current * 0.55;
  });
  return (
    <group position={[0, y, 0]}>
      <mesh rotation-x={Math.PI / 2} raycast={() => null}>
        <torusGeometry args={[0.15, 0.022, 14, 48]} />
        <Metal />
      </mesh>
      {/* the halo: a broken ring, so its turning shows */}
      <mesh ref={halo} rotation-x={Math.PI / 2} raycast={() => null}>
        <torusGeometry args={[0.3, 0.013, 8, 64, Math.PI * 1.6]} />
        <meshBasicMaterial ref={haloMat} color={color} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Tooltip({ position, glow = 'cyan', width = 230, children }) {
  return (
    <Html position={position} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`glass-tooltip ${glow}-glow`} style={{ width: `${width}px` }}>{children}</div>
    </Html>
  );
}

/** Grows its children in from nothing when it mounts (`animate`), so swapping models never pops. */
export function GrowIn({ animate = true, children }) {
  const ref = useRef();
  const s = useRef(animate ? 0.001 : 1);
  useFrame((_, dt) => {
    if (!ref.current || s.current === 1) return;
    s.current += (1 - s.current) * (1 - Math.exp(-7 * Math.min(dt, 0.1)));
    if (1 - s.current < 0.002) s.current = 1;
    ref.current.scale.setScalar(s.current);
  });
  return <group ref={ref} scale={s.current}>{children}</group>;
}

// ── The Bloch sphere ────────────────────────────────────────────────────────

const LATITUDES = [-60, -30, 30, 60].map((d) => (d * Math.PI) / 180);
const MERIDIANS = [0, 30, 60, 90, 120, 150].map((d) => (d * Math.PI) / 180);

export function PremiumBlochSphere({ result = null, onClick, onHover, onUnhover }) {
  const rim = useRimMaterial(0.9);
  const gridRef = useRef();
  const vecRef = useRef();
  const shaftMat = useRef();
  const headMat = useRef();
  const tipMat = useRef();
  const dropRef = useRef();
  const shadowRef = useRef();
  const footRef = useRef();
  const ringRef = useRef();
  const ringMat = useRef();
  const theta = useRef(Math.PI / 2);
  const phi = useRef(0);
  const flash = useRef({ t: -1, color: C0.clone() });
  const lastResult = useRef(result);
  const [hover, setHover] = useState(null); // 'qubit' | 'north' | 'south' | 'equator'

  useFrame((state, dt) => {
    const t = state.clock.getElapsedTime();
    const k = 1 - Math.exp(-(result === null ? 2.2 : 9) * Math.min(dt, 0.1));

    // A new measurement: a ring of light leaves the pole it landed on.
    if (result !== lastResult.current) {
      lastResult.current = result;
      if (result !== null) {
        flash.current.t = t;
        flash.current.color.copy(result === 0 ? C0 : C1);
      }
    }

    // Where the arrow points: sweeping the whole sphere until measured, then at the pole.
    const goalTheta = result === null ? Math.PI / 2 + Math.sin(t * 0.65) * (Math.PI / 2 - 0.06) : result === 0 ? 0 : Math.PI;
    theta.current += (goalTheta - theta.current) * k;
    if (result === null) phi.current += Math.min(dt, 0.1) * 0.45;
    const th = theta.current;
    bvqLive.p1 = Math.sin(th / 2) ** 2;

    _dir.set(Math.sin(th) * Math.sin(phi.current), Math.cos(th), Math.sin(th) * Math.cos(phi.current));
    if (vecRef.current) vecRef.current.quaternion.setFromUnitVectors(UP, _dir);

    // The arrow's colour runs from cyan (|0>) to purple (|1>) with the odds.
    _col.copy(C0).lerp(C1, bvqLive.p1);
    if (shaftMat.current) { shaftMat.current.color.copy(_col); shaftMat.current.emissive.copy(_col); }
    if (headMat.current) { headMat.current.color.copy(_col); headMat.current.emissive.copy(_col); }
    if (tipMat.current) tipMat.current.emissive.copy(_col);

    // Its shadow on the equatorial plane, and the drop line to it.
    const L = R * 0.94;
    const tip = [_dir.x * L, _dir.y * L, _dir.z * L];
    const foot = [_dir.x * L, 0, _dir.z * L];
    // (Hidden near the poles, where they would shrink to nothing: a zero-length fat line draws NaN.)
    const showShadow = Math.hypot(foot[0], foot[2]) > 0.05;
    if (dropRef.current) {
      dropRef.current.visible = showShadow;
      if (showShadow) { dropRef.current.geometry.setPositions([...tip, ...foot]); dropRef.current.computeLineDistances(); }
    }
    if (shadowRef.current) {
      shadowRef.current.visible = showShadow;
      if (showShadow) shadowRef.current.geometry.setPositions([0, 0, 0, ...foot]);
    }
    if (footRef.current) { footRef.current.visible = showShadow; footRef.current.position.set(foot[0], 0, foot[2]); }

    // The grid turns slowly, so the glass reads as a solid in space.
    if (gridRef.current) gridRef.current.rotation.y = t * 0.05;

    // The measurement ring and the rim's flash.
    const ft = flash.current.t < 0 ? 99 : t - flash.current.t;
    const fade = Math.max(0, 1 - ft / 1.1);
    rim.uniforms.uFlash.value.copy(flash.current.color);
    rim.uniforms.uFlashAmt.value = fade * 0.85;
    rim.uniforms.uStrength.value = 0.9 + fade * 1.4;
    if (ringRef.current && ringMat.current) {
      ringRef.current.visible = fade > 0;
      ringRef.current.position.y = result === 1 ? -R : R;
      ringRef.current.scale.setScalar(0.2 + ft * 2.6);
      ringMat.current.color.copy(flash.current.color);
      ringMat.current.opacity = fade * 0.9;
    }
  });

  const hoverTo = (part) => (e) => { e.stopPropagation(); setHover(part); onHover?.(); };
  const hoverOut = () => { setHover(null); onUnhover?.(); };

  return (
    <group>
      {/* Glass shell (the click and hover target) and its glowing silhouette */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick?.(); }} onPointerOver={hoverTo('qubit')} onPointerOut={hoverOut}>
        <sphereGeometry args={[R, 96, 64]} />
        <GlassMaterial />
      </mesh>
      <mesh scale={1.012} material={rim} raycast={() => null}>
        <sphereGeometry args={[R, 64, 48]} />
      </mesh>

      {/* Latitude and longitude lines, the equator brightest */}
      <group ref={gridRef}>
        {LATITUDES.map((lat) => (
          <mesh key={lat} position={[0, Math.sin(lat) * R, 0]} rotation-x={Math.PI / 2} raycast={() => null}>
            <torusGeometry args={[Math.cos(lat) * R * 1.003, 0.006, 6, 128]} />
            <meshBasicMaterial color="#5eead4" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
        {MERIDIANS.map((lon) => (
          <mesh key={lon} rotation-y={lon} raycast={() => null}>
            <torusGeometry args={[R * 1.003, 0.006, 6, 160]} />
            <meshBasicMaterial color="#5eead4" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh rotation-x={Math.PI / 2} onPointerOver={hoverTo('equator')} onPointerOut={hoverOut}>
        <torusGeometry args={[R * 1.004, 0.016, 10, 192]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* The equatorial plane, barely there */}
      <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
        <circleGeometry args={[R * 0.995, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.045} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* The brushed-steel meridian ring that holds the sphere, with pivots at the poles */}
      <mesh rotation-y={Math.PI / 2 - 0.35}>
        <torusGeometry args={[R * 1.075, 0.035, 20, 200, Math.PI * 2]} />
        <Metal />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * R * 1.075, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 24]} />
          <Metal />
        </mesh>
      ))}

      {/* The |0>-|1> axis through the poles, with a glowing bead at each */}
      <mesh raycast={() => null}>
        <cylinderGeometry args={[0.012, 0.012, R * 2.15, 12]} />
        <Metal shade="#aab4c4" />
      </mesh>
      <group position={[0, R, 0]} onPointerOver={hoverTo('north')} onPointerOut={hoverOut}>
        <mesh><sphereGeometry args={[0.2, 16, 16]} /><meshBasicMaterial visible={false} /></mesh>
        <mesh><sphereGeometry args={[0.075, 24, 24]} /><meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={result === 0 ? 4 : 1.6} /></mesh>
      </group>
      <group position={[0, -R, 0]} onPointerOver={hoverTo('south')} onPointerOut={hoverOut}>
        <mesh><sphereGeometry args={[0.2, 16, 16]} /><meshBasicMaterial visible={false} /></mesh>
        <mesh><sphereGeometry args={[0.075, 24, 24]} /><meshStandardMaterial color="#f093fb" emissive="#f093fb" emissiveIntensity={result === 1 ? 4 : 1.6} /></mesh>
      </group>
      <PoleCrown y={R} color="#00f2fe" active={result === 0} />
      <PoleCrown y={-R} color="#f093fb" active={result === 1} />

      {/* Name plates on stalks from the pivots: |0> above the north pole, |1> below the south */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * (R * 1.075 + 0.17), 0]} raycast={() => null}>
          <cylinderGeometry args={[0.012, 0.012, 0.22, 10]} />
          <Metal shade="#aab4c4" />
        </mesh>
      ))}
      <GlassPill text="|0⟩" state="zero" active={result === 0} position={[0, R * 1.075 + 0.28 + 0.15, 0]} label="North pole, ket zero" onPointerOver={hoverTo('north')} onPointerOut={hoverOut} />
      <GlassPill text="|1⟩" state="one" active={result === 1} position={[0, -(R * 1.075 + 0.28 + 0.15), 0]} label="South pole, ket one" onPointerOver={hoverTo('south')} onPointerOut={hoverOut} />

      {/* The state vector: a metal shaft lit in the state's colour, a cone head and a glowing tip */}
      <group ref={vecRef}>
        <mesh position={[0, R * 0.42, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.032, 0.032, R * 0.84, 16]} />
          <meshStandardMaterial ref={shaftMat} metalness={0.55} roughness={0.25} emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[0, R * 0.86, 0]} raycast={() => null}>
          <coneGeometry args={[0.1, 0.24, 32]} />
          <meshStandardMaterial ref={headMat} metalness={0.5} roughness={0.3} emissiveIntensity={1.4} />
        </mesh>
        <mesh position={[0, R * 0.94, 0]} raycast={() => null}>
          <sphereGeometry args={[0.07, 24, 24]} />
          <meshStandardMaterial ref={tipMat} color="#ffffff" emissiveIntensity={4} />
        </mesh>
      </group>
      {/* The nucleus at the centre */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={2.4} />
      </mesh>

      {/* The vector's shadow on the equatorial plane */}
      <Line ref={dropRef} points={[[0, 1, 0], [0, 0, 0]]} color="#94a3b8" lineWidth={1.2} dashed dashSize={0.08} gapSize={0.07} transparent opacity={0.7} />
      <Line ref={shadowRef} points={[[0, 0, 0], [1, 0, 0]]} color="#94a3b8" lineWidth={1.4} transparent opacity={0.55} />
      <mesh ref={footRef} raycast={() => null}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color="#cbd5e1" />
      </mesh>

      {/* The ring of light a measurement sends out from its pole */}
      <mesh ref={ringRef} rotation-x={Math.PI / 2} visible={false} raycast={() => null}>
        <torusGeometry args={[1, 0.02, 8, 96]} />
        <meshBasicMaterial ref={ringMat} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {hover === 'qubit' && (
        <Tooltip position={[-2.7, 2.1, 0]} glow={result === 1 ? 'purple' : 'cyan'}>
          {result === null ? (
            <><h4>Qubit</h4><p>Its arrow can point anywhere on the sphere, not just up (0) or down (1). Click to measure it: the result is 0 or 1 at random, with the odds shown below.</p></>
          ) : (
            <><h4>Measured: {result}</h4><p>Measuring forced the arrow to a pole. Click to prepare a fresh qubit and measure again.</p></>
          )}
        </Tooltip>
      )}
      {hover === 'north' && (
        <Tooltip position={[1.9, R + 0.5, 0]} glow="cyan">
          <h4>North pole: <InlineMath math={String.raw`|0\rangle`} /></h4>
          <p>A measurement lands here with probability <InlineMath math={String.raw`|\alpha|^2`} />: the closer the arrow points to it, the likelier.</p>
        </Tooltip>
      )}
      {hover === 'south' && (
        <Tooltip position={[1.9, -R - 0.5, 0]} glow="purple">
          <h4>South pole: <InlineMath math={String.raw`|1\rangle`} /></h4>
          <p>A measurement lands here with probability <InlineMath math={String.raw`|\beta|^2`} />: the closer the arrow points to it, the likelier.</p>
        </Tooltip>
      )}
      {hover === 'equator' && (
        <Tooltip position={[R + 0.4, 0.9, 0]} glow="cyan" width={250}>
          <h4>The equator</h4>
          <p>Anywhere on this ring, 0 and 1 are equally likely: 50% each. A classical bit can never be here.</p>
        </Tooltip>
      )}
    </group>
  );
}

// ── The classical bit ───────────────────────────────────────────────────────

const SEAT = 1.1; // the 0 seat's height (the 1 seat is at -SEAT)

export function PremiumBit({ value = 0, onToggle, onHover, onUnhover }) {
  const rim = useRimMaterial(0.8);
  const beadRef = useRef();
  const beadMat = useRef();
  const seat0 = useRef();
  const seat1 = useRef();
  const y = useRef(value === 0 ? SEAT : -SEAT);
  const vy = useRef(0);
  const [hover, setHover] = useState(false);

  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 30);
    // A stiff spring: the bead jumps between its seats with a small bounce, never resting between.
    const goal = value === 0 ? SEAT : -SEAT;
    vy.current += ((goal - y.current) * 900 - vy.current * 38) * d;
    y.current += vy.current * d;
    if (beadRef.current) beadRef.current.position.y = y.current;
    const c = value === 0 ? C0 : C1;
    if (beadMat.current) { beadMat.current.color.copy(c); beadMat.current.emissive.copy(c); }
    if (seat0.current) seat0.current.emissiveIntensity = value === 0 ? 2.6 : 0.25;
    if (seat1.current) seat1.current.emissiveIntensity = value === 1 ? 2.6 : 0.25;
  });

  return (
    <group
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); onHover?.(); }}
      onPointerOut={() => { setHover(false); onUnhover?.(); }}
    >
      {/* Glass capsule and its glowing silhouette */}
      <mesh>
        <capsuleGeometry args={[0.6, 2.2, 24, 48]} />
        <GlassMaterial />
      </mesh>
      <mesh scale={1.015} material={rim} raycast={() => null}>
        <capsuleGeometry args={[0.6, 2.2, 16, 32]} />
      </mesh>

      {/* Metal collars where the glass rounds off, and a band at the middle */}
      {[SEAT, -SEAT].map((h) => (
        <mesh key={h} position={[0, h, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.62, 0.04, 16, 96]} />
          <Metal />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.615, 0.014, 10, 96]} />
        <Metal shade="#b8c2d2" />
      </mesh>

      {/* The rail the bead rides, and its two seats (the occupied one lights up) */}
      <mesh raycast={() => null}>
        <cylinderGeometry args={[0.014, 0.014, SEAT * 2, 10]} />
        <Metal shade="#aab4c4" />
      </mesh>
      <mesh position={[0, SEAT, 0]} rotation-x={Math.PI / 2} raycast={() => null}>
        <torusGeometry args={[0.22, 0.03, 12, 48]} />
        <meshStandardMaterial ref={seat0} color="#00f2fe" emissive="#00f2fe" metalness={0.3} roughness={0.3} />
      </mesh>
      <mesh position={[0, -SEAT, 0]} rotation-x={Math.PI / 2} raycast={() => null}>
        <torusGeometry args={[0.22, 0.03, 12, 48]} />
        <meshStandardMaterial ref={seat1} color="#f093fb" emissive="#f093fb" metalness={0.3} roughness={0.3} />
      </mesh>

      {/* The bead */}
      <mesh ref={beadRef} position={[0, y.current, 0]} raycast={() => null}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial ref={beadMat} emissiveIntensity={3.2} roughness={0.35} />
      </mesh>

      {/* Name plates on arms from the collars: 0 by the 0 seat, 1 by the 1 seat */}
      {[SEAT, -SEAT].map((h) => (
        <mesh key={h} position={[0.73, h, 0]} rotation-z={Math.PI / 2} raycast={() => null}>
          <cylinderGeometry args={[0.012, 0.012, 0.24, 10]} />
          <Metal shade="#aab4c4" />
        </mesh>
      ))}
      <GlassPill text="0" state="zero" round active={value === 0} position={[1.04, SEAT, 0]} label="Set the bit to 0" onClick={value === 0 ? undefined : onToggle} />
      <GlassPill text="1" state="one" round active={value === 1} position={[1.04, -SEAT, 0]} label="Set the bit to 1" onClick={value === 1 ? undefined : onToggle} />

      {hover && (
        <Tooltip position={[1.9, 2.2, 0]} glow={value === 0 ? 'cyan' : 'purple'} width={220}>
          <h4>Classical bit: {value}</h4>
          <p>Exactly {value}, every time you look. Click to apply a NOT gate and flip it to {1 - value}.</p>
        </Tooltip>
      )}
    </group>
  );
}
