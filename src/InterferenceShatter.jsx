import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

export function InterferenceShatter({ active, radius = 2.8, count = 3500 }) {
  const pointsRef = useRef();
  const materialRef = useRef();
  const [visible, setVisible] = useState(false);
  const wasActive = useRef(false);

  // Generate 3D spherical shell positions, velocities, and quantum dual-color hues
  const { positions, basePositions, velocities, initialVelocities, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const initVel = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const cyan = new THREE.Color('#00f2fe');
    const magenta = new THREE.Color('#f093fb');
    const white = new THREE.Color('#ffffff');

    for (let i = 0; i < count; i++) {
      // Uniform spherical 3D distribution across the full sphere & orbiting wave boundary
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius + (Math.random() - 0.5) * 0.6;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Radial outward 3D explosion with slight turbulence
      const speed = Math.random() * 5.0 + 3.0;
      const nx = x / r;
      const ny = y / r;
      const nz = z / r;

      vel[i * 3] = nx * speed + (Math.random() - 0.5) * 1.2;
      vel[i * 3 + 1] = ny * speed + (Math.random() - 0.5) * 1.2;
      vel[i * 3 + 2] = nz * speed + (Math.random() - 0.5) * 1.2;

      initVel[i * 3] = vel[i * 3];
      initVel[i * 3 + 1] = vel[i * 3 + 1];
      initVel[i * 3 + 2] = vel[i * 3 + 2];

      // Dual-tone quantum interference particle colors (Cyan |0⟩, Magenta |1⟩, White photon flash)
      const rand = Math.random();
      const chosenColor = rand < 0.46 ? cyan : rand < 0.92 ? magenta : white;
      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }

    // Pristine copy: `pos` is mutated in place by useFrame, so resets must copy from this
    return { positions: pos, basePositions: pos.slice(), velocities: vel, initialVelocities: initVel, colors: col };
  }, [count, radius]);

  useEffect(() => {
    let timer;
    if (active) {
      setVisible(true);
      velocities.set(initialVelocities);
      positions.set(basePositions);
      if (pointsRef.current) {
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
      }
      if (materialRef.current) {
        gsap.killTweensOf(materialRef.current);
        materialRef.current.opacity = 1;
        gsap.to(materialRef.current, {
          opacity: 0,
          duration: 2.2,
          ease: 'power2.out',
          delay: 0.1,
          // Once fully faded there is nothing to see: hide the points so the
          // useFrame simulation stops burning CPU/GPU while `active` stays true
          onComplete: () => setVisible(false)
        });
      }
    } else {
      if (materialRef.current) {
        gsap.killTweensOf(materialRef.current);
        materialRef.current.opacity = 0;
      }
      timer = setTimeout(() => setVisible(false), 2400);
    }

    const mat = materialRef.current;
    return () => {
      if (mat) gsap.killTweensOf(mat);
      if (timer) clearTimeout(timer);
    };
  }, [active, positions, basePositions, initialVelocities, velocities]);

  useFrame((state, delta) => {
    if (active && !wasActive.current) {
      velocities.set(initialVelocities);
      positions.set(basePositions);
      if (pointsRef.current) {
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
      }
    }
    wasActive.current = active;

    if (!active || !visible || !pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.attributes.position;
    const pos = posAttr.array;

    // Realistic cosmic air drag, normalized to a 60fps baseline so the
    // explosion looks identical at any refresh rate
    const drag = Math.pow(0.96, delta * 60);

    for (let i = 0; i < count; i++) {
      pos[i * 3] += velocities[i * 3] * delta;
      pos[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      pos[i * 3 + 2] += velocities[i * 3 + 2] * delta;

      velocities[i * 3] *= drag;
      velocities[i * 3 + 1] *= drag;
      velocities[i * 3 + 2] *= drag;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} visible={visible}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.08}
        vertexColors={true}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
