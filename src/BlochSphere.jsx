import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, PresentationControls } from '@react-three/drei';
import { useSpring, a } from '@react-spring/three';
import { handoff, GLIDE, REST, HUB_CAMERA } from './handoff';
import { BlochSphereUnit, arrowGrow, DEC_STATIC_ENTRANCE, CT, CA } from './DecoSphereUnit';
import * as THREE from 'three';
import { Bloom } from '@react-three/postprocessing';
import { BlockMath, InlineMath } from './KatexMath';
import { QualityComposer } from './QualityScene';
import { PremiumBlochSphere, PremiumBit, GrowIn, Metal, GlassMaterial, useRimMaterial } from './PremiumBitQubit';
import { SphereLines, LightLine, Halo } from './GlassBlochParts';
import { MathChip } from './MathChip';

// =========================================
// 1. CLASSICAL BIT COMPONENT (Left Side)
// =========================================
export const ClassicalBit = ({ position, scale = 1, activeModule, flipMode, isBlank, attemptCopy, onDomainHover, onDomainUnhover }) => {
  const groupRef = useRef();
  const orbRef = useRef();
  const lightRef = useRef();

  const [value, setValue] = useState(0);
  const [hovered, setHovered] = useState(false);
  const rimMat = useRimMaterial(0.7);

  const born = useRef(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (born.current === null) born.current = t;
    const ft = t - born.current; // flips count from when this bit appeared (so it starts at 0)
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    if (flipMode === 'slow') setValue(Math.floor(ft * 0.8) % 2);
    else if (flipMode === 'fast') setValue(Math.floor(ft * 2) % 2);
    else if (flipMode === 'async') setValue(Math.floor(ft * 1.8) % 2);
    else if (flipMode === 'static') setValue(0);

    const targetY = value === 0 ? 1.1 : -1.1;
    if (orbRef.current && !isBlank) {
      if (!activeModule && !flipMode) {
        // Ambient idle state - very slow faint drifting only if no flipMode is set
        const idleVal = (Math.sin(t * 0.4) + 1) / 2; // 0 to 1
        orbRef.current.position.y = THREE.MathUtils.lerp(-1.1, 1.1, 1 - idleVal);
      } else {
        // Crisp digital jump/snap between discrete 0 (1.1) and 1 (-1.1)
        orbRef.current.position.y = THREE.MathUtils.lerp(orbRef.current.position.y, targetY, 0.35);
      }
    }
  });

  // Expose a way to set value externally if needed
  useEffect(() => {
    if (flipMode === 'force-1') setValue(1);
    if (flipMode === 'force-0') setValue(0);
  }, [flipMode]);

  const activeColor = attemptCopy ? "#22c55e" : (value === 0 ? "#00f2fe" : "#f093fb");

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      // A click on the bit stays with it (it doesn't reach a clickable parent).
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); if (onDomainHover) onDomainHover(); }}
      onPointerOut={(e) => { setHovered(false); if (onDomainUnhover) onDomainUnhover(); }}
    >
      {/* A glass capsule, its rim glowing at the silhouette */}
      <mesh>
        <capsuleGeometry args={[0.6, 2.2, 16, 32]} />
        <GlassMaterial />
      </mesh>
      <mesh raycast={() => null}>
        <capsuleGeometry args={[0.605, 2.2, 16, 32]} />
        <primitive object={rimMat} attach="material" />
      </mesh>
      {/* the two seats the bead can sit in, rings of light: 0 and 1, nothing between */}
      {[1, -1].map((sgn) => (
        <mesh key={sgn} position={[0, sgn * 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <torusGeometry args={[0.3, 0.014, 8, 48]} />
          <meshBasicMaterial color={sgn > 0 ? '#00f2fe' : '#f093fb'} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {/* the rail the bead runs on, a line of light */}
      <LightLine length={2.2} opacity={0.35} />

      {!isBlank && (
        <>
          <Html position={[1.05, 1.1, 0]} center>
            <MathChip tex="0" tone="zero" round active={value === 0} style={{ opacity: 'var(--bit-fade, 1)' }} />
          </Html>
          <Html position={[1.05, -1.1, 0]} center>
            <MathChip tex="1" tone="one" round active={value === 1} style={{ opacity: 'var(--bit-fade, 1)' }} />
          </Html>

          {/* the bead: a glowing pearl */}
          <mesh ref={orbRef} position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.22, 32, 20]} />
            <meshPhysicalMaterial color={activeColor} emissive={activeColor} emissiveIntensity={0.7} roughness={0.12} clearcoat={1} clearcoatRoughness={0.1} />
            <Halo radius={0.4} color={activeColor} opacity={0.18} />
            <pointLight ref={lightRef} color={activeColor} intensity={2.5} distance={3} />
          </mesh>
        </>
      )}

      {hovered && (
        <Html position={[0, 2.8, 0]} center zIndexRange={[100, 0]}>
          <div className="glass-tooltip cyan-glow" >
            <h4>Classical Bit</h4>
            <p>{attemptCopy ? "Clonable: Classical data can be perfectly duplicated." : "Exists strictly as a 0 or 1. It jumps instantly between states but never exists in between."}</p>
          </div>
        </Html>
      )}
    </group>
  );
};

// =========================================

// Static THREE objects reused every frame to avoid GC pressure
const _tmpGoal = new THREE.Color();
const _tmpV = new THREE.Vector3();
const _tmpL = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();
const _tmpQ2 = new THREE.Quaternion();
const _decStartLocal = new THREE.Vector3();
const _tmpM = new THREE.Matrix4();
const _Q_UP = new THREE.Quaternion(); // |0>: the arrow straight up
const _LIGHTS_HUB = [[8, 8, 8], [-8, -8, -8]];
const _LIGHTS_ENT = [[8, 12, 8], [-8, -12, -8]];
// Exponential State Space lights its qubit white and violet from further off (the hub's lights glide there as the qubit zooms in).
const _LIGHTS_EXP = [[10, 15, 10], [-10, -10, -10]];
// Decoherence: a dim teal and amber pair (the pure and the noisy qubit).
const _LIGHTS_DEC = [[-6, 6.65, 7], [6, 6.65, 7]];
const _DEC_LIGHT = { amb: 0.16, c1: new THREE.Color('#14b8a6'), i1: 0.95, c2: new THREE.Color('#f59e0b'), i2: 0.95, dist: 1000 };
// Where the modules that take this scene over keep their models (handoff.js).
const ENT = REST.entanglement, DEC = REST.decoherence, EXP = REST.exponential, MQG = REST['multi-qubit-gates'];
// The Decoherence sphere is drawn at the lone qubit's size and grows to the module's as the pair zooms.
const _DEC_UNIT_FIRST = 1.2 / DEC.scale;   // inside the first qubit's rig (its base scale is 1.2)
const _DEC_UNIT_SECOND = 1 / DEC.scale;    // inside the second's (base scale 1)
const _UPV = new THREE.Vector3(0, 1, 0);
// Classical Bit vs Qubit draws its pair (PremiumBitQubit.jsx) a little smaller and higher than
// the other modules of this scene, so its readout fits underneath and the sphere stays in view
// with the sidebar open. (The header pills sit to match: SIDE_TITLES in stagePhases.js, 39vh × BVQ_SCALE.)
const BVQ_SCALE = 0.86;
const BVQ_Y = 0.45;
const _EXP_LIGHT = { amb: 0.6, c1: new THREE.Color('#ffffff'), i1: 2.0, c2: new THREE.Color('#a855f7'), i2: 1.5, dist: 1000 };
const _HUB_LIGHT = { amb: 0.5, c1: new THREE.Color('#00f2fe'), i1: 8, c2: new THREE.Color('#f093fb'), i2: 8, dist: 30 };
const _ORIGIN_BS = new THREE.Vector3(0, 0, 0);
const _AXIS_Y = new THREE.Vector3(0, 1, 0);
const _DEC_CAM = new THREE.Vector3(...DEC.camera.cam);   // Decoherence's resting view: where the camera is and what it aims at
const _DEC_LOOK = new THREE.Vector3(...DEC.camera.target);
const _HUB_CAM = new THREE.Vector3(...HUB_CAMERA.cam);

// =========================================
// 2. QUANTUM QUBIT COMPONENT (Right Side)
// =========================================
export const QubitCore = ({ position, scale = 1, activeModule, onDomainHover, onDomainUnhover, customVectorQuat, showCustomVector, emissiveColor, customGridColor, customRingColor, sphereRotation, visible, interferenceStep = 0, interferencePhase = 0, fadeExtras = false, vectorOut, startDir }) => {
  const coreGroupRef = useRef();
  const sphereRef = useRef(); const vectorRef = useRef(); const northPoleRef = useRef(); const southPoleRef = useRef(); const glassCoreRef = useRef();

  const [hoveredState, setHoveredState] = useState(null);
  // A qubit that arrives with its arrow already set (a hand-over) starts there, not swinging in from |0>.
  useLayoutEffect(() => {
    if (customVectorQuat && vectorRef.current) vectorRef.current.quaternion.copy(customVectorQuat);
    else if (startDir && vectorRef.current) vectorRef.current.quaternion.setFromUnitVectors(_UPV, startDir);
    if (vectorOut) vectorOut.current = vectorRef.current;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The glass's lines: pale blue, unless a module tints its sphere (then in that tint).
  const lineColor = customRingColor || customGridColor || '#9fd8ff';
  const equatorColor = customRingColor || customGridColor || '#b6e9ff';
  const rimMat = useRimMaterial(0.85);
  const axisColor = "#64748b";
  const axisOut = activeModule === 'gates' ? 2.95 : 2.25;

  const targetSphereOpacity = 1;

  const { sOpacity } = useSpring({
    sOpacity: targetSphereOpacity,
    config: { mass: 1, tension: 120, friction: 18 }
  });

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    let targetSphereRotY = time * 0.04;

    if (coreGroupRef.current) coreGroupRef.current.rotation.x = THREE.MathUtils.lerp(coreGroupRef.current.rotation.x, 0, 0.1);

    sphereRef.current.rotation.y = targetSphereRotY;

    const pulse = 1 + Math.sin(time * 3) * 0.08;
    if (northPoleRef.current) northPoleRef.current.scale.set(pulse, pulse, pulse);
    if (southPoleRef.current) southPoleRef.current.scale.set(pulse, pulse, pulse);

    if (vectorRef.current) {
      let targetX = 0; let targetY = 0;

      if (!activeModule) {
        // Ambient idle state: drift pole -> equator -> pole
        // sine wave mapped to 0 to PI
        targetX = ((Math.sin(time * 0.4) + 1) / 2) * Math.PI; 
        targetY = time * 0.2; // slow continuous rotation around Y
        if (glassCoreRef.current) glassCoreRef.current.emissiveIntensity = 0.2 + (Math.sin(time) * 0.1);
      }
      else if (['gates', 'multi-qubit-gates'].includes(activeModule)) {
        // Fallback state-space sweep, only visible when no customVectorQuat is driving the vector.
        // (Here "gates" is also the hub's scene on its way to or from Classical Gates,
        // where the vector rests at |0> to match that scene's start.)
        if (activeModule === 'gates') { targetX = 0; targetY = 0; }
        else {
          targetX = Math.abs(Math.sin(time * 1.5)) * Math.PI;
          targetY = Math.cos(time) * Math.PI;
        }
        if (glassCoreRef.current) {
          glassCoreRef.current.emissiveIntensity = 0;
          if (emissiveColor) {
            glassCoreRef.current.emissive.set(emissiveColor);
          }
        }
      }
      else if (activeModule === 'exponential') {
        targetX = Math.PI / 2;
      }
      else if (activeModule === 'interference') {
        if (interferenceStep === 0) {
          // Initial Ground State |0⟩ (Points straight up to North Pole)
          targetX = 0;
          targetY = 0;
        } else if (interferenceStep === 1 || interferenceStep === 2) {
          // 1st H-Gate: |+⟩ = (|0⟩ + |1⟩)/√2 -> Sweeps down and rests on Equator (+X)!
          targetX = Math.PI / 2;
          targetY = 0;
        } else if (interferenceStep === 3 || interferenceStep === 4) {
          // Z-Gate: |-⟩ = (|0⟩ - |1⟩)/√2 -> Sweeps 180° along Equator (-X)!
          targetX = Math.PI / 2;
          targetY = Math.PI;
        } else if (interferenceStep === 5) {
          // 2nd H-Gate: H|-⟩ = |1⟩ -> Sweeps from Equator down to South Pole (|1⟩)!
          targetX = Math.PI;
          targetY = Math.PI;
        } else if (interferenceStep === 6) {
          // Stage 3 Sandbox: Vector tracks phase continuously along Equator!
          targetX = Math.PI / 2;
          targetY = interferencePhase || 0;
        }
      }

      if (customVectorQuat) {
        vectorRef.current.quaternion.slerp(customVectorQuat, Math.min(1.0, delta * 9));
      } else {
        vectorRef.current.rotation.x = THREE.MathUtils.lerp(vectorRef.current.rotation.x, targetX, 0.08);
        vectorRef.current.rotation.y = (['gates', 'multi-qubit-gates', 'interference'].includes(activeModule))
          ? THREE.MathUtils.lerp(vectorRef.current.rotation.y, targetY, 0.08)
          : THREE.MathUtils.lerp(vectorRef.current.rotation.y, 0, 0.1);
        vectorRef.current.scale.y = 1 + Math.sin(time * 4) * 0.03;
      }
    } // end if (vectorRef.current)
  }); // end useFrame

  const getTooltipContent = (part) => {
    if (part === 'north') {
      if (activeModule === 'interference') return { title: "Constructive Return", text: <>Two H-Gates cancel out, returning the qubit perfectly to <InlineMath math={String.raw`|0\rangle`} />.</> };
      return { title: <>North Pole — <InlineMath math={String.raw`|0\rangle`} /></>, text: <>The computational basis ground state <InlineMath math={String.raw`|0\rangle`} />.</> };
    }
    if (part === 'south') {
      return { title: <>South Pole — <InlineMath math={String.raw`|1\rangle`} /></>, text: <>The computational basis excited state <InlineMath math={String.raw`|1\rangle`} />.</> };
    }
    if (part === 'equator') {
      const formulaBlock = (
        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
          <BlockMath math={String.raw`\frac{|0\rangle + |1\rangle}{\sqrt{2}}`} />
        </div>
      );
      if (activeModule === 'exponential') return { title: "Equal Superposition", text: <> One definite state, an equal blend of <InlineMath math={String.raw`|0\rangle`} /> and <InlineMath math={String.raw`|1\rangle`} />: a measurement gives 0 or 1, 50% each. {formulaBlock}</> };
      if (activeModule === 'entanglement') return { title: "Superposition Ring", text: <>Both qubits utilize superposition states on this equator (<InlineMath math={String.raw`\frac{|0\rangle + |1\rangle}{\sqrt{2}}`} />) to achieve entanglement.</> };
      return { title: "The Equator", text: "Every point on this ring is an equal superposition: 50% |0⟩ and 50% |1⟩, with a different relative phase." };
    }
    return { title: "", text: "" };
  };

  const vectorTarget = emissiveColor || "#14b8a6";
  // The arrow's colour glides to a new one (the hub's qubit turning into a module's).
  const vecCol = useRef(null);
  const [vectorColor, setVectorColor] = useState(vectorTarget);
  useFrame((_, dt) => {
    if (!vecCol.current) vecCol.current = new THREE.Color(vectorColor);
    const goal = _tmpGoal.set(vectorTarget);
    const c = vecCol.current;
    const diff = Math.abs(c.r - goal.r) + Math.abs(c.g - goal.g) + Math.abs(c.b - goal.b);
    if (diff < 0.004) { if (diff > 0) { c.copy(goal); setVectorColor(vectorTarget); } return; }
    c.lerp(goal, 1 - Math.exp(-5 * Math.min(dt, 0.1)));
    setVectorColor('#' + c.getHexString());
  });

  return (
    <group ref={coreGroupRef} position={position} scale={scale} visible={visible !== false}>
      <a.group ref={sphereRef} scale={sOpacity} rotation={sphereRotation || [0, 0, 0]}>
        {/* ── 1. The glass's rim, glowing at its silhouette (cyan above, purple below) ── */}
        <mesh raycast={() => null}>
          <sphereGeometry args={[2.01, 64, 40]} />
          <primitive object={rimMat} attach="material" />
        </mesh>

        {/* ── 2. Frosted Inner Glass Core ── */}
        <mesh
          // A click on the glass stays with this sphere (it doesn't reach a clickable parent).
          onClick={(e) => e.stopPropagation()}
          onPointerOver={(e) => { e.stopPropagation(); setHoveredState('qubit'); if (onDomainHover) onDomainHover(); }}
          onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}
        >
          <sphereGeometry args={[1.96, 32, 32]} />
          <meshPhysicalMaterial
            ref={glassCoreRef}
            color="#ffffff"
            transparent={true}
            opacity={0.06}
            transmission={0.95}
            roughness={0.1}
            clearcoat={1}
            ior={1.2}
            depthWrite={false}
          />
        </mesh>

        {/* ── 3. Depth Rings (Equator, Upper/Lower Parallels, Vertical Meridian) ── */}
        <group onPointerOver={(e) => { e.stopPropagation(); setHoveredState('equator'); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}>
          {/* Fine lines of latitude and longitude, and a brighter equator */}
          <SphereLines radius={2} color={lineColor} equatorColor={equatorColor} />
          {/* Invisible hit area for equator hover */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2, 0.15, 8, 64]} />
            <meshBasicMaterial visible={false} />
          </mesh>
          {hoveredState === 'equator' && (
            <Html position={[2.2, 0, 0]} center zIndexRange={[100, 0]}>
              <div
                className="glass-tooltip purple-glow"
                style={activeModule === 'entanglement' ? {
                  width: '185px',
                  padding: '8px 14px',
                  borderRadius: '18px',
                  textAlign: 'center',
                  background: 'rgba(10, 18, 30, 0.72)',
                  backdropFilter: 'blur(25px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                  border: '1.5px solid rgba(240, 147, 251, 0.65)',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 22px rgba(240, 147, 251, 0.25)'
                } : {}}
              >
                <h4 style={activeModule === 'entanglement' ? { margin: '0 0 2px 0', fontSize: '11px', color: '#f093fb' } : {}}>
                  {getTooltipContent('equator').title}
                </h4>
                <div style={activeModule === 'entanglement' ? { margin: 0, fontSize: '9.5px', color: '#cbd5e1', lineHeight: '1.35' } : { margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {getTooltipContent('equator').text}
                </div>
              </div>
            </Html>
          )}
        </group>

        {/* ── 4. Coordinate Axes (Green Z, Red X, Depth Y) ── */}
        <group rotation={[0, -Math.PI / 8, 0]}>
          {/* Z, X, Y Coordinate Axes (Hidden in error-correction to prioritize CNOT beams) */}
          {activeModule !== 'error-correction' && (
            <>
              {/* The |0>–|1> axis, and the two others fainter: lines of light */}
              <LightLine length={4.5} opacity={0.35} />
              <LightLine length={4.5} opacity={0.14} rotation={[0, 0, Math.PI / 2]} />
              <LightLine length={4.5} opacity={0.1} rotation={[Math.PI / 2, 0, 0]} />
            </>
          )}

          {/* Axis Labels (Gates & Multi-Gates modules): clear of the |+>/|i> chips on one sphere, inside a pair's gap on two */}
          {(activeModule === 'gates' || activeModule === 'multi-qubit-gates') && (
            <group>
              <Html position={[0, 0, axisOut]} center>
                <MathChip tex="X" tone="red" small round className={fadeExtras ? 'mq-extra' : undefined} />
              </Html>
              <Html position={[axisOut, 0, 0]} center>
                <MathChip tex="Y" small round className={fadeExtras ? 'mq-extra' : undefined} style={{ '--chip-c': axisColor }} />
              </Html>
              <Html position={[0.55, 2.42, 0]} center>
                <MathChip tex="Z" tone="green" small round className={fadeExtras ? 'mq-extra' : undefined} />
              </Html>
            </group>
          )}

          {/* ── 5. Bold Pointed State Vector Arrow ── */}
          {/* 'YXZ' euler order: phi (rotation.y) rotates about world Y after theta (rotation.x) tips the +Y-aligned arrow */}
          <group ref={(el) => { vectorRef.current = el; if (el) el.rotation.order = 'YXZ'; }} position={[0, 0, 0]}>
            <group position={[0, 0, 0]}>
              {/* A steel shaft… */}
              <mesh position={[0, 0.86, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.04, 0.04, 1.72, 20]} />
                <Metal />
              </mesh>
              {/* …ending in a glowing pearl, in the state's colour */}
              <mesh position={[0, 1.86, 0]} raycast={() => null}>
                <sphereGeometry args={[0.17, 32, 20]} />
                <meshPhysicalMaterial
                  color={vectorColor}
                  emissive={vectorColor}
                  emissiveIntensity={0.7}
                  roughness={0.12}
                  clearcoat={1}
                  clearcoatRoughness={0.1}
                />
              </mesh>
              <Halo radius={0.32} color={vectorColor} opacity={0.18} position={[0, 1.86, 0]} />
            </group>
          </group>
        </group>

        {/* ── 7. North & South Pole Interactive Nodes and Standardized Labels ── */}
        <group position={[0, 2.1, 0]} ref={northPoleRef} onPointerOver={(e) => { e.stopPropagation(); setHoveredState('north'); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}>
          <mesh><sphereGeometry args={[0.15, 16, 16]} /><meshBasicMaterial visible={false} /></mesh>
          {/* |0>: a bead of light */}
          <mesh raycast={() => null}><sphereGeometry args={[0.06, 16, 16]} /><meshBasicMaterial color="#00f2fe" toneMapped={false} /></mesh>
          <Halo radius={0.2} color="#00f2fe" opacity={hoveredState === 'north' ? 0.5 : 0.25} />
          {hoveredState === 'north' && (
            <Html position={[0, 0.4, 0]} center zIndexRange={[100, 0]}>
              <div
                className="glass-tooltip cyan-glow"
                style={activeModule === 'entanglement' ? {
                  width: '165px',
                  padding: '7px 12px',
                  borderRadius: '18px',
                  textAlign: 'center',
                  background: 'rgba(10, 18, 30, 0.72)',
                  backdropFilter: 'blur(25px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                  border: '1.5px solid rgba(0, 242, 254, 0.65)',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 22px rgba(0, 242, 254, 0.25)'
                } : {}}
              >
                <h4 style={activeModule === 'entanglement' ? { margin: '0 0 2px 0', fontSize: '11px', color: '#00f2fe' } : {}}>
                  {getTooltipContent('north').title}
                </h4>
                <p style={activeModule === 'entanglement' ? { margin: 0, fontSize: '9.5px', color: '#cbd5e1', lineHeight: '1.35' } : {}}>
                  {getTooltipContent('north').text}
                </p>
              </div>
            </Html>
          )}
        </group>
        <Html position={[0, 2.42, 0]} center style={{ pointerEvents: 'none' }}>
          <MathChip tex={String.raw`\lvert 0\rangle`} tone="zero" small />
        </Html>

        <group position={[0, -2.1, 0]} ref={southPoleRef} onPointerOver={(e) => { e.stopPropagation(); setHoveredState('south'); if (onDomainHover) onDomainHover(); }} onPointerOut={(e) => { setHoveredState(null); if (onDomainUnhover) onDomainUnhover(); }}>
          <mesh><sphereGeometry args={[0.15, 16, 16]} /><meshBasicMaterial visible={false} /></mesh>
          {/* |1>: a bead of light */}
          <mesh raycast={() => null}><sphereGeometry args={[0.06, 16, 16]} /><meshBasicMaterial color="#f093fb" toneMapped={false} /></mesh>
          <Halo radius={0.2} color="#f093fb" opacity={hoveredState === 'south' ? 0.5 : 0.25} />
          {hoveredState === 'south' && (
            <Html position={[0, -0.4, 0]} center zIndexRange={[100, 0]}>
              <div
                className="glass-tooltip purple-glow"
                style={activeModule === 'entanglement' ? {
                  width: '165px',
                  padding: '7px 12px',
                  borderRadius: '18px',
                  textAlign: 'center',
                  background: 'rgba(10, 18, 30, 0.72)',
                  backdropFilter: 'blur(25px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                  border: '1.5px solid rgba(240, 147, 251, 0.65)',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 22px rgba(240, 147, 251, 0.25)'
                } : {}}
              >
                <h4 style={activeModule === 'entanglement' ? { margin: '0 0 2px 0', fontSize: '11px', color: '#f093fb' } : {}}>
                  {getTooltipContent('south').title}
                </h4>
                <p style={activeModule === 'entanglement' ? { margin: 0, fontSize: '9.5px', color: '#cbd5e1', lineHeight: '1.35' } : {}}>
                  {getTooltipContent('south').text}
                </p>
              </div>
            </Html>
          )}
        </group>
        <Html position={[0, -2.46, 0]} center style={{ pointerEvents: 'none' }}>
          <MathChip tex={String.raw`\lvert 1\rangle`} tone="one" small />
        </Html>
      </a.group>
    </group>
  );
};

export default function BlochSphere({ activeModule, interferenceStep, interferencePhase, vanishing = false, multi = null, handoverTarget, centerOnly = false, bvq }) {
  const controlsRef = useRef();
  const light1Ref = useRef();
  const light2Ref = useRef();
  const { camera, clock } = useThree();

  const [hoveredDomain, setHoveredDomain] = useState(null);
  const [leftScale, setLeftScale] = useState(1);
  const [rightScale, setRightScale] = useState(1);
  const hoverTimeouts = useRef({});
  const rigRef = useRef();
  const leftRig = useRef();
  const [bitOn, setBitOn] = useState(true);
  const rightRig = useRef();
  const targetRig = useRef();
  const bloomRef = useRef(null);
  const bloomSet = useRef(false);
  const ctlLabel = useRef();
  const tgtLabel = useRef();
  const isMulti = activeModule === 'multi-qubit-gates'; // the hub's scene standing in for Multi Qubit Gates
  const isEnt = activeModule === 'entanglement';        // ... or for Entanglement (Alice and Bob)
  const isDec = activeModule === 'decoherence';        // ... or for Decoherence (the pure and the noisy qubit)
  const isPair = isMulti || isEnt || isDec;
  const isExp = activeModule === 'exponential';        // ... or for Exponential State Space (the lone qubit zooms in)
  const isRig = isPair || isExp;                       // the rig takes the module's size when zoomed
  const isBvq = activeModule === 'bit-vs-qubit';       // Classical Bit vs Qubit: its own glass models, a little smaller and higher
  // Leaving Classical Bit vs Qubit, the scene's usual bit and qubit grow back in where its models were.
  const prevModule = useRef(activeModule);
  const growBack = prevModule.current === 'bit-vs-qubit' && !isBvq;
  useEffect(() => { prevModule.current = activeModule; }, [activeModule]);
  const pairRest = isEnt ? ENT : isDec ? DEC : MQG;       // where the module keeps its pair
  const zoomRest = isExp ? EXP : pairRest;                 // ... or its lone qubit
  const entX0 = handoff.entPairX || ENT.pairX;
  const targetX = useRef(multi === 'zoom' ? (isEnt ? entX0 : pairRest.pairX) : multi === 'split' ? 2.4 : 0);
  const targetY = useRef(multi === 'zoom' ? pairRest.y : 0);
  const targetS = useRef(multi === 'zoom' ? pairRest.scale : 1.2);
  const [targetOn, setTargetOn] = useState(multi === 'split' || multi === 'zoom');
  // The pair's poses: 'center' (one qubit, hub size), 'split' (two, hub size), 'zoom' (two, the
  // module's size and places). Positions are in the rig's units: spheres touch at 2.4 (hub) / 2 (module).
  // (The zoomed places and sizes are the modules' own: REST in handoff.js.)
  const mz = isRig && multi === 'zoom';
  const mSplit = isPair && (multi === 'split' || multi === 'zoom');
  const zoomY = zoomRest.y;              // the pair's height in the zoomed pose (rig units)
  const zoomS = zoomRest.scale / 1.2;    // the first qubit's scale there (relative to its 1.2)
  const zoomT = pairRest.scale;          // the second qubit's scale there
  const settleCam = useRef(0);
  const centerD0 = useRef(null);
  // Entanglement lights its pair from a little higher; the lights glide there as the pair zooms in
  // (and back as it zooms out). They start where the scene was handing over.
  const lightStart = useMemo(() => (isEnt && multi === 'zoom' ? _LIGHTS_ENT : isExp && multi === 'zoom' ? _LIGHTS_EXP : isDec && multi === 'zoom' ? _LIGHTS_DEC : _LIGHTS_HUB), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lightInit = useMemo(() => (isExp && multi === 'zoom' ? _EXP_LIGHT : isDec && multi === 'zoom' ? _DEC_LIGHT : _HUB_LIGHT), []); // eslint-disable-line react-hooks/exhaustive-deps
  const ambRef = useRef();
  // Closing Decoherence: the pair takes the scene's arrows over as they were (not the opening's start state).
  const decClosing = useRef(isDec && multi === 'zoom').current;
  // The pair's arrows, as world directions: held still while the pair moves (from wherever the lone qubit's
  // arrow was when it was clicked; on a close, from where the module's were).
  const vecOut = useRef(null);
  const decDir = useRef({ a: new THREE.Vector3(0, 1, 0), b: new THREE.Vector3(0, 1, 0), closed: false });
  // The same arrows as seen from the camera: the hub's camera slowly orbits and then settles as the pair moves,
  // so the arrows are held still on screen (not in the world), whatever the camera does.
  const decView = useRef({ a: new THREE.Vector3(0, 1, 0), b: new THREE.Vector3(0, 1, 0) });
  const wasDec = useRef(false);
  if (decClosing && !decDir.current.closed) {
    // (at the first render, so the spheres' first frame already has the module's arrows)
    decDir.current.closed = true;
    decDir.current.a.copy(_UPV).applyQuaternion(handoff.decQ.pure);
    decDir.current.b.copy(_UPV).applyQuaternion(handoff.decQ.noisy);
    _tmpQ2.copy(camera.quaternion).invert();
    decView.current.a.copy(decDir.current.a).applyQuaternion(_tmpQ2);
    decView.current.b.copy(decDir.current.b).applyQuaternion(_tmpQ2);
  }
  if (isDec) wasDec.current = true;
  useEffect(() => { if (isDec && !decClosing) { arrowGrow.p = 0; arrowGrow.target = 1; } }, [isDec]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    // First paint at the right size (no growth on a direct load).
    const rig = rigRef.current;
    const zoomed = isRig && multi === 'zoom';
    if (rig) {
      rig.scale.setScalar(!activeModule ? 0.7 : isRig ? (zoomed ? 1 : 0.7) : isBvq ? BVQ_SCALE : 1);
      rig.position.y = !activeModule ? -0.8 : isMulti ? (zoomed ? -0.5 : -0.8) : isEnt || isExp || isDec ? (zoomed ? 0 : -0.8) : activeModule === 'gates' ? -0.5 : isBvq ? BVQ_Y : 0;
    }
    const solo = activeModule === 'interference' || isRig || centerOnly;
    if (leftRig.current) leftRig.current.scale.setScalar(solo ? 0.0001 : 1);
    if (solo) setBitOn(false);
    if (rightRig.current) {
      rightRig.current.position.x = isPair ? (zoomed ? -(isEnt ? entX0 : pairRest.pairX) : multi === 'split' ? -2.4 : 0) : isExp ? 0 : solo ? 0 : 4.2;
      rightRig.current.position.y = zoomed ? zoomY : 0;
      rightRig.current.scale.setScalar(zoomed ? zoomS : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeouts = hoverTimeouts.current;
    return () => {
      Object.values(timeouts).forEach(t => clearTimeout(t));
    };
  }, []);

  // Opening a module: a first load starts at the module's view; moving
  // between the modules of this scene eases the camera there.
  useEffect(() => {
    if (activeModule !== 'interference') setBitOn(true);
  }, [activeModule]);
  useEffect(() => { if (mSplit) setTargetOn(true); }, [mSplit]);
  const camReady = useRef(false);
  useEffect(() => {
    const first = !camReady.current;
    camReady.current = true;
    if (!activeModule || !controlsRef.current || !camera) return;
    if (first && (activeModule === 'gates' || activeModule === 'multi-qubit-gates' || activeModule === 'interference' || activeModule === 'entanglement' || activeModule === 'exponential' || activeModule === 'decoherence')) {
      // Standing in for a module's scene: the camera is where that module left it.
    } else if (first) {
      camera.position.set(0, 0, 13);
      camera.rotation.set(0, 0, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    } else {
      settleCam.current = 1.6;
    }
  }, [activeModule, camera]);

  const handleHoverDomain = (domain) => {
    if (hoverTimeouts.current[domain]) clearTimeout(hoverTimeouts.current[domain]);
    setHoveredDomain(domain);
  };

  const handleUnhoverDomain = (domain) => {
    hoverTimeouts.current[domain] = setTimeout(() => {
      setHoveredDomain((prev) => (prev === domain ? null : prev));
    }, 50);
  };

  const handleWheelLeft = (e) => {
    e.stopPropagation();
    if (hoveredDomain === 'left') {
      setLeftScale(s => Math.min(Math.max(s - e.deltaY * 0.001, 0.5), 2.0));
    }
  };

  const handleWheelRight = (e) => {
    e.stopPropagation();
    if (hoveredDomain === 'right') {
      setRightScale(s => Math.min(Math.max(s - e.deltaY * 0.001, 0.5), 2.0));
    }
  };

  useFrame((state, delta) => {
    // Follow the lone qubit's arrow (world direction) until the flow starts; then hold it.
    if (!isDec && vecOut.current) {
      vecOut.current.getWorldQuaternion(_tmpQ);
      decDir.current.a.copy(_UPV).applyQuaternion(_tmpQ);
      decDir.current.b.copy(decDir.current.a);
      _tmpQ2.copy(state.camera.quaternion).invert();
      decView.current.a.copy(decDir.current.a).applyQuaternion(_tmpQ2);
      decView.current.b.copy(decView.current.a);
    }
    // Decoherence's view is driven here, with the very glide the pair uses (not by a separate tween), so the
    // camera and the models arrive together and the hand-over finds them exactly where the module has them.
    if (isDec && controlsRef.current) {
      const goalDec = mz ? (decClosing ? null : 'module') : (decClosing && (multi === 'split' || multi === 'merge') ? 'hub' : null);
      if (goalDec) {
        const kc = 1 - Math.exp(-GLIDE * Math.min(delta, 0.1));
        const c = controlsRef.current;
        c.object.position.lerp(goalDec === 'module' ? _DEC_CAM : _HUB_CAM, kc);
        c.target.lerp(goalDec === 'module' ? _DEC_LOOK : _ORIGIN_BS, kc);
        c.update();
        settleCam.current = 0;
      }
    }
    if (isDec) {
      const dd = decDir.current;
      dd.a.copy(decView.current.a).applyQuaternion(state.camera.quaternion);
      dd.b.copy(decView.current.b).applyQuaternion(state.camera.quaternion);
      handoff.decStart.pure.copy(dd.a);
      handoff.decStart.noisy.copy(dd.b);
      // The arrows grow slowly before the pair splits and zooms; on a close they shrink back once it has zoomed out.
      const ak = 1 - Math.exp(-GLIDE * (2.2 / 2.6) * Math.min(delta, 0.1));
      const goal = decClosing && (multi === 'split' || multi === 'merge') ? 0 : 1;
      arrowGrow.p += (goal - arrowGrow.p) * ak;
    }

    // The lone qubit's depth at the moment it starts coming to the middle (before it has
    // moved at all this frame): the size it will hold is measured against this.
    if (centerOnly && centerD0.current === null && rightRig.current) {
      rightRig.current.getWorldPosition(_tmpV);
      state.camera.updateMatrixWorld();
      _tmpM.copy(state.camera.matrixWorld).invert();
      centerD0.current = -_tmpV.applyMatrix4(_tmpM).z;
    }

    // ── Hub <-> module: the two bits stay and grow to the module's size ──
    if (rigRef.current) {
      const rig = rigRef.current;
      const k = 1 - Math.exp(-(vanishing ? 7 : GLIDE * (2.5 / 2.6)) * Math.min(delta, 0.1));
      const ts = vanishing ? 0.0001 : !activeModule ? 0.7 : isRig ? (mz ? 1 : 0.7) : isBvq ? BVQ_SCALE : 1;
      const ty = !activeModule ? -0.8 : isMulti ? (mz ? -0.5 : -0.8) : isEnt || isExp || isDec ? (mz ? 0 : -0.8) : activeModule === 'gates' ? -0.5 : isBvq ? BVQ_Y : 0;
      rig.scale.setScalar(rig.scale.x + (ts - rig.scale.x) * k);
      rig.position.y += (ty - rig.position.y) * k;
    }
    // Superposition is the qubit alone: the classical bit shrinks away and the qubit slides to the middle.
    {
      const solo = activeModule === 'interference' || isRig || centerOnly;
      const k = 1 - Math.exp(-(centerOnly ? 7 : solo ? 4.2 : 2.5) * Math.min(delta, 0.1));
      const l = leftRig.current;
      if (l) {
        const s = Math.max(0.0001, l.scale.x + ((solo ? 0 : 1) - l.scale.x) * k);
        l.scale.setScalar(s);
        const host = state.gl.domElement.parentElement;
        if (host) host.style.setProperty('--bit-fade', String(Math.min(1, Math.max(0, (s - 0.1) / 0.4))));
        if (solo && s < 0.06) setBitOn(false);
      }
      const r = rightRig.current;
      const km = 1 - Math.exp(-GLIDE * Math.min(delta, 0.1)); // the move / split / zoom glide
      // Each module's glow, eased in with the move (set outright on the first frame).
      const bloom = bloomRef.current;
      if (bloom) {
        const th = isExp ? 0.25 : isDec ? 0.16 : 0.3;
        const it = activeModule === 'gates' || activeModule === 'multi-qubit-gates' ? 0.4 : isEnt ? 0.45 : isExp || isDec ? 0.65 : 0.6;
        const kb = bloomSet.current ? km : 1;
        bloomSet.current = true;
        bloom.intensity += (it - bloom.intensity) * kb;
        bloom.luminanceMaterial.threshold += (th - bloom.luminanceMaterial.threshold) * kb;
      }
      const pairX = mz ? (isEnt ? (handoff.entPairX || ENT.pairX) : pairRest.pairX) : 2.4; // half the gap between the pair
      if (isEnt && !mz) handoff.entPairX = ENT.pairX; // a fresh open starts from the module's default spacing
      const lg = isEnt && mz ? _LIGHTS_ENT : isExp && mz ? _LIGHTS_EXP : isDec && mz ? _LIGHTS_DEC : _LIGHTS_HUB;
      if (light1Ref.current) light1Ref.current.position.lerp(_tmpL.set(...lg[0]), km);
      if (light2Ref.current) light2Ref.current.position.lerp(_tmpL.set(...lg[1]), km);
      if (isExp || isDec) {
        // Through the whole move the lights glide between the hub's and the module's, so nothing jumps at the hand-over.
        const lt = mz ? (isDec ? _DEC_LIGHT : _EXP_LIGHT) : _HUB_LIGHT;
        const l1 = light1Ref.current, l2 = light2Ref.current;
        if (ambRef.current) ambRef.current.intensity += (lt.amb - ambRef.current.intensity) * km;
        if (l1) { l1.color.lerp(lt.c1, km); l1.intensity += (lt.i1 - l1.intensity) * km; l1.distance += (lt.dist - l1.distance) * km; }
        if (l2) { l2.color.lerp(lt.c2, km); l2.intensity += (lt.i2 - l2.intensity) * km; l2.distance += (lt.dist - l2.distance) * km; }
      }
      if (r) {
        const goalX = isPair ? (mSplit ? -pairX : 0) : solo ? 0 : 4.2;
        r.position.x += (goalX - r.position.x) * (isRig ? km : k);
        // (Exponential's qubit floats a little in its own scene; the same bob here keeps the hand-over exact.)
        const goalY = isExp && mz ? EXP.y + Math.sin(state.clock.getElapsedTime() * 1.2) * 0.06 : mz ? zoomY : 0;
        r.position.y += (goalY - r.position.y) * km;
        r.scale.setScalar(r.scale.x + ((mz ? zoomS : 1) - r.scale.x) * km);
      }
      // The second qubit of the pair splits off the first and glides to its place.
      targetX.current += ((mSplit ? pairX : 0) - targetX.current) * km;
      targetY.current += ((mz ? zoomY : 0) - targetY.current) * km;
      targetS.current += ((mz ? zoomT : 1.2) - targetS.current) * km;
      if (targetRig.current) { targetRig.current.position.set(targetX.current, targetY.current, 0); targetRig.current.scale.setScalar(targetS.current); }
      if (r && ctlLabel.current) { ctlLabel.current.position.set(r.position.x, r.position.y, 0); ctlLabel.current.scale.setScalar(r.scale.x * 1.2); }
      if (tgtLabel.current) { tgtLabel.current.position.set(targetX.current, targetY.current, 0); tgtLabel.current.scale.setScalar(targetS.current); }
      if (targetOn && !mSplit && targetX.current < 0.04) setTargetOn(false);

    }
    // The hub's slow orbit leaves the camera anywhere; ease it back to the module's view.
    if (settleCam.current > 0 && controlsRef.current) {
      settleCam.current -= delta;
      const k = 1 - Math.exp(-4 * Math.min(delta, 0.1));
      controlsRef.current.object.position.lerp(_HUB_CAM, k);
      controlsRef.current.target.lerp(_ORIGIN_BS, k);
      controlsRef.current.update();
    }

    // The hub's camera has been slowly orbiting, so the qubit may be nearer or farther than
    // it will be once the camera settles. While it comes to the middle alone, scale it with
    // its depth from the camera (measured after the camera has moved this frame) so it holds
    // the size it had when you clicked (no shrink before the module's zoom); the module's
    // intro starts from that same size.
    if (centerOnly && rightRig.current) {
      const r = rightRig.current;
      r.getWorldPosition(_tmpV);
      state.camera.updateMatrixWorld();
      _tmpM.copy(state.camera.matrixWorld).invert();
      const d = -_tmpV.applyMatrix4(_tmpM).z; // depth along the view axis
      if (centerD0.current === null) centerD0.current = d;
      const sc = Math.min(2, Math.max(0.5, d / centerD0.current));
      r.scale.setScalar(sc);
      handoff.qubitScale = sc;
    }

    if (light1Ref.current && !isExp && !isDec) light1Ref.current.intensity = THREE.MathUtils.lerp(light1Ref.current.intensity, 8, 0.05);
  });

  return (
    <>
      <QualityComposer disableNormalPass>
        {/* Fixed props: a new threshold or intensity would rebuild the effect and recompile its
            shaders on the spot (the very frame a module starts opening). bloomGlow sets them. */}
        <Bloom ref={bloomRef} luminanceThreshold={0.3} mipmapBlur intensity={0.6} />
      </QualityComposer>
      <ambientLight ref={ambRef} intensity={lightInit.amb} />
      <pointLight ref={light1Ref} position={lightStart[0]} color={lightInit.c1} intensity={lightInit.i1} distance={lightInit.dist} />
      <pointLight ref={light2Ref} position={lightStart[1]} color={lightInit.c2} intensity={lightInit.i2} distance={lightInit.dist} />

      {activeModule !== 'interference' && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={handoverTarget || [0, 0, 0]}
          enabled={hoveredDomain === null}
          enableZoom={true}
          enablePan={false}
          minDistance={5}
          maxDistance={20}
          autoRotate={!activeModule && !centerOnly}
          autoRotateSpeed={0.5}
        />
      )}


      <group ref={rigRef}>
        <group ref={leftRig} position={[-4.2, 0, 0]} onWheel={handleWheelLeft}>

        <mesh position={[0, 0, -2.5]} onPointerOver={(e) => { e.stopPropagation(); handleHoverDomain('left'); }} onPointerOut={() => handleUnhoverDomain('left')} visible={false}>
          <planeGeometry args={[6, 6]} />
        </mesh>

        <PresentationControls global={false} cursor={true} snap={true} speed={2.5} polar={[-Math.PI / 3, Math.PI / 3]}>
          <group scale={leftScale}>
            {!bitOn ? null : isBvq ? (
              <GrowIn>
                <group scale={1.1}>
                  <PremiumBit value={bvq?.bit} onToggle={bvq?.onBitToggle} onHover={() => handleHoverDomain('left')} onUnhover={() => handleUnhoverDomain('left')} />
                </group>
              </GrowIn>
            ) : (
              <GrowIn animate={growBack}>
                <ClassicalBit position={[0, 0, 0]} scale={1.1} activeModule={activeModule} onDomainHover={() => handleHoverDomain('left')} onDomainUnhover={() => handleUnhoverDomain('left')} />
              </GrowIn>
              )}
          </group>
        </PresentationControls>
      </group>

      {activeModule === 'bit-vs-qubit' && (
        <Html position={[0, 0, 0]} center zIndexRange={[100, 0]}>
          <div className="vs-badge" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.0))',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%',
            width: '80px', height: '80px', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)',
            animation: 'pulseVS 3s infinite alternate, moduleFade 0.7s ease-out 0.5s both'
          }}>
            <span style={{ fontSize: '32px', fontWeight: '900', background: 'linear-gradient(to right, #00f2fe, #f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Inter', sans-serif" }}>VS</span>
          </div>
          <style>
            {`
              @keyframes pulseVS {
                0% { box-shadow: 0 0 15px 0 rgba(0, 242, 254, 0.4); transform: scale(1); }
                100% { box-shadow: 0 0 35px 0 rgba(240, 147, 251, 0.6); transform: scale(1.05); }
              }
            `}
          </style>
        </Html>
      )}

      {isPair && (
        <>
          {isMulti && (
            <group ref={ctlLabel}>
              <Html position={[0, -3.0, 0]} center>
                <div className="mq-extra" style={{ color: '#eab308', fontWeight: 'bold', fontSize: '15px', textShadow: '0 0 10px #eab30880', whiteSpace: 'nowrap', letterSpacing: '1px', opacity: multi === 'merge' ? 0 : 1, transition: 'opacity 0.35s' }}>Control</div>
              </Html>
            </group>
          )}
          {targetOn && (
            <>
              <group ref={targetRig} position={[targetX.current, targetY.current, 0]} scale={targetS.current}>
                {isEnt ? (
                  <QubitCore activeModule="entanglement" customVectorQuat={_Q_UP} showCustomVector={true} emissiveColor="#00f2fe" />
                ) : isDec ? (
                  <group scale={_DEC_UNIT_SECOND}>
                    <BlochSphereUnit posArr={[0, 0, 0]} color={CA} label="" isPure={false} noiseLevel={0} activeNoise={null} entranceRef={DEC_STATIC_ENTRANCE} posKey="noisy" step="intro" tempK={300} showLabels={false} dirOverride={decDir.current.b} />
                  </group>
                ) : (
                  <QubitCore
                    activeModule="multi-qubit-gates"
                    customVectorQuat={_Q_UP}
                    showCustomVector={true}
                    customGridColor="#0284c7"
                    customRingColor="#38bdf8"
                    emissiveColor="#0ea5e9"
                    fadeExtras
                  />
                )}
              </group>
              {isMulti && (
                <group ref={tgtLabel} position={[targetX.current, targetY.current, 0]} scale={targetS.current}>
                  <Html position={[0, -3.0, 0]} center>
                    <div className="mq-extra" style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '15px', textShadow: '0 0 10px #38bdf880', whiteSpace: 'nowrap', letterSpacing: '1px', opacity: mSplit ? 1 : 0, transition: 'opacity 0.35s' }}>Target</div>
                  </Html>
                </group>
              )}
            </>
          )}
        </>
      )}

      <group ref={rightRig} onWheel={handleWheelRight}>

        <mesh position={[0, 0, -2.5]} onPointerOver={(e) => { e.stopPropagation(); handleHoverDomain('right'); }} onPointerOut={() => handleUnhoverDomain('right')} visible={false}>
          <planeGeometry args={[6, 6]} />
        </mesh>

        <PresentationControls global={false} cursor={true} snap={true} speed={1.5} polar={[-Math.PI / 3, Math.PI / 3]}>
          <group scale={rightScale}>
            {activeModule === 'interference' ? (
              <QubitCore 
                position={[0, 0, 0]} 
                scale={1.2} 
                activeModule={activeModule} 
                interferenceStep={interferenceStep}
                interferencePhase={interferencePhase}
                onDomainHover={() => handleHoverDomain('right')} 
                onDomainUnhover={() => handleUnhoverDomain('right')} 
              />
            ) : isDec ? (
              <group scale={_DEC_UNIT_FIRST}>
                <BlochSphereUnit posArr={[0, 0, 0]} color={CT} label="" isPure={true} noiseLevel={0} activeNoise={null} entranceRef={DEC_STATIC_ENTRANCE} posKey="pure" step="intro" tempK={300} showLabels={false} dirOverride={decDir.current.a} />
              </group>
            ) : isBvq ? (
              <GrowIn>
                <group scale={1.2}>
                  <PremiumBlochSphere result={bvq?.result ?? null} onClick={bvq?.onQubitClick} onHover={() => handleHoverDomain('right')} onUnhover={() => handleUnhoverDomain('right')} />
                </group>
              </GrowIn>
            ) : (
              <GrowIn animate={growBack}>
                <QubitCore position={[0, 0, 0]} scale={1.2} activeModule={activeModule} vectorOut={vecOut} startDir={wasDec.current ? _decStartLocal.copy(decDir.current.a).applyAxisAngle(_AXIS_Y, -clock.getElapsedTime() * 0.04) : undefined} customVectorQuat={isRig || centerOnly ? _Q_UP : undefined} showCustomVector={isRig || centerOnly || undefined} emissiveColor={isMulti ? '#eab308' : isEnt || isExp ? '#00f2fe' : isDec ? '#14b8a6' : undefined} fadeExtras={isMulti} onDomainHover={() => handleHoverDomain('right')} onDomainUnhover={() => handleUnhoverDomain('right')} />
              </GrowIn>
            )}
          </group>
        </PresentationControls>
      </group>
      </group>
    </>
  );
}
