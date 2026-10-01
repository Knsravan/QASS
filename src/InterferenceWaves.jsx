import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const waveVertexShader = `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uFrequency;
  uniform float uPhase;
  uniform float uSpeed;
  
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    // We want the wave to propagate along the X axis.
    // position.x goes from -length/2 to length/2.
    float x = position.x;
    
    // Calculate the wave elevation
    float elevation = sin(x * uFrequency - uTime * uSpeed + uPhase) * uAmplitude;
    
    // Apply elevation to Y axis
    vec3 newPosition = position;
    newPosition.y += elevation;
    
    vElevation = elevation;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const waveFragmentShader = `
  uniform vec3 uColor;
  
  varying vec2 vUv;
  varying float vElevation;

  uniform float uOpacity;
  
  void main() {
    // Add a glow effect based on UV
    float glow = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    
    // Fade out at the edges (X axis)
    float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
    
    // Intense glowing color
    vec3 finalColor = uColor * glow * 3.0;
    
    gl_FragColor = vec4(finalColor, glow * edgeFade * 1.5 * uOpacity);
  }
`;

export function ShaderWave({ 
  color = '#0ea5e9', 
  amplitude = 1, 
  frequency = 1.5, 
  phase = 0, 
  speed = 2,
  length = 30,
  width = 0.5,
  opacity = 1,
  position = [0,0,0]
}) {
  const materialRef = useRef();

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
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      // Allow dynamic updates via props (like GSAP animating the object)
      materialRef.current.uniforms.uAmplitude.value = amplitude;
      materialRef.current.uniforms.uPhase.value = phase;
    }
  });

  return (
    <mesh position={position}>
      <planeGeometry args={[length, width, 256, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={waveVertexShader}
        fragmentShader={waveFragmentShader}
        uniforms={uniforms}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
