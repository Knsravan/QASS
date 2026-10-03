import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { InlineMath } from 'react-katex';
import { useDrag } from '@use-gesture/react';

import BlochSphere from './BlochSphere';
import { useInterferenceAudio } from './useInterferenceAudio';
import useInterferenceCinematic from './useInterferenceCinematic';
import CameraShifter from './CameraShifter';
import { OrbitingWave } from './OrbitingWave';
import { InterferenceShatter } from './InterferenceShatter';
import { InterferenceSupernova } from './InterferenceSupernova';
import { QuantumNavButtons } from './QuantumNavButtons';
import { SCENE_GL } from './sceneGl';
import GlassSlider from './GlassSlider';
import { QualityCanvas } from './QualityScene';
import { SharedCanvas } from './SharedCanvas';

const COLORS = {
  primary: '#0ea5e9', // Cyan
  secondary: '#d946ef', // Magenta
  constructive: '#fbbf24', // Gold
  destructive: '#94a3b8' // Blue-Grey
};

// --- 3D Interactive Gates ---
// --- 3D Interactive Gates (Glass Holographic Tokens) ---
function DraggableGate({ type, initialPosition, onDrop, visible, topDown = false, audio }) {
  const [pos, setPos] = useState(initialPosition);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const groupRef = useRef();
  const { size, viewport } = useThree();
  const aspectX = size.width / viewport.width;
  const aspectY = size.height / viewport.height;

  const animScale = useRef(0.2);

  // Smooth spring entrance dampening and idle levitation
  useFrame((state, delta) => {
    if (!visible) return;
    const targetScale = isDragging ? 1.15 : isHovered ? 1.08 : 1;
    animScale.current = THREE.MathUtils.damp(animScale.current, targetScale, 10, delta);

    if (groupRef.current) {
      const s = animScale.current;
      groupRef.current.scale.set(s, s, s);

      if (!isDragging) {
        const t = state.clock.getElapsedTime();
        const floatOffset = Math.sin(t * 2.2 + (type === 'H' ? 0 : 1.8)) * 0.06;
        groupRef.current.position.y = pos[1] + floatOffset;
        if (topDown) {
          groupRef.current.rotation.y = Math.sin(t * 1.2) * 0.05;
        } else {
          groupRef.current.rotation.z = Math.sin(t * 1.2) * 0.03;
        }
      }
    }
  });

  const bind = useDrag(({ event, movement: [mx, my], first, last }) => {
    if (!visible) return;
    if (event && event.stopPropagation) event.stopPropagation();
    
    if (first) {
      setIsDragging(true);
    }

    const newPos = topDown ? [
      initialPosition[0] + mx / aspectX,
      initialPosition[1],
      initialPosition[2] + my / aspectY
    ] : [
      initialPosition[0] + mx / aspectX,
      initialPosition[1] - my / aspectY,
      initialPosition[2]
    ];
    setPos(newPos);
    
    if (last) {
      setIsDragging(false);
      // Check if dropped near the Bloch sphere (origin)
      const dist = topDown
        ? Math.sqrt(newPos[0]*newPos[0] + newPos[2]*newPos[2])
        : Math.sqrt(newPos[0]*newPos[0] + newPos[1]*newPos[1]);
      
      if (dist < 3.5) {
        setPos(initialPosition);
        if (audio?.playDragDrop) audio.playDragDrop();
        onDrop();
      } else {
        setPos(initialPosition); 
      }
    }
  });

  if (!visible) return null;

  const isH = type === 'H';
  const accentColor = isH ? '#00f2fe' : '#f093fb';
  const secondaryColor = isH ? '#0284c7' : '#c026d3';
  const accentGlow = isH ? 'rgba(0, 242, 254, 0.8)' : 'rgba(240, 147, 251, 0.8)';
  const labelText = isH ? 'HADAMARD' : 'PHASE FLIP';
  const bindEvents = bind();

  return (
    <group 
      ref={groupRef}
      {...bindEvents} 
      position={pos} 
      onPointerDown={(e) => {
        e.stopPropagation();
        if (bindEvents.onPointerDown) bindEvents.onPointerDown(e);
      }}
      onPointerOver={(e) => { 
        e.stopPropagation(); 
        setIsHovered(true);
      }}
      onPointerOut={(e) => { e.stopPropagation(); setIsHovered(false); }}
    >
      {/* Container rotation based on camera angle */}
      <group rotation={topDown ? [Math.PI / 2.5, 0, 0] : [0, 0, 0]}>
        
        {/* ── 1. Outer Dark Titanium Chamfered Bezel ── */}
        <mesh>
          <cylinderGeometry args={[0.96, 0.96, 0.08, 64]} />
          <meshPhysicalMaterial 
            color="#0f172a" 
            metalness={0.85} 
            roughness={0.15} 
            clearcoat={1} 
            clearcoatRoughness={0.1}
          />
        </mesh>

        {/* ── 2. Outer Luminous Neon Torus Ring ── */}
        <mesh>
          <torusGeometry args={[0.94, 0.035, 20, 64]} />
          <meshStandardMaterial 
            color={accentColor} 
            emissive={accentColor} 
            emissiveIntensity={isHovered || isDragging ? 4.5 : 2.2} 
            metalness={0.5} 
            roughness={0.1}
          />
        </mesh>

        {/* ── 3. Glass Optical Lens ── */}
        <mesh position={[0, 0, 0.01]}>
          <cylinderGeometry args={[0.88, 0.88, 0.12, 64]} />
          <meshPhysicalMaterial 
            color={secondaryColor} 
            transmission={0.90} 
            opacity={0.95} 
            transparent={true} 
            roughness={0.06} 
            metalness={0.15} 
            clearcoat={1} 
            clearcoatRoughness={0.05} 
            ior={1.58} 
            thickness={0.7}
          />
        </mesh>

        {/* ── 4. Inner Holographic Precision Reticle Rings ── */}
        <mesh position={[0, 0, 0.065]}>
          <ringGeometry args={[0.72, 0.745, 64]} />
          <meshBasicMaterial 
            color={accentColor} 
            transparent 
            opacity={isHovered || isDragging ? 0.85 : 0.45} 
            side={THREE.DoubleSide} 
          />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <ringGeometry args={[0.54, 0.555, 48]} />
          <meshBasicMaterial 
            color={accentColor} 
            transparent 
            opacity={isHovered || isDragging ? 0.6 : 0.3} 
            side={THREE.DoubleSide} 
          />
        </mesh>

        {/* ── 5. Quantum Precision Crosshair Ticks ── */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((rot, i) => (
          <mesh key={i} rotation={[0, 0, rot]} position={[0, 0, 0.068]}>
            <planeGeometry args={[0.02, 0.10]} />
            <meshBasicMaterial 
              color={accentColor} 
              transparent 
              opacity={0.75} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        ))}

        {/* ── 6. Holographic Inner Plasma Glow Flare ── */}
        <mesh position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshBasicMaterial 
            color={accentColor} 
            transparent 
            opacity={isHovered || isDragging ? 0.35 : 0.18} 
            blending={THREE.AdditiveBlending} 
          />
        </mesh>

        {/* ── 7. Apple Dark Glass UI Center Badge (Typography & Sub-Pill) ── */}
        <Html center position={[0, 0, 0.14]} style={{ pointerEvents: 'none' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            pointerEvents: 'none',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            <div style={{
              fontSize: '36px',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.5px',
              color: '#ffffff',
              textShadow: `0 0 16px ${accentGlow}, 0 0 32px ${accentGlow}`,
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.85))'
            }}>
              {type}
            </div>
            <div style={{
              fontSize: '8px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: accentColor,
              marginTop: '4px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: 'rgba(5, 5, 10, 0.65)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: `1px solid ${accentColor}40`,
              boxShadow: `0 0 12px ${accentGlow}30`,
              whiteSpace: 'nowrap'
            }}>
              {labelText}
            </div>
          </div>
        </Html>

        {/* ── 8. Glass Drag Tooltip ── */}
        {isHovered && !isDragging && (
          <Html center position={[0, 1.45, 0]} style={{ pointerEvents: 'none', zIndex: 100 }}>
            <div style={{
              background: 'rgba(10, 10, 18, 0.85)',
              backdropFilter: 'blur(25px) saturate(200%)',
              WebkitBackdropFilter: 'blur(25px) saturate(200%)',
              border: `1px solid ${accentColor}60`,
              padding: '7px 14px',
              borderRadius: '20px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              whiteSpace: 'nowrap',
              boxShadow: `0 10px 25px rgba(0,0,0,0.6), 0 0 16px ${accentGlow}40`,
              fontFamily: "'Inter', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: accentColor,
                boxShadow: `0 0 8px ${accentColor}`
              }} />
              Drag <strong style={{ color: accentColor }}>{type}-Gate</strong> onto sphere
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

// --- Master 3D Scene ---
// The module's own lights. Coming from the hub (whose scene already has its lights),
// they fade up instead of switching on, so the hand-over doesn't brighten the qubit.
function IntroLights({ ramp }) {
  const amb = useRef();
  const pt = useRef();
  const k = useRef(ramp ? 0 : 1);
  useFrame((_, dt) => {
    if (k.current < 1) k.current = Math.min(1, k.current + dt / 1.6);
    if (amb.current) amb.current.intensity = 0.5 * k.current;
    if (pt.current) pt.current.intensity = 1 * k.current;
  });
  return (
    <>
      <ambientLight ref={amb} intensity={ramp ? 0 : 0.5} />
      <pointLight ref={pt} position={[10, 10, 10]} intensity={ramp ? 0 : 1} />
    </>
  );
}

function InterferenceScene({ theme, stage, subStage, setSubStage, interferencePhase, isSidebarOpen, audio, fromHub = false }) {
  const { camera } = useThree();
  const groupRef = useRef();
  const cyanWaveRef = useRef();
  const magentaWaveRef = useRef();
  const [autoLabel, setAutoLabel] = useState('cyan');

  useEffect(() => {
    // Only auto-swap labels in Stage 2 (before Z-Gate is dropped)
    if (stage === 2 && (subStage === 1 || subStage === 2)) {
      const interval = setInterval(() => {
        setAutoLabel(prev => prev === 'cyan' ? 'magenta' : 'cyan');
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setAutoLabel(null);
    }
  }, [stage, subStage]);

  const introRef = useRef();
  const sceneRefs = useMemo(() => ({ magentaWave: magentaWaveRef, group: groupRef, intro: introRef }), []);

  useInterferenceCinematic({
    stage,
    subStage,
    camera,
    sceneRefs,
    audio,
    fromHub
  });

  // Calculate Wave amplitudes based on phase in Stage 3
  const isStage3 = stage === 3;
  // Use floating-point tolerance so sliders & presets trigger states reliably
  const normPhase = Math.abs(interferencePhase);
  const isConstructive = isStage3 && (normPhase < 0.15 || Math.abs(normPhase - 2 * Math.PI) < 0.15);
  const isDestructive = isStage3 && Math.abs(normPhase - Math.PI) < 0.15;

  // Track timers so we can cancel on unmount / re-trigger
  const hGateTimerRef = useRef(null);
  const zGateTimerRef = useRef(null);

  const onDropHGate1 = useCallback(() => {
    clearTimeout(hGateTimerRef.current);
    setSubStage(1); // Triggers wave split
    if (audio?.playHGateSplit) audio.playHGateSplit();
    hGateTimerRef.current = setTimeout(() => setSubStage(2), 1800); // Prompt Z-Gate promptly
  }, [setSubStage, audio]);

  const onDropZGate = useCallback(() => {
    clearTimeout(zGateTimerRef.current);
    setSubStage(3); // Triggers phase shift & out-of-phase wave motion
    if (audio?.playZGateInversion) audio.playZGateInversion();
    zGateTimerRef.current = setTimeout(() => setSubStage(4), 1800); // Prompt 2nd H-Gate promptly
  }, [setSubStage, audio]);

  const onDropHGate2 = useCallback(() => {
    setSubStage(5); // Triggers recombination & South Pole vector landing |1⟩
    if (audio?.playHGateResolve) audio.playHGateResolve();
  }, [setSubStage, audio]);

  // Cancel pending gate-drop timers whenever the stage changes (and on unmount)
  // so a stray setSubStage can't fire into a different stage
  useEffect(() => {
    return () => {
      clearTimeout(hGateTimerRef.current);
      clearTimeout(zGateTimerRef.current);
    };
  }, [stage]);

  // Dynamic interference step mapped to BlochSphere state vector
  const interferenceStep = stage === 1 ? 0
    : (stage === 2 && subStage === 0) ? 0
    : (stage === 2 && (subStage === 1 || subStage === 2)) ? 1
    : (stage === 2 && (subStage === 3 || subStage === 4)) ? 3
    : (stage === 2 && subStage === 5) ? 5
    : 6; // Stage 3 Sandbox

  // Smoothly damp the magenta wave's phase transition for buttery visual feedback
  const animatedMagentaPhase = useRef(0);
  const cyanAmpRef = useRef(0.0);
  const cyanOpacityRef = useRef(1.0);
  const magentaAmpRef = useRef(0.0);
  const sphereGroupRef = useRef();

  useFrame((_, delta) => {
    const targetPhase = isStage3 
      ? interferencePhase 
      : (stage === 2 && subStage >= 3 ? Math.PI : 0);
    animatedMagentaPhase.current = THREE.MathUtils.damp(
      animatedMagentaPhase.current,
      targetPhase,
      5,
      delta
    );

    // Target wave amplitudes based on 2nd H-Gate recombination
    // Destructive cancellation on |0⟩ (collapses to 0) and constructive amplification on |1⟩
    const targetCyanAmp = (stage === 2 && subStage === 0) ? 0.0 : (stage === 2 && subStage === 5) ? 0.0 : 0.45;
    const targetCyanOpacity = (stage === 2 && subStage === 5) ? 0.0 : 1.0;
    const targetMagentaAmp = (stage === 2 && subStage === 0) ? 0.0 : (stage === 2 && subStage === 5) ? 0.58 : 0.45;

    cyanAmpRef.current = THREE.MathUtils.damp(cyanAmpRef.current, targetCyanAmp, 3.5, delta);
    cyanOpacityRef.current = THREE.MathUtils.damp(cyanOpacityRef.current, targetCyanOpacity, 3.5, delta);
    magentaAmpRef.current = THREE.MathUtils.damp(magentaAmpRef.current, targetMagentaAmp, 3.5, delta);

    // Smoothly tilt ONLY the Bloch Sphere into default front view when 2nd H-Gate is applied (subStage 5)
    // so the user can clearly see the vector pointing down to the South Pole (|1⟩)
    if (sphereGroupRef.current) {
      const targetSphereRotX = (stage === 2 && subStage === 5) ? -Math.PI / 2 : 0;
      sphereGroupRef.current.rotation.x = THREE.MathUtils.damp(
        sphereGroupRef.current.rotation.x,
        targetSphereRotX,
        3.5,
        delta
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* Bloch Sphere Group (waves remain outside so their orbital plane is un-tilted) */}
      <group ref={introRef}>
      <group ref={sphereGroupRef}>
        <BlochSphere
          theme={theme}
          activeModule="interference"
          qubitCount={1}
          isDecohering={false}
          attemptCopy={false}
          isSidebarOpen={false} // Handled by group wrapper
          setIsSidebarOpen={() => {}}
          interferencePhase={interferencePhase}
          interferenceStep={interferenceStep}
        />
      </group>
      </group>
        
      {/* Orbiting Waves (Visible after H-Gate drop in Stage 2, and throughout Stage 3) */}
      {((stage === 2 && subStage >= 1) || stage === 3) && (
        <group>
          {/* Reference Path 0: Cyan Wave (destructively cancels out in subStage 5) */}
          <group ref={cyanWaveRef}>
              <OrbitingWave 
                radius={3.05} 
                color={COLORS.primary} 
                rotation={[0, 0.2, 0]} 
                phase={0} 
                amplitude={0.42}
                amplitudeRef={cyanAmpRef}
                opacity={0.85}
                opacityRef={cyanOpacityRef}
                label={stage === 2 && subStage >= 3 ? null : "State |0⟩ Path"}
                autoShowLabel={autoLabel === 'cyan'}
              />
            </group>
            {/* Phase-Shifted Path 1: Magenta Wave (constructively amplifies into 100% in subStage 5) */}
            <group ref={magentaWaveRef}>
              <OrbitingWave 
                radius={3.05} 
                color={COLORS.secondary} 
                rotation={[0, -0.2, 0]} 
                phase={animatedMagentaPhase.current} 
                phaseRef={animatedMagentaPhase}
                amplitude={0.42}
                amplitudeRef={magentaAmpRef}
                opacity={1.0}
                label={stage === 2 && subStage >= 3 ? null : "State |1⟩ Path"}
                autoShowLabel={autoLabel === 'magenta'}
              />
          </group>
        </group>
      )}

      {/* Stage 2 Drag-and-Drop Gates */}
      {stage === 2 && (
        <>
          <DraggableGate type="H" initialPosition={[-4, 2.5, 0]} visible={subStage === 0} onDrop={onDropHGate1} audio={audio} />
          <DraggableGate type="Z" initialPosition={[4, 0, 3.5]} visible={subStage === 2} onDrop={onDropZGate} topDown={true} audio={audio} />
          <DraggableGate type="H" initialPosition={[-4.6, 0, 0.4]} visible={subStage === 4} onDrop={onDropHGate2} topDown={true} audio={audio} />
        </>
      )}

      {/* Stage 3 Special Particle Effects */}
      <InterferenceShatter active={isDestructive} />
      <InterferenceSupernova active={isConstructive} />
    </group>
  );
}

// --- Helpers ---
const MathEquation = ({ prefix, top, bottom, suffix }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Cambria Math", "Times New Roman", serif',
    fontSize: '14.5px',
    background: 'rgba(0,0,0,0.4)',
    padding: '8px 10px',
    borderRadius: '10px',
    margin: '6px 0',
    border: '1px solid rgba(255,255,255,0.08)'
  }}>
    <span style={{ marginRight: '6px' }}>{prefix}</span>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ borderBottom: '1px solid rgba(255,255,255,0.8)', padding: '0 6px', paddingBottom: '1px', marginBottom: '1px' }}>{top}</span>
      <span>{bottom}</span>
    </div>
    {suffix && <span style={{ marginLeft: '6px' }}>{suffix}</span>}
  </div>
);

const MiniWaveShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MiniWaveFragment = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float glow = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    float flow = sin(vUv.x * 20.0 - uTime * 4.0) * 0.5 + 0.5;
    float intensity = 1.0 + flow * 2.0;
    vec3 finalColor = uColor * glow * 4.0 * intensity;
    gl_FragColor = vec4(finalColor, glow * (0.6 + 0.6 * flow));
  }
`;

const CrestCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-2, 0, 0),
  new THREE.Vector3(-1, 0.8, 0),
  new THREE.Vector3(0, 1.2, 0),
  new THREE.Vector3(1, 0.8, 0),
  new THREE.Vector3(2, 0, 0)
]);

const TroughCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-2, 0, 0),
  new THREE.Vector3(-1, -0.8, 0),
  new THREE.Vector3(0, -1.2, 0),
  new THREE.Vector3(1, -0.8, 0),
  new THREE.Vector3(2, 0, 0)
]);

const MiniWaveRibbon = ({ isCrest, color }) => {
  const materialRef = useRef();
  
  // Memoize uniforms: prevents new THREE.Color allocation on every render
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uTime: { value: 0 }
  }), [color]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh>
      <tubeGeometry args={[isCrest ? CrestCurve : TroughCurve, 64, 0.32, 16, false]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={MiniWaveShader}
        fragmentShader={MiniWaveFragment}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

// --- DOM Overlays ---
function InterferenceOverlay({ theme, stage, setStage, subStage, setSubStage, interferencePhase, setPhase, isSidebarOpen, audio, onNext, onPrev }) {
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isAutoPopped, setIsAutoPopped] = useState(true);
  // Tracks which audio zone the phase slider currently sits in, so the
  // constructive/destructive swells only fire on entering a zone, not on
  // every change event inside it
  const audioZoneRef = useRef(null);

  // Auto-pop the tooltip for 3 seconds every 3 seconds, unless hovered
  useEffect(() => {
    if (stage !== 2 || subStage !== 5) {
      setIsAutoPopped(false);
      return;
    }

    setIsAutoPopped(true);

    let hideTimer = null;
    // Show for 3s, hide for 3s (6s total cycle)
    const interval = setInterval(() => {
      setIsAutoPopped(true);
      hideTimer = setTimeout(() => {
        setIsAutoPopped(false);
      }, 3000);
    }, 6000);

    hideTimer = setTimeout(() => {
      setIsAutoPopped(false);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(hideTimer);
    };
  }, [stage, subStage]);

  const showSandboxTooltip = isButtonHovered || isAutoPopped;

  // Slide out panels
  const panelStyle = {
    position: 'absolute', top: '40px', right: '40px', width: '380px', pointerEvents: 'auto',
    background: 'var(--glass-bg-base)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: 'var(--glass-border-base)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)', 
    color: '#e2e8f0',
    fontFamily: "'Inter', sans-serif",
    animation: 'fadeIn 0.5s ease-out forwards'
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hintFadeInOut {
          0% { opacity: 0; transform: translateY(8px) scale(0.96); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          82% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.96); }
        }
      `}</style>
         {/* STAGE 1: Cinematic Intro Panel — Glass, scrollable, never overflows */}
      {stage === 1 && subStage === 1 && (
        <div style={{
          position: 'absolute',
          top: '72px', // clears the floating tab bar (12px + 48px + gap)
          bottom: '12px',
          right: '36px',
          width: '390px',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          animation: 'lgSlideIn 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          zIndex: 20,
        }} data-jelly-host>
          <style>{`
            @keyframes lgSlideIn {
              from { opacity: 0; transform: translateX(24px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            @keyframes lgCtaGlow {
              0%,100% { box-shadow: 0 0 10px 1px rgba(0,229,255,0.3), 0 2px 18px rgba(0,229,255,0.18); }
              50%      { box-shadow: 0 0 22px 5px rgba(0,229,255,0.58), 0 4px 32px rgba(0,229,255,0.38); }
            }
            .lg-cta-btn:hover {
              background: linear-gradient(90deg, rgba(0,229,255,0.28) 0%, rgba(167,139,250,0.28) 100%) !important;
              transform: translateY(-1px);
              box-shadow: 0 0 32px 8px rgba(0,229,255,0.7), 0 6px 36px rgba(0,229,255,0.42) !important;
            }
            .lg-type-card { transition: background 0.2s, border-color 0.2s, transform 0.2s; }
            .lg-type-card:hover { transform: translateX(3px); }
            .lg-scroll::-webkit-scrollbar { width: 4px; }
            .lg-scroll::-webkit-scrollbar-track { background: transparent; }
            .lg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
            .lg-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.35); }
          `}</style>

          {/* Outer shell — specular top edge + ambient glow */}
          <div className="glass-interactive" data-jelly style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '24px',
            /* Layered glass background */
            background: 'var(--glass-bg-base)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            /* Specular rim — top-left bright, bottom-right dark */
            border: 'var(--glass-border-base)',
            boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
            overflow: 'hidden',
          }}>

            {/* Subtle noise texture overlay for depth */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '22px', pointerEvents: 'none',
              background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.035\'/%3E%3C/svg%3E")',
              opacity: 0.6, zIndex: 0,
            }} />

            {/* Scrollable content */}
            <div className="lg-scroll" style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '24px 22px 20px',
              position: 'relative',
              zIndex: 1,
            }}>

              {/* ── Header ── */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: '700', letterSpacing: '2.5px', color: 'rgba(0,229,255,0.75)', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 7px #00e5ff, 0 0 14px rgba(0,229,255,0.4)', flexShrink: 0 }} />
                  Quantum Interference
                </div>
              </div>

              {/* ── Experiment ── */}
              <div style={{ marginBottom: '14px' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', fontFamily: "'Inter', sans-serif", background: 'linear-gradient(95deg, #e8f4ff 0%, #c084fc 55%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.2px' }}>The Experiment — Mach-Zehnder</h2>
                <p style={{ margin: '0 0 10px', fontSize: '12.5px', lineHeight: '1.72', color: 'rgba(190,210,235,0.8)', fontFamily: "'Inter', sans-serif" }}>
                  A single photon enters a <strong style={{ color: '#e8f4ff', fontWeight: '600' }}>beam splitter (H-Gate)</strong>, splitting into two quantum paths at once. A second splitter merges them. Depending on relative phase, the photon only exits from one detector — steered purely by interference.
                </p>

                {/* Math box */}
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: '14px',
                  padding: '13px 14px',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '11px', color: 'rgba(148,163,184,0.75)', marginBottom: '5px', fontFamily: "'Inter', sans-serif" }}>After H-Gate (Beam Splitter)</div>
                  <div style={{ fontSize: '14.5px', color: '#e8f4ff' }}>
                    <InlineMath math={String.raw`H|0\rangle = \tfrac{|0\rangle + |1\rangle}{\sqrt{2}}`} />
                  </div>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '9px 0' }} />
                  <div style={{ fontSize: '11px', color: 'rgba(148,163,184,0.75)', marginBottom: '5px', fontFamily: "'Inter', sans-serif" }}>After Z-Gate Phase Shift + 2nd H-Gate</div>
                  <div style={{ fontSize: '14.5px', color: '#e8f4ff' }}>
                    <InlineMath math={String.raw`H(Z \cdot H|0\rangle) = |1\rangle`} />
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'rgba(100,116,139,0.9)', marginTop: '7px', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>The qubit is steered deterministically — pure interference.</div>
                </div>
              </div>

              {/* ── Separator ── */}
              <div style={{ height: '1px', margin: '16px 0', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1) 30%, rgba(192,132,252,0.15) 50%, rgba(255,255,255,0.1) 70%, transparent)' }} />

              {/* ── Types ── */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(192,132,252,0.85)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>Two Types of Interference</div>

                {/* Constructive */}
                <div className="lg-type-card" style={{
                  display: 'flex', gap: '11px', alignItems: 'flex-start',
                  background: 'linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(0,229,255,0.03) 100%)',
                  border: '1px solid rgba(0,229,255,0.2)',
                  boxShadow: 'inset 0 1px 0 rgba(0,229,255,0.08)',
                  borderRadius: '14px', padding: '11px 13px', marginBottom: '9px',
                }}>
                  <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.25) 0%, rgba(0,229,255,0.06) 100%)', border: '1px solid rgba(0,229,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', marginTop: '1px' }}>↑↑</div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#00e5ff', marginBottom: '3px', fontFamily: "'Inter', sans-serif", letterSpacing: '0.1px' }}>Constructive Interference</div>
                    <div style={{ fontSize: '11.5px', color: 'rgba(180,200,225,0.75)', lineHeight: '1.65', fontFamily: "'Inter', sans-serif" }}>Crests meet crests — amplitudes <em>add</em>, boosting probability. The qubit exits one detector with certainty.</div>
                    <div style={{ marginTop: '7px', fontSize: '13px', color: '#e8f4ff' }}>
                      <InlineMath math={String.raw`A + A = 2A \;\Rightarrow\; P = 100\%`} />
                    </div>
                  </div>
                </div>

                {/* Destructive */}
                <div className="lg-type-card" style={{
                  display: 'flex', gap: '11px', alignItems: 'flex-start',
                  background: 'linear-gradient(135deg, rgba(217,70,239,0.08) 0%, rgba(217,70,239,0.03) 100%)',
                  border: '1px solid rgba(217,70,239,0.2)',
                  boxShadow: 'inset 0 1px 0 rgba(217,70,239,0.08)',
                  borderRadius: '14px', padding: '11px 13px',
                }}>
                  <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,70,239,0.25) 0%, rgba(217,70,239,0.06) 100%)', border: '1px solid rgba(217,70,239,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', marginTop: '1px' }}>↑↓</div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#d946ef', marginBottom: '3px', fontFamily: "'Inter', sans-serif", letterSpacing: '0.1px' }}>Destructive Interference</div>
                    <div style={{ fontSize: '11.5px', color: 'rgba(180,200,225,0.75)', lineHeight: '1.65', fontFamily: "'Inter', sans-serif" }}>Crests meet troughs — amplitudes <em>cancel</em>, erasing probability. The qubit never exits that detector.</div>
                    <div style={{ marginTop: '7px', fontSize: '13px', color: '#e8f4ff' }}>
                      <InlineMath math={String.raw`A - A = 0 \;\Rightarrow\; P = 0\%`} />
                    </div>
                  </div>
                </div>
              </div>

            </div>{/* end scroll */}

            {/* ── CTA — sticky at bottom, outside scroll ── */}
            <div style={{ padding: '0 22px 20px', position: 'relative', zIndex: 1 }}>
              {/* Subtle separator above CTA */}
              <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', marginBottom: '14px' }} />
              <button
                className="quantum-nav-btn glass-btn glass-interactive"
                onClick={() => setStage(2)}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '999px',
                  '--nav-border': '#00f2fe',
                  '--nav-color': '#00f2fe',
                  '--nav-glow': 'rgba(0, 242, 254, 0.4)',
                }}
              >
                <span>Explore Quantum Interference</span>
                <span>→</span>
              </button>
            </div>

          </div>{/* end outer shell */}
        </div>
      )}

      {/* Top-Left Notation Tooltip (Visible in Stage 2 & Stage 3) */}
      {((stage === 2 && subStage >= 1) || stage === 3) && (
        <div style={{
          ...panelStyle,
          top: '20px',
          left: '20px',
          right: 'auto',
          bottom: 'auto',
          width: '180px',
          padding: '12px 14px',
          background: 'var(--glass-bg-base)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: 'var(--glass-border-base)',
          borderRadius: '18px',
          boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
          zIndex: 25
        }}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.5px', color: '#c084fc', textTransform: 'uppercase', marginBottom: '2px', textAlign: 'center' }}>
            Wave Notation
          </div>
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '6px' }}>
            <div style={{ position: 'relative', width: '100%', height: '100px' }}>
              <QualityCanvas gl={{ powerPreference: 'high-performance', alpha: true }} camera={{ position: [0, 0, 4] }}>
                <group position={[0, 0.6, 0]}>
                  <MiniWaveRibbon isCrest={true} color="#00e5ff" />
                </group>
                <group position={[0, -0.6, 0]}>
                  <MiniWaveRibbon isCrest={false} color="#f093fb" />
                </group>
              </QualityCanvas>
              
              <div style={{ position: 'absolute', top: '-2px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#00e5ff' }}>Crest (+)</div>
              <div style={{ position: 'absolute', bottom: '-2px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#f093fb' }}>Trough (—)</div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: Guided Core Panel */}
      {stage === 2 && (
        <>
          {subStage < 5 && (
            <div key={`guided-step-${subStage}`} style={{
              ...panelStyle,
              top: 'auto',
              bottom: '24px',
              right: 'auto',
              left: '24px',
              width: 'auto',
              maxWidth: '360px',
              padding: '14px 18px',
              borderRadius: '18px'
            }}>
              {subStage === 0 && <p style={{ margin: 0, fontSize: '15px' }}>Drag the <strong>H-Gate</strong> onto the sphere to split the probability wave.</p>}
              {subStage === 1 && <p style={{ margin: 0, fontSize: '15px', color: COLORS.primary }}>The wave splits into two paths.</p>}
              {subStage === 2 && <p style={{ margin: 0, fontSize: '15px' }}>Drag the <strong>Z-Gate</strong> to apply a Phase Shift.</p>}
              {subStage === 3 && <p style={{ margin: 0, fontSize: '15px', color: COLORS.secondary }}>The magenta wave is shifted 180° out of phase.</p>}
              {subStage === 4 && <p style={{ margin: 0, fontSize: '15px' }}>Drag the <strong>2nd H-Gate</strong> to recombine the interfering paths.</p>}
            </div>
          )}

          {/* SubStage 5: Centered Button with Recurring 3-Second Pop-up Tooltip */}
          {subStage === 5 && (
            <div style={{
              position: 'absolute',
              bottom: '28px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'auto',
              zIndex: 30
            }}>
              {/* 3-Second Auto/Hover Pop-up Hint Tooltip */}
              <div style={{
                marginBottom: '10px',
                padding: '7px 16px',
                background: 'var(--glass-bg-base)',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                border: '1px solid rgba(110, 231, 183, 0.5)',
                borderRadius: '20px',
                boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
                color: '#f1f5f9',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                opacity: showSandboxTooltip ? 1 : 0,
                transform: showSandboxTooltip ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
                pointerEvents: 'none',
                transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <span style={{ fontSize: '14px' }}>✨</span>
                <span>Visualize constructive & destructive interference with live interaction.</span>
              </div>

              {/* Centered Button */}
              <button
                className="glass-btn glass-interactive"
                onClick={() => {
                  setStage(3);
                  setSubStage(0);
                  setPhase(Math.PI);
                }}
                onMouseEnter={() => setIsButtonHovered(true)}
                onMouseLeave={() => setIsButtonHovered(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: isButtonHovered 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.45) 0%, rgba(6, 182, 212, 0.45) 100%)'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.30) 0%, rgba(6, 182, 212, 0.30) 100%)',
                  backdropFilter: 'blur(36px) saturate(210%)',
                  WebkitBackdropFilter: 'blur(36px) saturate(210%)',
                  border: isButtonHovered ? '1px solid rgba(110, 231, 183, 0.9)' : '1px solid rgba(110, 231, 183, 0.65)',
                  color: '#ffffff',
                  padding: '12px 28px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '0.4px',
                  boxShadow: isButtonHovered 
                    ? 'inset 0 1.2px 1.5px rgba(255,255,255,0.6), 0 16px 40px rgba(0,0,0,0.6), 0 0 32px rgba(16, 185, 129, 0.55)'
                    : 'inset 0 1.2px 1.5px rgba(255,255,255,0.45), 0 12px 32px rgba(0,0,0,0.5), 0 0 24px rgba(16, 185, 129, 0.35)',
                  transform: isButtonHovered ? 'scale(1.03)' : 'scale(1)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  userSelect: 'none'
                }}
              >
                <span>Enter Interactive Sandbox</span>
                <span style={{ fontSize: '16px' }}>→</span>
              </button>
            </div>
          )}

          {/* Educational Tooltips (Top Right) */}
          {(subStage === 1 || subStage === 2) && (
            <div key="tooltip-h1" style={{
              ...panelStyle,
              top: '20px',
              right: '20px',
              bottom: 'auto',
              left: 'auto',
              width: '290px',
              padding: '14px 16px',
              borderRadius: '18px'
            }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.5px', color: '#00e5ff', textTransform: 'uppercase', marginBottom: '4px' }}>
                Hadamard Split
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#fff' }}>What Just Happened?</h3>
              <p style={{ margin: '0 0 6px 0', fontSize: '11.5px', lineHeight: '1.5', color: '#cbd5e1' }}>
                The first <strong>H-Gate</strong> placed the qubit into a superposition.
              </p>
              <MathEquation prefix="H|0⟩ =" top="|0⟩ + |1⟩" bottom="√2" />
              <p style={{ margin: 0, fontSize: '11.5px', lineHeight: '1.5', color: '#cbd5e1' }}>
                It mathematically split the initial state into two equal probability paths: a |0⟩ path (Cyan) and a |1⟩ path (Magenta). Notice how both waves are perfectly in phase.
              </p>
            </div>
          )}

          {(subStage === 3 || subStage === 4) && (
            <div key="tooltip-z" style={{
              ...panelStyle,
              top: '20px',
              right: '20px',
              bottom: 'auto',
              left: 'auto',
              width: '290px',
              padding: '14px 16px',
              borderRadius: '18px'
            }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.5px', color: '#d946ef', textTransform: 'uppercase', marginBottom: '4px' }}>
                Phase Inversion
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#fff' }}>What Just Happened?</h3>
              <p style={{ margin: '0 0 6px 0', fontSize: '11.5px', lineHeight: '1.5', color: '#cbd5e1' }}>
                The <strong>Z-Gate</strong> applied a 180° (π) phase shift to the |1⟩ path.
              </p>
              <MathEquation prefix="Z|+⟩ =" top="|0⟩ - |1⟩" bottom="√2" suffix="= |-⟩" />
              <p style={{ margin: 0, fontSize: '11.5px', lineHeight: '1.5', color: '#cbd5e1' }}>
                This mathematically flips the sign of the |1⟩ component. Notice how the Magenta wave has shifted so its crests align with the troughs of the Cyan wave, setting up destructive interference!
              </p>
            </div>
          )}

          {subStage === 5 && (
            <div key="tooltip-h2" style={{
              ...panelStyle,
              top: '20px',
              right: '20px',
              bottom: 'auto',
              left: 'auto',
              width: '290px',
              padding: '14px 16px',
              borderRadius: '18px'
            }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.5px', color: '#6ee7b7', textTransform: 'uppercase', marginBottom: '4px' }}>
                Recombination
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#fff' }}>What Just Happened?</h3>
              <p style={{ margin: '0 0 6px 0', fontSize: '11.5px', lineHeight: '1.5', color: '#cbd5e1' }}>
                The second <strong>H-Gate</strong> recombined the two interfering probability paths.
              </p>
              <MathEquation prefix="H|-⟩ =" top="|0⟩ - |1⟩" bottom="√2" suffix="= |1⟩" />
              <p style={{ margin: 0, fontSize: '11.5px', lineHeight: '1.5', color: '#cbd5e1' }}>
                Amplitudes on the |0⟩ path canceled out (1 - 1 = 0), while amplitudes on the |1⟩ path added constructively (1 + 1 = 2), steering the qubit deterministically into <strong>Detector |1⟩</strong>!
              </p>
            </div>
          )}
        </>
      )}

      {/* STAGE 3: Compact, Non-Overlapping Interactive Sandbox Master Control Panel */}
      {stage === 3 && (() => {
        const normPhase = Math.abs(interferencePhase);
        const isConstructive = normPhase < 0.15 || Math.abs(normPhase - 2 * Math.PI) < 0.15;
        const isDestructive = Math.abs(normPhase - Math.PI) < 0.15;
        const isSuperposition = Math.abs(normPhase - Math.PI / 2) < 0.15;
        const prob0 = Math.pow(Math.cos(interferencePhase / 2), 2);
        const prob1 = Math.pow(Math.sin(interferencePhase / 2), 2);
        const deg = Math.round((interferencePhase * 180) / Math.PI);

        return (
          <>
            {/* ── Compact Left Sandbox Control Card ── */}
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              width: '320px',
              pointerEvents: 'auto',
              background: 'var(--glass-bg-thick)',
              backdropFilter: 'var(--glass-blur-thick)',
              WebkitBackdropFilter: 'var(--glass-blur-thick)',
              border: 'var(--glass-border-base)',
              borderRadius: '24px',
              padding: '18px 20px',
              boxShadow: 'var(--glass-highlight), var(--glass-highlight-bottom), var(--glass-shadow-base)',
              color: '#f8fafc',
              fontFamily: "'Inter', system-ui, sans-serif",
              zIndex: 25,
              animation: 'fadeIn 0.4s ease-out forwards'
            }}>
              {/* Header with Title and Mode Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(0,229,255,0.8)', textTransform: 'uppercase' }}>
                    Interactive Sandbox
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginTop: '1px' }}>
                    Phase: {(interferencePhase / Math.PI).toFixed(2)}π <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>({deg}°)</span>
                  </div>
                </div>

                {/* Dynamic Status Badge */}
                <div style={{
                  padding: '3px 8px',
                  borderRadius: '16px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  background: isConstructive ? 'rgba(0, 229, 255, 0.15)' : isDestructive ? 'rgba(244, 63, 94, 0.15)' : isSuperposition ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${isConstructive ? '#00e5ff' : isDestructive ? '#f43f5e' : isSuperposition ? '#c084fc' : 'rgba(255,255,255,0.15)'}`,
                  color: isConstructive ? '#00e5ff' : isDestructive ? '#f43f5e' : isSuperposition ? '#c084fc' : '#94a3b8',
                  boxShadow: `0 0 10px ${isConstructive ? 'rgba(0,229,255,0.25)' : isDestructive ? 'rgba(244,63,94,0.25)' : 'transparent'}`,
                  whiteSpace: 'nowrap'
                }}>
                  {isConstructive ? '✨ CONSTRUCTIVE' : isDestructive ? '💥 DESTRUCTIVE' : isSuperposition ? '⚖️ BALANCED' : '✦ PARTIAL'}
                </div>
              </div>

              {/* Interactive Range Slider */}
              <div style={{ marginBottom: '12px' }}>
                <GlassSlider
                  min={-Math.PI} 
                  max={Math.PI} 
                  step={0.01} 
                  value={interferencePhase}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setPhase(val);

                    const norm = Math.abs(val);
                    const zone = norm < 0.05 ? 'constructive'
                      : Math.abs(norm - Math.PI) < 0.05 ? 'destructive'
                      : null;
                    if (zone !== audioZoneRef.current) {
                      audioZoneRef.current = zone;
                      if (zone === 'constructive' && audio?.playConstructive) audio.playConstructive();
                      else if (zone === 'destructive' && audio?.playDestructive) audio.playDestructive();
                    }
                  }}
                  color={isConstructive ? '#00e5ff' : isDestructive ? '#f43f5e' : '#c084fc'}
                  track="linear-gradient(90deg, #f43f5e 0%, #c084fc 25%, #00e5ff 50%, #c084fc 75%, #f43f5e 100%)"
                  format={(v) => `${(v / Math.PI).toFixed(2)}π`}
                  aria-label="Relative phase"
                  style={{ margin: '4px 0' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', fontWeight: 600 }}>
                  <span>-π</span>
                  <span>-π/2</span>
                  <span style={{ color: '#00e5ff', fontWeight: 700 }}>0</span>
                  <span>+π/2</span>
                  <span>+π</span>
                </div>
              </div>

              {/* 1-Tap Quick Presets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                <button
                  className="glass-btn glass-interactive"
                  onClick={() => {
                    setPhase(0);
                    if (audioZoneRef.current !== 'constructive') {
                      audioZoneRef.current = 'constructive';
                      if (audio?.playConstructive) audio.playConstructive();
                    }
                  }}
                  style={{
                    height: '36px',
                    borderRadius: '999px',
                    background: isConstructive ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(30px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                    border: `1px solid ${isConstructive ? 'rgba(56, 189, 248, 0.85)' : 'rgba(255, 255, 255, 0.15)'}`,
                    color: isConstructive ? '#38bdf8' : '#cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isConstructive ? 'inset 0 1px 1px rgba(255,255,255,0.4), 0 0 16px rgba(56,189,248,0.35)' : 'none'
                  }}
                >
                  0 (|0⟩)
                </button>
                <button
                  className="glass-btn glass-interactive"
                  onClick={() => {
                    setPhase(Math.PI / 2);
                    audioZoneRef.current = null;
                  }}
                  style={{
                    height: '36px',
                    borderRadius: '999px',
                    background: isSuperposition ? 'rgba(192, 132, 252, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(30px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                    border: `1px solid ${isSuperposition ? 'rgba(192, 132, 252, 0.85)' : 'rgba(255, 255, 255, 0.15)'}`,
                    color: isSuperposition ? '#c084fc' : '#cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSuperposition ? 'inset 0 1px 1px rgba(255,255,255,0.4), 0 0 16px rgba(192,132,252,0.35)' : 'none'
                  }}
                >
                  π/2 (50/50)
                </button>
                <button
                  className="glass-btn glass-interactive"
                  onClick={() => {
                    setPhase(Math.PI);
                    if (audioZoneRef.current !== 'destructive') {
                      audioZoneRef.current = 'destructive';
                      if (audio?.playDestructive) audio.playDestructive();
                    }
                  }}
                  style={{
                    height: '36px',
                    borderRadius: '999px',
                    background: isDestructive ? 'rgba(244, 63, 94, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(30px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                    border: `1px solid ${isDestructive ? 'rgba(244, 63, 94, 0.85)' : 'rgba(255, 255, 255, 0.15)'}`,
                    color: isDestructive ? '#f43f5e' : '#cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isDestructive ? 'inset 0 1px 1px rgba(255,255,255,0.4), 0 0 16px rgba(244,63,94,0.35)' : 'none'
                  }}
                >
                  π (|1⟩)
                </button>
              </div>

              {/* Real-time Quantum Detection Probability Gauges */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '12px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  Detection Probabilities
                </div>

                {/* Detector 0 (Cyan) */}
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span style={{ color: '#00e5ff', fontWeight: 600 }}>Detector 0 (|0⟩)</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{(prob0 * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${prob0 * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #0ea5e9, #00e5ff)',
                      boxShadow: '0 0 8px rgba(0,229,255,0.6)',
                      transition: 'width 0.1s ease-out'
                    }} />
                  </div>
                </div>

                {/* Detector 1 (Magenta) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span style={{ color: '#f093fb', fontWeight: 600 }}>Detector 1 (|1⟩)</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{(prob1 * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${prob1 * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #c026d3, #f093fb)',
                      boxShadow: '0 0 8px rgba(240,147,251,0.6)',
                      transition: 'width 0.1s ease-out'
                    }} />
                  </div>
                </div>
              </div>

              {/* Reset Button */}
              <button 
                className="action-btn compact glass-btn glass-interactive"
                onClick={() => { setPhase(0); setSubStage(0); audioZoneRef.current = 'constructive'; }}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  color: '#38bdf8',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                ↺ Reset Sandbox
              </button>
            </div>

            {/* ── Compact Top-Right Quantum State & Theory Insight Card ── */}
            <div style={{
              ...panelStyle,
              top: '20px',
              right: '20px',
              width: '290px',
              padding: '14px 16px',
              background: 'var(--glass-bg-base)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: 'var(--glass-border-base)',
              borderRadius: '18px',
              boxShadow: 'var(--glass-highlight), var(--glass-shadow-base)',
              zIndex: 25
            }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.5px', color: isConstructive ? '#00e5ff' : isDestructive ? '#f43f5e' : '#c084fc', textTransform: 'uppercase', marginBottom: '4px' }}>
                {isConstructive ? 'Constructive' : isDestructive ? 'Destructive' : 'Superposition'}
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                {isConstructive ? 'Crests Align (+)' : isDestructive ? 'Crests Meet Troughs (—)' : 'Phase Steering'}
              </h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', lineHeight: '1.5', color: '#cbd5e1' }}>
                {isConstructive
                  ? 'Waves align in-phase (0 rad). Amplitudes add (1+1), directing 100% of state into Detector |0⟩.'
                  : isDestructive
                  ? 'Magenta wave is inverted (π rad). Amplitudes cancel (1-1=0), directing 100% into Detector |1⟩.'
                  : `Relative phase ${(interferencePhase / Math.PI).toFixed(2)}π steers quantum superposition probabilities smoothly.`
                }
              </p>

              {/* Dynamic State KaTeX Formula */}
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Output State (up to global phase):</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
                  <InlineMath math={String.raw`|\psi\rangle = \cos(\tfrac{\phi}{2})|0\rangle - i\sin(\tfrac{\phi}{2})|1\rangle`} />
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* 🚀 Dynamic Bottom-Right Navigation Controller for Stages 2 & 3 🚀 */}
      {stage > 1 && (
        <QuantumNavButtons
          canPrev={stage > 1}
          canNext={stage < 3}
          onPrev={onPrev}
          onNext={onNext}
          prevLabel="Prev"
          nextLabel={stage === 2 ? "Interactive Sandbox" : "Complete"}
          isLast={stage === 3}
          accentColor="#0ea5e9"
          containerStyle={{
            position: 'absolute',
            bottom: '32px',
            right: '32px',
            zIndex: 300,
          }}
        />
      )}
    </div>
  );
}

// --- Main Module Component ---
export default function InterferenceModule({ theme, isSidebarOpen, isGlobalMuted, fromHub = false }) {
  const [stage, setStage] = useState(1);
  const [subStage, setSubStage] = useState(0); 
  const [interferencePhase, setInterferencePhase] = useState(0); 
  
  const audio = useInterferenceAudio(!!isGlobalMuted);

  // Init audio on mount (user already clicked sidebar = valid gesture)
  useEffect(() => {
    audio.initAudio().catch(() => {});
    return () => audio.stopAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Mount Intro Animation (Stage 1)
  useEffect(() => {
    if (stage === 1 && subStage === 0) {
      const timer = setTimeout(() => {
        setSubStage(1);
      }, 4000); // Matches the 4s cinematic pan
      return () => clearTimeout(timer);
    }
  }, [stage, subStage]);

  const handleNext = () => {
    if (stage === 1) {
      setStage(2);
      setSubStage(0);
    } else if (stage === 2) {
      setStage(3);
      setSubStage(0);
      setInterferencePhase(Math.PI);
    }
  };

  const handlePrev = () => {
    if (stage === 3) {
      setStage(2);
      setSubStage(0);
    } else if (stage === 2) {
      setStage(1);
      setSubStage(0);
    }
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
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <SharedCanvas
          sceneId="bit-scene"
          gl={SCENE_GL}
        >
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <IntroLights ramp={fromHub} />
          {stage === 3 && (
            <OrbitControls 
              enablePan={false} 
              enableZoom={true} 
              enableRotate={true} 
            />
          )}
          <Suspense fallback={null}>
            <InterferenceScene 
              theme={theme}
              stage={stage}
              subStage={subStage}
              setSubStage={setSubStage}
              interferencePhase={interferencePhase}
              isSidebarOpen={isSidebarOpen}
              audio={audio}
              fromHub={fromHub}
            />
          </Suspense>
        </SharedCanvas>
      </div>
      <div style={uiBoundsStyle}>
        <InterferenceOverlay
          stage={stage}
          subStage={subStage}
          onNext={handleNext}
          onPrev={handlePrev}
          setStage={(s) => { 
            setStage(s); 
            setSubStage(0); 
            setInterferencePhase(0); 
            if (s === 3 && audio?.playDestructive) audio.playDestructive();
          }}
          setSubStage={setSubStage}
          interferencePhase={interferencePhase}
          setPhase={setInterferencePhase}
          isSidebarOpen={isSidebarOpen}
          audio={audio}
        />
      </div>
    </>
  );
}
