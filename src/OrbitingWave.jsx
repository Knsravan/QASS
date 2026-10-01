import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const OrbitingWaveShader = `
  varying vec2 vUv;
  varying float vElevation;
  
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uFrequency;
  uniform float uPhase;
  uniform float uSpeed;

  void main() {
    vUv = uv;
    
    // Create an organic fluid wave by combining a primary traveling wave with a secondary fast wobble
    float primaryWave = sin(vUv.x * uFrequency * 3.14159 * 2.0 + uPhase - uTime);
    float secondaryWave = sin(vUv.x * (uFrequency * 2.0) * 3.14159 * 2.0 + uPhase + uTime * 1.5) * 0.15;
    
    float elevation = (primaryWave + secondaryWave) * uAmplitude;
    vElevation = elevation;
    
    // Displace along the Z-axis (perpendicular to the torus ring) to create crests and troughs
    vec3 newPosition = position + vec3(0.0, 0.0, elevation);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const OrbitingWaveFragment = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uAmplitude;
  
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // Glow based on the tube circumference (uv.y) to make it look like a soft laser beam
    float glow = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    
    // Increase brightness at the crests (positive elevation) and dim at troughs
    float intensity = 1.0 + (vElevation / max(uAmplitude, 0.001)) * 0.8; 
    
    vec3 finalColor = uColor * glow * 3.0 * intensity;
    gl_FragColor = vec4(finalColor, glow * uOpacity * (0.5 + 0.5 * intensity));
  }
`;

export function OrbitingWave({ 
  color = '#0ea5e9', 
  amplitude = 0.45, 
  amplitudeRef,
  frequency = 4, 
  phase = 0, 
  phaseRef,
  speed = 2,
  radius = 2.5,
  tube = 0.05,
  opacity = 1,
  opacityRef,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
  label,
  autoShowLabel = false
}) {
  const materialRef = useRef();
  const [isHovered, setIsHovered] = useState(false);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uAmplitude: { value: amplitude },
    uFrequency: { value: frequency },
    uPhase: { value: phase },
    uSpeed: { value: speed },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity }
  }), [amplitude, frequency, phase, speed, color, opacity]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime * speed;
      materialRef.current.uniforms.uAmplitude.value = amplitudeRef?.current ?? amplitude;
      materialRef.current.uniforms.uFrequency.value = frequency;
      // A phase ref lets a parent animate the shader every frame without
      // re-rendering the wave mesh or changing its visual design.
      materialRef.current.uniforms.uPhase.value = phaseRef?.current ?? phase;
      materialRef.current.uniforms.uColor.value.set(color);
      materialRef.current.uniforms.uOpacity.value = opacityRef?.current ?? opacity;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <torusGeometry args={[radius, tube, 64, 256]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={OrbitingWaveShader}
          fragmentShader={OrbitingWaveFragment}
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Invisible thicker mesh for easier hover raycasting */}
      <mesh 
        onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setIsHovered(false); }}
      >
        <torusGeometry args={[radius, tube * 6, 16, 64]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      
      {/* Pop-up Label */}
      {(isHovered || autoShowLabel) && label && (
        <Html position={[radius, 0, 0]} center style={{ pointerEvents: 'none', transition: 'opacity 0.3s', zIndex: 20 }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.7), rgba(15, 15, 18, 0.9))',
            backdropFilter: 'blur(20px) saturate(200%)',
            WebkitBackdropFilter: 'blur(20px) saturate(200%)',
            border: `1px solid ${color}80`,
            padding: '8px 16px',
            borderRadius: '16px',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            boxShadow: `0 8px 20px rgba(0,0,0,0.6), 0 0 15px ${color}30`,
            fontFamily: "'Inter', sans-serif",
            textShadow: `0 0 10px ${color}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ 
              display: 'inline-block', width: '8px', height: '8px', 
              borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` 
            }} />
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}
