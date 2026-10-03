import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { InlineMath } from 'react-katex';

import { QubitCore } from './BlochSphere';
import { EntanglementTether } from './EntanglementTether';
import { useEntanglementAudio } from './useEntanglementAudio';
import CameraShifter from './CameraShifter';
import { QuantumNavButtons } from './QuantumNavButtons';
import { SCENE_GL } from './sceneGl';
import GlassSlider from './GlassSlider';
import { QualityComposer } from './QualityScene';
import { SharedCanvas } from './SharedCanvas';
import { handoff } from './handoff';


// ==========================================
// 4 MAXIMALLY ENTANGLED BELL STATES
// ==========================================
export const BELL_STATES = [
  {
    id: 'phi_plus',
    name: '|\\Phi^+\\rangle',
    title: 'Bell State |\\Phi^+\\rangle (Parallel Correlated)',
    math: '|\\Phi^+\\rangle = \\frac{|00\\rangle + |11\\rangle}{\\sqrt{2}}',
    color: '#00f2fe',
    accentColor: '#38bdf8',
    description: 'When Alice measures |0⟩, Bob is guaranteed to be |0⟩. When Alice measures |1⟩, Bob is guaranteed to be |1⟩.',
    outcomes: ['00', '11'],
    correlationText: '100% Identical Outcomes (|00⟩ or |11⟩)'
  },
  {
    id: 'phi_minus',
    name: '|\\Phi^-\\rangle',
    title: 'Bell State |\\Phi^-\\rangle (Phase-Inverted)',
    math: '|\\Phi^-\\rangle = \\frac{|00\\rangle - |11\\rangle}{\\sqrt{2}}',
    color: '#a855f7',
    accentColor: '#c084fc',
    description: 'Identical measurement outcomes to |\\Phi^+\\rangle, but with a relative \\pi (180°) quantum phase shift between basis components.',
    outcomes: ['00', '11'],
    correlationText: '100% Identical Outcomes with -1 Phase (|00⟩ or |11⟩)'
  },
  {
    id: 'psi_plus',
    name: '|\\Psi^+\\rangle',
    title: 'Bell State |\\Psi^+\\rangle (Anti-Correlated)',
    math: '|\\Psi^+\\rangle = \\frac{|01\\rangle + |10\\rangle}{\\sqrt{2}}',
    color: '#ec4899',
    accentColor: '#f472b6',
    description: 'When Alice measures |0⟩, Bob is guaranteed to be |1⟩. When Alice measures |1⟩, Bob is guaranteed to be |0⟩.',
    outcomes: ['01', '10'],
    correlationText: '100% Opposite Outcomes (|01⟩ or |10⟩)'
  },
  {
    id: 'psi_minus',
    name: '|\\Psi^-\\rangle',
    title: 'Bell State |\\Psi^-\\rangle (Singlet State)',
    math: '|\\Psi^-\\rangle = \\frac{|01\\rangle - |10\\rangle}{\\sqrt{2}}',
    color: '#f59e0b',
    accentColor: '#fbbf24',
    description: 'The famous Singlet State (S=0). It remains completely invariant under any identical simultaneous rotation of both measurement axes.',
    outcomes: ['01', '10'],
    correlationText: '100% Opposite Outcomes (Rotational Singlet)'
  }
];

// Helper quaternions for state vectors
const quat0 = new THREE.Quaternion().identity();
const quat1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
const quatSuperposition = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.5);

