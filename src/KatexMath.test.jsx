import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InlineMath, BlockMath } from './KatexMath';

describe('KatexMath', () => {
  test('inline math renders in a span, not display mode', () => {
    const html = renderToStaticMarkup(<InlineMath math={String.raw`|\psi\rangle`} />);
    expect(html.startsWith('<span>')).toBe(true);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-display');
  });

  test('block math renders in a div, in display mode', () => {
    const html = renderToStaticMarkup(<BlockMath math={String.raw`\rho_{01}(t) = \rho_{01}(0)\, e^{-t/T_2}`} />);
    expect(html.startsWith('<div>')).toBe(true);
    expect(html).toContain('katex-display');
  });

  test('a formula that fails to parse shows as an error instead of throwing', () => {
    const html = renderToStaticMarkup(<InlineMath math={String.raw`\frac{1}{`} />);
    expect(html).toContain('katex-error');
  });
});
