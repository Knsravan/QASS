import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// The new look's pieces, shared by every Bloch sphere still drawn the old way (BlochSphere.jsx's
// QubitCore, Decoherence's BlochSphereUnit): fine lines of latitude and longitude and a brighter
// equator instead of thick coloured rings, and axes drawn as thin lines of light.

const circlePoints = (r, segments = 96) => {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.set([Math.cos(a) * r, Math.sin(a) * r, 0], i * 3);
  }
  return pts;
};

function Circle({ r, y = 0, rotation, color, opacity }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(circlePoints(r), 3));
    return g;
  }, [r]);
  useEffect(() => () => geo.dispose(), [geo]); // R3F frees only what it made from JSX
  return (
    <line geometry={geo} position={[0, y, 0]} rotation={rotation} raycast={() => null}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </line>
  );
}

/** Lines of latitude (±30°, ±60°), the equator, and six meridians on a sphere of `radius`. */
export function SphereLines({ radius, color = '#9fd8ff', equatorColor = '#b6e9ff', opacity = 0.18, equatorOpacity = 0.45 }) {
  return (
    <group>
      {[-60, -30, 30, 60].map((d) => {
        const a = (d * Math.PI) / 180;
        return <Circle key={d} r={radius * Math.cos(a)} y={radius * Math.sin(a)} rotation={[Math.PI / 2, 0, 0]} color={color} opacity={opacity} />;
      })}
      <Circle r={radius} rotation={[Math.PI / 2, 0, 0]} color={equatorColor} opacity={equatorOpacity} />
      {[0, 1, 2, 3, 4, 5].map((k) => <Circle key={`m${k}`} r={radius} rotation={[0, (k * Math.PI) / 6, 0]} color={color} opacity={opacity} />)}
    </group>
  );
}

/** A thin line of light along Y, `length` long (rotate it for the other axes). */
export function LightLine({ length, color = '#bfe9ff', opacity = 0.35, rotation, width = 0.008 }) {
  return (
    <mesh rotation={rotation} raycast={() => null}>
      <cylinderGeometry args={[width, width, length, 8]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** A soft additive halo: a sphere of light around a pearl or a pole. */
export function Halo({ radius, color, opacity = 0.2, position, materialRef }) {
  return (
    <mesh position={position} raycast={() => null}>
      <sphereGeometry args={[radius, 24, 16]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