// ==========================================
// 3D ENTANGLEMENT SCENE
// ==========================================
function EntanglementScene({
  stage,
  subStage,
  bellState,
  isEntangled,
  measuredState,
  distanceMultiplier,
  shockwaveActive,
  shockwaveRef,
  onMeasureQubit,
  theme,
  isSidebarOpen
}) {
  const canMeasure = stage === 3 && isEntangled && !measuredState;
  const isLight = theme === 'light';
  const { camera } = useThree();

  // Dynamic positions based on distance slider
  const baseSpacing = 4.6;
  const currentSpacing = baseSpacing * distanceMultiplier;
  const posA = useMemo(() => [-currentSpacing, 0, 0], [currentSpacing]);
  const posB = useMemo(() => [currentSpacing, 0, 0], [currentSpacing]);
  // Where the pair stands, for the hub's scene to take over from when the module closes.
  useEffect(() => { handoff.entPairX = currentSpacing; }, [currentSpacing]);

  // Dynamic Quaternions for Alice & Bob
  const quatAlice = useMemo(() => {
    if (stage === 1) {
      if (subStage === 0) return quat0; // |00⟩ -> Alice is |0⟩
      if (subStage === 1) return quat1; // |10⟩ -> Alice is |1⟩
      if (subStage === 2) return quat0; // |01⟩ -> Alice remains |0⟩!
      if (subStage === 3) return quat1; // |11⟩ -> Alice is |1⟩
      return quat0;
    }
    if (stage === 2) {
      if (subStage === 0) return quat0;
      if (subStage === 1) return quatSuperposition;
      return quatSuperposition; // entangled superposition
    }
    if (measuredState) {
      const charA = measuredState[0];
      return charA === '0' ? quat0 : quat1;
    }
    return quatSuperposition;
  }, [stage, subStage, measuredState]);

  const quatBob = useMemo(() => {
    if (stage === 1) {
      if (subStage === 0) return quat0; // |00⟩ -> Bob is |0⟩
      if (subStage === 1) return quat0; // |10⟩ -> Bob remains |0⟩!
      if (subStage === 2) return quat1; // |01⟩ -> Bob is |1⟩
      if (subStage === 3) return quat1; // |11⟩ -> Bob is |1⟩
      return quat0;
    }
    if (stage === 2) {
      if (subStage < 2) return quat0;
      return quatSuperposition; // entangled
    }
    if (measuredState) {
      const charB = measuredState[1];
      return charB === '0' ? quat0 : quat1;
    }
    return quatSuperposition;
  }, [stage, subStage, measuredState]);

  // Camera tracking and centered positioning
  useEffect(() => {
    const targetZ = 14.2 + (distanceMultiplier - 1.0) * 8;
    const targetX = isSidebarOpen ? 0.6 : 0;
    gsap.to(camera.position, {
      x: targetX,
      y: 0.2,
      z: targetZ,
      duration: 1.2,
      ease: 'power2.out'
    });
  }, [distanceMultiplier, isSidebarOpen, camera]);

  return (
    <group position={[0, 0, 0]}>
      <ambientLight intensity={isLight ? 0.8 : 0.5} />
      <pointLight position={[8, 12, 8]} color="#00f2fe" intensity={isLight ? 10 : 8} distance={30} />
      <pointLight position={[-8, -12, -8]} color="#f093fb" intensity={isLight ? 10 : 8} distance={30} />

      {/* ── QUBIT A (ALICE) ── */}
      <group position={posA}>
        <QubitCore
          position={[0, 0, 0]}
          scale={1.15}
          theme={isLight ? 'light' : 'dark'}
          activeModule="entanglement"
          superpositionStep={-1}
          customVectorQuat={quatAlice}
          emissiveColor={measuredState ? (measuredState[0] === '0' ? '#00f2fe' : '#f093fb') : bellState.color}
        />

        {/* 3D Floating Name Badge */}
        <Html position={[0, 2.6, 0]} center zIndexRange={[50, 0]}>
          <div
            data-jelly
            onClick={() => { if (canMeasure) onMeasureQubit('A'); }}
            style={{
              '--j': 1,
              padding: '4px 14px',
              borderRadius: '20px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(12px)',
              border: `1.5px solid ${bellState.color}80`,
              boxShadow: `0 0 15px ${bellState.color}40`,
              color: '#fff',
              fontSize: '11.5px',
              fontWeight: '700',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              cursor: canMeasure ? 'pointer' : 'default',
              userSelect: 'none',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: bellState.color, display: 'inline-block', boxShadow: `0 0 6px ${bellState.color}` }} />
            Qubit A (Alice)
          </div>
        </Html>

        {/* Measurement Result Glow Badge */}
        {measuredState && (
          <Html position={[0, -2.6, 0]} center zIndexRange={[50, 0]}>
            <div style={{
              background: measuredState[0] === '0' ? 'rgba(0, 242, 254, 0.25)' : 'rgba(240, 147, 251, 0.25)',
              border: `1.5px solid ${measuredState[0] === '0' ? '#00f2fe' : '#f093fb'}`,
              color: '#fff',
              padding: '3px 12px',
              borderRadius: '12px',
              fontSize: '12.5px',
              fontWeight: '800',
              boxShadow: `0 0 20px ${measuredState[0] === '0' ? '#00f2fe' : '#f093fb'}80`,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Measured: <InlineMath math={String.raw`|${measuredState[0]}\rangle`} />
            </div>
          </Html>
        )}
      </group>

      {/* ── QUANTUM FLUX TETHER ── */}
      <EntanglementTether
        posA={posA}
        posB={posB}
        isEntangled={isEntangled}
        bellStateColor={bellState.color}
        shockwaveProgress={shockwaveActive ? 0 : -1}
        shockwaveRef={shockwaveRef}
      />

      {/* ── QUBIT B (BOB) ── */}
      <group position={posB}>
        <QubitCore
          position={[0, 0, 0]}
          scale={1.15}
          theme={isLight ? 'light' : 'dark'}
          activeModule="entanglement"
          superpositionStep={-1}
          customVectorQuat={quatBob}
          emissiveColor={measuredState ? (measuredState[1] === '0' ? '#00f2fe' : '#f093fb') : bellState.color}
        />

        {/* 3D Floating Name Badge */}
        <Html position={[0, 2.6, 0]} center zIndexRange={[50, 0]}>
          <div
            data-jelly
            onClick={() => { if (canMeasure) onMeasureQubit('B'); }}
            style={{
              '--j': 1,
              padding: '4px 14px',
              borderRadius: '20px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(12px)',
              border: `1.5px solid ${bellState.color}80`,
              boxShadow: `0 0 15px ${bellState.color}40`,
              color: '#fff',
              fontSize: '11.5px',
              fontWeight: '700',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              cursor: canMeasure ? 'pointer' : 'default',
              userSelect: 'none',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: bellState.color, display: 'inline-block', boxShadow: `0 0 6px ${bellState.color}` }} />
            Qubit B (Bob)
          </div>
        </Html>

        {/* Measurement Result Glow Badge */}
        {measuredState && (
          <Html position={[0, -2.6, 0]} center zIndexRange={[50, 0]}>
            <div style={{
              background: measuredState[1] === '0' ? 'rgba(0, 242, 254, 0.25)' : 'rgba(240, 147, 251, 0.25)',
              border: `1.5px solid ${measuredState[1] === '0' ? '#00f2fe' : '#f093fb'}`,
              color: '#fff',
              padding: '3px 12px',
              borderRadius: '12px',
              fontSize: '12.5px',
              fontWeight: '800',
              boxShadow: `0 0 20px ${measuredState[1] === '0' ? '#00f2fe' : '#f093fb'}80`,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Measured: <InlineMath math={String.raw`|${measuredState[1]}\rangle`} />
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

// ==========================================
// DYNAMIC "WHAT JUST HAPPENED?" TOOLTIP FOR STAGE 3
// ==========================================
function BellMeasurementTooltip({ bellState, measuredState }) {
  if (!measuredState) return null;

  const charA = measuredState[0];
  const isParallel = bellState.id === 'phi_plus' || bellState.id === 'phi_minus';

  let explanation = null;
  let mathFormula = '';

  if (bellState.id === 'phi_plus') {
    mathFormula = String.raw`\frac{|00\rangle + |11\rangle}{\sqrt{2}} \xrightarrow{\text{Measure}} |${measuredState}\rangle \quad (P = 50\%)`;
    explanation = charA === '0'
      ? <>Alice measured <InlineMath math={String.raw`|0\rangle`} />, which instantaneously collapsed the joint superposition. Because <InlineMath math={String.raw`|\Phi^+\rangle`} /> contains only <InlineMath math={String.raw`|00\rangle`} /> and <InlineMath math={String.raw`|11\rangle`} />, Bob is guaranteed with 100% certainty to collapse into <InlineMath math={String.raw`|0\rangle`} /> simultaneously!</>
      : <>Alice measured <InlineMath math={String.raw`|1\rangle`} />, forcing Bob's qubit across space to instantaneously collapse into <InlineMath math={String.raw`|1\rangle`} /> simultaneously with 100% correlation.</>;
  } else if (bellState.id === 'phi_minus') {
    mathFormula = String.raw`\frac{|00\rangle - |11\rangle}{\sqrt{2}} \xrightarrow{\text{Measure}} |${measuredState}\rangle \quad (P = 50\%)`;
    explanation = <>Even with a relative <InlineMath math={String.raw`\pi`} /> (180°) quantum phase shift (<InlineMath math={String.raw`-1`} />), measurement in the standard basis produces 100% identical outcomes. The negative phase disappears upon collapse into a classical reality.</>;
  } else if (bellState.id === 'psi_plus') {
    mathFormula = String.raw`\frac{|01\rangle + |10\rangle}{\sqrt{2}} \xrightarrow{\text{Measure}} |${measuredState}\rangle \quad (P = 50\%)`;
    explanation = charA === '0'
      ? <>Alice measured <InlineMath math={String.raw`|0\rangle`} />, which instantaneously forces Bob into the opposite state <InlineMath math={String.raw`|1\rangle`} />. In <InlineMath math={String.raw`|\Psi^+\rangle`} />, both qubits are 100% anti-correlated.</>
      : <>Alice measured <InlineMath math={String.raw`|1\rangle`} />, which instantaneously forces Bob into <InlineMath math={String.raw`|0\rangle`} />. Perfect opposite correlation is preserved.</>;
  } else if (bellState.id === 'psi_minus') {
    mathFormula = String.raw`\frac{|01\rangle - |10\rangle}{\sqrt{2}} \xrightarrow{\text{Measure}} |${measuredState}\rangle \quad (P = 50\%)`;
    explanation = <>The Singlet State (total spin <InlineMath math={String.raw`S=0`} />). Besides 100% opposite outcomes (<InlineMath math={String.raw`|01\rangle`} /> / <InlineMath math={String.raw`|10\rangle`} />), this state is uniquely rotationally invariant — measuring along any identical axis (X, Y, or Z) always yields opposite results!</>;
  }

  return (
    <div className="compact-hud-card" data-jelly style={{ '--tx': '-50%', '--j': 2,
        position: 'absolute',
        top: '168px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '330px',
        padding: '10px 16px',
        textAlign: 'center',
        zIndex: 300,
        animation: 'tooltipFadeIn 0.3s ease',
        '--card-border': `${bellState.color}95`,
        '--card-glow': `${bellState.color}35`
      }}
    >
      <div style={{
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '1.2px',
        color: bellState.color,
        textTransform: 'uppercase',
        marginBottom: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px'
      }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: bellState.color, display: 'inline-block', boxShadow: `0 0 5px ${bellState.color}` }} />
        <span>Wavefunction Collapse · <InlineMath math={bellState.name} /></span>
      </div>

      <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff', marginBottom: '3px' }}>
        What Just Happened?
      </div>

      {/* Math Visualizer Box */}
      <div style={{
        background: 'rgba(0,0,0,0.45)',
        padding: '4px 8px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        margin: '4px 0',
        fontSize: '11px',
        color: '#38bdf8'
      }}>
        <InlineMath math={mathFormula} />
      </div>

      <p style={{ margin: '0 0 5px 0', fontSize: '10.5px', color: '#cbd5e1', lineHeight: '1.4' }}>
        {explanation}
      </p>

      <div style={{
        fontSize: '9.5px',
        fontWeight: 700,
        color: isParallel ? '#38bdf8' : '#f472b6',
        letterSpacing: '0.4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px'
      }}>
        <span>⚡</span>
        {bellState.id === 'phi_plus' && <span>100% Identical Outcomes <InlineMath math={String.raw`(|00\rangle \text{ or } |11\rangle)`} /></span>}
        {bellState.id === 'phi_minus' && <span>100% Identical Outcomes with <InlineMath math={String.raw`-1`} /> Phase <InlineMath math={String.raw`(|00\rangle \text{ or } |11\rangle)`} /></span>}
        {bellState.id === 'psi_plus' && <span>100% Opposite Outcomes <InlineMath math={String.raw`(|01\rangle \text{ or } |10\rangle)`} /></span>}
        {bellState.id === 'psi_minus' && <span>100% Opposite Outcomes (Rotational Singlet)</span>}
      </div>
    </div>
  );
}

// ==========================================
// 2D INTERACTIVE OVERLAY & HUD
// ==========================================
function EntanglementOverlay({
  stage,
  onSelectStage,
  subStage,
  setSubStage,
  bellState,
  onSelectBellState,
  isEntangled,
  setIsEntangled,
  measuredState,
  triggerMeasure,
  resetMeasurement,
  distanceMultiplier,
  setDistanceMultiplier,
  historyStats,
  onNext,
  onPrev,
  audio
}) {
  const currentBell = bellState;

  return (
    <>
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* Animated Dot Trail forming arrow */
        .dot-trail {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #38bdf8;
          display: inline-block;
          opacity: 0.2;
          box-shadow: 0 0 4px #38bdf8;
          animation: dotSequence 2.6s ease-in-out infinite;
        }
        .dot-1 {
          animation-delay: 0.1s;
        }
        .dot-2 {
          animation-delay: 0.35s;
        }
        .dot-3 {
          animation-delay: 0.6s;
        }
        .dot-arrow-head {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0.2;
          filter: drop-shadow(0 0 5px #38bdf8);
          animation: dotArrowHead 2.6s ease-in-out infinite;
          animation-delay: 0.85s;
        }

        @keyframes dotSequence {
          0%, 15% {
            opacity: 0.15;
            transform: scale(0.8);
          }
          30%, 65% {
            opacity: 1;
            transform: scale(1.35);
            box-shadow: 0 0 8px #00f2fe;
          }
          85%, 100% {
            opacity: 0.25;
            transform: scale(1);
          }
        }

        @keyframes dotArrowHead {
          0%, 20% {
            opacity: 0.15;
            transform: translateX(0) scale(0.9);
          }
          40%, 75% {
            opacity: 1;
            transform: translateX(3px) scale(1.15);
            filter: drop-shadow(0 0 10px #00f2fe);
          }
          90%, 100% {
            opacity: 0.35;
            transform: translateX(0) scale(1);
          }
        }

        /* Pop Badge Animation */
        .bell-pop-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 23, 42, 0.94);
          border: 1px solid rgba(56, 189, 248, 0.5);
          border-radius: 9999px;
          padding: 5px 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.3);
          color: #38bdf8;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          user-select: none;
          animation: popBadgeSequence 2.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
          animation-delay: 1.1s;
        }

        @keyframes popBadgeSequence {
          0%, 25% {
            opacity: 0.35;
            transform: scale(0.92);
            border-color: rgba(56, 189, 248, 0.3);
          }
          45%, 85% {
            opacity: 1;
            transform: scale(1.04);
            border-color: rgba(56, 189, 248, 0.95);
            box-shadow: 0 4px 25px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.6);
          }
          100% {
            opacity: 0.5;
            transform: scale(1);
          }
        }

        /* Exact Pill Button Matching Superposition Reference */
        .quantum-pill-btn {
          height: 48px;
          padding: 0 28px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(40px) saturate(210%) brightness(110%);
          -webkit-backdrop-filter: blur(40px) saturate(210%) brightness(110%);
          border: 1px solid var(--btn-color, rgba(56, 189, 248, 0.45));
          color: var(--btn-color, #38bdf8);
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
          box-shadow: inset 0 1.2px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 1px rgba(255, 255, 255, 0.08), 0 20px 48px -10px rgba(0, 0, 0, 0.65), 0 0 24px rgba(56, 189, 248, 0.25);
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
        .quantum-pill-btn .katex-html {
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
        }
        .quantum-pill-btn .katex .base {
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
        }
        .quantum-pill-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: var(--btn-color, rgba(56, 189, 248, 0.85));
          color: #ffffff;
          box-shadow: inset 0 1.5px 2px rgba(255, 255, 255, 0.65), 0 24px 54px -10px rgba(0, 0, 0, 0.75), 0 0 32px rgba(56, 189, 248, 0.45);
          transform: translateY(-2px) scale(1.02);
        }
        .quantum-pill-btn:active {
          transform: scale(0.96) translateY(1.2px) !important;
          box-shadow: inset 0 1.5px 2px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        }

        /* Compact Stage Selector Pills */
        .entangle-stage-pill {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #94a3b8;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .entangle-stage-pill:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .entangle-stage-pill.active {
          background: rgba(0, 242, 254, 0.15);
          border-color: #00f2fe;
          color: #00f2fe;
          font-weight: 700;
          box-shadow: 0 0 12px rgba(0, 242, 254, 0.4);
        }

        /* Authentic Quantum Frosted Glass Design Matching Reference Image */
        .compact-hud-card {
          background: transparent;
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--card-border, rgba(0, 242, 254, 0.35));
          border-radius: 18px;
          padding: 12px 18px;
          color: #f8fafc;
          box-shadow: var(--glass-highlight), var(--glass-shadow-base);
          pointer-events: auto;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
      `}</style>

      {/* ── TOP CENTER: STEPPER PILLS (MOVED BELOW NAVBAR, ZERO OVERLAP) ── */}
      <div data-jelly style={{
        '--tx': '-50%',
        '--j': 0,
        position: 'absolute',
        top: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        zIndex: 300,
        alignItems: 'center',
        pointerEvents: 'auto'
      }}>
        {[
          { num: 1, label: '1. Separable' },
          { num: 2, label: '2. Entangler Circuit' },
          { num: 3, label: '3. Spooky Action Lab' },
          { num: 4, label: '4. No-Communication' }
        ].map((s) => (
          <button
            key={s.num}
            onClick={() => onSelectStage(s.num)}
            className={`entangle-stage-pill ${stage === s.num ? 'active' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── STAGE 1: COMPACT SEPARABLE CARD (BOTTOM CENTERED - INCREASED COMFORT SIZE) ── */}
      {stage === 1 && (
        <div className="compact-hud-card" data-jelly style={{ '--tx': '-50%', '--j': 2,
          pointerEvents: 'auto',
          position: 'absolute',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          padding: '16px 22px',
          textAlign: 'center',
          zIndex: 300,
          '--card-border': 'rgba(0, 242, 254, 0.65)',
          '--card-glow': 'rgba(0, 242, 254, 0.25)'
        }}>
          <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#38bdf8', marginBottom: '6px' }}>
            Independent Qubits (Unentangled)
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
            In separable states, both qubits exist independently <InlineMath math={String.raw`(|00\rangle)`} />. Knowing Alice gives zero information about Bob.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <button
              className="quantum-pill-btn"
              onClick={() => { setSubStage(0); if (audio?.playReset) audio.playReset(); }}
              style={{ padding: '7px 13px', fontSize: '11.5px', '--btn-color': subStage === 0 ? '#00f2fe' : '#94a3b8' }}
            >
              <span>State&nbsp;</span>
              <InlineMath math={String.raw`|00\rangle`} />
            </button>
            <button
              className="quantum-pill-btn"
              onClick={() => { setSubStage(1); if (audio?.playReset) audio.playReset(); }}
              style={{ padding: '7px 13px', fontSize: '11.5px', '--btn-color': subStage === 1 ? '#00f2fe' : '#94a3b8' }}
            >
              <span>Flip Alice&nbsp;(</span>
              <InlineMath math={String.raw`|10\rangle`} />
              <span>)</span>
            </button>
            <button
              className="quantum-pill-btn"
              onClick={() => { setSubStage(2); if (audio?.playReset) audio.playReset(); }}
              style={{ padding: '7px 13px', fontSize: '11.5px', '--btn-color': subStage === 2 ? '#00f2fe' : '#94a3b8' }}
            >
              <span>Flip Bob&nbsp;(</span>
              <InlineMath math={String.raw`|01\rangle`} />
              <span>)</span>
            </button>
            <button
              className="quantum-pill-btn"
              onClick={() => { setSubStage(3); if (audio?.playReset) audio.playReset(); }}
              style={{ padding: '7px 13px', fontSize: '11.5px', '--btn-color': subStage === 3 ? '#00f2fe' : '#94a3b8' }}
            >
              <span>Flip Both&nbsp;(</span>
              <InlineMath math={String.raw`|11\rangle`} />
              <span>)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE 2: COMPACT ENTANGLER CIRCUIT CARD (BOTTOM CENTERED - INCREASED COMFORT SIZE) ── */}
      {stage === 2 && (
        <div className="compact-hud-card" data-jelly style={{ '--tx': '-50%', '--j': 2,
          pointerEvents: 'auto',
          position: 'absolute',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '470px',
          padding: '16px 24px',
          textAlign: 'center',
          zIndex: 300,
          '--card-border': 'rgba(192, 132, 252, 0.65)',
          '--card-glow': 'rgba(192, 132, 252, 0.25)'
        }}>
          <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#c084fc', marginBottom: '6px' }}>
            {subStage === 0 && <>Step 1: Ground State <InlineMath math={String.raw`(|00\rangle)`} /></>}
            {subStage === 1 && <>Step 2: Apply Hadamard <InlineMath math={String.raw`(H)`} /> on Alice</>}
            {subStage === 2 && <>Step 3: Apply CNOT (Alice controls Bob) ⚡</>}
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
            {subStage === 0 && <>Two unentangled qubits initialized in the ground state <InlineMath math={String.raw`|00\rangle`} />.</>}
            {subStage === 1 && <>Hadamard puts Alice into a 50/50 superposition <InlineMath math={String.raw`\frac{|0\rangle + |1\rangle}{\sqrt{2}}`} />.</>}
            {subStage === 2 && <>CNOT fuses their wavefunctions into the entangled Bell State <InlineMath math={String.raw`|\Phi^+\rangle`} />!</>}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="quantum-pill-btn"
              onClick={() => {
                if (subStage < 2) {
                  const next = subStage + 1;
                  setSubStage(next);
                  if (audio?.playReset) audio.playReset();
                  if (next === 2) {
                    setIsEntangled(true);
                  }
                } else {
                  setSubStage(0);
                  setIsEntangled(false);
                  if (audio?.playReset) audio.playReset();
                }
              }}
              style={{ padding: '8px 22px', fontSize: '12.5px', '--btn-color': '#c084fc' }}
            >
              {subStage === 0 && '1. Apply Hadamard Gate →'}
              {subStage === 1 && '2. Apply CNOT Gate ⚡'}
              {subStage === 2 && '↺ Replay Circuit Sequence'}
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE 3: SPOOKY ACTION LAB (PERIMETER LAYOUT + DYNAMIC WHAT JUST HAPPENED TOOLTIP) ── */}
      {stage === 3 && (
        <>
          {/* Top Bell States Selector Pills (Centered) with Sequential Dot-Arrow & Pop Badge on Right */}
          <div data-jelly style={{
            '--tx': '-50%',
            '--j': 1,
            position: 'absolute',
            top: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 300,
            pointerEvents: 'auto'
          }}>
            {/* 4 Centered Bell State Pills */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {BELL_STATES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => onSelectBellState(b)}
                  className="quantum-pill-btn"
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    '--btn-color': b.color,
                    background: bellState.id === b.id ? `${b.color}25` : 'rgba(0, 18, 24, 0.7)',
                    boxShadow: bellState.id === b.id ? `0 0 16px ${b.color}80` : 'none'
                  }}
                >
                  <InlineMath math={b.name} />
                </button>
              ))}
            </div>

            {/* Attached to the Right: Animated Sequential Dot Trail + Arrow + Pop Badge */}
            <div style={{
              position: 'absolute',
              left: 'calc(100% + 12px)',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}>
              {/* Sequential Dot Trail forming Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="dot-trail dot-1" />
                <span className="dot-trail dot-2" />
                <span className="dot-trail dot-3" />
                <span className="dot-arrow-head">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block' }}
                  >
                    <line x1="3" y1="12" x2="20" y2="12" />
                    <polyline points="13 5 20 12 13 19" />
                  </svg>
                </span>
              </div>

              {/* Pop Badge */}
              <div className="bell-pop-badge">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                <span>Different Bell States</span>
              </div>
            </div>
          </div>

          {/* DYNAMIC "WHAT JUST HAPPENED?" TOOLTIP (Between Qubits at top: 172px) */}
          <BellMeasurementTooltip
            bellState={bellState}
            measuredState={measuredState}
          />

          {/* Bottom-Left: Compact Statistics Card */}
          <div className="compact-hud-card" data-jelly style={{ '--j': 2,
          pointerEvents: 'auto',
            position: 'absolute',
            bottom: '25px',
            left: '25px',
            width: '210px',
            zIndex: 300,
            '--card-border': `${currentBell.color}75`,
            '--card-glow': `${currentBell.color}25`
          }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: '6px', fontWeight: '700' }}>
              Correlation Stats (Runs: {historyStats.total})
            </div>

            {['00', '11', '01', '10'].map((pair) => {
              const count = historyStats[pair] || 0;
              const pct = historyStats.total > 0 ? Math.round((count / historyStats.total) * 100) : 0;
              const isCorrelated = bellState.outcomes.includes(pair);

              return (
                <div key={pair} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '2px', color: isCorrelated ? '#38bdf8' : '#64748b' }}>
                    <span><InlineMath math={String.raw`|${pair}\rangle`} /></span>
                    <span>{pct}% ({count})</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: isCorrelated ? currentBell.color : '#64748b',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom-Center: Compact Distance Slider Card (Positioned above Measurement Buttons) */}
          <div className="compact-hud-card" data-jelly style={{ '--tx': '-50%', '--j': 2,
          pointerEvents: 'auto',
            position: 'absolute',
            bottom: '92px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '260px',
            padding: '8px 14px',
            textAlign: 'center',
            zIndex: 300,
            '--card-border': `${currentBell.color}80`,
            '--card-glow': `${currentBell.color}30`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: '700' }}>
                Spatial Separation
              </span>
              <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: '700' }}>
                {distanceMultiplier === 1.0 && '🔬 1.0 nm (On-Chip)'}
                {distanceMultiplier > 1.0 && distanceMultiplier < 1.6 && '🛰️ 100,000 km'}
                {distanceMultiplier >= 1.6 && '🌌 1,000 Light Years'}
              </span>
            </div>
            <GlassSlider
              min="1.0"
              max="2.0"
              step="0.05"
              value={distanceMultiplier}
              onChange={(e) => {
                setDistanceMultiplier(parseFloat(e.target.value));
                if (audio?.playDistanceShift) audio.playDistanceShift();
              }}
              color={currentBell.color}
              format={(v) => `${v.toFixed(2)}×`}
              aria-label="Spatial separation"
            />
          </div>

          {/* Bottom Center Action Trigger Pill Buttons */}
          <div data-jelly style={{
            '--tx': '-50%',
            '--j': 3,
            position: 'absolute',
            bottom: '35px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '12px',
            zIndex: 300,
            pointerEvents: 'auto'
          }}>
            {!measuredState ? (
              <>
                <button
                  className="quantum-pill-btn"
                  onClick={() => triggerMeasure('A')}
                  style={{ '--btn-color': currentBell.color }}
                >
                  ⚡ Measure Alice
                </button>
                <button
                  className="quantum-pill-btn"
                  onClick={() => triggerMeasure('B')}
                  style={{ '--btn-color': '#f093fb' }}
                >
                  ⚡ Measure Bob
                </button>
              </>
            ) : (
              <button
                className="quantum-pill-btn"
                onClick={resetMeasurement}
                style={{ '--btn-color': '#38bdf8' }}
              >
                ↺ Re-Entangle & Try Again
              </button>
            )}
          </div>
        </>
      )}

      {/* ── STAGE 4: NO-COMMUNICATION THEOREM DEBUNKED (BOTTOM CENTERED - INCREASED COMFORT SIZE) ── */}
      {stage === 4 && (
        <div className="compact-hud-card" data-jelly style={{ '--tx': '-50%', '--j': 2,
          pointerEvents: 'auto',
          position: 'absolute',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '480px',
          padding: '16px 24px',
          textAlign: 'center',
          zIndex: 300,
          '--card-border': 'rgba(244, 63, 94, 0.65)',
          '--card-glow': 'rgba(244, 63, 94, 0.25)'
        }}>
          <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#f43f5e', marginBottom: '6px' }}>
            🚫 The Big Myth: Faster-Than-Light Signals?
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
            Measuring Alice instantly determines Bob, but <strong>cannot transmit information</strong>. Alice's measurements are random 50/50 noise until compared via classical lightspeed channels.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="quantum-pill-btn"
              onClick={() => onSelectStage(3)}
              style={{ padding: '8px 22px', fontSize: '12.5px', '--btn-color': '#f43f5e' }}
            >
              Back to Spooky Action Lab →
            </button>
          </div>
        </div>
      )}

      {/* 🚀 Dynamic Bottom-Right Navigation Controller 🚀 */}
      <QuantumNavButtons
        canPrev={stage > 1}
        canNext={stage < 4}
        onPrev={onPrev}
        onNext={onNext}
        prevLabel="Prev"
        nextLabel={stage < 4 ? "Next" : "Complete"}
        isLast={stage === 4}
        accentColor="#00f2fe"
        containerStyle={{
          position: 'absolute',
          bottom: '36px',
          right: '36px',
          zIndex: 300,
        }}
      />
    </>
  );
}

// ==========================================
// MAIN ENTANGLEMENT MODULE COMPONENT
// ==========================================
export default function EntanglementModule({ theme, isSidebarOpen, isGlobalMuted }) {
  const [stage, setStage] = useState(1);
  const [subStage, setSubStage] = useState(0);
  const [bellState, setBellState] = useState(BELL_STATES[0]);
  const [isEntangled, setIsEntangled] = useState(false); // stage 1 starts unentangled
  const [measuredState, setMeasuredState] = useState(null);
  const [distanceMultiplier, setDistanceMultiplier] = useState(1.0);

  // Shockwave Animation State
  // React state only mounts/unmounts the torus; per-frame progress lives in the
  // mutable ref so the gsap tween never re-renders the whole module tree.
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const shockwaveRef = useRef({ progress: -1, source: 'A' });
  const measureTweenRef = useRef(null);
  const measuringRef = useRef(false);

  // Statistics History
  const [historyStats, setHistoryStats] = useState({
    total: 0,
    '00': 0,
    '11': 0,
    '01': 0,
    '10': 0
  });

  const audio = useEntanglementAudio(!!isGlobalMuted);

  // Init audio on mount
  useEffect(() => {
    audio.initAudio().catch(() => {});
    return () => {
      cancelMeasureAnimation();
      audio.stopAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update tether state when stage changes
  useEffect(() => {
    if (stage === 1) {
      setIsEntangled(false);
      setMeasuredState(null);
    } else if (stage === 2) {
      setIsEntangled(subStage === 2);
      setMeasuredState(null);
    } else if (stage === 3) {
      setIsEntangled(true);
    } else if (stage === 4) {
      setIsEntangled(true);
    }
  }, [stage, subStage]);

  // Kill any in-flight measurement animation so its onComplete can never
  // resurrect state after navigation, Bell-state switches, or unmount
  const cancelMeasureAnimation = useCallback(() => {
    if (measureTweenRef.current) {
      measureTweenRef.current.kill();
      measureTweenRef.current = null;
    }
    measuringRef.current = false;
    shockwaveRef.current.progress = -1;
    setShockwaveActive(false);
  }, []);

  // Trigger Quantum Measurement Collapse with smooth shockwave
  const triggerMeasure = useCallback((source = 'A') => {
    if (stage !== 3 || !isEntangled || measuredState || measuringRef.current) return;

    const validOutcomes = bellState.outcomes;
    const picked = validOutcomes[Math.floor(Math.random() * validOutcomes.length)];

    measuringRef.current = true;
    shockwaveRef.current.progress = 0;
    shockwaveRef.current.source = source;
    setShockwaveActive(true);

    // Smooth GSAP animation for the traveling wave across tether
    measureTweenRef.current = gsap.to(shockwaveRef.current, {
      progress: 1.0,
      duration: 0.4,
      ease: 'power2.inOut',
      onComplete: () => {
        measureTweenRef.current = null;
        measuringRef.current = false;
        shockwaveRef.current.progress = -1;
        setShockwaveActive(false);
        setMeasuredState(picked);
        setIsEntangled(false);

        // Update tally
        setHistoryStats(prev => ({
          ...prev,
          total: prev.total + 1,
          [picked]: (prev[picked] || 0) + 1
        }));

        if (audio?.playMeasurementCollapse) {
          audio.playMeasurementCollapse(picked);
        }
      }
    });
  }, [stage, isEntangled, measuredState, bellState, audio]);

  // Reset Measurement
  const resetMeasurement = useCallback(() => {
    cancelMeasureAnimation();
    setMeasuredState(null);
    setIsEntangled(true);
    if (audio?.playReset) audio.playReset();
  }, [audio, cancelMeasureAnimation]);

  // Switching Bell states starts a fresh experiment: clear the collapse and the
  // tally so the stats card never mixes distributions from different states
  const handleSelectBellState = useCallback((b) => {
    cancelMeasureAnimation();
    setBellState(b);
    setMeasuredState(null);
    setIsEntangled(true);
    setHistoryStats({ total: 0, '00': 0, '11': 0, '01': 0, '10': 0 });
    if (audio?.playReset) audio.playReset();
  }, [audio, cancelMeasureAnimation]);

  const handleStageSelect = (num) => {
    cancelMeasureAnimation();
    setStage(num);
    setSubStage(0);
    setMeasuredState(null);
    // Mirror the stage-sync effect (subStage 0) so re-selecting the current
    // stage after a collapse still restores the entangled pair
    setIsEntangled(num >= 3);
    if (audio?.playStageTransition) audio.playStageTransition();
    else if (audio?.playHover) audio.playHover();
  };

  const handleNext = () => {
    if (stage < 4) {
      handleStageSelect(stage + 1);
    }
  };

  const handlePrev = () => {
    if (stage > 1) {
      handleStageSelect(stage - 1);
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
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <SharedCanvas
          sceneId="bit-scene"
          gl={SCENE_GL}
          camera={{ position: [0, 0.2, 13.5], fov: 45 }}
          style={{ position: 'absolute', inset: 0, zIndex: 1, willChange: 'transform', transform: 'translateZ(0)' }}
        >
          <CameraShifter isSidebarOpen={isSidebarOpen} />
          <OrbitControls makeDefault enablePan={false} enableZoom={true} enableRotate={true} minDistance={6} maxDistance={30} />
          <QualityComposer disableNormalPass multisampling={0}>
            <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.45} />
          </QualityComposer>
          <Suspense fallback={null}>
            <EntanglementScene
              stage={stage}
              subStage={subStage}
              bellState={bellState}
              isEntangled={isEntangled}
              measuredState={measuredState}
              distanceMultiplier={distanceMultiplier}
              shockwaveActive={shockwaveActive}
              shockwaveRef={shockwaveRef}
              onMeasureQubit={triggerMeasure}
              theme={theme}
              isSidebarOpen={isSidebarOpen}
            />
          </Suspense>
        </SharedCanvas>
      </div>

      {/* 2D HTML Overlay & HUD */}
      <div style={uiBoundsStyle}>
        <EntanglementOverlay
          stage={stage}
          onSelectStage={handleStageSelect}
          subStage={subStage}
          setSubStage={setSubStage}
          bellState={bellState}
          onSelectBellState={handleSelectBellState}
          isEntangled={isEntangled}
          setIsEntangled={setIsEntangled}
          measuredState={measuredState}
          triggerMeasure={triggerMeasure}
          resetMeasurement={resetMeasurement}
          distanceMultiplier={distanceMultiplier}
          setDistanceMultiplier={setDistanceMultiplier}
          historyStats={historyStats}
          onNext={handleNext}
          onPrev={handlePrev}
          audio={audio}
        />
      </div>
    </div>
  );
}
