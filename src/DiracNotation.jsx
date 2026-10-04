import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Bloom } from '@react-three/postprocessing';
import { InlineMath } from 'react-katex';
import { bornProbabilities } from './quantumMath';
import { QuantumNavButtons } from './QuantumNavButtons';
import { QualityComposer } from './QualityScene';

// ─── CONFIG ────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 0,
    title: <><InlineMath math={String.raw`|\,\rangle`} /> The Ket Notation</>,
    subtitle: <><InlineMath math={String.raw`|0\rangle`} /> — Ground State</>,
    color: '#00f2fe',
    glowColor: 'rgba(0,242,254,0.3)',
    borderColor: 'rgba(0,242,254,0.4)',
    math: '|0\\rangle = \\begin{bmatrix} 1 \\\\ 0 \\end{bmatrix}',
    theta: 0,         // vector points UP (+Y)
    phi: 0,
    desc: <>The symbol <InlineMath math={String.raw`|\,\rangle`} /> (Ket) is a physicist's way of writing a column vector. Notice how the arrow is pointing perfectly to the North Pole (the <InlineMath math={String.raw`|0\rangle`} /> axis). Look at the matrix: the top number is 1 (meaning 100% <InlineMath math={String.raw`|0\rangle`} />), and the bottom number is 0.</>,
    hint: <>Top number = amount of UP (<InlineMath math={String.raw`|0\rangle`} />). Bottom number = amount of DOWN (<InlineMath math={String.raw`|1\rangle`} />).</>,
    vectorLabel: <InlineMath math={String.raw`|0\rangle`} />,
  },
  {
    id: 1,
    title: <>The Ket <InlineMath math={String.raw`|1\rangle`} /></>,
    subtitle: <><InlineMath math={String.raw`|1\rangle`} /> — Excited State</>,
    color: '#f093fb',
    glowColor: 'rgba(240,147,251,0.3)',
    borderColor: 'rgba(240,147,251,0.4)',
    math: '|1\\rangle = \\begin{bmatrix} 0 \\\\ 1 \\end{bmatrix}',
    theta: Math.PI,   // vector points DOWN (-Y)
    phi: 0,
    desc: <>Now the arrow swung 180° to point directly at the South Pole (the <InlineMath math={String.raw`|1\rangle`} /> axis). Look at the matrix again: the 1 has moved to the bottom position.</>,
    hint: 'Top number is now 0. Bottom number is 1, meaning 100% chance of measuring 1.',
    vectorLabel: <InlineMath math={String.raw`|1\rangle`} />,
  },
  {
    id: 2,
    title: <><InlineMath math={String.raw`\alpha`} /> & <InlineMath math={String.raw`\beta`} /> — Amplitudes</>,
    subtitle: <>Superposition State <InlineMath math={String.raw`|+\rangle`} /></>,
    color: '#f7971e',
    glowColor: 'rgba(247,151,30,0.3)',
    borderColor: 'rgba(247,151,30,0.4)',
    math: '|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle',
    theta: Math.PI / 2, // vector points sideways (+X)
    phi: 0,
    desc: <>When a qubit is in superposition, its vector points between states. <InlineMath math={String.raw`\alpha`} /> and <InlineMath math={String.raw`\beta`} /> are complex numbers called "amplitudes" — they encode the probability of each outcome.</>,
    hint: <>The Born Rule: the probability of measuring 0 is <InlineMath math={String.raw`|\alpha|^2`} />, and for 1 it is <InlineMath math={String.raw`|\beta|^2`} />.</>,
    vectorLabel: <InlineMath math={String.raw`|+\rangle`} />,
  },
  {
    id: 3,
    title: <><InlineMath math={String.raw`\langle\,|`} /> The Bra Notation</>,
    subtitle: <><InlineMath math={String.raw`\langle\psi|`} /> — Row Vector</>,
    color: '#43e97b',
    glowColor: 'rgba(67,233,123,0.3)',
    borderColor: 'rgba(67,233,123,0.4)',
    math: '\\langle\\psi| = [\\alpha^* \\;\\; \\beta^*]',
    theta: Math.PI * 0.3,   // ~54deg from vertical — clearly distinct diagonal
    phi: Math.PI * 1.25,    // points upper-left-back — visually dramatic
    desc: <>Why a row vector with an asterisk (*)? To find probabilities, we multiply a state by itself (inner product). In linear algebra, multiplying two column vectors doesn't work. We must turn the first into a row vector (transpose) and flip its imaginary parts (complex conjugate, the *) so the result is always a real, positive probability.</>,
    hint: <><InlineMath math={String.raw`\langle\psi|\varphi\rangle`} /> = "bracket" → that is literally where the word came from!</>,
    vectorLabel: <InlineMath math={String.raw`\langle\psi|`} />,
  },
].map((step) => {
  // Each step's measurement odds follow from where its vector points (the Born rule).
  const { p0, p1 } = bornProbabilities(step.theta);
  return { ...step, probTop: p0, probBottom: p1 };
});

