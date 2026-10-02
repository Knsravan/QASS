import React, { useEffect, useId, useRef } from 'react';
import { motionReduced, subscribeQuality } from './quality';

/*
 * The QASS mark, "Bloch Q · Neon Orbit": the Q of QASS drawn as the app's
 * Bloch sphere, with the state vector running out of the sphere as the Q's
 * tail. Pure SVG, so it is sharp at every size.
 *
 * Motion (SMIL, so it costs no JavaScript per frame): a meridian turns the
 * sphere, light dashes along the back of the equator, a spark circles the
 * equator, the state point breathes and the |0> pole blinks. Paused when
 * Motion is set to reduced (the system setting or the Display &
 * Accessibility panel), or with `animated={false}`.
 *
 * `intro` draws the mark on once when it first appears (the landing page).
 * `title=""` hides it from screen readers where text beside it already says QASS.
 *
 * The same drawing, without motion, is public/logo.svg; the favicon
 * (public/favicon.svg) is a heavier version made for 16 px.
 */

const EQ = 'M22,58 A38,11 0 1 0 98,58 A38,11 0 1 0 22,58';
const BACK = 'M22,58 A38,11 0 0 1 98,58';
const FRONT = 'M22,58 A38,11 0 0 0 98,58';
const SPLINE = '.45 0 .55 1;.45 0 .55 1';

const reducedMotion = motionReduced;

export default function QassLogo({ size = 32, animated = true, intro = false, title = 'QASS', className = '', style }) {
  const id = useId().replace(/:/g, '');
  const grad = `qg${id}`;
  const glow = `qf${id}`;
  const ref = useRef(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    // Paused or moving as the person's Motion choice says, live.
    const follow = () => (!animated || reducedMotion() ? svg.pauseAnimations?.() : svg.unpauseAnimations?.());
    follow();
    const stop = subscribeQuality(follow);
    if (!intro || reducedMotion() || !svg.animate) return stop;
    // Draw every stroke on, one after another, then let the mark move.
    svg.querySelectorAll('[data-draw]').forEach((el, i) => {
      let len;
      try { len = el.getTotalLength(); } catch { return; }
      if (!len) return;
      el.animate(
        [{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }],
        { duration: 1000, delay: 150 + i * 120, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'backwards' },
      );
    });
    svg.animate([{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
    return stop;
  }, [animated, intro]);

  return (
    <svg
      ref={ref}
      className={`qass-logo ${className}`.trim()}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="18" y1="16" x2="104" y2="100">
          <stop offset="0" stopColor="#3ee6ff" />
          <stop offset="1" stopColor="#b06cff" />
        </linearGradient>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={BACK} fill="none" stroke="#7fe9ff" strokeOpacity=".35" strokeWidth="2" strokeDasharray="2.5 4.5">
        <animate attributeName="stroke-dashoffset" values="0;-14" dur="1.4s" repeatCount="indefinite" />
      </path>
      <ellipse cx="60" cy="58" rx="38" ry="38" fill="none" stroke="#7fe9ff" strokeWidth="1.6" strokeOpacity=".35">
        <animate attributeName="rx" values="38;0;38" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines={SPLINE} />
      </ellipse>
      <g filter={`url(#${glow})`}>
        <circle data-draw cx="60" cy="58" r="38" fill="none" stroke={`url(#${grad})`} strokeWidth="7.5" />
        <path d="M33,31 A38,38 0 0 1 60,20" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="2.4" strokeLinecap="round" />
        <path data-draw d={FRONT} fill="none" stroke="#7fe9ff" strokeOpacity=".9" strokeWidth="2.6" />
        <line data-draw x1="60" y1="58" x2="100" y2="98" stroke={`url(#${grad})`} strokeWidth="7.5" strokeLinecap="round" />
        <circle cx="100" cy="98" r="7" fill="#b06cff">
          <animate attributeName="r" values="7;8.6;7" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle r="2.8" fill="#fff">
          <animateMotion path={EQ} dur="3.2s" repeatCount="indefinite" />
        </circle>
      </g>
      <circle cx="60" cy="58" r="4.5" fill="#eef4ff" />
      <circle cx="60" cy="20" r="3" fill="#3ee6ff">
        <animate attributeName="opacity" values="1;.3;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
