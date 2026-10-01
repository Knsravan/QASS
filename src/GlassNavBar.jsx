import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/*
 * The iOS 26 floating tab bar, after BitChord's GlassNavBar / FloatingTabBar:
 * a glass capsule of tabs and a standalone glass circle beside it.
 *
 * The selection indicator is a spring (damping 0.72, stiffness 320) run by
 * hand rather than a CSS transition, so it can be grabbed and redirected
 * mid-flight. While it lags behind its target it stretches along the
 * direction of travel and gives back half of that in height. Dragging across
 * the capsule moves it 1:1, resists past either end, and commits once the drag
 * passes 35% of a tab.
 */

const STIFFNESS = 320;
const DAMPING_RATIO = 0.72;
const DAMPING = 2 * DAMPING_RATIO * Math.sqrt(STIFFNESS);
const STRETCH = 0.16;
const SQUASH = 0.5;
const RUBBER_BAND = 0.25;
const COMMIT_RATIO = 0.35;
const DRAG_SLOP = 8;

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function GlassNavBar({ tabs, selectedIndex, onSelect, standalone, ariaLabel }) {
  const rowRef = useRef(null);
  const indicatorRef = useRef(null);
  const geometry = useRef({ step: 0, width: 0 });
  const spring = useRef({ position: 0, velocity: 0, target: 0, frame: 0, last: 0 });
  const drag = useRef(null);
  const suppressClick = useRef(false);

  const render = useCallback(() => {
    const node = indicatorRef.current;
    const { step, width } = geometry.current;
    if (!node || !width) return;
    const s = spring.current;
    const lag = step > 0 ? Math.min(1, Math.abs(s.target - s.position) / step) : 0;
    node.style.width = `${width}px`;
    node.style.transform =
      `translateX(${s.position}px) scale(${1 + lag * STRETCH}, ${1 - lag * STRETCH * SQUASH})`;
  }, []);

  const tick = useCallback((now) => {
    const s = spring.current;
    const dt = Math.min(0.064, (now - s.last) / 1000 || 0.016);
    s.last = now;
    // Sub-stepped semi-implicit Euler keeps the spring stable on slow frames.
    const steps = Math.ceil(dt / 0.004);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const accel = -STIFFNESS * (s.position - s.target) - DAMPING * s.velocity;
      s.velocity += accel * h;
      s.position += s.velocity * h;
    }
    if (Math.abs(s.position - s.target) < 0.1 && Math.abs(s.velocity) < 2) {
      s.position = s.target;
      s.velocity = 0;
      s.frame = 0;
      render();
      return;
    }
    render();
    s.frame = requestAnimationFrame(tick);
  }, [render]);

  const animateTo = useCallback((target, immediate = false) => {
    const s = spring.current;
    s.target = target;
    if (immediate || prefersReducedMotion()) {
      s.position = target;
      s.velocity = 0;
      if (s.frame) cancelAnimationFrame(s.frame);
      s.frame = 0;
      render();
      return;
    }
    if (!s.frame) {
      s.last = performance.now();
      s.frame = requestAnimationFrame(tick);
    }
    // Throttled frames (background tab) must never leave the pill stranded.
    clearTimeout(s.fallback);
    const startedAt = s.last;
    s.fallback = setTimeout(() => {
      if (s.frame && s.last === startedAt) {
        cancelAnimationFrame(s.frame);
        s.frame = 0;
        s.position = s.target;
        s.velocity = 0;
        render();
      }
    }, 500);
  }, [render, tick]);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row || !tabs.length) return;
    const width = row.clientWidth / tabs.length;
    geometry.current = { step: width, width };
  }, [tabs.length]);

  useLayoutEffect(() => {
    measure();
    animateTo(selectedIndex * geometry.current.step, true);
    const observer = new ResizeObserver(() => {
      measure();
      if (!drag.current) animateTo(selectedIndex * geometry.current.step, true);
    });
    if (rowRef.current) observer.observe(rowRef.current);
    return () => observer.disconnect();
    // Only geometry changes should snap; selection changes spring below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, animateTo]);

  useEffect(() => {
    if (!drag.current) animateTo(selectedIndex * geometry.current.step);
  }, [selectedIndex, animateTo]);

  useEffect(() => () => {
    cancelAnimationFrame(spring.current.frame);
    clearTimeout(spring.current.fallback);
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, startX: e.clientX, total: 0, active: false };
    suppressClick.current = false;
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.total = e.clientX - d.startX;
    if (!d.active) {
      if (Math.abs(d.total) < DRAG_SLOP) return;
      d.active = true;
      rowRef.current?.setPointerCapture(e.pointerId);
    }
    const last = tabs.length - 1;
    let offset = d.total;
    if ((offset > 0 && selectedIndex === last) || (offset < 0 && selectedIndex === 0)) {
      offset *= RUBBER_BAND;
    }
    animateTo(selectedIndex * geometry.current.step + offset);
  };

  const endDrag = (e, cancelled) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    suppressClick.current = true;
    const step = geometry.current.step;
    let next = selectedIndex;
    if (!cancelled && step > 0) {
      const ratio = d.total / step;
      const shift = ratio > COMMIT_RATIO ? Math.max(1, Math.round(ratio))
        : ratio < -COMMIT_RATIO ? Math.min(-1, Math.round(ratio)) : 0;
      next = Math.min(tabs.length - 1, Math.max(0, selectedIndex + shift));
    }
    if (next !== selectedIndex) onSelect(next);
    else animateTo(selectedIndex * step);
  };

  const handleTabClick = (index) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (index !== selectedIndex) onSelect(index);
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = Math.min(tabs.length - 1, Math.max(0, selectedIndex + (e.key === 'ArrowRight' ? 1 : -1)));
    if (next !== selectedIndex) {
      onSelect(next);
      rowRef.current?.children[next]?.focus();
    }
  };

  return (
    <nav className="lg-nav" aria-label={ariaLabel}>
      <div className="lg-nav-pill lg-bar">
        <div className="lg-nav-indicator" ref={indicatorRef} aria-hidden="true" />
        <div
          className="lg-nav-row"
          ref={rowRef}
          role="tablist"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          onKeyDown={handleKeyDown}
        >
          {tabs.map((tab, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-label={tab.label}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`lg-nav-tab${selected ? ' is-selected' : ''}`}
                onClick={() => handleTabClick(index)}
              >
                <span className="lg-nav-icon">{tab.icon(selected)}</span>
                <span className="lg-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {standalone && (
        <button
          type="button"
          className={`lg-nav-circle lg-bar lg-magnetic${standalone.active ? ' is-active' : ''}`}
          onClick={standalone.onClick}
          aria-label={standalone.label}
          title={standalone.label}
        >
          {standalone.icon}
        </button>
      )}
    </nav>
  );
}
