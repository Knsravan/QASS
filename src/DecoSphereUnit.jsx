// Decoherence's Bloch sphere (the pure and the noisy qubit), shared so the hub can draw the very
// same model while its lone qubit splits and zooms into the module (no change of look at the hand-over).
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { handoff } from './handoff';
import { Metal, useRimMaterial } from './PremiumBitQubit';
import { SphereLines, LightLine, Halo } from './GlassBlochParts';
import { MathChip } from './MathChip';

export const CT = '#14b8a6'; // Teal - Pure
export const CA = '#f59e0b'; // Amber - Noisy / Thermal
export const CR = '#ef4444'; // Red - Bit Flip / Mixed
export const CP = '#a855f7'; // Purple - Phase Flip
export const CB = '#38bdf8'; // Blue - Cryogenic / Cold
export const CG = '#22c55e'; // Green - Pure Purity
export const CW = '#f8fafc'; // White

// The arrows' reach: 0 is the hub qubit's shorter arrow, 1 the full one. The hub grows it before the
// pair splits and zooms; the module keeps it full (and shrinks it again as it closes).
export const arrowGrow = { p: 1, target: 1 };

export const SPHERE_R  = 2.75;
export const MODEL_Y   = 1.65;
export const PURE_POS  = [-5.8, MODEL_Y, 0];
export const NOISY_POS = [ 5.8, MODEL_Y, 0];
const GHOST_N   = 12;

// Where the hub's pair stands in for the module's spheres (nothing is entering): fully in, no rise.
export const DEC_STATIC_ENTRANCE = { current: { pure: 1, noisy: 1, yRise: 0 } };

// ============================================================
// 3D EXPONENTIAL DECAY RIBBON (Step 5 Coherence Trail)
// ============================================================
function DecayRibbon3D({ isVisible, noiseLevel }) {
  const lineRef = useRef();
  const points = useMemo(() => {
    const pts = [];
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const angle = u * Math.PI * 4;
      const radius = SPHERE_R * Math.exp(-u * 2.2);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (1.0 - u * 2.0) * 0.6;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, []);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return geom;
  }, [points]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const t = clock.getElapsedTime();
    if (isVisible) {
      lineRef.current.rotation.y = t * 0.35;
      lineRef.current.material.opacity = 0.45 + Math.sin(t * 2.0) * 0.15;
    } else {
      lineRef.current.material.opacity = 0;
    }
  });

  return (
    <line ref={lineRef} geometry={geometry} position={[0, 0, 0]}>
      <lineBasicMaterial color={CT} transparent opacity={0} linewidth={2} />
    </line>
  );
}

