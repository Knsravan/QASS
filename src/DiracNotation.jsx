import React from 'react';
import { OrbitControls } from '@react-three/drei';
import { Bloom } from '@react-three/postprocessing';
import { InlineMath } from './KatexMath';
import { bornProbabilities } from './quantumMath';
import { QuantumNavButtons } from './QuantumNavButtons';
import { QualityComposer } from './QualityScene';
import { DiracSpace } from './DiracSpace';
import { diracLive, useDiracTheta } from './diracLive';

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
    desc: <>The symbol <InlineMath math={String.raw`|\,\rangle`} /> (ket) is a physicist's way of writing a column vector. A qubit's states live in a space with two directions, <InlineMath math={String.raw`|0\rangle`} /> and <InlineMath math={String.raw`|1\rangle`} />. The arrow points straight along <InlineMath math={String.raw`|0\rangle`} />, so the column holds 1 (all of it along <InlineMath math={String.raw`|0\rangle`} />) on top and 0 below.</>,
    hint: <>Top number = how much <InlineMath math={String.raw`|0\rangle`} />. Bottom number = how much <InlineMath math={String.raw`|1\rangle`} />.</>,
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
    desc: <>Now the arrow lies along <InlineMath math={String.raw`|1\rangle`} />: a quarter turn from <InlineMath math={String.raw`|0\rangle`} />. The two are at right angles (orthogonal), so they share nothing, which is why a qubit in <InlineMath math={String.raw`|1\rangle`} /> can never read 0. In the column, the 1 has moved to the bottom.</>,
    hint: <>Right angle = no overlap: <InlineMath math={String.raw`\langle 0|1\rangle = 0`} />.</>,
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
    desc: <>In superposition the arrow points between the two directions. Its shadows on the axes are the amplitudes <InlineMath math={String.raw`\alpha`} /> and <InlineMath math={String.raw`\beta`} />, the column's two numbers. The glass squares built on them are the odds, and together they always fill exactly one square. Drag the arrow's tip to try it.</>,
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
    theta: Math.PI * 0.3,   // α ≈ 0.89, β ≈ 0.45: leans toward |0>
    phi: Math.PI * 1.25,    // β's phase: 225°, shown on its tile's dial
    desc: <>To find probabilities we multiply a state by itself (the inner product), but two columns can't be multiplied. So the column turns into a row (transpose) and passes through a mirror that flips each amplitude's phase dial (complex conjugate, the *). That row is the bra <InlineMath math={String.raw`\langle\psi|`} />. Row times column gives <InlineMath math={String.raw`\langle\psi|\psi\rangle = |\alpha|^2 + |\beta|^2 = 1`} />.</>,
    hint: <><InlineMath math={String.raw`\langle\psi|\varphi\rangle`} /> = "bracket" → that is literally where the word came from!</>,
    vectorLabel: <InlineMath math={String.raw`\langle\psi|`} />,
  },
].map((step) => {
  // Each step's measurement odds follow from where its vector points (the Born rule).
  const { p0, p1 } = bornProbabilities(step.theta);
  return { ...step, probTop: p0, probBottom: p1 };
});

// ─── MAIN 3D SCENE ───────────────────────────────────────────────────
// The qubit's state space, column vector and bra (DiracSpace.jsx). In the
// amplitudes step the viewer can drag the arrow; the state is shared with the
// overlay's matrix card through diracLive.
export function DiracScene({ step }) {
  const stepData = STEPS[step];
  const live = useDiracTheta();
  React.useEffect(() => {
    if (step === 2) diracLive.set(Math.PI / 2);
  }, [step]);
  const theta = step === 2 ? live : stepData.theta;

  return (
    <>
      <QualityComposer disableNormalPass>
        <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.4} />
      </QualityComposer>

      <ambientLight intensity={0.35} />
      <pointLight position={[6, 6, 6]} color="#00f2fe" intensity={6} distance={30} />
      <pointLight position={[-6, -6, -6]} color="#f093fb" intensity={6} distance={30} />

      <DiracSpace step={step} theta={theta} phase={stepData.phi} />

      <OrbitControls makeDefault enablePan={false} enableZoom={true} minDistance={4} maxDistance={16} dampingFactor={0.08} enableDamping />
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

// The amplitudes step's card follows the arrow as it's dragged.
function LiveSuperposition() {
  const theta = useDiracTheta();
  const alpha = Math.cos(theta / 2);
  const beta = Math.sin(theta / 2);
  return (
    <div style={{ fontFamily: "'Fira Code',monospace" }}>
      <span style={{ fontSize: '14px', color: '#f8fafc', lineHeight: 2 }}>
        <InlineMath math={String.raw`|\psi\rangle`} /> = <span style={{ color: '#00f2fe' }}>{alpha.toFixed(2)}</span><InlineMath math={String.raw`|0\rangle`} /> + <span style={{ color: '#f093fb' }}>{beta.toFixed(2)}</span><InlineMath math={String.raw`|1\rangle`} />
      </span>
      <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
        <ProbBar value={alpha * alpha} color="#00f2fe" label={<InlineMath math={String.raw`|\alpha|^2`} />} />
        <ProbBar value={beta * beta} color="#f093fb" label={<InlineMath math={String.raw`|\beta|^2`} />} />
      </div>
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
    '|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle': <LiveSuperposition />,
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
