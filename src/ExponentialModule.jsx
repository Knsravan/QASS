// ==========================================================
// EXPONENTIAL STATE SPACE MODULE
// High-tech 3D multi-qubit processor & Hilbert space galaxy
// Organic gliding transitions, elastic quantum conduits, & fluid camera dolly
// ==========================================================

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { InlineMath } from 'react-katex';

import { QubitCore } from './BlochSphere';
import { useExponentialAudio } from './useExponentialAudio';
import CameraShifter from './CameraShifter';
import { QuantumNavButtons } from './QuantumNavButtons';
import { SCENE_GL } from './sceneGl';
import GlassSlider from './GlassSlider';

// ==========================================
// HELPER CONSTANTS & QUATERNIONS
// ==========================================
const quatGround = new THREE.Quaternion().identity();
const quatEquator = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.5);
const MAX_QUBITS = 5;

// ==========================================
// 1. INDIVIDUAL ANIMATED QUBIT CORE
// ==========================================
function AnimatedQubitItem({
  index,
  qubitCount,
  isSuperposed,
  theme
}) {
  const groupRef = useRef();
  const hasInitializedRef = useRef(false);
  const isActive = index < qubitCount;

  // Calculate target position and scale based on active qubit count
  const { targetX, targetScale } = useMemo(() => {
    if (!isActive) {
      return { targetX: 0, targetScale: 0.0001 };
    }
    if (qubitCount === 1) return { targetX: 0, targetScale: 1.15 };
    if (qubitCount === 2) return { targetX: index === 0 ? -3.4 : 3.4, targetScale: 1.1 };
    if (qubitCount === 3) {
      const xs = [-4.2, 0, 4.2];
      return { targetX: xs[index], targetScale: 0.95 };
    }
    if (qubitCount === 4) {
      const xs = [-5.1, -1.7, 1.7, 5.1];
      return { targetX: xs[index], targetScale: 0.78 };
    }
    // qubitCount === 5 (Generous spacing and non-touching spheres)
    const xs = [-6.0, -3.0, 0, 3.0, 6.0];
    return { targetX: xs[index], targetScale: 0.65 };
  }, [index, qubitCount, isActive]);

  const currentQuat = isSuperposed ? quatEquator : quatGround;

  // Continuous smooth gliding interpolation; the first frame snaps straight
  // to the resting pose so inactive qubits never flash at full size
  useFrame((_, delta) => {
    if (groupRef.current) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        groupRef.current.position.x = targetX;
        groupRef.current.scale.setScalar(targetScale);
      } else {
        groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetX, 8, delta);
        const s = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 8, delta);
        groupRef.current.scale.set(s, s, s);
      }
      groupRef.current.visible = groupRef.current.scale.x > 0.05;
    }
  });


  return (
    <group ref={groupRef}>
      <QubitCore
        position={[0, 0, 0]}
        scale={1.0}
        theme={theme}
        activeModule="exponential"
        superpositionStep={isSuperposed ? 2 : 0}
        customVectorQuat={currentQuat}
        emissiveColor={isSuperposed ? '#c084fc' : '#00f2fe'}
      />

      {/* 3D Floating Name Badge */}
      <Html position={[0, 2.25, 0]} center zIndexRange={[60, 0]}>
        <div style={{
          padding: '4px 12px',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          border: `1.5px solid ${isSuperposed ? '#c084fc80' : '#00f2fe80'}`,
          boxShadow: `0 0 15px ${isSuperposed ? '#c084fc40' : '#00f2fe40'}`,
          color: '#fff',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          userSelect: 'none',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          opacity: isActive ? 1 : 0,
          pointerEvents: 'none'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isSuperposed ? '#c084fc' : '#00f2fe',
            display: 'inline-block',
            boxShadow: `0 0 6px ${isSuperposed ? '#c084fc' : '#00f2fe'}`
          }} />
          <span>Qubit {index} (<InlineMath math={String.raw`q_{${index}}`} />)</span>
        </div>
      </Html>
    </group>
  );
}