// ============================================================
// BLOCH SPHERE UNIT
// ============================================================
export function BlochSphereUnit({ posArr, color, label, isPure, noiseLevel, activeNoise, noiseBurstId, entranceRef, posKey, step, tempK, showLabels = true, dirOverride = null, startDir = null }) {
  const outerRef     = useRef();
  const shellRef     = useRef();
  const rimMat = useRimMaterial(0.8);
  const vectorGrpRef = useRef();
  const ghostRefs    = useRef([]);

  // `startDir`: the module opened from the hub; the arrow starts where the hub's was and only then, once the
  // pair is in place, eases onto its orbit and starts to turn. `dirOverride`: the hub holds the arrow still.
  const phiRef   = useRef(startDir ? Math.acos(THREE.MathUtils.clamp(startDir.y, -1, 1)) : Math.PI / 2);
  const thetaRef = useRef(startDir ? Math.atan2(startDir.z, startDir.x) : (isPure ? 0.2 : 0.8));
  const bornAt   = useRef(null);
  const lenRef   = useRef(SPHERE_R);

  const activeNoiseRef = useRef(null);
  const noiseTimerRef  = useRef(0);

  const _up     = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const _target = useMemo(() => new THREE.Vector3(),         []);
  const _quat   = useMemo(() => new THREE.Quaternion(),      []);

  // Cryogenic color transition when temperature drops to 15 mK in Step 7
  const isCryo = !isPure && (tempK != null && tempK < 1.0);
  const activeUnitColor = isCryo ? CB : color;

  const ghostOffsets = useMemo(() =>
    Array.from({ length: GHOST_N }, (_, i) => ({
      ao: (i / GHOST_N) * Math.PI * 2,
      rs: 0.72 + (i % 3) * 0.12,
      ph: (i * 1.618) % (Math.PI * 2),
    })), []);

  useEffect(() => {
    if (!isPure && activeNoise) {
      activeNoiseRef.current = activeNoise;
      noiseTimerRef.current  = 0;
    }
  }, [activeNoise, noiseBurstId, isPure]);

  useFrame(({ clock }, delta) => {
    const t  = clock.getElapsedTime();
    const nl = noiseLevel;

    if (outerRef.current) {
      const sc = Math.max(0.0001, entranceRef.current[posKey] != null ? entranceRef.current[posKey] : 0);
      outerRef.current.scale.setScalar(sc);
      outerRef.current.position.x = posArr[0];
      outerRef.current.position.y = (posArr[1] != null ? posArr[1] : MODEL_Y) + (entranceRef.current.yRise != null ? entranceRef.current.yRise : 0);
      outerRef.current.position.z = posArr[2] || 0;
    }

    // Opened from the hub: hold the arrow where it is for a moment (the pair has just settled), then ease it
    // onto its orbit and let the turning build up.
    let spin = 1, easeK = 1;
    if (startDir) {
      if (bornAt.current == null) bornAt.current = t;
      const age = THREE.MathUtils.clamp((t - bornAt.current - 0.3) / 1.4, 0, 1);
      spin = age * age * (3 - 2 * age);
      easeK = age > 0 ? 1 - Math.exp(-2.2 * Math.min(delta, 0.1)) : 0;
    }
    if (isPure) {
      thetaRef.current += delta * 0.38 * spin;
      phiRef.current += (Math.PI / 2 - phiRef.current) * easeK;
    } else {
      thetaRef.current += delta * (0.38 + Math.sin(t * 1.8) * nl * 0.55) * spin;
      const phiGoal = Math.PI / 2 + Math.sin(t * 1.6) * nl * 0.65 + Math.cos(t * 2.2) * nl * 0.35;
      phiRef.current += (phiGoal - phiRef.current) * easeK;
    }

    let phiExtra = 0, thetaExtra = 0;
    if (activeNoiseRef.current && !isPure) {
      const tn    = noiseTimerRef.current;
      const decay = Math.exp(-tn * 1.2);
      if (activeNoiseRef.current === 'bitflip') {
        phiExtra = Math.sin(tn * 10) * decay * Math.PI * 0.95;
      }
      if (activeNoiseRef.current === 'phaseflip') {
        thetaExtra = Math.sin(tn * 12) * decay * Math.PI * 1.25;
      }
      if (activeNoiseRef.current === 'damping') {
        phiExtra = -Math.min(tn * 1.0, 1.4) * decay;
      }
      noiseTimerRef.current += delta;
      if (noiseTimerRef.current > 3.2) activeNoiseRef.current = null;
    }

    const targetLen = SPHERE_R * (1.0 - nl * 0.48);
    lenRef.current += (targetLen - lenRef.current) * 0.08;

    if (vectorGrpRef.current) {
      const fP = phiRef.current + phiExtra;
      const fT = thetaRef.current + thetaExtra;
      if (dirOverride) _target.copy(dirOverride);
      else _target.set(Math.sin(fP) * Math.cos(fT), Math.cos(fP), Math.sin(fP) * Math.sin(fT));
      _quat.setFromUnitVectors(_up, _target);
      vectorGrpRef.current.quaternion.copy(_quat);
      // (From the hub's thinner, shorter arrow to the full one.)
      const reach = lenRef.current * (0.75 + 0.25 * arrowGrow.p), girth = lenRef.current * (0.4 + 0.6 * arrowGrow.p);
      vectorGrpRef.current.scale.set(girth, reach, girth);
      if (!dirOverride) handoff.decQ[posKey].copy(_quat); // (the hub's copy, holding the arrow still, must not overwrite the module's)
    }

    if (shellRef.current && !isPure) {
      const activePulse = activeNoiseRef.current ? 0.35 : 0.0;
      shellRef.current.material.opacity = 0.12 + Math.sin(t * (3.0 + nl * 8.0)) * nl * 0.22 + activePulse;
    }

    if (!isPure && nl > 0.04) {
      const fP = phiRef.current + phiExtra;
      const fT = thetaRef.current + thetaExtra;
      ghostRefs.current.forEach((ref, i) => {
        if (!ref) return;
        const { ao, rs, ph } = ghostOffsets[i];
        const spr = nl * 0.75 + (activeNoiseRef.current ? 0.35 : 0);
        const gP  = fP + Math.sin(t * 1.2  + ph) * spr;
        const gT  = fT + Math.cos(t * 0.95 + ph * 1.4 + ao) * spr;
        const gL  = lenRef.current * rs;
        ref.position.set(Math.sin(gP) * Math.cos(gT) * gL, Math.cos(gP) * gL, Math.sin(gP) * Math.sin(gT) * gL);
        if (ref.material) ref.material.opacity = nl * 0.42 * rs + (activeNoiseRef.current ? 0.3 : 0);
      });
    } else if (!isPure) {
      ghostRefs.current.forEach(r => { if (r && r.material) r.material.opacity = 0; });
    }
  });

  return (
    <group ref={outerRef}>
      {/* A glass shell (it flickers with the noise on the noisy qubit) and its glowing rim */}
      <mesh ref={shellRef} raycast={() => null}>
        <sphereGeometry args={[SPHERE_R, 64, 40]} />
        <meshPhysicalMaterial color={activeUnitColor} transparent opacity={0.12} roughness={0.08} clearcoat={1} clearcoatRoughness={0.15} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null}>
        <sphereGeometry args={[SPHERE_R * 1.005, 64, 40]} />
        <primitive object={rimMat} attach="material" />
      </mesh>

      {/* Fine lines of latitude and longitude, in the qubit's colour */}
      <SphereLines radius={SPHERE_R} color={activeUnitColor} equatorColor={activeUnitColor} opacity={0.2} equatorOpacity={0.5} />

      {/* The |0>–|1> axis and the horizontal one: lines of light */}
      <LightLine length={SPHERE_R * 2.25} opacity={0.35} />
      <LightLine length={SPHERE_R * 2.25} opacity={0.14} rotation={[0, 0, Math.PI / 2]} />

      {showLabels && (
        <>
      {/* Top Status Chip (Above 3D Model) */}
      <Html position={[0, SPHERE_R + 0.88, 0]} center style={{ pointerEvents: 'none' }}>
        <div data-jelly style={{ '--j': 1,
          background: activeUnitColor + '1a', border: '1.5px solid ' + activeUnitColor + '55',
          borderRadius: '16px', padding: '5px 16px',
          fontSize: '11px', fontWeight: '800', color: activeUnitColor,
          fontFamily: "'Inter', sans-serif", letterSpacing: '1.8px',
          whiteSpace: 'nowrap', textTransform: 'uppercase',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px ' + activeUnitColor + '22',
          transition: 'all 0.4s ease',
        }}>
          {isCryo ? 'CRYOGENIC QUBIT (15 mK)' : label}
        </div>
      </Html>

      {/* |0⟩ Pole Label */}
      <Html position={[0, SPHERE_R + 0.36, 0]} center style={{ pointerEvents: 'none' }}>
        <span data-jelly style={{ '--j': 1, display: 'inline-block' }}><MathChip tex={String.raw`\lvert 0\rangle`} tone="zero" small /></span>
      </Html>
      {/* |1⟩ Pole Label */}
      <Html position={[0, -SPHERE_R - 0.38, 0]} center style={{ pointerEvents: 'none' }}>
        <span data-jelly style={{ '--j': 1, display: 'inline-block' }}><MathChip tex={String.raw`\lvert 1\rangle`} tone="one" small /></span>
      </Html>
        </>
      )}

      {/* 3D Coherence Decay Ribbon (Step 5 on Noisy Qubit) */}
      {!isPure && <DecayRibbon3D isVisible={step === 'coherence_time'} noiseLevel={noiseLevel} />}

      {/* State Vector Arrow (Shaft + Pointed Cone Arrowhead) */}
      <group ref={vectorGrpRef}>
        {/* A steel shaft ending in a glowing pearl (the group is scaled to the arrow's reach) */}
        <mesh position={[0, 0.44, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.015, 0.015, 0.88, 16]} />
          <Metal />
        </mesh>
        <mesh position={[0, 0.94, 0]} raycast={() => null}>
          <sphereGeometry args={[0.062, 32, 20]} />
          <meshPhysicalMaterial color={activeUnitColor} emissive={activeUnitColor} emissiveIntensity={0.7} roughness={0.12} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
        <Halo radius={0.11} color={activeUnitColor} opacity={0.18} position={[0, 0.94, 0]} />
      </group>

      {/* Ghost Tips (Noisy Sphere Only) */}
      {!isPure && ghostOffsets.map((_, i) => (
        <mesh key={i} ref={el => { ghostRefs.current[i] = el; }}>
          <coneGeometry args={[0.10, 0.24, 10]} />
          <meshStandardMaterial color={CA} emissive={CA} emissiveIntensity={1.8} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

