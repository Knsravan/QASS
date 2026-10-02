import React, { useEffect, useRef } from 'react';

/*
 * The sidebar as two pages: the module list, and the open module's own page
 * that slides in over it (like iOS settings). The page has a back button to
 * the list; going back keeps the module open in the scene, with its row
 * highlighted in the list.
 *
 * Back: the button, Escape while the page has focus, or dragging the page to
 * the right from its left edge. Previous / Next at the bottom move between
 * modules without going back to the list.
 *
 * `list` is the module list; `page` is null when only the list can show
 * (collapsed sidebar, no open module), else { mod, prev, next, content }.
 */

export function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export default function SidebarPages({ list, page, pushed, icon, onBack, onGo }) {
  const navRef = useRef(null);
  const listRef = useRef(null);
  const pageRef = useRef(null);
  const scrollRef = useRef(null);
  const backRef = useRef(null);
  const wasPushed = useRef(pushed);
  const modId = page?.mod.id;

  // Focus follows the move: the back button on the way in, the module's row
  // on the way out (only when focus was already in the sidebar).
  useEffect(() => {
    const from = wasPushed.current;
    wasPushed.current = pushed;
    if (from === pushed) return;
    const inside = navRef.current?.contains(document.activeElement);
    if (!inside) return;
    if (pushed) backRef.current?.focus({ preventScroll: true });
    else listRef.current?.querySelector(`[data-module="${modId}"]`)?.focus({ preventScroll: true });
  }, [pushed, modId]);

  // A new module's page starts at its top.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [modId]);

  // Swipe back: the page follows the pointer from its left edge.
  const drag = useRef(null);
  const onDown = (e) => {
    if (!pushed || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x0: e.clientX, t0: performance.now(), w: navRef.current.clientWidth, dx: 0 };
    navRef.current.classList.add('is-dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dx = Math.max(0, e.clientX - d.x0);
    const p = Math.min(1, d.dx / d.w);
    pageRef.current.style.transform = `translateX(${d.dx}px)`;
    listRef.current.style.transform = `translateX(${-28 + 28 * p}%)`;
    listRef.current.style.opacity = String(p);
  };
  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    navRef.current.classList.remove('is-dragging');
    pageRef.current.style.transform = '';
    listRef.current.style.transform = '';
    listRef.current.style.opacity = '';
    const speed = d.dx / Math.max(1, performance.now() - d.t0);
    if (d.dx > d.w * 0.35 || (d.dx > 24 && speed > 0.6)) onBack();
  };

  const { mod, prev, next, content } = page || {};
  return (
    <div ref={navRef} className={`sidebar-nav ${pushed ? 'is-pushed' : ''}`}>
      <div ref={listRef} className="sidebar-scrollable-content sidebar-list" aria-hidden={pushed || undefined} inert={pushed || undefined}>
        {list}
      </div>
      {page && (
        <section
          ref={pageRef}
          className="sidebar-page"
          aria-label={mod.title}
          aria-hidden={!pushed || undefined}
          inert={!pushed || undefined}
          style={{ '--module-accent': mod.accent }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onBack(); } }}
        >
          <div className="sidebar-page-edge" aria-hidden="true" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          <div className="sidebar-page-head">
            <button ref={backRef} type="button" className="sidebar-page-back" onClick={onBack}>
              <BackIcon />Modules
            </button>
            <div className="sidebar-page-title">
              <span className="sidebar-page-icon">{icon(mod)}</span>
              <h2>{mod.title}</h2>
            </div>
            <div className="sidebar-page-sweep" />
          </div>
          {/* Only this part scrolls, so the header never needs a backing of its
              own: the sidebar's glass shows behind it too. */}
          <div ref={scrollRef} className="sidebar-page-scroll">
            <div className="sidebar-page-body" key={mod.id}>
              {content}
            </div>
            <nav className="sidebar-page-pager" aria-label="Other modules">
              <button type="button" disabled={!prev} onClick={() => prev && onGo(prev.id)}>
                <span>‹ Previous</span><b>{prev?.title}</b>
              </button>
              <button type="button" disabled={!next} onClick={() => next && onGo(next.id)}>
                <span>Next ›</span><b>{next?.title}</b>
              </button>
            </nav>
          </div>
        </section>
      )}
    </div>
  );
}
