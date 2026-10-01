import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function InterferometerCinematic({ active, step, phase, isLight, onComplete }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animTime = useRef(0);
  
  const inBeamRef = useRef();
  const inBeamMatRef = useRef();
  const outBeamRef = useRef();
  const outBeamMatRef = useRef();
  
  useEffect(() => {
    if (active) {
      setIsPlaying(true);
      animTime.current = 0;
    }
  }, [active, step]);

  const beamMat1 = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0ea5e9', transparent: true, opacity: 0, blending: THREE.AdditiveBlending }), []);
  const beamMat2 = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: new THREE.Color().setHSL((200 - (phase / (Math.PI*2)) * 100) / 360, 1, 0.6), 
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending 
  }), [phase]);

  useFrame((state, delta) => {
    if (isPlaying) {
      animTime.current += delta;
      const t = animTime.current;
      if (t > 3.0) { // 3 second animation
        setIsPlaying(false);
        if (onComplete) onComplete();
        return;
      }
      
      const progress = Math.min(t / 2.5, 1.0); // Normalize to 0..1 over 2.5s
      
      let path1Opacity = 0;
      let path2Opacity = 0;
      let inBeamScale = 0;
      let outBeamScale = 0;
      let outBeamColor = '#000000';
      let outBeamOpacity = 0;
      
      if (step === 1) {
        // 1st H Gate
        if (progress < 0.2) {
          inBeamScale = progress / 0.2; // Incoming beam grows
        } else if (progress < 0.8) {
          inBeamScale = 1;
          path1Opacity = (progress - 0.2) / 0.2;
          path2Opacity = (progress - 0.2) / 0.2;
        } else {
          inBeamScale = 1 - (progress - 0.8) / 0.2;
          path1Opacity = 1 - (progress - 0.8) / 0.2;
          path2Opacity = 1 - (progress - 0.8) / 0.2;
        }
      } else if (step === 3) {
        // 2nd H Gate
        if (progress < 0.2) {
          path1Opacity = progress / 0.2;
          path2Opacity = progress / 0.2;
        } else if (progress < 0.8) {
          path1Opacity = 1;
          path2Opacity = 1;
          outBeamScale = Math.min((progress - 0.3) / 0.2, 1.0);
          
          const resMag = Math.pow(Math.cos(phase/2), 2);
          if (resMag > 0.99) {
            outBeamColor = '#fbbf24'; // Constructive
            outBeamOpacity = outBeamScale;
          } else if (resMag < 0.01) {
            outBeamColor = '#64748b'; // Destructive
            outBeamOpacity = outBeamScale * 0.2; // Dim
          } else {
            outBeamColor = '#10b981'; // Partial
            outBeamOpacity = outBeamScale * 0.6;
          }
        } else {
          const fadeOut = 1 - (progress - 0.8) / 0.2;
          path1Opacity = fadeOut;
          path2Opacity = fadeOut;
          outBeamScale = 1.0;
          
          const resMag = Math.pow(Math.cos(phase/2), 2);
          if (resMag > 0.99) {
            outBeamColor = '#fbbf24';
            outBeamOpacity = fadeOut;
          } else if (resMag < 0.01) {
            outBeamColor = '#64748b';
            outBeamOpacity = fadeOut * 0.2;
          } else {
            outBeamColor = '#10b981';
            outBeamOpacity = fadeOut * 0.6;
          }
        }
      }
      
      path1Opacity = Math.max(0, Math.min(1, path1Opacity));
      path2Opacity = Math.max(0, Math.min(1, path2Opacity));
      inBeamScale = Math.max(0, Math.min(1, inBeamScale));
      outBeamScale = Math.max(0, Math.min(1, outBeamScale));

      if (beamMat1) beamMat1.opacity = path1Opacity;
      if (beamMat2) beamMat2.opacity = path2Opacity;

      if (inBeamRef.current) {
        inBeamRef.current.scale.y = inBeamScale;
        inBeamRef.current.position.x = -1.5 + inBeamScale * 1.5 / 2;
      }
      if (inBeamMatRef.current) {
        inBeamMatRef.current.opacity = inBeamScale;
      }

      if (outBeamRef.current) {
        outBeamRef.current.scale.y = outBeamScale;
        outBeamRef.current.position.x = 2.25 + outBeamScale * 1.5 / 2;
      }
      if (outBeamMatRef.current) {
        outBeamMatRef.current.opacity = outBeamOpacity;
        outBeamMatRef.current.color.set(outBeamColor);
      }
    }
  });

  if (!isPlaying && !active) return null;

  return (
    <group position={[4.2, 0, 0]} scale={2}>
      {/* Beam Splitter Box */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI/4, 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.3} wireframe />
      </mesh>
      
      {/* Central Splitter Glass */}
      <mesh position={[0, 0, 0]} rotation={[0, Math.PI/4, 0]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshPhysicalMaterial color="#38bdf8" transmission={0.9} opacity={1} transparent />
      </mesh>

      {/* Incoming Beam (Step 1) */}
      {step === 1 && (
        <mesh ref={inBeamRef} position={[-1.5, 0, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.02, 0.02, 1.5, 16]} />
          <meshBasicMaterial ref={inBeamMatRef} color="#00f2fe" transparent opacity={0} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {/* Outgoing Path 1 (Top/Right) */}
      <mesh position={[0.75, 0.75, 0]} rotation={[0, 0, Math.PI/4]}>
        <cylinderGeometry args={[0.02, 0.02, 2.12, 16]} />
        <primitive object={beamMat1} attach="material" />
      </mesh>
      
      {/* Outgoing Path 2 (Bottom/Left - Phase Shifted) */}
      <mesh position={[0.75, -0.75, 0]} rotation={[0, 0, -Math.PI/4]}>
        <cylinderGeometry args={[0.02, 0.02, 2.12, 16]} />
        <primitive object={beamMat2} attach="material" />
      </mesh>

      {/* Outgoing Final Beam (Step 3) */}
      {step === 3 && (
        <mesh ref={outBeamRef} position={[2.25, 0, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.04, 0.04, 1.5, 16]} />
          <meshBasicMaterial ref={outBeamMatRef} color="#000000" transparent opacity={0} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      
    </group>
  );
}