// Static reusable vectors to prevent GC allocations
const _UP_VEC_DN = new THREE.Vector3(0, 1, 0);
const _tempDir_DN = new THREE.Vector3();
const _targetDir_DN = new THREE.Vector3();
const _targetQ_DN = new THREE.Quaternion();
const _targetColor_DN = new THREE.Color();

// ─── AXIS ARROW (3D) ──────────────────────────────────────────────────────
function AxisArrow({ dir, color, label, labelOffset }) {
  const len = 2.8;
  const [hovered, setHovered] = useState(false);
  const q = useMemo(() => {
    _tempDir_DN.set(...dir).normalize();
    return new THREE.Quaternion().setFromUnitVectors(_UP_VEC_DN, _tempDir_DN);
  }, [dir]);

  return (
    <group>
      <group quaternion={q}>
        {/* Shaft */}
        <mesh position={[0, len / 2, 0]}>
          <cylinderGeometry args={[0.018, 0.018, len, 12]} />
          <meshBasicMaterial color={color} transparent opacity={hovered ? 0.9 : 0.55} />
        </mesh>
        {/* Cone tip */}
        <mesh position={[0, len + 0.18, 0]}
          onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}>
          <coneGeometry args={[0.08, 0.36, 12]} />
          <meshBasicMaterial color={color} transparent opacity={hovered ? 1 : 0.75} />
        </mesh>
      </group>
      {/* Label in world space */}
      <Html position={labelOffset} center>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: '13px', fontWeight: '700',
          color, opacity: 0.8, userSelect: 'none',
          textShadow: `0 0 8px ${color}`,
        }}>{label}</span>
      </Html>
    </group>
  );
}

// ─── STATE VECTOR ARROW ───────────────────────────────────────────────────
function StateVector({ theta, phi, color, label }) {
  const groupRef = useRef();
  const shaftRef = useRef();
  const coneRef = useRef();
  const currentQ = useRef(new THREE.Quaternion());
  const currentColor = useRef(new THREE.Color(color));
  const L = 2.4;

  useFrame((_, delta) => {
    // Target direction
    _targetDir_DN.set(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi)
    ).normalize();

    _targetQ_DN.setFromUnitVectors(_UP_VEC_DN, _targetDir_DN);
    _targetColor_DN.set(color);

    // Smooth slerp rotation
    const t = Math.min(1, delta * 4);
    currentQ.current.slerp(_targetQ_DN, t);
    if (groupRef.current) groupRef.current.setRotationFromQuaternion(currentQ.current);

    // Color lerp
    currentColor.current.lerp(_targetColor_DN, t);
    const c = currentColor.current;
    if (shaftRef.current) shaftRef.current.color = c;
    if (coneRef.current) coneRef.current.color = c;
  });

  return (
    <group ref={groupRef}>
      {/* Solid Vector Shaft */}
      <mesh position={[0, L / 2, 0]}>
        <cylinderGeometry args={[0.036, 0.036, L, 16]} />
        <meshStandardMaterial ref={shaftRef} color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
      {/* Pointed Cone Arrowhead */}
      <mesh position={[0, L + 0.22, 0]}>
        <coneGeometry args={[0.16, 0.38, 16]} />
        <meshStandardMaterial ref={coneRef} color={color} emissive={color} emissiveIntensity={2.2} />
      </mesh>
      {/* Floating Arrow Tip Label */}
      <Html position={[0, L + 0.65, 0]} center zIndexRange={[100, 0]}>
        <div style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: '14px', fontWeight: '800',
          color: '#ffffff',
          textShadow: '0 0 12px ' + color + ', 0 0 24px ' + color,
          background: 'rgba(10, 18, 30, 0.75)',
          padding: '4px 10px',
          borderRadius: '12px',
          border: '1.5px solid ' + color,
          backdropFilter: 'blur(10px)',
          opacity: 0.95,
          animation: 'diracFadeIn 0.3s ease'
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── PROJECTION LINES (shown in step 2) ───────────────────────────────────
function ProjectionLines({ show, color }) {
  const lineRef1 = useRef();
  const lineRef2 = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const pulse = (Math.sin(t * 2) + 1) / 2;
    [lineRef1, lineRef2].forEach(r => {
      if (r.current) r.current.opacity = show ? (0.2 + pulse * 0.35) : 0;
    });
  });

  if (!show) return null;

  return (
    <>
      {/* Projection down to Y axis */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 5, 8]} />
        <meshBasicMaterial ref={lineRef1} color="#00f2fe" transparent opacity={0.3}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Projection to X axis */}
      <mesh position={[1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 2.6, 8]} />
        <meshBasicMaterial ref={lineRef2} color="#f7971e" transparent opacity={0.3}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

