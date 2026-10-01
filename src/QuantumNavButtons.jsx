import React, { memo } from 'react';
import { MorphIcon } from 'morphicons/react';
import { ChevronLeft, ChevronRight, Check } from 'lucide';

const cleanPrevText = (text) => (text || '').replace(/[←◀◄<]/g, '').trim();
const cleanNextText = (text) => (text || '').replace(/[→▶►➔>✓]/g, '').trim();

/**
 * 🔮 QuantumNavButtons
 * Universal Glass Next & Prev Dynamic Navigation Controller
 * Designed specifically for all modules in QASS.
 */
export const QuantumNavButtons = memo(function QuantumNavButtons({
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  prevLabel = 'Prev',
  nextLabel = 'Next',
  isLast = false,
  isComplete = false,
  accentColor = '#00f2fe',
  containerStyle = {},
  className = '',
}) {
  if (!onPrev && !onNext) return null;

  return (
    <div
      className={`quantum-nav-container ${className}`}
      style={{
        '--nav-border': accentColor,
        '--nav-color': accentColor,
        '--nav-glow': `${accentColor}55`,
        '--nav-border-hover': '#38bdf8',
        '--nav-glow-hover': `${accentColor}88`,
        ...containerStyle,
      }}
    >
      {/* ◀ PREV BUTTON */}
      {onPrev && (
        <button
          type="button"
          className="quantum-nav-btn prev-btn glass-btn glass-interactive"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous step"
        >
          <MorphIcon
            icon={ChevronLeft}
            spring="smooth"
            strokeWidth={1}
            size={16}
            color="currentColor"
          />
          <span>{cleanPrevText(prevLabel) || 'Prev'}</span>
        </button>
      )}

      {/* NEXT ▶ BUTTON */}
      {onNext && (
        <button
          type="button"
          className="quantum-nav-btn next-btn glass-btn glass-interactive"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next step"
        >
          <span>
            {isComplete
              ? 'Complete'
              : cleanNextText(nextLabel) || (isLast ? 'Complete' : 'Next')}
          </span>
          {isComplete || isLast ? (
            <MorphIcon
              icon={Check}
              spring="smooth"
              strokeWidth={1}
              size={16}
              color="currentColor"
            />
          ) : (
            <MorphIcon
              icon={ChevronRight}
              spring="smooth"
              strokeWidth={1}
              size={16}
              color="currentColor"
            />
          )}
        </button>
      )}
    </div>
  );
});

export default QuantumNavButtons;