// ==========================================
// 2. DYNAMIC ELASTIC QUANTUM CONDUIT (WITH PHOTON STREAM)
// ==========================================
function AnimatedConduit({ index, qubitCount, isSuperposed }) {
  const meshCoreRef = useRef();
  const meshGlowRef = useRef();
  const particleGroupRef = useRef();
  const hasInitializedRef = useRef(false);
  const isActive = index < qubitCount - 1;

  // Calculate target positions of endpoints
  const { targetMidX, targetLength, targetOpacity } = useMemo(() => {
    if (!isActive) {
      return { targetMidX: 0, targetLength: 0.001, targetOpacity: 0 };
    }
    let xs = [];
    if (qubitCount === 2) xs = [-3.4, 3.4];
    else if (qubitCount === 3) xs = [-4.2, 0, 4.2];
    else if (qubitCount === 4) xs = [-5.1, -1.7, 1.7, 5.1];
    else if (qubitCount === 5) xs = [-6.0, -3.0, 0, 3.0, 6.0];

    const xA = xs[index];
    const xB = xs[index + 1];
    const midX = (xA + xB) / 2;
    const len = Math.max(0.2, Math.abs(xB - xA) - 1.4);

    return { targetMidX: midX, targetLength: len, targetOpacity: 1 };
  }, [index, qubitCount, isActive]);

  // Photon Stream particles
  const photonCount = 4;
  const photons = useMemo(() => {
    return Array.from({ length: photonCount }, (_, i) => ({
      id: i,
      offset: i / photonCount,
      speed: 0.6 + i * 0.1
    }));
  }, [photonCount]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    if (meshCoreRef.current && meshGlowRef.current) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        meshCoreRef.current.position.x = targetMidX;
        meshCoreRef.current.scale.set(1, targetLength, 1);
        meshGlowRef.current.scale.set(1, targetLength, 1);
        meshCoreRef.current.material.opacity = targetOpacity * 0.85;
        meshGlowRef.current.material.opacity = targetOpacity * 0.35;
      } else {
        meshCoreRef.current.position.x = THREE.MathUtils.damp(meshCoreRef.current.position.x, targetMidX, 8, delta);

        const curLen = THREE.MathUtils.damp(meshCoreRef.current.scale.y, targetLength, 8, delta);
        meshCoreRef.current.scale.set(1, curLen, 1);
        meshGlowRef.current.scale.set(1, curLen, 1);

        meshCoreRef.current.material.opacity = THREE.MathUtils.damp(meshCoreRef.current.material.opacity, targetOpacity * 0.85, 8, delta);
        meshGlowRef.current.material.opacity = THREE.MathUtils.damp(meshGlowRef.current.material.opacity, targetOpacity * 0.35, 8, delta);
      }
      meshGlowRef.current.position.x = meshCoreRef.current.position.x;
    }

    if (particleGroupRef.current && isActive) {
      particleGroupRef.current.position.x = meshCoreRef.current.position.x;
      particleGroupRef.current.children.forEach((pMesh, i) => {
        const pData = photons[i];
        const progress = (time * pData.speed + pData.offset) % 1.0;
        const curLen = meshCoreRef.current.scale.y;
        pMesh.position.x = (progress - 0.5) * curLen;
        pMesh.position.y = Math.sin(time * 6 + i) * 0.04;
        pMesh.position.z = Math.cos(time * 6 + i) * 0.04;
      });
    }
  });

  return (
    <group>
      {/* Central Laser Beam (position/opacity owned by the useFrame damp glide) */}
      <mesh ref={meshCoreRef} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Outer Glowing Energy Sheath */}
      <mesh ref={meshGlowRef} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 1, 8]} />
        <meshStandardMaterial
          color={isSuperposed ? '#c084fc' : '#00f2fe'}
          emissive={isSuperposed ? '#c084fc' : '#00f2fe'}
          emissiveIntensity={3.2}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Spiraling Photon Particle Stream */}
      <group ref={particleGroupRef} visible={isActive}>
        {photons.map((p) => (
          <mesh key={`photon-${p.id}`}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ==========================================
// 3. 3D MULTI-QUBIT PROCESSOR ARRAY CONTAINER
// ==========================================
function MultiQubitProcessor({ qubitCount, isSuperposed, theme }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.6 + Math.sin(state.clock.getElapsedTime() * 1.2) * 0.06;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0]}>
      {/* 5 Seamless Animated Qubit Instances */}
      {Array.from({ length: MAX_QUBITS }).map((_, i) => (
        <AnimatedQubitItem
          key={`qubit-item-${i}`}
          index={i}
          qubitCount={qubitCount}
          isSuperposed={isSuperposed}
          theme={theme}
        />
      ))}

      {/* 4 Animated Quantum Laser Conduits */}
      {Array.from({ length: MAX_QUBITS - 1 }).map((_, i) => (
        <AnimatedConduit
          key={`conduit-${i}`}
          index={i}
          qubitCount={qubitCount}
          isSuperposed={isSuperposed}
        />
      ))}
    </group>
  );
}