// ─── FLOATING LABELS for α and β ─────────────────────────────────────────
function AmplitudeLabels({ show }) {
  if (!show) return null;
  return (
    <>
      <Html position={[0.55, 1.2, 0]} center>
        <div style={{
          fontFamily: "'Fira Code',monospace", fontSize: '18px',
          color: '#00f2fe', fontWeight: '700', opacity: 0.9,
          textShadow: '0 0 12px #00f2fe',
          animation: 'diracFadeIn 0.5s ease',
        }}>α</div>
      </Html>
      <Html position={[0.55, -1.0, 0]} center>
        <div style={{
          fontFamily: "'Fira Code',monospace", fontSize: '18px',
          color: '#f7971e', fontWeight: '700', opacity: 0.9,
          textShadow: '0 0 12px #f7971e',
          animation: 'diracFadeIn 0.5s ease',
        }}>β</div>
      </Html>
    </>
  );
}

// ─── BLOCH REFERENCE RINGS ──────────────────────────────────────────────
function BlochSphereBody() {
  const R = 2.6;
  return (
    <group>
      {/* Subtle Reference Equatorial Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R, 0.010, 8, 80]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ─── MAIN 3D SCENE ───────────────────────────────────────────────────
export function DiracScene({ step, theme }) {
  const isLight = theme === 'light';
  const stepData = STEPS[step];

  return (
    <>
      <QualityComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.4} />
      </QualityComposer>
      
      <group position={[0, -0.5, 0]}>
        <ambientLight intensity={isLight ? 0.4 : 0.08} />
        <pointLight position={[5, 5, 5]} color={stepData.color} intensity={5} distance={22} />
        <pointLight position={[-5, -5, -5]} color="#4facfe" intensity={2} distance={20} />

        {/* ── Full Bloch sphere wireframe with meridians + latitudes ── */}
        <BlochSphereBody step={step} />
        {/* Origin sphere */}
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>

        {/* Coordinate axes */}
        <AxisArrow dir={[0, 1, 0]}  color="#22c55e" label={<InlineMath math={String.raw`|0\rangle`} />} labelOffset={[0.55, 3.1, 0]} />
        <AxisArrow dir={[0, -1, 0]} color="#ef4444" label={<InlineMath math={String.raw`|1\rangle`} />} labelOffset={[0.55, -3.1, 0]} />
        <AxisArrow dir={[1, 0, 0]}  color={isLight ? '#94a3b8' : '#2d3f55'} label="x" labelOffset={[3.2, 0, 0]} />
        <AxisArrow dir={[0, 0, -1]} color={isLight ? '#94a3b8' : '#2d3f55'} label="y" labelOffset={[-0.1, 0, -3.2]} />

        {/* Projection lines for step 2 */}
        <ProjectionLines show={step === 2} color={stepData.color} />

        {/* α β floating labels */}
        <AmplitudeLabels show={step === 2} />

        {/* The state vector */}
        <StateVector
          theta={stepData.theta}
          phi={stepData.phi}
          color={stepData.color}
          label={stepData.vectorLabel}
        />
      </group>

      <OrbitControls enablePan={false} enableZoom={true} minDistance={5} maxDistance={14} dampingFactor={0.08} enableDamping />
    </>
  );
}

