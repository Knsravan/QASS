import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

export function InterferenceSupernova({ active }) {
  const meshRef = useRef();

  useEffect(() => {
    if (active && meshRef.current) {
      meshRef.current.scale.set(0.1, 0.1, 0.1);
      meshRef.current.material.opacity = 1;
      
      gsap.to(meshRef.current.scale, { x: 8, y: 8, z: 8, duration: 1.5, ease: 'power3.out' });
      gsap.to(meshRef.current.material, { opacity: 0, duration: 1.5, ease: 'power3.in' });
    }
    const mesh = meshRef.current;
    return () => {
      if (mesh) {
        gsap.killTweensOf(mesh.scale);
        if (mesh.material) gsap.killTweensOf(mesh.material);
      }
    };
  }, [active]);

  return (
    <mesh ref={meshRef} visible={active}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial 
        color="#fbbf24"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
