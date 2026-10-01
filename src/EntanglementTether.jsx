import React, { useState, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export function EntanglementTether({
  posA = [-3.6, 0, 0],
  posB = [3.6, 0, 0],
  isEntangled = true,
  bellStateColor = '#00f2fe',
  shockwaveProgress = -1, // 0 to 1 when shockwave active, -1 when idle
  shockwaveSource = 'A', // 'A' or 'B'
  shockwaveRef = null // optional mutable { progress, source } tweened outside React; overrides the two props above
}) {
  const [isHovered, setIsHovered] = useState(false);
  const coreLineRef = useRef();
  const glowLineRef = useRef();
  const particleGroupRef = useRef();
  const shockwaveMeshRef = useRef();

  // Particle Stream Data flowing gracefully between A and B
  const PARTICLE_COUNT = 40;
  const particleData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr.push({
        progress: Math.random(),
        speed: 0.25 + Math.random() * 0.35,
        offsetRadius: 0.08 + Math.random() * 0.16,
        phase: Math.random() * Math.PI * 2,
        size: 0.035 + Math.random() * 0.04
      });
    }
    return arr;
  }, []);

  const particleMeshRefs = useRef([]);

  // Calculate length and midpoint between A and B
  const vA = useMemo(() => new THREE.Vector3(...posA), [posA]);
  const vB = useMemo(() => new THREE.Vector3(...posB), [posB]);
  const distance = useMemo(() => vA.distanceTo(vB), [vA, vB]);
  const midpoint = useMemo(() => new THREE.Vector3().addVectors(vA, vB).multiplyScalar(0.5), [vA, vB]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Core Laser Line Breathing
    if (coreLineRef.current) {
      if (isEntangled) {
        const pulse = 0.75 + Math.sin(t * 6) * 0.25;
        coreLineRef.current.material.opacity = pulse;
      } else {
        coreLineRef.current.material.opacity = THREE.MathUtils.damp(
          coreLineRef.current.material.opacity,
          0,
          8,
          delta
        );
      }
    }

    // 2. Outer Beam Glow
    if (glowLineRef.current) {
      if (isEntangled) {
        const glowPulse = 0.35 + Math.sin(t * 4) * 0.15;
        glowLineRef.current.material.opacity = glowPulse;
      } else {
        glowLineRef.current.material.opacity = THREE.MathUtils.damp(
          glowLineRef.current.material.opacity,
          0,
          8,
          delta
        );
      }
    }

    // 3. Flowing Quantum Energy Particles (Spiral along the beam)
    if (particleGroupRef.current && isEntangled) {
      particleData.forEach((p, idx) => {
        p.progress = (p.progress + p.speed * delta) % 1.0;
        const mesh = particleMeshRefs.current[idx];
        if (mesh) {
          const currentX = THREE.MathUtils.lerp(vA.x, vB.x, p.progress);
          const angle = p.phase + t * 3.5;
          const currentY = midpoint.y + Math.sin(angle) * p.offsetRadius;
          const currentZ = midpoint.z + Math.cos(angle) * p.offsetRadius;

          mesh.position.set(currentX, currentY, currentZ);
          // Fade in at middle, fade gently at connection tips
          const edgeFade = Math.sin(p.progress * Math.PI);
          mesh.material.opacity = edgeFade * 0.9;
        }
      });
    }

    // 4. Instantaneous Measurement Collapse Shockwave
    const waveProgress = shockwaveRef ? shockwaveRef.current.progress : shockwaveProgress;
    const waveSource = shockwaveRef ? shockwaveRef.current.source : shockwaveSource;
    if (shockwaveMeshRef.current && waveProgress >= 0) {
      const fromX = waveSource === 'A' ? vA.x : vB.x;
      const toX = waveSource === 'A' ? vB.x : vA.x;
      const waveX = THREE.MathUtils.lerp(fromX, toX, waveProgress);

      shockwaveMeshRef.current.position.set(waveX, midpoint.y, midpoint.z);
      const waveScale = 1.0 + Math.sin(waveProgress * Math.PI) * 1.5;
      shockwaveMeshRef.current.scale.set(waveScale, waveScale, waveScale);
      shockwaveMeshRef.current.material.opacity = (1 - waveProgress) * 0.9;
    }
  });

  return (
    <group>
      {/* 1. Ultra-clean central laser core (Pure straight beam along X axis) */}
      {/* Unit-length cylinders stretched via scale.y so slider drags never rebuild geometry */}
      <mesh
        ref={coreLineRef}
        position={[midpoint.x, midpoint.y, midpoint.z]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, distance, 1]}
      >
        <cylinderGeometry args={[0.02, 0.02, 1, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 2. Concentric soft glow sheath (Stationary, aligned with beam) */}
      <mesh
        ref={glowLineRef}
        position={[midpoint.x, midpoint.y, midpoint.z]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, distance, 1]}
      >
        <cylinderGeometry args={[0.06, 0.06, 1, 16]} />
        <meshStandardMaterial
          color={bellStateColor}
          emissive={bellStateColor}
          emissiveIntensity={3.5}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. Swarming Quantum Photon Particles */}
      {isEntangled && (
        <group ref={particleGroupRef}>
          {particleData.map((p, i) => (
            <mesh
              key={i}
              ref={el => (particleMeshRefs.current[i] = el)}
              position={[0, 0, 0]}
            >
              <sphereGeometry args={[p.size, 12, 12]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? '#ffffff' : bellStateColor}
                emissive={i % 2 === 0 ? '#ffffff' : bellStateColor}
                emissiveIntensity={3.0}
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* 4. Measurement Shockwave Pulse */}
      {shockwaveProgress >= 0 && (
        <mesh
          ref={shockwaveMeshRef}
          rotation={[0, Math.PI / 2, 0]}
          position={[midpoint.x, midpoint.y, midpoint.z]}
        >
          <torusGeometry args={[0.5, 0.05, 16, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={4.0}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* 5. Invisible Interactive Hitbox for Tether Hover Interaction */}
      {isEntangled && (
        <mesh
          position={[midpoint.x, midpoint.y, midpoint.z]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[1, distance * 0.72, 1]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setIsHovered(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setIsHovered(false);
          }}
        >
          <cylinderGeometry args={[0.45, 0.45, 1, 12]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}

      {/* 6. Pre-projected Seamless Tether Hover Tooltip with Zero-Snap Transition */}
      {isEntangled && (
        <Html
          position={[midpoint.x, midpoint.y + 1.55, midpoint.z]}
          center
          zIndexRange={[120, 0]}
          style={{
            pointerEvents: 'none',
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(6px)',
            transition: 'opacity 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
            willChange: 'opacity, transform'
          }}
        >
          <div
            className="glass-tooltip"
            style={{
              width: '210px',
              padding: '8px 14px',
              borderRadius: '18px',
              textAlign: 'center',
              background: 'rgba(10, 18, 30, 0.75)',
              backdropFilter: 'blur(25px) saturate(200%)',
              WebkitBackdropFilter: 'blur(25px) saturate(200%)',
              border: `1.5px solid ${bellStateColor}90`,
              boxShadow: `0 12px 35px rgba(0, 0, 0, 0.65), 0 0 22px ${bellStateColor}35`,
              pointerEvents: 'none'
            }}
          >
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              color: bellStateColor,
              marginBottom: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '10px' }}>⚡</span> Entanglement Tether
            </div>
            <p style={{ margin: 0, fontSize: '10px', color: '#cbd5e1', lineHeight: '1.35' }}>
              Quantum correlation channel linking Alice & Bob's wavefunctions instantaneously.
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}
