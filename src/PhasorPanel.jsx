import React, { useEffect, useRef, useState } from 'react';
import { InlineMath } from 'react-katex';

// Renders an animated SVG Phasor for a specific basis state (<InlineMath math={String.raw`|0\rangle`} /> or <InlineMath math={String.raw`|1\rangle`} />)
const PhasorArea = ({ basis, step, phase, isLight }) => {
  const svgRef = useRef(null);
  
  // Base circle radius
  const R = 35;
  
  // Calculate vectors based on step
  let v1 = { mag: 0, ang: 0 };
  let v2 = null;
  let result = { mag: 0, ang: 0 };
  let label = "";

  if (step === 0) {
    if (basis === 0) { v1 = { mag: 1, ang: 0 }; result = { mag: 1, ang: 0 }; }
    else { v1 = { mag: 0, ang: 0 }; result = { mag: 0, ang: 0 }; }
  } else if (step === 1) {
    v1 = { mag: 0.707, ang: 0 };
    result = { mag: 0.707, ang: 0 };
  } else if (step === 2) {
    if (basis === 0) { v1 = { mag: 0.707, ang: 0 }; result = { mag: 0.707, ang: 0 }; }
    else { v1 = { mag: 0.707, ang: phase }; result = { mag: 0.707, ang: phase }; }
  } else if (step === 3) {
    // 2nd H gate splits the incoming amplitudes
    // For |0>: H(|0>) gives 1/sqrt(2), H(|1>) gives 1/sqrt(2)
    // For |1>: H(|0>) gives 1/sqrt(2), H(|1>) gives -1/sqrt(2)
    
    // incoming from |0> branch is 0.707 * exp(i*0)
    // incoming from |1> branch is 0.707 * exp(i*phase)
    
    // applied H:
    if (basis === 0) {
      v1 = { mag: 0.5, ang: 0 }; 
      v2 = { mag: 0.5, ang: phase };
      
      const real = v1.mag * Math.cos(v1.ang) + v2.mag * Math.cos(v2.ang);
      const imag = v1.mag * Math.sin(v1.ang) + v2.mag * Math.sin(v2.ang);
      result = { mag: Math.sqrt(real*real + imag*imag), ang: Math.atan2(imag, real) };
      
      if (Math.abs(result.mag - 1) < 0.01) label = "Constructive — amplifies";
      else if (result.mag < 0.01) label = "Destructive — cancels to zero";
    } else {
      v1 = { mag: 0.5, ang: 0 };
      v2 = { mag: 0.5, ang: phase + Math.PI };
      
      const real = v1.mag * Math.cos(v1.ang) + v2.mag * Math.cos(v2.ang);
      const imag = v1.mag * Math.sin(v1.ang) + v2.mag * Math.sin(v2.ang);
      result = { mag: Math.sqrt(real*real + imag*imag), ang: Math.atan2(imag, real) };
      
      if (Math.abs(result.mag - 1) < 0.01) label = "Constructive — amplifies";
      else if (result.mag < 0.01) label = "Destructive — cancels to zero";
    }
  }

  // Helpers to draw vectors
  const toCartesian = (mag, ang) => ({
    x: mag * R * Math.cos(ang),
    y: -mag * R * Math.sin(ang) // SVG y is down
  });

  const pt1 = toCartesian(v1.mag, v1.ang);
  const pt2 = v2 ? toCartesian(v2.mag, v2.ang) : {x:0, y:0};
  
  // Colors
  const color1 = "#0ea5e9";
  const color2 = "#f43f5e";
  const colorRes = basis === 0 ? "#10b981" : "#8b5cf6";
  
  const drawArrow = (x1, y1, x2, y2, color, strokeWidth = 2) => {
    if (Math.abs(x1-x2) < 0.1 && Math.abs(y1-y2) < 0.1) return null; // Too small
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={strokeWidth} />
        <circle cx={x2} cy={y2} r={2.5} fill={color} />
      </g>
    );
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: isLight ? 'rgba(255,255,255,0.6)' : 'var(--glass-bg)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '14px', padding: '10px 14px', position: 'relative',
      minWidth: '130px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: isLight ? '#0f172a' : '#f8fafc', marginBottom: '6px' }}>
        <InlineMath math={String.raw`|${basis}\rangle`} /> Amplitude
      </div>
      
      <svg width={2*R + 30} height={2*R + 30} viewBox={`-${R+15} -${R+15} ${2*R+30} ${2*R+30}`} style={{ overflow: 'visible' }}>
        {/* Background grid */}
        <circle cx="0" cy="0" r={R} fill="none" stroke={isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} strokeDasharray="3 3" />
        <line x1={-R-5} y1="0" x2={R+5} y2="0" stroke={isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} />
        <line x1="0" y1={-R-5} x2="0" y2={R+5} stroke={isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} />
        
        {/* Origin */}
        <circle cx="0" cy="0" r="3" fill={isLight ? "#94a3b8" : "#475569"} />
        
        <g style={{ transition: 'all 0.5s ease-out' }}>
          {/* Component 1 */}
          {v1.mag > 0.01 && drawArrow(0, 0, pt1.x, pt1.y, color1, 2)}
          
          {/* Component 2 */}
          {step === 3 && v2 && v2.mag > 0.01 && drawArrow(pt1.x, pt1.y, pt1.x + pt2.x, pt1.y + pt2.y, color2, 2)}
          
          {/* Result */}
          {step === 3 && result.mag > 0.01 && drawArrow(0, 0, pt1.x + pt2.x, pt1.y + pt2.y, colorRes, 2.5)}
        </g>
      </svg>
      
      <div style={{ marginTop: '8px', fontSize: '12px', fontFamily: "'Fira Code', monospace", color: '#94a3b8' }}>
        P(<InlineMath math={String.raw`|${basis}\rangle`} />): {(result.mag * result.mag).toFixed(2)}
      </div>
      
      {step === 3 && label && (
        <div style={{
          position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
          background: label.includes('Destructive') ? '#1e293b' : '#fbbf24',
          color: label.includes('Destructive') ? '#94a3b8' : '#000',
          padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
          whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          transition: 'all 0.3s ease',
          animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          {label}
        </div>
      )}
    </div>
  );
};

export function PhasorPanel({ step, phase, isLight }) {
  return (
    <>
      <div className="phasor-panel-container" style={{
        position: 'absolute', top: '45%', left: '40px', transform: 'translateY(-50%)',
        zIndex: 100, pointerEvents: 'none'
      }}>
        <PhasorArea basis={0} step={step} phase={phase} isLight={isLight} />
      </div>
      <div className="phasor-panel-container" style={{
        position: 'absolute', top: '45%', right: '40px', transform: 'translateY(-50%)',
        zIndex: 100, pointerEvents: 'none'
      }}>
        <PhasorArea basis={1} step={step} phase={phase} isLight={isLight} />
      </div>
    </>
  );
}