// ==========================================
// 4A. COSMIC STAR DUST ACCRETION DISK (SYNCHRONIZED TO ORBITAL RING)
// ==========================================
function CosmicStarDustDisk({ cosmicMilestone }) {
  const pointsRef = useRef();
  const is300 = cosmicMilestone === 300;
  const count = is300 ? 2200 : 900;

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const c1 = new THREE.Color(is300 ? '#f43f5e' : '#00f0ff');
    const c2 = new THREE.Color(is300 ? '#fbbf24' : '#c084fc');
    const c3 = new THREE.Color(is300 ? '#ec4899' : '#ffffff');

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Coordinates normalized directly to the base torus ring (r = 4.5)
      const radialOffset = (Math.random() - 0.5) * (is300 ? 0.35 : 0.2);
      const r = 4.5 + radialOffset;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (Math.random() - 0.5) * (is300 ? 0.22 : 0.12);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const mixVal = Math.random();
      const color = mixVal < 0.45 ? c1 : mixVal < 0.8 ? c2 : c3;

      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    return { positions: pos, colors: col };
  }, [is300, count]);

  // Continuously rotate and stream the stardust particles along the ring
  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * (is300 ? 0.32 : 0.22);
    }
  });

  return (
    <points ref={pointsRef} key={`dust-${cosmicMilestone}`}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={is300 ? 0.055 : 0.045}
        vertexColors
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// ==========================================
// 4. 3D QUANTUM STATE CONSTELLATION (HILBERT SPACE ORBIT & COSMIC ACCRETION DISK)
// ==========================================
function StateSpaceConstellation({
  stage,
  qubitCount,
  isSuperposed,
  targetStateIndex = 2,
  isInterferenceActive = false,
  cosmicMilestone = 50
}) {
  const groupRef = useRef();
  const torusMeshRef = useRef();
  const curRadiusRef = useRef(4.5);
  const numStates = Math.pow(2, qubitCount);

  // Slow majestic rotation of the Hilbert Space constellation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
    const targetRadius =
      stage === 3 ? (cosmicMilestone === 300 ? 14.5 : 8.6) :
      qubitCount === 1 ? 4.5 :
      qubitCount === 2 ? 5.8 :
      qubitCount === 3 ? 6.8 :
      qubitCount === 4 ? 8.0 : 9.8;

    curRadiusRef.current = THREE.MathUtils.damp(curRadiusRef.current, targetRadius, 6, delta);

    if (torusMeshRef.current) {
      const s = curRadiusRef.current / 4.5;
      torusMeshRef.current.scale.set(s, s, s);
    }
  });

  // Generate basis state nodes
  const stateNodes = useMemo(() => {
    if (stage === 3) return [];
    const nodes = [];
    const maxVisibleNodes = Math.min(numStates, 64);
    const r =
      qubitCount === 1 ? 4.5 :
      qubitCount === 2 ? 5.8 :
      qubitCount === 3 ? 6.8 :
      qubitCount === 4 ? 8.0 : 9.8;

    for (let i = 0; i < maxVisibleNodes; i++) {
      const angle = (i / maxVisibleNodes) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (i % 2 === 0 ? 0.75 : -0.75) * (qubitCount <= 3 ? 1 : qubitCount === 4 ? 0.6 : 0.45);
      const binaryString = i.toString(2).padStart(qubitCount, '0');

      nodes.push({
        index: i,
        binaryString,
        pos: [x, y, z],
        angle
      });
    }
    return nodes;
  }, [stage, qubitCount, numStates]);

  // Circulating Orbital Photons for live energy flux along the ring
  const ringPhotons = useMemo(() => [
    { id: 0, offset: 0, speed: 0.8 },
    { id: 1, offset: Math.PI * 0.66, speed: 0.8 },
    { id: 2, offset: Math.PI * 1.33, speed: 0.8 }
  ], []);

  const ringPhotonGroupRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ringPhotonGroupRef.current) {
      const r = curRadiusRef.current;
      ringPhotonGroupRef.current.children.forEach((pMesh, i) => {
        const p = ringPhotons[i];
        const angle = t * p.speed + p.offset;
        pMesh.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0]}>
      {/* ── REFINED RADIANT QUANTUM ORBITAL RING & SYNCHRONIZED STARDUST ── */}
      <group ref={torusMeshRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4.5, 0.028, 16, 128]} />
          <meshStandardMaterial
            color={stage === 3 ? (cosmicMilestone === 300 ? '#f43f5e' : '#c084fc') : '#c084fc'}
            emissive={stage === 3 ? (cosmicMilestone === 300 ? '#f43f5e' : '#c084fc') : '#c084fc'}
            emissiveIntensity={2.8}
            toneMapped={false}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Stage 3 Synchronized Accretion Stardust (Locked to the ring at all times) */}
        {stage === 3 && <CosmicStarDustDisk cosmicMilestone={cosmicMilestone} />}
      </group>

      {/* 3D Floating Milestone Horizon Marker */}
      {stage === 3 && (
        <Html position={[0, 3.8, 0]} center zIndexRange={[80, 0]}>
          <div style={{
            background: cosmicMilestone === 300 ? 'rgba(244, 63, 94, 0.25)' : 'rgba(0, 240, 255, 0.2)',
            backdropFilter: 'blur(12px)',
            border: `1.5px solid ${cosmicMilestone === 300 ? '#f43f5e' : '#00f0ff'}`,
            boxShadow: `0 0 20px ${cosmicMilestone === 300 ? 'rgba(244,63,94,0.5)' : 'rgba(0,240,255,0.4)'}`,
            padding: '4px 12px',
            borderRadius: '9999px',
            color: '#ffffff',
            fontFamily: "'Inter', sans-serif",
            fontSize: '11px',
            fontWeight: '800',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{cosmicMilestone === 300 ? '🌌' : '🖥️'}</span>
            <span>{cosmicMilestone === 300 ? 'Observable Universe Atom Horizon (> 10⁸⁰)' : 'Global Supercomputer RAM Ceiling (16 PB)'}</span>
          </div>
        </Html>
      )}

      {/* Circulating Orbital Photon Energy Pulses (Vibrant Glowing Cyan) */}
      {stage !== 3 && (
        <group ref={ringPhotonGroupRef}>
          {ringPhotons.map((p) => (
            <mesh key={`ring-photon-${p.id}`}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial
                color="#00f0ff"
                emissive="#00f0ff"
                emissiveIntensity={3.8}
                toneMapped={false}
                transparent
                opacity={0.95}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Discrete State Nodes (Rendered for stages 1, 2, 4) */}
      {stage !== 3 && stateNodes.map((node) => {
        const isTarget = isInterferenceActive && node.index === targetStateIndex;
        const isDimmed = isInterferenceActive && !isTarget;
        const nodeColor = isTarget ? '#22c55e' : isSuperposed ? '#c084fc' : '#38bdf8';
        const emissiveIntensity = isTarget ? 5.0 : isDimmed ? 0.25 : isSuperposed ? 3.5 : 2.2;

        return (
          <group key={`state-${node.index}`} position={node.pos}>
            {/* Glowing State Orb */}
            <mesh>
              <sphereGeometry args={[isTarget ? 0.16 : qubitCount === 5 ? 0.08 : 0.11, 16, 16]} />
              <meshStandardMaterial
                color={nodeColor}
                emissive={nodeColor}
                emissiveIntensity={emissiveIntensity}
                transparent
                opacity={isDimmed ? 0.25 : 0.95}
              />
            </mesh>

            {/* Height Amplitude Line linking node to orbit plane */}
            <mesh position={[0, -node.pos[1] / 2, 0]}>
              <cylinderGeometry args={[0.01, 0.01, Math.abs(node.pos[1]), 8]} />
              <meshBasicMaterial color={nodeColor} transparent opacity={isDimmed ? 0.12 : 0.4} />
            </mesh>

            {/* Billboard KaTeX Ket Label */}
            <Html position={[0, node.pos[1] > 0 ? 0.28 : -0.28, 0]} center zIndexRange={[70, 0]}>
              <div style={{
                color: isTarget ? '#4ade80' : isDimmed ? '#64748b' : '#c084fc',
                fontFamily: "'Inter', sans-serif",
                fontSize: qubitCount <= 3 ? '11px' : qubitCount === 4 ? '9px' : '8px',
                fontWeight: '700',
                background: isTarget ? 'rgba(34, 197, 94, 0.25)' : 'rgba(10, 18, 30, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: qubitCount === 5 ? '1px 4px' : '2px 6px',
                borderRadius: '5px',
                border: `1px solid ${isTarget ? '#22c55e' : isDimmed ? 'rgba(255,255,255,0.06)' : '#a855f750'}`,
                boxShadow: isTarget ? '0 0 15px rgba(34, 197, 94, 0.6)' : 'none',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.3s ease'
              }}>
                <InlineMath math={String.raw`|${node.binaryString}\rangle`} />
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ==========================================
// 5. CINEMATIC CAMERA DRONE CONTROLLER (WITH FLUID DOLLY & STAGE 4 SWOOP)
// ==========================================
function CameraDroneController({ stage, qubitCount, cosmicMilestone = 50 }) {
  const { camera } = useThree();
  const prevStageRef = useRef(stage);
  const swoopTweenRef = useRef(null);
  const isGlidingRef = useRef(true);

  useEffect(() => {
    if (stage === 4 && prevStageRef.current !== 4) {
      // Cinematic drone camera swooping arc into fixed Stage 4 panoramic view
      camera.position.set(3.5, 5.4, 20.5);
      swoopTweenRef.current = gsap.to(camera.position, {
        x: 0,
        y: 4.2,
        z: 18.5,
        duration: 1.8,
        ease: 'power3.out'
      });
    }
    prevStageRef.current = stage;
    return () => {
      if (swoopTweenRef.current) {
        swoopTweenRef.current.kill();
        swoopTweenRef.current = null;
      }
    };
  }, [stage, camera]);

  // Re-arm the dolly only when the framing target changes; once settled,
  // OrbitControls own the camera so user orbits are not fought per-frame
  useEffect(() => {
    isGlidingRef.current = true;
  }, [stage, qubitCount, cosmicMilestone]);

  useFrame((_, delta) => {
    // Stage 4 entry is driven by the swoop tween; afterwards the camera is free
    if (stage === 4 || !isGlidingRef.current) return;

    let targetZ = 13.0 + (qubitCount - 1) * 0.9;
    let targetY = 1.4;

    if (stage === 2) {
      targetY = 2.2;
      targetZ = 13.8 + (qubitCount - 1) * 1.0;
    } else if (stage === 3) {
      if (cosmicMilestone === 300) {
        targetY = 5.6;
        targetZ = 24.5;
      } else {
        targetY = 3.6;
        targetZ = 15.8;
      }
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 4, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 4, delta);

    if (
      Math.abs(camera.position.x) < 0.05 &&
      Math.abs(camera.position.y - targetY) < 0.05 &&
      Math.abs(camera.position.z - targetZ) < 0.05
    ) {
      isGlidingRef.current = false;
    }
  });

  return null;
}

// ==========================================
// 6. 3D EXPONENTIAL SCENE
// ==========================================
function ExponentialScene({
  stage,
  qubitCount,
  isSuperposed,
  targetStateIndex,
  isInterferenceActive,
  cosmicMilestone,
  theme
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 15, 10]} intensity={2.0} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={1.5} color="#a855f7" />

      {/* Camera Drone Controller */}
      <CameraDroneController stage={stage} qubitCount={qubitCount} cosmicMilestone={cosmicMilestone} />

      {/* Orbit Controls */}
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={28}
        maxPolarAngle={Math.PI / 2 + 0.25}
        minPolarAngle={Math.PI / 6}
        rotateSpeed={0.6}
      />

      {/* 3D Multi-Qubit Processor Array (Physical Hardware) */}
      <MultiQubitProcessor
        qubitCount={qubitCount}
        isSuperposed={isSuperposed}
        theme={theme}
      />

      {/* 3D Hilbert Space Constellation (Mathematical Universe & Cosmic Galaxy) */}
      <StateSpaceConstellation
        stage={stage}
        qubitCount={qubitCount}
        isSuperposed={isSuperposed}
        targetStateIndex={targetStateIndex}
        isInterferenceActive={isInterferenceActive}
        cosmicMilestone={cosmicMilestone}
      />

      {/* Post-Processing Neon Bloom (Optimized for 60 FPS on any laptop) */}
      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom
          luminanceThreshold={0.25}
          mipmapBlur
          intensity={0.65}
        />
      </EffectComposer>
    </>
  );
}

// ==========================================
// 7. 2D INTERACTIVE OVERLAY & FROSTED GLASS HUD
// ==========================================
export default function ExponentialModule({ theme = 'dark', isSidebarOpen = true, isGlobalMuted = false }) {
  const [stage, setStage] = useState(1);
  const [qubitCount, setQubitCount] = useState(1);
  const [isSuperposed, setIsSuperposed] = useState(false);
  const [isInterferenceActive, setIsInterferenceActive] = useState(false);
  const [cosmicMilestone, setCosmicMilestone] = useState(50); // 50 or 300

  const audio = useExponentialAudio();

  const numStates = Math.pow(2, qubitCount);
  const targetStateIndex = Math.min(2, numStates - 1); // |010⟩ once the register holds 3+ qubits
  const targetStateLabel = `|${targetStateIndex.toString(2).padStart(qubitCount, '0')}⟩`;

  // Interference amplification only belongs to the Stage 4 lesson
  useEffect(() => {
    if (stage !== 4) setIsInterferenceActive(false);
  }, [stage]);

  // Helper formatting for large numbers
  const formatStates = (count) => {
    if (count < 1000) return count.toString();
    if (count === 1024) return '1,024';
    if (count === 65536) return '65,536';
    if (count >= 1e9) return `~${(count / 1e9).toFixed(1)} Billion`;
    return count.toLocaleString();
  };

  // Accurate dynamic RAM estimation for state vector simulation (16 bytes per complex amplitude)
  const getRAMEstimate = (n) => {
    const bytes = Math.pow(2, n) * 16;
    if (bytes < 1024) return `${bytes} Bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    if (n <= 35) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB (PC limit)`;
    if (n === 50) return '16 Petabytes (Supercomputer Limit)';
    if (n >= 300) return 'Exceeds Atoms in Universe (~10⁸⁰)!';
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(0)} TB`;
  };

  // Navigation handlers
  const handleNext = () => {
    if (stage < 4) {
      setStage(stage + 1);
      if (!isGlobalMuted) {
        audio.playStageTransition();
        audio.playDroneWhoosh();
      }
    }
  };

  const handlePrev = () => {
    if (stage > 1) {
      setStage(stage - 1);
      if (!isGlobalMuted) {
        audio.playStageTransition();
        audio.playDroneWhoosh();
      }
    }
  };

  // Stage 2: Apply Hadamard All
  const handleApplyHadamardAll = () => {
    setIsSuperposed(true);
    if (!isGlobalMuted) audio.playHadamardExplosion();
  };

  const handleResetHadamard = () => {
    setIsSuperposed(false);
    if (!isGlobalMuted) audio.playReset();
  };

  // Stage 4: Run Interference Pulse
  const handleRunInterference = () => {
    setIsInterferenceActive(true);
    if (!isGlobalMuted) audio.playInterferencePulse();
  };

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
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* ── 3D CANVAS VIEWPORT ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'auto' }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.4, 14.8], fov: 45 }}
          gl={SCENE_GL}
        >
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <ExponentialScene
            stage={stage}
            qubitCount={qubitCount}
            isSuperposed={isSuperposed}
            targetStateIndex={targetStateIndex}
            isInterferenceActive={isInterferenceActive}
            cosmicMilestone={cosmicMilestone}
            theme={theme}
          />
        </Canvas>
      </div>

      <div style={uiBoundsStyle}>
        {/* ── INJECTED STYLES FOR FROSTED GLASS HUD ── */}
        <style>{`
          .compact-hud-card {
            background: transparent;
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border: 1px solid var(--card-border, #a855f760);
            border-radius: 18px;
            padding: 16px 22px;
            color: #f8fafc;
            box-shadow: var(--glass-highlight), var(--glass-shadow-base);
            pointer-events: auto;
            transition: all 0.3s ease;
          }

          .quantum-pill-btn {
            height: 48px;
            padding: 0 28px;
            border-radius: 999px;
            background: var(--glass-bg-pill);
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border: 1.5px solid var(--btn-color, rgba(168, 85, 247, 0.45));
            color: var(--btn-color, #c084fc);
            font-weight: 700;
            font-size: 14px;
            font-family: 'Inter', system-ui, sans-serif;
            letter-spacing: 0.2px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: inset 0 1.2px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 1px rgba(255, 255, 255, 0.08), 0 20px 48px -10px rgba(0, 0, 0, 0.65), 0 0 24px rgba(168, 85, 247, 0.25);
            outline: none;
            user-select: none;
            white-space: nowrap;
            gap: 8px;
          }
          .quantum-pill-btn .katex {
            font-size: 1em;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            vertical-align: middle;
          }
          .quantum-pill-btn:hover {
            background: rgba(255, 255, 255, 0.14);
            border-color: var(--btn-color, rgba(168, 85, 247, 0.85));
            color: #ffffff;
            box-shadow: inset 0 1.5px 2px rgba(255, 255, 255, 0.65), 0 24px 54px -10px rgba(0, 0, 0, 0.75), 0 0 32px rgba(168, 85, 247, 0.45);
            transform: translateY(-2px) scale(1.02);
          }
          .quantum-pill-btn:active {
            transform: scale(0.96) translateY(1.2px) !important;
            box-shadow: inset 0 1.5px 2px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          }

          .entangle-stage-pill {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #94a3b8;
            padding: 7px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 12px;
            font-family: 'Inter', system-ui, sans-serif;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            user-select: none;
            line-height: 1;
          }
          .entangle-stage-pill:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
          }
          .entangle-stage-pill.active {
            background: rgba(168, 85, 247, 0.2);
            border-color: #a855f7;
            color: #c084fc;
            font-weight: 700;
            box-shadow: 0 0 14px rgba(168, 85, 247, 0.4);
          }
        `}</style>

        {/* ── TOP CENTER: STAGE STEPPER PILLS (SINGLE LINE & SPACIOUS) ── */}
        <div style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          zIndex: 300,
          alignItems: 'center',
          whiteSpace: 'nowrap',
          pointerEvents: 'auto'
        }}>
          {[
            { num: 1, label: '1. Scaling Law' },
            { num: 2, label: '2. Superposition Explosion' },
            { num: 3, label: '3. Cosmic Scale' },
            { num: 4, label: '4. Interference Reality' }
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => {
                setStage(s.num);
                if (!isGlobalMuted) {
                  audio.playStageTransition();
                  if (s.num === 4 || s.num === 3) audio.playDroneWhoosh();
                }
              }}
              className={`entangle-stage-pill ${stage === s.num ? 'active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>

      {/* ── TOP RIGHT: LIVE HILBERT SPACE COUNTER METER (COMPACT & COMPLETE) ── */}
      <div className="compact-hud-card" style={{
        position: 'absolute',
        top: '72px',
        right: '12px',
        width: '200px',
        padding: '8px 12px',
        zIndex: 300,
        '--card-border': stage === 3 ? (cosmicMilestone === 300 ? '#f43f5e80' : '#a855f780') : '#a855f780',
        '--card-glow': stage === 3 ? (cosmicMilestone === 300 ? '#f43f5e25' : '#a855f725') : '#a855f725'
      }}>
        <div style={{ fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.8px', color: stage === 3 ? (cosmicMilestone === 300 ? '#fb7185' : '#c084fc') : '#c084fc', marginBottom: '2px', fontWeight: '800' }}>
          🌌 Hilbert Space Dimension
        </div>
        <div style={{
          fontSize: stage === 3 ? '12px' : '14px',
          fontWeight: '900',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          whiteSpace: 'nowrap'
        }}>
          {stage === 3 ? (
            cosmicMilestone === 50 ? (
              <span style={{ whiteSpace: 'nowrap' }}><InlineMath math={String.raw`2^{50} \approx 1.13 \times 10^{15}`} /></span>
            ) : (
              <span style={{ whiteSpace: 'nowrap' }}><InlineMath math={String.raw`2^{300} \approx 2.04 \times 10^{90}`} /></span>
            )
          ) : (
            <span style={{ whiteSpace: 'nowrap' }}><InlineMath math={String.raw`2^{${qubitCount}}`} /> = {formatStates(numStates)}</span>
          )}
          <span style={{ fontSize: '10px', color: stage === 3 ? (cosmicMilestone === 300 ? '#fb7185' : '#38bdf8') : '#38bdf8', fontWeight: '700', whiteSpace: 'nowrap', marginLeft: '4px' }}>
            {stage === 3 ? `${cosmicMilestone}Q` : `${qubitCount}Q`}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap' }}>
          Simulated RAM:{' '}
          <span style={{ color: '#f8fafc', fontWeight: '600' }}>
            {stage === 3
              ? (cosmicMilestone === 50 ? '16 PB (Supercomputer)' : '> Atoms in Universe')
              : getRAMEstimate(qubitCount)}
          </span>
        </div>
      </div>

      {/* ── STAGE 1: LINEAR HARDWARE VS EXPONENTIAL SPACE (COMPACT DESIGN) ── */}
      {stage === 1 && (
        <div className="compact-hud-card" style={{
          position: 'absolute',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '460px',
          padding: '14px 18px 16px 18px',
          textAlign: 'center',
          zIndex: 300,
          '--card-border': '#a855f795',
          '--card-glow': '#a855f735'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#c084fc', marginBottom: '3px' }}>
            Linear Hardware (<InlineMath math={String.raw`N`} />) vs Exponential Space (<InlineMath math={String.raw`2^N`} />)
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: '#cbd5e1', lineHeight: '1.4' }}>
            Adding a classical bit gives you +1 state. Adding <strong>1 physical qubit doubles</strong> the entire computational universe of simultaneous states!
          </p>

          {/* Interactive Qubit Hardware Slider (Compact Width) */}
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px', color: '#f8fafc', fontWeight: '700' }}>
              <span>Physical Qubits (<InlineMath math={String.raw`N`} />): <span style={{ color: '#38bdf8' }}>{qubitCount}</span></span>
              <span>Basis States (<InlineMath math={String.raw`2^N`} />): <span style={{ color: '#c084fc' }}>{numStates} States</span></span>
            </div>
            <GlassSlider
              min="1"
              max="5"
              step="1"
              value={qubitCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setQubitCount(val);
                if (!isGlobalMuted) audio.playQubitAdded(val);
              }}
              color="#a855f7"
              format={(v) => `${v} qubit${v === 1 ? '' : 's'}`}
              aria-label="Physical qubits"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', flexWrap: 'nowrap' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className="quantum-pill-btn"
                onClick={() => {
                  setQubitCount(n);
                  if (!isGlobalMuted) audio.playQubitAdded(n);
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '10.5px',
                  '--btn-color': qubitCount === n ? '#c084fc' : '#94a3b8',
                  background: qubitCount === n ? 'rgba(168, 85, 247, 0.25)' : 'rgba(10, 18, 30, 0.7)'
                }}
              >
                <span>{n}Q&nbsp;(</span>
                <InlineMath math={String.raw`2^{${n}}=${Math.pow(2, n)}`} />
                <span>)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STAGE 2: HADAMARD SUPERPOSITION EXPLOSION ── */}
      {stage === 2 && (
        <div className="compact-hud-card" style={{
          position: 'absolute',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '510px',
          textAlign: 'center',
          zIndex: 300,
          '--card-border': '#c084fc95',
          '--card-glow': '#c084fc35'
        }}>
          <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#c084fc', marginBottom: '4px' }}>
            Parallel Superposition Explosion (<InlineMath math={String.raw`H^{\otimes N}`} />)
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.45' }}>
            Applying a Hadamard gate to every qubit simultaneously fuses them into an equal superposition of all <InlineMath math={String.raw`2^{${qubitCount}} = ${numStates}`} /> computational states!
          </p>

          {/* Mathematical Visualizer Box */}
          <div style={{
            background: 'rgba(0,0,0,0.45)',
            padding: '6px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#38bdf8'
          }}>
            <InlineMath math={String.raw`|\Psi\rangle = \frac{1}{\sqrt{${numStates}}} \sum_{x=0}^{${numStates - 1}} |x\rangle`} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            {!isSuperposed ? (
              <button
                className="quantum-pill-btn"
                onClick={handleApplyHadamardAll}
                style={{ padding: '8px 22px', fontSize: '12.5px', '--btn-color': '#c084fc' }}
              >
                ⚡ Apply Hadamard to All ({qubitCount} Qubits) →
              </button>
            ) : (
              <button
                className="quantum-pill-btn"
                onClick={handleResetHadamard}
                style={{ padding: '8px 22px', fontSize: '12.5px', '--btn-color': '#38bdf8' }}
              >
                ↺ Reset to Ground State (|00...0⟩)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STAGE 3: COSMIC SCALE & OBSERVABLE UNIVERSE (INTERACTIVE MILESTONES) ── */}
      {stage === 3 && (
        <div className="compact-hud-card" style={{
          position: 'absolute',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '530px',
          textAlign: 'center',
          zIndex: 300,
          '--card-border': cosmicMilestone === 300 ? '#f43f5e95' : '#38bdf895',
          '--card-glow': cosmicMilestone === 300 ? '#f43f5e35' : '#38bdf835'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8', display: 'inline-block' }} />
            <span>Astronomical Scaling: The Observable Universe Limit</span>
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.45' }}>
            At just <strong>50 qubits</strong>, simulating the state vector exceeds Frontier supercomputer RAM. At <strong>300 qubits</strong>, the state space exceeds the total atoms in the observable universe!
          </p>

          {/* Interactive Cosmic Milestone Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '4px',
            textAlign: 'left'
          }}>
            <div
              onClick={() => {
                setCosmicMilestone(50);
                if (!isGlobalMuted) audio.playDroneWhoosh();
              }}
              style={{
                background: cosmicMilestone === 50 ? 'rgba(168, 85, 247, 0.22)' : 'rgba(0,0,0,0.35)',
                border: `1.5px solid ${cosmicMilestone === 50 ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: cosmicMilestone === 50 ? '0 0 15px rgba(168, 85, 247, 0.4)' : 'none',
                padding: '9px 12px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.25s ease'
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#c084fc', fontWeight: '800', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span><InlineMath math={String.raw`N = 50`} /> QUBITS</span>
                {cosmicMilestone === 50 && <span style={{ fontSize: '9px', background: '#a855f7', color: '#fff', padding: '1px 5px', borderRadius: '8px' }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff', marginBottom: '2px' }}>
                <InlineMath math={String.raw`2^{50} \approx 1.13 \times 10^{15}`} />
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Exceeds Global Supercomputer RAM</div>
            </div>

            <div
              onClick={() => {
                setCosmicMilestone(300);
                if (!isGlobalMuted) audio.playDroneWhoosh();
              }}
              style={{
                background: cosmicMilestone === 300 ? 'rgba(244, 63, 94, 0.22)' : 'rgba(0,0,0,0.35)',
                border: `1.5px solid ${cosmicMilestone === 300 ? '#f43f5e' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: cosmicMilestone === 300 ? '0 0 15px rgba(244, 63, 94, 0.4)' : 'none',
                padding: '9px 12px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.25s ease'
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#f43f5e', fontWeight: '800', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span><InlineMath math={String.raw`N = 300`} /> QUBITS</span>
                {cosmicMilestone === 300 && <span style={{ fontSize: '9px', background: '#f43f5e', color: '#fff', padding: '1px 5px', borderRadius: '8px' }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff', marginBottom: '2px' }}>
                <InlineMath math={String.raw`2^{300} \approx 2.04 \times 10^{90}`} />
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                &gt; Total Atoms in Universe <InlineMath math={String.raw`(\sim 10^{80})`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 4: QUANTUM PARALLELISM MYTH DEBUNKED ── */}
      {stage === 4 && (
        <div className="compact-hud-card" style={{
          position: 'absolute',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '520px',
          textAlign: 'center',
          zIndex: 300,
          '--card-border': '#f43f5e95',
          '--card-glow': '#f43f5e35'
        }}>
          <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#f43f5e', marginBottom: '4px' }}>
            🚫 The Big Myth: Brute-Force Parallelism?
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.45' }}>
            Quantum computers do <strong>NOT</strong> check all <InlineMath math={String.raw`2^N`} /> states simultaneously to pick an answer. Instead, quantum algorithms use <strong>interference</strong> to amplify the correct answer while canceling wrong ones!
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              className="quantum-pill-btn"
              onClick={handleRunInterference}
              style={{
                padding: '8px 22px',
                fontSize: '12.5px',
                '--btn-color': isInterferenceActive ? '#22c55e' : '#f43f5e'
              }}
            >
              {isInterferenceActive ? `✓ Target State Amplified (${targetStateLabel} = 100%)` : '⚡ Run Quantum Interference Pulse'}
            </button>
          </div>
        </div>
      )}

      {/* ── 🚀 DYNAMIC PREV / NEXT NAVIGATION CONTROLLER ── */}
      <QuantumNavButtons
        canPrev={stage > 1}
        canNext={stage < 4}
        onPrev={handlePrev}
        onNext={handleNext}
        prevLabel="Prev"
        nextLabel={stage < 4 ? "Next" : "Complete"}
        isLast={stage === 4}
        accentColor="#c084fc"
        containerStyle={{
          position: 'absolute',
          bottom: '35px',
          right: '30px',
          zIndex: 300,
        }}
      />
      </div>
    </div>
  );
}