// ─── 2D HTML OVERLAY (rendered outside canvas) ────────────────────────────
export function DiracOverlay({ step, onNext, onPrev, theme, isMuted, onToggleMute }) {
  const isLight = theme === 'light';
  const stepData = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <style>{`
        @keyframes diracFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes diracSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes diracPulse { 0%,100%{box-shadow:0 0 0 0 ${stepData.glowColor};} 60%{box-shadow:0 0 20px 6px ${stepData.glowColor};} }
      `}</style>

      {/* ── Step Indicator ── */}
      <div style={{
        position: 'absolute', top: '64px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '6px', zIndex: 300, alignItems: 'center', pointerEvents: 'none',
      }} data-jelly-fade>
        {STEPS.map((s, i) => (
          <div key={i} style={{
            width: i === step ? '24px' : '7px',
            height: '7px', borderRadius: '4px',
            background: i === step ? stepData.color : (i < step ? `${stepData.color}70` : 'rgba(255,255,255,0.18)'),
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: i === step ? `0 0 12px ${stepData.color}` : 'none',
          }} />
        ))}
      </div>

      {/* ── Top-left: Title card ── */}
      <div style={{
        position: 'absolute', top: '80px', left: '50px',
        animation: 'diracSlideUp 0.5s ease both', zIndex: 300, '--j': 0,
      }} data-jelly>
        <div className="glass-interactive" style={{
          background: 'var(--glass-bg-base)',
          backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
          border: isLight ? '1px solid rgba(0,0,0,0.1)' : 'var(--glass-border-base)',
          borderRadius: '24px', padding: '18px 22px',
          boxShadow: isLight
            ? `inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 20px 48px -10px rgba(0,0,0,0.15)`
            : `var(--glass-highlight), var(--glass-shadow-base)`,
          minWidth: '200px',
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{
            fontSize: '10px', fontWeight: '800', letterSpacing: '1.5px',
            color: stepData.color, textTransform: 'uppercase', marginBottom: '4px',
          }}>Dirac Notation</div>
          <div style={{
            fontSize: '20px', fontWeight: '900', color: isLight ? '#0f172a' : '#ffffff',
            lineHeight: 1.3, marginBottom: '4px',
          }}>{stepData.title}</div>
          <div style={{
            fontSize: '12px', color: stepData.color, fontFamily: "'Fira Code', monospace",
            fontWeight: '600',
          }}>{stepData.subtitle}</div>
        </div>
      </div>

      {/* ── Top-right: Description card ── */}
      <div style={{
        position: 'absolute', top: '80px', right: '50px',
        animation: 'diracSlideUp 0.5s ease 0.1s both', zIndex: 300, '--j': 1,
      }} data-jelly>
        <div className="glass-interactive" style={{
          background: 'var(--glass-bg-base)',
          backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
          border: isLight ? '1px solid rgba(0,0,0,0.1)' : 'var(--glass-border-base)',
          borderRadius: '24px', padding: '18px 22px',
          boxShadow: isLight
            ? `inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 20px 48px -10px rgba(0,0,0,0.15)`
            : `var(--glass-highlight), var(--glass-shadow-base)`,
          maxWidth: '300px',
          fontFamily: "'Inter', sans-serif",
        }}>
          <p style={{
            margin: '0 0 10px', fontSize: '13px', lineHeight: '1.65',
            color: isLight ? '#334155' : '#cbd5e1',
          }}>{stepData.desc}</p>
          <div style={{
            borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`, paddingTop: '10px',
            fontSize: '11px', color: stepData.color, fontWeight: '600',
            fontFamily: "'Fira Code', monospace",
          }}>
            💡 {stepData.hint}
          </div>
        </div>
      </div>

      {/* ── Bottom-left: Math card ── */}
      <div style={{
        position: 'absolute', bottom: '120px', left: '50px',
        animation: 'diracSlideUp 0.5s ease 0.2s both', zIndex: 300, '--j': 2,
      }} data-jelly>
        <div className="glass-interactive" style={{
          background: 'var(--glass-bg-base)',
          backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
          border: isLight ? '1px solid rgba(0,0,0,0.1)' : 'var(--glass-border-base)',
          borderRadius: '24px', padding: '18px 22px',
          boxShadow: isLight
            ? `inset 0 1.2px 1.5px rgba(255,255,255,0.95), 0 20px 48px -10px rgba(0,0,0,0.15)`
            : `var(--glass-highlight), var(--glass-shadow-base)`,
          minWidth: '180px',
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{
            fontSize: '10px', fontWeight: '800', letterSpacing: '1.5px',
            color: stepData.color, textTransform: 'uppercase', marginBottom: '10px',
          }}>Matrix Form</div>
          <div style={{ textAlign: 'center', color: isLight ? '#0f172a' : '#f8fafc' }}>
            <MathDisplay math={stepData.math} color={stepData.color} />
          </div>
        </div>
      </div>

      {/* 🚀 Dynamic Navigation Buttons 🚀 */}
      <QuantumNavButtons
        canPrev={step > 0}
        canNext={true}
        onPrev={onPrev}
        onNext={onNext}
        prevLabel="Back"
        nextLabel={isLast ? "Complete" : "Next"}
        isLast={isLast}
        accentColor={stepData.color || "#00f2fe"}
        containerStyle={{
          position: 'absolute',
          bottom: '40px',
          right: '40px',
          zIndex: 300,
        }}
      />
    </>
  );
}

function ProbBar({ value, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
      <span style={{ fontFamily: "'Fira Code',monospace", fontSize: '11px', color: '#64748b', minWidth: '26px' }}>{label}</span>
      <div style={{ flex: 1, height: '7px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: `${value * 100}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          borderRadius: '4px', transition: 'width 0.9s cubic-bezier(0.34,1.2,0.64,1)',
          boxShadow: `0 0 8px ${color}`,
        }} />
      </div>
      <span style={{ fontFamily: "'Fira Code',monospace", fontSize: '12px', color, fontWeight: '700', minWidth: '34px' }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

function MathDisplay({ math, color, step }) {
  const renders = {
    '|0\\rangle = \\begin{bmatrix} 1 \\\\ 0 \\end{bmatrix}': (
      <div style={{ fontFamily: "'Fira Code',monospace" }}>
        <span style={{ fontSize: '16px', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <InlineMath math={String.raw`|0\rangle`} /> =
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle',
            borderLeft: `2px solid ${color}`, borderRight: `2px solid ${color}`,
            padding: '3px 10px', borderRadius: '4px', margin: '0 2px',
            background: `${color}0a` }}>
            <span style={{ color, fontSize: '16px', fontWeight: '800', textShadow: `0 0 12px ${color}` }}>1</span>
            <span style={{ color: '#475569', fontSize: '14px', fontWeight: '400' }}>0</span>
          </span>
        </span>
        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
          <ProbBar value={1.0} color="#00f2fe" label={<InlineMath math={String.raw`|0\rangle`} />} />
          <ProbBar value={0.0} color="#f093fb" label={<InlineMath math={String.raw`|1\rangle`} />} />
        </div>
      </div>
    ),
    '|1\\rangle = \\begin{bmatrix} 0 \\\\ 1 \\end{bmatrix}': (
      <div style={{ fontFamily: "'Fira Code',monospace" }}>
        <span style={{ fontSize: '16px', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <InlineMath math={String.raw`|1\rangle`} /> =
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle',
            borderLeft: `2px solid ${color}`, borderRight: `2px solid ${color}`,
            padding: '3px 10px', borderRadius: '4px', margin: '0 2px',
            background: `${color}0a` }}>
            <span style={{ color: '#475569', fontSize: '14px', fontWeight: '400' }}>0</span>
            <span style={{ color, fontSize: '16px', fontWeight: '800', textShadow: `0 0 12px ${color}` }}>1</span>
          </span>
        </span>
        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
          <ProbBar value={0.0} color="#00f2fe" label={<InlineMath math={String.raw`|0\rangle`} />} />
          <ProbBar value={1.0} color="#f093fb" label={<InlineMath math={String.raw`|1\rangle`} />} />
        </div>
      </div>
    ),
    '|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle': (
      <div style={{ fontFamily: "'Fira Code',monospace" }}>
        <span style={{ fontSize: '14px', color: '#f8fafc', lineHeight: 2 }}>
          <InlineMath math={String.raw`|\psi\rangle`} /> = <span style={{ color: '#00f2fe' }}>α</span><InlineMath math={String.raw`|0\rangle`} /> + <span style={{ color: '#f7971e' }}>β</span><InlineMath math={String.raw`|1\rangle`} />
        </span>
        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
          <ProbBar value={0.5} color="#00f2fe" label={<InlineMath math={String.raw`|0\rangle`} />} />
          <ProbBar value={0.5} color="#f7971e" label={<InlineMath math={String.raw`|1\rangle`} />} />
        </div>
      </div>
    ),
    '\\langle\\psi| = [\\alpha^* \\;\\; \\beta^*]': (
      <span style={{ fontFamily: "'Fira Code',monospace", fontSize: '14px', color: '#f8fafc', lineHeight: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div>⟨ψ| = [<span style={{ color }}>α*</span>  <span style={{ color }}>β*</span>]</div>
        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>⟨ψ<InlineMath math={String.raw`|\psi\rangle`} /> =</span>
          <span>[<span style={{ color }}>α*</span> <span style={{ color }}>β*</span>]</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', borderLeft: '1px solid rgba(255,255,255,0.3)', borderRight: '1px solid rgba(255,255,255,0.3)', padding: '0 4px', lineHeight: 1.3 }}>
            <span>α</span>
            <span>β</span>
          </span>
          <span>= 1</span>
        </div>
      </span>
    ),
  };

  return renders[math] || <span style={{ fontFamily: "'Fira Code',monospace", color, fontSize: '14px' }}>{math}</span>;
}

export default DiracScene;
