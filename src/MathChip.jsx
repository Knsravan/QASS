import React from 'react';
import { InlineMath } from './KatexMath';
import './styles/math-chip.css';

// A label pinned to a 3D model: a pill of liquid glass with the label typeset
// in KaTeX. `tone` picks its colour (zero, one, gold, green, red, or none for a
// neutral chip); `active` lights it up.
export function MathChip({ tex, tone, active, small, round, className = '', style }) {
  const cls = ['math-chip', tone && `math-chip-${tone}`, small && 'math-chip-sm', round && 'math-chip-round', className].filter(Boolean).join(' ');
  return (
    <span className={cls} data-active={active ? '' : undefined} style={style}>
      <InlineMath math={tex} />
    </span>
  );
}
